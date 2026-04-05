import { Router } from "express";
import { explainRouter } from "./explain.js";
import { quizRouter } from "./quiz.js";
import { ingestRouter } from "./ingest.js";
import { analyzeRouter } from "./analyze.js";
import { graphRouter } from "./graph.js";
import { courseRouter } from "./course.js";
import { eventsRouter } from "./events.js";

export const apiRouter = Router();

apiRouter.use("/analyze", analyzeRouter);
apiRouter.use("/explain", explainRouter);
apiRouter.use("/quiz", quizRouter);
apiRouter.use("/ingest", ingestRouter);
apiRouter.use("/graph", graphRouter);
apiRouter.use("/courses", courseRouter);
apiRouter.use("/events", eventsRouter);
