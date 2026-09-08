/**
 * Result of comparing a restored page against its source.
 *
 * Mirrors the server contract in server/pipeline/types.ts. The deterministic
 * engine always produces one; the AI engine produces one only once its output
 * has been checked, since a generative model cannot guarantee fidelity by
 * construction the way a filter pipeline can.
 */
export interface FidelityReport {
  addedInkRatio: number;
  lostInkRatio: number;
  largestAddedCluster: number;
  largestLostCluster: number;
  addedClusterCount: number;
  lostClusterCount: number;
  worstBlockLossRatio: number;
  paperToneDelta: number;
  structuralCorrelation: number;
  passed: boolean;
  warnings: string[];
}

export interface PaperTone {
  r: number;
  g: number;
  b: number;
  luminance: number;
}

export interface StageReport {
  name: string;
  ms: number;
  detail: string;
}

/** Which engine produced a given restoration. */
export type EnhancementEngine = 'deterministic' | 'ai';

/**
 * One engine's output for one page.
 *
 * Both engines can run on the same image and their results are kept side by
 * side, so the user can look at both and pick rather than having the app
 * decide for them.
 */
export interface EnhancementVariant {
  engine: EnhancementEngine;
  url: string;
  width: number;
  height: number;
  size: number;
  createdAt: number;
  /** Present when the output has been verified against the source. */
  fidelity?: FidelityReport;
  deskewAngle?: number;
  paperTone?: PaperTone;
  stages?: StageReport[];
  pipelineVersion?: string;
  /** Free text returned by the model, AI engine only. */
  notes?: string;
}

export interface AIMetrics {
  noiseScore: number; // 0 - 100
  sharpnessScore: number; // 0 - 100
  overallQuality: number; // 0 - 100
  compressionArtifacts: 'Low' | 'Moderate' | 'Heavy';
  recommendation: string;
  detectedFeatures?: string[];
}

export interface EnhancedImageItem {
  id: string;
  name: string;
  fileType: string;
  originalUrl: string;
  originalWidth: number;
  originalHeight: number;
  originalSize: number;
  enhancedUrl?: string;
  vectorSvgUrl?: string;
  enhancedWidth?: number;
  enhancedHeight?: number;
  enhancedSize?: number;
  /** Every engine result held so far, keyed by engine. */
  variants?: Partial<Record<EnhancementEngine, EnhancementVariant>>;
  /** The variant currently mirrored into the enhanced* fields above, and so
   *  the one used for download, ZIP export and PDF compilation. */
  selectedEngine?: EnhancementEngine;
  /** Engine currently running, for per-engine button state. */
  processingEngine?: EnhancementEngine;
  status: 'idle' | 'processing' | 'enhanced' | 'error';
  progress: number;
  errorMessage?: string;
  perceptualHash?: string;
  dHash?: string;
  aiMetrics?: AIMetrics;
  createdAt: number;
}

export interface DuplicatePair {
  id: string;
  imageA: EnhancedImageItem;
  imageB: EnhancedImageItem;
  similarity: number; // 0 - 100%
  exactMatch: boolean;
  recommendedKeepId: string;
  reason: string;
}

export interface PdfExportConfig {
  docTitle: string;
  pageSize: 'a4' | 'letter';
  orientation: 'auto' | 'portrait' | 'landscape';
  layout: 'single' | 'two' | 'grid';
  margin: 'none' | 'compact' | 'normal';
  quality: number; // 0.6 - 0.95
  preferEnhanced: boolean;
  showPageNumbers: boolean;
  showImageCaptions: boolean;
}
