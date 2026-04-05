/**
 * Express middleware factory for zod body validation.
 * Usage: router.post("/", validate(schema), handler)
 */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const messages = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
      return res.status(400).json({ error: "Validation failed", details: messages });
    }
    req.body = result.data;
    next();
  };
}
