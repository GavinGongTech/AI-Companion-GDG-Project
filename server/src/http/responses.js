export function buildErrorBody(message, details) {
  const body = { error: message };
  if (Array.isArray(details) && details.length > 0) {
    body.details = details;
  }
  return body;
}

export function sendError(res, status, message, details) {
  return res.status(status).json(buildErrorBody(message, details));
}
