import vision from "@google-cloud/vision";

// Credentials are picked up from GOOGLE_APPLICATION_CREDENTIALS env var.
const client = new vision.ImageAnnotatorClient();

/**
 * Extract text from an image file on disk using Google Cloud Vision OCR.
 *
 * @param {string} imagePath - Absolute path to the image file
 * @returns {Promise<string>} Extracted plain text
 */
export async function extractText(imagePath) {
  const [result] = await client.textDetection(imagePath);
  const detections = result.textAnnotations;
  return detections?.[0]?.description ?? "";
}

/**
 * Extract text from a base64-encoded image using Google Cloud Vision OCR.
 * Used for screenshot captures sent from the extension.
 *
 * @param {string} base64Image - Base64-encoded image data (without data URI prefix)
 * @returns {Promise<string>} Extracted plain text
 */
export async function extractTextFromBase64(base64Image) {
  const [result] = await client.textDetection({
    image: { content: base64Image },
  });
  const detections = result.textAnnotations;
  return detections?.[0]?.description ?? "";
}

/**
 * Extract text from a PDF document using Cloud Vision's document text detection.
 *
 * @param {string} pdfPath - Absolute path to the PDF file
 * @returns {Promise<string>} Extracted plain text
 */
export async function extractTextFromPDF(pdfPath) {
  const fs = await import("node:fs");
  const content = fs.readFileSync(pdfPath);
  const [result] = await client.documentTextDetection({
    image: { content: content.toString("base64") },
  });
  return result.fullTextAnnotation?.text ?? "";
}
