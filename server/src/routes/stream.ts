import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import { requireFirebaseAuth } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { explainConceptStream, classifyConcept } from '../services/gemini'
import { retrieveChunks } from '../services/rag'
import { recordInteraction } from '../services/misconception'
import { saveInteraction } from '../services/firestore'
import { addXP, updateStreak } from '../services/gamification'
import { cacheInvalidate } from '../services/cache'
import { logger } from '../logger'
import { shouldUseCourseRag } from '../services/ragPolicy'

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

function toSnakeCase(input: any): string {
  return String(input ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function normalizeClassifierTag(classifierTag: any, fallbackConcept: string) {
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

router.post('/explain', requireFirebaseAuth, validate(schema), async (req: Request, res: Response) => {
  const uid = req.user!.uid
  const { question, courseId } = req.body

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  
  // Express 5.x handles res.flushHeaders() differently or not at all depending on middleware
  // We'll just rely on the headers being sent.

  const heartbeat = setInterval(() => res.write(': ping\n\n'), 20_000)
  // Cancel heartbeat immediately if the client disconnects before the stream ends.
  req.on('close', () => clearInterval(heartbeat))

  let fullAnswer = ''

  try {
    let ragContext = ''
    try {
      if (courseId && shouldUseCourseRag(question)) {
        const chunks = await retrieveChunks(uid, courseId, question)
        ragContext = chunks.join('\n\n---\n\n')
      }
    } catch (ragErr) {
      logger.warn({ ragErr }, 'RAG context unavailable, proceeding without context')
    }

    const stream = await explainConceptStream(question, ragContext)

    for await (const chunk of stream) {
      const text = typeof chunk.text === 'function' ? chunk.text() : (chunk as any).text
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
    } catch { /* headers already sent */ }
  } finally {
    clearInterval(heartbeat)
    res.end()

    if (fullAnswer.trim()) {
      classifyConcept(question, fullAnswer)
        .then((raw) => {
          const classifierTag = normalizeClassifierTag(raw, '')
          recordInteraction(uid, classifierTag.conceptNode, {
            errorType: classifierTag.errorType,
            confidence: classifierTag.confidence,
            courseId,
            isCorrect: classifierTag.errorType === 'none',
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
