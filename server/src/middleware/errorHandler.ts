import { Request, Response, NextFunction } from "express";
import { logger } from "../logger";
import { buildErrorBody } from "../http/responses";

/**
 * Global Express error handler. Must be registered as the last middleware in index.js.
 * Usage: app.use(errorHandler);
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  const status = err.status ?? err.statusCode ?? 500;
  const message = err.message ?? "Internal server error";

  if (status >= 500) {
    logger.error({ err, path: req.path, method: req.method }, "Unhandled error");
  }

  const clientMessage = status >= 500 ? "Internal server error" : message;
  const details = status >= 500 ? undefined : err.details;
  res.status(status).json(buildErrorBody(clientMessage, details));
}
