import React, { useRef, useState } from 'react';
import { Upload, Image as ImageIcon, Sparkles, FolderUp, CheckCircle2 } from 'lucide-react';

interface UploadDropzoneProps {
  onFilesSelected: (files: FileList | File[]) => void;
  onLoadSamples: () => void;
  hasImages: boolean;
}

export const UploadDropzone: React.FC<UploadDropzoneProps> = ({
  onFilesSelected,
  onLoadSamples,
  hasImages,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
      e.target.value = ''; // Reset to allow re-upload of same file name
    }
  };

  if (hasImages) {
    return (
      <div
        id="compact-dropzone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`group relative flex items-center justify-between px-5 py-3 rounded-xl border border-dashed cursor-pointer transition-all duration-200 ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50/50'
            : 'border-slate-300 hover:border-slate-400 bg-white shadow-xs'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/png, image/jpeg, image/webp, image/bmp, image/gif"
          className="hidden"
          onChange={handleFileInput}
        />
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
            <Upload className="w-4 h-4" />
          </div>
          <div>
            <span className="text-sm font-medium text-slate-800">
              Drag & drop more images here, or{' '}
              <span className="text-indigo-600 underline underline-offset-2">browse files</span>
            </span>
            <span className="text-xs text-slate-500 ml-2 hidden sm:inline">
              Supports PNG, JPG, WEBP, BMP up to 50MB
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onLoadSamples();
          }}
          className="text-xs font-medium text-slate-600 hover:text-indigo-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-indigo-200 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Load Test Samples</span>
        </button>
      </div>
    );
  }

  return (
    <div
      id="hero-dropzone"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-200 bg-white ${
        isDragging
          ? 'border-indigo-500 bg-indigo-50/40 ring-4 ring-indigo-500/10'
          : 'border-slate-200 hover:border-slate-300 shadow-sm'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/png, image/jpeg, image/webp, image/bmp, image/gif"
        className="hidden"
        onChange={handleFileInput}
      />

      <div className="max-w-md mx-auto flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-5 shadow-inner">
          <FolderUp className="w-8 h-8 stroke-[1.75]" />
        </div>

        <h3 className="text-xl font-semibold text-slate-900 tracking-tight mb-2">
          Upload images to enhance &amp; organize
        </h3>

        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          Drag and drop multiple photos here, or select files from your device. Enhance resolution, eliminate digital noise, remove duplicates, and export to PDF.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            id="browse-files-button"
            type="button"
            onClick={() => inputRef.current?.click()}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm shadow-sm hover:shadow transition-all flex items-center gap-2 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Select Images</span>
          </button>

          <button
            id="load-samples-button"
            type="button"
            onClick={onLoadSamples}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm transition-all flex items-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Try Sample Photos</span>
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-center gap-6 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            Bilateral Noise Removal
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            2× / 4× Super-Resolution
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            Perceptual Duplicate Detection
          </span>
        </div>
      </div>
    </div>
  );
};
