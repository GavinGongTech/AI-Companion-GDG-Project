import { Router, type Request, type Response, type NextFunction } from "express";
import { explainConcept, classifyConcept } from "../services/gemini";
import { retrieveChunks } from "../services/rag";
import { recordInteraction } from "../services/misconception";
import { saveInteraction, ensureUserDoc } from "../services/firestore";
import { extractTextFromBase64 } from "../services/ocr";
import { requireFirebaseAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { analyzeSchema } from "../schemas";
import { cacheInvalidate } from "../services/cache";
import { addXP, updateStreak } from "../services/gamification";
import { logger } from "../logger";
import { shouldUseCourseRag } from "../services/ragPolicy";

export const analyzeRouter = Router();

const ALLOWED_ERROR_TYPES = new Set([
  "conceptual_misunderstanding",
  "procedural_error",
  "knowledge_gap",
  "reasoning_error",
  "none",
]);

function toSnakeCase(input: any): string {
  return String(input ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeClassifierTag(classifierTag: any, fallbackConcept: string) {
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

analyzeRouter.post("/", requireFirebaseAuth, validate(analyzeSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = req.user!.uid;
    const { courseId, content, imageBase64 } = req.body ?? {};

    // Accept text content or base64 image (OCR it first)
    let text = typeof content === "string" ? content.trim() : "";
    if (!text && imageBase64) {
      text = await extractTextFromBase64(imageBase64);
    }

    if (!text) {
      return res.status(400).json({ error: "content (string) or imageBase64 is required" });
    }

    await ensureUserDoc(uid, req.user!.email || "", req.user!.name || "");

    // 1. Retrieve RAG context from Firestore vector search (only when it makes sense).
    const ragContext = shouldUseCourseRag(text) && courseId
      ? (await retrieveChunks(uid, courseId, text)).join("\n\n---\n\n")
      : "";

    // 2. Call Gemini for explanation with RAG context
    const explanation = await explainConcept(text, ragContext, null as any);

    // 3. Classify the interaction for SMG
    const rawClassifierTag = await classifyConcept(text, explanation.solution);
    const classifierTag = normalizeClassifierTag(rawClassifierTag, explanation.mainConcept);

    // 4+5. Save interaction event and update SMG in parallel
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
          ip: req.ip || "",
          userAgent: req.headers["user-agent"] || undefined,
        },
      }),
      recordInteraction(uid, classifierTag.conceptNode, {
        errorType: classifierTag.errorType,
        confidence: classifierTag.confidence,
        courseId,
        isCorrect: classifierTag.errorType === "none",
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
