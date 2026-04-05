import { embedBatch } from "./embeddings.js";
import { extractText, extractTextFromPDF } from "./ocr.js";
import { db } from "../db/firebase.js";
import { FieldValue } from "firebase-admin/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../env.js";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const genai = new GoogleGenerativeAI(env.geminiApiKey);

const CHUNK_SIZE = 500;   // characters per chunk
const CHUNK_OVERLAP = 50; // overlap between adjacent chunks

/**
 * Split text into overlapping chunks of roughly CHUNK_SIZE characters,
 * preferring to break at sentence boundaries.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function chunkText(text) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = start + CHUNK_SIZE;
    // Try to break at a sentence boundary
    if (end < text.length) {
      const slice = text.slice(start, end + 50);
      const sentenceEnd = slice.search(/[.!?]\s/);
      if (sentenceEnd > CHUNK_SIZE * 0.6) {
        end = start + sentenceEnd + 1;
      }
    }
    chunks.push(text.slice(start, end).trim());
    start = end - CHUNK_OVERLAP;
  }
  return chunks.filter((c) => c.length > 0);
}

/**
 * Hash a filename + courseId to detect duplicate uploads.
 *
 * @param {string} filename
 * @param {string} courseId
 * @returns {string}
 */
function fileHash(filename, courseId) {
  return createHash("sha256").update(`${courseId}:${filename}`).digest("hex");
}

/**
 * Ingest a plain-text string: chunk it, embed all chunks, and store in Firestore.
 * Chunks are stored at users/{uid}/courses/{courseId}/chunks/{auto-id}.
 *
 * @param {string} uid
 * @param {string} courseId
 * @param {string} text
 * @param {object} metadata - { source, page, week, filename }
 */
export async function ingestText(uid, courseId, text, metadata = {}) {
  const chunks = chunkText(text);
  if (chunks.length === 0) return;

  // Batch embed all chunks
  const vectors = await embedBatch(chunks);

  // Write chunks to Firestore in batched writes (max 500 per batch)
  const chunksRef = db.collection("users").doc(uid)
    .collection("courses").doc(courseId)
    .collection("chunks");

  let batch = db.batch();
  let batchCount = 0;

  for (let i = 0; i < chunks.length; i++) {
    const ref = chunksRef.doc();
    batch.set(ref, {
      content: chunks[i],
      embedding: FieldValue.vector(vectors[i]),
      metadata,
      chunkIndex: i,
      createdAt: FieldValue.serverTimestamp(),
    });
    batchCount++;

    if (batchCount >= 400) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }
}

/**
 * Upload a document to the Gemini File API and store the URI in Firestore.
 * Per the design doc, file URIs are attached to every LLM prompt for that course.
 *
 * @param {string} uid
 * @param {string} courseId
 * @param {string} filePath - Path to the file on disk
 * @param {string} filename - Original filename
 * @param {string} sourcePlatform - "brightspace" | "gradescope" | "upload"
 * @returns {Promise<{ fileUri: string, ingestedAt: Date }>}
 */
export async function uploadToGeminiFileAPI(uid, courseId, filePath, filename, sourcePlatform) {
  const hash = fileHash(filename, courseId);

  // Check for duplicate
  const filesRef = db.collection("users").doc(uid)
    .collection("courses").doc(courseId)
    .collection("files");

  const existing = await filesRef.where("fileHash", "==", hash).get();
  if (!existing.empty) {
    const doc = existing.docs[0].data();
    return { fileUri: doc.geminiFileUri, ingestedAt: doc.uploadedAt };
  }

  // Upload to Gemini File API
  const fileManager = genai.getFileManager();
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".html": "text/html",
    ".htm": "text/html",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
  };

  const uploaded = await fileManager.uploadFile(filePath, {
    displayName: filename,
    mimeType: mimeTypes[ext] || "application/octet-stream",
  });
  const geminiFileUri = uploaded.file.uri;

  // Store file record in Firestore
  await filesRef.add({
    geminiFileUri,
    filename,
    fileHash: hash,
    sourcePlatform,
    uploadedAt: FieldValue.serverTimestamp(),
  });

  // Also ensure course doc exists
  const courseRef = db.collection("users").doc(uid)
    .collection("courses").doc(courseId);
  await courseRef.set({
    lastIngestedAt: FieldValue.serverTimestamp(),
    platform: sourcePlatform,
  }, { merge: true });

  return { fileUri: geminiFileUri, ingestedAt: new Date() };
}

/**
 * Read a file from disk, extract text, then ingest via chunking + embedding.
 * Also uploads to Gemini File API for direct file context.
 *
 * @param {string} uid
 * @param {string} courseId
 * @param {string} filePath - Absolute path to the uploaded file
 * @param {string} filename - Original filename
 * @param {string} sourcePlatform
 */
export async function ingestFile(uid, courseId, filePath, filename, sourcePlatform = "upload") {
  const ext = path.extname(filename).toLowerCase();
  let text;

  if (ext === ".pdf") {
    text = await extractTextFromPDF(filePath);
  } else if ([".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"].includes(ext)) {
    text = await extractText(filePath);
  } else {
    text = await readFile(filePath, "utf-8");
  }

  // Run both in parallel: chunk+embed into Firestore AND upload to Gemini File API
  await Promise.all([
    ingestText(uid, courseId, text, { filename, source: sourcePlatform }),
    uploadToGeminiFileAPI(uid, courseId, filePath, filename, sourcePlatform),
  ]);
}
