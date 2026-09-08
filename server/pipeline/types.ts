/**
 * Shared types for the deterministic scan-restoration pipeline.
 *
 * Every stage here is a pure function of its input pixels and a frozen
 * parameter set. No randomness, no sampling, no model inference: the same
 * input bytes always produce the same output bytes.
 */

/** Raw interleaved RGB pixels, 3 channels, 8 bits per channel. */
export interface RgbImage {
  data: Uint8Array;
  width: number;
  height: number;
}

/** Measured paper characteristics, used to keep the restored page faithful. */
export interface PaperTone {
  /** Luminance of the page substrate, 0-255. */
  luminance: number;
  /** Substrate colour, preserved verbatim so a yellowed page stays yellowed. */
  r: number;
  g: number;
  b: number;
}

/**
 * Frozen pipeline parameters.
 *
 * Deliberately constants rather than user-facing sliders: the point of this
 * engine is that two runs over one scan cannot diverge. Editing any value here
 * changes every future output, so bump PIPELINE_VERSION when you do.
 */
export interface PipelineParams {
  /** Skew smaller than this (degrees) is left alone. */
  deskewMinAngle: number;
  /** Half-width of the skew search, in degrees. */
  deskewMaxAngle: number;
  /** Side of the illumination-estimation blocks, in pixels. */
  illuminationBlockSize: number;
  /** Smoothing passes applied to the illumination field. */
  illuminationSmoothingPasses: number;
  /** Gain limits for illumination correction; bounds how far a pixel moves. */
  illuminationMinGain: number;
  illuminationMaxGain: number;
  /** Bilateral denoise: spatial radius in pixels. */
  denoiseRadius: number;
  /** Bilateral denoise: intensity falloff. Higher smooths across more contrast. */
  denoiseRangeSigma: number;
  /** Bilateral denoise: blend against the original pixel, 0-1. */
  denoiseStrength: number;
  /** Contrast curve: extra ink/paper separation, 0-1. */
  contrastStrength: number;
  /** Contrast curve fixed point, as a fraction of substrate luminance.
   *  Content darker than this is deepened; anything lighter is treated as
   *  haze and lifted. Set it below the faintest real content on the page. */
  contrastPivot: number;
  /** Never drive a pixel below this; guards against crushing faint content. */
  contrastFloor: number;
  /** Unsharp mask amount. */
  sharpenAmount: number;
  /** Unsharp mask blur radius in pixels. */
  sharpenRadius: number;
  /** Unsharp overshoot allowed beyond the local 3x3 range, in levels. */
  sharpenClampEpsilon: number;
  /** Output scale factor, applied last via Lanczos-3. */
  upscale: number;
}

/**
 * Per-stage timing plus what the stage measured. Surfaced to the UI so an
 * operator can see exactly what was done to the page.
 */
export interface StageReport {
  name: string;
  ms: number;
  detail: string;
}

/**
 * Deterministic self-check comparing the restored page against the source.
 *
 * Not a model judging its own work: every number is a direct pixel
 * measurement, so it is reproducible and cannot flatter the result.
 */
export interface FidelityReport {
  /** Pixels that are ink in the output but were paper in the source. */
  addedInkRatio: number;
  /** Pixels that were ink in the source but are paper in the output. */
  lostInkRatio: number;
  /** Size of the biggest contiguous invented mark, in pixels.
   *  This is the primary invention signal: a single hallucinated tick is a
   *  compact blob but a negligible fraction of a full page, so a page-wide
   *  ratio cannot see it while a cluster measurement can. */
  largestAddedCluster: number;
  /** Size of the biggest contiguous erased mark, in pixels. */
  largestLostCluster: number;
  /** Number of invented clusters above the reportable size. */
  addedClusterCount: number;
  /** Number of erased clusters above the reportable size. */
  lostClusterCount: number;
  /** Worst local erasure: the largest fraction of content removed from any one
   *  tile of the page. Erasing a table row fragments into specks too small to
   *  cluster, but wipes out nearly everything in the tiles it covers. */
  worstBlockLossRatio: number;
  /** Absolute shift in measured paper luminance, in levels. */
  paperToneDelta: number;
  /** Block-wise correlation of edge maps, 0-1. Layout drift drops this. */
  structuralCorrelation: number;
  /** True when every check is inside tolerance. */
  passed: boolean;
  /** Explanation of any check that fell outside tolerance. */
  warnings: string[];
}

export interface EnhanceResult {
  /** PNG data URL of the restored page. */
  enhancedUrl: string;
  width: number;
  height: number;
  size: number;
  /** Skew correction actually applied, in degrees. */
  deskewAngle: number;
  paperTone: PaperTone;
  stages: StageReport[];
  fidelity: FidelityReport;
  pipelineVersion: string;
}
