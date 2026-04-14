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

//this is API endpoint that runs analyze flow
export const analyzeRouter = Router();

const ALLOWED_ERROR_TYPES = new Set([
  "conceptual_misunderstanding",
  "procedural_error",
  "knowledge_gap",
  "reasoning_error",
  "none",
]);

function toSnakeCase(input) {
  return String(input ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeClassifierTag(classifierTag, fallbackConcept) {
  const fallback = toSnakeCase(fallbackConcept) || "general_concept";
  const conceptNode = toSnakeCase(classifierTag?.conceptNode) || fallback;
  const errorType = ALLOWED_ERROR_TYPES.has(classifierTag?.errorType)
    ? classifierTag.errorType
    : "knowledge_gap";
  const rawConfidence = Number(classifierTag?.confidence);
  const confidence = Number.isFinite(rawConfidence)
    ? Math.min(1, Math.max(0, rawConfidence))
    : 0.5;

  return { conceptNode, errorType, confidence };
}

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

    // 2. Check if we have prior SMG data for concept-aware response
    let smgHistory = null;
    // We don't know the concept node yet, so we'll skip SMG history for the initial call
    // and use it on subsequent calls once the concept is classified

    // 3. Call Gemini for explanation with RAG context
    const explanation = await explainConcept(text, ragContext, smgHistory);

    // 4. Classify the interaction for SMG
    const rawClassifierTag = await classifyConcept(text, explanation.solution);
    const classifierTag = normalizeClassifierTag(rawClassifierTag, explanation.mainConcept);

    // 5. Save event to Firestore
    const eventId = await saveInteraction(uid, {
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
    });

    // 6. Update SMG via SM-2 scheduling, then invalidate cached graph/drill views
    await recordInteraction(uid, classifierTag.conceptNode, {
      errorType: classifierTag.errorType,
      confidence: classifierTag.confidence,
      courseId,
    });
    cacheInvalidate(`graph:${uid}`);
    cacheInvalidate(`drill:${uid}`);

    // 7. Return structured response
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
