import { Router } from "express";
import { requireFirebaseAuth } from "../middleware/auth.js";
import { db } from "../db/firebase.js";

export const eventsRouter = Router();

/**
 * GET /api/v1/events — List recent interaction events for the authenticated user.
 * Query params: limit (default 50, max 100), offset (default 0).
 */
eventsRouter.get("/", requireFirebaseAuth, async (req, res, next) => {
  try {
    const uid = req.user.uid;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;

    const eventsRef = db.collection("users").doc(uid).collection("events");
    let query = eventsRef.orderBy("createdAt", "desc");

    if (offset > 0) {
      // Skip by fetching offset docs first
      const skipSnap = await eventsRef
        .orderBy("createdAt", "desc")
        .limit(offset)
        .get();
      if (!skipSnap.empty) {
        const lastDoc = skipSnap.docs[skipSnap.docs.length - 1];
        query = query.startAfter(lastDoc);
      }
    }

    const snap = await query.limit(limit).get();
    const events = snap.docs.map((doc) => ({
      eventId: doc.id,
      ...doc.data(),
    }));

    res.json({ events, count: events.length });
  } catch (err) {
    next(err);
  }
});
