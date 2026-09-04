import type { OfficeFile, SheetCell, SheetData, WorkbookData } from '../types';
import { calcBridge, CalcWorkbookStats } from '../core/office/CalcBridge';
import { officeEngine } from '../core/office/OfficeEngine';

export interface CellRangeSelection {
  startR: number;
  startC: number;
  endR: number;
  endC: number;
}

export interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'area';
  title: string;
  range: CellRangeSelection;
  categoriesCol?: number;
  seriesCols?: number[];
}

/**
 * SpreadsheetService
 * 
 * High-level Lumina Feature Layer Service for Spreadsheet (Calc).
 * Provides programmatic sheet querying, cell range updates, formula insertion,
 * chart creation, AI-driven data analysis/formula generation, and persistence via CalcBridge.
 */
export class SpreadsheetService {
  private static instance: SpreadsheetService;
  private currentWorkbook: WorkbookData | null = null;
  private onWorkbookUpdateCallback?: (wb: WorkbookData) => void;
  private currentFile: OfficeFile | null = null;

  private constructor() {}

  public static getInstance(): SpreadsheetService {
    if (!SpreadsheetService.instance) {
      SpreadsheetService.instance = new SpreadsheetService();
    }
    return SpreadsheetService.instance;
  }

  /**
   * Bind the active workbook state and updater hook
   */
  public registerWorkbook(
    workbook: WorkbookData,
    updater?: (wb: WorkbookData) => void,
    file?: OfficeFile | null
  ): void {
    this.currentWorkbook = workbook;
    if (updater) {
      this.onWorkbookUpdateCallback = updater;
    }
    if (file) {
      this.currentFile = file;
    }
  }

  public setCurrentFile(file: OfficeFile | null): void {
    this.currentFile = file;
  }

  /**
   * 1. getCurrentSheet()
   * Retrieves the currently active worksheet model, or undefined if no sheet is active.
   */
  public getCurrentSheet(): SheetData | undefined {
    if (!this.currentWorkbook || !this.currentWorkbook.sheets || this.currentWorkbook.sheets.length === 0) {
      return undefined;
    }
    const activeId = this.currentWorkbook.activeSheetId;
    return this.currentWorkbook.sheets.find((s) => s.id === activeId) || this.currentWorkbook.sheets[0];
  }

  /**
   * 2. getRange()
   * Retrieves an array of cell values and attributes for a specified bounding box.
   */
  public getRange(range: CellRangeSelection): { r: number; c: number; cell?: SheetCell; value: any }[] {
    const sheet = this.getCurrentSheet();
    if (!sheet || !sheet.cells) return [];

    const minR = Math.min(range.startR, range.endR);
    const maxR = Math.max(range.startR, range.endR);
    const minC = Math.min(range.startC, range.endC);
    const maxC = Math.max(range.startC, range.endC);

    const result: { r: number; c: number; cell?: SheetCell; value: any }[] = [];

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const key = `${r},${c}`;
        const keyAlt = `${r}:${c}`;
        const cell = sheet.cells[key] || sheet.cells[keyAlt];
        result.push({
          r,
          c,
          cell,
          value: cell ? (cell.value !== undefined ? cell.value : cell.v) : '',
        });
      }
    }

    return result;
  }

  /**
   * 3. setCellValue()
   * Sets the value (or formula) and optional formatting for a specific cell coordinate.
   */
  public setCellValue(r: number, c: number, value: any, formatting?: Partial<SheetCell>): boolean {
    const sheet = this.getCurrentSheet();
    if (!sheet || !this.currentWorkbook) return false;

    const cellKey = `${r},${c}`;
    const existing = sheet.cells[cellKey] || {};
    const updatedCell: SheetCell = {
      ...existing,
      value: value,
      v: value,
      ...formatting,
    };

    const updatedCells = {
      ...sheet.cells,
      [cellKey]: updatedCell,
    };

    const updatedSheet: SheetData = {
      ...sheet,
      cells: updatedCells,
    };

    const updatedWorkbook: WorkbookData = {
      ...this.currentWorkbook,
      sheets: this.currentWorkbook.sheets.map((s) => (s.id === sheet.id ? updatedSheet : s)),
    };

    this.currentWorkbook = updatedWorkbook;
    if (this.onWorkbookUpdateCallback) {
      this.onWorkbookUpdateCallback(updatedWorkbook);
    }
    return true;
  }

  /**
   * Batch update multiple cells at once
   */
  public setRangeValues(
    startR: number,
    startC: number,
    matrix: (string | number | null | undefined)[][]
  ): boolean {
    const sheet = this.getCurrentSheet();
    if (!sheet || !this.currentWorkbook) return false;

    const updatedCells = { ...sheet.cells };

    matrix.forEach((row, rIdx) => {
      row.forEach((val, cIdx) => {
        if (val !== undefined && val !== null) {
          const r = startR + rIdx;
          const c = startC + cIdx;
          const key = `${r},${c}`;
          updatedCells[key] = {
            ...updatedCells[key],
            value: String(val),
            v: val,
          };
        }
      });
    });

    const updatedSheet: SheetData = {
      ...sheet,
      cells: updatedCells,
    };

    const updatedWorkbook: WorkbookData = {
      ...this.currentWorkbook,
      sheets: this.currentWorkbook.sheets.map((s) => (s.id === sheet.id ? updatedSheet : s)),
    };

    this.currentWorkbook = updatedWorkbook;
    if (this.onWorkbookUpdateCallback) {
      this.onWorkbookUpdateCallback(updatedWorkbook);
    }
    return true;
  }

  /**
   * 4. insertFormula()
   * Inserts an Excel/WPS compatible formula (e.g., =SUM(A1:A10), =AVERAGE(B2:B20)) into target coordinate.
   */
  public insertFormula(r: number, c: number, formula: string): boolean {
    let cleanFormula = formula.trim();
    if (!cleanFormula.startsWith('=')) {
      cleanFormula = `=${cleanFormula}`;
    }
    return this.setCellValue(r, c, cleanFormula, {
      bold: true,
      color: '#2563eb', // highlight formulas subtly
    });
  }

  /**
   * 5. createChart()
   * Generates chart specifications from a selected range of table data.
   */
  public createChart(config: ChartConfig): {
    title: string;
    type: string;
    labels: string[];
    datasets: { name: string; values: number[] }[];
  } {
    const rangeData = this.getRange(config.range);
    const minR = Math.min(config.range.startR, config.range.endR);
    const maxR = Math.max(config.range.startR, config.range.endR);
    const minC = Math.min(config.range.startC, config.range.endC);
    const maxC = Math.max(config.range.startC, config.range.endC);

    const labels: string[] = [];
    const values: number[] = [];

    // Simple 2-column or 1-column extraction
    for (let r = minR; r <= maxR; r++) {
      const labelCell = rangeData.find((d) => d.r === r && d.c === minC);
      const valCell = rangeData.find((d) => d.r === r && d.c === (minC < maxC ? minC + 1 : minC));
      
      const lbl = labelCell?.value ? String(labelCell.value) : `行 ${r + 1}`;
      const val = valCell ? Number(valCell.value) || 0 : 0;

      labels.push(lbl);
      values.push(val);
    }

    return {
      title: config.title || '数据图表分析',
      type: config.type,
      labels,
      datasets: [
        {
          name: config.title || '序列 1',
          values,
        },
      ],
    };
  }

  /**
   * AI Table Analysis:
   * Summarizes table structure, computes column stats, and delegates to AI prompt.
   */
  public async analyzeTableWithAi(
    aiWorker: (tableSummary: string) => Promise<string>
  ): Promise<{ summary: string; insights: string }> {
    const sheet = this.getCurrentSheet();
    if (!sheet) {
      throw new Error('未检测到有效的工作表数据');
    }

    const csvData = this.currentWorkbook ? calcBridge.toCsv(this.currentWorkbook, sheet.id) : '';
    const stats = this.currentWorkbook ? calcBridge.calculateStats(this.currentWorkbook) : { totalRows: 0, totalCols: 0, nonEmptyCells: 0, formulaCount: 0, sheetCount: 1 };

    const promptContext = `工作表名称: ${sheet.title}\n有效单元格: ${stats.nonEmptyCells} 个，公式: ${stats.formulaCount} 个\n数据内容 (CSV 格式):\n${csvData.slice(0, 3000)}`;
    const insights = await aiWorker(promptContext);

    return {
      summary: `已分析 ${stats.nonEmptyCells} 个单元格数据`,
      insights,
    };
  }

  /**
   * Save workbook to local disk or cache via LibreOffice Calc
   */
  public async saveWorkbook(): Promise<{ success: boolean; filename: string; size: number }> {
    if (!this.currentWorkbook || !this.currentFile) {
      throw new Error('未载入可保存的工作簿');
    }
    const title = this.currentFile.name || '工作簿.xlsx';
    const result = await calcBridge.generateXlsx(this.currentFile.id, this.currentWorkbook, title);
    return {
      success: true,
      filename: result.filename,
      size: result.size,
    };
  }

  /**
   * Export workbook to PDF via LibreOffice Calc Engine
   */
  public async exportPdf(options?: { title?: string; fitToPage?: boolean }): Promise<Blob> {
    if (!this.currentWorkbook || !this.currentFile) {
      throw new Error('未载入工作簿');
    }
    return await calcBridge.exportPdf(this.currentFile.id, this.currentWorkbook, options);
  }
}

export const spreadsheetService = SpreadsheetService.getInstance();
