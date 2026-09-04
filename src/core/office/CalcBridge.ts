import type { WorkbookData, SheetCell } from '../../types';
import { DocumentContentNormalizer } from '../document/DocumentContentNormalizer';
import { SpreadsheetExportAdapter } from '../export/SpreadsheetExportAdapter';
import { renderSheetToNativeSearchablePdf } from '../../utils/nativePdfRenderer';

export interface CalcWorkbookStats {
  sheetCount: number;
  totalRows: number;
  totalCols: number;
  nonEmptyCells: number;
  formulaCount: number;
}

export interface CalcExportOptions {
  title?: string;
  dpi?: number;
  pdfa?: boolean;
  filter?: string;
}

/**
 * CalcBridge
 * Manages XLSX / XLS / CSV / ODS spreadsheets, connecting Lumina's UI to the local LibreOffice Calc engine.
 * 
 * Responsibilities:
 * - Parsing XLSX / CSV binary data into reactive WorkbookData models
 * - Generating native XLSX workbooks via LibreOffice Calc (`soffice --headless --convert-to xlsx`)
 * - Exporting high-fidelity PDF spreadsheets via LibreOffice Calc (`soffice --headless --convert-to pdf:calc_pdf_Export`)
 * - Formula calculation & evaluation, grid serialization, and table statistics
 */
export class CalcBridge {
  private getApiPath(endpoint: string): string {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    if (typeof window !== 'undefined') {
      // In browser or webview contexts, relative path works uniformly without window.location.origin issues
      return cleanEndpoint;
    }
    // In Node / testing contexts
    const base = (typeof process !== 'undefined' && process.env?.API_BASE_URL) || 'http://localhost:3000';
    return `${base}${cleanEndpoint}`;
  }

  private isElectron(): boolean {
    return typeof window !== 'undefined' && Boolean((window as any).electronAPI?.isElectron);
  }

  /**
   * Parse XLSX binary / base64 / ArrayBuffer into a structured WorkbookData
   */
  public async parseWorkbook(data: ArrayBuffer | Uint8Array | string): Promise<WorkbookData> {
    let buffer: ArrayBuffer;
    if (typeof data === 'string') {
      const cleanBase64 = data.includes(',') ? data.split(',')[1] : data;
      const binaryString = atob(cleanBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      buffer = bytes.buffer;
    } else if (data instanceof Uint8Array) {
      buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    } else {
      buffer = data;
    }

    const imported = await SpreadsheetExportAdapter.importFromXlsx(buffer, 'Workbook');
    return imported;
  }

  /**
   * Calculate workbook statistics
   */
  public calculateStats(workbook: WorkbookData): CalcWorkbookStats {
    let totalRows = 0;
    let totalCols = 0;
    let nonEmptyCells = 0;
    let formulaCount = 0;

    const sheets = Object.values(workbook?.sheets || {});
    sheets.forEach((sheet: any) => {
      totalRows = Math.max(totalRows, sheet.rowCount || sheet.rows || 0);
      totalCols = Math.max(totalCols, sheet.colCount || sheet.cols || 0);

      const cells = sheet.cells || {};
      Object.values(cells).forEach((cell: any) => {
        if (cell && (cell.v !== undefined || cell.raw !== undefined || cell.f || cell.value !== undefined)) {
          nonEmptyCells++;
          if (cell.f || (typeof cell.value === 'string' && cell.value.startsWith('='))) {
            formulaCount++;
          }
        }
      });
    });

    return {
      sheetCount: sheets.length,
      totalRows,
      totalCols,
      nonEmptyCells,
      formulaCount,
    };
  }

  /**
   * Convert workbook to standard CSV string
   */
  public toCsv(workbook: WorkbookData, activeSheetId?: string): string {
    const sheets = Object.values(workbook?.sheets || {});
    if (sheets.length === 0) return '';
    
    const targetSheet: any = activeSheetId 
      ? sheets.find((s: any) => s.id === activeSheetId) || sheets[0]
      : sheets[0];

    if (!targetSheet || !targetSheet.cells) return '';

    const maxR = targetSheet.rows || 30;
    const maxC = targetSheet.cols || 15;
    const rows: string[] = [];

    for (let r = 0; r < maxR; r++) {
      const rowVals: string[] = [];
      let hasDataInRow = false;
      for (let c = 0; c < maxC; c++) {
        const cell = targetSheet.cells[`${r},${c}`] || targetSheet.cells[`${r}_${c}`];
        let val = '';
        if (cell) {
          val = cell.value !== undefined ? String(cell.value) : cell.v !== undefined ? String(cell.v) : '';
        }
        if (val) hasDataInRow = true;
        // Escape CSV values with quotes if needed
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          rowVals.push(`"${val.replace(/"/g, '""')}"`);
        } else {
          rowVals.push(val);
        }
      }
      if (hasDataInRow || r < 10) {
        rows.push(rowVals.join(','));
      }
    }

    return rows.join('\n');
  }

  /**
   * Generate native XLSX binary via local LibreOffice Calc engine / SpreadsheetExportAdapter
   */
  public async generateXlsx(
    fileId: string,
    content: any,
    title: string = 'workbook'
  ): Promise<{ blob: Blob; size: number; filename: string }> {
    const safeTitle = title.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]/g, '_');

    // 1. If content is a structured WorkbookData or SheetData, produce 100% faithful multi-sheet XLSX
    if (content && typeof content === 'object' && ('sheets' in content || 'cells' in content)) {
      const blob = await SpreadsheetExportAdapter.exportToXlsx(content, { fileName: `${safeTitle}.xlsx` });
      
      // Cache binary to local backend engine for roundtrips
      try {
        const arrayBuf = await blob.arrayBuffer();
        const base64 = typeof Buffer !== 'undefined'
          ? Buffer.from(arrayBuf).toString('base64')
          : btoa(String.fromCharCode(...new Uint8Array(arrayBuf)));

        await fetch(this.getApiPath('/api/engine/save-document'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileId,
            format: 'sheet',
            base64,
            title: safeTitle,
          }),
        }).catch(() => {});
      } catch {}

      return {
        blob,
        size: blob.size,
        filename: `${safeTitle}.xlsx`,
      };
    }

    const normalized = DocumentContentNormalizer.normalizeForEngine(content, 'sheet', safeTitle);

    // 2. If running inside Electron desktop shell
    if (this.isElectron() && (window as any).electronAPI?.saveDocument) {
      try {
        const result = await (window as any).electronAPI.saveDocument({
          format: 'sheet',
          content: normalized.cleanContent,
          title: safeTitle,
        });
        if (result && result.success) {
          const uint8 = new Uint8Array(result.buffer || Buffer.from(result.base64, 'base64'));
          return {
            blob: new Blob([uint8], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
            size: result.size || uint8.length,
            filename: result.filename || `${safeTitle}.xlsx`,
          };
        }
      } catch (err) {
        console.warn('CalcBridge: Electron IPC saveDocument failed, falling back to local server:', err);
      }
    }

    // 3. Local backend LibreOffice Calc bridge
    try {
      const res = await fetch(this.getApiPath('/api/engine/save-document'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId,
          format: 'sheet',
          content: normalized.cleanContent,
          title: safeTitle,
        }),
      });

      if (res.ok) {
        const info = await res.json();
        const downloadRes = await fetch(this.getApiPath(`/api/engine/file/${fileId}`));
        if (downloadRes.ok) {
          const blob = await downloadRes.blob();
          return {
            blob,
            size: info.size || blob.size,
            filename: info.filename || `${safeTitle}.xlsx`,
          };
        }
      }
    } catch (err) {
      console.warn('CalcBridge backend save failed, using local XLSX exporter:', err);
    }

    // 4. Client-side pure XLSX export fallback
    const fallbackBlob = await SpreadsheetExportAdapter.exportToXlsx(content, { fileName: `${safeTitle}.xlsx` });
    return {
      blob: fallbackBlob,
      size: fallbackBlob.size,
      filename: `${safeTitle}.xlsx`,
    };
  }

  /**
   * Export spreadsheet to high-fidelity PDF via LibreOffice Calc Engine (`calc_pdf_Export`)
   */
  public async exportPdf(
    fileId: string,
    content: any,
    options: CalcExportOptions = {}
  ): Promise<Blob> {
    const safeTitle = (options.title || 'workbook').replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]/g, '_');

    // If structured workbook, generate XLSX binary base64 first to guarantee all sheets & styles in LibreOffice
    let base64Payload: string | undefined = undefined;
    if (content && typeof content === 'object' && ('sheets' in content || 'cells' in content)) {
      const xlsxBlob = await SpreadsheetExportAdapter.exportToXlsx(content, { fileName: `${safeTitle}.xlsx` });
      const arrayBuf = await xlsxBlob.arrayBuffer();
      base64Payload = typeof Buffer !== 'undefined'
        ? Buffer.from(arrayBuf).toString('base64')
        : btoa(String.fromCharCode(...new Uint8Array(arrayBuf)));
    }

    const normalized = !base64Payload ? DocumentContentNormalizer.normalizeForEngine(content, 'sheet', safeTitle) : null;

    // 1. Electron IPC
    if (this.isElectron() && (window as any).electronAPI?.exportPDF) {
      try {
        const result = await (window as any).electronAPI.exportPDF({
          format: 'sheet',
          content: base64Payload || normalized?.cleanContent,
          title: safeTitle,
        });
        if (result && result.success) {
          const uint8 = new Uint8Array(result.buffer || Buffer.from(result.base64, 'base64'));
          return new Blob([uint8], { type: 'application/pdf' });
        }
      } catch (err) {
        console.warn('CalcBridge: Electron IPC exportPDF failed, falling back to local server:', err);
      }
    }

    // 2. Local backend
    try {
      const res = await fetch(this.getApiPath('/api/engine/export-pdf'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId,
          content: normalized?.cleanContent,
          base64: base64Payload,
          format: 'sheet',
          title: safeTitle,
          pdfa: options.pdfa,
          dpi: options.dpi,
        }),
      });

      if (res.ok) {
        return await res.blob();
      }
    } catch (netErr) {
      console.warn('CalcBridge backend PDF export failed, using client vector renderer:', netErr);
    }

    // 3. Client-side pure Vector PDF generation fallback
    const pdfBytes = await renderSheetToNativeSearchablePdf(content, { fileName: `${safeTitle}.pdf` });
    return new Blob([pdfBytes], { type: 'application/pdf' });
  }
}

export const calcBridge = new CalcBridge();
