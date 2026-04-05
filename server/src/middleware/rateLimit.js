import rateLimit, { ipKeyGenerator } from "express-rate-limit";

/**
 * Rate limiter: 30 requests per minute per authenticated user (by uid).
 * Falls back to IP if no user is attached.
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.user?.uid || ipKeyGenerator(req),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — please wait a moment and try again." },
});
