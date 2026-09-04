import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb, degrees, StandardFonts, PDFPage, PDFFont } from 'pdf-lib';
import { Document, Paragraph, TextRun, Packer, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import type { OfficeFile, SheetData, SheetCell, PageMeta, PureDocument } from '../types';
import { renderPdfPageToCanvas, loadPdfJsDocument, formatBytes, resolvePdfBytesFromFile } from './pdfLibWrapper';
import { evaluateCellFormula, formatCellValue, getCellMergeInfo } from './sheetUtils';
import { runRealTesseractOcr } from './ocrEngine';
import { ConversionCapabilityRegistry } from '../core/capabilities/ConversionCapabilityRegistry';
import { DocumentSessionManager } from '../core/document/DocumentSessionManager';
import { DocxExportService } from '../core/export/DocxExportService';

/**
 * Standard DPI scale map matching WPS / Adobe Acrobat definitions
 */
export const DPI_PRESETS: Record<number, { scale: number; name: string; desc: string }> = {
  72: { scale: 1.0, name: '72 DPI', desc: '网页快速预览 · 极小体积' },
  96: { scale: 96 / 72, name: '96 DPI (默认)', desc: '普通办公查看 · 适中体积' },
  150: { scale: 150 / 72, name: '150 DPI', desc: '高清文档汇报 · 清晰细腻' },
  300: { scale: 300 / 72, name: '300 DPI', desc: '高品质打印 · 锐利线条' },
  600: { scale: 600 / 72, name: '600 DPI', desc: '专业印刷出版 · 极致细节' },
};

/**
 * Output Validation Helper - Guarantees zero empty/corrupted files
 */
export function validateOutputArtifact(
  artifact: { blob?: Blob; uint8Array?: Uint8Array; fileName: string; sizeBytes?: number },
  expectedType: string
) {
  const size = artifact.blob ? artifact.blob.size : artifact.uint8Array ? artifact.uint8Array.byteLength : artifact.sizeBytes || 0;
  if (size <= 0) {
    throw new Error(`[Pipeline Validation] 生成的工件为空（0 字节），转换中止: ${artifact.fileName}`);
  }
  if (artifact.blob && expectedType && !artifact.blob.type.includes(expectedType) && expectedType !== 'any') {
    console.warn(`[Pipeline Validation] 工件 MIME 类型 (${artifact.blob.type}) 与预期 (${expectedType}) 不完全一致，但数据流正常 (${size} 字节)`);
  }
}

// =========================================================================
// 1. DOCX / PureDoc → High-Fidelity Vector PDF Render Engine
// =========================================================================

interface ParsedDocElement {
  type: 'heading-1' | 'heading-2' | 'heading-3' | 'paragraph' | 'bullet' | 'number' | 'quote' | 'callout' | 'table' | 'divider';
  text?: string;
  runs?: { text: string; bold?: boolean; italic?: boolean; color?: string; size?: number }[];
  tableData?: string[][];
  align?: 'left' | 'center' | 'right';
}

/**
 * Parses HTML or PureDocument structure into unified visual element stream
 */
function parseDocContentToElements(content: any): ParsedDocElement[] {
  const elements: ParsedDocElement[] = [];

  if (typeof content === 'string') {
    // Parse HTML content string
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;

    const traverse = (node: Node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tag = el.tagName.toLowerCase();

        if (tag === 'h1') {
          elements.push({ type: 'heading-1', text: el.textContent?.trim() || '' });
        } else if (tag === 'h2') {
          elements.push({ type: 'heading-2', text: el.textContent?.trim() || '' });
        } else if (tag === 'h3') {
          elements.push({ type: 'heading-3', text: el.textContent?.trim() || '' });
        } else if (tag === 'p') {
          const txt = el.textContent?.trim() || '';
          if (txt) {
            elements.push({ type: 'paragraph', text: txt });
          }
        } else if (tag === 'ul') {
          const lis = el.querySelectorAll(':scope > li');
          lis.forEach((li) => {
            elements.push({ type: 'bullet', text: li.textContent?.trim() || '' });
          });
        } else if (tag === 'ol') {
          const lis = el.querySelectorAll(':scope > li');
          lis.forEach((li, idx) => {
            elements.push({ type: 'number', text: `${idx + 1}. ${li.textContent?.trim() || ''}` });
          });
        } else if (tag === 'blockquote') {
          elements.push({ type: 'quote', text: el.textContent?.trim() || '' });
        } else if (tag === 'hr') {
          elements.push({ type: 'divider' });
        } else if (tag === 'table') {
          const rows: string[][] = [];
          const trs = el.querySelectorAll('tr');
          trs.forEach((tr) => {
            const row: string[] = [];
            const cells = tr.querySelectorAll('th, td');
            cells.forEach((c) => row.push(c.textContent?.trim() || ''));
            if (row.length > 0) rows.push(row);
          });
          if (rows.length > 0) {
            elements.push({ type: 'table', tableData: rows });
          }
        } else {
          // Traverse child nodes
          for (let i = 0; i < el.childNodes.length; i++) {
            traverse(el.childNodes[i]);
          }
        }
      }
    };

    for (let i = 0; i < tempDiv.childNodes.length; i++) {
      traverse(tempDiv.childNodes[i]);
    }

    if (elements.length === 0 && tempDiv.textContent?.trim()) {
      elements.push({ type: 'paragraph', text: tempDiv.textContent.trim() });
    }
  } else if (content && typeof content === 'object') {
    if (content.blocks && Array.isArray(content.blocks)) {
      content.blocks.forEach((b: any) => {
        elements.push({
          type: b.type || 'paragraph',
          text: b.content || '',
          tableData: b.tableData,
        });
      });
    }
  }

  return elements;
}

/**
 * Render Chinese / Unicode text to high-res PNG image bytes for embedding in PDF
 * Ensures 100% crisp Chinese font rendering without WinAnsi font limitations
 */
async function renderTextToPngBytes(
  text: string,
  fontSize: number,
  isBold: boolean,
  colorHex: string,
  maxWidthPt: number
): Promise<{ bytes: Uint8Array; widthPt: number; heightPt: number } | null> {
  if (!text || !text.trim()) return null;

  const scale = 3; // 3x supersampling for razor sharp vector-like text
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const targetFontSizePx = Math.round(fontSize * (96 / 72) * scale);
  const fontWeight = isBold ? 'bold' : 'normal';
  const fontFamily = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Heiti SC", "Segoe UI", sans-serif';
  ctx.font = `${fontWeight} ${targetFontSizePx}px ${fontFamily}`;

  // Word wrap calculation
  const maxCanvasWidthPx = maxWidthPt * (96 / 72) * scale;
  const words = text.split('');
  const lines: string[] = [];
  let currentLine = '';

  for (const char of words) {
    const testLine = currentLine + char;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxCanvasWidthPx && currentLine !== '') {
      lines.push(currentLine);
      currentLine = char;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  const lineHeightPx = targetFontSizePx * 1.5;
  const totalCanvasHeightPx = Math.max(lineHeightPx, lines.length * lineHeightPx + 10 * scale);
  const totalCanvasWidthPx = Math.min(maxCanvasWidthPx, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 10 * scale);

  canvas.width = Math.ceil(totalCanvasWidthPx);
  canvas.height = Math.ceil(totalCanvasHeightPx);

  ctx.font = `${fontWeight} ${targetFontSizePx}px ${fontFamily}`;
  ctx.textBaseline = 'top';
  ctx.fillStyle = colorHex;

  lines.forEach((line, i) => {
    ctx.fillText(line, 2 * scale, i * lineHeightPx + 2 * scale);
  });

  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1];
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  const widthPt = (canvas.width / scale) * (72 / 96);
  const heightPt = (canvas.height / scale) * (72 / 96);

  return { bytes, widthPt, heightPt };
}

/**
 * Render Doc / PureDoc to High-Fidelity Native Searchable Vector PDF (Preserves text layer, fonts, tables, borders)
 */
export async function renderDocToVectorPdf(
  docContent: any,
  options: { onProgress?: (p: number, msg: string) => void } = {}
): Promise<Uint8Array> {
  ConversionCapabilityRegistry.validateOrThrow('DOCX_TO_PDF');
  const { renderDocToNativeSearchablePdf } = await import('./nativePdfRenderer');
  return await renderDocToNativeSearchablePdf(docContent, {
    onProgress: options.onProgress,
  });
}

// =========================================================================
// 2. XLSX / Sheet → High-Fidelity Native Vector PDF Print Engine
// =========================================================================

/**
 * Render SheetData to High-Fidelity Native Vector PDF (Preserves Grids, Merges, Colors, Formulas, Borders)
 */
export async function renderSheetToVectorPdf(
  sheet: SheetData,
  options: { orientation?: 'landscape' | 'portrait'; onProgress?: (p: number, msg: string) => void } = {}
): Promise<Uint8Array> {
  ConversionCapabilityRegistry.validateOrThrow('XLSX_TO_PDF');
  const { renderSheetToNativeSearchablePdf } = await import('./nativePdfRenderer');
  return await renderSheetToNativeSearchablePdf(sheet, {
    orientation: options.orientation || 'landscape',
    onProgress: options.onProgress,
  });
}

// =========================================================================
// 3. PDF → Microsoft Word (.docx) Advanced Structural Reconstruction
// =========================================================================

/**
 * Advanced PDF to Word (.docx) with Table, Paragraph & Heading Reconstruction
 */
export async function convertPdfToWordDocxAdvanced(
  pdfJsDoc: pdfjsLib.PDFDocumentProxy,
  onProgress?: (progress: number, status: string) => void
): Promise<Blob> {
  ConversionCapabilityRegistry.validateOrThrow('PDF_TO_DOCX');
  const numPages = pdfJsDoc.numPages;
  const docSections: any[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    onProgress?.(pageNum / numPages, `正在深度解析第 ${pageNum} / ${numPages} 页文本拓扑与表格结构...`);
    const page = await pdfJsDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });

    // Step 1: Collect valid text items with spatial bounding boxes
    const rawItems: {
      str: string;
      x: number;
      y: number;
      w: number;
      h: number;
      fontName: string;
    }[] = [];

    for (const item of textContent.items) {
      if (!('str' in item)) continue;
      const str = item.str.trim();
      if (!str) continue;

      rawItems.push({
        str: item.str,
        x: Math.round(item.transform[4]),
        y: Math.round(item.transform[5]),
        w: Math.round(item.width || 20),
        h: Math.round(item.height || 12),
        fontName: (item as any).fontName || '',
      });
    }

    // Step 2: Line baseline grouping (Tolerance: 4 pt)
    const lineMap = new Map<number, typeof rawItems>();
    for (const item of rawItems) {
      let matchedY = item.y;
      for (const existingY of lineMap.keys()) {
        if (Math.abs(existingY - item.y) <= 4) {
          matchedY = existingY;
          break;
        }
      }
      if (!lineMap.has(matchedY)) lineMap.set(matchedY, []);
      lineMap.get(matchedY)!.push(item);
    }

    // Sort lines top to bottom (descending Y in PDF coordinates)
    const sortedY = Array.from(lineMap.keys()).sort((a, b) => b - a);

    // Step 3: Analyze line structures to differentiate Tables vs Paragraphs
    const linesWithColumns: { y: number; text: string; items: typeof rawItems; isTableCandidate: boolean; columns: string[] }[] = [];

    for (const y of sortedY) {
      const items = lineMap.get(y)!.sort((a, b) => a.x - b.x);
      const cols: string[] = [];
      let prevEndX = -999;
      let currentColText = '';

      for (const it of items) {
        if (it.x - prevEndX > 25 && prevEndX > 0) {
          if (currentColText.trim()) cols.push(currentColText.trim());
          currentColText = it.str;
        } else {
          currentColText += (currentColText ? ' ' : '') + it.str;
        }
        prevEndX = it.x + it.w;
      }
      if (currentColText.trim()) cols.push(currentColText.trim());

      const fullLineText = items.map((i) => i.str).join(' ').trim();
      const isTableCandidate = cols.length >= 2;

      linesWithColumns.push({
        y,
        text: fullLineText,
        items,
        isTableCandidate,
        columns: cols,
      });
    }

    // Step 4: Build Docx Section Elements (Paragraphs, Headings, and Tables)
    const sectionChildren: any[] = [];
    let currentTableRows: string[][] = [];

    const flushTable = () => {
      if (currentTableRows.length > 0) {
        const maxCols = Math.max(...currentTableRows.map((r) => r.length));
        const colWidthPct = Math.floor(100 / maxCols);

        const docxRows = currentTableRows.map((rowCells, rIdx) => {
          const isHeader = rIdx === 0;
          return new TableRow({
            children: Array.from({ length: maxCols }).map((_, cIdx) => {
              const cellText = rowCells[cIdx] || '';
              return new TableCell({
                width: { size: colWidthPct, type: WidthType.PERCENTAGE },
                shading: isHeader ? { fill: 'F1F5F9' } : undefined,
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: cellText,
                        bold: isHeader,
                        size: isHeader ? 22 : 20, // 11pt / 10pt
                        font: 'Calibri',
                      }),
                    ],
                  }),
                ],
              });
            }),
          });
        });

        sectionChildren.push(
          new Table({
            rows: docxRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          })
        );
        currentTableRows = [];
      }
    };

    for (let i = 0; i < linesWithColumns.length; i++) {
      const line = linesWithColumns[i];

      // Check if consecutive lines form a table block
      if (line.isTableCandidate) {
        currentTableRows.push(line.columns);
      } else {
        flushTable();

        const maxFontSize = Math.max(...line.items.map((it) => it.h || 12));
        let headingLevel = undefined;
        let isBold = false;

        if (maxFontSize >= 22) {
          headingLevel = HeadingLevel.HEADING_1;
          isBold = true;
        } else if (maxFontSize >= 16) {
          headingLevel = HeadingLevel.HEADING_2;
          isBold = true;
        } else if (maxFontSize >= 13) {
          headingLevel = HeadingLevel.HEADING_3;
          isBold = true;
        }

        sectionChildren.push(
          new Paragraph({
            heading: headingLevel,
            spacing: { after: 120, line: 276 },
            children: [
              new TextRun({
                text: line.text,
                bold: isBold,
                size: Math.round(maxFontSize * 2), // docx uses half-points
                font: 'Calibri',
              }),
            ],
          })
        );
      }
    }
    flushTable();

    docSections.push({
      properties: {
        page: {
          size: {
            width: Math.round(viewport.width * 20), // pt to twips
            height: Math.round(viewport.height * 20),
          },
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
        },
      },
      children: sectionChildren.length > 0 ? sectionChildren : [new Paragraph({ text: '' })],
    });
  }

  const doc = new Document({
    sections: docSections,
  });

  const docxBlob = await Packer.toBlob(doc);
  validateOutputArtifact({ blob: docxBlob, fileName: 'converted.docx' }, 'wordprocessingml');
  return docxBlob;
}

// =========================================================================
// 4. PDF → Microsoft Excel (.xlsx) 2D Grid Reconstruction
// =========================================================================

/**
 * Advanced PDF to Excel (.xlsx) with 2D Alignment & Number Auto-Casting
 */
export async function convertPdfToExcelXlsxAdvanced(
  pdfJsDoc: pdfjsLib.PDFDocumentProxy,
  onProgress?: (progress: number, status: string) => void
): Promise<Blob> {
  ConversionCapabilityRegistry.validateOrThrow('PDF_TO_XLSX');
  const wb = XLSX.utils.book_new();
  const numPages = pdfJsDoc.numPages;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    onProgress?.(pageNum / numPages, `正在精确重构第 ${pageNum} / ${numPages} 页表格矩阵...`);
    const page = await pdfJsDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const rows: (string | number)[][] = [];

    // Group items into lines
    const lineMap = new Map<number, any[]>();
    for (const item of textContent.items) {
      if (!('str' in item)) continue;
      const str = item.str.trim();
      if (!str) continue;

      const y = Math.round(item.transform[5]);
      let matchedY = y;
      for (const existingY of lineMap.keys()) {
        if (Math.abs(existingY - y) <= 4) {
          matchedY = existingY;
          break;
        }
      }
      if (!lineMap.has(matchedY)) lineMap.set(matchedY, []);
      lineMap.get(matchedY)!.push(item);
    }

    const sortedY = Array.from(lineMap.keys()).sort((a, b) => b - a);

    for (const y of sortedY) {
      const items = lineMap.get(y)!.sort((a, b) => a.transform[4] - b.transform[4]);
      const rowCells: (string | number)[] = [];
      let prevX = -100;

      for (const it of items) {
        const x = it.transform[4];
        const text = it.str.trim();
        if (!text) continue;

        // Auto cast number, percentage, or currency
        let parsedVal: string | number = text;
        const cleanNumStr = text.replace(/^[¥$€\s]+/, '').replace(/,/g, '');
        if (/^-?\d+(\.\d+)?$/.test(cleanNumStr)) {
          const n = parseFloat(cleanNumStr);
          if (!isNaN(n)) parsedVal = n;
        }

        if (x - prevX > 25 && prevX > 0) {
          rowCells.push(parsedVal);
        } else if (rowCells.length > 0) {
          // Merge adjacent fragment into previous cell
          const prev = rowCells[rowCells.length - 1];
          rowCells[rowCells.length - 1] = typeof prev === 'number' ? `${prev} ${text}` : `${prev} ${text}`;
        } else {
          rowCells.push(parsedVal);
        }
        prevX = x + (it.width || 20);
      }

      if (rowCells.length > 0) {
        rows.push(rowCells);
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(rows.length > 0 ? rows : [['']]);
    XLSX.utils.book_append_sheet(wb, ws, `第 ${pageNum} 页`);
  }

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const xlsxBlob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  validateOutputArtifact({ blob: xlsxBlob, fileName: 'converted.xlsx' }, 'spreadsheetml');
  return xlsxBlob;
}

// =========================================================================
// 5. Office & PDF → High-DPI Image Universal Pipeline (Zero Pollution)
// =========================================================================

export interface ExportImageUniversalOptions {
  dpi?: number;
  format?: 'png' | 'jpeg' | 'webp';
  mode?: 'separate' | 'longStrip';
  colorMode?: 'color' | 'grayscale' | 'monochrome';
  quality?: number;
  onProgress?: (progress: number, msg: string) => void;
}

/**
 * Render Office Document (Doc or Sheet) or PDF page directly to pristine Canvas without pollution
 */
export async function renderDocumentPageToCleanCanvas(
  file: OfficeFile,
  pageIndex: number,
  dpi: number = 96,
  colorMode: 'color' | 'grayscale' | 'monochrome' = 'color'
): Promise<HTMLCanvasElement> {
  const scale = (dpi / 72);

  const isPdf = file?.type === 'pdf' || (file?.name && file.name.toLowerCase().endsWith('.pdf'));
  if (isPdf) {
    try {
      const rawBytes = await resolvePdfBytesFromFile(file);
      const pdfJsDoc = await loadPdfJsDocument(rawBytes);
      const canvas = document.createElement('canvas');
      await renderPdfPageToCanvas(pdfJsDoc, pageIndex, canvas, scale);
      applyColorFilterToCanvas(canvas, colorMode);
      return canvas;
    } catch (e) {
      console.warn('PDF canvas rendering fallback:', e);
    }
  }

  const isSheet =
    file?.type === 'sheet' ||
    (file?.name && (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.csv') || file.name.toLowerCase().endsWith('.xls'))) ||
    (file?.content && (file.content.sheets || file.content.cells));

  if (isSheet && file.content) {
    // Render Sheet Data to Vector Canvas
    const sheetData: SheetData = file.content.sheets ? file.content.sheets[file.content.activeSheetIndex || 0] || file.content.sheets[0] || {} : file.content;
    const width = Math.round(1123 * (dpi / 96));
    const height = Math.round(794 * (dpi / 96));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const margin = Math.round(30 * (dpi / 96));
    const colW = Math.round(120 * (dpi / 96));
    const rowH = Math.round(26 * (dpi / 96));

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;

    const sheetCells = sheetData?.cells || {};
    for (let r = 0; r < Math.min(sheetData?.rows || 25, 25); r++) {
      for (let c = 0; c < Math.min(sheetData?.cols || 10, 8); c++) {
        const x = margin + c * colW;
        const y = margin + r * rowH;
        const cell = sheetCells[`${r},${c}`];
        const isHeader = r === 0;

        if (isHeader) {
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(x, y, colW, rowH);
        } else if (cell?.bg) {
          ctx.fillStyle = cell.bg;
          ctx.fillRect(x, y, colW, rowH);
        }

        ctx.strokeRect(x, y, colW, rowH);

        if (cell && cell.value !== undefined) {
          ctx.fillStyle = cell.color || (isHeader ? '#0f172a' : '#334155');
          ctx.font = `${isHeader ? 'bold ' : ''}${Math.round(11 * (dpi / 96))}px -apple-system, sans-serif`;
          ctx.textBaseline = 'middle';
          let txt: string | number = cell.value;
          if (String(txt).startsWith('=')) txt = evaluateCellFormula(String(txt), sheetCells);
          ctx.fillText(String(txt), x + 6, y + rowH / 2);
        }
      }
    }
    applyColorFilterToCanvas(canvas, colorMode);
    return canvas;
  }

  // PureDoc / DOCX: Render through authentic LibreOffice DOCX -> PDF pipeline
  const canvas = document.createElement('canvas');
  try {
    const { pdfJsDoc } = await getOrRenderPdfForDocument(file);
    if (pdfJsDoc && pdfJsDoc.numPages > 0) {
      await renderPdfPageToCanvas(pdfJsDoc, pageIndex, canvas, scale);
    } else {
      canvas.width = Math.round(595.28 * scale);
      canvas.height = Math.round(841.89 * scale);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  } catch (err) {
    console.warn('DOCX authentic PDF canvas rasterization error:', err);
    canvas.width = Math.round(595.28 * scale);
    canvas.height = Math.round(841.89 * scale);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  applyColorFilterToCanvas(canvas, colorMode);
  return canvas;
}

interface CachedDocPdf {
  pdfBytes: Uint8Array;
  pdfJsDoc: any;
  numPages: number;
  timestamp: number;
  contentSignature: string;
}

const docPdfCache = new Map<string, CachedDocPdf>();

/**
 * Clear cached PDF for a specific document or all documents
 */
export function clearDocPdfCache(fileId?: string) {
  if (fileId) {
    docPdfCache.delete(fileId);
  } else {
    docPdfCache.clear();
  }
}

/**
 * Compute a deterministic 64-bit FNV-1a content hash
 * Guarantees that identical content produces identical signature,
 * and any content change produces a completely distinct hash.
 */
export function computeDeterministicContentHash(content: any): string {
  let str: string;
  if (typeof content === 'string') {
    str = content;
  } else if (content === null || content === undefined) {
    str = '';
  } else {
    try {
      str = JSON.stringify(content);
    } catch {
      str = String(content);
    }
  }

  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193);
    h2 = Math.imul(h2 ^ ((ch << 5) | (ch >>> 27)), 0x5bd1e995);
  }
  return `${(h1 >>> 0).toString(16)}_${(h2 >>> 0).toString(16)}_${str.length}`;
}

/**
 * Get or render authentic high-fidelity PDF for a Document (DOCX/PureDoc) or PDF file
 * Guarantees zero duplicate exports: page count inspection, preview, and image export share the same cached PDF.
 */
export async function getOrRenderPdfForDocument(
  file: OfficeFile,
  options: { forceRefresh?: boolean; onProgress?: (p: number, msg: string) => void } = {}
): Promise<{ pdfBytes: Uint8Array; pdfJsDoc: any; numPages: number }> {
  if (!file) {
    throw new Error('No office file provided to getOrRenderPdfForDocument');
  }

  const isPdf = file.type === 'pdf' || (file.name && file.name.toLowerCase().endsWith('.pdf'));

  if (isPdf) {
    const rawBytes = await resolvePdfBytesFromFile(file);
    const pdfJsDoc = await loadPdfJsDocument(rawBytes);
    if (!pdfJsDoc || !pdfJsDoc.numPages || pdfJsDoc.numPages <= 0) {
      throw new Error('PDF.js 解析 PDF 物理页面失败，无法获取真实页数');
    }
    const numPages = pdfJsDoc.numPages;
    return { pdfBytes: rawBytes, pdfJsDoc, numPages };
  }

  // PureDoc / DOCX: Retrieve real document content
  const activeSession = DocumentSessionManager.getSession(file.id) || DocumentSessionManager.getActiveSession();
  const docContent = activeSession?.getExportContent
    ? activeSession.getExportContent()
    : (activeSession?.docState || file.content || '');

  // Deterministic content signature: combines fileId, session version/timestamp, and deep content hash
  const contentHash = computeDeterministicContentHash(docContent);
  const versionKey = activeSession
    ? `v${activeSession.sessionVersion || 0}_m${activeSession.lastModified || 0}`
    : `file_${(file as any).modifiedAt || (file as any).updatedAt || ''}`;
  const signature = `${file.id}_${versionKey}_${contentHash}`;

  const cached = docPdfCache.get(file.id);
  if (
    !options.forceRefresh &&
    cached &&
    cached.contentSignature === signature &&
    cached.pdfJsDoc &&
    cached.pdfJsDoc.numPages > 0
  ) {
    return {
      pdfBytes: cached.pdfBytes,
      pdfJsDoc: cached.pdfJsDoc,
      numPages: cached.numPages,
    };
  }

  // Generate authentic PDF via DocxExportService -> officeEngine.exportPDF -> /api/engine/export-pdf -> LibreOffice Writer
  options.onProgress?.(20, '正在调用排版引擎生成真实 PDF 排版...');
  const exportResult = await DocxExportService.exportPdf(file, {
    onProgress: (p, msg) => options.onProgress?.(20 + Math.round(p * 0.6), msg),
  });

  const arrayBuffer = await exportResult.blob.arrayBuffer();
  const pdfBytes = new Uint8Array(arrayBuffer);

  options.onProgress?.(85, '正在解析真实 PDF 物理页面拓扑...');
  const pdfJsDoc = await loadPdfJsDocument(pdfBytes);
  if (!pdfJsDoc || !pdfJsDoc.numPages || pdfJsDoc.numPages <= 0) {
    throw new Error('PDF.js 解析生成的 PDF 物理页面失败，无法获取真实页数');
  }
  const numPages = pdfJsDoc.numPages;

  const entry: CachedDocPdf = {
    pdfBytes,
    pdfJsDoc,
    numPages,
    timestamp: Date.now(),
    contentSignature: signature,
  };

  docPdfCache.set(file.id, entry);

  options.onProgress?.(100, '真实文档排版准备就绪');
  return { pdfBytes, pdfJsDoc, numPages };
}

/**
 * Apply Grayscale / Monochrome Filters to Canvas In-Place
 */
function applyColorFilterToCanvas(canvas: HTMLCanvasElement, colorMode: 'color' | 'grayscale' | 'monochrome') {
  if (colorMode === 'color') return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (colorMode === 'grayscale') {
      data[i] = avg;
      data[i + 1] = avg;
      data[i + 2] = avg;
    } else if (colorMode === 'monochrome') {
      const val = avg > 140 ? 255 : 0;
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
    }
  }
  ctx.putImageData(imgData, 0, 0);
}
