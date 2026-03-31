// TODO: install @google-cloud/vision — npm install @google-cloud/vision
// import vision from "@google-cloud/vision";
// Credentials are picked up from GOOGLE_APPLICATION_CREDENTIALS env var.
// const client = new vision.ImageAnnotatorClient();

/**
 * Extract text from an image file using Google Cloud Vision OCR.
 * Useful for handwritten notes or screenshot-based questions.
 *
 * @param {string} imagePath - Absolute path to the image file
 * @returns {Promise<string>} Extracted plain text
 */
export async function extractText(imagePath) {
  // TODO:
  // const [result] = await client.textDetection(imagePath);
  // const detections = result.textAnnotations;
  // return detections[0]?.description ?? "";
  throw new Error("extractText: not implemented");
}
