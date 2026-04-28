import { Router } from "express";
import { explainRouter } from "./explain";
import { quizRouter } from "./quiz";
import { ingestRouter } from "./ingest";
import { analyzeRouter } from "./analyze";
import { graphRouter } from "./graph";
import { courseRouter } from "./course";
import { eventsRouter } from "./events";
import { streamRouter } from "./stream";
import { gamificationRouter } from "./gamification";

export const apiRouter = Router();

apiRouter.use("/analyze", analyzeRouter);
apiRouter.use("/explain", explainRouter);
apiRouter.use("/quiz", quizRouter);
apiRouter.use("/ingest", ingestRouter);
apiRouter.use("/graph", graphRouter);
apiRouter.use("/courses", courseRouter);
apiRouter.use("/events", eventsRouter);
apiRouter.use("/stream", streamRouter);
apiRouter.use("/gamification", gamificationRouter);
