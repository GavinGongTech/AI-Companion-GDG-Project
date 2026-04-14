import express from "express";
import cors from "cors";
import { apiRouter } from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { db } from "./db/firebase.js";
import { env } from "./env.js";

export const app = express();

// In production, restrict CORS to explicit origins via ALLOWED_ORIGINS env var.
// In development, allow all origins for local testing.
const allowedOrigins = env.allowedOrigins
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const corsOrigin = allowedOrigins.length > 0
  ? allowedOrigins
  : env.nodeEnv === "production"
    ? false
    : true;

app.use(
  cors({
    origin: corsOrigin,
    credentials: corsOrigin !== false,
  }),
);

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (env.nodeEnv === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

app.use(express.json({ limit: "1mb" }));

app.get("/health", async (_req, res) => {
  let firestoreOk = false;
  try {
    await db.collection("_health").limit(1).get();
    firestoreOk = true;
  } catch { /* Firestore unreachable */ }
  const status = firestoreOk ? 200 : 503;
  if (env.nodeEnv === "production") {
    return res.status(status).json({ ok: firestoreOk, service: "study-flow-api" });
  }
  return res.status(status).json({
    ok: firestoreOk,
    service: "study-flow-api",
    env: env.nodeEnv,
    firestore: firestoreOk,
  });
});

app.use("/api/v1", apiLimiter, apiRouter);

app.use(errorHandler);
