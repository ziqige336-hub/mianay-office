import type { OfficeFile, PdfAnnotation, PageMeta } from '../types';
import { pdfBridge } from '../core/office/PdfBridge';
import { officeEngine } from '../core/office/OfficeEngine';
import {
  loadPdfJsDocument,
  analyzePdfDocument,
  removeElectronicWatermarks,
  exportCleanPdf,
} from '../utils/pdfLibWrapper';
import { exportScannedImageBasedPdf, exportPdfHighDpiImages } from '../utils/pdfExportEngines';
import { runRealTesseractOcr } from '../utils/ocrEngine';

export interface OcrExtractionResult {
  text: string;
  confidence: number;
  lines: { text: string; confidence: number }[];
}

export interface PdfTextExtractionOptions {
  pageIndex?: number; // 0-indexed, undefined = all pages
  normalizeWhitespace?: boolean;
}

/**
 * PdfService
 * 
 * High-level Lumina Feature Layer Service for PDF Workbench.
 * Provides programmatic text extraction, OCR engine integration, AI summarization hooks,
 * annotation/marking management, watermark removal, and PDF transformations via PdfBridge.
 */
export class PdfService {
  private static instance: PdfService;
  private currentPdfFile: OfficeFile | null = null;
  private currentPdfBytes: Uint8Array | null = null;
  private annotations: PdfAnnotation[] = [];
  private onAnnotationsChangeCallback?: (annos: PdfAnnotation[]) => void;

  private constructor() {}

  public static getInstance(): PdfService {
    if (!PdfService.instance) {
      PdfService.instance = new PdfService();
    }
    return PdfService.instance;
  }

  /**
   * Register active PDF file state and raw bytes
   */
  public registerPdf(
    file: OfficeFile | null,
    pdfBytes?: Uint8Array | null,
    annotations: PdfAnnotation[] = [],
    onAnnosChange?: (annos: PdfAnnotation[]) => void
  ): void {
    this.currentPdfFile = file;
    if (pdfBytes) {
      this.currentPdfBytes = pdfBytes;
    }
    this.annotations = annotations;
    if (onAnnosChange) {
      this.onAnnotationsChangeCallback = onAnnosChange;
    }
  }

  public setPdfBytes(bytes: Uint8Array): void {
    this.currentPdfBytes = bytes;
  }

  /**
   * 1. extractText()
   * Extracts selectable text from vector PDF pages using pdfjsLib.
   */
  public async extractText(options?: PdfTextExtractionOptions): Promise<string> {
    if (!this.currentPdfBytes) {
      throw new Error('未载入 PDF 字节流数据');
    }

    try {
      const pdfDoc = await loadPdfJsDocument(this.currentPdfBytes);
      const numPages = pdfDoc.numPages;
      const extractedPages: string[] = [];

      const startPage = options?.pageIndex !== undefined ? options.pageIndex + 1 : 1;
      const endPage = options?.pageIndex !== undefined ? options.pageIndex + 1 : numPages;

      for (let p = startPage; p <= endPage; p++) {
        const page = await pdfDoc.getPage(p);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        
        extractedPages.push(pageText);
      }

      let fullText = extractedPages.join('\n\n');
      if (options?.normalizeWhitespace) {
        fullText = fullText.replace(/\s+/g, ' ').trim();
      }
      return fullText;
    } catch (err) {
      console.warn('PdfService: pdfjs-dist text extraction note:', err);
      // Fallback simple string search or return empty if in non-DOM test environment
      return '';
    }
  }

  /**
   * 2. performOcr()
   * Runs offline WASM Tesseract OCR on a page image or PDF rasterized canvas.
   */
  public async performOcr(
    imageSource: string | File | Blob | HTMLCanvasElement,
    language: string = 'chi_sim+eng',
    onProgress?: (progress: number, status: string) => void
  ): Promise<OcrExtractionResult> {
    const result = await runRealTesseractOcr(imageSource, language, onProgress);

    const lines = (result.lines || []).map((line: any) => ({
      text: line.text,
      confidence: line.confidence || 0.95,
    }));

    return {
      text: result.text,
      confidence: result.confidence || 0.95,
      lines,
    };
  }

  /**
   * 3. summarizeWithAi()
   * Extracts text and feeds it into an AI LLM worker to generate concise executive summaries.
   */
  public async summarizeWithAi(
    aiWorker: (content: string) => Promise<string>,
    pageIndex?: number
  ): Promise<{ summary: string; extractedLength: number }> {
    const text = await this.extractText({ pageIndex });
    if (!text.trim()) {
      throw new Error('当前 PDF 页面未检测到可提取文本（若是扫描图像，请先使用 OCR 功能）');
    }

    const summary = await aiWorker(text.slice(0, 8000));
    return {
      summary,
      extractedLength: text.length,
    };
  }

  /**
   * 4. addAnnotation() / getAnnotations()
   * Programmatic markup & annotation management (Highlighter, Pen, Stamp, Text, Shape)
   */
  public getAnnotations(): PdfAnnotation[] {
    return [...this.annotations];
  }

  public addAnnotation(annotation: any): PdfAnnotation {
    const newAnno: any = {
      ...annotation,
      id: `anno-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    };

    this.annotations = [...this.annotations, newAnno];
    if (this.onAnnotationsChangeCallback) {
      this.onAnnotationsChangeCallback(this.annotations);
    }
    return newAnno;
  }

  public updateAnnotation(id: string, updates: any): boolean {
    let found = false;
    this.annotations = this.annotations.map((a) => {
      if (a.id === id) {
        found = true;
        return { ...a, ...updates };
      }
      return a;
    });

    if (found && this.onAnnotationsChangeCallback) {
      this.onAnnotationsChangeCallback(this.annotations);
    }
    return found;
  }

  public deleteAnnotation(id: string): boolean {
    const initialLen = this.annotations.length;
    this.annotations = this.annotations.filter((a) => a.id !== id);
    if (this.annotations.length !== initialLen && this.onAnnotationsChangeCallback) {
      this.onAnnotationsChangeCallback(this.annotations);
      return true;
    }
    return false;
  }

  /**
   * 5. exportCleanPdf()
   * Generates flattened/annotated vector PDF with all markups baked in.
   */
  public async exportPdfWithAnnotations(pagesMeta?: PageMeta[]): Promise<Blob> {
    if (!this.currentPdfBytes) {
      throw new Error('未载入 PDF 字节流数据');
    }
    const cleanBytes = await exportCleanPdf(
      this.currentPdfBytes,
      pagesMeta || [],
      this.annotations
    );
    return new Blob([cleanBytes], { type: 'application/pdf' });
  }

  /**
   * 6. exportScannedPdf()
   * Converts PDF pages into 100% anti-tamper rasterized image-based PDF.
   */
  public async exportScannedPdf(dpi: number = 150): Promise<Blob> {
    if (!this.currentPdfBytes) {
      throw new Error('未载入 PDF 字节流数据');
    }
    const { loadPdfJsDocument, analyzePdfDocument } = await import('../utils/pdfLibWrapper');
    const pdfJsDoc = await loadPdfJsDocument(this.currentPdfBytes);
    const { pages } = await analyzePdfDocument(this.currentPdfBytes);
    const pdfBytes = await exportScannedImageBasedPdf(pdfJsDoc, pages, dpi);
    return new Blob([pdfBytes], { type: 'application/pdf' });
  }

  /**
   * 7. removeWatermarks()
   * Universal watermark inspection and removal.
   */
  public async removeWatermarks(watermarkItems: any[]): Promise<Uint8Array> {
    if (!this.currentPdfBytes) {
      throw new Error('未载入 PDF 字节流数据');
    }
    const cleanedRes = await removeElectronicWatermarks(this.currentPdfBytes, watermarkItems);
    this.currentPdfBytes = cleanedRes.cleanedBytes;
    return cleanedRes.cleanedBytes;
  }
}

export const pdfService = PdfService.getInstance();
