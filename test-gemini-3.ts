import { GoogleGenAI } from "@google/genai";
import * as fs from 'fs';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function test() {
  const res = await ai.models.generateContent({
    model: 'gemini-3.1-flash-image',
    contents: { 
      parts: [
        {
          inlineData: {
            data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
            mimeType: "image/png"
          }
        },
        { text: 'A small red apple' }
      ] 
    },
    config: { imageConfig: { imageSize: "1K" } }
  });
  console.log("Candidate keys:", Object.keys(res.candidates[0]));
  console.log("Parts keys:", JSON.stringify(res.candidates[0].content.parts.map(p => Object.keys(p))));
}
test();
