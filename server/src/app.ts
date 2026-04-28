import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { apiRouter } from "./routes/index";
import { errorHandler } from "./middleware/errorHandler";
import { apiLimiter } from "./middleware/rateLimit";
import { db } from "./db/firebase";
import { env } from "./env";
import { logger } from "./logger";

export const app = express();

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

app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (env.nodeEnv === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

app.use(express.json({ limit: "1mb" }));

app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info(
      { method: req.method, url: req.url, status: res.statusCode, ms: Date.now() - start },
      'http'
    );
  });
  next();
});

app.get("/health", async (_req: Request, res: Response) => {
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
