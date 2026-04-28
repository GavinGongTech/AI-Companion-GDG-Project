export function httpError(status, message, details) {
  const err = new Error(message);
  err.status = status;
  if (details) {
    err.details = details;
  }
  return err;
}
