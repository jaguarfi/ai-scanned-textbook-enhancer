import { jsPDF } from 'jspdf';
import { EnhancedImageItem, PdfExportConfig } from '../types';
import { loadImage } from './imageProcessing';

export async function compileImagesToPdf(
  images: EnhancedImageItem[],
  config: PdfExportConfig,
  onProgress?: (current: number, total: number) => void
): Promise<Blob> {
  if (!images.length) {
    throw new Error('No images provided for PDF compilation');
  }

  // Determine initial document orientation and format
  const initialOrientation = config.orientation === 'auto' ? 'p' : config.orientation === 'landscape' ? 'l' : 'p';
  const format = config.pageSize === 'letter' ? 'letter' : 'a4';

  const doc = new jsPDF({
    orientation: initialOrientation,
    unit: 'mm',
    format: format,
    compress: true,
  });

  const total = images.length;
  let isFirstPage = true;

  // Margin sizes in mm
  const marginMm = config.margin === 'none' ? 0 : config.margin === 'compact' ? 8 : 16;

  // Helper to add a single page with 1 image
  const addSingleImagePage = async (
    imgItem: EnhancedImageItem,
    srcUrl: string,
    pageIdx: number,
    totalPages: number
  ) => {
    const loadedImg = await loadImage(srcUrl);
    const imgW = loadedImg.naturalWidth || loadedImg.width;
    const imgH = loadedImg.naturalHeight || loadedImg.height;
    const isLandscape = imgW > imgH;

    let pageOrientation: 'p' | 'l' = 'p';
    if (config.orientation === 'auto') {
      pageOrientation = isLandscape ? 'l' : 'p';
    } else {
      pageOrientation = config.orientation === 'landscape' ? 'l' : 'p';
    }

    if (isFirstPage) {
      // Re-configure first page if auto orientation requested
      if (config.orientation === 'auto' && pageOrientation === 'l') {
        doc.deletePage(1);
        doc.addPage(format, 'l');
      }
      isFirstPage = false;
    } else {
      doc.addPage(format, pageOrientation);
    }

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Reserved space for caption / page numbers
    const captionHeight = config.showImageCaptions || config.showPageNumbers ? 12 : 0;
    const availWidth = pageWidth - marginMm * 2;
    const availHeight = pageHeight - marginMm * 2 - captionHeight;

    // Calculate fitted dimensions preserving aspect ratio
    const imgRatio = imgW / imgH;
    let renderW = availWidth;
    let renderH = availWidth / imgRatio;

    if (renderH > availHeight) {
      renderH = availHeight;
      renderW = availHeight * imgRatio;
    }

    const posX = marginMm + (availWidth - renderW) / 2;
    const posY = marginMm + (availHeight - renderH) / 2;

    // Determine format
    const formatType = srcUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
    doc.addImage(srcUrl, formatType, posX, posY, renderW, renderH, undefined, 'FAST');

    // Caption & numbering
    if (config.showImageCaptions || config.showPageNumbers) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(110, 110, 120);

      const footerY = pageHeight - Math.max(marginMm, 6);

      if (config.showImageCaptions) {
        const captionText = `${imgItem.name} (${imgW}×${imgH}px)`;
        doc.text(captionText, marginMm, footerY);
      }

      if (config.showPageNumbers) {
        const pageNumText = `${pageIdx + 1} / ${totalPages}`;
        doc.text(pageNumText, pageWidth - marginMm, footerY, { align: 'right' });
      }
    }
  };

  // Helper for 2 images per page
  const addTwoImagesPage = async (
    pair: [EnhancedImageItem, string][],
    pageIdx: number,
    totalPages: number
  ) => {
    const pageOrientation = config.orientation === 'landscape' ? 'l' : 'p';
    if (isFirstPage) {
      isFirstPage = false;
    } else {
      doc.addPage(format, pageOrientation);
    }

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const captionHeight = config.showPageNumbers ? 10 : 0;
    const availWidth = pageWidth - marginMm * 2;
    const availHeight = (pageHeight - marginMm * 2 - captionHeight - 6) / 2;

    for (let slot = 0; slot < pair.length; slot++) {
      const [item, srcUrl] = pair[slot];
      const loadedImg = await loadImage(srcUrl);
      const imgW = loadedImg.naturalWidth || loadedImg.width;
      const imgH = loadedImg.naturalHeight || loadedImg.height;

      const imgRatio = imgW / imgH;
      let renderW = availWidth;
      let renderH = availWidth / imgRatio;

      if (renderH > availHeight) {
        renderH = availHeight;
        renderW = availHeight * imgRatio;
      }

      const posX = marginMm + (availWidth - renderW) / 2;
      const slotY = marginMm + slot * (availHeight + 6);
      const posY = slotY + (availHeight - renderH) / 2;

      const formatType = srcUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(srcUrl, formatType, posX, posY, renderW, renderH, undefined, 'FAST');

      if (config.showImageCaptions) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 130);
        doc.text(item.name, posX, slotY + availHeight - 1);
      }
    }

    if (config.showPageNumbers) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 130);
      doc.text(`${pageIdx + 1} / ${totalPages}`, pageWidth - marginMm, pageHeight - Math.max(marginMm, 5), {
        align: 'right',
      });
    }
  };

  // Helper for Grid (4 images per page)
  const addGridPage = async (
    quad: [EnhancedImageItem, string][],
    pageIdx: number,
    totalPages: number
  ) => {
    const pageOrientation = 'p';
    if (isFirstPage) {
      isFirstPage = false;
    } else {
      doc.addPage(format, pageOrientation);
    }

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const captionHeight = config.showPageNumbers ? 10 : 0;
    const gap = 4;
    const cellW = (pageWidth - marginMm * 2 - gap) / 2;
    const cellH = (pageHeight - marginMm * 2 - captionHeight - gap) / 2;

    for (let slot = 0; slot < quad.length; slot++) {
      const [item, srcUrl] = quad[slot];
      const col = slot % 2;
      const row = Math.floor(slot / 2);

      const loadedImg = await loadImage(srcUrl);
      const imgW = loadedImg.naturalWidth || loadedImg.width;
      const imgH = loadedImg.naturalHeight || loadedImg.height;

      const imgRatio = imgW / imgH;
      let renderW = cellW;
      let renderH = cellW / imgRatio;

      if (renderH > cellH) {
        renderH = cellH;
        renderW = cellH * imgRatio;
      }

      const cellX = marginMm + col * (cellW + gap);
      const cellY = marginMm + row * (cellH + gap);

      const posX = cellX + (cellW - renderW) / 2;
      const posY = cellY + (cellH - renderH) / 2;

      const formatType = srcUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(srcUrl, formatType, posX, posY, renderW, renderH, undefined, 'FAST');

      if (config.showImageCaptions) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(120, 120, 130);
        doc.text(item.name.slice(0, 20), cellX + 1, cellY + cellH - 1);
      }
    }

    if (config.showPageNumbers) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 130);
      doc.text(`${pageIdx + 1} / ${totalPages}`, pageWidth - marginMm, pageHeight - Math.max(marginMm, 5), {
        align: 'right',
      });
    }
  };

  // Prepare images with selected URLs (original vs enhanced)
  const preparedItems: [EnhancedImageItem, string][] = images.map((img) => [
    img,
    config.preferEnhanced && img.enhancedUrl ? img.enhancedUrl : img.originalUrl,
  ]);

  if (config.layout === 'single') {
    const totalPages = preparedItems.length;
    for (let i = 0; i < preparedItems.length; i++) {
      onProgress?.(i + 1, totalPages);
      const [item, url] = preparedItems[i];
      await addSingleImagePage(item, url, i, totalPages);
    }
  } else if (config.layout === 'two') {
    const pairs: [EnhancedImageItem, string][][] = [];
    for (let i = 0; i < preparedItems.length; i += 2) {
      pairs.push(preparedItems.slice(i, i + 2));
    }
    const totalPages = pairs.length;
    for (let i = 0; i < pairs.length; i++) {
      onProgress?.(i + 1, totalPages);
      await addTwoImagesPage(pairs[i], i, totalPages);
    }
  } else {
    // grid
    const quads: [EnhancedImageItem, string][][] = [];
    for (let i = 0; i < preparedItems.length; i += 4) {
      quads.push(preparedItems.slice(i, i + 4));
    }
    const totalPages = quads.length;
    for (let i = 0; i < quads.length; i++) {
      onProgress?.(i + 1, totalPages);
      await addGridPage(quads[i], i, totalPages);
    }
  }

  // Set document metadata
  doc.setDocumentProperties({
    title: config.docTitle || 'Compiled Images',
    subject: 'Generated with AI Image Enhancer & PDF Studio',
    creator: 'AI Image Enhancer & PDF Studio',
  });

  return doc.output('blob');
}
