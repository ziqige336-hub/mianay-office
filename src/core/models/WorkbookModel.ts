import type {
  SheetData,
  WorkbookData,
  SheetCell,
  SheetMergeRange,
  CellBorderConfig,
  ConditionalFormattingRule,
  SheetChartConfig,
  SheetFilterState,
} from '../../types';

export type { SheetData, WorkbookData };

export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  bg?: string;
  color?: string;
  borders?: CellBorderConfig;
  fontFamily?: string;
  fontSize?: number;
  format?: string;
}

export interface WorkbookCell extends SheetCell {
  formula?: string;
  style?: CellStyle;
}

export interface SheetModel {
  id: string;
  title: string;
  rows: number;
  cols: number;
  cells: Record<string, SheetCell>;
  merges: SheetMergeRange[];
  columnWidth: Record<number, number>;
  rowHeight: Record<number, number>;
  colWidths?: Record<number, number>;
  rowHeights?: Record<number, number>;
  freezeRows?: number;
  freezeCols?: number;
  tabColor?: string;
  conditionalRules?: ConditionalFormattingRule[];
  charts?: SheetChartConfig[];
  filterState?: SheetFilterState;
}

export interface WorkbookModel {
  activeSheetId: string;
  sheets: SheetModel[];
}

export class WorkbookModelTracer {
  public static traceWorkbookStats(model: WorkbookModel | any): {
    sheetCount: number;
    cellCount: number;
    styleCount: number;
    mergeCount: number;
    formulaCount: number;
  } {
    const sheets: SheetModel[] = Array.isArray(model.sheets) ? model.sheets : [model];
    const sheetCount = sheets.length;
    let cellCount = 0;
    let styleCount = 0;
    let mergeCount = 0;
    let formulaCount = 0;

    for (const s of sheets) {
      if (s.merges && Array.isArray(s.merges)) {
        mergeCount += s.merges.length;
      }
      const cells = s.cells || {};
      for (const key of Object.keys(cells)) {
        const cell = cells[key];
        if (cell && (cell.value !== undefined && cell.value !== null && cell.value !== '')) {
          cellCount++;
          if (String(cell.value).startsWith('=') || cell.f || (cell as any).formula) {
            formulaCount++;
          }
          if (cell.bold || cell.italic || cell.bg || cell.color || cell.borders || cell.style || cell.align) {
            styleCount++;
          }
        }
      }
    }

    console.log('====================================================');
    console.log('📊 [Lumina WorkbookModel SSOT Export Trace]');
    console.log(`  Sheet数量:     ${sheetCount}`);
    console.log(`  Cell数量:      ${cellCount}`);
    console.log(`  Style数量:     ${styleCount}`);
    console.log(`  Merge数量:     ${mergeCount}`);
    console.log(`  Formula数量:   ${formulaCount}`);
    console.log('====================================================');

    return {
      sheetCount,
      cellCount,
      styleCount,
      mergeCount,
      formulaCount,
    };
  }
}
