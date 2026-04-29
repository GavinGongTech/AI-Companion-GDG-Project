import { Router, type Request, type Response, type NextFunction } from "express";
import { explainConcept } from "../services/gemini";
import { retrieveChunks } from "../services/rag";
import { requireFirebaseAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { explainSchema } from "../schemas";

export const explainRouter = Router();

/**
 * POST /api/v1/explain — Explain a concept (lightweight, no SMG update).
 * For full analyze + classify + SMG flow, use POST /api/v1/analyze instead.
 */
explainRouter.post("/", requireFirebaseAuth, validate(explainSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = req.user!.uid;
    const { question, courseId } = req.body;

    // Retrieve RAG context
    const chunks = await retrieveChunks(uid, courseId, question);
    const context = chunks.join("\n\n---\n\n");

    const result = await explainConcept(question, context);

    res.json({
      question,
      solution: result.solution,
      mainConcept: result.mainConcept,
      relevantLecture: result.relevantLecture,
      keyFormulas: result.keyFormulas,
      personalizedCallout: result.personalizedCallout,
    });
  } catch (err) {
    next(err);
  }
});
