import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { SheetData, SheetCell, PureDocument, SheetMergeRange } from '../types';
import { evaluateCellFormula, formatCellValue, colIndexToLetter, getCellMergeInfo } from './sheetUtils';
import { DocumentExportAdapter, StructuredDocNode, FormattedRun } from '../core/export/DocumentExportAdapter';

export interface NativePdfExportOptions {
  fileName?: string;
  orientation?: 'portrait' | 'landscape';
  pageSize?: 'a4' | 'letter' | 'a3';
  margin?: number;
  dpi?: number;
  headerText?: string;
  footerText?: string;
  debugMode?: boolean;
  onProgress?: (progress: number, message: string) => void;
}

/**
 * Helper to extract a standalone TTF from a TrueType Collection (.ttc) buffer in memory
 */
export function extractTtfFromTtcBuffer(buf: Buffer | Uint8Array, fontIndex = 0): Buffer {
  const nodeBuf = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  const tag = nodeBuf.toString('ascii', 0, 4);
  if (tag !== 'ttcf') {
    return nodeBuf;
  }
  const numFonts = nodeBuf.readUInt32BE(8);
  if (fontIndex >= numFonts) fontIndex = 0;

  const offsetTablePos = nodeBuf.readUInt32BE(12 + fontIndex * 4);
  const sfntVersion = nodeBuf.readUInt32BE(offsetTablePos);
  const numTables = nodeBuf.readUInt16BE(offsetTablePos + 4);
  const searchRange = nodeBuf.readUInt16BE(offsetTablePos + 6);
  const entrySelector = nodeBuf.readUInt16BE(offsetTablePos + 8);
  const rangeShift = nodeBuf.readUInt16BE(offsetTablePos + 10);

  const headerSize = 12 + numTables * 16;
  const tables: Array<{ tag: string; checkSum: number; offset: number; length: number }> = [];
  let tablePos = offsetTablePos + 12;
  for (let i = 0; i < numTables; i++) {
    const tableTag = nodeBuf.toString('ascii', tablePos, tablePos + 4);
    const checkSum = nodeBuf.readUInt32BE(tablePos + 4);
    const offset = nodeBuf.readUInt32BE(tablePos + 8);
    const length = nodeBuf.readUInt32BE(tablePos + 12);
    tables.push({ tag: tableTag, checkSum, offset, length });
    tablePos += 16;
  }

  let currentOffset = headerSize;
  const tableDataBuffers: Buffer[] = [];
  const updatedTables: Array<{ tag: string; checkSum: number; offset: number; length: number }> = [];

  for (const t of tables) {
    const data = nodeBuf.subarray(t.offset, t.offset + t.length);
    const paddedLength = (t.length + 3) & ~3;
    const padding = Buffer.alloc(paddedLength - t.length, 0);

    updatedTables.push({
      tag: t.tag,
      checkSum: t.checkSum,
      offset: currentOffset,
      length: t.length,
    });

    tableDataBuffers.push(data);
    if (padding.length > 0) tableDataBuffers.push(padding);
    currentOffset += paddedLength;
  }

  const outHeader = Buffer.alloc(headerSize);
  outHeader.writeUInt32BE(sfntVersion, 0);
  outHeader.writeUInt16BE(numTables, 4);
  outHeader.writeUInt16BE(searchRange, 6);
  outHeader.writeUInt16BE(entrySelector, 8);
  outHeader.writeUInt16BE(rangeShift, 10);

  let headerPos = 12;
  for (const t of updatedTables) {
    outHeader.write(t.tag, headerPos, 4, 'ascii');
    outHeader.writeUInt32BE(t.checkSum, headerPos + 4);
    outHeader.writeUInt32BE(t.offset, headerPos + 8);
    outHeader.writeUInt32BE(t.length, headerPos + 12);
    headerPos += 16;
  }

  return Buffer.concat([outHeader, ...tableDataBuffers]);
}

/**
 * Helper to load embedded Unicode TTF font for CJK and extended scripts
 */
export async function loadUnicodeFont(pdfDoc: PDFDocument): Promise<PDFFont | null> {
  try {
    pdfDoc.registerFontkit(fontkit);
    if (typeof process !== 'undefined' && process.versions?.node) {
      const fs = await import('fs');
      const fontCandidates = [
        '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttf',
        '/tmp/wqy-zenhei.ttf',
        '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
        '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
        '/usr/share/fonts/truetype/arphic/uming.ttc',
        '/usr/share/fonts/truetype/arphic/ukai.ttc',
      ];
      for (const p of fontCandidates) {
        if (fs.existsSync(p)) {
          const rawBuf = fs.readFileSync(p);
          const ttfBuf = p.endsWith('.ttc') ? extractTtfFromTtcBuffer(rawBuf, 0) : rawBuf;
          return await pdfDoc.embedFont(ttfBuf, { subset: true });
        }
      }
    }
  } catch (err) {
    console.warn('[nativePdfRenderer] Unicode font load fallback:', err);
  }
  return null;
}

/**
 * Helper to convert hex color string (#RRGGBB or RRGGBB) to rgb() for pdf-lib
 */
function hexToRgb(hex?: string, fallback = rgb(0.1, 0.15, 0.2)) {
  if (!hex) return fallback;
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return fallback;
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  if (isNaN(r) || isNaN(g) || isNaN(b)) return fallback;
  return rgb(r, g, b);
}

/**
 * Safely draw text on a PDF page without crashing, supporting bold simulation for Unicode CJK fonts
 */
function drawSafeText(
  page: PDFPage,
  text: string,
  options: Parameters<PDFPage['drawText']>[1],
  isBold?: boolean
) {
  if (!text) return;
  try {
    page.drawText(text, options);
    if (isBold) {
      // Subtle typographic bold strike for CJK characters
      page.drawText(text, {
        ...options,
        x: (options.x || 0) + 0.35,
      });
    }
  } catch {
    try {
      const sanitized = text
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/[—–]/g, '-')
        .replace(/[•]/g, '*');
      page.drawText(sanitized, options);
      if (isBold) {
        page.drawText(sanitized, {
          ...options,
          x: (options.x || 0) + 0.35,
        });
      }
    } catch {}
  }
}

/**
 * Text wrapper that splits a string into lines that fit within maxWidth using a given font & size.
 */
function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  if (!text) return [''];
  const paragraphs = text.split('\n');
  const result: string[] = [];

  for (const para of paragraphs) {
    if (!para) {
      result.push('');
      continue;
    }
    
    // For Asian/CJK characters, break by character; for Western words, break by space
    const isCjk = /[\u4e00-\u9fa5\u3040-\u30ff\u3400-\u4dbf]/.test(para);
    if (isCjk) {
      let currentLine = '';
      for (const char of para) {
        const testLine = currentLine + char;
        let testWidth = 0;
        try {
          testWidth = font.widthOfTextAtSize(testLine, fontSize);
        } catch {
          // Fallback width calculation for characters outside standard font
          testWidth = testLine.length * (fontSize * 0.6);
        }
        if (testWidth > maxWidth && currentLine) {
          result.push(currentLine);
          currentLine = char;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) result.push(currentLine);
    } else {
      const words = para.split(' ');
      let currentLine = '';
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        let testWidth = 0;
        try {
          testWidth = font.widthOfTextAtSize(testLine, fontSize);
        } catch {
          testWidth = testLine.length * (fontSize * 0.55);
        }
        if (testWidth > maxWidth && currentLine) {
          result.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) result.push(currentLine);
    }
  }

  return result;
}

/**
 * 1. Document Model → 100% Pure Vector PDF Layout Engine
 * Zero html2canvas rasterization, mathematical pagination and precise typography.
 */
export async function renderDocToNativeSearchablePdf(
  docContent: any,
  options: NativePdfExportOptions = {}
): Promise<Uint8Array> {
  options.onProgress?.(0.1, '正在初始化矢量排版引擎与页面坐标系...');

  const { nodes } = DocumentExportAdapter.parseToNodes(docContent);
  const pdfDoc = await PDFDocument.create();

  const unicodeFont = await loadUnicodeFont(pdfDoc);
  const fontRegular = unicodeFont || (await pdfDoc.embedFont(StandardFonts.Helvetica));
  const fontBold = unicodeFont || (await pdfDoc.embedFont(StandardFonts.HelveticaBold));
  const fontItalic = unicodeFont || (await pdfDoc.embedFont(StandardFonts.HelveticaOblique));
  const fontBoldItalic = unicodeFont || (await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique));

  const isLandscape = options.orientation === 'landscape';
  const pageWidth = isLandscape ? 841.89 : 595.28;
  const pageHeight = isLandscape ? 595.28 : 841.89;
  const margin = options.margin ?? 54;
  const printableWidth = pageWidth - margin * 2;
  const bottomMargin = margin;

  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let currentY = pageHeight - margin;
  let pageIndex = 1;
  const pages: PDFPage[] = [currentPage];

  const ensureSpace = (neededHeight: number): PDFPage => {
    if (currentY - neededHeight < bottomMargin) {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      pages.push(currentPage);
      currentY = pageHeight - margin;
      pageIndex++;
    }
    return currentPage;
  };

  options.onProgress?.(0.3, '正在执行文档流节点矢量测量与分页计算...');

  const layoutSettings = (docContent as any)?.layoutSettings;
  const headerText = layoutSettings?.headerText || options.headerText;
  const footerText = layoutSettings?.footerText || options.footerText;

  for (const node of nodes) {
    if (node.type === 'page-break') {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      pages.push(currentPage);
      currentY = pageHeight - margin;
      pageIndex++;
      continue;
    }

    if (node.type === 'heading') {
      const level = node.level || 1;
      const fontSize = level === 1 ? 20 : level === 2 ? 15 : level === 3 ? 13 : 11;
      const lineHeight = fontSize * 1.35;
      const spaceBefore = level === 1 ? 18 : level === 2 ? 14 : 10;
      const spaceAfter = level === 1 ? 8 : 6;

      const fullText = node.runs.map((r) => r.text).join('');
      const lines = wrapText(fullText, fontBold, fontSize, printableWidth);
      const totalBlockHeight = spaceBefore + lines.length * lineHeight + spaceAfter;

      ensureSpace(totalBlockHeight);
      currentY -= spaceBefore;

      for (const line of lines) {
        let alignX = margin;
        if (node.align === 'center') {
          try {
            const w = fontBold.widthOfTextAtSize(line, fontSize);
            alignX = margin + Math.max(0, (printableWidth - w) / 2);
          } catch {}
        } else if (node.align === 'right') {
          try {
            const w = fontBold.widthOfTextAtSize(line, fontSize);
            alignX = margin + Math.max(0, printableWidth - w);
          } catch {}
        }

        drawSafeText(
          currentPage,
          line,
          {
            x: alignX,
            y: currentY - fontSize,
            size: fontSize,
            font: fontBold,
            color: hexToRgb(node.runs[0]?.color, rgb(0.06, 0.09, 0.16)),
          },
          true
        );
        currentY -= lineHeight;
      }
      currentY -= spaceAfter;
    } else if (node.type === 'paragraph') {
      const fontSize = 11;
      const lineHeight = 17;
      const fullText = node.runs.map((r) => r.text).join('');
      const isBold = node.runs.some((r) => r.bold);
      const isItalic = node.runs.some((r) => r.italic);
      const activeFont = isBold && isItalic ? fontBoldItalic : isBold ? fontBold : isItalic ? fontItalic : fontRegular;

      const lines = wrapText(fullText, activeFont, fontSize, printableWidth);
      const totalBlockHeight = lines.length * lineHeight + 5;

      ensureSpace(totalBlockHeight);

      for (const line of lines) {
        let alignX = margin;
        if (node.align === 'center') {
          try {
            const w = activeFont.widthOfTextAtSize(line, fontSize);
            alignX = margin + Math.max(0, (printableWidth - w) / 2);
          } catch {}
        } else if (node.align === 'right') {
          try {
            const w = activeFont.widthOfTextAtSize(line, fontSize);
            alignX = margin + Math.max(0, printableWidth - w);
          } catch {}
        }

        drawSafeText(
          currentPage,
          line,
          {
            x: alignX,
            y: currentY - fontSize,
            size: fontSize,
            font: activeFont,
            color: hexToRgb(node.runs[0]?.color, rgb(0.2, 0.25, 0.33)),
          },
          isBold
        );
        currentY -= lineHeight;
      }
      currentY -= 5;
    } else if (node.type === 'bullet') {
      const fontSize = 11;
      const lineHeight = 17;
      const indent = 16;
      const fullText = node.runs.map((r) => r.text).join('');
      const lines = wrapText(fullText, fontRegular, fontSize, printableWidth - indent);

      ensureSpace(lines.length * lineHeight + 3);

      drawSafeText(
        currentPage,
        '•',
        {
          x: margin + 2,
          y: currentY - fontSize,
          size: fontSize + 2,
          font: fontBold,
          color: rgb(0.3, 0.35, 0.4),
        },
        true
      );

      for (const line of lines) {
        drawSafeText(currentPage, line, {
          x: margin + indent,
          y: currentY - fontSize,
          size: fontSize,
          font: fontRegular,
          color: rgb(0.2, 0.25, 0.33),
        });
        currentY -= lineHeight;
      }
      currentY -= 3;
    } else if (node.type === 'ordered') {
      const fontSize = 11;
      const lineHeight = 17;
      const indent = 18;
      const fullText = node.runs.map((r) => r.text).join('');
      const lines = wrapText(fullText, fontRegular, fontSize, printableWidth - indent);

      ensureSpace(lines.length * lineHeight + 3);

      drawSafeText(
        currentPage,
        '1.',
        {
          x: margin,
          y: currentY - fontSize,
          size: fontSize,
          font: fontBold,
          color: rgb(0.3, 0.35, 0.4),
        },
        true
      );

      for (const line of lines) {
        drawSafeText(currentPage, line, {
          x: margin + indent,
          y: currentY - fontSize,
          size: fontSize,
          font: fontRegular,
          color: rgb(0.2, 0.25, 0.33),
        });
        currentY -= lineHeight;
      }
      currentY -= 3;
    } else if (node.type === 'quote') {
      const fontSize = 10;
      const lineHeight = 15;
      const indent = 16;
      const fullText = node.runs.map((r) => r.text).join('');
      const lines = wrapText(fullText, fontItalic, fontSize, printableWidth - indent);
      const quoteHeight = lines.length * lineHeight + 8;

      ensureSpace(quoteHeight + 6);

      // Left vertical quote bar
      currentPage.drawRectangle({
        x: margin,
        y: currentY - quoteHeight,
        width: 3,
        height: quoteHeight,
        color: rgb(0.23, 0.51, 0.96),
      });

      currentY -= 4;
      for (const line of lines) {
        drawSafeText(currentPage, line, {
          x: margin + indent,
          y: currentY - fontSize,
          size: fontSize,
          font: fontItalic,
          color: rgb(0.28, 0.33, 0.41),
        });
        currentY -= lineHeight;
      }
      currentY -= 6;
    } else if (node.type === 'divider') {
      ensureSpace(18);
      currentY -= 8;
      currentPage.drawLine({
        start: { x: margin, y: currentY },
        end: { x: margin + printableWidth, y: currentY },
        thickness: 0.75,
        color: rgb(0.88, 0.91, 0.94),
      });
      currentY -= 10;
    } else if (node.type === 'table' && node.tableData && node.tableData.rows.length > 0) {
      const rows = node.tableData.rows;
      const numCols = Math.max(...rows.map((r) => r.length), 1);
      const colWidth = printableWidth / numCols;
      const cellPadding = 6;
      const cellFontSize = 9.5;
      const cellLineHeight = 13;

      for (let rIdx = 0; rIdx < rows.length; rIdx++) {
        const row = rows[rIdx];
        const isHeader = rIdx === 0;
        const activeFont = isHeader ? fontBold : fontRegular;

        // Calculate max lines in this row
        let maxLines = 1;
        const cellLinesArr: string[][] = [];
        for (let cIdx = 0; cIdx < row.length; cIdx++) {
          const c = row[cIdx];
          const lines = wrapText(c.text || '', activeFont, cellFontSize, colWidth - cellPadding * 2);
          cellLinesArr.push(lines);
          if (lines.length > maxLines) maxLines = lines.length;
        }

        const rowHeight = maxLines * cellLineHeight + cellPadding * 2;
        ensureSpace(rowHeight);

        // Render each cell
        let currentX = margin;
        for (let cIdx = 0; cIdx < row.length; cIdx++) {
          const c = row[cIdx];
          const lines = cellLinesArr[cIdx];
          const spanCols = c.colSpan || 1;
          const actualCellWidth = colWidth * spanCols;

          // Background fill
          const bgColor = c.bg ? hexToRgb(c.bg) : isHeader ? rgb(0.95, 0.96, 0.98) : rgb(1, 1, 1);
          currentPage.drawRectangle({
            x: currentX,
            y: currentY - rowHeight,
            width: actualCellWidth,
            height: rowHeight,
            color: bgColor,
            borderColor: rgb(0.8, 0.84, 0.88),
            borderWidth: 0.75,
          });

          // Cell text
          let textY = currentY - cellPadding - cellFontSize;
          for (const line of lines) {
            drawSafeText(
              currentPage,
              line,
              {
                x: currentX + cellPadding,
                y: textY,
                size: cellFontSize,
                font: activeFont,
                color: isHeader ? rgb(0.06, 0.09, 0.16) : rgb(0.2, 0.25, 0.33),
              },
              isHeader
            );
            textY -= cellLineHeight;
          }

          currentX += actualCellWidth;
        }
        currentY -= rowHeight;
      }
      currentY -= 8;
    }
  }

  // Draw Header / Footer / Page Numbers
  options.onProgress?.(0.85, '正在写入页眉页脚编码与元数据...');
  const totalPages = pages.length;
  pages.forEach((page, idx) => {
    // Header
    if (headerText) {
      try {
        const hw = fontRegular.widthOfTextAtSize(headerText, 8.5);
        drawSafeText(page, headerText, {
          x: pageWidth - margin - hw,
          y: pageHeight - 30,
          size: 8.5,
          font: fontRegular,
          color: rgb(0.5, 0.55, 0.6),
        });
      } catch {}
    }

    // Custom Footer Text
    if (footerText) {
      try {
        drawSafeText(page, footerText, {
          x: margin,
          y: 24,
          size: 8.5,
          font: fontRegular,
          color: rgb(0.5, 0.55, 0.6),
        });
      } catch {}
    }

    // Page Number
    const pageNumText = `${idx + 1} / ${totalPages}`;
    try {
      const w = fontRegular.widthOfTextAtSize(pageNumText, 8.5);
      drawSafeText(page, pageNumText, {
        x: pageWidth - margin - w,
        y: 24,
        size: 8.5,
        font: fontRegular,
        color: rgb(0.6, 0.65, 0.7),
      });
    } catch {}
  });

  options.onProgress?.(1.0, '矢量 PDF 生成完成');
  return await pdfDoc.save();
}

/**
 * 2. Spreadsheet Model → 100% Pure Vector PDF Engine
 * Mathematical cell grids, formula evaluation, border rendering, and automatic pagination.
 */
export async function renderSheetToNativeSearchablePdf(
  sheet: SheetData,
  options: NativePdfExportOptions = {}
): Promise<Uint8Array> {
  options.onProgress?.(0.1, '正在分析表格数据矩阵与布局...');

  const pdfDoc = await PDFDocument.create();
  const unicodeFont = await loadUnicodeFont(pdfDoc);
  const fontRegular = unicodeFont || (await pdfDoc.embedFont(StandardFonts.Helvetica));
  const fontBold = unicodeFont || (await pdfDoc.embedFont(StandardFonts.HelveticaBold));

  const isLandscape = options.orientation !== 'portrait';
  const pageWidth = isLandscape ? 841.89 : 595.28;
  const pageHeight = isLandscape ? 595.28 : 841.89;
  const margin = options.margin ?? 36;
  const printableWidth = pageWidth - margin * 2;
  const bottomMargin = margin + 20;

  // Find effective bounds
  let maxR = 0;
  let maxC = 0;
  const cellsMap = sheet.cells || {};
  Object.keys(cellsMap).forEach((k) => {
    const parts = k.split(',');
    if (parts.length === 2) {
      const r = parseInt(parts[0], 10);
      const c = parseInt(parts[1], 10);
      if (!isNaN(r) && r > maxR) maxR = r;
      if (!isNaN(c) && c > maxC) maxC = c;
    }
  });

  const totalCols = Math.min(Math.max(maxC + 1, 4), 26);
  const totalRows = Math.max(maxR + 1, 1);

  // Column width calculations
  const rawColWidths: number[] = [];
  for (let c = 0; c < totalCols; c++) {
    rawColWidths.push(sheet.colWidths?.[c] || 90);
  }
  const totalRawWidth = rawColWidths.reduce((a, b) => a + b, 0);
  const colWidths = rawColWidths.map((w) => (w / totalRawWidth) * printableWidth);

  const rowHeaderWidth = 28;
  const dataPrintableWidth = printableWidth - rowHeaderWidth;
  const adjustedColWidths = colWidths.map((w) => (w / printableWidth) * dataPrintableWidth);

  const pages: PDFPage[] = [];
  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  pages.push(currentPage);
  let currentY = pageHeight - margin;

  const rowHeight = 22;
  const fontSize = 8.5;

  const drawHeader = () => {
    // Top-left corner
    currentPage.drawRectangle({
      x: margin,
      y: currentY - rowHeight,
      width: rowHeaderWidth,
      height: rowHeight,
      color: rgb(0.95, 0.96, 0.98),
      borderColor: rgb(0.8, 0.84, 0.88),
      borderWidth: 0.75,
    });

    let currentX = margin + rowHeaderWidth;
    for (let c = 0; c < totalCols; c++) {
      const colW = adjustedColWidths[c];
      currentPage.drawRectangle({
        x: currentX,
        y: currentY - rowHeight,
        width: colW,
        height: rowHeight,
        color: rgb(0.95, 0.96, 0.98),
        borderColor: rgb(0.8, 0.84, 0.88),
        borderWidth: 0.75,
      });

      const colLetter = colIndexToLetter(c);
      const textW = fontBold.widthOfTextAtSize(colLetter, fontSize);
      drawSafeText(currentPage, colLetter, {
        x: currentX + (colW - textW) / 2,
        y: currentY - rowHeight + 6,
        size: fontSize,
        font: fontBold,
        color: rgb(0.2, 0.25, 0.33),
      });

      currentX += colW;
    }
    currentY -= rowHeight;
  };

  drawHeader();

  for (let r = 0; r < totalRows; r++) {
    if (currentY - rowHeight < bottomMargin) {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      pages.push(currentPage);
      currentY = pageHeight - margin;
      drawHeader();
    }

    // Row Header (1, 2, 3...)
    currentPage.drawRectangle({
      x: margin,
      y: currentY - rowHeight,
      width: rowHeaderWidth,
      height: rowHeight,
      color: rgb(0.97, 0.98, 0.99),
      borderColor: rgb(0.8, 0.84, 0.88),
      borderWidth: 0.75,
    });

    const rowNumStr = String(r + 1);
    const numW = fontRegular.widthOfTextAtSize(rowNumStr, fontSize - 1);
    drawSafeText(currentPage, rowNumStr, {
      x: margin + (rowHeaderWidth - numW) / 2,
      y: currentY - rowHeight + 6,
      size: fontSize - 1,
      font: fontRegular,
      color: rgb(0.4, 0.45, 0.5),
    });

    let currentX = margin + rowHeaderWidth;
    for (let c = 0; c < totalCols; c++) {
      const colW = adjustedColWidths[c];
      const merge = getCellMergeInfo(r, c, sheet.merges);
      if (merge.isMerged && !merge.isMaster) {
        currentX += colW;
        continue;
      }

      const cell = cellsMap[`${r},${c}`];
      let displayVal = '';
      if (cell && cell.value !== undefined && cell.value !== '') {
        const evaluated = String(cell.value).startsWith('=')
          ? evaluateCellFormula(String(cell.value), cellsMap)
          : cell.value;
        displayVal = formatCellValue(cell, evaluated);
      }

      const spanCols = merge.isMaster ? merge.colSpan : 1;
      const actualCellWidth = adjustedColWidths.slice(c, c + spanCols).reduce((a, b) => a + b, 0);

      const bgColor = cell?.bg ? hexToRgb(cell.bg) : rgb(1, 1, 1);
      currentPage.drawRectangle({
        x: currentX,
        y: currentY - rowHeight,
        width: actualCellWidth,
        height: rowHeight,
        color: bgColor,
        borderColor: rgb(0.88, 0.91, 0.94),
        borderWidth: 0.75,
      });

      if (displayVal) {
        const activeFont = cell?.bold ? fontBold : fontRegular;
        const textColor = hexToRgb(cell?.color, rgb(0.12, 0.16, 0.22));

        // Truncate text if exceeds width
        let safeText = displayVal;
        try {
          while (safeText.length > 1 && activeFont.widthOfTextAtSize(safeText, fontSize) > actualCellWidth - 8) {
            safeText = safeText.substring(0, safeText.length - 1);
          }
        } catch {
          safeText = safeText.substring(0, 20);
        }

        let textX = currentX + 4;
        if (cell?.align === 'right') {
          try {
            const tw = activeFont.widthOfTextAtSize(safeText, fontSize);
            textX = currentX + actualCellWidth - tw - 4;
          } catch {}
        } else if (cell?.align === 'center') {
          try {
            const tw = activeFont.widthOfTextAtSize(safeText, fontSize);
            textX = currentX + (actualCellWidth - tw) / 2;
          } catch {}
        }

        drawSafeText(currentPage, safeText, {
          x: textX,
          y: currentY - rowHeight + 6,
          size: fontSize,
          font: activeFont,
          color: textColor,
        });
      }

      currentX += colW;
    }
    currentY -= rowHeight;
  }

  // Draw Page numbers
  const totalPages = pages.length;
  pages.forEach((p, idx) => {
    const txt = `Page ${idx + 1} of ${totalPages}`;
    try {
      const tw = fontRegular.widthOfTextAtSize(txt, 8);
      drawSafeText(p, txt, {
        x: pageWidth - margin - tw,
        y: 16,
        size: 8,
        font: fontRegular,
        color: rgb(0.5, 0.55, 0.6),
      });
    } catch {}
  });

  options.onProgress?.(1.0, '表格矢量 PDF 生成完成');
  return await pdfDoc.save();
}
