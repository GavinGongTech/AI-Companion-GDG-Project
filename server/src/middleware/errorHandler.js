/**
 * Global Express error handler. Must be registered as the last middleware in index.js.
 * Usage: app.use(errorHandler);
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status = err.status ?? err.statusCode ?? 500;
  const message = err.message ?? "Internal server error";

  if (status >= 500) {
    console.error("[error]", err);
  }

  res.status(status).json({ error: message });
}
