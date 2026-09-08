import { GoogleGenAI } from "@google/genai";
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
        { text: 'I want a professional, high-resolution version of the uploaded file. The new version should meticulously recreate the verbatim text and complex layout with absolute precision. All text, tables, numbers, annotations, and formatting from the original must be preserved exactly, with strict attention to spelling and content, but rendered with ultra-crisp clarity using a bold, high-legibility sans-serif typeface. Clear paper texture. Even, soft studio lighting for maximum contrast and perfect readability. Hand-drawn circles, handwritten annotations, and precise ticks must be perfectly legible and integrated cleanly, but rendered in clear, crisp forms. Remove any extra border that could have been added when scanning and make the page look clean. Double check that no extra marks or content is added by mistake.' }
      ] 
    },
    config: { imageConfig: { imageSize: "1K" } }
  });
  console.log("Candidate keys:", Object.keys(res.candidates[0]));
  console.log("Parts keys:", JSON.stringify(res.candidates[0].content.parts.map(p => Object.keys(p))));
  const texts = res.candidates[0].content.parts.filter(p => p.text).map(p => p.text);
  if (texts.length > 0) console.log("Text returned:", texts);
}
test();
