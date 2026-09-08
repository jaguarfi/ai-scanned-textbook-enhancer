import React from 'react';
import {
  Sparkles,
  Copy,
  FileText,
  Upload,
  Download,
  Trash2,
  Layers,
  FolderArchive,
  Loader2,
} from 'lucide-react';

interface NavbarProps {
  totalImages: number;
  enhancedCount: number;
  duplicateCount: number;
  isEnhancingAll: boolean;
  onUploadClick: () => void;
  onEnhanceAll: () => void;
  onOpenDuplicates: () => void;
  onOpenPdfModal: () => void;
  onDownloadAllZip: () => void;
  onClearAll: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  totalImages,
  enhancedCount,
  duplicateCount,
  isEnhancingAll,
  onUploadClick,
  onEnhanceAll,
  onOpenDuplicates,
  onOpenPdfModal,
  onDownloadAllZip,
  onClearAll,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand & Stats */}
        <div className="flex items-center justify-between w-full md:w-auto gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 text-base sm:text-lg tracking-tight leading-tight">
                AI Image Enhancer &amp; PDF Studio
              </h1>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Denoise &amp; Super-Resolution</span>
                {totalImages > 0 && (
                  <>
                    <span>•</span>
                    <span className="font-medium text-slate-700">
                      {totalImages} image{totalImages > 1 ? 's' : ''} ({enhancedCount} enhanced)
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Mobile upload trigger */}
          <div className="flex items-center md:hidden gap-1.5">
            <button
              type="button"
              onClick={onUploadClick}
              className="p-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors"
              title="Upload Images"
            >
              <Upload className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Primary Action Buttons */}
        {totalImages > 0 && (
          <div className="flex flex-wrap items-center justify-end gap-2 w-full md:w-auto">
            {/* Upload More button */}
            <button
              id="header-upload-btn"
              type="button"
              onClick={onUploadClick}
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs sm:text-sm transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Upload className="w-4 h-4 text-slate-500" />
              <span>Add Images</span>
            </button>

            {/* Enhance All Button */}
            <button
              id="enhance-all-btn"
              type="button"
              disabled={isEnhancingAll || enhancedCount === totalImages}
              onClick={onEnhanceAll}
              className={`px-4 py-2 rounded-xl font-medium text-xs sm:text-sm shadow-xs transition-all flex items-center gap-2 cursor-pointer ${
                enhancedCount === totalImages
                  ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow'
              }`}
            >
              {isEnhancingAll ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enhancing All...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-indigo-200" />
                  <span>
                    {enhancedCount === 0
                      ? 'Enhance All'
                      : enhancedCount === totalImages
                      ? 'All Enhanced'
                      : `Enhance Remaining (${totalImages - enhancedCount})`}
                  </span>
                </>
              )}
            </button>

            {/* Detect Duplicates Button */}
            <button
              id="detect-duplicates-btn"
              type="button"
              onClick={onOpenDuplicates}
              className={`relative px-3.5 py-2 rounded-xl border font-medium text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer ${
                duplicateCount > 0
                  ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 shadow-2xs'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
              }`}
            >
              <Copy className="w-4 h-4 text-amber-600" />
              <span>Detect Duplicates</span>
              {duplicateCount > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center px-1.5 py-0.5 text-[11px] font-bold leading-none text-white bg-amber-600 rounded-full">
                  {duplicateCount}
                </span>
              )}
            </button>

            {/* Compile to PDF Button (User explicitly requested!) */}
            <button
              id="compile-pdf-btn"
              type="button"
              onClick={onOpenPdfModal}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs sm:text-sm shadow-xs hover:shadow transition-all flex items-center gap-2 cursor-pointer"
            >
              <FileText className="w-4 h-4 text-indigo-300" />
              <span>Compile to PDF</span>
            </button>

            {/* Download All ZIP */}
            <button
              id="download-zip-btn"
              type="button"
              onClick={onDownloadAllZip}
              className="p-2 rounded-xl border border-slate-200 hover:border-slate-300 bg-white text-slate-600 hover:text-slate-900 transition-colors shadow-2xs"
              title="Download All Images as ZIP Archive"
            >
              <FolderArchive className="w-4 h-4" />
            </button>

            {/* Clear All */}
            <button
              id="clear-all-btn"
              type="button"
              onClick={onClearAll}
              className="p-2 rounded-xl border border-slate-200 hover:border-rose-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
              title="Clear all images"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
