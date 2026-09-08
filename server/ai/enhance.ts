import sharp from 'sharp';
import { GoogleGenAI } from '@google/genai';
import { measurePaperTone, verifyFidelity } from '../pipeline/analysis';
import { FidelityReport, PaperTone, RgbImage } from '../pipeline/types';

/**
 * Generative enhancement, constrained as far as the model allows.
 *
 * A generative model redraws the page rather than filtering it, so unlike the
 * deterministic engine this path cannot guarantee that the output matches the
 * source. What it can do is remove the avoidable sources of drift and then
 * measure what actually changed:
 *
 *   - sampling is pinned (temperature 0, fixed seed) so the model is not
 *     re-rolling a different interpretation on every run;
 *   - the page is padded to an aspect ratio the model actually supports and
 *     cropped back afterwards, so the page is not silently reshaped;
 *   - the prompt describes a cleanup, not a recreation;
 *   - the result is checked against the source and the report is returned.
 *
 * The seed is documented as best effort, so identical output across runs is
 * not promised the way it is for the deterministic engine.
 */

/** Ratios the image model accepts, as width/height. */
const SUPPORTED_RATIOS: Array<{ label: string; value: number }> = [
  { label: '1:1', value: 1 },
  { label: '2:3', value: 2 / 3 },
  { label: '3:2', value: 3 / 2 },
  { label: '3:4', value: 3 / 4 },
  { label: '4:3', value: 4 / 3 },
  { label: '9:16', value: 9 / 16 },
  { label: '16:9', value: 16 / 9 },
  { label: '21:9', value: 21 / 9 },
];

/** Fixed so repeat runs on the same page start from the same point. */
export const AI_SEED = 7;

/**
 * Describes a cleanup of an existing page.
 *
 * The previous wording asked the model to "recreate" the page with "clean
 * paper texture and even soft studio lighting", which invites it to invent a
 * background and redraw content. This asks for the opposite.
 */
export const AI_PROMPT = [
  'Clean up this scan of a textbook page. Return the same page, only clearer.',
  '',
  'Keep every mark exactly as it is: all text, numbers, equations, tables, diagrams,',
  'labels, page numbers, handwriting and faint pencil marks stay in place, with the',
  'same wording, the same position, the same size and the same layout.',
  '',
  'Do not add anything that is not already on the page: no annotations, marks,',
  'highlights, borders, icons, captions or corrections. Do not translate, rewrite,',
  'summarise, complete or solve anything. Do not fill in areas that are unclear or',
  'damaged; leave them as they are. Do not remove faint or handwritten marks, even if',
  'they look like imperfections.',
  '',
  'Keep the paper its original colour. If the page is cream, grey or yellowed, it must',
  'stay that shade; do not whiten it. Preserve the existing margins, spacing and',
  'alignment.',
  '',
  'Only reduce scanning noise and grain, even out blotchy lighting, and make the',
  'existing strokes crisper. The result must read as a cleaner scan of this same page,',
  'not a redesigned or regenerated one.',
].join('\n');

export interface AiEnhanceResult {
  enhancedUrl: string;
  width: number;
  height: number;
  size: number;
  /** How the source was padded to reach a supported ratio. */
  aspectRatio: string;
  paddedPixels: { x: number; y: number };
  fidelity: FidelityReport;
  notes: string;
  seed: number;
}

/** Picks the supported ratio reachable with the least padding. */
function chooseRatio(width: number, height: number) {
  const source = width / height;
  let best = SUPPORTED_RATIOS[0];
  let bestArea = Infinity;

  for (const ratio of SUPPORTED_RATIOS) {
    // Padding only ever grows the canvas: widen it or heighten it, never both.
    const paddedWidth = ratio.value > source ? Math.round(height * ratio.value) : width;
    const paddedHeight = ratio.value < source ? Math.round(width / ratio.value) : height;
    const area = paddedWidth * paddedHeight;
    if (area < bestArea) {
      bestArea = area;
      best = ratio;
    }
  }
  return best;
}

/** Requests a size that does not throw away source detail. */
function chooseImageSize(width: number, height: number): string {
  const longEdge = Math.max(width, height);
  if (longEdge >= 2800) return '4K';
  if (longEdge >= 1400) return '2K';
  return '1K';
}

async function toRgb(buffer: Buffer): Promise<RgbImage> {
  const { data, info } = await sharp(buffer)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
}

export async function enhanceWithAI(
  ai: GoogleGenAI,
  input: Buffer,
  options: { prompt?: string; model?: string } = {}
): Promise<AiEnhanceResult> {
  const source = await toRgb(input);
  const paper: PaperTone = measurePaperTone(source);

  // --- Pad to a ratio the model supports ----------------------------------
  // Left unset, the model picks its own ratio and the page comes back stretched
  // by several percent. Padding with the page's own paper colour keeps the
  // content geometry intact, and the bars are cropped off afterwards.
  const ratio = chooseRatio(source.width, source.height);
  const sourceRatio = source.width / source.height;
  const paddedWidth =
    ratio.value > sourceRatio ? Math.round(source.height * ratio.value) : source.width;
  const paddedHeight =
    ratio.value < sourceRatio ? Math.round(source.width / ratio.value) : source.height;

  const padX = Math.floor((paddedWidth - source.width) / 2);
  const padY = Math.floor((paddedHeight - source.height) / 2);

  const padded = await sharp(input)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .removeAlpha()
    .extend({
      top: padY,
      bottom: paddedHeight - source.height - padY,
      left: padX,
      right: paddedWidth - source.width - padX,
      background: {
        r: Math.round(paper.r),
        g: Math.round(paper.g),
        b: Math.round(paper.b),
      },
    })
    .png()
    .toBuffer();

  // --- Generate -----------------------------------------------------------
  const models = [
    options.model || process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image',
    'gemini-2.5-flash-image',
  ].filter((model, index, availableModels) => availableModels.indexOf(model) === index);

  let generated: Buffer | null = null;
  let notes = '';
  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: {
          parts: [
            { inlineData: { data: padded.toString('base64'), mimeType: 'image/png' } },
            { text: options.prompt || AI_PROMPT },
          ],
        },
        config: {
          // Greedy decoding. The previous call set no sampling controls at all,
          // which is why the same page came back with a different background and
          // different invented details on each run.
          temperature: 0,
          seed: AI_SEED,
          imageConfig: {
            aspectRatio: ratio.label,
            imageSize: chooseImageSize(source.width, source.height),
          },
        },
      });

      notes = '';
      for (const candidate of response.candidates || []) {
        for (const part of candidate.content?.parts || []) {
          if (part.inlineData?.data && !generated) {
            generated = Buffer.from(part.inlineData.data, 'base64');
          } else if (part.text) {
            notes += part.text;
          }
        }
        if (generated) break;
      }

      if (generated) break;
      lastError = new Error(notes.trim() || 'No image data returned from model');
      console.warn(`Gemini model ${model} returned no image data.`);
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`Gemini model ${model} unavailable:`, err?.message || err);
    }
  }

  if (!generated) {
    throw lastError || new Error('No image data returned from model');
  }

  // --- Crop the padding back off and restore source geometry --------------
  // The model returns its own resolution, so the bars are removed by
  // proportion rather than by pixel count.
  const meta = await sharp(generated).metadata();
  const outWidth = meta.width || paddedWidth;
  const outHeight = meta.height || paddedHeight;
  const scaleX = outWidth / paddedWidth;
  const scaleY = outHeight / paddedHeight;

  const cropLeft = Math.round(padX * scaleX);
  const cropTop = Math.round(padY * scaleY);
  const cropWidth = Math.max(1, Math.min(outWidth - cropLeft, Math.round(source.width * scaleX)));
  const cropHeight = Math.max(1, Math.min(outHeight - cropTop, Math.round(source.height * scaleY)));

  const cropped = await sharp(generated)
    .extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
    .png()
    .toBuffer();

  // --- Verify against the source -----------------------------------------
  // Compared at the source's own dimensions so the two are pixel-aligned; this
  // copy exists only for measurement, and the full-resolution result is what
  // gets returned.
  const comparable = await sharp(cropped)
    .resize(source.width, source.height, { kernel: 'lanczos3', fit: 'fill' })
    .png()
    .toBuffer();
  const resultImage = await toRgb(comparable);
  const fidelity = verifyFidelity(source, resultImage, paper, measurePaperTone(resultImage));

  const finalMeta = await sharp(cropped).metadata();
  return {
    enhancedUrl: `data:image/png;base64,${cropped.toString('base64')}`,
    width: finalMeta.width || cropWidth,
    height: finalMeta.height || cropHeight,
    size: cropped.length,
    aspectRatio: ratio.label,
    paddedPixels: { x: padX, y: padY },
    fidelity,
    notes: notes.trim(),
    seed: AI_SEED,
  };
}
