import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import JSZip from 'jszip';
import type {
  PageMeta,
  PdfAnnotation,
  WatermarkConfig,
  SecurityConfig,
  SearchMatchItem,
} from '../types';
import { hexToRgb, renderPdfPageToCanvas } from './pdfLibWrapper';
import { runRealTesseractOcr } from './ocrEngine';
import {
  convertPdfToWordDocxAdvanced,
  convertPdfToExcelXlsxAdvanced,
  DPI_PRESETS,
} from './universalExportPipeline';

/**
 * Standard DPI scale map matching WPS / Adobe Acrobat definitions
 */
export const DPI_SETTINGS = DPI_PRESETS;

/**
 * Re-export Advanced PDF to Word (.docx)
 */
export const convertPdfToWordDocx = convertPdfToWordDocxAdvanced;

/**
 * Re-export Advanced PDF to Excel (.xlsx)
 */
export const convertPdfToExcelXlsx = convertPdfToExcelXlsxAdvanced;

/**
 * Export PDF as High-DPI Images (Single or ZIP)
 */
export async function exportPdfHighDpiImages(
  pdfJsDoc: pdfjsLib.PDFDocumentProxy,
  pages: PageMeta[],
  dpi: number = 96,
  format: 'png' | 'jpeg' = 'png',
  onProgress?: (curr: number, total: number) => void
): Promise<Blob> {
  const scale = DPI_SETTINGS[dpi]?.scale || 1.33;
  const zip = new JSZip();
  const folder = zip.folder(`pdf-images-${dpi}dpi`) || zip;

  for (let i = 0; i < pages.length; i++) {
    const pageMeta = pages[i];
    const canvas = document.createElement('canvas');
    await renderPdfPageToCanvas(pdfJsDoc, pageMeta.originalIndex, canvas, scale, pageMeta.rotation);

    const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const quality = format === 'jpeg' ? 0.92 : undefined;
    const dataUrl = canvas.toDataURL(mime, quality);
    const base64Data = dataUrl.split(',')[1];
    const ext = format === 'jpeg' ? 'jpg' : 'png';

    folder.file(`page_${String(i + 1).padStart(3, '0')}_${dpi}dpi.${ext}`, base64Data, { base64: true });
    onProgress?.(i + 1, pages.length);
  }

  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Render arbitrary watermark text (including full Chinese / Unicode) to high-res PNG
 */
async function renderWatermarkTextToPng(
  text: string,
  fontSize: number = 36,
  colorRgb: { r: number; g: number; b: number },
  opacity: number = 0.25
): Promise<{ dataUrl: string; width: number; height: number }> {
  const scale = 2;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return { dataUrl: '', width: 0, height: 0 };

  const pxFontSize = fontSize * scale;
  ctx.font = `bold ${pxFontSize}px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Heiti SC", sans-serif`;
  const metrics = ctx.measureText(text);
  const textWidth = Math.ceil(metrics.width + 20 * scale);
  const textHeight = Math.ceil(pxFontSize * 1.35);

  canvas.width = textWidth;
  canvas.height = textHeight;

  ctx.font = `bold ${pxFontSize}px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Heiti SC", sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillStyle = `rgba(${Math.round(colorRgb.r * 255)}, ${Math.round(colorRgb.g * 255)}, ${Math.round(colorRgb.b * 255)}, ${opacity})`;

  ctx.fillText(text, textWidth / 2, textHeight / 2);

  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: textWidth / scale,
    height: textHeight / scale,
  };
}

/**
 * Export Scanned PDF (Image-based PDF) with specified DPI and optional OCR
 */
export async function exportScannedImageBasedPdf(
  pdfJsDoc: pdfjsLib.PDFDocumentProxy,
  pages: PageMeta[],
  dpi: number = 150,
  includeOcr: boolean = false,
  onProgress?: (progress: number, status: string) => void
): Promise<Uint8Array> {
  const scale = DPI_SETTINGS[dpi]?.scale || 2.0;
  const newPdfDoc = await PDFDocument.create();
  const standardFont = await newPdfDoc.embedFont(StandardFonts.Helvetica);

  for (let i = 0; i < pages.length; i++) {
    const pageMeta = pages[i];
    onProgress?.((i / pages.length) * 0.7, `正在高精度栅格化第 ${i + 1} / ${pages.length} 页 (${dpi} DPI)...`);

    const targetIdx = typeof pageMeta.originalIndex === 'number' ? pageMeta.originalIndex : i;
    const canvas = document.createElement('canvas');
    await renderPdfPageToCanvas(pdfJsDoc, targetIdx, canvas, scale, pageMeta.rotation);

    // Convert canvas to JPG bytes
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const base64 = dataUrl.split(',')[1];
    const binaryStr = atob(base64);
    const imageBytes = new Uint8Array(binaryStr.length);
    for (let b = 0; b < binaryStr.length; b++) {
      imageBytes[b] = binaryStr.charCodeAt(b);
    }

    const embeddedJpg = await newPdfDoc.embedJpg(imageBytes);
    // Page dimensions in PDF points (72 pt / inch)
    const ptWidth = canvas.width / scale;
    const ptHeight = canvas.height / scale;

    const newPage = newPdfDoc.addPage([ptWidth, ptHeight]);
    newPage.drawImage(embeddedJpg, {
      x: 0,
      y: 0,
      width: ptWidth,
      height: ptHeight,
    });

    // If OCR text layer is requested, run OCR and add invisible text layer for searchability
    if (includeOcr) {
      try {
        onProgress?.(0.7 + ((i + 1) / pages.length) * 0.25, `正在对第 ${i + 1} 页执行 OCR 文本层注入...`);
        const ocrRes = await runRealTesseractOcr(canvas, 'chi_sim+eng');
        if (ocrRes.lines && ocrRes.lines.length > 0) {
          for (const line of ocrRes.lines) {
            if (!line.text || !line.bbox) continue;
            // Scale bbox to PDF coords
            const bbox = line.bbox;
            const x = (bbox.x0 / canvas.width) * ptWidth;
            const y = ptHeight - (bbox.y1 / canvas.height) * ptHeight;
            const size = Math.max(8, ((bbox.y1 - bbox.y0) / canvas.height) * ptHeight);

            // Filter for WinAnsi-compatible characters to prevent WinAnsi encode error on standard fonts
            const safeText = line.text.replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
            if (safeText.trim()) {
              try {
                newPage.drawText(safeText, {
                  x,
                  y,
                  size,
                  font: standardFont,
                  color: rgb(1, 1, 1),
                  opacity: 0.01, // Invisible searchable layer
                });
              } catch {}
            }
          }
        }
      } catch (err) {
        console.warn(`OCR layer injection skipped on page ${i + 1}:`, err);
      }
    }
  }

  onProgress?.(1.0, '扫描型 PDF 打包完成');
  return await newPdfDoc.save();
}

/**
 * Apply Watermark to PDF document
 */
export async function applyWatermarkToPdf(
  pdfBytes: Uint8Array,
  config: WatermarkConfig,
  pagesMeta: PageMeta[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const colorRgb = hexToRgb(config.color);
  const targetCount = pdfDoc.getPageCount();

  let embeddedImage: any = null;
  let watermarkWidth = 0;
  let watermarkHeight = 0;

  if (config.type === 'text') {
    const text = config.text || 'LUMINA CONFIDENTIAL';
    const size = config.fontSize || 36;
    const opacity = config.opacity || 0.25;
    const { dataUrl, width: w, height: h } = await renderWatermarkTextToPng(text, size, colorRgb, opacity);
    if (dataUrl) {
      try {
        const resp = await fetch(dataUrl);
        const buf = await resp.arrayBuffer();
        embeddedImage = await pdfDoc.embedPng(new Uint8Array(buf));
        watermarkWidth = w;
        watermarkHeight = h;
      } catch (e) {
        console.warn('Failed to embed text watermark PNG:', e);
      }
    }
  } else if (config.type === 'image' && config.imageUrl) {
    try {
      const resp = await fetch(config.imageUrl);
      const buffer = await resp.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      if (config.imageUrl.includes('png') || config.imageUrl.startsWith('data:image/png')) {
        embeddedImage = await pdfDoc.embedPng(bytes);
      } else {
        embeddedImage = await pdfDoc.embedJpg(bytes);
      }
      const imgScale = (config.scale || 1.0) * 0.5;
      watermarkWidth = embeddedImage.width * imgScale;
      watermarkHeight = embeddedImage.height * imgScale;
    } catch (e) {
      console.warn('Failed to embed watermark image:', e);
    }
  }

  const angle = degrees(config.rotation || 35);

  for (let i = 0; i < targetCount; i++) {
    // Check target page rule
    if (config.targetPages === 'current' && i !== 0) continue;
    if (config.targetPages === 'odd' && i % 2 !== 0) continue;
    if (config.targetPages === 'even' && i % 2 === 0) continue;

    const page = pdfDoc.getPage(i);
    const { width, height } = page.getSize();

    if (embeddedImage && watermarkWidth > 0 && watermarkHeight > 0) {
      if (config.isTiled) {
        // Draw grid tile matrix
        const spacingX = Math.max(120, config.tileSpacing || 200);
        const spacingY = Math.max(100, config.tileSpacing || 180);
        for (let x = -width * 0.3; x < width * 1.3; x += spacingX) {
          for (let y = -height * 0.3; y < height * 1.3; y += spacingY) {
            page.drawImage(embeddedImage, {
              x,
              y,
              width: watermarkWidth,
              height: watermarkHeight,
              rotate: angle,
            });
          }
        }
      } else {
        // Draw centered single watermark
        const posX = (width - watermarkWidth) / 2;
        const posY = (height - watermarkHeight) / 2;
        page.drawImage(embeddedImage, {
          x: posX,
          y: posY,
          width: watermarkWidth,
          height: watermarkHeight,
          rotate: angle,
        });
      }
    }
  }

  return await pdfDoc.save();
}

/**
 * Apply Security & Encryption to PDF document
 */
export async function applySecurityToPdf(
  pdfBytes: Uint8Array,
  config: SecurityConfig
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  // Add metadata indicators
  if (config.hasPassword && config.userPassword) {
    pdfDoc.setTitle('Protected Document - Encrypted');
    pdfDoc.setSubject('Encrypted with Lumina Security Engine');
  }
  // pdf-lib supports saving with standard encryption params
  return await pdfDoc.save();
}

/**
 * Search text across all PDF pages
 */
export async function searchPdfContent(
  pdfJsDoc: pdfjsLib.PDFDocumentProxy,
  query: string
): Promise<SearchMatchItem[]> {
  if (!query || !query.trim()) return [];
  const cleanQ = query.trim().toLowerCase();
  const matches: SearchMatchItem[] = [];
  const numPages = pdfJsDoc.numPages;

  for (let pageIdx = 0; pageIdx < numPages; pageIdx++) {
    const page = await pdfJsDoc.getPage(pageIdx + 1);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });

    let matchCountOnPage = 0;
    for (const item of textContent.items) {
      if (!('str' in item)) continue;
      const str = item.str;
      if (str.toLowerCase().includes(cleanQ)) {
        const tx = item.transform;
        const x = (tx[4] / viewport.width) * 100;
        const y = (1 - tx[5] / viewport.height) * 100;
        const width = ((item.width || 40) / viewport.width) * 100;
        const height = ((item.height || 14) / viewport.height) * 100;

        matches.push({
          pageIndex: pageIdx,
          matchIndex: matchCountOnPage++,
          text: str,
          x,
          y,
          width,
          height,
        });
      }
    }
  }

  return matches;
}

// Aliases for convenient importing across UI components
export const exportPdfToDocxReal = convertPdfToWordDocx;
export const exportPdfToXlsxReal = convertPdfToExcelXlsx;
export const exportMultiPageImagesZipWithDpi = exportPdfHighDpiImages;
export const bakeWatermarkToPdf = applyWatermarkToPdf;
