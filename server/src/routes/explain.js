import { Router } from "express";

export const explainRouter = Router();

explainRouter.post("/", (req, res) => {
  const question =
    typeof req.body?.question === "string" ? req.body.question : "";

  res.json({
    question: question || "—",
    solution:
      "Static stub: connect Gemini + pgvector RAG here. Preview shows structured fields your extension expects.",
    mainConcept:
      "Concept tagging will use your misconception classifier once wired.",
    relevantLecture:
      "Chunk #42 — Week 3 lecture notes (vector retrieval placeholder)",
  });
});
