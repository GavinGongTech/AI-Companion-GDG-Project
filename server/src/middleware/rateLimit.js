import rateLimit from "express-rate-limit";

/**
 * Rate limiter: 30 requests per minute per IP.
 * Applied before auth middleware, so uid is not yet available.
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — please wait a moment and try again." },
});
