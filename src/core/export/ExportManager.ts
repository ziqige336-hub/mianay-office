/**
 * ExportManager.ts
 * 
 * Strict Multi-Track File-Type Router for Lumina Office.
 * 
 * GUARANTEES:
 * 1. PDF files (file.type === 'pdf') -> Strictly handled by PdfExportService (Native PDF Ops)
 * 2. Sheet files (file.type === 'sheet') -> Strictly handled by SheetExportService (Calc / XLSX)
 * 3. Doc files (file.type === 'doc') -> Strictly handled by DocxExportService (Writer / DOCX)
 * 4. NEVER falls back to cross-type format casting (e.g. format: file.type === 'sheet' ? 'sheet' : 'doc')
 */

import type { OfficeFile } from '../../types';
import { PdfExportService, type NativePdfExportOptions, type UnifiedExportResult } from './PdfExportService';
import { DocxExportService, type DocxExportOptions } from './DocxExportService';
import { SheetExportService, type SheetExportOptions } from './SheetExportService';

export type SupportedExportFormat = 'pdf' | 'docx' | 'xlsx' | 'csv' | 'md' | 'txt';

export { type UnifiedExportResult };

export interface ExportModelOptions {
  customFileName?: string;
  orientation?: 'portrait' | 'landscape';
  pdfa?: boolean;
  dpi?: number;
  outputType?: 'vector' | 'scanned';
  includeOcr?: boolean;
  imageQuality?: 'standard' | 'high' | 'print';
  selectedPages?: number[];
  onProgress?: (progress: number, message: string) => void;
}

export class ExportManager {
  /**
   * Strict Multitrack File-Type Router
   */
  public static async exportModel(
    file: OfficeFile,
    format: SupportedExportFormat,
    options: ExportModelOptions = {}
  ): Promise<UnifiedExportResult> {
    if (!file) {
      throw new Error('EXPORT_ERROR: 未提供待导出的文件对象');
    }

    const fileNameLower = (file.name || '').toLowerCase();

    // 1. PDF Pipeline (STRICT ISOLATION: Never enters DOCX / Sheet / DocumentContentNormalizer)
    if (file.type === 'pdf' || fileNameLower.endsWith('.pdf')) {
      if (format === 'pdf') {
        return await PdfExportService.exportNativePdf(file, options);
      }
      throw new Error(`PDF_ENGINE_ERROR: 原生 PDF 文件不支持直接导出为 [${format}] 格式`);
    }

    // 2. Spreadsheet Pipeline (STRICT ISOLATION)
    if (
      file.type === 'sheet' ||
      fileNameLower.endsWith('.xlsx') ||
      fileNameLower.endsWith('.xls') ||
      fileNameLower.endsWith('.csv')
    ) {
      if (format === 'xlsx') {
        return await SheetExportService.exportXlsx(file, options);
      }
      if (format === 'pdf') {
        return await SheetExportService.exportPdf(file, options);
      }
      if (format === 'csv') {
        return await SheetExportService.exportCsv(file, options);
      }
      throw new Error(`SHEET_ENGINE_ERROR: 表格文件不支持导出为 [${format}] 格式`);
    }

    // 3. Document Pipeline (STRICT ISOLATION)
    if (
      file.type === 'doc' ||
      file.type === 'text' ||
      fileNameLower.endsWith('.docx') ||
      fileNameLower.endsWith('.doc') ||
      fileNameLower.endsWith('.txt') ||
      fileNameLower.endsWith('.md')
    ) {
      if (format === 'docx') {
        return await DocxExportService.exportDocx(file, options);
      }
      if (format === 'pdf') {
        return await DocxExportService.exportPdf(file, options);
      }
      if (format === 'txt' || format === 'md') {
        return await DocxExportService.exportText(file, format, options);
      }
      throw new Error(`DOC_ENGINE_ERROR: 文稿文件不支持导出为 [${format}] 格式`);
    }

    throw new Error(`UNSUPPORTED_FILE_TYPE: 未知的文件类型 [${file.type || 'unknown'}]`);
  }
}
