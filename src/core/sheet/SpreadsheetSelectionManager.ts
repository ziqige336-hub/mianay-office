import type { MergeManager } from './MergeManager';

export type SelectionType = 'CELL' | 'RANGE' | 'ROW' | 'COLUMN' | 'ALL';

export interface SelectionRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
  startColumn?: number;
  endColumn?: number;
  type?: SelectionType;
  isEntireRow?: boolean;
  isEntireCol?: boolean;
}

export interface NormalizedRange {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
  rowCount: number;
  colCount: number;
}

export interface SelectionState {
  activeCell: { r: number; c: number };
  ranges: SelectionRange[];
  selectionMode: 'cell' | 'range' | 'row' | 'col' | 'all';
  selectionType?: SelectionType;
}

/**
 * Normalizes a selection range so min <= max
 */
export function normalizeSelectionRange(range: SelectionRange): NormalizedRange {
  const minRow = Math.min(range.startRow, range.endRow);
  const maxRow = Math.max(range.startRow, range.endRow);
  const minCol = Math.min(
    range.startCol !== undefined ? range.startCol : (range.startColumn ?? 0),
    range.endCol !== undefined ? range.endCol : (range.endColumn ?? 0)
  );
  const maxCol = Math.max(
    range.startCol !== undefined ? range.startCol : (range.startColumn ?? 0),
    range.endCol !== undefined ? range.endCol : (range.endColumn ?? 0)
  );

  return {
    minRow,
    maxRow,
    minCol,
    maxCol,
    rowCount: maxRow - minRow + 1,
    colCount: maxCol - minCol + 1,
  };
}

/**
 * Creates a single cell selection range
 */
export function createSingleCellRange(r: number, c: number): SelectionRange {
  return {
    startRow: r,
    startCol: c,
    endRow: r,
    endCol: c,
    startColumn: c,
    endColumn: c,
    type: 'CELL',
    isEntireRow: false,
    isEntireCol: false,
  };
}

/**
 * Creates a rectangular selection range
 */
export function createSelectionRange(
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  type?: SelectionType
): SelectionRange {
  const resolvedType = type || (startRow === endRow && startCol === endCol ? 'CELL' : 'RANGE');
  return {
    startRow,
    startCol,
    endRow,
    endCol,
    startColumn: startCol,
    endColumn: endCol,
    type: resolvedType,
    isEntireRow: false,
    isEntireCol: false,
  };
}

/**
 * Creates an entire row selection range
 */
export function createRowSelection(startRow: number, endRow: number, totalCols: number): SelectionRange {
  return {
    startRow,
    startCol: 0,
    endRow,
    endCol: totalCols - 1,
    startColumn: 0,
    endColumn: totalCols - 1,
    type: 'ROW',
    isEntireRow: true,
    isEntireCol: false,
  };
}

/**
 * Creates an entire column selection range
 */
export function createColSelection(startCol: number, endCol: number, totalRows: number): SelectionRange {
  return {
    startRow: 0,
    startCol,
    endRow: totalRows - 1,
    endCol,
    startColumn: startCol,
    endColumn: endCol,
    type: 'COLUMN',
    isEntireRow: false,
    isEntireCol: true,
  };
}

/**
 * Creates full sheet selection
 */
export function createAllSelection(totalRows: number, totalCols: number): SelectionRange {
  return {
    startRow: 0,
    startCol: 0,
    endRow: totalRows - 1,
    endCol: totalCols - 1,
    startColumn: 0,
    endColumn: totalCols - 1,
    type: 'ALL',
    isEntireRow: true,
    isEntireCol: true,
  };
}

/**
 * Checks if a coordinate is within a specific range
 */
export function isCellInRange(r: number, c: number, range: SelectionRange): boolean {
  const norm = normalizeSelectionRange(range);
  return r >= norm.minRow && r <= norm.maxRow && c >= norm.minCol && c <= norm.maxCol;
}

/**
 * Checks if a coordinate is within any of the provided ranges
 */
export function isCellInAnyRange(r: number, c: number, ranges: SelectionRange[]): boolean {
  for (let i = 0; i < ranges.length; i++) {
    if (isCellInRange(r, c, ranges[i])) return true;
  }
  return false;
}

/**
 * Check if a row is completely selected across active ranges
 */
export function isRowSelected(r: number, ranges: SelectionRange[]): boolean {
  for (const range of ranges) {
    const norm = normalizeSelectionRange(range);
    const isEntire = range.isEntireRow || range.type === 'ROW' || range.type === 'ALL';
    if (isEntire && r >= norm.minRow && r <= norm.maxRow) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a column is completely selected across active ranges
 */
export function isColSelected(c: number, ranges: SelectionRange[]): boolean {
  for (const range of ranges) {
    const norm = normalizeSelectionRange(range);
    const isEntire = range.isEntireCol || range.type === 'COLUMN' || range.type === 'ALL';
    if (isEntire && c >= norm.minCol && c <= norm.maxCol) {
      return true;
    }
  }
  return false;
}

/**
 * Converts a 0-indexed column index to letter representation (0 -> 'A', 25 -> 'Z', 26 -> 'AA')
 */
export function colIndexToLetter(col: number): string {
  let letter = '';
  let temp = col;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

/**
 * Formats a range to A1-style notation (e.g. "A1:C5", "A:A", "1:1")
 */
export function formatRangeToA1(range: SelectionRange): string {
  const norm = normalizeSelectionRange(range);
  const isCol = range.isEntireCol || range.type === 'COLUMN';
  const isRow = range.isEntireRow || range.type === 'ROW';

  if (isCol && norm.minCol === norm.maxCol) {
    const col = colIndexToLetter(norm.minCol);
    return `${col}:${col}`;
  }
  if (isCol) {
    return `${colIndexToLetter(norm.minCol)}:${colIndexToLetter(norm.maxCol)}`;
  }
  if (isRow && norm.minRow === norm.maxRow) {
    return `${norm.minRow + 1}:${norm.minRow + 1}`;
  }
  if (isRow) {
    return `${norm.minRow + 1}:${norm.maxRow + 1}`;
  }
  if (norm.minRow === norm.maxRow && norm.minCol === norm.maxCol) {
    return `${colIndexToLetter(norm.minCol)}${norm.minRow + 1}`;
  }
  return `${colIndexToLetter(norm.minCol)}${norm.minRow + 1}:${colIndexToLetter(norm.maxCol)}${norm.maxRow + 1}`;
}

/**
 * Formats multiple ranges to a combined string (e.g. "A1:C5, E1:F5")
 */
export function formatMultipleRanges(ranges: SelectionRange[]): string {
  if (!ranges || ranges.length === 0) return '';
  return ranges.map(formatRangeToA1).join(', ');
}

/**
 * Spreadsheet Selection Manager
 * Encapsulates selection state transitions, Shift expansion, and Ctrl/Cmd multi-selection.
 * Strictly isolates ROW and COLUMN header selections from Merge Range expansion.
 */
export class SpreadsheetSelectionManager {
  private activeCell: { r: number; c: number } = { r: 0, c: 0 };
  private anchorCell: { r: number; c: number } = { r: 0, c: 0 };
  private ranges: SelectionRange[] = [createSingleCellRange(0, 0)];
  private currentSelectionType: SelectionType = 'CELL';
  private totalRows: number = 1000;
  private totalCols: number = 26;
  private mergeManager?: MergeManager;

  constructor(totalRows: number = 1000, totalCols: number = 26, mergeManager?: MergeManager) {
    this.totalRows = totalRows;
    this.totalCols = totalCols;
    this.mergeManager = mergeManager;
  }

  public setDimensions(rows: number, cols: number) {
    this.totalRows = rows;
    this.totalCols = cols;
  }

  public setMergeManager(mergeManager?: MergeManager) {
    this.mergeManager = mergeManager;
  }

  public getActiveCell(): { r: number; c: number } {
    return { ...this.activeCell };
  }

  public getRanges(): SelectionRange[] {
    return [...this.ranges];
  }

  public getSelectionType(): SelectionType {
    return this.currentSelectionType;
  }

  public getPrimaryRange(): SelectionRange {
    return this.ranges[this.ranges.length - 1] || createSingleCellRange(this.activeCell.r, this.activeCell.c);
  }

  /**
   * Expands range ONLY if selection type is CELL or RANGE.
   * ROW and COLUMN selections are strictly prohibited from merge expansion.
   */
  private expandRange(range: SelectionRange): SelectionRange {
    if (!this.mergeManager) return range;

    const type = range.type || (range.isEntireRow ? 'ROW' : range.isEntireCol ? 'COLUMN' : (range.startRow === range.endRow && range.startCol === range.endCol ? 'CELL' : 'RANGE'));
    if (type === 'ROW' || type === 'COLUMN' || type === 'ALL' || range.isEntireRow || range.isEntireCol) {
      return range;
    }

    return this.mergeManager.expandMergeRange ? this.mergeManager.expandMergeRange(range) : this.mergeManager.expandSelectionToMergedRanges(range);
  }

  /**
   * Select a single cell, clearing previous selections unless multi-select
   */
  public selectCell(
    r: number,
    c: number,
    options: { isShift?: boolean; isCtrlOrCmd?: boolean; shiftKey?: boolean; ctrlKey?: boolean } = {}
  ): SelectionRange[] {
    const isShift = options.isShift || options.shiftKey;
    const isCtrlOrCmd = options.isCtrlOrCmd || options.ctrlKey;
    let targetR = Math.max(0, Math.min(this.totalRows - 1, r));
    let targetC = Math.max(0, Math.min(this.totalCols - 1, c));

    // If target cell belongs to a merged range and not shift-extending, resolve to master cell
    if (this.mergeManager && !isShift) {
      const resolved = this.mergeManager.resolveMergedCell(targetR, targetC);
      if (resolved.isMerged) {
        targetR = resolved.masterRow;
        targetC = resolved.masterCol;
      }
    }

    if (isShift) {
      this.currentSelectionType = 'RANGE';
      const rawRange = createSelectionRange(this.anchorCell.r, this.anchorCell.c, targetR, targetC, 'RANGE');
      const expanded = this.expandRange(rawRange);
      this.ranges = [expanded];
      this.activeCell = { r: targetR, c: targetC };
      return this.getRanges();
    }

    if (isCtrlOrCmd) {
      this.currentSelectionType = 'CELL';
      const rawRange = createSingleCellRange(targetR, targetC);
      const expanded = this.expandRange(rawRange);
      this.ranges.push(expanded);
      this.activeCell = { r: targetR, c: targetC };
      this.anchorCell = { r: targetR, c: targetC };
      return this.getRanges();
    }

    // Default normal click: expand to full merged range if cell is merged
    this.currentSelectionType = 'CELL';
    const rawRange = createSingleCellRange(targetR, targetC);
    const expanded = this.expandRange(rawRange);
    this.activeCell = { r: targetR, c: targetC };
    this.anchorCell = { r: targetR, c: targetC };
    this.ranges = [expanded];
    return this.getRanges();
  }

  public selectSingle(r: number, c: number): SelectionRange[] {
    return this.selectCell(r, c);
  }

  public selectRange(startRow: number, startCol: number, endRow: number, endCol: number): SelectionRange[] {
    this.currentSelectionType = 'RANGE';
    const rawRange = createSelectionRange(startRow, startCol, endRow, endCol, 'RANGE');
    const expanded = this.expandRange(rawRange);
    this.ranges = [expanded];
    this.activeCell = { r: startRow, c: startCol };
    this.anchorCell = { r: startRow, c: startCol };
    return this.getRanges();
  }

  public startSelection(
    r: number,
    c: number,
    options: { isShift?: boolean; isCtrlOrCmd?: boolean; shiftKey?: boolean; ctrlKey?: boolean } = {}
  ): SelectionRange[] {
    return this.selectCell(r, c, options);
  }

  /**
   * Update active dragging range to target cell
   */
  public updateDragSelection(
    targetR: number,
    targetC: number,
    options: { isCtrlOrCmd?: boolean; ctrlKey?: boolean } = {}
  ): SelectionRange[] {
    const isCtrlOrCmd = options.isCtrlOrCmd || options.ctrlKey;
    const boundedR = Math.max(0, Math.min(this.totalRows - 1, targetR));
    const boundedC = Math.max(0, Math.min(this.totalCols - 1, targetC));

    if (this.currentSelectionType === 'COLUMN') {
      return this.updateColumnSelection(boundedC, options);
    }

    if (this.currentSelectionType === 'ROW') {
      return this.updateRowSelection(boundedR, options);
    }

    this.currentSelectionType = 'RANGE';
    const rawRange = createSelectionRange(this.anchorCell.r, this.anchorCell.c, boundedR, boundedC, 'RANGE');
    const expandedRange = this.expandRange(rawRange);

    if (isCtrlOrCmd && this.ranges.length > 1) {
      this.ranges[this.ranges.length - 1] = expandedRange;
    } else {
      this.ranges = [expandedRange];
    }

    this.activeCell = { r: boundedR, c: boundedC };
    return this.getRanges();
  }

  public updateSelection(
    targetR: number,
    targetC: number,
    options: { isCtrlOrCmd?: boolean; ctrlKey?: boolean } = {}
  ): SelectionRange[] {
    return this.updateDragSelection(targetR, targetC, options);
  }

  /**
   * Select an entire column. Strictly prohibited from merge expansion.
   */
  public selectColumn(
    c: number,
    options: { isShift?: boolean; isCtrlOrCmd?: boolean; shiftKey?: boolean; ctrlKey?: boolean } = {}
  ): SelectionRange[] {
    this.currentSelectionType = 'COLUMN';
    const isShift = options.isShift || options.shiftKey;
    const isCtrlOrCmd = options.isCtrlOrCmd || options.ctrlKey;
    const targetC = Math.max(0, Math.min(this.totalCols - 1, c));

    if (isShift) {
      const startC = Math.min(this.anchorCell.c, targetC);
      const endC = Math.max(this.anchorCell.c, targetC);
      const rawRange = createColSelection(startC, endC, this.totalRows);
      this.ranges = [rawRange];
      this.activeCell = { r: 0, c: targetC };
      return this.getRanges();
    }

    if (isCtrlOrCmd) {
      const rawRange = createColSelection(targetC, targetC, this.totalRows);
      this.ranges.push(rawRange);
      this.activeCell = { r: 0, c: targetC };
      this.anchorCell = { r: 0, c: targetC };
      return this.getRanges();
    }

    const rawRange = createColSelection(targetC, targetC, this.totalRows);
    this.ranges = [rawRange];
    this.activeCell = { r: 0, c: targetC };
    this.anchorCell = { r: 0, c: targetC };
    return this.getRanges();
  }

  /**
   * Update column drag selection. Strictly prohibited from merge expansion.
   */
  public updateColumnSelection(
    c: number,
    options: { isCtrlOrCmd?: boolean; ctrlKey?: boolean } = {}
  ): SelectionRange[] {
    this.currentSelectionType = 'COLUMN';
    const isCtrlOrCmd = options.isCtrlOrCmd || options.ctrlKey;
    const targetC = Math.max(0, Math.min(this.totalCols - 1, c));
    const startC = Math.min(this.anchorCell.c, targetC);
    const endC = Math.max(this.anchorCell.c, targetC);

    const colRange = createColSelection(startC, endC, this.totalRows);
    if (isCtrlOrCmd && this.ranges.length > 1) {
      this.ranges[this.ranges.length - 1] = colRange;
    } else {
      this.ranges = [colRange];
    }

    this.activeCell = { r: 0, c: targetC };
    return this.getRanges();
  }

  /**
   * Select an entire row. Strictly prohibited from merge expansion.
   */
  public selectRow(
    r: number,
    options: { isShift?: boolean; isCtrlOrCmd?: boolean; shiftKey?: boolean; ctrlKey?: boolean } = {}
  ): SelectionRange[] {
    this.currentSelectionType = 'ROW';
    const isShift = options.isShift || options.shiftKey;
    const isCtrlOrCmd = options.isCtrlOrCmd || options.ctrlKey;
    const targetR = Math.max(0, Math.min(this.totalRows - 1, r));

    if (isShift) {
      const startR = Math.min(this.anchorCell.r, targetR);
      const endR = Math.max(this.anchorCell.r, targetR);
      const rawRange = createRowSelection(startR, endR, this.totalCols);
      this.ranges = [rawRange];
      this.activeCell = { r: targetR, c: 0 };
      return this.getRanges();
    }

    if (isCtrlOrCmd) {
      const rawRange = createRowSelection(targetR, targetR, this.totalCols);
      this.ranges.push(rawRange);
      this.activeCell = { r: targetR, c: 0 };
      this.anchorCell = { r: targetR, c: 0 };
      return this.getRanges();
    }

    const rawRange = createRowSelection(targetR, targetR, this.totalCols);
    this.ranges = [rawRange];
    this.activeCell = { r: targetR, c: 0 };
    this.anchorCell = { r: targetR, c: 0 };
    return this.getRanges();
  }

  /**
   * Update row drag selection. Strictly prohibited from merge expansion.
   */
  public updateRowSelection(
    r: number,
    options: { isCtrlOrCmd?: boolean; ctrlKey?: boolean } = {}
  ): SelectionRange[] {
    this.currentSelectionType = 'ROW';
    const isCtrlOrCmd = options.isCtrlOrCmd || options.ctrlKey;
    const targetR = Math.max(0, Math.min(this.totalRows - 1, r));
    const startR = Math.min(this.anchorCell.r, targetR);
    const endR = Math.max(this.anchorCell.r, targetR);

    const rowRange = createRowSelection(startR, endR, this.totalCols);
    if (isCtrlOrCmd && this.ranges.length > 1) {
      this.ranges[this.ranges.length - 1] = rowRange;
    } else {
      this.ranges = [rowRange];
    }

    this.activeCell = { r: targetR, c: 0 };
    return this.getRanges();
  }

  /**
   * Select all cells
   */
  public selectAll(): SelectionRange[] {
    this.currentSelectionType = 'ALL';
    const range = createAllSelection(this.totalRows, this.totalCols);
    this.ranges = [range];
    this.activeCell = { r: 0, c: 0 };
    this.anchorCell = { r: 0, c: 0 };
    return this.getRanges();
  }

  public isColumnSelected(c: number): boolean {
    return isColSelected(c, this.ranges);
  }

  public isRowSelected(r: number): boolean {
    return isRowSelected(r, this.ranges);
  }

  public isCellSelected(r: number, c: number): boolean {
    return isCellInAnyRange(r, c, this.ranges);
  }

  /**
   * Set exact ranges directly
   */
  public setRanges(ranges: SelectionRange[], activeCell?: { r: number; c: number }): SelectionState {
    if (!ranges || ranges.length === 0) {
      this.ranges = [createSingleCellRange(0, 0)];
      this.activeCell = { r: 0, c: 0 };
      this.anchorCell = { r: 0, c: 0 };
      this.currentSelectionType = 'CELL';
    } else {
      this.ranges = ranges;
      this.currentSelectionType = ranges[0]?.type || 'RANGE';
      if (activeCell) {
        this.activeCell = { ...activeCell };
        this.anchorCell = { ...activeCell };
      }
    }
    return this.getState(this.currentSelectionType === 'COLUMN' ? 'col' : this.currentSelectionType === 'ROW' ? 'row' : 'range');
  }

  private getState(mode: SelectionState['selectionMode']): SelectionState {
    return {
      activeCell: { ...this.activeCell },
      ranges: [...this.ranges],
      selectionMode: mode,
      selectionType: this.currentSelectionType,
    };
  }
}

