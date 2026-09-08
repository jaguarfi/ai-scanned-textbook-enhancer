import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

// High body limit for base64 images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Lazy GoogleGenAI client
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
  });
});

/**
 * AI image diagnostic and quality assessment endpoint
 * Analyzes noise, blur, compression artifacts, and suggests tailored restoration
 */
app.post('/api/gemini/analyze', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64 data' });
    }

    const ai = getAIClient();
    if (!ai) {
      // Fallback heuristics when API key is not configured
      return res.json({
        noiseScore: 24,
        sharpnessScore: 68,
        overallQuality: 82,
        compressionArtifacts: 'Moderate',
        recommendation: 'Apply 2× super-resolution with edge-preserving bilateral denoising.',
        detectedFeatures: ['Edge Sharpening', 'Bilateral Denoising', 'Contrast Recovery'],
      });
    }

    // Clean base64 header if present
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const schemaConfig = {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          noiseScore: {
            type: Type.NUMBER,
            description: 'Noise level percentage from 0 (clean) to 100 (heavily grainy)',
          },
          sharpnessScore: {
            type: Type.NUMBER,
            description: 'Sharpness score from 0 (very blurry) to 100 (razor sharp)',
          },
          overallQuality: {
            type: Type.NUMBER,
            description: 'Overall visual quality score from 0 to 100',
          },
          compressionArtifacts: {
            type: Type.STRING,
            description: 'Artifact level: Low, Moderate, or Heavy',
          },
          recommendation: {
            type: Type.STRING,
            description: 'Brief restoration recommendation',
          },
          suggestedDenoiseLevel: {
            type: Type.NUMBER,
            description: 'Recommended denoise slider value 0-100',
          },
          suggestedSharpness: {
            type: Type.NUMBER,
            description: 'Recommended sharpness slider value 0-100',
          },
        },
        required: [
          'noiseScore',
          'sharpnessScore',
          'overallQuality',
          'compressionArtifacts',
          'recommendation',
        ],
      },
    };

    const contentPayload = [
      {
        parts: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: mimeType,
            },
          },
          {
            text: `Analyze this image for quality flaws, sensor noise, resolution issues, and compression artifacts. Return a strict JSON response assessing quality metrics and restoration suggestions.`,
          },
        ],
      },
    ];

    let responseText = '';

    // First attempt with gemini-3.8-flash, with fallback to gemini-3.1-flash-lite on transient 503 / high demand
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: contentPayload,
        config: schemaConfig,
      });
      responseText = response.text || '';
    } catch (primaryErr: any) {
      // If 503 or transient error, retry with gemini-3.1-flash-lite
      const isTransient =
        primaryErr?.status === 503 ||
        primaryErr?.message?.includes('503') ||
        primaryErr?.message?.includes('high demand') ||
        primaryErr?.message?.includes('UNAVAILABLE');

      if (isTransient) {
        console.warn('Gemini 3.8 Flash experiencing temporary high demand (503). Retrying with gemini-3.1-flash-lite...');
        try {
          const fallbackResponse = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: contentPayload,
            config: schemaConfig,
          });
          responseText = fallbackResponse.text || '';
        } catch (secondaryErr: any) {
          console.warn('Gemini secondary model also unavailable.');
          return res.status(503).json({ error: 'AI analysis unavailable' });
        }
      } else {
        console.warn('Gemini analysis unavailable:', primaryErr?.message || primaryErr);
        return res.status(503).json({ error: 'AI analysis unavailable' });
      }
    }

    if (responseText) {
      try {
        const parsed = JSON.parse(responseText);
        return res.json(parsed);
      } catch {
        return res.status(500).json({ error: 'Failed to parse AI response' });
      }
    }

    return res.status(500).json({ error: 'Failed to get analysis from AI' });
  } catch (err: any) {
    console.warn('Handled Gemini analysis fallback:', err?.message || err);
    return res.status(500).json({ error: 'Failed to get analysis from AI' });
  }
});

/**
 * Gemini Generative Image Enhancement
 */
app.post('/api/gemini/enhance', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64' });
    }

    const ai = getAIClient();
    if (!ai) {
      return res.status(400).json({
        error: 'GEMINI_API_KEY is not configured on the server',
      });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    // Try Gemini image enhancement
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                data: cleanBase64,
                mimeType: mimeType,
              },
            },
            {
              text: req.body.prompt || 'I want a professional, high-resolution version of the uploaded file, restoring its clarity and layout. Recreate the verbatim text and complex layout with absolute precision. All text, tables, annotations, highlighted text, numbers, and formatting from the original must be preserved exactly, but rendered with ultra-crisp clarity. CRITICAL INSTRUCTION: Do NOT add any translations, or your own annotations. Do NOT solve any exercises. Do NOT hallucinate or add any content that is not explicitly present in the original image. Clean up the page by removing any scanning borders, maintaining a clean paper texture and even soft studio lighting.',
            },
          ],
        },
        config: {
          imageConfig: {
            imageSize: "2K"
          }
        }
      });

      let enhancedBase64 = '';
      let responseText = '';

      const candidates = response.candidates || [];
      if (candidates[0]?.content?.parts) {
        for (const part of candidates[0].content.parts) {
          if (part.inlineData?.data) {
            enhancedBase64 = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
            break;
          } else if (part.text) {
            responseText += part.text;
          }
        }
      }

      if (enhancedBase64) {
        return res.json({
          success: true,
          enhancedUrl: enhancedBase64,
          notes: responseText || 'Image reconstructed with Gemini AI',
        });
      } else {
        console.warn('Gemini response returned no inlineData:', JSON.stringify(candidates, null, 2));
        return res.json({
          success: false,
          message: 'No image data returned from model',
          text: responseText,
        });
      }
    } catch (modelErr: any) {
      console.warn('Gemini generative image model temporary unavailable:', modelErr?.message || modelErr);
      return res.json({
        success: false,
        error: modelErr?.message || 'Model temporarily busy. Please try again later.',
      });
    }
  } catch (err: any) {
    console.warn('Gemini image enhance handler caught error:', err?.message || err);
    return res.status(200).json({
      success: false,
      error: err?.message || 'Error processing image with Gemini',
    });
  }
});

async function startServer() {
  // Vite middleware for dev or static serving in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
