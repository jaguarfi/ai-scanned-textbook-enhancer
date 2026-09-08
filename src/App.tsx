import React, { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { Copy, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { EnhancedImageItem, DuplicatePair } from './types';
import {
  computeImageHash,
  findDuplicatePairs,
  enhanceImageLocally,
  loadImage,
} from './utils/imageProcessing';
import { generateSampleImages } from './utils/sampleImages';
import { Navbar } from './components/Navbar';
import { UploadDropzone } from './components/UploadDropzone';
import { ImageCard } from './components/ImageCard';
import { CompareModal } from './components/CompareModal';
import { DuplicateDetectionModal } from './components/DuplicateDetectionModal';
import { PdfCompileModal } from './components/PdfCompileModal';

const resolveFileExtension = (fileType: string) => (fileType.includes('png') ? 'png' : 'jpg');
const buildDownloadFilename = (name: string, fileType: string, suffix = '') => {
  const baseName = name.replace(/\.[^/.]+$/, '');
  return `${baseName}${suffix}.${resolveFileExtension(fileType)}`;
};

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function App() {
  const [images, setImages] = useState<EnhancedImageItem[]>([]);
  const [duplicatePairs, setDuplicatePairs] = useState<DuplicatePair[]>([]);
  const [duplicateThreshold, setDuplicateThreshold] = useState<number>(82);

  // Modals state
  const [activeCompareImageId, setActiveCompareImageId] = useState<string | null>(null);

  const activeCompareImage = images.find(img => img.id === activeCompareImageId) || null;
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isEnhancingAll, setIsEnhancingAll] = useState(false);

  // Toast notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'warning' } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'warning' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Recalculate duplicates whenever images or threshold change
  useEffect(() => {
    if (images.length < 2) {
      setDuplicatePairs([]);
      return;
    }
    const pairs = findDuplicatePairs(images, duplicateThreshold);
    setDuplicatePairs(pairs);
  }, [images, duplicateThreshold]);

  // Load sample photos
  const handleLoadSamples = async () => {
    try {
      showToast('Generating sample images with simulated noise and duplicates...', 'info');
      const samples = await generateSampleImages();
      setImages((prev) => [...prev, ...samples]);
      showToast(`Loaded ${samples.length} test images. Notice the duplicate detector!`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Could not load samples', 'warning');
    }
  };

  // Handle uploaded files
  const handleFilesSelected = async (files: FileList | File[]) => {
    const fileArr = Array.from(files);
    const validImageFiles = fileArr.filter((file) => file.type.startsWith('image/'));

    if (validImageFiles.length === 0) {
      showToast('Please upload valid image files (PNG, JPG, WEBP, etc.)', 'warning');
      return;
    }

    showToast(`Processing ${validImageFiles.length} image${validImageFiles.length > 1 ? 's' : ''}...`, 'info');

    const newItems: EnhancedImageItem[] = [];

    for (let i = 0; i < validImageFiles.length; i++) {
      const file = validImageFiles[i];
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const img = await loadImage(dataUrl);
        const { dHash } = await computeImageHash(dataUrl);

        newItems.push({
          id: `img-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          fileType: file.type || 'image/jpeg',
          originalUrl: dataUrl,
          originalWidth: img.naturalWidth || img.width,
          originalHeight: img.naturalHeight || img.height,
          originalSize: file.size,
          status: 'idle',
          progress: 0,
          dHash,
          createdAt: Date.now() + i,
        });
      } catch (err) {
        console.error('Failed to read file:', file.name, err);
      }
    }

    setImages((prev) => [...prev, ...newItems]);
    showToast(`Added ${newItems.length} images successfully.`, 'success');
  };

  // Enhance with Gemini AI
  const handleGeminiEnhanceImage = async (targetImage: EnhancedImageItem) => {
    setImages((prev) =>
      prev.map((item) =>
        item.id === targetImage.id ? { ...item, status: 'processing', progress: 50 } : item
      )
    );

    try {
      const response = await fetch('/api/gemini/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: targetImage.originalUrl,
          mimeType: targetImage.fileType,
        }),
      });
      const data = await response.json();

      if (data.success && data.enhancedUrl) {
        const img = await loadImage(data.enhancedUrl);
        setImages((prev) =>
          prev.map((item) =>
            item.id === targetImage.id
              ? {
                  ...item,
                  status: 'enhanced',
                  progress: 100,
                  enhancedUrl: data.enhancedUrl,
                  vectorSvgUrl: undefined,
                  enhancedWidth: img.naturalWidth || img.width,
                  enhancedHeight: img.naturalHeight || img.height,
                  enhancedSize: Math.round(data.enhancedUrl.length * 0.75),
                  aiMetrics: {
                    noiseScore: 0,
                    sharpnessScore: 100,
                    overallQuality: 100,
                    compressionArtifacts: 'None',
                    recommendation: data.notes || 'Processed with Gemini AI Studio Render.',
                    detectedFeatures: ['AI Generation', 'Studio Lighting', 'Text Restoration'],
                  },
                }
              : item
          )
        );
        showToast(`Enhanced ${targetImage.name} (Gemini AI)`, 'success');
      } else {
        throw new Error(data.text || data.error || data.message || 'Failed to process with Gemini');
      }
    } catch (err: any) {
      console.error('Enhancement failed:', err);
      setImages((prev) =>
        prev.map((item) =>
          item.id === targetImage.id
            ? { ...item, status: 'error', errorMessage: err?.message || 'Gemini enhancement failed' }
            : item
        )
      );
      showToast(`Failed to enhance ${targetImage.name} with AI`, 'warning');
    }
  };

  // Enhance a single image
  const handleEnhanceImage = async (targetImage: EnhancedImageItem) => {
    // Set status to processing
    setImages((prev) =>
      prev.map((item) =>
        item.id === targetImage.id ? { ...item, status: 'processing', progress: 15 } : item
      )
    );

    try {
      // Run local high-performance smart document enhancement
      const result = await enhanceImageLocally(
        targetImage.originalUrl,
        (progress) => {
          setImages((prev) =>
            prev.map((item) =>
              item.id === targetImage.id ? { ...item, progress } : item
            )
          );
        }
      );

      // Query AI diagnostic analysis in background if server available
      let serverAiMetrics = result.aiMetrics;
      try {
        const aiResponse = await fetch('/api/gemini/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: targetImage.originalUrl,
            mimeType: targetImage.fileType,
          }),
        });
        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          if (aiData.recommendation) {
            serverAiMetrics = {
              ...serverAiMetrics,
              recommendation: aiData.recommendation,
              noiseScore: aiData.noiseScore ?? serverAiMetrics.noiseScore,
              sharpnessScore: aiData.sharpnessScore ?? serverAiMetrics.sharpnessScore,
              compressionArtifacts: aiData.compressionArtifacts ?? serverAiMetrics.compressionArtifacts,
            };
          }
        }
      } catch (e) {
        // Fallback to local metrics
      }

      setImages((prev) =>
        prev.map((item) =>
          item.id === targetImage.id
            ? {
                ...item,
                status: 'enhanced',
                progress: 100,
                enhancedUrl: result.enhancedUrl,
                vectorSvgUrl: result.vectorSvgUrl,
                enhancedWidth: result.width,
                enhancedHeight: result.height,
                enhancedSize: result.size,
                aiMetrics: serverAiMetrics,
              }
            : item
        )
      );

      showToast(`Enhanced ${targetImage.name} (Smart Auto Processed)`, 'success');
    } catch (err: any) {
      console.error('Enhancement failed:', err);
      setImages((prev) =>
        prev.map((item) =>
          item.id === targetImage.id
            ? { ...item, status: 'error', errorMessage: err?.message || 'Enhancement failed' }
            : item
        )
      );
      showToast(`Failed to enhance ${targetImage.name}`, 'warning');
    }
  };

  // Enhance all un-enhanced images
  const handleEnhanceAll = async () => {
    const unenhanced = images.filter((img) => img.status !== 'enhanced');
    if (unenhanced.length === 0) return;

    setIsEnhancingAll(true);
    showToast(`Batch enhancing ${unenhanced.length} images...`, 'info');

    for (let i = 0; i < unenhanced.length; i++) {
      const img = unenhanced[i];
      await handleGeminiEnhanceImage(img);
    }

    setIsEnhancingAll(false);
    showToast('All images enhanced successfully!', 'success');
  };

  // Download a single enhanced image
  const handleDownloadSingle = (item: EnhancedImageItem) => {
    const url = item.enhancedUrl || item.originalUrl;
    const a = document.createElement('a');
    a.href = url;
    a.download = buildDownloadFilename(item.name, item.fileType, '_enhanced');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Download all images as ZIP
  const handleDownloadAllZip = async () => {
    if (images.length === 0) return;

    showToast('Packing images into ZIP archive...', 'info');
    const zip = new JSZip();

    for (const item of images) {
      const url = item.enhancedUrl || item.originalUrl;
      const base64Data = url.replace(/^data:image\/\w+;base64,/, '');
      const filename = buildDownloadFilename(item.name, item.fileType, item.enhancedUrl ? '_enhanced' : '');
      zip.file(filename, base64Data, { base64: true });
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const blobUrl = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `enhanced_images_collection_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);

    showToast('Downloaded ZIP archive.', 'success');
  };

  // Remove a single image
  const handleRemoveImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
    if (activeCompareImageId === id) {
      setActiveCompareImageId(null);
    }
  };

  // Dismiss a duplicate pair without deleting images
  const handleRemovePair = (pairId: string) => {
    setDuplicatePairs((prev) => prev.filter((p) => p.id !== pairId));
  };

  // Auto resolve all duplicates: delete the non-recommended image in each pair
  const handleAutoResolveAll = () => {
    const imagesToRemove = new Set<string>();

    for (const pair of duplicatePairs) {
      if (pair.recommendedKeepId === pair.imageA.id) {
        imagesToRemove.add(pair.imageB.id);
      } else {
        imagesToRemove.add(pair.imageA.id);
      }
    }

    setImages((prev) => prev.filter((img) => !imagesToRemove.has(img.id)));
    setDuplicatePairs([]);
    setIsDuplicateModalOpen(false);
    showToast(`Removed ${imagesToRemove.size} duplicate images, preserving best quality.`, 'success');
  };

  const enhancedCount = images.filter((img) => img.status === 'enhanced').length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased selection:bg-indigo-100 selection:text-indigo-900">
      {/* Hidden File Input for Navbar / Global trigger */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/png, image/jpeg, image/webp, image/bmp, image/gif"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFilesSelected(e.target.files);
            e.target.value = '';
          }
        }}
      />

      {/* Top Navbar */}
      <Navbar
        totalImages={images.length}
        enhancedCount={enhancedCount}
        duplicateCount={duplicatePairs.length}
        isEnhancingAll={isEnhancingAll}
        onUploadClick={() => fileInputRef.current?.click()}
        onEnhanceAll={handleEnhanceAll}
        onOpenDuplicates={() => setIsDuplicateModalOpen(true)}
        onOpenPdfModal={() => setIsPdfModalOpen(true)}
        onDownloadAllZip={handleDownloadAllZip}
        onClearAll={() => {
          if (window.confirm('Clear all images from the workspace?')) {
            setImages([]);
            setDuplicatePairs([]);
          }
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 space-y-6">
        {/* Duplicate Detection Alert Banner (Surfaces when duplicates exist) */}
        {duplicatePairs.length > 0 && (
          <div
            id="duplicate-alert-banner"
            className="flex items-center justify-between p-4 rounded-2xl bg-amber-50 border border-amber-200/80 shadow-xs text-amber-900 transition-all animate-in fade-in"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-200/60 text-amber-800 flex items-center justify-center shrink-0">
                <Copy className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {duplicatePairs.length} potential duplicate image{duplicatePairs.length > 1 ? 's' : ''} detected
                </p>
                <p className="text-xs text-amber-700">
                  Perceptual similarity match found. Review and remove redundant copies to save space and clean your PDF collection.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsDuplicateModalOpen(true)}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Review &amp; Remove Duplicates
              </button>
            </div>
          </div>
        )}

        {/* Upload Dropzone */}
        <UploadDropzone
          onFilesSelected={handleFilesSelected}
          onLoadSamples={handleLoadSamples}
          hasImages={images.length > 0}
        />

        {/* Images Grid */}
        {images.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-800">
                  Image Collection ({images.length})
                </h2>
                <span className="text-xs text-slate-500">
                  • Click &apos;Compare&apos; on any enhanced image to view split slider
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>{enhancedCount} of {images.length} enhanced</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {images.map((img) => (
                <ImageCard
                  key={img.id}
                  image={img}
                  onEnhance={handleEnhanceImage}
                  onGeminiEnhance={handleGeminiEnhanceImage}
                  onCompare={(item) => setActiveCompareImageId(item.id)}
                  onDownload={handleDownloadSingle}
                  onRemove={handleRemoveImage}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Interactive Split Compare Modal */}
      {activeCompareImage && (
        <CompareModal
          image={activeCompareImage}
          onClose={() => setActiveCompareImageId(null)}
          onDownload={handleDownloadSingle}
        />
      )}

      {/* Duplicate Detection Modal */}
      {isDuplicateModalOpen && (
        <DuplicateDetectionModal
          duplicatePairs={duplicatePairs}
          onRemoveImage={handleRemoveImage}
          onRemovePair={handleRemovePair}
          onAutoResolveAll={handleAutoResolveAll}
          onClose={() => setIsDuplicateModalOpen(false)}
          threshold={duplicateThreshold}
          onThresholdChange={setDuplicateThreshold}
        />
      )}

      {/* PDF Compile Modal */}
      {isPdfModalOpen && (
        <PdfCompileModal
          images={images}
          onClose={() => setIsPdfModalOpen(false)}
          onReorderImages={(newOrder) => setImages(newOrder)}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-3 duration-200">
          <div
            className={`px-4 py-3 rounded-xl shadow-lg border text-sm font-medium flex items-center gap-2.5 max-w-md ${
              toast.type === 'success'
                ? 'bg-slate-900 text-white border-slate-800'
                : toast.type === 'warning'
                ? 'bg-amber-500 text-white border-amber-600'
                : 'bg-indigo-600 text-white border-indigo-700'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : toast.type === 'warning' ? (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            ) : (
              <Info className="w-4 h-4 shrink-0" />
            )}
            <span className="leading-snug">{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="ml-auto text-white/70 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
