import { Router, type Request, type Response, type NextFunction } from "express";
import { requireFirebaseAuth } from "../middleware/auth";
import { db } from "../db/firebase";
import { saveClientEvent } from "../services/firestore";

export const eventsRouter = Router();

export function parseIntInRange(value: any, { defaultValue, min, max }: { defaultValue: number, min: number, max: number }): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.min(max, Math.max(min, parsed));
}

/**
 * GET /api/v1/events — List recent interaction events for the authenticated user.
 * Query params: limit (default 50, max 100), offset (default 0).
 */
eventsRouter.get("/", requireFirebaseAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = req.user!.uid;
    const limit = parseIntInRange(req.query.limit, { defaultValue: 50, min: 1, max: 100 });
    const offset = parseIntInRange(req.query.offset, { defaultValue: 0, min: 0, max: 1000 });

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

// this will allow us to read and track user events
/**
 * POST /api/v1/events/track — Track a lightweight client action (login, page_view, etc.)
 * Body: { eventType: string, content?: string, meta?: object }
 */
eventsRouter.post("/track", requireFirebaseAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = req.user!.uid;
    const { eventType, content, meta } = req.body ?? {};

    if (!eventType || typeof eventType !== "string") {
      return res.status(400).json({ error: "eventType (string) is required" });
    }

    const eventId = await saveClientEvent(uid, {
      eventType,
      content: typeof content === "string" ? content : undefined,
      meta: meta && typeof meta === "object" ? meta : undefined,
      requestMeta: {
        path: req.originalUrl,
        method: req.method,
        ip: req.ip || "",
        userAgent: req.headers["user-agent"] || undefined,
      },
    });

    res.json({ ok: true, eventId });
  } catch (err) {
    next(err);
  }
});
