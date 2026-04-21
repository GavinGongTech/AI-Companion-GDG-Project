import { logger } from '../logger.js'

/**
 * Global Express error handler. Must be registered as the last middleware in index.js.
 * Usage: app.use(errorHandler);
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status = err.status ?? err.statusCode ?? 500;
  const message = err.message ?? "Internal server error";

  if (status >= 500) {
    logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');
  }

  const clientMessage = status >= 500 ? "Internal server error" : message;
  res.status(status).json({ error: clientMessage });
}
