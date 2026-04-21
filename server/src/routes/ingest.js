import { Router } from "express";
import multer from "multer";
import { mkdir, unlink } from "node:fs/promises";
import { requireFirebaseAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { ingestTextSchema } from "../schemas.js";
import { ingestFile, ingestText } from "../services/ingestion.js";
import { ensureUserDoc } from "../services/firestore.js";
import { cacheInvalidate } from "../services/cache.js";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
await mkdir("uploads", { recursive: true });
const upload = multer({ dest: "uploads/", limits: { fileSize: MAX_FILE_SIZE } });

export const ingestRouter = Router();

/**
 * POST /api/v1/ingest/upload — Upload a file for ingestion.
 * Chunks the file, embeds it, stores in Firestore, and uploads to Gemini File API.
 */
ingestRouter.post(
  "/upload",
  requireFirebaseAuth,
  upload.single("file"),
  async (req, res, next) => {
    try {
      const uid = req.user.uid;
      const courseId = req.body.courseId;
      const sourcePlatform = req.body.sourcePlatform || "upload";

      if (!req.file) {
        return res.status(400).json({ error: "file is required" });
      }
      if (!courseId) {
        return res.status(400).json({ error: "courseId is required" });
      }

      await ensureUserDoc(uid, req.user.email, req.user.name);

      await ingestFile(uid, courseId, req.file.path, req.file.originalname, sourcePlatform);
      cacheInvalidate(`courses:${uid}`);
      cacheInvalidate(`course:${uid}:${courseId}`);

      res.json({ ok: true, filename: req.file.originalname, courseId });
    } catch (err) {
      next(err);
    } finally {
      // Clean up uploaded temp file
      if (req.file?.path) {
        unlink(req.file.path).catch(() => {});
      }
    }
  },
);

/**
 * POST /api/v1/ingest/text — Ingest raw text content (from content script).
 * Used by the Brightspace/Gradescope content scripts to ship page content.
 */
ingestRouter.post("/text", requireFirebaseAuth, validate(ingestTextSchema), async (req, res, next) => {
  try {
    const uid = req.user.uid;
    const { courseId, rawContent, sourcePlatform, filename } = req.body;

    await ensureUserDoc(uid, req.user.email, req.user.name);

    await ingestText(uid, courseId, rawContent, {
      filename: filename || "content-script-capture",
      source: sourcePlatform,
    });
    cacheInvalidate(`courses:${uid}`);
    cacheInvalidate(`course:${uid}:${courseId}`);

    res.json({ ok: true, courseId, ingestedAt: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});
