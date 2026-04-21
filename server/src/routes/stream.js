import { Router } from 'express'
import { z } from 'zod'
import { requireFirebaseAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { explainConceptStream, classifyConcept } from '../services/gemini.js'
import { retrieveChunks } from '../services/rag.js'
import { recordInteraction } from '../services/misconception.js'
import { saveInteraction } from '../services/firestore.js'
import { addXP, updateStreak } from '../services/gamification.js'
import { cacheInvalidate } from '../services/cache.js'
import { logger } from '../logger.js'
import { shouldUseCourseRag } from '../services/ragPolicy.js'

const router = Router()

const schema = z.object({
  question: z.string().min(1).max(2000),
  courseId: z.string().optional(),
})

const ALLOWED_ERROR_TYPES = new Set([
  'conceptual_misunderstanding',
  'procedural_error',
  'knowledge_gap',
  'reasoning_error',
  'none',
])

function toSnakeCase(input) {
  return String(input ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function normalizeClassifierTag(classifierTag, fallbackConcept) {
  const fallback = toSnakeCase(fallbackConcept) || 'general_concept'
  const conceptNode = toSnakeCase(classifierTag?.conceptNode) || fallback
  const errorType = ALLOWED_ERROR_TYPES.has(classifierTag?.errorType)
    ? classifierTag.errorType
    : 'knowledge_gap'
  const rawConfidence = Number(classifierTag?.confidence)
  const confidence = Number.isFinite(rawConfidence)
    ? Math.min(1, Math.max(0, rawConfidence))
    : 0.5

  return { conceptNode, errorType, confidence }
}

router.post('/explain', requireFirebaseAuth, validate(schema), async (req, res) => {
  const { uid } = req.user
  const { question, courseId } = req.body

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  const heartbeat = setInterval(() => res.write(': ping\n\n'), 20_000)
  // Cancel heartbeat immediately if the client disconnects before the stream ends.
  req.on('close', () => clearInterval(heartbeat))

  let fullAnswer = ''

  try {
    // Attempt RAG context retrieval — gracefully degrade if unavailable
    let ragContext = ''
    try {
      if (shouldUseCourseRag(question)) {
        const chunks = await retrieveChunks(uid, courseId, question)
        ragContext = chunks.join('\n\n---\n\n')
      }
    } catch (ragErr) {
      logger.warn({ ragErr }, 'RAG context unavailable, proceeding without context')
    }

    const stream = await explainConceptStream(question, ragContext)

    for await (const chunk of stream) {
      // @google/genai SDK chunk has a .text property (string or function)
      const text = typeof chunk.text === 'function' ? chunk.text() : chunk.text
      if (text) {
        fullAnswer += text
        res.write(`data: ${JSON.stringify({ text })}\n\n`)
      }
    }

    res.write('data: [DONE]\n\n')
  } catch (err) {
    logger.error({ err, uid }, 'SSE stream failed')
    try {
      res.write(`data: ${JSON.stringify({ error: 'Stream interrupted' })}\n\n`)
    } catch { /* headers already sent — swallow secondary write error */ }
  } finally {
    clearInterval(heartbeat)
    res.end()

    // Fire-and-forget side effects — only when there is content to track
    if (fullAnswer.trim()) {
      classifyConcept(question, fullAnswer)
        .then((raw) => {
          const classifierTag = normalizeClassifierTag(raw, '')
          recordInteraction(uid, classifierTag.conceptNode, {
            errorType: classifierTag.errorType,
            confidence: classifierTag.confidence,
            courseId,
          }).catch((err) => logger.warn({ err, uid }, 'stream recordInteraction failed'))
          saveInteraction(uid, {
            courseId,
            content: question,
            eventType: 'explain',
            response: { solution: fullAnswer },
            classifierTag,
          }).catch((err) => logger.warn({ err, uid }, 'stream saveInteraction failed'))
          cacheInvalidate(`graph:${uid}`)
          cacheInvalidate(`drill:${uid}`)
        })
        .catch((err) => logger.warn({ err, uid }, 'stream side-effects failed'))

      addXP(uid, 5, 'explain').catch((err) => logger.warn({ err, uid }, 'stream addXP failed'))
      updateStreak(uid).catch((err) => logger.warn({ err, uid }, 'stream updateStreak failed'))
    }
  }
})

export const streamRouter = router
