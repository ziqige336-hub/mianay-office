import * as XLSX from 'xlsx';
import { PDFDocument, rgb, StandardFonts, PDFPage } from 'pdf-lib';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  WidthType,
  BorderStyle,
} from 'docx';
import { DocxParser } from '../core/document/DocxParser';
import { renderDocToNativeSearchablePdf, loadUnicodeFont } from '../utils/nativePdfRenderer';

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

function drawSafeText(page: PDFPage, text: string, options: Parameters<PDFPage['drawText']>[1]) {
  if (!text) return;
  try {
    page.drawText(text, options);
  } catch {
    try {
      const sanitized = text
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/[—–]/g, '-')
        .replace(/[•]/g, '*');
      page.drawText(sanitized, options);
    } catch {}
  }
}

function wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  if (!text) return [''];
  const paragraphs = text.split('\n');
  const result: string[] = [];

  for (const para of paragraphs) {
    if (!para) {
      result.push('');
      continue;
    }
    const isCjk = /[\u4e00-\u9fa5\u3040-\u30ff\u3400-\u4dbf]/.test(para);
    if (isCjk) {
      let currentLine = '';
      for (const char of para) {
        const testLine = currentLine + char;
        let testWidth = 0;
        try {
          testWidth = font.widthOfTextAtSize(testLine, fontSize);
        } catch {
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

export class ServerEngineFallback {
  /**
   * Convert CSV or Spreadsheet matrix into Vector PDF
   */
  public static async renderSheetToPdf(
    input: string | Buffer | Uint8Array,
    title: string = 'Spreadsheet'
  ): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const unicodeFont = await loadUnicodeFont(pdfDoc);
    const fontRegular = unicodeFont || (await pdfDoc.embedFont(StandardFonts.Helvetica));
    const fontBold = unicodeFont || (await pdfDoc.embedFont(StandardFonts.HelveticaBold));

    let rowsData: string[][] = [];

    if (typeof input === 'string') {
      const wb = XLSX.read(input, { type: 'string' });
      const firstSheet = wb.Sheets[wb.SheetNames[0]];
      rowsData = XLSX.utils.sheet_to_json<string[]>(firstSheet, { header: 1, defval: '' });
    } else {
      const wb = XLSX.read(input, { type: 'buffer' });
      const firstSheet = wb.Sheets[wb.SheetNames[0]];
      rowsData = XLSX.utils.sheet_to_json<string[]>(firstSheet, { header: 1, defval: '' });
    }

    if (!rowsData || rowsData.length === 0) {
      rowsData = [['(Empty Sheet)']];
    }

    const pageWidth = 841.89; // Landscape A4
    const pageHeight = 595.28;
    const margin = 36;
    const printableWidth = pageWidth - margin * 2;
    const bottomMargin = margin + 20;

    const maxCols = Math.max(...rowsData.map((r) => (Array.isArray(r) ? r.length : 1)), 1);
    const colWidth = printableWidth / maxCols;
    const rowHeight = 22;
    const fontSize = 8.5;

    let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    let currentY = pageHeight - margin;

    // Draw Title Header
    drawSafeText(currentPage, title, {
      x: margin,
      y: currentY - 14,
      size: 14,
      font: fontBold,
      color: rgb(0.1, 0.15, 0.25),
    });
    currentY -= 30;

    for (let rIdx = 0; rIdx < rowsData.length; rIdx++) {
      if (currentY - rowHeight < bottomMargin) {
        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        currentY = pageHeight - margin;
      }

      const row = rowsData[rIdx] || [];
      const isHeader = rIdx === 0;
      const activeFont = isHeader ? fontBold : fontRegular;

      for (let cIdx = 0; cIdx < maxCols; cIdx++) {
        const val = row[cIdx] !== undefined ? String(row[cIdx]) : '';
        const cellX = margin + cIdx * colWidth;

        currentPage.drawRectangle({
          x: cellX,
          y: currentY - rowHeight,
          width: colWidth,
          height: rowHeight,
          color: isHeader ? rgb(0.93, 0.95, 0.98) : rgb(1, 1, 1),
          borderColor: rgb(0.82, 0.85, 0.89),
          borderWidth: 0.75,
        });

        const lines = wrapText(val, activeFont, fontSize, colWidth - 8);
        const textVal = lines[0] || '';
        drawSafeText(currentPage, textVal, {
          x: cellX + 4,
          y: currentY - rowHeight + 6,
          size: fontSize,
          font: activeFont,
          color: isHeader ? rgb(0.08, 0.12, 0.2) : rgb(0.2, 0.25, 0.33),
        });
      }

      currentY -= rowHeight;
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  /**
   * Convert OpenXML DOCX Binary (Buffer or Uint8Array) into Vector PDF
   * Full OOXML parsing via DocxParser -> Structured AST -> Vector PDF via renderDocToNativeSearchablePdf.
   * ZERO String() or TextDecoder leakage of ZIP contents.
   */
  public static async renderDocxToPdf(
    input: Buffer | Uint8Array,
    title: string = 'Document'
  ): Promise<Buffer> {
    const isPk =
      input &&
      input.length >= 4 &&
      input[0] === 0x50 &&
      input[1] === 0x4b &&
      input[2] === 0x03 &&
      input[3] === 0x04;

    if (isPk) {
      const parsed = await DocxParser.parseDocx(input, title);
      const pdfBytes = await renderDocToNativeSearchablePdf(parsed.documentModel, {
        fileName: `${title}.pdf`,
      });
      return Buffer.from(pdfBytes);
    }

    // If not PK binary, treat as text/HTML
    return await this.renderDocToPdf(
      typeof input === 'string' ? input : input.toString('utf-8'),
      title
    );
  }

  /**
   * Convert Document content (HTML / Markdown / Text) to Vector PDF
   */
  public static async renderDocToPdf(
    content: string,
    title: string = 'Document'
  ): Promise<Buffer> {
    // Safety guard: if content starts with PK (ZIP magic bytes) or mentions word/document.xml,
    // it was accidentally stringified from a binary DOCX. Recover the binary and parse properly.
    if (typeof content === 'string' && (content.startsWith('PK\x03\x04') || (content.includes('word/document.xml') && content.includes('[Content_Types].xml')))) {
      console.warn('[ServerEngineFallback] Detected stringified DOCX binary in renderDocToPdf. Converting to Buffer for proper OOXML parsing.');
      const buf = Buffer.from(content, 'binary');
      return await this.renderDocxToPdf(buf, title);
    }
    const pdfDoc = await PDFDocument.create();
    const unicodeFont = await loadUnicodeFont(pdfDoc);
    const fontRegular = unicodeFont || (await pdfDoc.embedFont(StandardFonts.Helvetica));
    const fontBold = unicodeFont || (await pdfDoc.embedFont(StandardFonts.HelveticaBold));
    const fontItalic = unicodeFont || (await pdfDoc.embedFont(StandardFonts.HelveticaOblique));

    const pageWidth = 595.28; // Portrait A4
    const pageHeight = 841.89;
    const margin = 54;
    const printableWidth = pageWidth - margin * 2;
    const bottomMargin = margin + 30;

    let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    let currentY = pageHeight - margin;

    // Parse clean HTML or text without CSS, script, or metadata pollution
    const cleanLines = content
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
      .replace(/<meta[^>]*>/gi, '')
      .replace(/<link[^>]*>/gi, '')
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n')
      .replace(/<li[^>]*>(.*?)<\/li>/gi, '• $1\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .split('\n');

    for (const rawLine of cleanLines) {
      const line = rawLine.trim();
      if (!line) {
        currentY -= 10;
        continue;
      }

      if (line.startsWith('# ')) {
        const hText = line.substring(2).trim();
        const fontSize = 16;
        const lineHeight = 22;
        if (currentY - lineHeight < bottomMargin) {
          currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
          currentY = pageHeight - margin;
        }
        currentY -= 12;
        const wrapped = wrapText(hText, fontBold, fontSize, printableWidth);
        for (const w of wrapped) {
          drawSafeText(currentPage, w, {
            x: margin,
            y: currentY - fontSize,
            size: fontSize,
            font: fontBold,
            color: rgb(0.08, 0.12, 0.2),
          });
          currentY -= lineHeight;
        }
      } else if (line.startsWith('## ')) {
        const hText = line.substring(3).trim();
        const fontSize = 13;
        const lineHeight = 18;
        if (currentY - lineHeight < bottomMargin) {
          currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
          currentY = pageHeight - margin;
        }
        currentY -= 8;
        const wrapped = wrapText(hText, fontBold, fontSize, printableWidth);
        for (const w of wrapped) {
          drawSafeText(currentPage, w, {
            x: margin,
            y: currentY - fontSize,
            size: fontSize,
            font: fontBold,
            color: rgb(0.12, 0.18, 0.28),
          });
          currentY -= lineHeight;
        }
      } else {
        const fontSize = 10;
        const lineHeight = 15;
        const isBullet = line.startsWith('• ');
        const textToWrap = isBullet ? line.substring(2).trim() : line;
        const indent = isBullet ? 14 : 0;
        const wrapped = wrapText(textToWrap, fontRegular, fontSize, printableWidth - indent);

        for (let i = 0; i < wrapped.length; i++) {
          if (currentY - lineHeight < bottomMargin) {
            currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
            currentY = pageHeight - margin;
          }
          if (isBullet && i === 0) {
            drawSafeText(currentPage, '•', {
              x: margin,
              y: currentY - fontSize,
              size: fontSize,
              font: fontBold,
              color: rgb(0.2, 0.4, 0.8),
            });
          }
          drawSafeText(currentPage, wrapped[i], {
            x: margin + indent,
            y: currentY - fontSize,
            size: fontSize,
            font: fontRegular,
            color: rgb(0.18, 0.22, 0.3),
          });
          currentY -= lineHeight;
        }
      }
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  /**
   * Convert CSV / Matrix to standard Microsoft Excel (.xlsx) Buffer
   */
  public static convertCsvToXlsxBuffer(csvContent: string): Buffer {
    const wb = XLSX.read(csvContent, { type: 'string' });
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return Buffer.from(buffer);
  }

  /**
   * Convert Text / HTML to standard Microsoft Word (.docx) Buffer
   * ZERO synthetic title injection, ZERO CSS/style source leakage.
   */
  public static async convertHtmlToDocxBuffer(htmlContent: string, title: string = 'Document'): Promise<Buffer> {
    const cleanLines = htmlContent
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
      .replace(/<meta[^>]*>/gi, '')
      .replace(/<link[^>]*>/gi, '')
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n')
      .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n#### $1\n')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n')
      .replace(/<li[^>]*>(.*?)<\/li>/gi, '• $1\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .split('\n');

    const paragraphs: Paragraph[] = [];

    for (const raw of cleanLines) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('# ')) {
        paragraphs.push(new Paragraph({ text: trimmed.substring(2), heading: HeadingLevel.HEADING_1 }));
      } else if (trimmed.startsWith('## ')) {
        paragraphs.push(new Paragraph({ text: trimmed.substring(3), heading: HeadingLevel.HEADING_2 }));
      } else if (trimmed.startsWith('### ')) {
        paragraphs.push(new Paragraph({ text: trimmed.substring(4), heading: HeadingLevel.HEADING_3 }));
      } else {
        paragraphs.push(new Paragraph({ text: trimmed, spacing: { after: 120 } }));
      }
    }

    if (paragraphs.length === 0) {
      paragraphs.push(new Paragraph({ text: '' }));
    }

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs,
        },
      ],
    });

    return await Packer.toBuffer(doc);
  }
}
