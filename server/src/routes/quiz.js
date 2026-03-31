import { Router } from "express";

// TODO: replace stub with real quiz generation via services/gemini.js + services/rag.js

export const quizRouter = Router();

quizRouter.post("/", (req, res) => {
  const { topic = "general", courseId } = req.body ?? {};

  res.json({
    topic,
    courseId: courseId ?? null,
    question:
      "Static stub — connect Gemini quiz generation here. Preview shows the shape your extension expects.",
    options: [
      "Option A (placeholder)",
      "Option B (placeholder)",
      "Option C (placeholder)",
      "Option D (placeholder)",
    ],
    answer: 0,
    explanation:
      "Explanation will come from RAG-retrieved course chunks once wired.",
  });
});
