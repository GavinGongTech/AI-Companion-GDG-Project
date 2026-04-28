import { sendError } from "../http/responses.js";

/**
 * Express middleware factory for zod body validation.
 * Usage: router.post("/", validate(schema), handler)
 */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const messages = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
      return sendError(res, 400, "Validation failed", messages);
    }
    req.body = result.data;
    next();
  };
}
