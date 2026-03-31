import express from "express";
import cors from "cors";
import { env } from "./env.js";
import { apiRouter } from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "study-flow-api", env: env.nodeEnv });
});

app.use("/api/v1", apiRouter);

// Must be last — catches errors thrown in any route/middleware above
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`);
});
