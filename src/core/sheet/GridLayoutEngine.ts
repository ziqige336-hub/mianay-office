import type { SheetMergeRange } from '../../types';
import type { SelectionRange } from './SpreadsheetSelectionManager';
import { normalizeSelectionRange } from './SpreadsheetSelectionManager';
import { MergeManager, normalizeMergeRange } from './MergeManager';

export interface CellPosition {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

export interface RangeBounds {
  left: number;
  top: number;
  width: number;
  height: number;
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
}

export interface MergedCell {
  id: string;
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
  rowSpan: number;
  colSpan: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface VisibleRange {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
  startRowOffset: number;
  startColOffset: number;
  totalVirtualWidth: number;
  totalVirtualHeight: number;
}

export interface GridLayoutOptions {
  totalRows: number;
  totalCols: number;
  defaultRowHeight?: number;
  defaultColWidth?: number;
  rowHeights?: Record<number, number>;
  colWidths?: Record<number, number>;
  hiddenRows?: Set<number>;
  merges?: SheetMergeRange[];
}

export class GridLayoutEngine {
  private totalRows: number;
  private totalCols: number;
  private defaultRowHeight: number;
  private defaultColWidth: number;
  private rowHeights: Record<number, number>;
  private colWidths: Record<number, number>;
  private hiddenRows: Set<number>;
  private mergeManager: MergeManager;

  // Cumulative offset caches for O(1) cell and range calculations
  private rowOffsetsCache: number[] = [];
  private colOffsetsCache: number[] = [];
  private effectiveRowHeights: number[] = [];
  private effectiveColWidths: number[] = [];

  constructor(options: GridLayoutOptions) {
    this.totalRows = Math.max(options.totalRows, 1);
    this.totalCols = Math.max(options.totalCols, 1);
    this.defaultRowHeight = options.defaultRowHeight ?? 24;
    this.defaultColWidth = options.defaultColWidth ?? 110;
    this.rowHeights = options.rowHeights ?? {};
    this.colWidths = options.colWidths ?? {};
    this.hiddenRows = options.hiddenRows ?? new Set();
    this.mergeManager = new MergeManager(options.merges ?? []);

    this.recomputeOffsets();
  }

  public getMergeManager(): MergeManager {
    return this.mergeManager;
  }

  /**
   * Updates merges and re-indexes merge lookups
   */
  public setMerges(merges: SheetMergeRange[]) {
    this.mergeManager.setMerges(merges);
  }

  public getMerges(): SheetMergeRange[] {
    return this.mergeManager.getAllMerges();
  }

  public isCellMerged(r: number, c: number): boolean {
    return this.mergeManager.isMerged(r, c);
  }

  public isMasterCell(r: number, c: number): boolean {
    return this.mergeManager.isMasterCell(r, c);
  }

  public isChildCell(r: number, c: number): boolean {
    return this.mergeManager.isChildCell(r, c);
  }

  public getMergeRange(r: number, c: number): SheetMergeRange | undefined {
    return this.mergeManager.getMergeRange(r, c);
  }

  public resolveMergedCell(r: number, c: number) {
    return this.mergeManager.resolveMergedCell(r, c);
  }

  public getMergedCellAt(r: number, c: number): MergedCell | undefined {
    const range = this.mergeManager.getMergeRange(r, c);
    if (!range) return undefined;
    const bounds = this.calculateMergedCellBounds(range);
    const startR = range.startRow ?? range.startR;
    const endR = range.endRow ?? range.endR;
    const startC = range.startColumn ?? range.startCol ?? range.startC;
    const endC = range.endColumn ?? range.endCol ?? range.endC;

    return {
      id: `merge_${startR}_${startC}_${endR}_${endC}`,
      startRow: startR,
      startCol: startC,
      endRow: endR,
      endCol: endC,
      rowSpan: endR - startR + 1,
      colSpan: endC - startC + 1,
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
    };
  }

  public getVisibleMerges(startRow: number, endRow: number, startCol: number, endCol: number): SheetMergeRange[] {
    return this.mergeManager.getVisibleMerges(startRow, endRow, startCol, endCol);
  }

  /**
   * Recomputes cumulative offsets when dimensions or column/row sizes change
   */
  public recomputeOffsets() {
    this.rowOffsetsCache = new Array(this.totalRows + 1);
    this.effectiveRowHeights = new Array(this.totalRows);
    let curTop = 0;
    for (let r = 0; r < this.totalRows; r++) {
      this.rowOffsetsCache[r] = curTop;
      const h = this.hiddenRows.has(r) ? 0 : (this.rowHeights[r] ?? this.defaultRowHeight);
      this.effectiveRowHeights[r] = h;
      curTop += h;
    }
    this.rowOffsetsCache[this.totalRows] = curTop;

    this.colOffsetsCache = new Array(this.totalCols + 1);
    this.effectiveColWidths = new Array(this.totalCols);
    let curLeft = 0;
    for (let c = 0; c < this.totalCols; c++) {
      this.colOffsetsCache[c] = curLeft;
      const w = this.colWidths[c] ?? this.defaultColWidth;
      this.effectiveColWidths[c] = w;
      curLeft += w;
    }
    this.colOffsetsCache[this.totalCols] = curLeft;
  }

  public getTotalWidth(): number {
    return this.colOffsetsCache[this.totalCols] || 0;
  }

  public getTotalHeight(): number {
    return this.rowOffsetsCache[this.totalRows] || 0;
  }

  public getRowOffset(r: number): number {
    const safeR = Math.max(0, Math.min(this.totalRows, r));
    return this.rowOffsetsCache[safeR] ?? 0;
  }

  public getColOffset(c: number): number {
    const safeC = Math.max(0, Math.min(this.totalCols, c));
    return this.colOffsetsCache[safeC] ?? 0;
  }

  public getRowHeight(r: number): number {
    if (r < 0 || r >= this.totalRows) return this.defaultRowHeight;
    return this.effectiveRowHeights[r] ?? this.defaultRowHeight;
  }

  public getColWidth(c: number): number {
    if (c < 0 || c >= this.totalCols) return this.defaultColWidth;
    return this.effectiveColWidths[c] ?? this.defaultColWidth;
  }

  /**
   * Calculate exact position and size of a single cell (returns full merged rectangle if cell is merged)
   */
  public calculateCellPosition(row: number, col: number): CellPosition {
    const merge = this.mergeManager.getMergeRange(row, col);
    if (merge) {
      const bounds = this.calculateMergedCellBounds(merge);
      return {
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
        right: bounds.left + bounds.width,
        bottom: bounds.top + bounds.height,
      };
    }

    const r = Math.max(0, Math.min(this.totalRows - 1, row));
    const c = Math.max(0, Math.min(this.totalCols - 1, col));

    const left = this.colOffsetsCache[c] ?? 0;
    const top = this.rowOffsetsCache[r] ?? 0;
    const width = this.effectiveColWidths[c] ?? this.defaultColWidth;
    const height = this.effectiveRowHeights[r] ?? this.defaultRowHeight;

    return {
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
    };
  }

  /**
   * Calculate exact unified rectangular bounds for any SelectionRange (supports single cells, ranges, rows, cols, all)
   */
  public calculateRangeBounds(range: SelectionRange): RangeBounds {
    const norm = normalizeSelectionRange(range);
    const minR = Math.max(0, Math.min(this.totalRows - 1, norm.minRow));
    const maxR = Math.max(0, Math.min(this.totalRows - 1, norm.maxRow));
    const minC = Math.max(0, Math.min(this.totalCols - 1, norm.minCol));
    const maxC = Math.max(0, Math.min(this.totalCols - 1, norm.maxCol));

    const left = this.colOffsetsCache[minC] ?? 0;
    const right = this.colOffsetsCache[maxC + 1] ?? this.getTotalWidth();
    const top = this.rowOffsetsCache[minR] ?? 0;
    const bottom = this.rowOffsetsCache[maxR + 1] ?? this.getTotalHeight();

    return {
      left,
      top,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
      minRow: minR,
      maxRow: maxR,
      minCol: minC,
      maxCol: maxC,
    };
  }

  /**
   * Calculate exact bounding box for a merged cell range
   */
  public calculateMergedCellBounds(merge: SheetMergeRange): RangeBounds {
    const rawMinR = merge.startRow !== undefined ? merge.startRow : merge.startR;
    const rawMaxR = merge.endRow !== undefined ? merge.endRow : merge.endR;
    const rawMinC = merge.startColumn !== undefined ? merge.startColumn : merge.startCol !== undefined ? merge.startCol : merge.startC;
    const rawMaxC = merge.endColumn !== undefined ? merge.endColumn : merge.endCol !== undefined ? merge.endCol : merge.endC;

    const minR = Math.max(0, Math.min(this.totalRows - 1, rawMinR));
    const maxR = Math.max(0, Math.min(this.totalRows - 1, rawMaxR));
    const minC = Math.max(0, Math.min(this.totalCols - 1, rawMinC));
    const maxC = Math.max(0, Math.min(this.totalCols - 1, rawMaxC));

    const left = this.colOffsetsCache[minC] ?? 0;
    const right = this.colOffsetsCache[maxC + 1] ?? this.getTotalWidth();
    const top = this.rowOffsetsCache[minR] ?? 0;
    const bottom = this.rowOffsetsCache[maxR + 1] ?? this.getTotalHeight();

    return {
      left,
      top,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
      minRow: minR,
      maxRow: maxR,
      minCol: minC,
      maxCol: maxC,
    };
  }

  /**
   * Constructs all MergedCell instances with pre-calculated pixel coordinates
   */
  public buildMergedCells(merges?: SheetMergeRange[]): MergedCell[] {
    if (!merges || merges.length === 0) return [];

    return merges.map((m) => {
      const bounds = this.calculateMergedCellBounds(m);
      return {
        id: `merge_${m.startR}_${m.startC}_${m.endR}_${m.endC}`,
        startRow: m.startR,
        startCol: m.startC,
        endRow: m.endR,
        endCol: m.endC,
        rowSpan: m.endR - m.startR + 1,
        colSpan: m.endC - m.startC + 1,
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
      };
    });
  }

  /**
   * Find cell row and column at given relative (x, y) pixel coordinates
   */
  public getCellAtPosition(relX: number, relY: number): { r: number; c: number } {
    let r = 0;
    let c = 0;

    // Binary search row
    let lowR = 0;
    let highR = this.totalRows - 1;
    while (lowR <= highR) {
      const mid = Math.floor((lowR + highR) / 2);
      const top = this.rowOffsetsCache[mid];
      const bottom = this.rowOffsetsCache[mid + 1];
      if (relY >= top && relY < bottom) {
        r = mid;
        break;
      } else if (relY < top) {
        highR = mid - 1;
      } else {
        lowR = mid + 1;
      }
    }
    if (lowR > highR) r = Math.max(0, Math.min(this.totalRows - 1, highR));

    // Binary search col
    let lowC = 0;
    let highC = this.totalCols - 1;
    while (lowC <= highC) {
      const mid = Math.floor((lowC + highC) / 2);
      const left = this.colOffsetsCache[mid];
      const right = this.colOffsetsCache[mid + 1];
      if (relX >= left && relX < right) {
        c = mid;
        break;
      } else if (relX < left) {
        highC = mid - 1;
      } else {
        lowC = mid + 1;
      }
    }
    if (lowC > highC) c = Math.max(0, Math.min(this.totalCols - 1, highC));

    return { r, c };
  }

  /**
   * Calculates visible virtual range for viewport virtualization
   */
  public getVisibleRange(
    scrollTop: number,
    scrollLeft: number,
    viewportWidth: number,
    viewportHeight: number,
    bufferRows: number = 5,
    bufferCols: number = 3
  ): VisibleRange {
    const startPos = this.getCellAtPosition(scrollLeft, scrollTop);
    const endPos = this.getCellAtPosition(scrollLeft + viewportWidth, scrollTop + viewportHeight);

    const startRow = Math.max(0, startPos.r - bufferRows);
    const endRow = Math.min(this.totalRows, endPos.r + bufferRows + 1);
    const startCol = Math.max(0, startPos.c - bufferCols);
    const endCol = Math.min(this.totalCols, endPos.c + bufferCols + 1);

    const startRowOffset = this.rowOffsetsCache[startRow] || 0;
    const startColOffset = this.colOffsetsCache[startCol] || 0;

    return {
      startRow,
      endRow,
      startCol,
      endCol,
      startRowOffset,
      startColOffset,
      totalVirtualWidth: this.getTotalWidth(),
      totalVirtualHeight: this.getTotalHeight(),
    };
  }
}
