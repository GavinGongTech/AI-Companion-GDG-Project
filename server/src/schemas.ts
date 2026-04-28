import { 
  analyzeRequestSchema, 
  explainRequestSchema, 
  quizGenerateRequestSchema, 
  quizAnswerRequestSchema, 
  ingestTextRequestSchema 
} from "@study-flow/shared";

export const analyzeSchema = analyzeRequestSchema;
export const explainSchema = explainRequestSchema;
export const quizGenerateSchema = quizGenerateRequestSchema;
export const quizAnswerSchema = quizAnswerRequestSchema;
export const ingestTextSchema = ingestTextRequestSchema;

export const contractSources = {
  api: "package",
  env: "package",
};
