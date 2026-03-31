import type {
  ExplainResponse,
  QuizStartResponse,
  QuizSubmitResponse,
} from "./types";

export function getApiBase(): string {
  return import.meta.env.VITE_API_URL ?? "http://localhost:3000";
}

export async function explain(body: {
  question: string;
}): Promise<ExplainResponse> {
  const res = await fetch(`${getApiBase()}/api/v1/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json() as Promise<ExplainResponse>;
}

export async function startQuiz(body: {
  lectureIds: string[];
}): Promise<QuizStartResponse> {
  const res = await fetch(`${getApiBase()}/api/v1/quiz/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json() as Promise<QuizStartResponse>;
}

export async function submitQuiz(body: {
  quizId: string;
  answers: { questionId: string; selectedOptionId: string }[];
}): Promise<QuizSubmitResponse> {
  const res = await fetch(`${getApiBase()}/api/v1/quiz/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json() as Promise<QuizSubmitResponse>;
}
