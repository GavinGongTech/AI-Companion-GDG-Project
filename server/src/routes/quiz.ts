import { Router, type Request, type Response, type NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";
import { generateQuiz } from "../services/gemini";
import { retrieveChunks } from "../services/rag";
import { getWeakestConcepts, recordInteraction, getDrillQueue } from "../services/misconception";
import { saveInteraction } from "../services/firestore";
import { requireFirebaseAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { quizGenerateSchema, quizAnswerSchema } from "../schemas";
import { cacheInvalidate } from "../services/cache";
import { addXP, updateStreak } from "../services/gamification";
import { logger } from "../logger";

const db = getFirestore();

export const quizRouter = Router();

function shuffleQuestion(question: any) {
  const { options, answer, ...rest } = question;
  // Fisher-Yates shuffle
  const indices = options.map((_: any, i: number) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return {
    ...rest,
    options: indices.map((i: number) => options[i]),
    answer: indices.indexOf(answer),
  };
}

/**
 * POST /api/v1/quiz — Generate quiz questions.
 * If no topic is given, picks from the student's weakest SMG concepts.
 */
quizRouter.post("/", requireFirebaseAuth, validate(quizGenerateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = req.user!.uid;
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
    const context = `Topic: ${targetTopic}\n\nCourse Materials:\n${chunks.join("\n---\n")}`;

    const result = await generateQuiz(context, count);

    const qs = result.questions ?? [];
    const shuffledQs = qs.map(shuffleQuestion);
    const sessionId = randomUUID();

    await Promise.all([
      db.collection("users").doc(uid).collection("quizSessions").doc(sessionId).set({
        questions: shuffledQs.map((q: any) => ({ conceptNode: q.conceptNode || targetTopic, answer: q.answer })),
        expiresAt: Date.now() + 30 * 60 * 1000,
      }).catch((err) => logger.warn({ err }, "Failed to persist quiz session — grading will be unavailable")),
      saveInteraction(uid, {
        courseId,
        content: targetTopic,
        eventType: "quiz_generated",
        response: { topic: targetTopic, questionCount: result.questions?.length ?? 0 },
        classifierTag: { conceptNode: targetTopic, errorType: "none", confidence: 1 },
      }),
    ]);

    // Fire-and-forget: delete expired sessions to prevent unbounded collection growth.
    // Permanent alternative: enable Firestore TTL policy on quizSessions.expiresAt in Cloud Console.
    Promise.resolve()
      .then(() =>
        db.collection("users").doc(uid).collection("quizSessions")
          .where("expiresAt", "<", Date.now())
          .limit(50)
          .get()
      )
      .then((snap) => Promise.all(snap.docs.map((d) => d.ref.delete())))
      .catch((err) => logger.warn({ err, uid }, 'quiz session cleanup failed'));

    // Strip answer from each question before sending to client — grading is server-side only
    const safeQs = shuffledQs.map(({ answer: _a, ...q }: any) => q);
    res.json({
      topic: targetTopic,
      courseId: courseId ?? undefined,
      sessionId,
      questions: safeQs,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/quiz/answer — Submit a quiz answer and update SMG.
 */
quizRouter.post("/answer", requireFirebaseAuth, validate(quizAnswerSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = req.user!.uid;
    const { conceptNode, selectedAnswer, sessionId, questionIndex, courseId } = req.body;

    // Look up the server-stored session so grading cannot be spoofed by the client
    const sessionSnap = await db
      .collection("users").doc(uid)
      .collection("quizSessions").doc(sessionId)
      .get();

    const sessionData = sessionSnap.data();
    if (!sessionSnap.exists || !sessionData || sessionData.expiresAt < Date.now()) {
      return res.status(400).json({ error: "Quiz session expired. Please start a new quiz." });
    }

    const storedQuestion = sessionData.questions?.[questionIndex];
    if (!storedQuestion || (storedQuestion.conceptNode && storedQuestion.conceptNode !== conceptNode)) {
      return res.status(400).json({ error: "Invalid question reference." });
    }

    const isCorrect = selectedAnswer === storedQuestion.answer;

    // Record the interaction and update SMG, then invalidate cached graph/drill views
    await recordInteraction(uid, conceptNode, {
      errorType: isCorrect ? "none" : "knowledge_gap",
      confidence: 1,
      courseId,
      isCorrect,
    });
    cacheInvalidate(`graph:${uid}`);
    cacheInvalidate(`drill:${uid}`);

    // Save answer event
    const eventId = await saveInteraction(uid, {
      courseId,
      content: conceptNode,
      eventType: "quiz_answer",
      response: { selectedAnswer, correctAnswer: storedQuestion.answer, isCorrect },
      classifierTag: {
        conceptNode,
        errorType: isCorrect ? "none" : "knowledge_gap",
        confidence: 1,
      },
    });

    if (isCorrect) {
      addXP(uid, 10, 'quiz_correct').catch((err) => logger.warn({ err, uid }, 'addXP failed'))
    }
    updateStreak(uid).catch((err) => logger.warn({ err, uid }, 'updateStreak failed'))

    res.json({ isCorrect, correctAnswer: storedQuestion.answer, eventId });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/quiz/queue — Get the spaced repetition drill queue.
 */
quizRouter.get("/queue", requireFirebaseAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = req.user!.uid;
    const queue = await getDrillQueue(uid);
    res.json({ queue });
  } catch (err) {
    next(err);
  }
});
