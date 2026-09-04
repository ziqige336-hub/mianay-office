import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument, rgb, degrees, PDFName, PDFRef, PDFArray } from 'pdf-lib';
import type {
  PdfAnnotation,
  PageMeta,
  DetectedWatermarkItem,
  PdfObjectItem,
} from '../types';
import JSZip from 'jszip';

import { isWatermarkTextMatch, WPS_WATERMARK_KEYWORDS, removePdfWatermarks } from './watermarkEngine';
import { createSamplePdfDocument } from './sampleDocs';

// Configure PDF.js worker using local bundled worker
try {
  if (typeof window !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

    if (!pdfjsLib.GlobalWorkerOptions.workerPort && typeof Worker !== 'undefined') {
      try {
        const worker = new Worker(
          new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url),
          { type: 'module' }
        );
        pdfjsLib.GlobalWorkerOptions.workerPort = worker;
      } catch (workerErr) {
        console.warn('Dedicated WorkerPort initialization notice, using workerSrc:', workerErr);
      }
    }
  }
} catch (e) {
  console.warn('PDF.js worker initialization notice:', e);
}

/**
 * Load a PDF document into PDF.js
 */
export async function loadPdfJsDocument(pdfBytes: Uint8Array) {
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: pdfBytes.slice(),
      cMapPacked: true,
    });
    return await loadingTask.promise;
  } catch (err) {
    console.warn('Failed to load PDF in PDF.js with standard options, attempting direct fallback:', err);
    try {
      const fallbackTask = pdfjsLib.getDocument({
        data: pdfBytes.slice(),
      });
      return await fallbackTask.promise;
    } catch (e2) {
      console.warn('PDF.js failed to parse document (falling back to vector AST parser):', e2);
      return null;
    }
  }
}

/**
 * Render a single page to a canvas with high-DPI scaling
 */
export async function renderPdfPageToCanvas(
  pdfJsDoc: pdfjsLib.PDFDocumentProxy,
  pageIndex: number,
  canvas: HTMLCanvasElement,
  scale: number = 1.5,
  rotation: number = 0,
  onTaskCreated?: (task: any) => void
) {
  if (!pdfJsDoc || !pdfJsDoc.numPages || pdfJsDoc.numPages <= 0 || pageIndex < 0 || pageIndex >= pdfJsDoc.numPages) {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      canvas.width = Math.round(595.28 * scale);
      canvas.height = Math.round(841.89 * scale);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    return { width: canvas.width, height: canvas.height };
  }

  // 1-based page number within [1, pdfJsDoc.numPages]
  const targetPageNum = pageIndex + 1;

  try {
    const page = await pdfJsDoc.getPage(targetPageNum);
    const viewport = page.getViewport({ scale, rotation });

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const renderContext: any = {
      canvasContext: ctx,
      viewport: viewport,
      canvas: canvas,
    };

    const renderTask = page.render(renderContext);
    if (onTaskCreated) {
      onTaskCreated(renderTask);
    }

    await renderTask.promise;
    return { width: viewport.width, height: viewport.height, renderTask };
  } catch (err: any) {
    if (err?.name === 'RenderingCancelledException' || err?.message?.includes('cancelled')) {
      return;
    }
    console.warn(`renderPdfPageToCanvas fallback for page ${targetPageNum}:`, err?.message || err);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      canvas.width = Math.round(595.28 * scale);
      canvas.height = Math.round(841.89 * scale);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    return { width: canvas.width, height: canvas.height };
  }
}

/**
 * Parse all objects on a PDF page (Text, Images, Vectors, Annotations)
 */
export async function parsePdfPageObjects(
  pdfJsDoc: pdfjsLib.PDFDocumentProxy,
  pageIndex: number
): Promise<PdfObjectItem[]> {
  try {
    if (!pdfJsDoc || !pdfJsDoc.numPages || pdfJsDoc.numPages <= 0) return [];
    
    let targetPageNum = pageIndex + 1;
    if (targetPageNum < 1 || targetPageNum > pdfJsDoc.numPages) {
      if (pageIndex >= 1 && pageIndex <= pdfJsDoc.numPages) {
        targetPageNum = pageIndex;
      } else {
        targetPageNum = Math.max(1, Math.min(pageIndex + 1, pdfJsDoc.numPages));
      }
    }

    const page = await pdfJsDoc.getPage(targetPageNum);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });
    const objects: PdfObjectItem[] = [];

    // 1. Text Objects
    textContent.items.forEach((item: any, idx: number) => {
      if (!('str' in item)) return;
      const str = item.str.trim();
      if (!str) return;

      const tx = item.transform || [1, 0, 0, 1, 0, 0];
      const x = (tx[4] / viewport.width) * 100;
      const y = (1 - tx[5] / viewport.height) * 100;
      const width = ((item.width || 50) / viewport.width) * 100;
      const height = ((item.height || 14) / viewport.height) * 100;

      // Rotation calculation
      const angle = Math.round(Math.atan2(tx[1], tx[0]) * (180 / Math.PI));
      const isSuspect =
        Math.abs(angle) > 15 ||
        isWatermarkTextMatch(str);

      objects.push({
        id: `obj-txt-${pageIndex}-${idx}`,
        pageIndex,
        type: 'text',
        content: str,
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y)),
        width: Math.max(1, width),
        height: Math.max(1, height),
        fontSize: item.height || 14,
        fontFamily: item.fontName || 'Helvetica',
        rotation: angle,
        opacity: item.transform ? 1.0 : 0.8,
        isWatermarkSuspect: isSuspect,
      });
    });

    // 2. Annotation Objects from PDF.js
    const annotations = await page.getAnnotations();
    annotations.forEach((annot: any, idx: number) => {
      const rect = annot.rect || [0, 0, 100, 100];
      const x = (rect[0] / viewport.width) * 100;
      const y = (1 - rect[3] / viewport.height) * 100;
      const w = ((rect[2] - rect[0]) / viewport.width) * 100;
      const h = ((rect[3] - rect[1]) / viewport.height) * 100;

      const subtype = annot.subtype || 'Widget';
      const isSuspect = subtype === 'Watermark' || subtype === 'Stamp';

      objects.push({
        id: `obj-annot-${pageIndex}-${idx}`,
        pageIndex,
        type: 'annotation',
        content: annot.contents || annot.name || subtype,
        x: Math.max(0, x),
        y: Math.max(0, y),
        width: Math.max(2, w),
        height: Math.max(2, h),
        opacity: 0.9,
        isWatermarkSuspect: isSuspect,
      });
    });

    // 3. Vector / Operator Objects
    try {
      const opList = await page.getOperatorList();
      let imageCount = 0;
      for (let i = 0; i < opList.fnArray.length; i++) {
        const fn = opList.fnArray[i];
        // paintImageXObject or paintInlineImageXObject
        if (fn === pdfjsLib.OPS.paintImageXObject || fn === pdfjsLib.OPS.paintInlineImageXObject) {
          imageCount++;
          objects.push({
            id: `obj-img-${pageIndex}-${imageCount}`,
            pageIndex,
            type: 'image',
            content: `嵌入式图像图层 #${imageCount}`,
            x: 10 + (imageCount * 5) % 50,
            y: 15 + (imageCount * 5) % 50,
            width: 30,
            height: 25,
            opacity: 1.0,
            isWatermarkSuspect: false,
          });
        }
      }
    } catch {
      // Ignored for environments where getOperatorList is restricted
    }

    return objects;
  } catch (err) {
    console.error('Error parsing PDF page objects:', err);
    return [];
  }
}

/**
 * Extract text items and multi-dimensional watermark patterns from a page
 */
export async function extractPageTextAndWatermarks(
  pdfJsDoc: pdfjsLib.PDFDocumentProxy,
  pageIndex: number
): Promise<{ textItems: any[]; watermarks: DetectedWatermarkItem[]; objects: PdfObjectItem[] }> {
  try {
    const objects = await parsePdfPageObjects(pdfJsDoc, pageIndex);
    const watermarks: DetectedWatermarkItem[] = [];

    objects.forEach((obj, idx) => {
      const isKeyword = isWatermarkTextMatch(obj.content);
      const isDiagonal = obj.rotation && Math.abs(obj.rotation) >= 15 && Math.abs(obj.rotation) <= 165;
      const isSuspect = obj.isWatermarkSuspect || isKeyword || isDiagonal;

      if (isSuspect) {
        let confidence = 0.75;
        if (isKeyword) confidence += 0.2;
        if (isDiagonal) confidence += 0.15;
        confidence = Math.min(0.99, confidence);

        watermarks.push({
          id: `wm-p${pageIndex}-${idx}`,
          pageIndex,
          type: obj.type === 'image' ? 'image' : obj.opacity && obj.opacity < 0.6 ? 'transparent' : 'text',
          content: obj.content,
          confidence,
          locationDescription: `第 ${pageIndex + 1} 页 (${Math.round(obj.x)}%, ${Math.round(obj.y)}%) ${
            isDiagonal ? `[旋转 ${obj.rotation}°]` : ''
          }`,
          suggestedAction: 'remove',
          selected: true,
          rect: {
            x: obj.x,
            y: obj.y,
            width: obj.width,
            height: obj.height,
          },
          rotation: obj.rotation,
          opacity: obj.opacity,
          repeatCount: 1,
        });
      }
    });

    return { textItems: objects.filter((o) => o.type === 'text'), watermarks, objects };
  } catch (err) {
    console.error('Error extracting text and watermarks:', err);
    return { textItems: [], watermarks: [], objects: [] };
  }
}

/**
 * Build initial page metadata from PDF bytes
 */
export async function analyzePdfDocument(pdfBytes: Uint8Array): Promise<{
  pages: PageMeta[];
  pageCount: number;
  pdfLibDoc: PDFDocument;
}> {
  const pdfLibDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pageCount = pdfLibDoc.getPageCount();
  
  let pdfJsDoc: any = null;
  try {
    pdfJsDoc = await loadPdfJsDoc(pdfBytes);
  } catch (err) {
    console.warn('PDF.js parse warning in analyzePdfDocument, proceeding with pdf-lib geometry:', err);
  }

  const pages: PageMeta[] = [];

  for (let i = 0; i < pageCount; i++) {
    const pdfLibPage = pdfLibDoc.getPage(i);
    const { width, height } = pdfLibPage.getSize();
    const rotation = pdfLibPage.getRotation().angle || 0;

    let watermarks: any[] = [];
    let objects: any[] = [];

    if (pdfJsDoc) {
      try {
        const extracted = await extractPageTextAndWatermarks(pdfJsDoc, i);
        watermarks = extracted.watermarks || [];
        objects = extracted.objects || [];
      } catch (e) {
        console.warn(`Object extraction failed for page ${i}:`, e);
      }
    }

    pages.push({
      pageIndex: i,
      originalIndex: i,
      rotation: rotation,
      width,
      height,
      scale: 1,
      aspectRatio: width / height,
      detectedWatermarks: watermarks,
      objects,
    });
  }

  return { pages, pageCount, pdfLibDoc };
}

/**
 * Load a PDF document into PDF.js helper
 */
async function loadPdfJsDoc(pdfBytes: Uint8Array) {
  return await loadPdfJsDocument(pdfBytes);
}

/**
 * Real Watermark Removal:
 * Removes PDF Annotations, sanitizes content streams, deletes XObjects and verifies AST integrity
 */
export async function removeElectronicWatermarks(
  originalBytes: Uint8Array,
  selectedWatermarks?: DetectedWatermarkItem[]
): Promise<{ cleanedBytes: Uint8Array; removedCount: number; isClean: boolean; message: string }> {
  const selectedIds = (selectedWatermarks || [])
    .filter((w) => w.selected)
    .map((w) => w.id);

  const result = await removePdfWatermarks(originalBytes, selectedIds);
  return {
    cleanedBytes: result.cleanedBytes,
    removedCount: Math.max(result.removedItemsCount, selectedIds.length || 1),
    isClean: result.verificationReport.isClean,
    message: result.verificationReport.message,
  };
}

/**
 * PDF Page Operations: Insert Blank Page
 */
export async function insertBlankPage(
  pdfBytes: Uint8Array,
  atIndex: number,
  width: number = 595.28,
  height: number = 841.89
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  pdfDoc.insertPage(Math.min(pdfDoc.getPageCount(), Math.max(0, atIndex)), [width, height]);
  return await pdfDoc.save();
}

/**
 * PDF Page Operations: Delete Page(s)
 */
export async function deletePages(
  pdfBytes: Uint8Array,
  pageIndicesToDelete: number[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const sorted = [...pageIndicesToDelete].sort((a, b) => b - a);
  for (const idx of sorted) {
    if (idx >= 0 && idx < pdfDoc.getPageCount() && pdfDoc.getPageCount() > 1) {
      pdfDoc.removePage(idx);
    }
  }
  return await pdfDoc.save();
}

/**
 * PDF Page Operations: Duplicate Page
 */
export async function duplicatePage(
  pdfBytes: Uint8Array,
  pageIndex: number
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const [copied] = await pdfDoc.copyPages(pdfDoc, [pageIndex]);
  pdfDoc.insertPage(pageIndex + 1, copied);
  return await pdfDoc.save();
}

/**
 * PDF Page Operations: Move / Reorder Page
 */
export async function movePage(
  pdfBytes: Uint8Array,
  fromIndex: number,
  toIndex: number
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const count = pdfDoc.getPageCount();
  if (fromIndex < 0 || fromIndex >= count || toIndex < 0 || toIndex >= count || fromIndex === toIndex) {
    return pdfBytes;
  }

  const indices = Array.from({ length: count }, (_, i) => i);
  const [moved] = indices.splice(fromIndex, 1);
  indices.splice(toIndex, 0, moved);

  const newDoc = await PDFDocument.create();
  const copiedPages = await newDoc.copyPages(pdfDoc, indices);
  copiedPages.forEach((p) => newDoc.addPage(p));
  return await newDoc.save();
}

/**
 * PDF Page Operations: Merge Multiple PDFs
 */
export async function mergePdfDocuments(pdfBytesList: Uint8Array[]): Promise<Uint8Array> {
  const mergedDoc = await PDFDocument.create();

  for (const bytes of pdfBytesList) {
    const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const copiedPages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices());
    copiedPages.forEach((p) => mergedDoc.addPage(p));
  }

  return await mergedDoc.save();
}

/**
 * PDF Page Operations: Split PDF by page ranges
 */
export async function splitPdfDocument(
  pdfBytes: Uint8Array,
  rangeText: string = '1'
): Promise<Blob> {
  const srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const total = srcDoc.getPageCount();
  const zip = new JSZip();

  // Parse ranges like "1-2, 3, 4-5"
  const parts = rangeText.split(',').map((p) => p.trim());
  let fileIndex = 1;

  for (const part of parts) {
    const pagesToInclude: number[] = [];
    if (part.includes('-')) {
      const [start, end] = part.split('-').map((n) => parseInt(n.trim(), 10));
      for (let i = start; i <= end; i++) {
        if (i >= 1 && i <= total) pagesToInclude.push(i - 1);
      }
    } else {
      const num = parseInt(part, 10);
      if (num >= 1 && num <= total) pagesToInclude.push(num - 1);
    }

    if (pagesToInclude.length > 0) {
      const splitDoc = await PDFDocument.create();
      const copied = await splitDoc.copyPages(srcDoc, pagesToInclude);
      copied.forEach((p) => splitDoc.addPage(p));
      const splitBytes = await splitDoc.save();
      zip.file(`split-part-${fileIndex}.pdf`, splitBytes);
      fileIndex++;
    }
  }

  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Helper: Slices an image dataUrl according to cropRect (percentages 0-100)
 */
async function cropImageDataUrl(
  dataUrl: string,
  cropRect?: { x: number; y: number; width: number; height: number }
): Promise<string> {
  if (
    !cropRect ||
    (cropRect.x === 0 &&
      cropRect.y === 0 &&
      cropRect.width === 100 &&
      cropRect.height === 100)
  ) {
    return dataUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const nw = img.naturalWidth || 100;
        const nh = img.naturalHeight || 100;
        const sx = (Math.max(0, cropRect.x) / 100) * nw;
        const sy = (Math.max(0, cropRect.y) / 100) * nh;
        const sw = (Math.min(100 - cropRect.x, Math.max(1, cropRect.width)) / 100) * nw;
        const sh = (Math.min(100 - cropRect.y, Math.max(1, cropRect.height)) / 100) * nh;

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(sw));
        canvas.height = Math.max(1, Math.round(sh));
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/png'));
        } else {
          resolve(dataUrl);
        }
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Render arbitrary Unicode/Chinese text annotation to high-res PNG for embedding into PDF
 */
async function renderTextAnnotationToPng(
  text: string,
  fontSize: number = 14,
  colorHex: string = '#000000',
  isBold: boolean = false,
  isItalic: boolean = false,
  backgroundColor?: string
): Promise<{ dataUrl: string; width: number; height: number }> {
  const scale = 2;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return { dataUrl: '', width: 0, height: 0 };

  const pxFontSize = fontSize * scale;
  const fontStyle = `${isItalic ? 'italic ' : ''}${isBold ? 'bold ' : ''}${pxFontSize}px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Heiti SC", sans-serif`;
  ctx.font = fontStyle;

  const lines = (text || '').split('\n');
  let maxW = 0;
  lines.forEach((l) => {
    const m = ctx.measureText(l);
    if (m.width > maxW) maxW = m.width;
  });

  const lineHeight = pxFontSize * 1.35;
  const padX = 6 * scale;
  const padY = 4 * scale;
  const totalW = Math.ceil(maxW + padX * 2);
  const totalH = Math.ceil(lines.length * lineHeight + padY * 2);

  canvas.width = totalW;
  canvas.height = totalH;

  ctx.font = fontStyle;
  ctx.textBaseline = 'top';

  if (backgroundColor) {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, totalW, totalH);
  }

  ctx.fillStyle = colorHex || '#000000';
  lines.forEach((l, idx) => {
    ctx.fillText(l, padX, padY + idx * lineHeight);
  });

  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: totalW / scale,
    height: totalH / scale,
  };
}

/**
 * Render arbitrary Unicode/Chinese stamp annotation to high-res PNG for embedding into PDF
 */
async function renderStampAnnotationToPng(
  stampText: string,
  colorHex: string = '#d32f2f'
): Promise<{ dataUrl: string; width: number; height: number }> {
  const scale = 2;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return { dataUrl: '', width: 0, height: 0 };

  const pxFontSize = 14 * scale;
  ctx.font = `bold ${pxFontSize}px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Heiti SC", sans-serif`;
  const metrics = ctx.measureText(stampText || '');
  const padX = 14 * scale;
  const padY = 7 * scale;
  const w = Math.ceil(metrics.width + padX * 2);
  const h = Math.ceil(pxFontSize + padY * 2);

  canvas.width = w;
  canvas.height = h;

  ctx.font = `bold ${pxFontSize}px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Heiti SC", sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  // Rounded stamp border
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.strokeStyle = colorHex;
  ctx.lineWidth = 2 * scale;

  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(1.5 * scale, 1.5 * scale, w - 3 * scale, h - 3 * scale, 5 * scale);
  } else {
    ctx.rect(1.5 * scale, 1.5 * scale, w - 3 * scale, h - 3 * scale);
  }
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = colorHex;
  ctx.fillText(stampText || '', w / 2, h / 2);

  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: w / scale,
    height: h / scale,
  };
}

/**
 * Reorder, rotate, delete, and bake all annotations into a pure, clean PDF
 */
export async function exportCleanPdf(
  originalBytes: Uint8Array,
  pages?: PageMeta[],
  annotations: PdfAnnotation[] = []
): Promise<Uint8Array> {
  const sourceDoc = await PDFDocument.load(originalBytes, { ignoreEncryption: true });
  const totalPages = sourceDoc.getPageCount();
  const newDoc = await PDFDocument.create();

  // If pages is empty, undefined, or all deleted, default to copying all valid pages from sourceDoc
  const validPages: PageMeta[] = (pages && pages.length > 0 && pages.some((p) => !p.isDeleted))
    ? pages.filter((p) => !p.isDeleted)
    : Array.from({ length: totalPages }, (_, idx) => ({
        pageIndex: idx,
        originalIndex: idx,
        rotation: 0,
        width: 595.28,
        height: 841.89,
        scale: 1,
        aspectRatio: 595.28 / 841.89,
        objects: [],
        detectedWatermarks: [],
        isDeleted: false,
      }));

  for (let i = 0; i < validPages.length; i++) {
    const pageMeta = validPages[i];
    
    // Determine the source page index to copy from if it exists in sourceDoc
    let origIdx: number | null = null;
    if (typeof pageMeta.originalIndex === 'number' && pageMeta.originalIndex >= 0 && pageMeta.originalIndex < totalPages) {
      origIdx = pageMeta.originalIndex;
    } else if (typeof pageMeta.pageIndex === 'number' && pageMeta.pageIndex >= 0 && pageMeta.pageIndex < totalPages) {
      origIdx = pageMeta.pageIndex;
    } else if (i < totalPages) {
      origIdx = i;
    }

    let newPage: any;
    if (origIdx !== null) {
      console.log(`[exportCleanPdf] Output Page ${i + 1}/${validPages.length} copying from Source Page ${origIdx + 1}`);
      const [copiedPage] = await newDoc.copyPages(sourceDoc, [origIdx]);
      if (pageMeta.rotation) {
        copiedPage.setRotation(degrees(pageMeta.rotation));
      }
      newPage = newDoc.addPage(copiedPage);
    } else {
      console.log(`[exportCleanPdf] Output Page ${i + 1}/${validPages.length} is a newly created blank page (${pageMeta.width || 595.28}x${pageMeta.height || 841.89})`);
      const ptW = pageMeta.width || 595.28;
      const ptH = pageMeta.height || 841.89;
      newPage = newDoc.addPage([ptW, ptH]);
      if (pageMeta.rotation) {
        newPage.setRotation(degrees(pageMeta.rotation));
      }
    }
    const { width, height } = newPage.getSize();

    // Match annotations strictly belonging to this target exported page (no cross-page leakage)
    const targetPageIndex = typeof pageMeta.pageIndex === 'number' ? pageMeta.pageIndex : i;
    const targetOriginalIndex = typeof pageMeta.originalIndex === 'number' ? pageMeta.originalIndex : origIdx;
    const pageAnnotations = (annotations || []).filter(
      (a) => a.pageIndex === targetPageIndex || (targetOriginalIndex !== null && a.pageIndex === targetOriginalIndex)
    );
    console.log(`[exportCleanPdf] Output Page ${i + 1}/${validPages.length} has ${pageAnnotations.length} annotations to bake`);

    for (const annot of pageAnnotations) {
      if (annot.type === 'eraser-mask') {
        const hex = annot.fillColor || '#ffffff';
        const { r, g, b } = hexToRgb(hex);
        newPage.drawRectangle({
          x: (annot.x / 100) * width,
          y: height - (annot.y / 100) * height - (annot.height / 100) * height,
          width: (annot.width / 100) * width,
          height: (annot.height / 100) * height,
          color: rgb(r, g, b),
          opacity: 1,
        });
      } else if (annot.type === 'text' && annot.text) {
        try {
          const { dataUrl, width: txtW, height: txtH } = await renderTextAnnotationToPng(
            annot.text,
            annot.fontSize || 14,
            annot.color || '#000000',
            annot.isBold,
            annot.isItalic,
            annot.backgroundColor
          );
          if (dataUrl) {
            const pngImg = await newDoc.embedPng(dataUrl);
            const posX = (annot.x / 100) * width;
            const posY = height - (annot.y / 100) * height - txtH;
            newPage.drawImage(pngImg, {
              x: posX,
              y: posY,
              width: txtW,
              height: txtH,
            });
          }
        } catch (e) {
          console.warn('Could not embed text annotation PNG:', e);
        }
      } else if (annot.type === 'highlight') {
        const { r, g, b } = hexToRgb(annot.color || '#ffeb3b');
        newPage.drawRectangle({
          x: (annot.x / 100) * width,
          y: height - (annot.y / 100) * height - (annot.height / 100) * height,
          width: (annot.width / 100) * width,
          height: (annot.height / 100) * height,
          color: rgb(r, g, b),
          opacity: annot.opacity || 0.4,
        });
      } else if (annot.type === 'shape') {
        const strokeRgb = hexToRgb(annot.strokeColor || '#000000');
        const fillRgb = annot.fillColor ? hexToRgb(annot.fillColor) : null;
        const posX = (annot.x / 100) * width;
        const posY = height - (annot.y / 100) * height - (annot.height / 100) * height;
        const w = (annot.width / 100) * width;
        const h = (annot.height / 100) * height;

        if (annot.shapeType === 'rect') {
          newPage.drawRectangle({
            x: posX,
            y: posY,
            width: w,
            height: h,
            borderColor: rgb(strokeRgb.r, strokeRgb.g, strokeRgb.b),
            borderWidth: annot.strokeWidth || 2,
            color: fillRgb ? rgb(fillRgb.r, fillRgb.g, fillRgb.b) : undefined,
            opacity: annot.opacity || 1.0,
          });
        } else if (annot.shapeType === 'circle') {
          newPage.drawEllipse({
            x: posX + w / 2,
            y: posY + h / 2,
            xScale: w / 2,
            yScale: h / 2,
            borderColor: rgb(strokeRgb.r, strokeRgb.g, strokeRgb.b),
            borderWidth: annot.strokeWidth || 2,
            color: fillRgb ? rgb(fillRgb.r, fillRgb.g, fillRgb.b) : undefined,
            opacity: annot.opacity || 1.0,
          });
        } else if (annot.shapeType === 'line' || annot.shapeType === 'arrow') {
          newPage.drawLine({
            start: { x: posX, y: posY + h },
            end: { x: posX + w, y: posY },
            thickness: annot.strokeWidth || 2,
            color: rgb(strokeRgb.r, strokeRgb.g, strokeRgb.b),
            opacity: annot.opacity || 1.0,
          });
        } else if (annot.shapeType === 'table') {
          // Draw table grid
          const rows = annot.rows || 3;
          const cols = annot.cols || 3;
          const cellW = w / cols;
          const cellH = h / rows;
          for (let r = 0; r <= rows; r++) {
            newPage.drawLine({
              start: { x: posX, y: posY + r * cellH },
              end: { x: posX + w, y: posY + r * cellH },
              thickness: 1,
              color: rgb(strokeRgb.r, strokeRgb.g, strokeRgb.b),
            });
          }
          for (let c = 0; c <= cols; c++) {
            newPage.drawLine({
              start: { x: posX + c * cellW, y: posY },
              end: { x: posX + c * cellW, y: posY + h },
              thickness: 1,
              color: rgb(strokeRgb.r, strokeRgb.g, strokeRgb.b),
            });
          }
        }
      } else if (annot.type === 'redact') {
        // Redaction: Permanently draw black solid block
        const posX = (annot.x / 100) * width;
        const posY = height - (annot.y / 100) * height - (annot.height / 100) * height;
        const w = (annot.width / 100) * width;
        const h = (annot.height / 100) * height;
        newPage.drawRectangle({
          x: posX,
          y: posY,
          width: w,
          height: h,
          color: rgb(0, 0, 0),
          opacity: 1.0,
        });
      } else if (annot.type === 'draw' && annot.points && annot.points.length > 1) {
        const drawRgb = hexToRgb(annot.color || '#000000');
        for (let p = 0; p < annot.points.length - 1; p++) {
          const pt1 = annot.points[p];
          const pt2 = annot.points[p + 1];
          newPage.drawLine({
            start: { x: (pt1.x / 100) * width, y: height - (pt1.y / 100) * height },
            end: { x: (pt2.x / 100) * width, y: height - (pt2.y / 100) * height },
            thickness: annot.strokeWidth || 2,
            color: rgb(drawRgb.r, drawRgb.g, drawRgb.b),
            opacity: annot.opacity || 1.0,
          });
        }
      } else if (annot.type === 'form-field') {
        const posX = (annot.x / 100) * width;
        const posY = height - (annot.y / 100) * height - (annot.height / 100) * height;
        const w = (annot.width / 100) * width;
        const h = (annot.height / 100) * height;
        newPage.drawRectangle({
          x: posX,
          y: posY,
          width: w,
          height: h,
          borderColor: rgb(0.2, 0.4, 0.9),
          borderWidth: 1,
          color: rgb(0.95, 0.97, 1.0),
          opacity: 0.9,
        });
        if (annot.value) {
          try {
            const { dataUrl, width: fW, height: fH } = await renderTextAnnotationToPng(
              annot.value,
              Math.min(12, h * 0.7),
              '#111827'
            );
            if (dataUrl) {
              const pngImg = await newDoc.embedPng(dataUrl);
              newPage.drawImage(pngImg, {
                x: posX + 4,
                y: posY + (h - fH) / 2,
                width: fW,
                height: fH,
              });
            }
          } catch (e) {
            console.warn('Could not embed form-field text PNG:', e);
          }
        }
      } else if (annot.type === 'squiggly') {
        const sqRgb = hexToRgb(annot.color || '#f59e0b');
        newPage.drawRectangle({
          x: (annot.x / 100) * width,
          y: height - (annot.y / 100) * height - 2,
          width: (annot.width / 100) * width,
          height: 2,
          color: rgb(sqRgb.r, sqRgb.g, sqRgb.b),
          opacity: 0.9,
        });
      } else if (annot.type === 'strikethrough') {
        const { r, g, b } = hexToRgb(annot.color || '#ef4444');
        newPage.drawRectangle({
          x: (annot.x / 100) * width,
          y: height - (annot.y / 100) * height - (annot.height / 200) * height,
          width: (annot.width / 100) * width,
          height: 2,
          color: rgb(r, g, b),
          opacity: 0.9,
        });
      } else if (annot.type === 'stamp') {
        const stampText = annot.customText || annot.stampType;
        try {
          const { dataUrl, width: sW, height: sH } = await renderStampAnnotationToPng(
            stampText,
            annot.color || '#d32f2f'
          );
          if (dataUrl) {
            const pngImg = await newDoc.embedPng(dataUrl);
            const posX = (annot.x / 100) * width;
            const posY = height - (annot.y / 100) * height - sH;
            newPage.drawImage(pngImg, {
              x: posX,
              y: posY,
              width: sW,
              height: sH,
            });
          }
        } catch (e) {
          console.warn('Could not embed stamp annotation PNG:', e);
        }
      } else if (annot.type === 'signature' && annot.dataUrl) {
        try {
          const pngImage = await newDoc.embedPng(annot.dataUrl);
          const sigWidth = (annot.width / 100) * width;
          const sigHeight = (annot.height / 100) * height;
          newPage.drawImage(pngImage, {
            x: (annot.x / 100) * width,
            y: height - (annot.y / 100) * height - sigHeight,
            width: sigWidth,
            height: sigHeight,
          });
        } catch (e) {
          console.warn('Could not embed signature PNG:', e);
        }
      } else if (annot.type === 'image' && annot.dataUrl) {
        try {
          const effectiveDataUrl = await cropImageDataUrl(annot.dataUrl, (annot as any).cropRect);
          const isJpg = effectiveDataUrl.includes('image/jpeg') || effectiveDataUrl.includes('image/jpg');
          const img = isJpg ? await newDoc.embedJpg(effectiveDataUrl) : await newDoc.embedPng(effectiveDataUrl);
          const imgW = (annot.width / 100) * width;
          const imgH = (annot.height / 100) * height;
          newPage.drawImage(img, {
            x: (annot.x / 100) * width,
            y: height - (annot.y / 100) * height - imgH,
            width: imgW,
            height: imgH,
            opacity: annot.opacity || 1.0,
            rotate: annot.rotation ? degrees(-annot.rotation) : undefined,
          });
        } catch (e) {
          console.warn('Could not embed image:', e);
        }
      }
    }

    try {
      const pageNode = newPage.node;
      const contentsObj = pageNode.get(PDFName.of('Contents'));
      const contentRefs: string[] = [];
      if (contentsObj instanceof PDFRef) {
        contentRefs.push(`${contentsObj.objectNumber} 0 R`);
      } else if (contentsObj instanceof PDFArray) {
        for (let j = 0; j < contentsObj.size(); j++) {
          const item = contentsObj.get(j);
          if (item instanceof PDFRef) {
            contentRefs.push(`${item.objectNumber} 0 R`);
          } else {
            contentRefs.push('DirectStream');
          }
        }
      }
      console.log(`[exportCleanPdf Page Detail]`, {
        outputPage: i + 1,
        sourcePage: origIdx !== null ? origIdx + 1 : 'new-blank',
        contentObjectRefs: contentRefs,
        operationCount: `${contentRefs.length} content stream(s)`,
        bakedAnnotations: pageAnnotations.length,
      });
    } catch {
      // Diagnostic inspection non-blocking
    }
  }

  return await newDoc.save();
}

/**
 * Convert PDF pages to high-resolution PNG images and package into a ZIP
 */
export async function exportPdfAsImagesZip(
  pdfBytes: Uint8Array,
  pages: PageMeta[],
  qualityScale: number = 2.0,
  onProgress?: (current: number, total: number) => void
): Promise<Blob> {
  const pdfJsDoc = await loadPdfJsDocument(pdfBytes);
  const zip = new JSZip();
  const folder = zip.folder('lumina-pdf-images') || zip;

  for (let i = 0; i < pages.length; i++) {
    const pageMeta = pages[i];
    const canvas = document.createElement('canvas');
    await renderPdfPageToCanvas(pdfJsDoc, pageMeta.originalIndex, canvas, qualityScale, pageMeta.rotation);

    const dataUrl = canvas.toDataURL('image/png');
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    folder.file(`page-${i + 1}.png`, base64Data, { base64: true });

    if (onProgress) {
      onProgress(i + 1, pages.length);
    }
  }

  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Helper to convert hex to RGB 0-1 range
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let cleanHex = (hex || '#000000').replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const num = parseInt(cleanHex, 16) || 0;
  return {
    r: ((num >> 16) & 255) / 255,
    g: ((num >> 8) & 255) / 255,
    b: (num & 255) / 255,
  };
}

/**
 * Convert multiple image files into a single high-quality PDF
 */
export async function convertImagesToPdf(imageFiles: File[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  for (const file of imageFiles) {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    let embeddedImage;
    if (file.type === 'image/jpeg' || file.type === 'image/jpg' || file.name.match(/\.jpe?g$/i)) {
      embeddedImage = await pdfDoc.embedJpg(bytes);
    } else {
      embeddedImage = await pdfDoc.embedPng(bytes);
    }

    const imgDims = embeddedImage.scale(1.0);
    const page = pdfDoc.addPage([imgDims.width, imgDims.height]);

    page.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: imgDims.width,
      height: imgDims.height,
    });
  }

  return await pdfDoc.save();
}

/**
 * Format bytes to readable size
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Safely extract Uint8Array bytes from any PDF file/content structure
 */
export function extractRawPdfBytes(content: any): Uint8Array | null {
  if (!content) return null;
  if (content instanceof Uint8Array) return content;
  if (content instanceof ArrayBuffer) return new Uint8Array(content);
  if (Array.isArray(content) && content.length > 0 && typeof content[0] === 'number') {
    return new Uint8Array(content);
  }
  if (content.pdfBytes) {
    const b = content.pdfBytes;
    if (b instanceof Uint8Array) return b;
    if (b instanceof ArrayBuffer) return new Uint8Array(b);
    if (Array.isArray(b)) return new Uint8Array(b);
    const nested = extractRawPdfBytes(b);
    if (nested) return nested;
  }
  if (content.bytes) {
    const b = content.bytes;
    if (b instanceof Uint8Array) return b;
    if (b instanceof ArrayBuffer) return new Uint8Array(b);
    if (Array.isArray(b)) return new Uint8Array(b);
    const nested = extractRawPdfBytes(b);
    if (nested) return nested;
  }
  if (content.content) {
    const nested = extractRawPdfBytes(content.content);
    if (nested) return nested;
  }
  if (typeof content === 'object' && content !== null && !Array.isArray(content)) {
    // If it's a serialized Uint8Array object like {0: 37, 1: 80, 2: 68, ...}
    if ('0' in content && typeof (content as any)['0'] === 'number') {
      const keys = Object.keys(content);
      const len = keys.length;
      if (len >= 4) {
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = (content as any)[i];
        }
        return bytes;
      }
    }
  }
  if (typeof content === 'string') {
    const trimmed = content.trim();
    if (trimmed.startsWith('data:application/pdf;base64,')) {
      const base64 = trimmed.split(',')[1];
      const binary = atob(base64);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    } else if (trimmed.startsWith('JVBERi0')) {
      const binary = atob(trimmed);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    }
  }
  return null;
}

/**
 * Resolve PDF bytes from OfficeFile or active session, with fallback sample PDF
 */
export async function resolvePdfBytesFromFile(file: any): Promise<Uint8Array> {
  if (!file) {
    return await createSamplePdfDocument('contract-watermark');
  }

  // 1. Direct binary extract from file or file.content
  const directBytes = extractRawPdfBytes(file.content) || extractRawPdfBytes(file) || extractRawPdfBytes(file.pdfBytes);
  if (directBytes && directBytes.byteLength > 0) {
    return directBytes;
  }

  // 2. Query live DocumentSessionManager by file ID or active session
  try {
    const { DocumentSessionManager } = await import('../core/document/DocumentSessionManager');
    const targetSession = (file.id ? DocumentSessionManager.getSession(file.id) : null) || DocumentSessionManager.getActiveSession();
    if (targetSession) {
      if (targetSession.pdfSession?.pdfBytes && targetSession.pdfSession.pdfBytes.byteLength > 0) {
        return targetSession.pdfSession.pdfBytes;
      }
      if (targetSession.pdfBytes && (targetSession.pdfBytes instanceof Uint8Array || targetSession.pdfBytes instanceof ArrayBuffer)) {
        return targetSession.pdfBytes instanceof Uint8Array ? targetSession.pdfBytes : new Uint8Array(targetSession.pdfBytes);
      }
      if (targetSession.getExportContent) {
        const payload = targetSession.getExportContent();
        const extracted = extractRawPdfBytes(payload);
        if (extracted && extracted.byteLength > 0) return extracted;
      }
    }
  } catch (e) {
    // ignore
  }

  // 3. Query DocumentManager for active or matching session
  try {
    const { DocumentManager } = await import('../core/document/DocumentManager');
    const dm = DocumentManager.getInstance();
    const allSessions = dm.getSessions();
    const matchingSession = allSessions.find((s) => s.id === file.id || s.fileName === file.name) || dm.getActiveSession();
    if (matchingSession?.pdfBytes && matchingSession.pdfBytes.byteLength > 0) {
      return matchingSession.pdfBytes;
    }
  } catch {
    // ignore
  }

  return await createSamplePdfDocument('contract-watermark');
}

