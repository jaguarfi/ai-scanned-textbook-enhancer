/**
 * Deterministic scan restoration.
 *
 * This engine replaces generative enhancement for any page where accuracy
 * matters. It never runs a model, so it has no capacity to add, remove or
 * reinterpret content: the output is a function of the input bytes and the
 * frozen parameters below, and repeating a run reproduces it exactly.
 *
 * Stage order is deliberate. Deskew and denoise run at native resolution,
 * because upscaling first bakes interpolation blur into the image and doubles
 * the area every subsequent filter has to clean. Upscaling is therefore last.
 */

import sharp from 'sharp';
import { estimateSkew, measurePaperTone, verifyFidelity } from './analysis';
import {
  applyInkPaperCurve,
  bilateralDenoise,
  flattenIllumination,
  unsharpMask,
} from './ops';
import { EnhanceResult, PipelineParams, RgbImage, StageReport } from './types';

/**
 * Bump this whenever DEFAULT_PARAMS or any stage changes.
 * Two outputs carrying the same version are directly comparable.
 */
export const PIPELINE_VERSION = '1.1.0';

/**
 * Frozen parameters. These are not exposed as sliders on purpose: the value of
 * this engine is that the same page always restores the same way, and a knob
 * the operator can nudge is a knob that reintroduces run-to-run variance.
 */
export const DEFAULT_PARAMS: PipelineParams = {
  deskewMinAngle: 0.2,
  deskewMaxAngle: 5,
  illuminationBlockSize: 24,
  illuminationSmoothingPasses: 12,
  illuminationMinGain: 0.75,
  illuminationMaxGain: 1.6,
  denoiseRadius: 2,
  denoiseRangeSigma: 26,
  denoiseStrength: 0.75,
  contrastStrength: 0.55,
  contrastPivot: 0.18,
  contrastFloor: 8,
  sharpenAmount: 0.8,
  sharpenRadius: 1.2,
  sharpenClampEpsilon: 6,
  upscale: 2,
};

/** Longest edge we will produce. Keeps PNG payloads and memory bounded. */
const MAX_OUTPUT_EDGE = 4000;

/**
 * Resolves the output scale from the source dimensions alone, so the decision
 * is reproducible. Never returns a value below 1: downscaling a textbook page
 * discards detail, which is content loss.
 */
function resolveScale(width: number, height: number, requested: number): number {
  const longEdge = Math.max(width, height);
  const capped = Math.min(requested, MAX_OUTPUT_EDGE / longEdge);
  return capped < 1 ? 1 : capped;
}

export interface EnhanceOptions {
  params?: Partial<PipelineParams>;
}

/**
 * Restores a scanned page.
 *
 * @param input Encoded image bytes (JPEG, PNG, WebP, TIFF...).
 */
export async function enhanceDeterministic(
  input: Buffer,
  options: EnhanceOptions = {}
): Promise<EnhanceResult> {
  const params: PipelineParams = { ...DEFAULT_PARAMS, ...options.params };
  const stages: StageReport[] = [];

  const track = async <T>(name: string, fn: () => T | Promise<T>): Promise<T> => {
    const started = Date.now();
    const value = await fn();
    stages.push({
      name,
      ms: Date.now() - started,
      detail: typeof value === 'string' ? value : '',
    });
    return value;
  };

  // --- Decode -------------------------------------------------------------
  // Flattened onto white so transparent PNGs behave like paper rather than
  // producing black regions, and stripped to plain RGB for the pixel stages.
  const decoded = await sharp(input)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let working: RgbImage = {
    data: new Uint8Array(decoded.data),
    width: decoded.info.width,
    height: decoded.info.height,
  };
  stages.push({
    name: 'Decode',
    ms: 0,
    detail: `${working.width}x${working.height} ${decoded.info.channels}ch`,
  });

  // --- Measure ------------------------------------------------------------
  // Everything downstream is anchored to this measurement, which is how the
  // page keeps its own background instead of being normalised to white.
  const sourcePaper = measurePaperTone(working);
  stages.push({
    name: 'Measure paper',
    ms: 0,
    detail: `luminance ${sourcePaper.luminance}, rgb(${Math.round(sourcePaper.r)}, ${Math.round(
      sourcePaper.g
    )}, ${Math.round(sourcePaper.b)})`,
  });

  // --- Deskew -------------------------------------------------------------
  const rawAngle = await track('Deskew', () =>
    estimateSkew(working, sourcePaper, params.deskewMaxAngle)
  );
  let deskewAngle = 0;

  if (Math.abs(rawAngle) >= params.deskewMinAngle) {
    deskewAngle = rawAngle;
    // Rotate against the detected slope. New corner area is filled with the
    // measured substrate so the page keeps a single continuous paper colour
    // rather than gaining black wedges.
    const rotated = await sharp(Buffer.from(working.data), {
      raw: { width: working.width, height: working.height, channels: 3 },
    })
      .rotate(-deskewAngle, {
        background: {
          r: Math.round(sourcePaper.r),
          g: Math.round(sourcePaper.g),
          b: Math.round(sourcePaper.b),
        },
      })
      .raw()
      .toBuffer({ resolveWithObject: true });

    working = {
      data: new Uint8Array(rotated.data),
      width: rotated.info.width,
      height: rotated.info.height,
    };
  }
  stages[stages.length - 1].detail =
    deskewAngle === 0
      ? `detected ${rawAngle.toFixed(2)}deg, below ${params.deskewMinAngle}deg threshold - not rotated`
      : `corrected ${deskewAngle.toFixed(2)}deg`;

  // Fidelity is judged against the page as it stands after deskew, so an
  // intentional rotation is not mistaken for content drift. Both sides of the
  // comparison then share identical geometry.
  const baseline: RgbImage = {
    data: new Uint8Array(working.data),
    width: working.width,
    height: working.height,
  };

  // --- Restoration stages -------------------------------------------------
  await track('Flatten illumination', () =>
    flattenIllumination(working, sourcePaper, params)
  );
  await track('Denoise', () => bilateralDenoise(working, params));
  await track('Ink/paper curve', () => applyInkPaperCurve(working, sourcePaper, params));
  await track('Sharpen', () => unsharpMask(working, params));

  // --- Verify -------------------------------------------------------------
  const resultPaper = measurePaperTone(working);
  const fidelity = await track('Verify', () => {
    const report = verifyFidelity(baseline, working, sourcePaper, resultPaper);
    return report;
  });
  stages[stages.length - 1].detail = fidelity.passed
    ? 'all checks within tolerance'
    : fidelity.warnings.join(' ');

  // --- Upscale and encode -------------------------------------------------
  const scale = resolveScale(working.width, working.height, params.upscale);
  const outWidth = Math.round(working.width * scale);
  const outHeight = Math.round(working.height * scale);

  let encoder = sharp(Buffer.from(working.data), {
    raw: { width: working.width, height: working.height, channels: 3 },
  });

  if (scale !== 1) {
    // Lanczos-3 preserves stroke edges better than bilinear or bicubic at the
    // integer-ish scales used here.
    encoder = encoder.resize(outWidth, outHeight, { kernel: 'lanczos3' });
  }

  const png = await encoder.png({ compressionLevel: 9 }).toBuffer();
  stages.push({
    name: 'Upscale and encode',
    ms: 0,
    detail: `${scale.toFixed(2)}x lanczos3 -> ${outWidth}x${outHeight}, ${Math.round(
      png.length / 1024
    )} KB PNG`,
  });

  return {
    enhancedUrl: `data:image/png;base64,${png.toString('base64')}`,
    width: outWidth,
    height: outHeight,
    size: png.length,
    deskewAngle,
    paperTone: sourcePaper,
    stages,
    fidelity,
    pipelineVersion: PIPELINE_VERSION,
  };
}
