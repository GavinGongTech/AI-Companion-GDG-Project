import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
import { sendError } from "../http/responses";

/**
 * Express middleware factory for zod body validation.
 * Usage: router.post("/", validate(schema), handler)
 */
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const messages = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
      return sendError(res, 400, "Validation failed", messages);
    }
    req.body = result.data;
    next();
  };
}
