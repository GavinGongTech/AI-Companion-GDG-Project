import express from "express";
import cors from "cors";
import { apiRouter } from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { db } from "./db/firebase.js";
import { env } from "./env.js";

export const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));

app.get("/health", async (_req, res) => {
  let firestoreOk = false;
  try {
    await db.collection("_health").limit(1).get();
    firestoreOk = true;
  } catch { /* Firestore unreachable */ }
  const status = firestoreOk ? 200 : 503;
  res.status(status).json({ ok: firestoreOk, service: "study-flow-api", env: env.nodeEnv, firestore: firestoreOk });
});

app.use("/api/v1", apiLimiter, apiRouter);

app.use(errorHandler);
