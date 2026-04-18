import rateLimit, { ipKeyGenerator } from "express-rate-limit";

/**
 * Rate limiter: 30 requests per minute per IP.
 * Applied before auth middleware, so uid is not yet available.
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
<<<<<<< Updated upstream
  max: 30,
  // Prefer user-based limiting when authenticated; otherwise fall back to IP.
  // (We avoid relying on express-rate-limit internal exports for compatibility.)
  keyGenerator: (req) => req.user?.uid || req.ip,
=======
  limit: 30,
  // Prefer user-based limiting when authenticated; otherwise normalize IP for IPv6 safety.
  keyGenerator: (req) => req.user?.uid || ipKeyGenerator(req.ip ?? ""),
>>>>>>> Stashed changes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — please wait a moment and try again." },
});
