import { Router } from "express";
import { explainRouter } from "./explain.js";
import { quizRouter } from "./quiz.js";

export const apiRouter = Router();

apiRouter.use("/explain", explainRouter);
apiRouter.use("/quiz", quizRouter);
