import { Router } from "express";
import { explainRouter } from "./explain.js";
import { quizRouter } from "./quiz.js";
import { authRouter } from "./auth.js";
import { ingestRouter } from "./ingest.js";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/explain", explainRouter);
apiRouter.use("/quiz", quizRouter);
apiRouter.use("/ingest", ingestRouter);
