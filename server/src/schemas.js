import { z } from "zod";

export const analyzeSchema = z.object({
  content: z.string().trim().min(1).max(5000).optional(),
  courseId: z.string().trim().max(100).optional(),
  imageBase64: z.string().max(5_000_000).optional(),
}).refine((d) => d.content || d.imageBase64, {
  message: "content or imageBase64 is required",
});

export const explainSchema = z.object({
  question: z.string().trim().min(1).max(5000),
  courseId: z.string().trim().max(100).optional(),
});

export const quizGenerateSchema = z.object({
  topic: z.string().trim().max(200).optional(),
  courseId: z.string().trim().max(100).optional(),
  count: z.number().int().min(1).max(10).optional().default(1),
});

export const quizAnswerSchema = z.object({
  conceptNode: z.string().trim().min(1).max(200),
  selectedAnswer: z.number().int().min(0).max(9),
  correctAnswer: z.number().int().min(0).max(9),
  courseId: z.string().trim().max(100).optional(),
});

export const ingestTextSchema = z.object({
  courseId: z.string().trim().min(1).max(100),
  rawContent: z.string().trim().min(1).max(500_000),
  sourcePlatform: z.string().trim().max(50).optional().default("brightspace"),
  filename: z.string().trim().max(200).optional(),
});
