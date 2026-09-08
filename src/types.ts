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
