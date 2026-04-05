import { Router } from "express";
import { requireFirebaseAuth } from "../middleware/auth.js";
import { db } from "../db/firebase.js";

export const courseRouter = Router();

/**
 * GET /api/v1/courses — List all courses for the authenticated user.
 */
courseRouter.get("/", requireFirebaseAuth, async (req, res, next) => {
  try {
    const uid = req.user.uid;
    const snap = await db.collection("users").doc(uid).collection("courses").get();
    const courses = snap.docs.map((doc) => ({ courseId: doc.id, ...doc.data() }));
    res.json({ courses });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/courses/:courseId — Get details for a specific course.
 * Returns ingested docs, last ingested time, and any deadline/urgency info.
 */
courseRouter.get("/:courseId", requireFirebaseAuth, async (req, res, next) => {
  try {
    const uid = req.user.uid;
    const { courseId } = req.params;

    const courseRef = db.collection("users").doc(uid).collection("courses").doc(courseId);
    const courseDoc = await courseRef.get();

    if (!courseDoc.exists) {
      return res.status(404).json({ error: "Course not found" });
    }

    // Get ingested files
    const filesSnap = await courseRef.collection("files").get();
    const ingestedDocs = filesSnap.docs.map((doc) => ({
      fileId: doc.id,
      ...doc.data(),
    }));

    // Get chunk count
    const chunksSnap = await courseRef.collection("chunks").count().get();
    const chunkCount = chunksSnap.data().count;

    const data = courseDoc.data();
    res.json({
      courseId,
      ...data,
      ingestedDocs,
      chunkCount,
    });
  } catch (err) {
    next(err);
  }
});
