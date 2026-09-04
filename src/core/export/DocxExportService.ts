/**
 * DocxExportService.ts
 * 
 * Strict DOCX & Document-to-PDF Export Pipeline for Lumina Office.
 * 
 * RESPONSIBILITIES:
 * 1. Exports DOC -> DOCX via native LibreOffice / DocumentExportAdapter
 * 2. Exports DOC -> PDF via LibreOffice Writer (writer_pdf_Export)
 * 3. Exports DOC -> TXT / MD
 * 
 * GUARANTEE:
 * Completely isolated from native PDF pipeline.
 */

import type { OfficeFile } from '../../types';
import { DocumentSessionManager, type DocSession } from '../document/DocumentSessionManager';
import { DocumentExportAdapter } from './DocumentExportAdapter';
import { officeEngine } from '../office/OfficeEngine';
import type { UnifiedExportResult } from './PdfExportService';

export interface DocxExportOptions {
  customFileName?: string;
  pdfa?: boolean;
  orientation?: 'portrait' | 'landscape';
  pageSize?: 'A4' | 'Letter';
  onProgress?: (progress: number, message: string) => void;
}

export class DocxExportService {
  /**
   * Export DOC -> DOCX
   * Directly generates compliant Microsoft Word / WPS OpenXML binary.
   * Eliminates:
   * - Synthetic filename title injection
   * - CSS / style source code leakage
   * - Layout distortion & unpaged continuous flow
   */
  public static async exportDocx(
    file: OfficeFile,
    options: DocxExportOptions = {}
  ): Promise<UnifiedExportResult> {
    const baseName = options.customFileName || file.name.replace(/\.[^/.]+$/, '') || '文稿导出';
    options.onProgress?.(20, '正在获取文稿实时编辑模型...');

    const docSession: DocSession | null = DocumentSessionManager.getDocSession(file.id);
    const sourceContent = docSession?.docState || docSession?.getExportContent?.() || file.content;

    options.onProgress?.(50, '正在生成 Microsoft Word / WPS 标准 OpenXML 文档...');
    let docxBlob: Blob;

    try {
      // Primary: High-fidelity OpenXML generator via DocumentExportAdapter
      docxBlob = await DocumentExportAdapter.exportToDocx(sourceContent, {
        fileName: `${baseName}.docx`,
        title: baseName,
        orientation: options.orientation,
        pageSize: options.pageSize || 'A4',
      });
    } catch (err) {
      console.warn('DocxExportService: DocumentExportAdapter failed, trying officeEngine:', err);
      const saveRes = await officeEngine.saveDocument(file.id, sourceContent, 'doc', baseName);
      docxBlob = saveRes.blob;
    }

    options.onProgress?.(100, 'DOCX 文档流生成完成');

    return {
      blob: docxBlob,
      fileName: `${baseName}.docx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      sizeBytes: docxBlob.size,
    };
  }

  /**
   * Export DOC -> PDF (Document to PDF conversion pipeline)
   */
  public static async exportPdf(
    file: OfficeFile,
    options: DocxExportOptions = {}
  ): Promise<UnifiedExportResult> {
    const baseName = options.customFileName || file.name.replace(/\.[^/.]+$/, '') || '文稿导出';
    const safeTitle = baseName.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]/g, '_');
    options.onProgress?.(15, '正在提取文稿真实排版模型...');

    const docSession: DocSession | null = DocumentSessionManager.getDocSession(file.id);
    const sourceContent = docSession?.docState || docSession?.getExportContent?.() || file.content;

    // 1. Structure Audit & Node Inspection
    const { nodes } = DocumentExportAdapter.parseToNodes(sourceContent);
    const headingCount = nodes.filter((n) => n.type === 'heading').length;
    const tableCount = nodes.filter((n) => n.type === 'table').length;
    const listCount = nodes.filter((n) => n.type === 'bullet' || n.type === 'ordered').length;
    const imageCount = nodes.filter((n) => n.type === 'image').length;
    const pageBreakCount = nodes.filter((n) => (n.type as string) === 'page-break' || (n.type as string) === 'pageBreak').length;
    
    // Estimate total document page count
    const totalRunsText = nodes.flatMap((n) => n.runs.map((r) => r.text)).join('');
    const pageEstimate = Math.max(1, pageBreakCount + 1, Math.ceil(totalRunsText.length / 500));

    console.log('===========================================================');
    console.log('📄 [DocxExportService.exportPdf] Real Structure Audit');
    console.log(`  • Source Type: Real DocumentModel / OpenXML DOCX Pipeline`);
    console.log(`  • Source File ID: ${file.id}`);
    console.log(`  • Total AST Nodes: ${nodes.length}`);
    console.log(`  • Headings: ${headingCount}, Tables: ${tableCount}, Lists: ${listCount}, Images: ${imageCount}`);
    console.log(`  • Explicit Page Breaks: ${pageBreakCount}`);
    console.log(`  • Source Document Estimated Pages: ${pageEstimate}`);
    console.log(`  • Input File Path: ${safeTitle}.docx`);
    console.log(`  • Output Engine: LibreOffice Writer (writer_pdf_Export)`);
    console.log('===========================================================');

    // 2. Generate authentic Microsoft Word / WPS OpenXML DOCX Binary first
    options.onProgress?.(40, '正在生成标准 OpenXML DOCX 排版文件...');
    const docxResult = await this.exportDocx(file, {
      ...options,
      customFileName: baseName,
    });

    const docxArrayBuffer = await docxResult.blob.arrayBuffer();
    let docxBase64: string;
    if (typeof Buffer !== 'undefined') {
      docxBase64 = Buffer.from(docxArrayBuffer).toString('base64');
    } else {
      const bytes = new Uint8Array(docxArrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      docxBase64 = btoa(binary);
    }

    // 3. Send the REAL DOCX BINARY to Office Engine (LibreOffice Writer / Vector PDF)
    options.onProgress?.(70, '正在调用 LibreOffice Writer (writer_pdf_Export) 渲染高保真 PDF...');
    const blob = await officeEngine.exportPDF({
      fileId: file.id,
      content: sourceContent,
      base64: docxBase64,
      format: 'doc',
      title: baseName,
      pdfa: options.pdfa,
    });

    options.onProgress?.(100, '文稿转 PDF 输出完成');

    return {
      blob,
      fileName: `${baseName}.pdf`,
      mimeType: 'application/pdf',
      sizeBytes: blob.size,
    };
  }

  /**
   * Export DOC -> Plain Text or Markdown
   */
  public static async exportText(
    file: OfficeFile,
    format: 'txt' | 'md' = 'txt',
    options: DocxExportOptions = {}
  ): Promise<UnifiedExportResult> {
    const baseName = options.customFileName || file.name.replace(/\.[^/.]+$/, '') || '文本导出';
    const docSession: DocSession | null = DocumentSessionManager.getDocSession(file.id);
    const liveContent = docSession?.getExportContent
      ? docSession.getExportContent()
      : (docSession?.docState || file.content);

    let textContent = '';
    if (typeof liveContent === 'string') {
      textContent = liveContent.replace(/<[^>]+>/g, '\n').replace(/\n\s*\n/g, '\n\n').trim();
    } else if (docSession?.getVisibleTextPreview) {
      textContent = docSession.getVisibleTextPreview();
    } else {
      textContent = JSON.stringify(liveContent, null, 2);
    }

    const blob = new Blob([textContent], {
      type: format === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8',
    });
    return {
      blob,
      fileName: `${baseName}.${format}`,
      mimeType: format === 'md' ? 'text/markdown' : 'text/plain',
      sizeBytes: blob.size,
    };
  }
}
