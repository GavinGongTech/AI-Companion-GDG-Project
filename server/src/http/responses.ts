import { Response } from 'express';

export function buildErrorBody(message: string, details?: any[]) {
  const body: { error: string; details?: any[] } = { error: message };
  if (Array.isArray(details) && details.length > 0) {
    body.details = details;
  }
  return body;
}

export function sendError(res: Response, status: number, message: string, details?: any[]) {
  return res.status(status).json(buildErrorBody(message, details));
}
