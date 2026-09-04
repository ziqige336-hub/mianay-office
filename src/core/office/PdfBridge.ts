import { DocumentContentNormalizer } from '../document/DocumentContentNormalizer';
import { PDFDocument, degrees } from 'pdf-lib';
import { renderDocToNativeSearchablePdf, renderSheetToNativeSearchablePdf } from '../../utils/nativePdfRenderer';
import { DocxParser } from '../document/DocxParser';

export interface PdfExportParams {
  fileId?: string;
  format?: 'doc' | 'sheet' | 'pdf';
  content?: any;
  base64?: string;
  title?: string;
  pdfa?: boolean;
  dpi?: number;
}

export interface PdfTransformOptions {
  rotateDegrees?: number;
  selectedPages?: number[];
  watermarkText?: string;
}

/**
 * PdfBridge
 * Manages PDF export, page manipulations, transformations, and native rendering via LibreOffice PDF Export filter and pdf-lib.
 * 
 * Responsibilities:
 * - High-fidelity PDF document rendering via `writer_pdf_Export` / `calc_pdf_Export`
 * - PDF Page Rotation, Split, Merge, and Extraction
 * - PDF Watermark Application & Eraser Mask coordinates
 * - PDF Metadata inspection (Page count, author, creation date, dimensions)
 */
export class PdfBridge {
  private getOrigin(): string {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }
    return 'http://localhost:3000';
  }

  private isElectron(): boolean {
    return typeof window !== 'undefined' && Boolean((window as any).electronAPI?.isElectron);
  }

  /**
   * Export document / sheet to native PDF via LibreOffice PDF Export filter
   */
  public async exportPdf(params: PdfExportParams): Promise<Blob> {
    const format = params.format || 'doc';
    const title = params.title || 'document';
    const safeTitle = title.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]/g, '_');

    // Direct Binary Guard: if content is already raw PDF bytes or format is 'pdf'
    if (params.content instanceof Uint8Array || params.content instanceof ArrayBuffer) {
      const u8 = params.content instanceof Uint8Array ? params.content : new Uint8Array(params.content);
      if (u8.length >= 4 && u8[0] === 0x25 && u8[1] === 0x50 && u8[2] === 0x44 && u8[3] === 0x46) {
        return new Blob([u8], { type: 'application/pdf' });
      }
    }

    if (format === 'pdf') {
      if (params.base64) {
        const u8 = Uint8Array.from(atob(params.base64), (c) => c.charCodeAt(0));
        return new Blob([u8], { type: 'application/pdf' });
      }
      throw new Error('PDF_ENGINE_ERROR: Native PDF export should use PdfExportService directly instead of PdfBridge doc/sheet pipeline.');
    }

    // If base64 binary is provided, bypass DocumentContentNormalizer to protect raw binary stream
    let cleanContent: string | undefined;
    if (!params.base64 && params.content !== undefined && params.content !== null) {
      const normalized = DocumentContentNormalizer.normalizeForEngine(params.content, format, safeTitle);
      cleanContent = normalized.cleanContent;
    }

    // 1. If running inside Electron desktop shell
    if (this.isElectron() && (window as any).electronAPI?.exportPDF) {
      try {
        const result = await (window as any).electronAPI.exportPDF({
          format,
          content: cleanContent,
          base64: params.base64,
          title: safeTitle,
        });
        if (result && result.success) {
          const uint8 = new Uint8Array(result.buffer || Buffer.from(result.base64, 'base64'));
          return new Blob([uint8], { type: 'application/pdf' });
        }
      } catch (err) {
        console.warn('PdfBridge: Electron IPC exportPDF failed, falling back to local server:', err);
      }
    }

    // 2. Local backend LibreOffice / Integrated engine export bridge
    try {
      const origin = this.getOrigin();
      const res = await fetch(`${origin}/api/engine/export-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: params.fileId,
          format,
          content: cleanContent,
          base64: params.base64,
          title: safeTitle,
          pdfa: params.pdfa,
          dpi: params.dpi,
        }),
      });

      if (res.ok) {
        return await res.blob();
      }
    } catch (netErr) {
      console.warn('PdfBridge backend export request failed, falling back to client vector renderer:', netErr);
    }

    // 3. Client-side pure Vector PDF generation fallback
    if (format === 'sheet') {
      const pdfBytes = await renderSheetToNativeSearchablePdf(params.content, { fileName: `${safeTitle}.pdf` });
      return new Blob([pdfBytes], { type: 'application/pdf' });
    } else {
      let docModel = params.content;
      if (params.base64) {
        try {
          const binaryStr = atob(params.base64);
          const len = binaryStr.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          const parsed = await DocxParser.parseDocx(bytes, safeTitle);
          docModel = parsed.documentModel;
        } catch (e) {
          console.warn('PdfBridge fallback DocxParser failed:', e);
        }
      }
      const pdfBytes = await renderDocToNativeSearchablePdf(docModel, { fileName: `${safeTitle}.pdf` });
      return new Blob([pdfBytes], { type: 'application/pdf' });
    }
  }

  /**
   * Rotate pages in a PDF document
   */
  public async rotatePages(
    pdfBuffer: ArrayBuffer | Uint8Array,
    pageIndices: number[],
    angle: number = 90
  ): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();

    pageIndices.forEach((idx) => {
      if (idx >= 0 && idx < pages.length) {
        const page = pages[idx];
        const currentRotation = page.getRotation().angle;
        page.setRotation(degrees((currentRotation + angle) % 360));
      }
    });

    return await pdfDoc.save();
  }

  /**
   * Merge multiple PDF files into one combined PDF
   */
  public async mergePdfs(pdfBuffers: (ArrayBuffer | Uint8Array)[]): Promise<Uint8Array> {
    const mergedDoc = await PDFDocument.create();

    for (const buf of pdfBuffers) {
      const doc = await PDFDocument.load(buf);
      const copiedPages = await mergedDoc.copyPages(doc, doc.getPageIndices());
      copiedPages.forEach((page) => mergedDoc.addPage(page));
    }

    return await mergedDoc.save();
  }

  /**
   * Extract specific pages into a new PDF
   */
  public async extractPages(
    pdfBuffer: ArrayBuffer | Uint8Array,
    pageIndices: number[]
  ): Promise<Uint8Array> {
    const srcDoc = await PDFDocument.load(pdfBuffer);
    const newDoc = await PDFDocument.create();

    const validIndices = pageIndices.filter((i) => i >= 0 && i < srcDoc.getPageCount());
    const copiedPages = await newDoc.copyPages(srcDoc, validIndices);
    copiedPages.forEach((page) => newDoc.addPage(page));

    return await newDoc.save();
  }

  /**
   * Inspect PDF metadata
   */
  public async inspectPdf(pdfBuffer: ArrayBuffer | Uint8Array): Promise<{
    pageCount: number;
    title?: string;
    author?: string;
    creator?: string;
    producer?: string;
    creationDate?: Date;
  }> {
    const doc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    return {
      pageCount: doc.getPageCount(),
      title: doc.getTitle(),
      author: doc.getAuthor(),
      creator: doc.getCreator(),
      producer: doc.getProducer(),
      creationDate: doc.getCreationDate(),
    };
  }
}

export const pdfBridge = new PdfBridge();
