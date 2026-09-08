import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function test() {
  const res = await ai.models.generateContent({
    model: 'gemini-3.1-flash-image',
    contents: { parts: [{ text: 'A small red apple' }] },
    config: { imageConfig: { imageSize: "1K" } }
  });
  console.log("Candidate keys:", Object.keys(res.candidates[0]));
  console.log("Content keys:", Object.keys(res.candidates[0].content));
  console.log("Parts:", JSON.stringify(res.candidates[0].content.parts.map(p => Object.keys(p))));
  console.log("Part 0 keys:", Object.keys(res.candidates[0].content.parts[0]));
  if (res.candidates[0].content.parts[0].inlineData) {
     console.log("InlineData keys:", Object.keys(res.candidates[0].content.parts[0].inlineData));
  }
}
test();
