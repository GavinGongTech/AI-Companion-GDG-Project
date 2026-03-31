export type ExplainResponse = {
  question: string;
  solution: string;
  mainConcept: string;
  relevantLecture: string;
};

export type QuizOption = {
  id: string;
  label: string;
  text: string;
};

export type QuizQuestion = {
  id: string;
  prompt: string;
  options: QuizOption[];
};

export type QuizStartResponse = {
  quizId: string;
  lectureIds: string[];
  questions: QuizQuestion[];
};

export type QuizSubmitResponse = {
  scorePercent: number;
  pastPerformancePercent: number;
};
