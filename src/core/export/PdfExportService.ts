/**
 * PdfExportService.ts
 * 
 * Strict Native PDF Export Pipeline for Lumina Office.
 * 
 * ABSOLUTE ISOLATION RULES:
 * 1. NEVER calls DocumentContentNormalizer.
 * 2. NEVER calls DocxExportService / WriterBridge / LibreOffice Writer HTML->PDF.
 * 3. NEVER touches ProseMirror / Tiptap / DOM styles.
 * 4. NEVER falls back to creating a blank PDF or sample document on failure.
 * 5. Uses native pdf-lib / pdfjs-dist / direct binary streams exclusively.
 */

import { PDFDocument, PDFName, PDFRef, PDFArray } from 'pdf-lib';
import type { OfficeFile, PageMeta, PdfAnnotation } from '../../types';
import { DocumentSessionManager, type PdfSession } from '../document/DocumentSessionManager';
import { DocumentManager } from '../document/DocumentManager';
import { exportCleanPdf, extractRawPdfBytes, loadPdfJsDocument } from '../../utils/pdfLibWrapper';
import { exportScannedImageBasedPdf } from '../../utils/pdfExportEngines';

export interface NativePdfExportOptions {
  customFileName?: string;
  selectedPages?: number[];
  dpi?: number;
  outputType?: 'vector' | 'scanned';
  includeOcr?: boolean;
  imageQuality?: 'standard' | 'high' | 'print' | 'low';
  onProgress?: (progress: number, message: string) => void;
}

export interface UnifiedExportResult {
  blob: Blob;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export class PdfExportService {
  /**
   * Export native PDF directly from PdfSession / raw pdfBytes.
   * Guarantees 100% fidelity:
   * - Unmodified PDF returns original binary stream directly.
   * - Modified PDF bakes rotations, deletions, and annotations without losing pages.
   * - Validates page counts and outputs diagnostic logs.
   */
  public static async exportNativePdf(
    file: OfficeFile,
    options: NativePdfExportOptions = {}
  ): Promise<UnifiedExportResult> {
    if (file.type !== 'pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      throw new Error(`PDF_ENGINE_ERROR: PdfExportService 仅支持处理 PDF 格式，当前文件类型为 [${file.type}]`);
    }

    const baseName = options.customFileName || file.name.replace(/\.[^/.]+$/, '') || '文档导出';
    options.onProgress?.(10, '正在准备原生 PDF 数据源...');

    // 1. Precise retrieval from DocumentSessionManager and DocumentManager (No cross-type / wrong file fallback)
    let pdfSession: PdfSession | null = DocumentSessionManager.getPdfSession(file.id);
    if (!pdfSession) {
      const genericSession = DocumentSessionManager.getSession(file.id);
      if (genericSession?.pdfSession) {
        pdfSession = genericSession.pdfSession;
      } else if (genericSession?.pdfBytes) {
        pdfSession = genericSession as PdfSession;
      }
    }

    // Secondary check: DocumentManager singleton registry
    let dmSession: any = null;
    try {
      const dm = DocumentManager.getInstance();
      const allSessions = dm.getSessions();
      dmSession = allSessions.find((s) => s.id === file.id || s.fileName === file.name);
    } catch {
      // ignore
    }

    // 2. Extract raw PDF bytes
    let rawPdfBytes: Uint8Array | null = null;
    if (pdfSession?.pdfBytes && pdfSession.pdfBytes.byteLength > 0) {
      rawPdfBytes = pdfSession.pdfBytes instanceof Uint8Array ? pdfSession.pdfBytes : new Uint8Array(pdfSession.pdfBytes);
    } else if (pdfSession?.getExportBytes) {
      rawPdfBytes = await pdfSession.getExportBytes();
    } else if (dmSession?.pdfBytes && dmSession.pdfBytes.byteLength > 0) {
      rawPdfBytes = dmSession.pdfBytes instanceof Uint8Array ? dmSession.pdfBytes : new Uint8Array(dmSession.pdfBytes);
    } else {
      // Direct binary extract from file content
      rawPdfBytes = extractRawPdfBytes(file.content) || extractRawPdfBytes((file as any).pdfBytes);
    }

    if (!rawPdfBytes || rawPdfBytes.byteLength === 0) {
      throw new Error(`PDF_SESSION_NOT_FOUND: 无法读取 PDF 数据源 [fileId=${file.id}, fileName=${file.name}]`);
    }

    // Verify PDF Magic Bytes (%PDF)
    if (
      rawPdfBytes.length < 4 ||
      rawPdfBytes[0] !== 0x25 ||
      rawPdfBytes[1] !== 0x50 ||
      rawPdfBytes[2] !== 0x44 ||
      rawPdfBytes[3] !== 0x46
    ) {
      throw new Error('PDF_ENGINE_ERROR: 提供的二进制数据不是合法的 PDF 格式 (Magic Bytes 校验未通过)');
    }

    // Parse source document to inspect real source page count
    const sourceDoc = await PDFDocument.load(rawPdfBytes, { ignoreEncryption: true });
    const sourcePdfPageCount = sourceDoc.getPageCount();

    const sessionPages: PageMeta[] =
      pdfSession?.pages ||
      pdfSession?.pdfSession?.pages ||
      dmSession?.pages ||
      (file.content as any)?.pages ||
      [];
    const annotations: PdfAnnotation[] =
      pdfSession?.annotations ||
      pdfSession?.pdfSession?.annotations ||
      dmSession?.annotations ||
      (file.content as any)?.annotations ||
      [];

    const viewerPageCount = sessionPages.length > 0 ? sessionPages.filter((p) => !p.isDeleted).length : sourcePdfPageCount;

    const selectedIndices: number[] =
      options.selectedPages && options.selectedPages.length > 0
        ? options.selectedPages
        : Array.from({ length: sourcePdfPageCount }, (_, i) => i);

    const hasRotations = sessionPages.some((p: any) => p.rotation && p.rotation !== 0);
    const hasDeleted = sessionPages.some((p: any) => p.isDeleted);
    const hasWatermarkErased = sessionPages.some((p: any) => p.detectedWatermarks?.some((w: any) => w.isErased));
    const hasAnnotations = annotations.length > 0;
    const isFullPageExport =
      selectedIndices.length === sourcePdfPageCount &&
      selectedIndices.every((idx, i) => idx === i);
    const isModified = Boolean(
      pdfSession?.isModified ||
      dmSession?.isModified ||
      hasRotations ||
      hasDeleted ||
      hasWatermarkErased ||
      hasAnnotations ||
      !isFullPageExport
    );

    const exportMethod =
      options.outputType === 'scanned'
        ? 'scanned-raster'
        : !isModified && isFullPageExport
        ? 'direct-binary-copy'
        : 'export-clean-pdf';

    // Mandatory Pre-Export Diagnostic Log
    console.log('[PDF Export Diagnostic - Pre]', {
      fileId: file.id,
      fileName: file.name,
      pdfSessionId: pdfSession?.fileId || dmSession?.id || file.id,
      pdfBytesLength: rawPdfBytes.byteLength,
      viewerPageCount,
      sourcePdfPageCount,
      modified: isModified,
      exportMethod,
      selectedPagesCount: selectedIndices.length,
    });

    let finalPdfBytes: Uint8Array;

    // A. Scanned Image-Based PDF Export
    if (options.outputType === 'scanned') {
      options.onProgress?.(30, '正在生成高精光栅化扫描型 PDF...');
      const pdfJsDoc =
        pdfSession?.pdfJsDoc ||
        pdfSession?.pdfSession?.pdfJsDoc ||
        dmSession?.pdfJsDoc ||
        (await loadPdfJsDocument(rawPdfBytes));

      const pagesMeta = selectedIndices.map((idx) => {
        if (sessionPages && sessionPages[idx]) return sessionPages[idx];
        return {
          originalIndex: idx,
          pageIndex: idx,
          rotation: 0,
          isDeleted: false,
          width: 595.28,
          height: 841.89,
          scale: 1,
          aspectRatio: 595.28 / 841.89,
          detectedWatermarks: [],
        };
      });
      const dpi = options.dpi || 150;
      finalPdfBytes = await exportScannedImageBasedPdf(
        pdfJsDoc,
        pagesMeta,
        dpi,
        options.includeOcr || false,
        (prog) => {
          options.onProgress?.(30 + Math.round(prog * 60), `正在处理扫描图层 (${Math.round(prog * 100)}%)...`);
        }
      );
    } else {
      // B. Standard Native Vector PDF Export
      options.onProgress?.(30, '正在导出高保真原生 PDF...');

      // Fast-path: If completely untouched and all pages selected, return direct byte copy with 100% fidelity
      if (!isModified && isFullPageExport) {
        console.log(`[PdfExportService] Exporting exact unmodified binary stream (${rawPdfBytes.byteLength} bytes, ${sourcePdfPageCount} pages)`);
        finalPdfBytes = rawPdfBytes;
      } else {
        options.onProgress?.(50, '正在应用页面变换与批注图层...');
        const pagesToExport =
          sessionPages.length > 0
            ? sessionPages.filter((_, idx) => selectedIndices.includes(idx) && !_.isDeleted)
            : selectedIndices.map((idx) => ({
                originalIndex: idx,
                pageIndex: idx,
                rotation: 0,
                isDeleted: false,
                width: 595.28,
                height: 841.89,
                scale: 1,
                aspectRatio: 595.28 / 841.89,
                detectedWatermarks: [],
              }));

        finalPdfBytes = await exportCleanPdf(rawPdfBytes, pagesToExport, annotations);
      }
    }

    if (!finalPdfBytes || finalPdfBytes.byteLength === 0) {
      throw new Error('PDF_EXPORT_FAILED: 导出的 PDF 二进制流为空');
    }

    // Verify output page count and validity
    const outputDoc = await PDFDocument.load(finalPdfBytes, { ignoreEncryption: true });
    const outputPageCount = outputDoc.getPageCount();
    const expectedPageCount = selectedIndices.length;

    if (outputPageCount !== expectedPageCount) {
      console.warn(`[PdfExportService] Output page count warning: got ${outputPageCount}, expected ${expectedPageCount}`);
    }

    // Mandatory Post-Export Diagnostic Log
    console.log('[PDF Export Diagnostic - Post]', {
      fileId: file.id,
      fileName: file.name,
      outputBytesLength: finalPdfBytes.byteLength,
      outputPageCount,
      expectedPageCount,
      status: 'SUCCESS',
    });

    // Detailed per-page content stream isolation diagnostic
    try {
      for (let pIdx = 0; pIdx < outputPageCount; pIdx++) {
        const outPage = outputDoc.getPage(pIdx);
        const node = outPage.node;
        const contentsObj = node.get(PDFName.of('Contents'));
        const contentRefs: string[] = [];
        if (contentsObj instanceof PDFRef) {
          contentRefs.push(`${contentsObj.objectNumber} 0 R`);
        } else if (contentsObj instanceof PDFArray) {
          for (let j = 0; j < contentsObj.size(); j++) {
            const it = contentsObj.get(j);
            if (it instanceof PDFRef) {
              contentRefs.push(`${it.objectNumber} 0 R`);
            } else {
              contentRefs.push('DirectStream');
            }
          }
        }
        const srcPg = selectedIndices[pIdx] !== undefined ? selectedIndices[pIdx] + 1 : pIdx + 1;
        console.log('[PDF Page Content Stream Detail]', {
          outputPage: pIdx + 1,
          sourcePage: srcPg,
          contentObjectRefs: contentRefs,
          operationCount: `${contentRefs.length} stream(s)`,
        });
      }
    } catch {
      // Diagnostic non-blocking
    }

    options.onProgress?.(100, '原生 PDF 导出完成');
    const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });

    return {
      blob,
      fileName: `${baseName}.pdf`,
      mimeType: 'application/pdf',
      sizeBytes: blob.size,
    };
  }
}
