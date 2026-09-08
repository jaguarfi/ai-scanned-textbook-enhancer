/**
 * Pixel restoration stages.
 *
 * Design rule for this file: every stage must be incapable of inventing
 * content. In practice that means each one is either a monotonic tone map (it
 * can only redistribute levels that already exist) or is hard-clamped to the
 * range of its own local neighbourhood (it can only move a pixel to a value
 * some neighbour already had). Neither can synthesise a mark that was not in
 * the scan.
 */

import { luma } from './analysis';
import { PaperTone, PipelineParams, RgbImage } from './types';

/**
 * Estimates the smooth lighting field across the page and divides it out,
 * then restores the measured substrate tone.
 *
 * Uneven scanner lighting is the single biggest reason two scans of the same
 * book look different, so removing it is what makes results comparable. The
 * substrate tone is multiplied back in afterwards, which is the difference
 * between "evenly lit version of this page" and "this page rewritten as white".
 */
export function flattenIllumination(
  img: RgbImage,
  paper: PaperTone,
  params: PipelineParams
): string {
  const { width: w, height: h, data } = img;
  const block = params.illuminationBlockSize;
  const gridW = Math.ceil(w / block);
  const gridH = Math.ceil(h / block);
  const field = new Float32Array(gridW * gridH);
  const reliable = new Uint8Array(gridW * gridH);

  // Paper's own colour cast relative to its luminance. Lit paper stays close
  // to this cast at any brightness, which is what lets a block's percentile
  // luminance stand in for lighting. Printed colour - a highlighter stroke, a
  // table header fill - has a cast nothing like the paper's, so a block
  // dominated by one is not a lighting measurement at all.
  const paperLumRef = Math.max(1, paper.luminance);
  const castR = paper.r - paperLumRef;
  const castG = paper.g - paperLumRef;
  const castB = paper.b - paperLumRef;
  const CAST_TOLERANCE = 24;

  // Per block, take the 90th-percentile luminance as the local substrate.
  // A percentile rather than the maximum keeps dust and specular flecks from
  // dragging the estimate upward.
  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const x0 = gx * block;
      const y0 = gy * block;
      const x1 = Math.min(w, x0 + block);
      const y1 = Math.min(h, y0 + block);

      const hist = new Uint32Array(256);
      let n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const idx = (y * w + x) * 3;
          hist[Math.round(luma(data[idx], data[idx + 1], data[idx + 2]))]++;
          n++;
        }
      }

      let cumulative = 0;
      let value = 255;
      const target = n * 0.9;
      for (let v = 0; v < 256; v++) {
        cumulative += hist[v];
        if (cumulative >= target) {
          value = v;
          break;
        }
      }

      // Average the colour of pixels sitting near that percentile, the same
      // way the page-wide paper tone is measured, to see whether this block's
      // "substrate" is actually paper-coloured.
      const lo = value - 6;
      const hi = value + 6;
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let castN = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const idx = (y * w + x) * 3;
          const l = luma(data[idx], data[idx + 1], data[idx + 2]);
          if (l >= lo && l <= hi) {
            rSum += data[idx];
            gSum += data[idx + 1];
            bSum += data[idx + 2];
            castN++;
          }
        }
      }

      let castMatches = true;
      if (castN > 0) {
        const blockLumRef = Math.max(1, value);
        const dr = (rSum / castN - blockLumRef) - castR;
        const dg = (gSum / castN - blockLumRef) - castG;
        const db = (bSum / castN - blockLumRef) - castB;
        const castDistance = Math.sqrt(dr * dr + dg * dg + db * db);
        castMatches = castDistance <= CAST_TOLERANCE;
      }

      const g = gy * gridW + gx;
      field[g] = value;
      // Blocks far darker than the page substrate are photographs or solid
      // fills, not paper, and blocks whose colour cast does not match the
      // paper's are printed colour rather than lit paper. Either way their
      // brightness says nothing about the lighting, so they are filled in
      // from surrounding paper instead.
      reliable[g] = value >= paper.luminance - 45 && castMatches ? 1 : 0;
    }
  }

  // Seed unreliable blocks at the global substrate, then diffuse: reliable
  // blocks hold their measurement while unreliable ones converge on their
  // neighbours, producing a continuous field with no seams across figures.
  for (let i = 0; i < field.length; i++) {
    if (!reliable[i]) field[i] = paper.luminance;
  }

  const scratch = new Float32Array(field.length);
  for (let pass = 0; pass < params.illuminationSmoothingPasses; pass++) {
    for (let gy = 0; gy < gridH; gy++) {
      for (let gx = 0; gx < gridW; gx++) {
        let sum = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const ny = gy + dy;
          if (ny < 0 || ny >= gridH) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const nx = gx + dx;
            if (nx < 0 || nx >= gridW) continue;
            sum += field[ny * gridW + nx];
            n++;
          }
        }
        scratch[gy * gridW + gx] = sum / n;
      }
    }
    field.set(scratch);
  }

  // Apply as a per-pixel scalar gain. Scaling all three channels by the same
  // factor leaves hue untouched, so only the lighting changes, never the ink
  // colour or the paper's cast.
  let minGain = Infinity;
  let maxGain = -Infinity;

  for (let y = 0; y < h; y++) {
    const fy = Math.min(gridH - 1, y / block - 0.5);
    const gy0 = Math.max(0, Math.floor(fy));
    const gy1 = Math.min(gridH - 1, gy0 + 1);
    const ty = Math.max(0, fy - gy0);

    for (let x = 0; x < w; x++) {
      const fx = Math.min(gridW - 1, x / block - 0.5);
      const gx0 = Math.max(0, Math.floor(fx));
      const gx1 = Math.min(gridW - 1, gx0 + 1);
      const tx = Math.max(0, fx - gx0);

      const f00 = field[gy0 * gridW + gx0];
      const f10 = field[gy0 * gridW + gx1];
      const f01 = field[gy1 * gridW + gx0];
      const f11 = field[gy1 * gridW + gx1];
      const local =
        (1 - ty) * ((1 - tx) * f00 + tx * f10) + ty * ((1 - tx) * f01 + tx * f11);

      let gain = paper.luminance / Math.max(1, local);
      if (gain < params.illuminationMinGain) gain = params.illuminationMinGain;
      if (gain > params.illuminationMaxGain) gain = params.illuminationMaxGain;
      if (gain < minGain) minGain = gain;
      if (gain > maxGain) maxGain = gain;

      const idx = (y * w + x) * 3;
      data[idx] = clamp255(data[idx] * gain);
      data[idx + 1] = clamp255(data[idx + 1] * gain);
      data[idx + 2] = clamp255(data[idx + 2] * gain);
    }
  }

  return `gain ${minGain.toFixed(2)}-${maxGain.toFixed(2)} over ${gridW}x${gridH} blocks`;
}

/**
 * Edge-preserving bilateral denoise.
 *
 * Weights neighbours by both distance and colour similarity, so flat paper
 * averages away its grain while letter strokes — which differ sharply from
 * their surroundings — contribute almost nothing across the edge and stay
 * crisp. Because the output is a convex combination of actual neighbouring
 * pixels, it cannot produce a value that no neighbour had.
 */
export function bilateralDenoise(img: RgbImage, params: PipelineParams): string {
  const { width: w, height: h, data } = img;
  const r = params.denoiseRadius;
  const source = new Uint8Array(data);

  // Precompute both weight tables; the range table is indexed by squared
  // colour distance so the inner loop stays free of exp() calls.
  const spatial = new Float32Array((2 * r + 1) * (2 * r + 1));
  const spatialSigma = Math.max(0.8, r / 2);
  let k = 0;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      spatial[k++] = Math.exp(-(dx * dx + dy * dy) / (2 * spatialSigma * spatialSigma));
    }
  }

  const rangeSigma = params.denoiseRangeSigma;
  const rangeTable = new Float32Array(3 * 256 * 256);
  for (let d = 0; d < rangeTable.length; d++) {
    rangeTable[d] = Math.exp(-d / (2 * rangeSigma * rangeSigma));
  }

  const blend = params.denoiseStrength;

  for (let y = 0; y < h; y++) {
    const yLo = Math.max(0, y - r);
    const yHi = Math.min(h - 1, y + r);
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 3;
      const cr = source[idx];
      const cg = source[idx + 1];
      const cb = source[idx + 2];

      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let wSum = 0;

      const xLo = Math.max(0, x - r);
      const xHi = Math.min(w - 1, x + r);

      for (let ny = yLo; ny <= yHi; ny++) {
        const sk = (ny - y + r) * (2 * r + 1) + r;
        for (let nx = xLo; nx <= xHi; nx++) {
          const nIdx = (ny * w + nx) * 3;
          const dr = source[nIdx] - cr;
          const dg = source[nIdx + 1] - cg;
          const db = source[nIdx + 2] - cb;
          const dist = dr * dr + dg * dg + db * db;

          const weight = spatial[sk + (nx - x)] * rangeTable[dist];
          rSum += source[nIdx] * weight;
          gSum += source[nIdx + 1] * weight;
          bSum += source[nIdx + 2] * weight;
          wSum += weight;
        }
      }

      if (wSum <= 0) continue;
      data[idx] = clamp255(cr + (rSum / wSum - cr) * blend);
      data[idx + 1] = clamp255(cg + (gSum / wSum - cg) * blend);
      data[idx + 2] = clamp255(cb + (bSum / wSum - cb) * blend);
    }
  }

  return `radius ${r}, range sigma ${rangeSigma}, blend ${blend}`;
}

/**
 * Separates ink from paper with a monotonic curve anchored on the substrate.
 *
 * Working in "contrast below paper" rather than absolute luminance is what
 * keeps this faithful: a pixel sitting at the substrate is a fixed point, so
 * the background tone the scan actually has is preserved exactly.
 *
 * The curve has a second fixed point at `contrastPivot`. Below it lies scanner
 * haze and bleed-through, which is pushed toward the paper; above it lies real
 * content, which is deepened. Placing the pivot beneath the faintest genuine
 * marking is what stops pencil annotations and light halftones from being
 * washed away — a symmetric curve pivoted at mid-grey would lighten exactly
 * that content. Both halves are monotonic, so the curve can only redistribute
 * levels that already exist; it cannot manufacture a stroke.
 */
export function applyInkPaperCurve(
  img: RgbImage,
  paper: PaperTone,
  params: PipelineParams
): string {
  const { data } = img;
  const paperLum = Math.max(1, paper.luminance);
  const pivot = params.contrastPivot;
  // Strength drives the exponent on both halves; 1 is a no-op passthrough.
  const exponent = 1 + params.contrastStrength * 1.5;

  const lumMap = new Float32Array(256);
  for (let l = 0; l < 256; l++) {
    const d = Math.max(0, Math.min(1, (paperLum - l) / paperLum));
    let out: number;
    if (d <= pivot) {
      // Concave below the pivot: haze collapses toward the paper tone.
      out = pivot * Math.pow(d / pivot, exponent);
    } else {
      // Convex above it: real content is pulled toward full density.
      const t = (d - pivot) / (1 - pivot);
      out = pivot + (1 - pivot) * (1 - Math.pow(1 - t, exponent));
    }
    lumMap[l] = paperLum * (1 - out);
  }

  // The curve is derived purely from luminance, so applying it at full
  // strength to a saturated pixel changes more than density: scaling every
  // channel by the same ratio pushes the channel already nearest 255 into
  // its clamp first, compressing the gap between channels less than the
  // gap to paper grows, which reads as the colour turning more vivid. Ink,
  // pencil and paper haze are all close to neutral, so this only bites
  // coloured print - highlighter, callout fills, table shading - which is
  // exactly the content that should be left alone. The chroma reference is
  // the paper's own saturation, so a warm or yellowed substrate does not
  // itself get treated as "coloured".
  const paperChroma =
    Math.max(paper.r, paper.g, paper.b) - Math.min(paper.r, paper.g, paper.b);
  const NEUTRAL_MARGIN = 10;
  const CHROMA_SOFTNESS = 40;

  for (let i = 0; i < data.length; i += 3) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const l = luma(r, g, b);
    if (l >= paperLum) continue; // Brighter than paper: leave untouched.

    const ratio = lumMap[Math.round(l)] / Math.max(1, l);

    const chroma = Math.max(r, g, b) - Math.min(r, g, b);
    const excess = Math.max(0, chroma - paperChroma - NEUTRAL_MARGIN);
    const chromaFactor = 1 / (1 + excess / CHROMA_SOFTNESS);
    const effectiveRatio = 1 + (ratio - 1) * chromaFactor;

    // A shared per-pixel ratio preserves hue, so coloured print, highlights
    // and pencil keep their identity instead of drifting toward grey; the
    // chroma factor above controls how much of that ratio actually applies.
    data[i] = clampFloor(r * effectiveRatio, params.contrastFloor);
    data[i + 1] = clampFloor(g * effectiveRatio, params.contrastFloor);
    data[i + 2] = clampFloor(b * effectiveRatio, params.contrastFloor);
  }

  return `strength ${params.contrastStrength}, pivot ${pivot}, anchored at paper luminance ${paperLum}`;
}

/** Separable Gaussian blur over one interleaved RGB channel set. */
function gaussianBlur(src: Uint8Array, w: number, h: number, radius: number): Float32Array {
  const sigma = Math.max(0.5, radius);
  const taps = Math.max(1, Math.ceil(sigma * 2));
  const kernel = new Float32Array(taps * 2 + 1);
  let sum = 0;
  for (let i = -taps; i <= taps; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel[i + taps] = v;
    sum += v;
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;

  const horizontal = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let t = -taps; t <= taps; t++) {
        const sx = Math.min(w - 1, Math.max(0, x + t));
        const idx = (y * w + sx) * 3;
        const kv = kernel[t + taps];
        r += src[idx] * kv;
        g += src[idx + 1] * kv;
        b += src[idx + 2] * kv;
      }
      const o = (y * w + x) * 3;
      horizontal[o] = r;
      horizontal[o + 1] = g;
      horizontal[o + 2] = b;
    }
  }

  const out = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let t = -taps; t <= taps; t++) {
        const sy = Math.min(h - 1, Math.max(0, y + t));
        const idx = (sy * w + x) * 3;
        const kv = kernel[t + taps];
        r += horizontal[idx] * kv;
        g += horizontal[idx + 1] * kv;
        b += horizontal[idx + 2] * kv;
      }
      const o = (y * w + x) * 3;
      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = b;
    }
  }

  return out;
}

/**
 * Unsharp mask, hard-clamped to each pixel's own 3x3 neighbourhood.
 *
 * The clamp is the important part. Unclamped sharpening overshoots into bright
 * halos and black fringes around glyphs — artefacts that read as marks that
 * were never on the page. Restricting every result to a range some neighbour
 * already occupied (plus a small epsilon) bounds the change provably, so
 * sharpening cannot introduce a feature the scan did not contain.
 */
export function unsharpMask(img: RgbImage, params: PipelineParams): string {
  const { width: w, height: h, data } = img;
  const source = new Uint8Array(data);
  const blurred = gaussianBlur(source, w, h, params.sharpenRadius);
  const amount = params.sharpenAmount;
  const eps = params.sharpenClampEpsilon;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 3;

      for (let c = 0; c < 3; c++) {
        const original = source[idx + c];
        const sharpened = original + (original - blurred[idx + c]) * amount;

        let lo = 255;
        let hi = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const v = source[((y + dy) * w + (x + dx)) * 3 + c];
            if (v < lo) lo = v;
            if (v > hi) hi = v;
          }
        }

        data[idx + c] = clamp255(Math.max(lo - eps, Math.min(hi + eps, sharpened)));
      }
    }
  }

  return `amount ${amount}, radius ${params.sharpenRadius}, clamped to local range +/-${eps}`;
}

/**
 * Corrects a page-wide colour-cast mismatch between an image's background and
 * a target paper tone.
 *
 * A generative model has no obligation to keep the substrate colour it was
 * given, and in practice drifts cream or grey paper toward neutral white.
 * This is a single per-channel gain - a diagonal colour correction - rather
 * than a local one, so it fixes a page-wide cast without introducing the
 * seams a block-wise correction could. Ink sits close to zero, so the same
 * gain barely moves it, while paper - close to the multiplier's effective
 * fixed point - moves the most; genuine contrast is not flattened in the
 * process. Gains are clamped, so a wildly different image cannot be dragged
 * arbitrarily far from what it actually shows.
 */
export function correctPaperTone(img: RgbImage, target: PaperTone, current: PaperTone): string {
  const { data } = img;
  const clampGain = (g: number) => Math.max(0.6, Math.min(1.6, g));
  const gainR = clampGain(target.r / Math.max(1, current.r));
  const gainG = clampGain(target.g / Math.max(1, current.g));
  const gainB = clampGain(target.b / Math.max(1, current.b));

  for (let i = 0; i < data.length; i += 3) {
    data[i] = clamp255(data[i] * gainR);
    data[i + 1] = clamp255(data[i + 1] * gainG);
    data[i + 2] = clamp255(data[i + 2] * gainB);
  }

  return `gain r${gainR.toFixed(2)} g${gainG.toFixed(2)} b${gainB.toFixed(2)}`;
}

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

function clampFloor(v: number, floor: number): number {
  const r = Math.round(v);
  return r < floor ? floor : r > 255 ? 255 : r;
}
