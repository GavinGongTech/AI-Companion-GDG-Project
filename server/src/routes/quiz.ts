import { Router } from "express";

export const quizRouter = Router();

const pastByUser = new Map<string, number>();

quizRouter.post("/start", (req, res) => {
  const lectureIds: string[] = Array.isArray(req.body?.lectureIds)
    ? req.body.lectureIds.filter((x: unknown) => typeof x === "string")
    : [];

  res.json({
    quizId: `quiz_${Date.now()}`,
    lectureIds: lectureIds.length ? lectureIds : ["lec1"],
    questions: [
      {
        id: "q1",
        prompt: "Q1 — Which of the following series converges? (stub)",
        options: [
          { id: "a", label: "A", text: "Σ 1/n" },
          { id: "b", label: "B", text: "Σ 1/n²" },
          { id: "c", label: "C", text: "Σ 1" },
          { id: "d", label: "D", text: "Σ n" },
        ],
      },
    ],
  });
});

quizRouter.post("/submit", (req, res) => {
  const quizId = typeof req.body?.quizId === "string" ? req.body.quizId : "";
  const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
  const userId =
    typeof req.body?.userId === "string" ? req.body.userId : "anonymous";

  const first = answers[0] as { selectedOptionId?: string } | undefined;
  const correct = first?.selectedOptionId === "b";
  const scorePercent = correct ? 100 : 0;

  const prev = pastByUser.get(userId) ?? 70;
  const blended = Math.round(prev * 0.7 + scorePercent * 0.3);
  pastByUser.set(userId, blended);

  res.json({
    quizId: quizId || "unknown",
    scorePercent,
    pastPerformancePercent: prev,
    message: "Stub grader — replace with persisted attempts + misconception updates.",
  });
});
