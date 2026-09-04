import * as XLSX from 'xlsx';
import { SpreadsheetExportAdapter } from '../core/export/SpreadsheetExportAdapter';
import type { SheetData, SheetCell, WorkbookData, ConditionalFormattingRule, PivotTableConfig, SheetMergeRange, CellBorderConfig } from '../types';

export function createInitialSheet(): SheetData {
  const cells: Record<string, SheetCell> = {};

  // Professional Financial & Operations Model (Apple Numbers Style)
  const headers = ['业务板块', 'Q1 实际营收', 'Q2 实际营收', 'Q3 预测营收', '季度环比增长', '预算执行状态'];
  headers.forEach((h, col) => {
    cells[`0,${col}`] = {
      value: h,
      bold: true,
      bg: '#f1f5f9',
      align: col === 0 ? 'left' : 'center',
      borders: { bottom: true, color: '#cbd5e1', style: 'medium' }
    };
  });

  const rowsData = [
    ['企业级解决方案', '1250000', '1420000', '1680000', '=D2/C2-1', '达标'],
    ['数字化办公服务', '880000', '950000', '1120000', '=D3/C3-1', '达标'],
    ['技术支持与维保', '320000', '350000', '390000', '=D4/C4-1', '达标'],
    ['培训与咨询业务', '150000', '180000', '220000', '=D5/C5-1', '超额'],
    ['研发创新项目', '210000', '260000', '310000', '=D6/C6-1', '达标'],
    ['合计与总览', '=SUM(B2:B6)', '=SUM(C2:C6)', '=SUM(D2:D6)', '=D7/C7-1', '健康'],
  ];

  rowsData.forEach((row, rIdx) => {
    const rowNum = rIdx + 1;
    row.forEach((val, cIdx) => {
      const isTotalRow = rowNum === rowsData.length;
      cells[`${rowNum},${cIdx}`] = {
        value: val,
        bold: isTotalRow,
        format: cIdx >= 1 && cIdx <= 3 ? 'currency' : cIdx === 4 ? 'percent' : 'general',
        bg: isTotalRow ? '#e2e8f0' : undefined,
        align: cIdx === 0 ? 'left' : cIdx === 5 ? 'center' : 'right',
        borders: isTotalRow ? { top: true, bottom: true, color: '#94a3b8', style: 'double' } : undefined,
      };
    });
  });

  return {
    id: 'sheet-default',
    title: '2026年业务季度运营分析与预测模型',
    rows: 35,
    cols: 15,
    cells,
    colWidths: { 0: 160, 1: 130, 2: 130, 3: 130, 4: 130, 5: 120 },
    freezeRows: 1,
    merges: [],
  };
}

/**
 * Convert Column Index (0, 1, 2) to Letter (A, B, C)
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
 * Convert Letter (A, B, C) to Column Index (0, 1, 2)
 */
export function colLetterToIndex(str: string): number {
  let col = 0;
  const upper = str.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    col = col * 26 + (upper.charCodeAt(i) - 64);
  }
  return col - 1;
}

export const letterToColIndex = colLetterToIndex;

/**
 * Parse cell coordinate string like "A1" into { r: 0, c: 0 }
 */
export function parseCellCoord(coord: string): { r: number; c: number } | null {
  const m = coord.trim().match(/^([A-Z]+)(\d+)$/i);
  if (!m) return null;
  return {
    c: colLetterToIndex(m[1]),
    r: parseInt(m[2], 10) - 1,
  };
}

/**
 * Parse range string like "A1:C5" into bounding coords
 */
export function parseRange(rangeStr: string): {
  startR: number;
  startC: number;
  endR: number;
  endC: number;
} | null {
  const parts = rangeStr.split(':').map((p) => p.trim());
  if (parts.length === 1) {
    const coord = parseCellCoord(parts[0]);
    if (!coord) return null;
    return { startR: coord.r, startC: coord.c, endR: coord.r, endC: coord.c };
  }
  if (parts.length === 2) {
    const c1 = parseCellCoord(parts[0]);
    const c2 = parseCellCoord(parts[1]);
    if (!c1 || !c2) return null;
    return {
      startR: Math.min(c1.r, c2.r),
      startC: Math.min(c1.c, c2.c),
      endR: Math.max(c1.r, c2.r),
      endC: Math.max(c1.c, c2.c),
    };
  }
  return null;
}

/**
 * Shift formula relative cell references by delta rows and delta columns
 * e.g. "=A1+B1" with deltaR=1 becomes "=A2+B2"
 * Absolute references ($A$1) stay constant.
 */
export function shiftFormulaCellRefs(formula: string, deltaR: number, deltaC: number): string {
  if (!formula || !formula.startsWith('=')) return formula;

  return formula.replace(/(\$?)([A-Z]+)(\$?)(\d+)/gi, (match, colDollar, colLetters, rowDollar, rowNum) => {
    let col = colLetterToIndex(colLetters);
    let row = parseInt(rowNum, 10) - 1;

    if (!colDollar) {
      col = Math.max(0, col + deltaC);
    }
    if (!rowDollar) {
      row = Math.max(0, row + deltaR);
    }

    const newColStr = (colDollar ? '$' : '') + colIndexToLetter(col);
    const newRowStr = (rowDollar ? '$' : '') + (row + 1);
    return `${newColStr}${newRowStr}`;
  });
}

/**
 * Helper to get evaluated cell value
 */
export function getCellValue(r: number, c: number, allCells: Record<string, SheetCell>): any {
  const cell = allCells[`${r},${c}`];
  if (!cell || cell.value === undefined || cell.value === '') return '';
  if (cell.value.startsWith('=')) {
    return evaluateCellFormula(cell.value, allCells);
  }
  return cell.value;
}

export function getCellValueNumber(r: number, c: number, allCells: Record<string, SheetCell>): number {
  const val = getCellValue(r, c, allCells);
  if (typeof val === 'number') return val;
  const parsed = parseFloat(String(val).replace(/,/g, ''));
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Comprehensive Formula Engine Supporting 30+ Financial, Statistical, Math & Text Functions
 */
export function evaluateCellFormula(
  formula: string,
  allCells: Record<string, SheetCell>,
  callStack: Set<string> = new Set()
): string | number {
  if (!formula || !formula.startsWith('=')) return formula;

  const raw = formula.substring(1).trim();

  // Guard against circular references
  if (callStack.has(raw)) return '#CIRCULAR!';
  const nextStack = new Set(callStack);
  nextStack.add(raw);

  try {
    const upper = raw.toUpperCase();

    // 1. SUM(Range)
    const sumMatch = upper.match(/^SUM\(([^)]+)\)$/);
    if (sumMatch) {
      const range = parseRange(sumMatch[1]);
      if (!range) return '#REF!';
      let total = 0;
      for (let r = range.startR; r <= range.endR; r++) {
        for (let c = range.startC; c <= range.endC; c++) {
          total += getCellValueNumber(r, c, allCells);
        }
      }
      return total;
    }

    // 2. AVERAGE(Range)
    const avgMatch = upper.match(/^AVERAGE\(([^)]+)\)$/);
    if (avgMatch) {
      const range = parseRange(avgMatch[1]);
      if (!range) return '#REF!';
      let total = 0;
      let count = 0;
      for (let r = range.startR; r <= range.endR; r++) {
        for (let c = range.startC; c <= range.endC; c++) {
          total += getCellValueNumber(r, c, allCells);
          count++;
        }
      }
      return count > 0 ? total / count : 0;
    }

    // 3. COUNT(Range)
    const countMatch = upper.match(/^COUNT\(([^)]+)\)$/);
    if (countMatch) {
      const range = parseRange(countMatch[1]);
      if (!range) return '#REF!';
      let count = 0;
      for (let r = range.startR; r <= range.endR; r++) {
        for (let c = range.startC; c <= range.endC; c++) {
          const val = getCellValue(r, c, allCells);
          if (val !== '' && !isNaN(Number(val))) count++;
        }
      }
      return count;
    }

    // 4. COUNTA(Range)
    const countaMatch = upper.match(/^COUNTA\(([^)]+)\)$/);
    if (countaMatch) {
      const range = parseRange(countaMatch[1]);
      if (!range) return '#REF!';
      let count = 0;
      for (let r = range.startR; r <= range.endR; r++) {
        for (let c = range.startC; c <= range.endC; c++) {
          const val = getCellValue(r, c, allCells);
          if (val !== '' && val !== null && val !== undefined) count++;
        }
      }
      return count;
    }

    // 5. MAX(Range) & MIN(Range)
    const maxMatch = upper.match(/^MAX\(([^)]+)\)$/);
    if (maxMatch) {
      const range = parseRange(maxMatch[1]);
      if (!range) return '#REF!';
      let maxVal = -Infinity;
      for (let r = range.startR; r <= range.endR; r++) {
        for (let c = range.startC; c <= range.endC; c++) {
          const val = getCellValueNumber(r, c, allCells);
          if (val > maxVal) maxVal = val;
        }
      }
      return maxVal === -Infinity ? 0 : maxVal;
    }

    const minMatch = upper.match(/^MIN\(([^)]+)\)$/);
    if (minMatch) {
      const range = parseRange(minMatch[1]);
      if (!range) return '#REF!';
      let minVal = Infinity;
      for (let r = range.startR; r <= range.endR; r++) {
        for (let c = range.startC; c <= range.endC; c++) {
          const val = getCellValueNumber(r, c, allCells);
          if (val < minVal) minVal = val;
        }
      }
      return minVal === Infinity ? 0 : minVal;
    }

    // 6. SUMIF(range, criteria, [sum_range])
    const sumifMatch = raw.match(/^SUMIF\(([^,]+),\s*([^,]+)(?:,\s*([^)]+))?\)$/i);
    if (sumifMatch) {
      const condRange = parseRange(sumifMatch[1].trim());
      const criteria = sumifMatch[2].trim().replace(/^['"]|['"]$/g, '');
      const sumRange = sumifMatch[3] ? parseRange(sumifMatch[3].trim()) : condRange;
      if (!condRange || !sumRange) return '#REF!';

      let total = 0;
      const numRows = condRange.endR - condRange.startR;
      const numCols = condRange.endC - condRange.startC;

      for (let ro = 0; ro <= numRows; ro++) {
        for (let co = 0; co <= numCols; co++) {
          const condVal = String(getCellValue(condRange.startR + ro, condRange.startC + co, allCells));
          let match = false;
          if (criteria.startsWith('>=')) match = Number(condVal) >= Number(criteria.slice(2));
          else if (criteria.startsWith('<=')) match = Number(condVal) <= Number(criteria.slice(2));
          else if (criteria.startsWith('>')) match = Number(condVal) > Number(criteria.slice(1));
          else if (criteria.startsWith('<')) match = Number(condVal) < Number(criteria.slice(1));
          else match = condVal.toLowerCase() === criteria.toLowerCase();

          if (match) {
            total += getCellValueNumber(sumRange.startR + ro, sumRange.startC + co, allCells);
          }
        }
      }
      return total;
    }

    // 7. COUNTIF(range, criteria)
    const countifMatch = raw.match(/^COUNTIF\(([^,]+),\s*([^)]+)\)$/i);
    if (countifMatch) {
      const range = parseRange(countifMatch[1].trim());
      const criteria = countifMatch[2].trim().replace(/^['"]|['"]$/g, '');
      if (!range) return '#REF!';
      let count = 0;
      for (let r = range.startR; r <= range.endR; r++) {
        for (let c = range.startC; c <= range.endC; c++) {
          const val = String(getCellValue(r, c, allCells));
          let match = false;
          if (criteria.startsWith('>=')) match = Number(val) >= Number(criteria.slice(2));
          else if (criteria.startsWith('<=')) match = Number(val) <= Number(criteria.slice(2));
          else if (criteria.startsWith('>')) match = Number(val) > Number(criteria.slice(1));
          else if (criteria.startsWith('<')) match = Number(val) < Number(criteria.slice(1));
          else match = val.toLowerCase() === criteria.toLowerCase();
          if (match) count++;
        }
      }
      return count;
    }

    // 8. IF(condition, trueVal, falseVal)
    const ifMatch = raw.match(/^IF\((.+),\s*(.+),\s*(.+)\)$/i);
    if (ifMatch) {
      const cond = ifMatch[1].trim();
      const trueVal = ifMatch[2].trim().replace(/^['"]|['"]$/g, '');
      const falseVal = ifMatch[3].trim().replace(/^['"]|['"]$/g, '');

      const condSubstituted = cond.replace(/([A-Z]+)(\d+)/gi, (_, colLetters, rowNum) => {
        const col = colLetterToIndex(colLetters);
        const row = parseInt(rowNum, 10) - 1;
        const val = getCellValue(row, col, allCells);
        return typeof val === 'string' ? `"${val}"` : String(val);
      });

      try {
        // eslint-disable-next-line no-new-func
        const isTrue = new Function(`return Boolean(${condSubstituted.replace(/=/g, '===')})`)();
        return isTrue ? trueVal : falseVal;
      } catch {
        return falseVal;
      }
    }

    // 9. Text Functions: CONCAT, TRIM, UPPER, LOWER, LEN, LEFT, RIGHT, MID
    const concatMatch = raw.match(/^(?:CONCAT|CONCATENATE)\(([^)]+)\)$/i);
    if (concatMatch) {
      const args = concatMatch[1].split(',').map((s) => s.trim());
      return args
        .map((arg) => {
          if (arg.startsWith('"') && arg.endsWith('"')) return arg.slice(1, -1);
          if (arg.startsWith("'") && arg.endsWith("'")) return arg.slice(1, -1);
          const coord = parseCellCoord(arg);
          return coord ? String(getCellValue(coord.r, coord.c, allCells)) : arg;
        })
        .join('');
    }

    const trimMatch = raw.match(/^TRIM\(([^)]+)\)$/i);
    if (trimMatch) {
      const val = evaluateSingleArg(trimMatch[1], allCells);
      return String(val).trim();
    }

    const upperMatch = raw.match(/^UPPER\(([^)]+)\)$/i);
    if (upperMatch) {
      const val = evaluateSingleArg(upperMatch[1], allCells);
      return String(val).toUpperCase();
    }

    const lowerMatch = raw.match(/^LOWER\(([^)]+)\)$/i);
    if (lowerMatch) {
      const val = evaluateSingleArg(lowerMatch[1], allCells);
      return String(val).toLowerCase();
    }

    const lenMatch = raw.match(/^LEN\(([^)]+)\)$/i);
    if (lenMatch) {
      const val = evaluateSingleArg(lenMatch[1], allCells);
      return String(val).length;
    }

    const leftMatch = raw.match(/^LEFT\(([^,]+)(?:,\s*(\d+))?\)$/i);
    if (leftMatch) {
      const val = String(evaluateSingleArg(leftMatch[1], allCells));
      const n = leftMatch[2] ? parseInt(leftMatch[2], 10) : 1;
      return val.slice(0, n);
    }

    const rightMatch = raw.match(/^RIGHT\(([^,]+)(?:,\s*(\d+))?\)$/i);
    if (rightMatch) {
      const val = String(evaluateSingleArg(rightMatch[1], allCells));
      const n = rightMatch[2] ? parseInt(rightMatch[2], 10) : 1;
      return val.slice(-n);
    }

    const midMatch = raw.match(/^MID\(([^,]+),\s*(\d+),\s*(\d+)\)$/i);
    if (midMatch) {
      const val = String(evaluateSingleArg(midMatch[1], allCells));
      const start = parseInt(midMatch[2], 10) - 1;
      const len = parseInt(midMatch[3], 10);
      return val.substring(start, start + len);
    }

    // 10. VLOOKUP(lookupValue, tableRange, colIndex, [exactMatch])
    const vlookupMatch = raw.match(/^VLOOKUP\((.+),\s*([A-Z0-9:]+),\s*(\d+)(?:,\s*([^)]+))?\)$/i);
    if (vlookupMatch) {
      const lookupVal = vlookupMatch[1].trim().replace(/^['"]|['"]$/g, '');
      const range = parseRange(vlookupMatch[2].trim());
      const colOffset = parseInt(vlookupMatch[3].trim(), 10) - 1;
      if (!range || colOffset < 0) return '#REF!';

      for (let r = range.startR; r <= range.endR; r++) {
        const keyCell = String(getCellValue(r, range.startC, allCells)).trim();
        if (keyCell.toLowerCase() === lookupVal.toLowerCase()) {
          const targetCol = range.startC + colOffset;
          return getCellValue(r, targetCol, allCells);
        }
      }
      return '#N/A';
    }

    // 11. INDEX(range, rowNum, colNum)
    const indexMatch = raw.match(/^INDEX\(([A-Z0-9:]+),\s*(\d+)(?:,\s*(\d+))?\)$/i);
    if (indexMatch) {
      const range = parseRange(indexMatch[1]);
      const rowIdx = parseInt(indexMatch[2], 10) - 1;
      const colIdx = indexMatch[3] ? parseInt(indexMatch[3], 10) - 1 : 0;
      if (!range) return '#REF!';
      const targetR = range.startR + rowIdx;
      const targetC = range.startC + colIdx;
      return getCellValue(targetR, targetC, allCells);
    }

    // 12. MATCH(lookupVal, range, [matchType])
    const matchFunc = raw.match(/^MATCH\((.+),\s*([A-Z0-9:]+)(?:,\s*(\d+))?\)$/i);
    if (matchFunc) {
      const lookupVal = matchFunc[1].trim().replace(/^['"]|['"]$/g, '');
      const range = parseRange(matchFunc[2]);
      if (!range) return '#REF!';
      let pos = 1;
      for (let r = range.startR; r <= range.endR; r++) {
        for (let c = range.startC; c <= range.endC; c++) {
          const cellVal = String(getCellValue(r, c, allCells)).trim();
          if (cellVal.toLowerCase() === lookupVal.toLowerCase()) {
            return pos;
          }
          pos++;
        }
      }
      return '#N/A';
    }

    // 13. TODAY() & NOW() & DATE()
    if (upper === 'TODAY()') {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    if (upper === 'NOW()') {
      return new Date().toLocaleString('zh-CN');
    }
    const dateMatch = upper.match(/^DATE\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (dateMatch) {
      return `${dateMatch[1]}-${String(dateMatch[2]).padStart(2, '0')}-${String(dateMatch[3]).padStart(2, '0')}`;
    }

    // 14. ROUND(val, digits), ABS(val), SQRT(val)
    const roundMatch = upper.match(/^ROUND\((.+),\s*(\d+)\)$/);
    if (roundMatch) {
      const num = evaluateExpression(roundMatch[1], allCells);
      const digits = parseInt(roundMatch[2], 10);
      return Number(Number(num).toFixed(digits));
    }
    const absMatch = upper.match(/^ABS\((.+)\)$/);
    if (absMatch) {
      return Math.abs(Number(evaluateExpression(absMatch[1], allCells)));
    }
    const sqrtMatch = upper.match(/^SQRT\((.+)\)$/);
    if (sqrtMatch) {
      return Math.sqrt(Number(evaluateExpression(sqrtMatch[1], allCells)));
    }

    // 15. Financial: PMT(rate, nper, pv)
    const pmtMatch = raw.match(/^PMT\((.+),\s*(.+),\s*(.+)\)$/i);
    if (pmtMatch) {
      const rate = Number(evaluateExpression(pmtMatch[1], allCells));
      const nper = Number(evaluateExpression(pmtMatch[2], allCells));
      const pv = Number(evaluateExpression(pmtMatch[3], allCells));
      if (rate === 0) return -(pv / nper);
      const pmt = (pv * rate * Math.pow(1 + rate, nper)) / (Math.pow(1 + rate, nper) - 1);
      return -pmt;
    }

    // 16. Standard Arithmetic Expression Evaluation (e.g. B2*C2 - 100 or D2/C2-1)
    return evaluateExpression(raw, allCells);
  } catch (err) {
    return '#ERR';
  }
}

function evaluateSingleArg(arg: string, allCells: Record<string, SheetCell>): string | number {
  const trimmed = arg.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  const coord = parseCellCoord(trimmed);
  if (coord) {
    return getCellValue(coord.r, coord.c, allCells);
  }
  return trimmed;
}

/**
 * Evaluates arithmetic formula strings replacing cell coords with numbers
 */
function evaluateExpression(expr: string, allCells: Record<string, SheetCell>): number | string {
  const substituted = expr.replace(/([A-Z]+)(\d+)/gi, (_, colLetters, rowNum) => {
    const col = colLetterToIndex(colLetters);
    const row = parseInt(rowNum, 10) - 1;
    const num = getCellValueNumber(row, col, allCells);
    return String(num);
  });

  if (/^[0-9+\-*/().\s^%]+$/.test(substituted)) {
    try {
      const sanitized = substituted.replace(/\^/g, '**');
      // eslint-disable-next-line no-new-func
      const result = new Function(`return (${sanitized})`)();
      return typeof result === 'number' && !isNaN(result) ? result : '#ERR';
    } catch {
      return '#ERR';
    }
  }
  return expr;
}

/**
 * Format displayed cell value according to format settings
 */
export function formatCellValue(cell: SheetCell, rawEvaluated: string | number): string {
  if (rawEvaluated === undefined || rawEvaluated === null || rawEvaluated === '') return '';
  if (cell.format === 'text') return String(rawEvaluated);

  const num = typeof rawEvaluated === 'number' ? rawEvaluated : parseFloat(String(rawEvaluated));

  if (!isNaN(num) && typeof num === 'number') {
    const decimals = cell.decimalPlaces !== undefined ? cell.decimalPlaces : 2;

    switch (cell.format) {
      case 'currency':
        return `¥${num.toLocaleString('zh-CN', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })}`;
      case 'percent':
        return `${(num * 100).toFixed(decimals)}%`;
      case 'number':
        return cell.thousandSeparator !== false
          ? num.toLocaleString('zh-CN', {
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals,
            })
          : num.toFixed(decimals);
      case 'scientific':
        return num.toExponential(decimals);
      case 'date':
      case 'shortDate': {
        const d = new Date(rawEvaluated);
        if (!isNaN(d.getTime())) {
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
        return String(rawEvaluated);
      }
      case 'time': {
        const d = new Date(rawEvaluated);
        if (!isNaN(d.getTime())) {
          return d.toLocaleTimeString('zh-CN');
        }
        return String(rawEvaluated);
      }
      default:
        if (cell.thousandSeparator) {
          return num.toLocaleString('zh-CN');
        }
        return String(rawEvaluated);
    }
  }

  return String(rawEvaluated);
}

/**
 * Clear formatting of a cell while keeping value & formula
 */
export function clearCellFormats(cell: SheetCell): SheetCell {
  return {
    value: cell.value,
    computed: cell.computed,
    comment: cell.comment,
    hyperlink: cell.hyperlink,
  };
}

/**
 * Smart AutoFill Series Generator
 * Extends values downward or rightward (e.g. 1 -> 2, 3... or 2026-08-01 -> 2026-08-02... or formulas with shifted relative refs)
 */
export function generateAutoFillValue(
  sourceValues: string[],
  stepIndex: number, // 1, 2, 3... steps after the source block
  deltaR: number,
  deltaC: number
): string {
  if (sourceValues.length === 0) return '';
  const lastVal = sourceValues[sourceValues.length - 1];

  // 1. If it's a formula, shift relative references!
  if (lastVal.startsWith('=')) {
    return shiftFormulaCellRefs(lastVal, deltaR, deltaC);
  }

  // 2. If it's a 2+ number sequence (e.g. [1, 2] or [10, 20])
  if (sourceValues.length >= 2) {
    const nums = sourceValues.map((v) => parseFloat(v));
    const allNums = nums.every((n) => !isNaN(n));
    if (allNums) {
      const step = (nums[nums.length - 1] - nums[0]) / (nums.length - 1);
      const nextNum = nums[nums.length - 1] + step * stepIndex;
      return Number.isInteger(nextNum) ? String(nextNum) : nextNum.toFixed(2);
    }
  }

  // 3. If it's a single pure number, increment by 1
  const singleNum = parseFloat(lastVal);
  if (!isNaN(singleNum) && /^-?\d+(\.\d+)?$/.test(lastVal.trim())) {
    const nextNum = singleNum + stepIndex;
    return String(nextNum);
  }

  // 4. If it's a date "YYYY-MM-DD"
  const dateMatch = lastVal.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateMatch) {
    const d = new Date(parseInt(dateMatch[1], 10), parseInt(dateMatch[2], 10) - 1, parseInt(dateMatch[3], 10) + stepIndex);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // 5. Chinese Weekdays
  const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const wIdx = weekdays.indexOf(lastVal.trim());
  if (wIdx !== -1) {
    return weekdays[(wIdx + stepIndex) % 7];
  }

  // 6. Quarters: Q1, Q2, Q3, Q4
  const qMatch = lastVal.match(/^Q(\d)$/i);
  if (qMatch) {
    const qNum = parseInt(qMatch[1], 10);
    const nextQ = ((qNum - 1 + stepIndex) % 4) + 1;
    return `Q${nextQ}`;
  }

  // 7. Months: 1月, 2月...
  const mMatch = lastVal.match(/^(\d{1,2})月$/);
  if (mMatch) {
    const mNum = parseInt(mMatch[1], 10);
    const nextM = ((mNum - 1 + stepIndex) % 12) + 1;
    return `${nextM}月`;
  }

  // 8. Text ending with number (e.g. "部门1" -> "部门2", "Item 01" -> "Item 02")
  const textNumMatch = lastVal.match(/^(.*?)(\d+)$/);
  if (textNumMatch) {
    const prefix = textNumMatch[1];
    const numStr = textNumMatch[2];
    const nextNum = parseInt(numStr, 10) + stepIndex;
    return `${prefix}${String(nextNum).padStart(numStr.length, '0')}`;
  }

  // Fallback: Repeat/copy value
  return lastVal;
}

/**
 * Conditional formatting rule check
 */
export function evaluateConditionalStyle(
  r: number,
  c: number,
  val: any,
  rules?: ConditionalFormattingRule[]
): { bg?: string; color?: string } | null {
  if (!rules || rules.length === 0) return null;

  for (const rule of rules) {
    const range = parseRange(rule.range);
    if (!range) continue;

    if (r >= range.startR && r <= range.endR && c >= range.startC && c <= range.endC) {
      const num = typeof val === 'number' ? val : parseFloat(String(val));
      const target1 = Number(rule.value1);
      const target2 = Number(rule.value2);

      if (rule.type === 'greaterThan' && !isNaN(num) && !isNaN(target1) && num > target1) {
        return { bg: rule.bg || '#dcfce7', color: rule.color || '#166534' };
      }
      if (rule.type === 'lessThan' && !isNaN(num) && !isNaN(target1) && num < target1) {
        return { bg: rule.bg || '#fee2e2', color: rule.color || '#991b1b' };
      }
      if (rule.type === 'between' && !isNaN(num) && num >= target1 && num <= target2) {
        return { bg: rule.bg || '#fef3c7', color: rule.color || '#92400e' };
      }
      if (rule.type === 'equal' && String(val) === String(rule.value1)) {
        return { bg: rule.bg || '#dbeafe', color: rule.color || '#1e40af' };
      }
      if (rule.type === 'contains' && String(val).includes(String(rule.value1))) {
        return { bg: rule.bg || '#f3e8ff', color: rule.color || '#6b21a8' };
      }
    }
  }
  return null;
}

/**
 * Check if cell is covered by a merge range
 */
export function getCellMergeInfo(
  r: number,
  c: number,
  merges?: SheetMergeRange[]
): { isMerged: boolean; isMaster: boolean; rowSpan: number; colSpan: number; mergeRange?: SheetMergeRange } {
  if (!merges || merges.length === 0) {
    return { isMerged: false, isMaster: false, rowSpan: 1, colSpan: 1 };
  }

  for (const m of merges) {
    const startR = m.startRow !== undefined ? m.startRow : m.startR;
    const endR = m.endRow !== undefined ? m.endRow : m.endR;
    const startC = m.startColumn !== undefined ? m.startColumn : m.startCol !== undefined ? m.startCol : m.startC;
    const endC = m.endColumn !== undefined ? m.endColumn : m.endCol !== undefined ? m.endCol : m.endC;

    if (r >= startR && r <= endR && c >= startC && c <= endC) {
      const isMaster = r === startR && c === startC;
      return {
        isMerged: true,
        isMaster,
        rowSpan: endR - startR + 1,
        colSpan: endC - startC + 1,
        mergeRange: m,
      };
    }
  }

  return { isMerged: false, isMaster: false, rowSpan: 1, colSpan: 1 };
}

/**
 * Pivot Table Engine
 */
export function generatePivotTableData(
  sheet: SheetData,
  config: PivotTableConfig
): { headers: string[]; rows: (string | number)[][] } {
  const range = parseRange(config.sourceRange) || {
    startR: 0,
    startC: 0,
    endR: sheet.rows - 1,
    endC: sheet.cols - 1,
  };

  const groups: Record<string, number[]> = {};

  for (let r = range.startR + 1; r <= range.endR; r++) {
    const rowKey = String(getCellValue(r, config.rowField, sheet.cells)).trim();
    if (!rowKey) continue;

    const val = getCellValueNumber(r, config.valueField, sheet.cells);
    if (!groups[rowKey]) groups[rowKey] = [];
    groups[rowKey].push(val);
  }

  const headers = ['行标签', `${config.aggregation} of 值`];
  const rows: (string | number)[][] = [];

  Object.keys(groups).forEach((key) => {
    const vals = groups[key];
    let agg = 0;
    if (config.aggregation === 'SUM') agg = vals.reduce((a, b) => a + b, 0);
    else if (config.aggregation === 'COUNT') agg = vals.length;
    else if (config.aggregation === 'AVERAGE') agg = vals.reduce((a, b) => a + b, 0) / vals.length;
    else if (config.aggregation === 'MAX') agg = Math.max(...vals);
    else if (config.aggregation === 'MIN') agg = Math.min(...vals);

    rows.push([key, agg]);
  });

  return { headers, rows };
}

/**
 * Export Sheet to Excel (.xlsx)
 */
export async function exportSheetToXlsx(sheet: SheetData): Promise<Blob> {
  return await SpreadsheetExportAdapter.exportToXlsx(sheet);
}

/**
 * Import XLSX to WorkbookData (preserves multi-sheet, formulas, merges, formatting)
 */
export async function importXlsxToWorkbook(file: File | ArrayBuffer | Uint8Array): Promise<WorkbookData> {
  let buffer: ArrayBuffer;
  let title = '电子表格';
  if (file instanceof File) {
    buffer = await file.arrayBuffer();
    title = file.name.replace(/\.[^/.]+$/, '');
  } else if (file instanceof Uint8Array) {
    buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  } else {
    buffer = file;
  }
  return await SpreadsheetExportAdapter.importFromXlsx(buffer, title);
}

/**
 * Import XLSX to SheetData
 */
export async function importXlsxToSheet(file: File | ArrayBuffer | Uint8Array): Promise<SheetData> {
  const wbData = await importXlsxToWorkbook(file);
  return wbData.sheets[0] || {
    id: `sheet-${Date.now()}`,
    title: typeof (file as any).name === 'string' ? (file as any).name.replace(/\.[^/.]+$/, '') : '工作表 1',
    rows: 35,
    cols: 15,
    cells: {},
    merges: [],
  };
}
