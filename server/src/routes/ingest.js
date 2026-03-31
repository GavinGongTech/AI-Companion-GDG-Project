import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

// TODO: add multer middleware for file uploads
// import multer from "multer";
// const upload = multer({ dest: "uploads/" });

export const ingestRouter = Router();

ingestRouter.post(
  "/upload",
  requireAuth,
  // upload.single("file"),   // TODO: uncomment when multer is wired
  async (req, res, next) => {
    try {
      // TODO: receive file, kick off ingestion job, return jobId
      // const jobId = await ingestFile(req.file.path, req.body.courseId);
      res.status(501).json({ todo: true, message: "ingest upload not implemented" });
    } catch (err) {
      next(err);
    }
  },
);

ingestRouter.get("/status/:jobId", requireAuth, async (req, res, next) => {
  try {
    // TODO: look up job status from DB or in-memory queue
    res.status(501).json({ todo: true, jobId: req.params.jobId });
  } catch (err) {
    next(err);
  }
});
