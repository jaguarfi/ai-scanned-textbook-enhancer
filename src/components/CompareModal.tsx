import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Download,
  ZoomIn,
  ZoomOut,
  Sparkles,
  ArrowLeftRight,
  RotateCcw,
  ShieldCheck,
  Move,
  FileCode,
} from 'lucide-react';
import { EnhancedImageItem } from '../types';
import { formatBytes } from '../utils/imageProcessing';

interface CompareModalProps {
  image: EnhancedImageItem;
  onClose: () => void;
  onDownload: (image: EnhancedImageItem) => void;
}

export const CompareModal: React.FC<CompareModalProps> = ({
  image,
  onClose,
  onDownload,
}) => {
  const [sliderPos, setSliderPos] = useState(50); // percentage 0-100
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  const [viewMode, setViewMode] = useState<'split' | 'side-by-side'>('split');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const sideBySideLeftRef = useRef<HTMLDivElement>(null);
  const sideBySideRightRef = useRef<HTMLDivElement>(null);

  const enhancedSrc = image.enhancedUrl || image.originalUrl;
  const originalSrc = image.originalUrl;

  const updateSlider = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const pct = (x / rect.width) * 100;
    setSliderPos(pct);
  };

  const handleZoomChange = (newZoom: number) => {
    const clamped = Math.min(3, Math.max(1, Math.round(newZoom * 10) / 10));
    setZoomLevel(clamped);
    if (clamped === 1) {
      setPanOffset({ x: 0, y: 0 });
    }
  };

  // Synchronous Pan Handler when Zoomed
  const handlePanPointerDown = (e: React.PointerEvent) => {
    if (zoomLevel <= 1) return;
    // If clicking slider handle in split view, let slider handle it
    if (viewMode === 'split' && (e.target as HTMLElement).closest('.slider-divider-handle')) {
      return;
    }
    setIsPanning(true);
    setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePanPointerMove = (e: React.PointerEvent) => {
    if (!isPanning || zoomLevel <= 1) return;
    const maxPan = (zoomLevel - 1) * 350;
    const newX = Math.max(-maxPan, Math.min(maxPan, e.clientX - panStart.x));
    const newY = Math.max(-maxPan, Math.min(maxPan, e.clientY - panStart.y));
    setPanOffset({ x: newX, y: newY });
  };

  const handlePanPointerUp = (e: React.PointerEvent) => {
    if (isPanning) {
      setIsPanning(false);
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    }
  };

  // Split Slider drag listener
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingSlider) return;
      updateSlider(e.clientX);
    };

    const handlePointerUp = () => {
      setIsDraggingSlider(false);
    };

    if (isDraggingSlider) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDraggingSlider]);

  return (
    <div
      id="compare-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="compare-modal-container"
        className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900 text-base leading-snug truncate max-w-xs sm:max-w-md">
                  {image.name}
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  Content Preserved
                </span>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                <span>Original: {image.originalWidth} × {image.originalHeight}px</span>
                <span>•</span>
                <span className="text-indigo-600 font-medium">
                  Enhanced: {image.enhancedWidth || image.originalWidth} × {image.enhancedHeight || image.originalHeight}px
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex bg-slate-200/70 p-0.5 rounded-lg text-xs font-medium text-slate-700">
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  viewMode === 'split' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Split Slider
              </button>
              <button
                type="button"
                onClick={() => setViewMode('side-by-side')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  viewMode === 'side-by-side' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Side-by-Side
              </button>
            </div>

            {/* Universal Zoom Controls (Works for Both Split and Side-by-Side) */}
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200/80 select-none">
              <button
                type="button"
                onClick={() => handleZoomChange(zoomLevel - 0.5)}
                disabled={zoomLevel <= 1}
                className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent rounded hover:bg-slate-200/60 cursor-pointer disabled:cursor-not-allowed transition-colors"
                title="Zoom out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => handleZoomChange(1)}
                className="w-12 h-7 flex items-center justify-center text-xs font-mono font-medium text-slate-700 hover:text-indigo-600 hover:bg-white rounded transition-colors cursor-pointer"
                title={zoomLevel > 1 ? 'Click to reset zoom to 100%' : 'Current zoom 100%'}
              >
                {Math.round(zoomLevel * 100)}%
              </button>

              <button
                type="button"
                onClick={() => handleZoomChange(zoomLevel + 0.5)}
                disabled={zoomLevel >= 3}
                className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent rounded hover:bg-slate-200/60 cursor-pointer disabled:cursor-not-allowed transition-colors"
                title="Zoom in (up to 300% to inspect text and fine details)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => handleZoomChange(1)}
                disabled={zoomLevel <= 1}
                className={`w-7 h-7 flex items-center justify-center rounded border-l border-slate-200/80 transition-colors ${
                  zoomLevel > 1
                    ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 cursor-pointer'
                    : 'text-slate-300 opacity-30 cursor-not-allowed'
                }`}
                title={zoomLevel > 1 ? 'Reset zoom to 100%' : 'Zoom is at 100%'}
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Comparison Stage with Pan and Synchronized Zoom */}
        <div
          className={`relative flex-1 bg-slate-950 overflow-hidden flex items-center justify-center p-4 min-h-[380px] sm:min-h-[500px] select-none ${
            zoomLevel > 1 ? 'cursor-grab active:cursor-grabbing' : ''
          }`}
          onPointerDown={handlePanPointerDown}
          onPointerMove={handlePanPointerMove}
          onPointerUp={handlePanPointerUp}
        >
          {/* Zoom & Pan Guidance Overlay Badge */}
          {zoomLevel > 1 && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-slate-900/90 text-white text-xs font-medium px-3 py-1 rounded-full shadow-lg border border-slate-700 backdrop-blur-sm flex items-center gap-1.5 pointer-events-none animate-in fade-in">
              <Move className="w-3 h-3 text-indigo-400" />
              <span>Zoom {Math.round(zoomLevel * 100)}% • Drag anywhere to pan synchronously</span>
            </div>
          )}

          {viewMode === 'split' ? (
            /* Split Slider View */
            <div
              ref={containerRef}
              className="relative max-w-full max-h-[65vh] select-none cursor-ew-resize overflow-hidden rounded-lg shadow-2xl"
              style={{
                transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`,
                transformOrigin: 'center center',
                transition: isDraggingSlider || isPanning ? 'none' : 'transform 0.15s ease-out',
              }}
              onPointerDown={(e) => {
                if (zoomLevel <= 1) {
                  setIsDraggingSlider(true);
                  updateSlider(e.clientX);
                }
              }}
            >
              {/* Enhanced Image (Base) */}
              <img
                src={enhancedSrc}
                alt="AI Enhanced"
                className="block max-w-full max-h-[65vh] object-contain pointer-events-none"
                referrerPolicy="no-referrer"
              />

              {/* Original Image (Clipped Overlay) */}
              <div
                className="absolute inset-0 overflow-hidden pointer-events-none"
                style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
              >
                <img
                  src={originalSrc}
                  alt="Original"
                  className="block max-w-full max-h-[65vh] object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Divider Line & Handle */}
              <div
                className="slider-divider-handle absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.7)] cursor-ew-resize pointer-events-auto"
                style={{ left: `${sliderPos}%` }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setIsDraggingSlider(true);
                }}
              >
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white shadow-lg border border-slate-200 flex items-center justify-center text-slate-700 hover:scale-110 active:scale-95 transition-transform">
                  <ArrowLeftRight className="w-4 h-4 stroke-[2]" />
                </div>
              </div>

              {/* Labels */}
              <div className="absolute top-3 left-3 bg-slate-950/70 backdrop-blur-md text-white text-xs font-medium px-2.5 py-1 rounded-md shadow-xs pointer-events-none">
                Original Image
              </div>
              <div className="absolute top-3 right-3 bg-indigo-600/90 backdrop-blur-md text-white text-xs font-medium px-2.5 py-1 rounded-md shadow-xs pointer-events-none flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                AI Enhanced
              </div>
            </div>
          ) : (
            /* Side-by-Side View with Synchronized Zoom & Pan */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-h-[65vh] overflow-hidden">
              {/* Original Left Panel */}
              <div
                ref={sideBySideLeftRef}
                className="relative rounded-xl overflow-hidden bg-slate-950/90 flex flex-col items-center justify-center p-2 border border-slate-800"
              >
                <div className="absolute top-2.5 left-2.5 z-20 bg-slate-900/90 text-white text-xs px-2.5 py-1 rounded-md shadow-sm border border-slate-700">
                  Original ({image.originalWidth} × {image.originalHeight})
                </div>
                <div
                  className="w-full h-full flex items-center justify-center transition-transform"
                  style={{
                    transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`,
                    transformOrigin: 'center center',
                    transition: isPanning ? 'none' : 'transform 0.15s ease-out',
                  }}
                >
                  <img
                    src={originalSrc}
                    alt="Original"
                    className="max-h-[55vh] object-contain pointer-events-none"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>

              {/* Enhanced Right Panel */}
              <div
                ref={sideBySideRightRef}
                className="relative rounded-xl overflow-hidden bg-slate-950/90 flex flex-col items-center justify-center p-2 border border-indigo-900/60"
              >
                <div className="absolute top-2.5 left-2.5 z-20 bg-indigo-600 text-white text-xs px-2.5 py-1 rounded-md flex items-center gap-1 font-medium shadow-sm border border-indigo-400/40">
                  <Sparkles className="w-3 h-3" />
                  Enhanced ({image.enhancedWidth || image.originalWidth} × {image.enhancedHeight || image.originalHeight})
                </div>
                <div
                  className="w-full h-full flex items-center justify-center transition-transform"
                  style={{
                    transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`,
                    transformOrigin: 'center center',
                    transition: isPanning ? 'none' : 'transform 0.15s ease-out',
                  }}
                >
                  <img
                    src={enhancedSrc}
                    alt="Enhanced"
                    className="max-h-[55vh] object-contain pointer-events-none"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Diagnostic Metrics & Actions Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">Smart Auto Processed</span>
            <span className="text-sm font-medium text-slate-700">{formatBytes(image.enhancedSize || image.originalSize)}</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>

            {image.vectorSvgUrl && (
              <button
                type="button"
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = image.vectorSvgUrl!;
                  const baseName = image.name.replace(/\.[^/.]+$/, '');
                  a.download = `${baseName}_vector_sharp.svg`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
                className="px-3.5 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl shadow-2xs hover:shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                title="Download scalable SVG vector file for infinite zoom clarity"
              >
                <FileCode className="w-4 h-4" />
                <span>Download SVG Vector</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onDownload(image)}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs hover:shadow transition-all flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download PNG</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
