import type { SheetMergeRange } from '../../types';
import type { SelectionRange } from './SpreadsheetSelectionManager';
import { normalizeSelectionRange } from './SpreadsheetSelectionManager';

export interface ResolvedMergedCell {
  row: number;
  col: number;
  masterRow: number;
  masterCol: number;
  isMerged: boolean;
  isMaster: boolean;
  range?: SheetMergeRange;
}

/**
 * Normalizes a SheetMergeRange ensuring all properties (startRow/startR, startColumn/startC, endRow/endR, endColumn/endC)
 * are populated and start <= end.
 */
export function normalizeMergeRange(merge: Partial<SheetMergeRange>): SheetMergeRange {
  const minR = Math.min(
    merge.startRow !== undefined ? merge.startRow : (merge.startR ?? 0),
    merge.endRow !== undefined ? merge.endRow : (merge.endR ?? 0)
  );
  const maxR = Math.max(
    merge.startRow !== undefined ? merge.startRow : (merge.startR ?? 0),
    merge.endRow !== undefined ? merge.endRow : (merge.endR ?? 0)
  );
  const minC = Math.min(
    merge.startColumn !== undefined ? merge.startColumn : merge.startCol !== undefined ? merge.startCol : (merge.startC ?? 0),
    merge.endColumn !== undefined ? merge.endColumn : merge.endCol !== undefined ? merge.endCol : (merge.endC ?? 0)
  );
  const maxC = Math.max(
    merge.startColumn !== undefined ? merge.startColumn : merge.startCol !== undefined ? merge.startCol : (merge.startC ?? 0),
    merge.endColumn !== undefined ? merge.endColumn : merge.endCol !== undefined ? merge.endCol : (merge.endC ?? 0)
  );

  return {
    startR: minR,
    startC: minC,
    endR: maxR,
    endC: maxC,
    startRow: minR,
    startColumn: minC,
    startCol: minC,
    endRow: maxR,
    endColumn: maxC,
    endCol: maxC,
  };
}

/**
 * Professional High-Performance MergeManager for Spreadsheet
 * Compliant with Microsoft Excel, WPS Office, and Google Sheets merge specifications.
 */
export class MergeManager {
  private merges: SheetMergeRange[] = [];
  // Fast O(1) lookup map: "r,c" -> SheetMergeRange
  private cellToMergeMap: Map<string, SheetMergeRange> = new Map();
  // Master cell lookup: "r,c" -> SheetMergeRange
  private masterToMergeMap: Map<string, SheetMergeRange> = new Map();

  constructor(merges: SheetMergeRange[] = []) {
    this.setMerges(merges);
  }

  /**
   * Replaces all merges and rebuilds spatial index
   */
  public setMerges(merges: SheetMergeRange[] = []): void {
    this.merges = merges.map(normalizeMergeRange);
    this.rebuildIndex();
  }

  /**
   * Rebuilds the O(1) cell-to-merge map
   */
  private rebuildIndex(): void {
    this.cellToMergeMap.clear();
    this.masterToMergeMap.clear();

    for (const m of this.merges) {
      const startR = m.startRow ?? m.startR;
      const endR = m.endRow ?? m.endR;
      const startC = m.startColumn ?? m.startCol ?? m.startC;
      const endC = m.endColumn ?? m.endCol ?? m.endC;

      this.masterToMergeMap.set(`${startR},${startC}`, m);

      for (let r = startR; r <= endR; r++) {
        for (let c = startC; c <= endC; c++) {
          this.cellToMergeMap.set(`${r},${c}`, m);
        }
      }
    }
  }

  /**
   * Returns all normalized merge ranges
   */
  public getAllMerges(): SheetMergeRange[] {
    return [...this.merges];
  }

  /**
   * Get merge range covering (row, column) if any
   */
  public getMergeRange(row: number, column: number): SheetMergeRange | undefined {
    return this.cellToMergeMap.get(`${row},${column}`);
  }

  /**
   * Resolves any cell coordinate to its master cell and merge metadata
   */
  public resolveMergedCell(row: number, column: number): ResolvedMergedCell {
    const merge = this.getMergeRange(row, column);
    if (!merge) {
      return {
        row,
        col: column,
        masterRow: row,
        masterCol: column,
        isMerged: false,
        isMaster: false,
      };
    }

    const startR = merge.startRow ?? merge.startR;
    const startC = merge.startColumn ?? merge.startCol ?? merge.startC;
    const isMaster = row === startR && column === startC;

    return {
      row,
      col: column,
      masterRow: startR,
      masterCol: startC,
      isMerged: true,
      isMaster,
      range: merge,
    };
  }

  /**
   * Returns whether cell is part of any merge range
   */
  public isMerged(row: number, column: number): boolean {
    return this.cellToMergeMap.has(`${row},${column}`);
  }

  /**
   * Returns whether cell is the top-left master cell of a merge range
   */
  public isMasterCell(row: number, column: number): boolean {
    return this.masterToMergeMap.has(`${row},${column}`);
  }

  /**
   * Returns whether cell is a non-master child inside a merge range
   */
  public isChildCell(row: number, column: number): boolean {
    const merge = this.getMergeRange(row, column);
    if (!merge) return false;
    const startR = merge.startRow ?? merge.startR;
    const startC = merge.startColumn ?? merge.startCol ?? merge.startC;
    return row !== startR || column !== startC;
  }

  /**
   * Finds all merge ranges that overlap with given SelectionRange
   */
  public getOverlappingMerges(range: SelectionRange): SheetMergeRange[] {
    const norm = normalizeSelectionRange(range);
    const result: SheetMergeRange[] = [];

    for (const m of this.merges) {
      const startR = m.startRow ?? m.startR;
      const endR = m.endRow ?? m.endR;
      const startC = m.startColumn ?? m.startCol ?? m.startC;
      const endC = m.endColumn ?? m.endCol ?? m.endC;

      const isOverlap = !(endR < norm.minRow || startR > norm.maxRow || endC < norm.minCol || startC > norm.maxCol);
      if (isOverlap) {
        result.push(m);
      }
    }

    return result;
  }

  /**
   * Expands a selection range iteratively until all intersecting merged ranges are fully enclosed
   * (Standard Excel / WPS behavior for CELL and RANGE selection & dragging).
   * ROW and COLUMN selections are strictly prohibited from merge expansion.
   */
  public expandSelectionToMergedRanges(range: SelectionRange): SelectionRange {
    if (this.merges.length === 0) return range;

    const isCol = range.isEntireCol || range.type === 'COLUMN';
    const isRow = range.isEntireRow || range.type === 'ROW';
    const isAll = range.type === 'ALL' || (range.isEntireRow && range.isEntireCol);

    if (isCol || isRow || isAll) {
      return range;
    }

    const norm = normalizeSelectionRange(range);
    let minR = norm.minRow;
    let maxR = norm.maxRow;
    let minC = norm.minCol;
    let maxC = norm.maxCol;

    let hasExpanded = true;
    while (hasExpanded) {
      hasExpanded = false;
      for (const m of this.merges) {
        const startR = m.startRow ?? m.startR;
        const endR = m.endRow ?? m.endR;
        const startC = m.startColumn ?? m.startCol ?? m.startC;
        const endC = m.endColumn ?? m.endCol ?? m.endC;

        const isOverlap = !(endR < minR || startR > maxR || endC < minC || startC > maxC);
        if (isOverlap) {
          if (startR < minR) {
            minR = startR;
            hasExpanded = true;
          }
          if (endR > maxR) {
            maxR = endR;
            hasExpanded = true;
          }
          if (startC < minC) {
            minC = startC;
            hasExpanded = true;
          }
          if (endC > maxC) {
            maxC = endC;
            hasExpanded = true;
          }
        }
      }
    }

    // Preserve original anchor orientation
    const isReversedR = range.startRow > range.endRow;
    const isReversedC = range.startCol > range.endCol;

    return {
      startRow: isReversedR ? maxR : minR,
      startCol: isReversedC ? maxC : minC,
      endRow: isReversedR ? minR : maxR,
      endCol: isReversedC ? minC : maxC,
      startColumn: isReversedC ? maxC : minC,
      endColumn: isReversedC ? minC : maxC,
      type: range.type || (minR === maxR && minC === maxC ? 'CELL' : 'RANGE'),
      isEntireRow: range.isEntireRow,
      isEntireCol: range.isEntireCol,
    };
  }

  /**
   * Alias for expandSelectionToMergedRanges
   */
  public expandMergeRange(range: SelectionRange): SelectionRange {
    return this.expandSelectionToMergedRanges(range);
  }

  /**
   * Returns all merge ranges that intersect with the visible viewport window
   */
  public getVisibleMerges(startRow: number, endRow: number, startCol: number, endCol: number): SheetMergeRange[] {
    const result: SheetMergeRange[] = [];
    for (const m of this.merges) {
      const startR = m.startRow ?? m.startR;
      const endR = m.endRow ?? m.endR;
      const startC = m.startColumn ?? m.startCol ?? m.startC;
      const endC = m.endColumn ?? m.endCol ?? m.endC;

      const isVisible = !(endR < startRow || startR > endRow || endC < startCol || startC > endCol);
      if (isVisible) {
        result.push(m);
      }
    }
    return result;
  }

  /**
   * Adds a new merge range and removes any conflicting overlaps
   */
  public addMerge(range: Partial<SheetMergeRange>): void {
    const norm = normalizeMergeRange(range);
    // Filter out any merge ranges that overlap with the new merge
    const startR = norm.startRow!;
    const endR = norm.endRow!;
    const startC = norm.startColumn!;
    const endC = norm.endColumn!;

    const filtered = this.merges.filter((m) => {
      const mStartR = m.startRow ?? m.startR;
      const mEndR = m.endRow ?? m.endR;
      const mStartC = m.startColumn ?? m.startCol ?? m.startC;
      const mEndC = m.endColumn ?? m.endCol ?? m.endC;
      return mEndR < startR || mStartR > endR || mEndC < startC || mStartC > endC;
    });

    filtered.push(norm);
    this.setMerges(filtered);
  }

  /**
   * Removes merge at specific cell or removes merge range
   */
  public removeMerge(row: number, column: number): void {
    const merge = this.getMergeRange(row, column);
    if (!merge) return;
    const startR = merge.startRow ?? merge.startR;
    const startC = merge.startColumn ?? merge.startCol ?? merge.startC;
    const filtered = this.merges.filter((m) => {
      const mStartR = m.startRow ?? m.startR;
      const mStartC = m.startColumn ?? m.startCol ?? m.startC;
      return !(mStartR === startR && mStartC === startC);
    });
    this.setMerges(filtered);
  }

  /**
   * Removes any merge range overlapping with given selection
   */
  public removeOverlappingMerges(range: SelectionRange): void {
    const norm = normalizeSelectionRange(range);
    const filtered = this.merges.filter((m) => {
      const startR = m.startRow ?? m.startR;
      const endR = m.endRow ?? m.endR;
      const startC = m.startColumn ?? m.startCol ?? m.startC;
      const endC = m.endColumn ?? m.endCol ?? m.endC;
      return endR < norm.minRow || startR > norm.maxRow || endC < norm.minCol || startC > norm.maxCol;
    });
    this.setMerges(filtered);
  }

  /**
   * Calculates the exact pixel dimensions of a merged range by summing individual column widths and row heights
   */
  public calculateMergeDimensions(
    merge: SheetMergeRange,
    getColWidth: (c: number) => number,
    getRowHeight: (r: number) => number
  ): { width: number; height: number } {
    const startR = merge.startRow ?? merge.startR;
    const endR = merge.endRow ?? merge.endR;
    const startC = merge.startColumn ?? merge.startCol ?? merge.startC;
    const endC = merge.endColumn ?? merge.endCol ?? merge.endC;

    let width = 0;
    for (let c = startC; c <= endC; c++) {
      width += getColWidth(c);
    }

    let height = 0;
    for (let r = startR; r <= endR; r++) {
      height += getRowHeight(r);
    }

    return { width, height };
  }
}
