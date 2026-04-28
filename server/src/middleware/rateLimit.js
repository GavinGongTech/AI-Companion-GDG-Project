import rateLimit from "express-rate-limit";

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  // apiLimiter runs before auth middleware, so req.user is always unset here.
  // The default keyGenerator automatically uses req.ip
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — please wait a moment and try again." },
});