import { Router } from "express";
import { generateQuiz } from "../services/gemini.js";
import { retrieveChunks } from "../services/rag.js";
import { getWeakestConcepts, recordInteraction, getDrillQueue } from "../services/misconception.js";
import { saveInteraction } from "../services/firestore.js";
import { requireFirebaseAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { quizGenerateSchema, quizAnswerSchema } from "../schemas.js";
import { cacheInvalidate } from "../services/cache.js";

export const quizRouter = Router();

/**
 * POST /api/v1/quiz — Generate quiz questions.
 * If no topic is given, picks from the student's weakest SMG concepts.
 */
quizRouter.post("/", requireFirebaseAuth, validate(quizGenerateSchema), async (req, res, next) => {
  try {
    const uid = req.user.uid;
    const { topic, courseId, count } = req.body;

    let targetTopic = topic;
    let smgData = null;

    // If no topic specified, pick from the student's weakest concepts
    if (!targetTopic) {
      const weakest = await getWeakestConcepts(uid, 5);
      if (weakest.length > 0) {
        // Pick a random concept from the weakest for variety
        const pick = weakest[Math.floor(Math.random() * weakest.length)];
        targetTopic = pick.conceptNode;
        smgData = pick;
      } else {
        targetTopic = "general";
      }
    }

    // Retrieve course material chunks for context
    const chunks = await retrieveChunks(uid, courseId, targetTopic);

    const result = await generateQuiz(targetTopic, chunks, smgData, count);

    // Save quiz generation as an event
    await saveInteraction(uid, {
      courseId,
      content: targetTopic,
      eventType: "quiz_generated",
      response: count === 1 ? result : result,
      classifierTag: { conceptNode: targetTopic, errorType: "none", confidence: 1 },
    });

    res.json({
      topic: targetTopic,
      courseId: courseId ?? null,
      ...(count === 1 ? result : result),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/quiz/answer — Submit a quiz answer and update SMG.
 */
quizRouter.post("/answer", requireFirebaseAuth, validate(quizAnswerSchema), async (req, res, next) => {
  try {
    const uid = req.user.uid;
    const { conceptNode, selectedAnswer, correctAnswer, courseId } = req.body;

    const isCorrect = selectedAnswer === correctAnswer;

    // Record the interaction and update SMG — invalidate cached graph
    cacheInvalidate(`graph:${uid}`);
    cacheInvalidate(`drill:${uid}`);
    await recordInteraction(uid, conceptNode, {
      errorType: isCorrect ? "none" : "knowledge_gap",
      confidence: 1,
      courseId,
      isCorrect,
    });

    // Save answer event
    const eventId = await saveInteraction(uid, {
      courseId,
      content: conceptNode,
      eventType: "quiz_answer",
      response: { selectedAnswer, correctAnswer, isCorrect },
      classifierTag: {
        conceptNode,
        errorType: isCorrect ? "none" : "knowledge_gap",
        confidence: 1,
      },
    });

    res.json({ isCorrect, eventId });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/quiz/queue — Get the spaced repetition drill queue.
 */
quizRouter.get("/queue", requireFirebaseAuth, async (req, res, next) => {
  try {
    const uid = req.user.uid;
    const queue = await getDrillQueue(uid);
    res.json({ queue });
  } catch (err) {
    next(err);
  }
});
