import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function test() {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image',
      contents: {
        parts: [
          { text: 'A small red apple' }
        ]
      },
      config: {
        imageConfig: { imageSize: "1K" }
      }
    });
    console.log(JSON.stringify(response.candidates, null, 2));
  } catch (err) {
    console.error(err);
  }
}
test();
