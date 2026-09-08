import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  ArrowRight,
  Download,
  Trash2,
  Check,
  Eye,
  Maximize2,
  Loader2,
} from 'lucide-react';
import { EnhancedImageItem } from '../types';
import { formatBytes } from '../utils/imageProcessing';

interface ImageCardProps {
  image: EnhancedImageItem;
  onEnhance: (image: EnhancedImageItem) => void;
  onGeminiEnhance?: (image: EnhancedImageItem) => void;
  onCompare: (image: EnhancedImageItem) => void;
  onDownload: (image: EnhancedImageItem) => void;
  onRemove: (id: string) => void;
}

export const ImageCard: React.FC<ImageCardProps> = ({
  image,
  onEnhance,
  onGeminiEnhance,
  onCompare,
  onDownload,
  onRemove,
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [isHoverPeek, setIsHoverPeek] = useState(false);

  const isEnhanced = image.status === 'enhanced';
  const isProcessing = image.status === 'processing';

  const currentDisplaySrc =
    isEnhanced && !isHoverPeek && image.enhancedUrl
      ? image.enhancedUrl
      : image.originalUrl;

  // Track latest references to avoid effect dependency issues
  const latestImageRef = useRef(image);
  const latestOnEnhanceRef = useRef(onEnhance);

  useEffect(() => {
    latestImageRef.current = image;
    latestOnEnhanceRef.current = onEnhance;
  }, [image, onEnhance]);

  return (
    <div
      id={`image-card-${image.id}`}
      className="group relative bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all duration-200 flex flex-col overflow-hidden"
    >
      {/* Thumbnail Container */}
      <div className="relative w-full h-52 bg-slate-900/5 overflow-hidden flex items-center justify-center select-none">
        <img
          src={currentDisplaySrc}
          alt={image.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          referrerPolicy="no-referrer"
        />

        {/* Status Badge */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10">
          {isEnhanced && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/90 text-white backdrop-blur-sm shadow-xs">
              <Check className="w-3 h-3 stroke-[2.5]" />
              Enhanced
            </span>
          )}

          {isProcessing && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-600/90 text-white backdrop-blur-sm shadow-xs animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" />
              AI Processing...
            </span>
          )}

          {image.status === 'error' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/90 text-white backdrop-blur-sm shadow-xs">
              Error
            </span>
          )}
        </div>

        {/* Peek Original Button if Enhanced */}
        {isEnhanced && (
          <button
            type="button"
            onPointerDown={() => setIsHoverPeek(true)}
            onPointerUp={() => setIsHoverPeek(false)}
            onPointerLeave={() => setIsHoverPeek(false)}
            className="absolute bottom-2.5 right-2.5 z-10 px-2.5 py-1 rounded-lg bg-slate-950/70 hover:bg-slate-950/90 text-white text-[11px] font-medium backdrop-blur-sm transition-all shadow-xs cursor-pointer flex items-center gap-1"
            title="Press and hold to compare with original"
          >
            <Eye className="w-3 h-3" />
            <span>{isHoverPeek ? 'Viewing Original' : 'Hold to Peek Original'}</span>
          </button>
        )}

        {/* Action Overlay buttons */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
          {isEnhanced && (
            <button
              type="button"
              onClick={() => onCompare(image)}
              className="w-8 h-8 rounded-lg bg-white/90 hover:bg-white text-slate-700 hover:text-indigo-600 shadow-xs flex items-center justify-center backdrop-blur-sm transition-colors cursor-pointer"
              title="Split Comparison Slider"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onRemove(image.id)}
            className="w-8 h-8 rounded-lg bg-white/90 hover:bg-rose-50 text-slate-400 hover:text-rose-600 shadow-xs flex items-center justify-center backdrop-blur-sm transition-colors cursor-pointer"
            title="Remove Image"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Processing Progress Bar */}
        {isProcessing && (
          <div className="absolute bottom-0 inset-x-0 h-1.5 bg-slate-200">
            <div
              className="h-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${Math.max(15, image.progress)}%` }}
            />
          </div>
        )}
      </div>

      {/* Card Content Details */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h4
              className="font-medium text-slate-900 text-sm truncate flex-1"
              title={image.name}
            >
              {image.name}
            </h4>
            <span className="text-[11px] font-mono font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
              {formatBytes(isEnhanced && image.enhancedSize ? image.enhancedSize : image.originalSize)}
            </span>
          </div>

          {/* Resolution Badge */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
            <span className="font-mono">
              {image.originalWidth} × {image.originalHeight}
            </span>
            {isEnhanced && (
              <>
                <ArrowRight className="w-3 h-3 text-slate-400" />
                <span className="font-mono text-indigo-600 font-semibold">
                  {image.enhancedWidth} × {image.enhancedHeight}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Card Footer Actions */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 justify-end">
            {isEnhanced ? (
              <>
                <button
                  type="button"
                  onClick={() => onCompare(image)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-indigo-600 border border-slate-200 hover:border-slate-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Compare</span>
                </button>

                <button
                  type="button"
                  onClick={() => onDownload(image)}
                  className="px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </>
            ) : (
              <div className="flex gap-2 w-full flex-col">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => onGeminiEnhance?.(image)}
                  className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-medium shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
                      <span>Gemini AI Render</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
