/**
 * Measurement and verification passes.
 *
 * Nothing in this file modifies pixels. These functions observe the page so
 * the restoration stages can be anchored to what the scan actually contains,
 * and so the result can be checked against the source afterwards.
 */

import { FidelityReport, PaperTone, RgbImage } from './types';

/** Rec. 601 luma. Used consistently everywhere so measurements stay comparable. */
export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Builds a 256-bin luminance histogram of the whole page. */
function luminanceHistogram(img: RgbImage): Uint32Array {
  const hist = new Uint32Array(256);
  const { data } = img;
  for (let i = 0; i < data.length; i += 3) {
    hist[Math.round(luma(data[i], data[i + 1], data[i + 2]))]++;
  }
  return hist;
}

/** Returns the luminance value at the given percentile (0-1). */
function percentileFromHistogram(hist: Uint32Array, total: number, percentile: number): number {
  const target = total * percentile;
  let cumulative = 0;
  for (let v = 0; v < 256; v++) {
    cumulative += hist[v];
    if (cumulative >= target) return v;
  }
  return 255;
}

/**
 * Measures the page substrate.
 *
 * Uses the 90th luminance percentile rather than the maximum: the maximum is
 * a single specular speck or dust mote, whereas the 90th percentile lands
 * firmly inside the paper as long as paper covers more than 10% of the page —
 * safe for any textbook layout, including full-page photographs.
 *
 * The colour is averaged from pixels sitting at that luminance, so the paper's
 * actual cast is captured. Preserving this is what keeps a yellowed page
 * yellowed instead of silently rewriting it to white.
 */
export function measurePaperTone(img: RgbImage): PaperTone {
  const { data } = img;
  const totalPixels = data.length / 3;
  const hist = luminanceHistogram(img);
  const paperLum = percentileFromHistogram(hist, totalPixels, 0.9);

  // Average the colour of pixels sitting near that luminance.
  const lo = paperLum - 6;
  const hi = paperLum + 6;
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 3) {
    const l = luma(data[i], data[i + 1], data[i + 2]);
    if (l >= lo && l <= hi) {
      rSum += data[i];
      gSum += data[i + 1];
      bSum += data[i + 2];
      count++;
    }
  }

  if (count === 0) {
    return { luminance: paperLum, r: paperLum, g: paperLum, b: paperLum };
  }

  return {
    luminance: paperLum,
    r: rSum / count,
    g: gSum / count,
    b: bSum / count,
  };
}

/**
 * Deterministic box-average downsample to a target width, for analysis only.
 * Never feeds the output path, so speed matters more than filter quality.
 */
function downsampleGray(img: RgbImage, targetWidth: number): { gray: Float32Array; w: number; h: number } {
  const factor = Math.max(1, Math.floor(img.width / targetWidth));
  const w = Math.floor(img.width / factor);
  const h = Math.floor(img.height / factor);
  const gray = new Float32Array(w * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let n = 0;
      for (let dy = 0; dy < factor; dy++) {
        const sy = y * factor + dy;
        if (sy >= img.height) break;
        for (let dx = 0; dx < factor; dx++) {
          const sx = x * factor + dx;
          if (sx >= img.width) break;
          const idx = (sy * img.width + sx) * 3;
          sum += luma(img.data[idx], img.data[idx + 1], img.data[idx + 2]);
          n++;
        }
      }
      gray[y * w + x] = n > 0 ? sum / n : 255;
    }
  }

  return { gray, w, h };
}

/**
 * Scores how well text lines align at a given shear angle.
 *
 * Projecting ink onto the vertical axis produces a profile with sharp peaks
 * (text rows) and deep troughs (line gaps) only when the page is level. Sum of
 * squares rewards exactly that peakiness, so the maximising angle is the skew.
 */
function projectionScore(
  ink: Uint8Array,
  w: number,
  h: number,
  angleDeg: number
): number {
  const tan = Math.tan((angleDeg * Math.PI) / 180);
  // Shear can push rows off either end of the profile, so pad both sides.
  const pad = Math.ceil(Math.abs(tan) * w) + 1;
  const profile = new Float64Array(h + 2 * pad);

  for (let y = 0; y < h; y++) {
    const rowBase = y * w;
    for (let x = 0; x < w; x++) {
      if (ink[rowBase + x] === 0) continue;
      const shifted = Math.round(y - x * tan) + pad;
      if (shifted >= 0 && shifted < profile.length) profile[shifted]++;
    }
  }

  let score = 0;
  for (let i = 0; i < profile.length; i++) score += profile[i] * profile[i];
  return score;
}

/**
 * Estimates page skew by coarse-then-fine search over shear angles.
 *
 * Returns degrees; positive means the page is rotated counter-clockwise. The
 * search grid is fixed, so the same scan always yields the same angle.
 */
export function estimateSkew(
  img: RgbImage,
  paper: PaperTone,
  maxAngle: number
): number {
  const { gray, w, h } = downsampleGray(img, 900);

  // Binarise against the measured substrate. A generous margin keeps faint
  // print in the profile while excluding paper texture and scanner haze.
  const inkThreshold = paper.luminance - 25;
  const ink = new Uint8Array(w * h);
  let inkCount = 0;
  for (let i = 0; i < gray.length; i++) {
    if (gray[i] < inkThreshold) {
      ink[i] = 1;
      inkCount++;
    }
  }

  // A page with almost no ink has no text lines to align.
  if (inkCount < gray.length * 0.005) return 0;

  let bestAngle = 0;
  let bestScore = -1;
  for (let a = -maxAngle; a <= maxAngle + 1e-9; a += 0.25) {
    const score = projectionScore(ink, w, h, a);
    if (score > bestScore) {
      bestScore = score;
      bestAngle = a;
    }
  }

  const fineStart = bestAngle - 0.25;
  const fineEnd = bestAngle + 0.25;
  for (let a = fineStart; a <= fineEnd + 1e-9; a += 0.05) {
    const score = projectionScore(ink, w, h, a);
    if (score > bestScore) {
      bestScore = score;
      bestAngle = a;
    }
  }

  // Snap to a fixed grid so floating-point drift can never flip the result.
  return Math.round(bestAngle * 100) / 100;
}

/** Gradient magnitude map, used as a layout fingerprint. */
function edgeMap(img: RgbImage): Float32Array {
  const { width: w, height: h, data } = img;
  const edges = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const idx = i * 3;
      const left = luma(data[idx - 3], data[idx - 2], data[idx - 1]);
      const right = luma(data[idx + 3], data[idx + 4], data[idx + 5]);
      const up = luma(data[idx - w * 3], data[idx - w * 3 + 1], data[idx - w * 3 + 2]);
      const down = luma(data[idx + w * 3], data[idx + w * 3 + 1], data[idx + w * 3 + 2]);
      const gx = right - left;
      const gy = down - up;
      edges[i] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return edges;
}

/**
 * Condenses an edge map into per-tile edge density.
 *
 * Correlating edge maps pixel by pixel measures whether edges land on exactly
 * the same pixels, which ordinary resampling breaks even when the page is
 * untouched. Summing into tiles asks the question that actually matters -
 * whether content still sits in the same places - so it still catches a page
 * that has been stretched, shifted or reflowed, while tolerating a blur.
 */
function tileDensity(edges: Float32Array, w: number, h: number, tile: number): Float32Array {
  const tw = Math.ceil(w / tile);
  const th = Math.ceil(h / tile);
  const out = new Float32Array(tw * th);
  for (let y = 0; y < h; y++) {
    const ty = (y / tile) | 0;
    for (let x = 0; x < w; x++) {
      out[ty * tw + ((x / tile) | 0)] += edges[y * w + x];
    }
  }
  return out;
}

/**
 * Measures connected blobs in a boolean mask.
 *
 * Returns the largest blob and how many exceed `minSize`. Iterative flood fill
 * rather than recursion, since a page-sized region would overflow the stack.
 */
function clusterStats(
  mask: Uint8Array,
  w: number,
  h: number,
  minSize: number
): { largest: number; count: number } {
  const seen = new Uint8Array(mask.length);
  const stack = new Int32Array(mask.length);
  let largest = 0;
  let count = 0;

  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;

    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    let size = 0;

    while (top > 0) {
      const i = stack[--top];
      size++;
      const x = i % w;
      const y = (i / w) | 0;

      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const n = ny * w + nx;
          if (mask[n] && !seen[n]) {
            seen[n] = 1;
            stack[top++] = n;
          }
        }
      }
    }

    if (size > largest) largest = size;
    if (size >= minSize) count++;
  }

  return { largest, count };
}

/** Pearson correlation between two equally sized maps. */
function correlate(a: Float32Array, b: Float32Array): number {
  let meanA = 0;
  let meanB = 0;
  for (let i = 0; i < a.length; i++) {
    meanA += a[i];
    meanB += b[i];
  }
  meanA /= a.length;
  meanB /= b.length;

  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < a.length; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }

  const denom = Math.sqrt(varA * varB);
  return denom < 1e-9 ? 1 : cov / denom;
}

/**
 * Compares the restored page against the source at identical dimensions.
 *
 * Classification is done on contrast relative to each image's own substrate,
 * never on absolute luminance. That distinction matters: the restoration
 * stages deliberately shift levels, so an absolute threshold would report
 * legitimate lighting correction as content loss. Normalised contrast is
 * invariant to exactly the transformations the pipeline is allowed to make,
 * which leaves it sensitive to the one thing being tested — whether marks
 * appeared or disappeared.
 *
 * The two images must share geometry, so this runs before upscaling and after
 * any deskew has been applied to both.
 */
export function verifyFidelity(
  source: RgbImage,
  result: RgbImage,
  sourcePaper: PaperTone,
  resultPaper: PaperTone
): FidelityReport {
  const warnings: string[] = [];

  // A mark counts as content only once it is meaningfully darker than the
  // page. Below that lies glyph anti-aliasing and JPEG ringing, which every
  // stage moves around by design and which would otherwise swamp the signal.
  const CONTENT_CONTRAST = 0.22;
  // A pixel has effectively become paper once its contrast collapses to here.
  const PAPER_CONTRAST = 0.07;

  const srcPaperLum = Math.max(1, sourcePaper.luminance);
  const dstPaperLum = Math.max(1, resultPaper.luminance);

  const w = source.width;
  const h = source.height;
  const total = w * h;

  // Classify both images first, then require connectivity below. A real mark
  // is contiguous; a lone dark pixel is a dust speck or sensor noise, and
  // removing those is the denoiser doing its job rather than losing content.
  const srcContent = new Uint8Array(total);
  const dstContent = new Uint8Array(total);
  const srcBlank = new Uint8Array(total);
  const dstBlank = new Uint8Array(total);

  for (let i = 0; i < total; i++) {
    const o = i * 3;
    const sd =
      (srcPaperLum - luma(source.data[o], source.data[o + 1], source.data[o + 2])) / srcPaperLum;
    const rd =
      (dstPaperLum - luma(result.data[o], result.data[o + 1], result.data[o + 2])) / dstPaperLum;

    if (sd > CONTENT_CONTRAST) srcContent[i] = 1;
    else if (sd < PAPER_CONTRAST) srcBlank[i] = 1;

    if (rd > CONTENT_CONTRAST) dstContent[i] = 1;
    else if (rd < PAPER_CONTRAST) dstBlank[i] = 1;
  }

  /** Counts 8-connected neighbours that share the mask. */
  const neighbours = (mask: Uint8Array, x: number, y: number): number => {
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) {
      const ny = y + dy;
      if (ny < 0 || ny >= h) continue;
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        if (nx < 0 || nx >= w) continue;
        n += mask[ny * w + nx];
      }
    }
    return n;
  };

  // The two tests use deliberately different connectivity requirements.
  //
  // Invention is the dangerous failure for classroom material, so the added
  // test is sensitive: three neighbours is the loosest rule that still rejects
  // dust specks while catching any genuine invented mark.
  //
  // Loss is tested only on interior pixels — those whose whole 3x3 is content.
  // A stroke's outermost ring is anti-aliasing skirt, and cleaning it is what
  // denoising a compressed scan is supposed to do; counting it would swamp the
  // measurement and hide the failure that matters, which is a mark vanishing
  // altogether. An erased glyph loses its interior, so this stays sensitive to
  // real destruction while ignoring fringe thinning.
  const ADDED_MIN_NEIGHBOURS = 3;
  const INTERIOR_NEIGHBOURS = 8;

  let sourceContentPixels = 0;
  let addedInk = 0;
  let lostInk = 0;
  const addedMask = new Uint8Array(total);
  const lostMask = new Uint8Array(total);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;

      if (srcContent[i] && neighbours(srcContent, x, y) === INTERIOR_NEIGHBOURS) {
        sourceContentPixels++;
        // Bare paper where the scan had the inside of a mark: destruction.
        if (dstBlank[i]) {
          lostInk++;
          lostMask[i] = 1;
        }
      }

      // A connected mark where the scan had bare paper: invention.
      if (dstContent[i] && srcBlank[i] && neighbours(dstContent, x, y) >= ADDED_MIN_NEIGHBOURS) {
        addedInk++;
        addedMask[i] = 1;
      }
    }
  }

  // Localised detection. A hallucinated tick is roughly 0.4% of a page's ink,
  // which no page-wide ratio can distinguish from noise, but it is a single
  // compact blob of several hundred pixels and trivially visible as a cluster.
  // MIN_CLUSTER sits above stray fringe pixels and below the smallest mark a
  // reader would notice — around a 12x12 area.
  const MIN_CLUSTER = 120;
  const added = clusterStats(addedMask, w, h, MIN_CLUSTER);
  const lost = clusterStats(lostMask, w, h, MIN_CLUSTER);

  // Erasure needs a different lens than invention. Requiring interior pixels
  // thins each glyph to a few specks, so a wiped-out table row never forms one
  // big blob - but it does remove nearly all the content from the tiles it
  // covers. Tile the page and take the worst local erasure fraction.
  const BLOCK = 32;
  const MIN_BLOCK_CONTENT = 30;
  let worstBlockLossRatio = 0;

  for (let by = 0; by < h; by += BLOCK) {
    for (let bx = 0; bx < w; bx += BLOCK) {
      let blockSource = 0;
      let blockLost = 0;
      const yEnd = Math.min(by + BLOCK, h);
      const xEnd = Math.min(bx + BLOCK, w);

      for (let y = by; y < yEnd; y++) {
        for (let x = bx; x < xEnd; x++) {
          const i = y * w + x;
          if (srcContent[i] && neighbours(srcContent, x, y) === INTERIOR_NEIGHBOURS) {
            blockSource++;
            if (lostMask[i]) blockLost++;
          }
        }
      }

      // Sparse tiles are ignored: a handful of pixels gives a meaningless ratio.
      if (blockSource >= MIN_BLOCK_CONTENT) {
        worstBlockLossRatio = Math.max(worstBlockLossRatio, blockLost / blockSource);
      }
    }
  }

  const base = Math.max(1, sourceContentPixels);
  const addedInkRatio = addedInk / base;
  const lostInkRatio = lostInk / base;
  const paperToneDelta = Math.abs(resultPaper.luminance - sourcePaper.luminance);
  // 8px tiles: far wider than resampling blur, far narrower than any real
  // layout change worth catching.
  const STRUCTURE_TILE = 8;
  const structuralCorrelation = correlate(
    tileDensity(edgeMap(source), w, h, STRUCTURE_TILE),
    tileDensity(edgeMap(result), w, h, STRUCTURE_TILE)
  );

  // Cluster size is the load-bearing check; the ratios are reported alongside
  // it as a secondary signal for diffuse, page-wide drift.
  if (added.largest >= MIN_CLUSTER) {
    warnings.push(
      `A mark of ${added.largest} pixels appears where the scan had blank paper` +
        (added.count > 1 ? `, and ${added.count - 1} more like it.` : '.')
    );
  }
  if (lost.largest >= MIN_CLUSTER) {
    warnings.push(
      `A mark of ${lost.largest} pixels present in the scan has been erased` +
        (lost.count > 1 ? `, and ${lost.count - 1} more like it.` : '.')
    );
  }
  if (worstBlockLossRatio > 0.4) {
    warnings.push(
      `${(worstBlockLossRatio * 100).toFixed(0)}% of the content in one area of the page is missing from the output.`
    );
  }
  if (addedInkRatio > 0.02) {
    warnings.push(
      `${(addedInkRatio * 100).toFixed(2)}% of content is new across the page.`
    );
  }
  if (lostInkRatio > 0.02) {
    warnings.push(
      `${(lostInkRatio * 100).toFixed(2)}% of source content was erased across the page.`
    );
  }
  if (paperToneDelta > 12) {
    warnings.push(
      `Paper tone moved ${paperToneDelta.toFixed(1)} levels - background is not faithful to the scan.`
    );
  }
  if (structuralCorrelation < 0.9) {
    warnings.push(
      `Edge correlation is ${structuralCorrelation.toFixed(3)} - page structure has shifted.`
    );
  }

  return {
    addedInkRatio,
    lostInkRatio,
    largestAddedCluster: added.largest,
    largestLostCluster: lost.largest,
    addedClusterCount: added.count,
    lostClusterCount: lost.count,
    worstBlockLossRatio,
    paperToneDelta,
    structuralCorrelation,
    passed: warnings.length === 0,
    warnings,
  };
}
