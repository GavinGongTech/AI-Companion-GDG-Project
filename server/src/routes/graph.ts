import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { getGraph, getDrillQueue } from "../services/misconception";
import { requireFirebaseAuth } from "../middleware/auth";
import { db } from "../db/firebase";
import { cacheGet, cacheSet } from "../services/cache";

export const graphRouter = Router();

/**
 * GET /api/v1/graph — Return the full SMG for the authenticated user.
 */
graphRouter.get("/", requireFirebaseAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = req.user!.uid;
    const cacheKey = `graph:${uid}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const nodes = await getGraph(uid);

    if (nodes.length === 0) {
      return res.json({ nodes: [] });
    }

    const body = { nodes };
    cacheSet(cacheKey, body, 60_000); // 1 min — graph changes after interactions
    res.json(body);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/graph/drill — Return the spaced repetition drill queue.
 */
graphRouter.get("/drill", requireFirebaseAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = req.user!.uid;
    const cacheKey = `drill:${uid}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const queue = await getDrillQueue(uid);
    const body = { queue };
    cacheSet(cacheKey, body, 60_000);
    res.json(body);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/graph/course/:courseId — Return SMG filtered by course.
 */
graphRouter.get("/course/:courseId", requireFirebaseAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = req.user!.uid;

    const courseIdParse = z.string().trim().min(1).max(100).safeParse(req.params.courseId);
    if (!courseIdParse.success) {
      return res.status(400).json({ error: "Invalid courseId parameter" });
    }
    const courseId = courseIdParse.data;

    const snap = await db.collection("users").doc(uid)
      .collection("smg")
      .where("courseId", "==", courseId)
      .get();

    const nodes = snap.docs.map((doc) => ({ conceptNode: doc.id, ...doc.data() }));
    res.json({ nodes });
  } catch (err) {
    next(err);
  }
});
