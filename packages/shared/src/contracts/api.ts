import { z } from "zod";

export const classifierErrorTypes = [
  "conceptual_misunderstanding",
  "procedural_error",
  "knowledge_gap",
  "reasoning_error",
  "none",
] as const;

export const classifierTagSchema = z.object({
  conceptNode: z.string().trim().min(1).max(200),
  errorType: z.enum(classifierErrorTypes),
  confidence: z.number().min(0).max(1),
});

export const apiErrorSchema = z.object({
  error: z.string(),
  details: z.array(z.string()).optional(),
});

export const analyzeRequestSchema = z.object({
  content: z.string().trim().min(1).max(5000).optional(),
  courseId: z.string().trim().max(100).optional(),
  imageBase64: z.string().max(5_000_000).optional(),
}).refine((value) => value.content || value.imageBase64, {
  message: "content or imageBase64 is required",
});

export const explainRequestSchema = z.object({
  question: z.string().trim().min(1).max(5000),
  courseId: z.string().trim().max(100).optional(),
});

export const quizGenerateRequestSchema = z.object({
  topic: z.string().trim().max(200).optional(),
  courseId: z.string().trim().max(100).optional(),
  count: z.number().int().min(1).max(10).optional().default(1),
});

export const quizAnswerRequestSchema = z.object({
  conceptNode: z.string().trim().min(1).max(200),
  selectedAnswer: z.number().int().min(0).max(9),
  sessionId: z.string().uuid(),
  questionIndex: z.number().int().min(0).max(9),
  courseId: z.string().trim().max(100).optional(),
});

export const ingestTextRequestSchema = z.object({
  courseId: z.string().trim().min(1).max(100),
  rawContent: z.string().trim().min(1).max(500_000),
  sourcePlatform: z.string().trim().max(50).optional().default("brightspace"),
  filename: z.string().trim().max(200).optional(),
});

export const trackEventRequestSchema = z.object({
  eventType: z.string().trim().min(1).max(100),
  content: z.string().trim().max(5000).nullable().optional(),
  meta: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const timestampValueSchema = z.union([
  z.string(),
  z.number(),
  z.date(),
  z.object({
    _seconds: z.number(),
    _nanoseconds: z.number().optional(),
  }),
]);

export const explanationSchema = z.object({
  solution: z.string(),
  mainConcept: z.string().trim().min(1),
  relevantLecture: z.string(),
  keyFormulas: z.array(z.string()),
  personalizedCallout: z.string(),
});

export const analyzeResponseSchema = explanationSchema.extend({
  question: z.string(),
  classifierTag: classifierTagSchema,
  eventId: z.string().trim().min(1),
});

export const explainResponseSchema = explanationSchema.extend({
  question: z.string(),
});

export const quizQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).min(2),
  explanation: z.string(),
  difficulty: z.string(),
  conceptNode: z.string().trim().min(1),
});

export const quizGenerateResponseSchema = z.object({
  topic: z.string(),
  courseId: z.string().nullable(),
  sessionId: z.string().uuid(),
  questions: z.array(quizQuestionSchema),
});

export const quizAnswerResponseSchema = z.object({
  isCorrect: z.boolean(),
  correctAnswer: z.number().int().min(0).max(9),
  eventId: z.string().trim().min(1),
});

export const graphNodeSchema = z.object({
  conceptNode: z.string().trim().min(1),
  accuracyRate: z.number().min(0).max(1).optional(),
  interactionCount: z.number().int().min(0).optional(),
  nextReviewDate: timestampValueSchema.optional(),
  courseId: z.string().trim().max(100).optional(),
});

export const graphResponseSchema = z.object({
  nodes: z.array(graphNodeSchema),
});

export const drillQueueItemSchema = z.object({
  conceptNode: z.string().trim().min(1),
  accuracyRate: z.number().min(0).max(1).optional(),
  urgency: z.number(),
});

export const drillQueueResponseSchema = z.object({
  queue: z.array(drillQueueItemSchema),
});

export const eventSchema = z.object({
  eventId: z.string().trim().min(1),
  eventType: z.string().trim().min(1),
  content: z.string().nullable().optional(),
  meta: z.record(z.string(), z.unknown()).nullable().optional(),
  response: z.unknown().nullable().optional(),
  classifierTag: classifierTagSchema.nullable().optional(),
  createdAt: timestampValueSchema.optional(),
});

export const eventsResponseSchema = z.object({
  events: z.array(eventSchema),
  count: z.number().int().min(0),
});

export const courseSummarySchema = z.object({
  courseId: z.string().trim().min(1),
  courseName: z.string().optional(),
  platform: z.string().optional(),
  lastIngestedAt: timestampValueSchema.optional(),
});

export const coursesResponseSchema = z.object({
  courses: z.array(courseSummarySchema),
});

export const ingestedDocumentSchema = z.object({
  fileId: z.string().trim().min(1),
  filename: z.string().optional(),
  sourcePlatform: z.string().optional(),
  uploadedAt: timestampValueSchema.optional(),
});

export const courseDetailsResponseSchema = z.object({
  courseId: z.string().trim().min(1),
  platform: z.string().optional(),
  lastIngestedAt: timestampValueSchema.optional(),
  ingestedDocs: z.array(ingestedDocumentSchema),
  chunkCount: z.number().int().min(0),
});

export const ingestTextResponseSchema = z.object({
  ok: z.literal(true),
  courseId: z.string().trim().min(1),
  ingestedAt: z.string(),
});

export const ingestUploadResponseSchema = z.object({
  ok: z.literal(true),
  filename: z.string().trim().min(1),
  courseId: z.string().trim().min(1),
});

export const clientEventResponseSchema = z.object({
  ok: z.literal(true),
  eventId: z.string().trim().min(1),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;
export type AnalyzeResponse = z.infer<typeof analyzeResponseSchema>;
export type ClassifierTag = z.infer<typeof classifierTagSchema>;
export type ClientEventResponse = z.infer<typeof clientEventResponseSchema>;
export type CourseDetailsResponse = z.infer<typeof courseDetailsResponseSchema>;
export type CoursesResponse = z.infer<typeof coursesResponseSchema>;
export type DrillQueueResponse = z.infer<typeof drillQueueResponseSchema>;
export type EventRecord = z.infer<typeof eventSchema>;
export type EventsResponse = z.infer<typeof eventsResponseSchema>;
export type ExplainRequest = z.infer<typeof explainRequestSchema>;
export type ExplainResponse = z.infer<typeof explainResponseSchema>;
export type GraphNode = z.infer<typeof graphNodeSchema>;
export type GraphResponse = z.infer<typeof graphResponseSchema>;
export type IngestTextRequest = z.infer<typeof ingestTextRequestSchema>;
export type IngestTextResponse = z.infer<typeof ingestTextResponseSchema>;
export type IngestUploadResponse = z.infer<typeof ingestUploadResponseSchema>;
export type QuizAnswerRequest = z.infer<typeof quizAnswerRequestSchema>;
export type QuizAnswerResponse = z.infer<typeof quizAnswerResponseSchema>;
export type QuizGenerateRequest = z.infer<typeof quizGenerateRequestSchema>;
export const gamificationAchievementSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  unlocked: z.boolean(),
  unlockedAt: timestampValueSchema.nullable().optional(),
});

export const gamificationResponseSchema = z.object({
  xp: z.number().int().min(0),
  level: z.number().int().min(1),
  xpIntoLevel: z.number().int().min(0),
  nextLevelXP: z.number().int().min(1),
  streak: z.number().int().min(0),
  achievements: z.array(gamificationAchievementSchema),
});

export type QuizGenerateResponse = z.infer<typeof quizGenerateResponseSchema>;
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;
export type TrackEventRequest = z.infer<typeof trackEventRequestSchema>;
export type GamificationAchievement = z.infer<typeof gamificationAchievementSchema>;
export type GamificationResponse = z.infer<typeof gamificationResponseSchema>;
