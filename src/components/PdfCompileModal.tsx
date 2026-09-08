import React, { useState } from 'react';
import {
  X,
  FileText,
  Download,
  ArrowUp,
  ArrowDown,
  LayoutGrid,
  Square,
  Columns2,
  Sparkles,
  Check,
  FileDown,
  Loader2,
} from 'lucide-react';
import { EnhancedImageItem, PdfExportConfig } from '../types';
import { compileImagesToPdf } from '../utils/pdfCompiler';

interface PdfCompileModalProps {
  images: EnhancedImageItem[];
  onClose: () => void;
  onReorderImages: (newImages: EnhancedImageItem[]) => void;
}

export const PdfCompileModal: React.FC<PdfCompileModalProps> = ({
  images,
  onClose,
  onReorderImages,
}) => {
  const [config, setConfig] = useState<PdfExportConfig>({
    docTitle: 'Enhanced Images Collection',
    pageSize: 'a4',
    orientation: 'auto',
    layout: 'single',
    margin: 'compact',
    quality: 0.9,
    preferEnhanced: true,
    showPageNumbers: true,
    showImageCaptions: true,
  });

  const [isCompiling, setIsCompiling] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [orderedImages, setOrderedImages] = useState<EnhancedImageItem[]>([...images]);

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newItems = [...orderedImages];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newItems.length) return;
    const temp = newItems[index];
    newItems[index] = newItems[targetIdx];
    newItems[targetIdx] = temp;
    setOrderedImages(newItems);
    onReorderImages(newItems);
  };

  const handleCompileAndDownload = async () => {
    if (orderedImages.length === 0) return;
    setIsCompiling(true);
    setProgress({ current: 0, total: orderedImages.length });

    try {
      const blob = await compileImagesToPdf(orderedImages, config, (current, total) => {
        setProgress({ current, total });
      });

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const sanitizedTitle = (config.docTitle || 'images')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_');
      a.download = `${sanitizedTitle}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onClose();
    } catch (err: any) {
      console.error('PDF compilation failed:', err);
      alert('Failed to compile PDF: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsCompiling(false);
    }
  };

  return (
    <div
      id="pdf-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="pdf-modal-container"
        className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-base">
                Compile Images into PDF Document
              </h3>
              <p className="text-xs text-slate-500">
                Combining {orderedImages.length} image{orderedImages.length > 1 ? 's' : ''} into a high-resolution PDF
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Settings */}
          <div className="lg:col-span-7 space-y-5">
            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Document Title
              </label>
              <input
                type="text"
                value={config.docTitle}
                onChange={(e) => setConfig({ ...config, docTitle: e.target.value })}
                placeholder="e.g. Portfolio_Collection"
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            {/* Layout Options */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Page Layout
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, layout: 'single' })}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer ${
                    config.layout === 'single'
                      ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <Square className="w-5 h-5" />
                  <span className="text-xs font-semibold">1 Image / Page</span>
                  <span className="text-[11px] text-slate-500">Full presentation</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConfig({ ...config, layout: 'two' })}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer ${
                    config.layout === 'two'
                      ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <Columns2 className="w-5 h-5" />
                  <span className="text-xs font-semibold">2 Images / Page</span>
                  <span className="text-[11px] text-slate-500">Split comparison</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConfig({ ...config, layout: 'grid' })}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer ${
                    config.layout === 'grid'
                      ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <LayoutGrid className="w-5 h-5" />
                  <span className="text-xs font-semibold">4 Images (Grid)</span>
                  <span className="text-[11px] text-slate-500">Compact contact sheet</span>
                </button>
              </div>
            </div>

            {/* Orientation & Margins */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Page Orientation
                </label>
                <select
                  value={config.orientation}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      orientation: e.target.value as 'auto' | 'portrait' | 'landscape',
                    })
                  }
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-indigo-500"
                >
                  <option value="auto">Auto (Match Image)</option>
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Margins
                </label>
                <select
                  value={config.margin}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      margin: e.target.value as 'none' | 'compact' | 'normal',
                    })
                  }
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-indigo-500"
                >
                  <option value="compact">Compact (8mm)</option>
                  <option value="normal">Normal (16mm)</option>
                  <option value="none">Full Bleed (0mm)</option>
                </select>
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-medium text-slate-800 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  Prefer AI-Enhanced Images
                </span>
                <input
                  type="checkbox"
                  checked={config.preferEnhanced}
                  onChange={(e) => setConfig({ ...config, preferEnhanced: e.target.checked })}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-medium text-slate-800">
                  Include Page Numbers
                </span>
                <input
                  type="checkbox"
                  checked={config.showPageNumbers}
                  onChange={(e) => setConfig({ ...config, showPageNumbers: e.target.checked })}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-medium text-slate-800">
                  Include Image Captions &amp; Dimensions
                </span>
                <input
                  type="checkbox"
                  checked={config.showImageCaptions}
                  onChange={(e) => setConfig({ ...config, showImageCaptions: e.target.checked })}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Right Column: Image Order List */}
          <div className="lg:col-span-5 bg-slate-50/70 p-4 rounded-xl border border-slate-200 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Page Sequence ({orderedImages.length})
              </span>
              <span className="text-[11px] text-slate-500">Reorder with arrows</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[280px]">
              {orderedImages.map((img, idx) => (
                <div
                  key={img.id}
                  className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 shadow-2xs gap-2"
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <span className="text-xs font-mono font-semibold text-slate-400 w-4 text-center">
                      {idx + 1}
                    </span>
                    <img
                      src={config.preferEnhanced && img.enhancedUrl ? img.enhancedUrl : img.originalUrl}
                      alt={img.name}
                      className="w-9 h-9 object-cover rounded-md border border-slate-100"
                      referrerPolicy="no-referrer"
                    />
                    <div className="overflow-hidden">
                      <p className="text-xs font-medium text-slate-800 truncate max-w-[130px]" title={img.name}>
                        {img.name}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {img.enhancedUrl && config.preferEnhanced ? 'Enhanced' : 'Original'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveItem(idx, 'up')}
                      className="p-1 text-slate-500 hover:text-slate-800 disabled:opacity-30 rounded hover:bg-slate-100"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === orderedImages.length - 1}
                      onClick={() => moveItem(idx, 'down')}
                      className="p-1 text-slate-500 hover:text-slate-800 disabled:opacity-30 rounded hover:bg-slate-100"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Progress Bar if Compiling */}
        {isCompiling && (
          <div className="px-6 py-2 bg-indigo-50 border-t border-indigo-100 flex items-center justify-between">
            <span className="text-xs font-medium text-indigo-800 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
              Compiling page {progress.current} of {progress.total}...
            </span>
            <div className="w-32 bg-indigo-200 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-indigo-600 h-full transition-all duration-200"
                style={{
                  width: `${(progress.current / Math.max(1, progress.total)) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={isCompiling}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleCompileAndDownload}
            disabled={isCompiling || orderedImages.length === 0}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium shadow-sm hover:shadow transition-all flex items-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            {isCompiling ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Compile &amp; Download PDF</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
