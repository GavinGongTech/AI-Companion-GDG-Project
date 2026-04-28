import { z } from "zod";

const SHARED_PACKAGE_SPECIFIER = "@study-flow/shared";
const WORKSPACE_API_SPECIFIER = "../../../packages/shared/src/contracts/api.ts";
const WORKSPACE_ENV_SPECIFIER = "../../../packages/shared/src/env/server.ts";

function shouldFallbackImport(error) {
  return [
    "ERR_MODULE_NOT_FOUND",
    "ERR_PACKAGE_PATH_NOT_EXPORTED",
    "ERR_UNKNOWN_FILE_EXTENSION",
  ].includes(error?.code);
}

async function importFirstAvailable(specifiers) {
  let lastError = null;

  for (const specifier of specifiers) {
    try {
      return { module: await import(specifier), source: specifier };
    } catch (error) {
      lastError = error;
      if (!shouldFallbackImport(error)) {
        throw error;
      }
    }
  }

  return { module: null, source: null, error: lastError };
}

const sharedApiImport = await importFirstAvailable([
  SHARED_PACKAGE_SPECIFIER,
  WORKSPACE_API_SPECIFIER,
]);

const sharedEnvImport = sharedApiImport.module?.parseServerEnvironment
  ? sharedApiImport
  : await importFirstAvailable([
    SHARED_PACKAGE_SPECIFIER,
    WORKSPACE_ENV_SPECIFIER,
  ]);

const sharedApi = sharedApiImport.module ?? {};
const sharedEnv = sharedEnvImport.module ?? {};

const localClassifierErrorTypes = [
  "conceptual_misunderstanding",
  "procedural_error",
  "knowledge_gap",
  "reasoning_error",
  "none",
];

const localClassifierTagSchema = z.object({
  conceptNode: z.string().trim().min(1).max(200),
  errorType: z.enum(localClassifierErrorTypes),
  confidence: z.number().min(0).max(1),
});

const localApiErrorSchema = z.object({
  error: z.string(),
  details: z.array(z.string()).optional(),
});

const localAnalyzeRequestSchema = z.object({
  content: z.string().trim().min(1).max(5000).optional(),
  courseId: z.string().trim().max(100).optional(),
  imageBase64: z.string().max(5_000_000).optional(),
}).refine((value) => value.content || value.imageBase64, {
  message: "content or imageBase64 is required",
});

const localExplainRequestSchema = z.object({
  question: z.string().trim().min(1).max(5000),
  courseId: z.string().trim().max(100).optional(),
});

const localQuizGenerateRequestSchema = z.object({
  topic: z.string().trim().max(200).optional(),
  courseId: z.string().trim().max(100).optional(),
  count: z.number().int().min(1).max(10).optional().default(1),
});

const localQuizAnswerRequestSchema = z.object({
  conceptNode: z.string().trim().min(1).max(200),
  selectedAnswer: z.number().int().min(0).max(9),
  sessionId: z.string().uuid(),
  questionIndex: z.number().int().min(0).max(9),
  courseId: z.string().trim().max(100).optional(),
});

const localIngestTextRequestSchema = z.object({
  courseId: z.string().trim().min(1).max(100),
  rawContent: z.string().trim().min(1).max(500_000),
  sourcePlatform: z.string().trim().max(50).optional().default("brightspace"),
  filename: z.string().trim().max(200).optional(),
});

const localTrackEventRequestSchema = z.object({
  eventType: z.string().trim().min(1).max(100),
  content: z.string().trim().max(5000).nullable().optional(),
  meta: z.record(z.string(), z.unknown()).nullable().optional(),
});

const localTimestampValueSchema = z.union([
  z.string(),
  z.number(),
  z.date(),
  z.object({
    _seconds: z.number(),
    _nanoseconds: z.number().optional(),
  }),
]);

const localExplanationSchema = z.object({
  solution: z.string(),
  mainConcept: z.string().trim().min(1),
  relevantLecture: z.string(),
  keyFormulas: z.array(z.string()),
  personalizedCallout: z.string(),
});

const localAnalyzeResponseSchema = localExplanationSchema.extend({
  question: z.string(),
  classifierTag: localClassifierTagSchema,
  eventId: z.string().trim().min(1),
});

const localExplainResponseSchema = localExplanationSchema.extend({
  question: z.string(),
});

const localQuizQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).min(2),
  explanation: z.string(),
  difficulty: z.string(),
  conceptNode: z.string().trim().min(1),
});

const localQuizGenerateResponseSchema = z.object({
  topic: z.string(),
  courseId: z.string().nullable(),
  sessionId: z.string().uuid(),
  questions: z.array(localQuizQuestionSchema),
});

const localQuizAnswerResponseSchema = z.object({
  isCorrect: z.boolean(),
  correctAnswer: z.number().int().min(0).max(9),
  eventId: z.string().trim().min(1),
});

const localGraphNodeSchema = z.object({
  conceptNode: z.string().trim().min(1),
  accuracyRate: z.number().min(0).max(1).optional(),
  interactionCount: z.number().int().min(0).optional(),
  nextReviewDate: localTimestampValueSchema.optional(),
  courseId: z.string().trim().max(100).optional(),
});

const localGraphResponseSchema = z.object({
  nodes: z.array(localGraphNodeSchema),
});

const localDrillQueueItemSchema = z.object({
  conceptNode: z.string().trim().min(1),
  accuracyRate: z.number().min(0).max(1).optional(),
  urgency: z.number(),
});

const localDrillQueueResponseSchema = z.object({
  queue: z.array(localDrillQueueItemSchema),
});

const localEventSchema = z.object({
  eventId: z.string().trim().min(1),
  eventType: z.string().trim().min(1),
  content: z.string().nullable().optional(),
  meta: z.record(z.string(), z.unknown()).nullable().optional(),
  response: z.unknown().nullable().optional(),
  classifierTag: localClassifierTagSchema.nullable().optional(),
  createdAt: localTimestampValueSchema.optional(),
});

const localEventsResponseSchema = z.object({
  events: z.array(localEventSchema),
  count: z.number().int().min(0),
});

const localCourseSummarySchema = z.object({
  courseId: z.string().trim().min(1),
  courseName: z.string().optional(),
  platform: z.string().optional(),
  lastIngestedAt: localTimestampValueSchema.optional(),
});

const localCoursesResponseSchema = z.object({
  courses: z.array(localCourseSummarySchema),
});

const localIngestedDocumentSchema = z.object({
  fileId: z.string().trim().min(1),
  filename: z.string().optional(),
  sourcePlatform: z.string().optional(),
  uploadedAt: localTimestampValueSchema.optional(),
});

const localCourseDetailsResponseSchema = z.object({
  courseId: z.string().trim().min(1),
  platform: z.string().optional(),
  lastIngestedAt: localTimestampValueSchema.optional(),
  ingestedDocs: z.array(localIngestedDocumentSchema),
  chunkCount: z.number().int().min(0),
});

const localIngestTextResponseSchema = z.object({
  ok: z.literal(true),
  courseId: z.string().trim().min(1),
  ingestedAt: z.string(),
});

const localIngestUploadResponseSchema = z.object({
  ok: z.literal(true),
  filename: z.string().trim().min(1),
  courseId: z.string().trim().min(1),
});

const localClientEventResponseSchema = z.object({
  ok: z.literal(true),
  eventId: z.string().trim().min(1),
});

const localServerEnvironmentSchema = z.object({
  PORT: z.coerce.number().int().positive().optional().default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).optional().default("development"),
  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_MODEL: z.string().optional().default("gemini-3.1-pro-preview"),
  GEMINI_FAST_MODEL: z.string().optional().default("gemini-3-flash-preview"),  FIREBASE_PROJECT_ID: z.string().optional().default(""),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional().default(""),
  ALLOWED_ORIGINS: z.string().optional().default(""),
});

const localGamificationAchievementSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  unlocked: z.boolean(),
  unlockedAt: localTimestampValueSchema.nullable().optional(),
});

const localGamificationResponseSchema = z.object({
  xp: z.number().int().min(0),
  level: z.number().int().min(1),
  xpIntoLevel: z.number().int().min(0),
  nextLevelXP: z.number().int().min(1),
  streak: z.number().int().min(0),
  achievements: z.array(localGamificationAchievementSchema),
});

export function parseServerEnvironment(environment) {
  if (typeof sharedEnv.parseServerEnvironment === "function") {
    return sharedEnv.parseServerEnvironment(environment);
  }

  return localServerEnvironmentSchema.parse(environment);
}

export const classifierErrorTypes = sharedApi.classifierErrorTypes ?? localClassifierErrorTypes;
export const classifierTagSchema = sharedApi.classifierTagSchema ?? localClassifierTagSchema;
export const apiErrorSchema = sharedApi.apiErrorSchema ?? localApiErrorSchema;

export const analyzeRequestSchema = sharedApi.analyzeRequestSchema ?? localAnalyzeRequestSchema;
export const explainRequestSchema = sharedApi.explainRequestSchema ?? localExplainRequestSchema;
export const quizGenerateRequestSchema = sharedApi.quizGenerateRequestSchema ?? localQuizGenerateRequestSchema;
export const quizAnswerRequestSchema = sharedApi.quizAnswerRequestSchema ?? localQuizAnswerRequestSchema;
export const ingestTextRequestSchema = sharedApi.ingestTextRequestSchema ?? localIngestTextRequestSchema;
export const trackEventRequestSchema = sharedApi.trackEventRequestSchema ?? localTrackEventRequestSchema;

export const analyzeResponseSchema = sharedApi.analyzeResponseSchema ?? localAnalyzeResponseSchema;
export const explainResponseSchema = sharedApi.explainResponseSchema ?? localExplainResponseSchema;
export const quizGenerateResponseSchema = sharedApi.quizGenerateResponseSchema ?? localQuizGenerateResponseSchema;
export const quizAnswerResponseSchema = sharedApi.quizAnswerResponseSchema ?? localQuizAnswerResponseSchema;
export const graphResponseSchema = sharedApi.graphResponseSchema ?? localGraphResponseSchema;
export const drillQueueResponseSchema = sharedApi.drillQueueResponseSchema ?? localDrillQueueResponseSchema;
export const eventsResponseSchema = sharedApi.eventsResponseSchema ?? localEventsResponseSchema;
export const coursesResponseSchema = sharedApi.coursesResponseSchema ?? localCoursesResponseSchema;
export const courseDetailsResponseSchema = sharedApi.courseDetailsResponseSchema ?? localCourseDetailsResponseSchema;
export const ingestTextResponseSchema = sharedApi.ingestTextResponseSchema ?? localIngestTextResponseSchema;
export const ingestUploadResponseSchema = sharedApi.ingestUploadResponseSchema ?? localIngestUploadResponseSchema;
export const clientEventResponseSchema = sharedApi.clientEventResponseSchema ?? localClientEventResponseSchema;
export const gamificationAchievementSchema = sharedApi.gamificationAchievementSchema ?? localGamificationAchievementSchema;
export const gamificationResponseSchema = sharedApi.gamificationResponseSchema ?? localGamificationResponseSchema;

export const contractSources = {
  api: sharedApiImport.source
    ? sharedApiImport.source === SHARED_PACKAGE_SPECIFIER ? "package" : "workspace"
    : "local",
  env: sharedEnvImport.source
    ? sharedEnvImport.source === SHARED_PACKAGE_SPECIFIER ? "package" : "workspace"
    : "local",
};

export function parseWithSchema(schema, payload) {
  return schema.parse(payload);
}
