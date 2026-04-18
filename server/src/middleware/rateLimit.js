import rateLimit, { ipKeyGenerator } from "express-rate-limit";

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  // apiLimiter runs before auth middleware, so req.user is always unset here.
  // Key purely on IP; ipKeyGenerator normalizes IPv6 mapped addresses.
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ""),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — please wait a moment and try again." },
});
