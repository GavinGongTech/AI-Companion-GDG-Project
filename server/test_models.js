import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  const models = [];
  try {
    const response = await ai.models.list();
    for await (const model of response) {
      if (model.name.includes('embed')) {
        models.push(model.name);
      }
    }
    console.log(models);
  } catch (e) {
    console.error(e);
  }
}
run();
