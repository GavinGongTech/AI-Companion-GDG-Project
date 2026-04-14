import { Router } from "express";
import { getGraph, getDrillQueue } from "../services/misconception.js";
import { requireFirebaseAuth } from "../middleware/auth.js";
import { db } from "../db/firebase.js";
import { cacheGet, cacheSet } from "../services/cache.js";

export const graphRouter = Router();

/**
 * GET /api/v1/graph — Return the full SMG for the authenticated user.
 */
graphRouter.get("/", requireFirebaseAuth, async (req, res, next) => {
  try {
    const uid = req.user.uid;
    const cacheKey = `graph:${uid}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const nodes = await getGraph(uid);

    if (nodes.length === 0) {
      return res.status(404).json({ error: "No SMG data yet — start studying!" });
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
graphRouter.get("/drill", requireFirebaseAuth, async (req, res, next) => {
  try {
    const uid = req.user.uid;
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
graphRouter.get("/course/:courseId", requireFirebaseAuth, async (req, res, next) => {
  try {
    const uid = req.user.uid;
    const { courseId } = req.params;

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
