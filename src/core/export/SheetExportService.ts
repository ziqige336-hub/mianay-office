/**
 * SheetExportService.ts
 * 
 * Strict Spreadsheet Export Pipeline for Lumina Office.
 * 
 * RESPONSIBILITIES:
 * 1. Exports SHEET -> XLSX via native LibreOffice / SpreadsheetExportAdapter
 * 2. Exports SHEET -> PDF via LibreOffice Calc (calc_pdf_Export)
 * 3. Exports SHEET -> CSV
 * 
 * GUARANTEE:
 * Completely isolated from native PDF pipeline.
 */

import type { OfficeFile } from '../../types';
import { DocumentSessionManager, type SheetSession } from '../document/DocumentSessionManager';
import { officeEngine } from '../office/OfficeEngine';
import { SpreadsheetExportAdapter } from './SpreadsheetExportAdapter';
import type { UnifiedExportResult } from './PdfExportService';

export interface SheetExportOptions {
  customFileName?: string;
  pdfa?: boolean;
  orientation?: 'portrait' | 'landscape';
  onProgress?: (progress: number, message: string) => void;
}

export class SheetExportService {
  /**
   * Export SHEET -> XLSX
   */
  public static async exportXlsx(
    file: OfficeFile,
    options: SheetExportOptions = {}
  ): Promise<UnifiedExportResult> {
    const baseName = options.customFileName || file.name.replace(/\.[^/.]+$/, '') || '工作簿导出';
    options.onProgress?.(20, '正在获取表格实时数据...');

    const sheetSession: SheetSession | null = DocumentSessionManager.getSheetSession(file.id);
    const liveContent = sheetSession?.getExportContent
      ? sheetSession.getExportContent()
      : (sheetSession?.sheetState || sheetSession?.workbookState || file.content);

    options.onProgress?.(50, '正在调用原生 Office 排版引擎生成 XLSX...');
    const saveRes = await officeEngine.saveDocument(file.id, liveContent, 'sheet', baseName);
    options.onProgress?.(100, 'XLSX 工作簿生成完成');

    return {
      blob: saveRes.blob,
      fileName: `${baseName}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      sizeBytes: saveRes.blob.size,
    };
  }

  /**
   * Export SHEET -> PDF (Sheet to PDF conversion pipeline)
   */
  public static async exportPdf(
    file: OfficeFile,
    options: SheetExportOptions = {}
  ): Promise<UnifiedExportResult> {
    const baseName = options.customFileName || file.name.replace(/\.[^/.]+$/, '') || '工作簿导出';
    options.onProgress?.(20, '正在获取表格排版数据...');

    const sheetSession: SheetSession | null = DocumentSessionManager.getSheetSession(file.id);
    const liveContent = sheetSession?.getExportContent
      ? sheetSession.getExportContent()
      : (sheetSession?.sheetState || sheetSession?.workbookState || file.content);

    options.onProgress?.(50, '正在调用 LibreOffice Calc 渲染表格 PDF...');
    const blob = await officeEngine.exportPDF({
      fileId: file.id,
      content: liveContent,
      format: 'sheet',
      title: baseName,
      pdfa: options.pdfa,
    });
    options.onProgress?.(100, '表格转 PDF 输出完成');

    return {
      blob,
      fileName: `${baseName}.pdf`,
      mimeType: 'application/pdf',
      sizeBytes: blob.size,
    };
  }

  /**
   * Export SHEET -> CSV
   */
  public static async exportCsv(
    file: OfficeFile,
    options: SheetExportOptions = {}
  ): Promise<UnifiedExportResult> {
    const baseName = options.customFileName || file.name.replace(/\.[^/.]+$/, '') || '表格导出';
    const sheetSession: SheetSession | null = DocumentSessionManager.getSheetSession(file.id);
    const liveContent = sheetSession?.getExportContent
      ? sheetSession.getExportContent()
      : (sheetSession?.sheetState || sheetSession?.workbookState || file.content);

    const blob = await SpreadsheetExportAdapter.exportToCsv(liveContent);
    return {
      blob,
      fileName: `${baseName}.csv`,
      mimeType: 'text/csv',
      sizeBytes: blob.size,
    };
  }
}
