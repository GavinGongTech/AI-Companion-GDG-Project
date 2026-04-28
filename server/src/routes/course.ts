import { Router, type Request, type Response, type NextFunction } from "express";
import { requireFirebaseAuth } from "../middleware/auth";
import { db } from "../db/firebase";
import { cacheGet, cacheSet } from "../services/cache";

export const courseRouter = Router();

/**
 * GET /api/v1/courses — List all courses for the authenticated user.
 */
courseRouter.get("/", requireFirebaseAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = req.user!.uid;
    const cacheKey = `courses:${uid}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const snap = await db.collection("users").doc(uid).collection("courses").get();
    const courses = snap.docs.map((doc) => ({ courseId: doc.id, ...doc.data() }));
    const body = { courses };
    cacheSet(cacheKey, body);
    res.json(body);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/courses/:courseId — Get details for a specific course.
 * Returns ingested docs, last ingested time, and any deadline/urgency info.
 */
courseRouter.get("/:courseId", requireFirebaseAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = req.user!.uid;
    const { courseId } = req.params;
    const cacheKey = `course:${uid}:${courseId}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const courseRef = db.collection("users").doc(uid).collection("courses").doc(courseId as string);
    const courseDoc = await courseRef.get();

    if (!courseDoc.exists) {
      return res.status(404).json({ error: "Course not found" });
    }

    // Get ingested files
    const filesSnap = await courseRef.collection("files").get();
    const ingestedDocs = filesSnap.docs.map((doc) => {
      const { geminiFileUri: _geminiFileUri, fileHash: _fileHash, ...rest } = doc.data();
      return { fileId: doc.id, ...rest };
    });

    // Get chunk count
    const chunksSnap = await courseRef.collection("chunks").count().get();
    const chunkCount = chunksSnap.data().count;

    const data = courseDoc.data();
    const body = { courseId, ...data, ingestedDocs, chunkCount };
    cacheSet(cacheKey, body);
    res.json(body);
  } catch (err) {
    next(err);
  }
});
