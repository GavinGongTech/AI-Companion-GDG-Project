import { Router } from "express";
import { explainConcept, classifyConcept } from "../services/gemini.js";
import { retrieveChunks } from "../services/rag.js";
import { recordInteraction } from "../services/misconception.js";
import { saveInteraction, ensureUserDoc } from "../services/firestore.js";
import { extractTextFromBase64 } from "../services/ocr.js";
import { requireFirebaseAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { analyzeSchema } from "../schemas.js";
import { cacheInvalidate } from "../services/cache.js";
import { addXP, updateStreak } from "../services/gamification.js";
import { logger } from "../logger.js";

export const analyzeRouter = Router();

analyzeRouter.post("/", requireFirebaseAuth, validate(analyzeSchema), async (req, res, next) => {
  try {
    const uid = req.user.uid;
    const { courseId, content, imageBase64 } = req.body ?? {};

    // Accept text content or base64 image (OCR it first)
    let text = typeof content === "string" ? content.trim() : "";
    if (!text && imageBase64) {
      text = await extractTextFromBase64(imageBase64);
    }

    if (!text) {
      return res.status(400).json({ error: "content (string) or imageBase64 is required" });
    }

    await ensureUserDoc(uid, req.user.email, req.user.name);

    // 1. Retrieve RAG context from Firestore vector search
    const chunks = await retrieveChunks(uid, courseId, text);
    const ragContext = chunks.join("\n\n---\n\n");

    // 2. Call Gemini for explanation with RAG context
    const explanation = await explainConcept(text, ragContext, null);

    // 3. Classify the interaction for SMG
    const classifierTag = await classifyConcept(text, explanation.solution);

    // 4+5. Save interaction event and update SMG in parallel — independent Firestore paths
    const [eventId] = await Promise.all([
      saveInteraction(uid, {
        courseId,
        content: text,
        eventType: "explain",
        response: explanation,
        classifierTag,
        requestMeta: {
          path: req.originalUrl,
          method: req.method,
          ip: req.ip,
          userAgent: req.headers["user-agent"] || null,
        },
      }),
      recordInteraction(uid, classifierTag.conceptNode, {
        errorType: classifierTag.errorType,
        confidence: classifierTag.confidence,
        courseId,
      }),
    ]);
    cacheInvalidate(`graph:${uid}`);
    cacheInvalidate(`drill:${uid}`);

    addXP(uid, 5, 'explain').catch((err) => logger.warn({ err, uid }, 'addXP failed'));
    updateStreak(uid).catch((err) => logger.warn({ err, uid }, 'updateStreak failed'));

    res.json({
      question: text,
      solution: explanation.solution,
      mainConcept: explanation.mainConcept,
      relevantLecture: explanation.relevantLecture,
      keyFormulas: explanation.keyFormulas,
      personalizedCallout: explanation.personalizedCallout,
      classifierTag,
      eventId,
    });
  } catch (err) {
    next(err);
  }
});
