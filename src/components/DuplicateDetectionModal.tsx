import React, { useState } from 'react';
import {
  X,
  Copy,
  CheckCircle2,
  Trash2,
  Check,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Layers,
  SlidersHorizontal,
} from 'lucide-react';
import { DuplicatePair, EnhancedImageItem } from '../types';
import { formatBytes } from '../utils/imageProcessing';

interface DuplicateDetectionModalProps {
  duplicatePairs: DuplicatePair[];
  onRemoveImage: (imageId: string) => void;
  onRemovePair: (pairId: string) => void;
  onAutoResolveAll: () => void;
  onClose: () => void;
  threshold: number;
  onThresholdChange: (newThreshold: number) => void;
}

export const DuplicateDetectionModal: React.FC<DuplicateDetectionModalProps> = ({
  duplicatePairs,
  onRemoveImage,
  onRemovePair,
  onAutoResolveAll,
  onClose,
  threshold,
  onThresholdChange,
}) => {
  const [showThresholdSlider, setShowThresholdSlider] = useState(false);

  return (
    <div
      id="duplicate-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="duplicate-modal-container"
        className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Copy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-base">
                Duplicate Image Detection
              </h3>
              <p className="text-xs text-slate-500">
                {duplicatePairs.length === 0
                  ? 'No duplicate or near-duplicate images found'
                  : `Found ${duplicatePairs.length} potential duplicate pair${duplicatePairs.length > 1 ? 's' : ''}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowThresholdSlider(!showThresholdSlider)}
              className={`p-2 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                showThresholdSlider
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
              title="Adjust similarity sensitivity"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Sensitivity ({threshold}%)</span>
            </button>

            {duplicatePairs.length > 0 && (
              <button
                type="button"
                onClick={onAutoResolveAll}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-medium shadow-xs transition-colors flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Auto-Keep Best Quality</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sensitivity slider drawer */}
        {showThresholdSlider && (
          <div className="px-6 py-3 bg-indigo-50/50 border-b border-indigo-100 flex items-center justify-between gap-4 text-xs">
            <span className="text-indigo-900 font-medium">
              Similarity Match Threshold: <span className="font-bold">{threshold}%</span>
            </span>
            <div className="flex items-center gap-3 flex-1 max-w-xs">
              <span className="text-slate-500 text-[11px]">Strict (95%)</span>
              <input
                type="range"
                min="70"
                max="98"
                step="2"
                value={threshold}
                onChange={(e) => onThresholdChange(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
              <span className="text-slate-500 text-[11px]">Loose (70%)</span>
            </div>
          </div>
        )}

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {duplicatePairs.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="text-lg font-semibold text-slate-900 mb-1">
                Zero Duplicates Detected!
              </h4>
              <p className="text-sm text-slate-600 max-w-sm mx-auto mb-6">
                All uploaded images appear to be distinct based on perceptual hashing at {threshold}% similarity.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors"
              >
                Return to Gallery
              </button>
            </div>
          ) : (
            duplicatePairs.map((pair, idx) => {
              const { imageA, imageB, similarity, recommendedKeepId, reason } = pair;
              const isARecommended = recommendedKeepId === imageA.id;
              const isBRecommended = recommendedKeepId === imageB.id;

              return (
                <div
                  key={pair.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:border-slate-300 transition-all"
                >
                  {/* Pair Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500">
                        Pair #{idx + 1}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                        {similarity}% Similarity
                      </span>
                      {similarity === 100 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-100 text-rose-700">
                          Exact Duplicate
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-500 flex items-center gap-1">
                      <span className="font-medium text-slate-700">AI Advice:</span>
                      <span>{reason}</span>
                    </div>
                  </div>

                  {/* Side-by-Side Comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {/* Image A */}
                    <div
                      className={`relative p-3 rounded-xl border transition-all ${
                        isARecommended
                          ? 'border-emerald-300 bg-emerald-50/20 ring-2 ring-emerald-500/15'
                          : 'border-slate-200 bg-slate-50/50'
                      }`}
                    >
                      {isARecommended && (
                        <div className="absolute top-2 right-2 z-10 bg-emerald-600 text-white text-[11px] font-medium px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Recommended to Keep
                        </div>
                      )}

                      <div className="w-full h-44 rounded-lg overflow-hidden bg-slate-900/5 flex items-center justify-center mb-3">
                        <img
                          src={imageA.enhancedUrl || imageA.originalUrl}
                          alt={imageA.name}
                          className="max-h-full max-w-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>

                      <div className="space-y-1">
                        <p className="font-medium text-slate-900 text-xs truncate" title={imageA.name}>
                          {imageA.name}
                        </p>
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>
                            {imageA.originalWidth} × {imageA.originalHeight} px
                          </span>
                          <span>{formatBytes(imageA.originalSize)}</span>
                          {imageA.status === 'enhanced' && (
                            <span className="text-indigo-600 font-medium flex items-center gap-0.5">
                              <Sparkles className="w-3 h-3" /> Enhanced
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => {
                            // Keep A, remove B
                            onRemoveImage(imageB.id);
                            onRemovePair(pair.id);
                          }}
                          className="w-full py-1.5 px-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Keep this (Remove other)</span>
                        </button>
                      </div>
                    </div>

                    {/* Image B */}
                    <div
                      className={`relative p-3 rounded-xl border transition-all ${
                        isBRecommended
                          ? 'border-emerald-300 bg-emerald-50/20 ring-2 ring-emerald-500/15'
                          : 'border-slate-200 bg-slate-50/50'
                      }`}
                    >
                      {isBRecommended && (
                        <div className="absolute top-2 right-2 z-10 bg-emerald-600 text-white text-[11px] font-medium px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Recommended to Keep
                        </div>
                      )}

                      <div className="w-full h-44 rounded-lg overflow-hidden bg-slate-900/5 flex items-center justify-center mb-3">
                        <img
                          src={imageB.enhancedUrl || imageB.originalUrl}
                          alt={imageB.name}
                          className="max-h-full max-w-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>

                      <div className="space-y-1">
                        <p className="font-medium text-slate-900 text-xs truncate" title={imageB.name}>
                          {imageB.name}
                        </p>
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>
                            {imageB.originalWidth} × {imageB.originalHeight} px
                          </span>
                          <span>{formatBytes(imageB.originalSize)}</span>
                          {imageB.status === 'enhanced' && (
                            <span className="text-indigo-600 font-medium flex items-center gap-0.5">
                              <Sparkles className="w-3 h-3" /> Enhanced
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => {
                            // Keep B, remove A
                            onRemoveImage(imageA.id);
                            onRemovePair(pair.id);
                          }}
                          className="w-full py-1.5 px-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Keep this (Remove other)</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Dismiss option */}
                  <div className="flex items-center justify-end gap-2 pt-2 text-xs">
                    <button
                      type="button"
                      onClick={() => onRemovePair(pair.id)}
                      className="text-slate-500 hover:text-slate-800 px-3 py-1 rounded hover:bg-slate-100 transition-colors"
                    >
                      Keep Both (Ignore Pair)
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Duplicate detection uses perceptual difference hashing (dHash 64-bit).
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-medium transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
