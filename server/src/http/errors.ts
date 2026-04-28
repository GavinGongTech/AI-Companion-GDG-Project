export interface HttpError extends Error {
  status?: number;
  details?: any[];
}

export function httpError(status: number, message: string, details?: any[]): HttpError {
  const err = new Error(message) as HttpError;
  err.status = status;
  if (details) {
    err.details = details;
  }
  return err;
}
