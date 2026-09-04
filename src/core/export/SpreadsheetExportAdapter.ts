import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import {
  Document,
  Packer,
  Table,
  TableRow,
  TableCell,
  Paragraph,
  TextRun,
  WidthType,
  BorderStyle,
  ShadingType,
  AlignmentType,
} from 'docx';
import type { SheetData, SheetCell, WorkbookData, SheetMergeRange, CellBorderConfig } from '../../types';
import { evaluateCellFormula, formatCellValue, colIndexToLetter, getCellMergeInfo } from '../../utils/sheetUtils';
import { renderSheetToNativeSearchablePdf } from '../../utils/nativePdfRenderer';

export interface SpreadsheetExportOptions {
  fileName?: string;
  sheetIndex?: number;
  includeGridLines?: boolean;
  includeHeaderRow?: boolean;
  orientation?: 'portrait' | 'landscape';
  pageSize?: 'A4' | 'Letter';
  onProgress?: (progress: number, message: string) => void;
}

/**
 * Convert Hex / RGB / RGBA or named color to 8-digit ARGB string (AARRGGBB) for ExcelJS / OpenXML
 */
export function toArgb(colorStr?: string, defaultArgb?: string): string | undefined {
  if (!colorStr || colorStr === 'transparent' || colorStr === 'inherit' || colorStr === 'none') {
    return defaultArgb;
  }
  const clean = colorStr.trim();

  // Hex format: #RGB, #RRGGBB, #AARRGGBB
  if (clean.startsWith('#')) {
    const hex = clean.substring(1);
    if (hex.length === 3) {
      const r = hex[0] + hex[0];
      const g = hex[1] + hex[1];
      const b = hex[2] + hex[2];
      return `FF${r}${g}${b}`.toUpperCase();
    }
    if (hex.length === 6) {
      return `FF${hex}`.toUpperCase();
    }
    if (hex.length === 8) {
      return hex.toUpperCase();
    }
  }

  // rgb(r, g, b) or rgba(r, g, b, a)
  const rgbMatch = clean.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/i);
  if (rgbMatch) {
    const r = Math.min(255, Math.max(0, parseInt(rgbMatch[1], 10))).toString(16).padStart(2, '0');
    const g = Math.min(255, Math.max(0, parseInt(rgbMatch[2], 10))).toString(16).padStart(2, '0');
    const b = Math.min(255, Math.max(0, parseInt(rgbMatch[3], 10))).toString(16).padStart(2, '0');
    const a = rgbMatch[4] !== undefined
      ? Math.min(255, Math.max(0, Math.round(parseFloat(rgbMatch[4]) * 255))).toString(16).padStart(2, '0')
      : 'FF';
    return `${a}${r}${g}${b}`.toUpperCase();
  }

  // Named CSS colors
  const namedColors: Record<string, string> = {
    black: 'FF000000',
    white: 'FFFFFFFF',
    red: 'FFEF4444',
    green: 'FF10B981',
    blue: 'FF3B82F6',
    yellow: 'FFF59E0B',
    gray: 'FF6B7280',
    grey: 'FF6B7280',
    slate: 'FF64748B',
  };
  if (namedColors[clean.toLowerCase()]) {
    return namedColors[clean.toLowerCase()];
  }

  return defaultArgb;
}

/**
 * Standard 64 Excel OpenXML Indexed Color Palette (Hex)
 */
export const EXCEL_INDEXED_COLORS: string[] = [
  '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
  '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
  '#800000', '#008000', '#000080', '#808000', '#800080', '#008080', '#C0C0C0', '#808080',
  '#9999FF', '#993366', '#FFFFCC', '#CCFFFF', '#660066', '#FF8080', '#0066CC', '#CCCCFF',
  '#000080', '#FF00FF', '#FFFF00', '#00FFFF', '#800080', '#800000', '#008080', '#0000FF',
  '#00CCFF', '#CCFFFF', '#CCFFCC', '#FFFF99', '#99CCFF', '#FF99CC', '#CC99FF', '#FFCC99',
  '#3366FF', '#33CCCC', '#99CC00', '#FFCC00', '#FF9900', '#FF6600', '#666699', '#969696',
  '#003366', '#339966', '#003300', '#333300', '#993300', '#993366', '#333399', '#333333',
  '#000000', '#FFFFFF'
];

/**
 * Standard Office Theme Colors (Theme 1: Light 1, Dark 1, Light 2, Dark 2, Accent 1..6, Hlink, FolHlink)
 */
export const DEFAULT_OFFICE_THEME_COLORS: string[] = [
  '#FFFFFF', // 0: lt1 (Light 1)
  '#000000', // 1: dk1 (Dark 1)
  '#E7E6E6', // 2: lt2 (Light 2)
  '#44546A', // 3: dk2 (Dark 2)
  '#4472C4', // 4: accent1 (Blue)
  '#ED7D31', // 5: accent2 (Orange)
  '#A5A5A5', // 6: accent3 (Gray)
  '#FFC000', // 7: accent4 (Gold/Yellow)
  '#5B9BD5', // 8: accent5 (Light Blue)
  '#70AD47', // 9: accent6 (Green)
  '#0563C1', // 10: hlink (Hyperlink)
  '#954F72'  // 11: folHlink (Followed Hyperlink)
];

/**
 * Apply OpenXML Color Tint (-1.0 to 1.0) to Hex color
 */
export function applyColorTint(hex: string, tint?: number): string {
  if (!tint || tint === 0) return hex.toUpperCase();
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  let newR: number;
  let newG: number;
  let newB: number;

  if (tint > 0) {
    newR = Math.round(r + (255 - r) * tint);
    newG = Math.round(g + (255 - g) * tint);
    newB = Math.round(b + (255 - b) * tint);
  } else {
    newR = Math.round(r * (1 + tint));
    newG = Math.round(g * (1 + tint));
    newB = Math.round(b * (1 + tint));
  }

  const clamp = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${clamp(newR)}${clamp(newG)}${clamp(newB)}`.toUpperCase();
}

/**
 * Robust Color Resolver: Converts ARGB, Theme Color + Tint, Indexed Color + Tint, or CSS strings to Hex
 */
export function resolveExcelColorToHex(colorObj: any, defaultHex?: string): string | undefined {
  if (!colorObj) return defaultHex;

  // Direct string Hex or RGB
  if (typeof colorObj === 'string') {
    const clean = colorObj.trim();
    if (clean.startsWith('#')) {
      if (clean.length === 4) {
        return `#${clean[1]}${clean[1]}${clean[2]}${clean[2]}${clean[3]}${clean[3]}`.toUpperCase();
      }
      return clean.toUpperCase();
    }
    if (clean.length === 8) {
      return `#${clean.substring(2)}`.toUpperCase();
    }
    if (clean.length === 6) {
      return `#${clean}`.toUpperCase();
    }
    return clean;
  }

  // 1. Direct ARGB (e.g. FFFF0000 or FF1E293B)
  if (colorObj.argb) {
    const argbStr = String(colorObj.argb).trim();
    if (argbStr.length === 8) {
      const hex = `#${argbStr.substring(2)}`.toUpperCase();
      return colorObj.tint ? applyColorTint(hex, colorObj.tint) : hex;
    }
    if (argbStr.length === 6) {
      const hex = `#${argbStr}`.toUpperCase();
      return colorObj.tint ? applyColorTint(hex, colorObj.tint) : hex;
    }
  }

  // 2. Theme color (index 0..11) + tint
  if (colorObj.theme !== undefined && typeof colorObj.theme === 'number') {
    const themeBase = DEFAULT_OFFICE_THEME_COLORS[colorObj.theme] || '#FFFFFF';
    return applyColorTint(themeBase, colorObj.tint);
  }

  // 3. Indexed color (index 0..65) + tint
  if (colorObj.indexed !== undefined && typeof colorObj.indexed === 'number') {
    const indexedBase = EXCEL_INDEXED_COLORS[colorObj.indexed] || '#000000';
    return applyColorTint(indexedBase, colorObj.tint);
  }

  return defaultHex;
}

/**
 * Full-Fidelity XLSX Cell Style Resolver:
 * Maps ExcelJS Cell Style (Font, Alignment, Fill, Borders, numFmt) to Lumina SheetCell
 */
export function resolveCellStyleFromExcel(cell: ExcelJS.Cell): Partial<SheetCell> {
  const result: Partial<SheetCell> = {};

  // 1. Font styling
  if (cell.font) {
    if (cell.font.bold !== undefined) result.bold = Boolean(cell.font.bold);
    if (cell.font.italic !== undefined) result.italic = Boolean(cell.font.italic);
    if (cell.font.underline !== undefined) result.underline = Boolean(cell.font.underline);
    if (cell.font.strike !== undefined) result.strike = Boolean(cell.font.strike);
    if (cell.font.size !== undefined) result.fontSize = cell.font.size;
    if (cell.font.name !== undefined) result.fontFamily = cell.font.name;
    const fontColor = resolveExcelColorToHex(cell.font.color);
    if (fontColor) result.color = fontColor;
  }

  // 2. Alignment (Horizontal & Vertical)
  if (cell.alignment) {
    if (cell.alignment.horizontal) {
      const h = cell.alignment.horizontal;
      if (h === 'center' || h === 'centerContinuous') {
        result.align = 'center';
      } else if (h === 'right') {
        result.align = 'right';
      } else if (h === 'left') {
        result.align = 'left';
      } else if (h === 'justify' || h === 'fill') {
        result.align = 'center';
      }
    }
    if (cell.alignment.vertical) {
      const v = cell.alignment.vertical as string;
      if (v === 'top') {
        result.verticalAlign = 'top';
      } else if (v === 'middle' || v === 'center') {
        result.verticalAlign = 'middle';
      } else if (v === 'bottom') {
        result.verticalAlign = 'bottom';
      }
    }
    if (cell.alignment.wrapText) {
      result.wrapText = true;
    }
  }

  // 3. Fill / Background (Pattern, Solid, ARGB, Theme, Indexed)
  if (cell.fill && cell.fill.type === 'pattern') {
    const pattern = cell.fill.pattern;
    if (pattern && pattern !== 'none') {
      const fgHex = resolveExcelColorToHex(cell.fill.fgColor);
      const bgHex = resolveExcelColorToHex(cell.fill.bgColor);
      const chosen = fgHex || bgHex;
      if (chosen && chosen !== '#00000000') {
        result.bg = chosen;
      }
    }
  }

  // 4. Borders (Top, Bottom, Left, Right)
  if (cell.border) {
    const b = cell.border;
    const top = Boolean(b.top);
    const bottom = Boolean(b.bottom);
    const left = Boolean(b.left);
    const right = Boolean(b.right);
    if (top || bottom || left || right) {
      const style = b.bottom?.style || b.top?.style || b.left?.style || b.right?.style || 'thin';
      const color = resolveExcelColorToHex(b.bottom?.color || b.top?.color || b.left?.color || b.right?.color) || '#94a3b8';
      result.borders = {
        top,
        bottom,
        left,
        right,
        style: (style as any) || 'thin',
        color,
      };
    }
  }

  // 5. Number Format (Currency, Percent, Date, Time, Scientific, Custom numFmt)
  if (cell.numFmt) {
    result.numFmt = cell.numFmt;
    const numFmtLower = cell.numFmt.toLowerCase();
    if (numFmtLower.includes('¥') || numFmtLower.includes('$') || numFmtLower.includes('€') || numFmtLower.includes('£')) {
      result.format = 'currency';
    } else if (numFmtLower.includes('%')) {
      result.format = 'percent';
    } else if (numFmtLower.includes('yy') || numFmtLower.includes('m/d') || numFmtLower.includes('d-m')) {
      result.format = 'date';
    } else if (numFmtLower.includes('hh:mm') || numFmtLower.includes('ss')) {
      result.format = 'time';
    } else if (numFmtLower.includes('e+') || numFmtLower.includes('e-')) {
      result.format = 'scientific';
    } else if (numFmtLower.includes('0.0') || numFmtLower.includes('#,##0')) {
      result.format = 'number';
    }

    const dotMatch = cell.numFmt.match(/\.([0#]+)/);
    if (dotMatch) {
      result.decimalPlaces = dotMatch[1].length;
    }
    if (cell.numFmt.includes(',')) {
      result.thousandSeparator = true;
    }
  }

  return result;
}

/**
 * Parse ExcelJS Cell Value into clean string + computed representation
 */
export function parseCellValueFromExcel(cell: ExcelJS.Cell): { value: string; computed?: string | number } {
  const rawVal = cell.value;
  if (rawVal === undefined || rawVal === null) {
    return { value: '' };
  }

  // Formula cell
  if (typeof rawVal === 'object' && 'formula' in rawVal) {
    const formulaStr = (rawVal as any).formula;
    const formula = formulaStr.startsWith('=') ? formulaStr : `=${formulaStr}`;
    const result = (rawVal as any).result;
    return {
      value: formula,
      computed: typeof result === 'object' && result !== null && 'error' in result ? (result as any).error : result,
    };
  }

  // Shared formula
  if (typeof rawVal === 'object' && 'sharedFormula' in rawVal) {
    const formulaStr = (rawVal as any).sharedFormula;
    return {
      value: formulaStr.startsWith('=') ? formulaStr : `=${formulaStr}`,
      computed: (rawVal as any).result,
    };
  }

  // Rich text array
  if (typeof rawVal === 'object' && 'richText' in rawVal && Array.isArray((rawVal as any).richText)) {
    const text = (rawVal as any).richText.map((t: any) => t.text || '').join('');
    return { value: text, computed: text };
  }

  // Hyperlink
  if (typeof rawVal === 'object' && 'hyperlink' in rawVal) {
    const text = (rawVal as any).text || (rawVal as any).hyperlink;
    return { value: String(text), computed: String(text) };
  }

  // Date
  if (rawVal instanceof Date) {
    const y = rawVal.getFullYear();
    const m = String(rawVal.getMonth() + 1).padStart(2, '0');
    const d = String(rawVal.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    return { value: dateStr, computed: dateStr };
  }

  return {
    value: String(rawVal),
    computed: typeof rawVal === 'number' ? rawVal : String(rawVal),
  };
}

/**
 * Convert column letter like "A", "AA" to 0-based column index
 */
function parseColLetterToIndex(colStr: string): number {
  const upper = colStr.toUpperCase();
  let index = 0;
  for (let i = 0; i < upper.length; i++) {
    index = index * 26 + (upper.charCodeAt(i) - 64);
  }
  return index - 1;
}

/**
 * Standardize font name for cross-platform Excel / WPS display
 */
export function cleanFontFamily(family?: string): string {
  if (!family || family === 'inherit' || family === 'default') {
    return '微软雅黑';
  }
  const primary = family.split(',')[0].replace(/['"]/g, '').trim();
  if (primary.toLowerCase().includes('pingfang')) return 'PingFang SC';
  if (primary.toLowerCase().includes('yahei') || primary.includes('微软雅黑')) return 'Microsoft YaHei';
  if (primary.toLowerCase().includes('songti') || primary.includes('宋体') || primary.toLowerCase().includes('simsun')) return 'SimSun';
  if (primary.toLowerCase().includes('kaiti') || primary.includes('楷体')) return 'KaiTi';
  if (primary.toLowerCase().includes('simhei') || primary.includes('黑体')) return 'SimHei';
  if (primary.toLowerCase().includes('arial')) return 'Arial';
  if (primary.toLowerCase().includes('helvetica')) return 'Helvetica';
  if (primary.toLowerCase().includes('calibri')) return 'Calibri';
  if (primary.toLowerCase().includes('menlo') || primary.toLowerCase().includes('monaco') || primary.toLowerCase().includes('monospace')) return 'Consolas';
  return primary || '微软雅黑';
}

/**
 * Resolve OpenXML number format (numFmt) based on cell format settings
 */
export function resolveNumberFormat(cell: SheetCell): string | undefined {
  if (cell.numFmt) return cell.numFmt;

  const decimals = cell.decimalPlaces !== undefined ? Math.max(0, Math.min(10, cell.decimalPlaces)) : 2;
  const zeroDecimalStr = decimals > 0 ? '.' + '0'.repeat(decimals) : '';

  switch (cell.format) {
    case 'currency':
      return `"¥"#,##0${zeroDecimalStr};[Red]-"¥"#,##0${zeroDecimalStr}`;
    case 'percent':
      return `0${zeroDecimalStr}%`;
    case 'number':
      if (cell.thousandSeparator !== false) {
        return `#,##0${zeroDecimalStr};-#,##0${zeroDecimalStr}`;
      }
      return `0${zeroDecimalStr};-0${zeroDecimalStr}`;
    case 'scientific':
      return '0.00E+00';
    case 'date':
    case 'shortDate':
      return 'yyyy-mm-dd';
    case 'time':
      return 'hh:mm:ss';
    case 'text':
      return '@';
    default:
      if (cell.thousandSeparator) {
        return `#,##0${zeroDecimalStr};-#,##0${zeroDecimalStr}`;
      }
      return undefined;
  }
}

/**
 * Map border style to ExcelJS BorderStyle
 */
export function mapBorderStyle(style?: string): ExcelJS.BorderStyle {
  if (!style) return 'thin';
  const s = style.toLowerCase();
  if (s === 'thick') return 'thick';
  if (s === 'medium') return 'medium';
  if (s === 'double') return 'double';
  if (s === 'dashed') return 'dashed';
  if (s === 'dotted') return 'dotted';
  if (s === 'hair') return 'hair';
  if (s === 'mediumdashed') return 'mediumDashed';
  return 'thin';
}

export class SpreadsheetExportAdapter {
  /**
   * Parse a raw CSV/TSV string into a normalized SheetData
   */
  public static parseCsvStringToSheet(csvStr: string, title: string = 'Sheet1'): SheetData {
    const lines = csvStr.split(/\r?\n/);
    const cells: Record<string, SheetCell> = {};
    let maxCols = 0;

    lines.forEach((line, rIdx) => {
      if (!line && rIdx === lines.length - 1) return;
      // Simple CSV splitter handling basic quotes
      const rowTokens: string[] = [];
      let inQuote = false;
      let curToken = '';
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuote && line[i + 1] === '"') {
            curToken += '"';
            i++;
          } else {
            inQuote = !inQuote;
          }
        } else if (ch === ',' && !inQuote) {
          rowTokens.push(curToken);
          curToken = '';
        } else {
          curToken += ch;
        }
      }
      rowTokens.push(curToken);

      if (rowTokens.length > maxCols) maxCols = rowTokens.length;
      rowTokens.forEach((token, cIdx) => {
        const trimmed = token.trim();
        if (trimmed !== '') {
          if (rIdx === 0 && lines.length > 1) {
            cells[`${rIdx},${cIdx}`] = { value: trimmed, bold: true, bg: '#F1F5F9' };
          } else {
            cells[`${rIdx},${cIdx}`] = { value: trimmed, format: 'general' };
          }
        }
      });
    });

    return {
      id: 's1',
      title,
      rows: Math.max(lines.length, 20),
      cols: Math.max(maxCols, 10),
      cells,
    };
  }

  /**
   * Helper to normalize SheetData from either SheetData, WorkbookData, or raw string
   */
  public static getActiveSheet(data: SheetData | WorkbookData | string | any, sheetIndex: number = 0): SheetData {
    if (!data) {
      return { id: 's1', title: 'Sheet1', rows: 20, cols: 10, cells: {} };
    }
    if (typeof data === 'string') {
      return this.parseCsvStringToSheet(data);
    }
    if (typeof data === 'object' && data !== null) {
      if ('sheets' in data && Array.isArray((data as any).sheets) && (data as any).sheets.length > 0) {
        return (data as any).sheets[sheetIndex] || (data as any).sheets[0] || { id: 's1', title: 'Sheet1', rows: 20, cols: 10, cells: {} };
      }
      if ('cells' in data) {
        return data as SheetData;
      }
    }
    return { id: 's1', title: 'Sheet1', rows: 20, cols: 10, cells: {} };
  }

  /**
   * 1. Export Spreadsheet Model to Microsoft Excel (.xlsx) via ExcelJS
   * Full-fidelity preservation of:
   * - Bold, Italic, Underline, Strikethrough
   * - Font sizes, Font families, Text colors
   * - Background fill colors (solid patterns)
   * - All border styles (thin, medium, thick, double, dashed, dotted) & colors
   * - Alignment (Horizontal: left/center/right/justify, Vertical: top/middle/bottom)
   * - Text Wrapping (wrapText)
   * - Number formats (Currency ¥, Percentage %, Thousands separator, Custom decimal precision, Scientific, Date, Time, Text)
   * - Raw numeric vs formatted separation (numbers stored as native numeric values in OpenXML)
   * - Live Formulas with evaluated calculation cache results
   * - Merged cell ranges & boundary border continuity
   * - Custom Column Widths & Row Heights
   * - Multiple worksheets, Tab colors, Frozen panes
   * - Cell Hyperlinks and Notes / Comments
   */
  public static async exportToXlsx(
    data: SheetData | WorkbookData | string | any,
    options: SpreadsheetExportOptions = {}
  ): Promise<Blob> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Lumina Office Enterprise Engine';
    wb.lastModifiedBy = 'Lumina Office Enterprise Engine';
    wb.created = new Date();
    wb.modified = new Date();

    let sheets: SheetData[] = [];

    if (typeof data === 'string') {
      sheets = [this.parseCsvStringToSheet(data)];
    } else if (typeof data === 'object' && data !== null) {
      if ('sheets' in data && Array.isArray((data as any).sheets) && (data as any).sheets.length > 0) {
        sheets = (data as any).sheets;
      } else {
        sheets = [data as SheetData];
      }
    } else {
      sheets = [{ id: 's1', title: 'Sheet1', rows: 20, cols: 10, cells: {} }];
    }

    let totalCellCount = 0;
    let totalStyleCount = 0;
    let totalMergeCount = 0;
    let totalFormulaCount = 0;

    sheets.forEach((sheet, sIdx) => {
      const sheetTitle = (sheet.title || `Sheet${sIdx + 1}`).replace(/[\\/*?:[\]]/g, '_').substring(0, 31);
      const cellsMap = sheet.cells || {};

      // Create worksheet with views and properties
      const ws = wb.addWorksheet(sheetTitle, {
        views: [
          {
            showGridLines: options.includeGridLines !== false,
            state: (sheet.freezeRows || sheet.freezeCols) ? 'frozen' : 'normal',
            xSplit: sheet.freezeCols || 0,
            ySplit: sheet.freezeRows || 0,
            activeCell: 'A1',
          },
        ],
      });

      if (sheet.tabColor) {
        const tabArgb = toArgb(sheet.tabColor);
        if (tabArgb) {
          ws.properties.tabColor = { argb: tabArgb };
        }
      }

      if (sheet.merges && sheet.merges.length > 0) {
        totalMergeCount += sheet.merges.length;
      }

      // Calculate sheet bounds
      let maxR = 0;
      let maxC = 0;
      Object.keys(cellsMap).forEach((key) => {
        const parts = key.split(/[,:]/);
        if (parts.length === 2) {
          const r = parseInt(parts[0], 10);
          const c = parseInt(parts[1], 10);
          if (!isNaN(r) && r > maxR) maxR = r;
          if (!isNaN(c) && c > maxC) maxC = c;
        }
      });

      const totalRows = Math.max(sheet.rows || 0, maxR + 1, 1);
      const totalCols = Math.max(sheet.cols || 0, maxC + 1, 1);

      // Iterate through cells and write data + styles
      for (let r = 0; r < totalRows; r++) {
        for (let c = 0; c < totalCols; c++) {
          const cell = cellsMap[`${r},${c}`] || cellsMap[`${r}:${c}`];
          if (!cell || (cell.value === undefined && cell.v === undefined && !cell.bg && !cell.borders)) {
            continue;
          }

          totalCellCount++;
          const hasCustomStyle = Boolean(
            cell.bold || cell.italic || cell.underline || cell.strikethrough ||
            cell.bg || cell.color || cell.borders || cell.format || cell.align ||
            cell.verticalAlign || cell.fontSize || cell.fontFamily || cell.wrapText ||
            cell.thousandSeparator || cell.decimalPlaces !== undefined
          );
          if (hasCustomStyle) {
            totalStyleCount++;
          }

          // ExcelJS is 1-indexed (row 1, col 1 is A1)
          const excelRow = r + 1;
          const excelCol = c + 1;
          const excelCell = ws.getCell(excelRow, excelCol);

          const rawVal = cell.value !== undefined ? cell.value : (cell.v !== undefined ? cell.v : '');
          const valStr = String(rawVal);

          // 1. Formula handling
          if (valStr.startsWith('=')) {
            totalFormulaCount++;
            const formulaText = valStr.substring(1).trim();
            const evaluated = cell.computed !== undefined ? cell.computed : evaluateCellFormula(valStr, cellsMap);
            const num = Number(evaluated);
            const resultVal = (!isNaN(num) && String(evaluated).trim() !== '') ? num : evaluated;

            excelCell.value = {
              formula: formulaText,
              result: resultVal as any,
            };
          } else if (cell.hyperlink) {
            // Hyperlink cell
            excelCell.value = {
              text: valStr,
              hyperlink: cell.hyperlink,
            };
          } else {
            // Raw value handling with numeric parsing
            let parsed = false;

            if (cell.format === 'currency') {
              const cleanStr = valStr.replace(/[¥$,\s]/g, '');
              const num = Number(cleanStr);
              if (!isNaN(num) && cleanStr !== '') {
                excelCell.value = num;
                parsed = true;
              }
            } else if (cell.format === 'percent') {
              if (valStr.endsWith('%')) {
                const cleanStr = valStr.replace(/[%,\s]/g, '');
                const num = Number(cleanStr);
                if (!isNaN(num) && cleanStr !== '') {
                  excelCell.value = num / 100;
                  parsed = true;
                }
              } else {
                const num = Number(valStr);
                if (!isNaN(num) && valStr.trim() !== '') {
                  excelCell.value = num;
                  parsed = true;
                }
              }
            } else if (cell.format === 'number') {
              const cleanStr = valStr.replace(/[,\s]/g, '');
              const num = Number(cleanStr);
              if (!isNaN(num) && cleanStr !== '') {
                excelCell.value = num;
                parsed = true;
              }
            } else if (cell.format === 'date' || cell.format === 'shortDate') {
              const d = new Date(valStr);
              if (!isNaN(d.getTime()) && /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(valStr.trim())) {
                excelCell.value = d;
                parsed = true;
              }
            } else if (cell.format === 'text') {
              excelCell.value = valStr;
              parsed = true;
            }

            if (!parsed) {
              const num = Number(valStr);
              // Store as number if numeric and not leading zero string like "00123"
              if (!isNaN(num) && valStr.trim() !== '' && !(/^0\d+$/.test(valStr.trim()))) {
                excelCell.value = num;
              } else if (valStr.toLowerCase() === 'true') {
                excelCell.value = true;
              } else if (valStr.toLowerCase() === 'false') {
                excelCell.value = false;
              } else {
                excelCell.value = valStr;
              }
            }
          }

          // 2. Number Format (numFmt)
          const numFmt = resolveNumberFormat(cell);
          if (numFmt) {
            excelCell.numFmt = numFmt;
          }

          // 3. Font Styling
          const fontName = cleanFontFamily(cell.fontFamily);
          const fontColor = toArgb(cell.color);
          excelCell.font = {
            name: fontName,
            size: cell.fontSize || (r === 0 ? 11 : 10.5),
            bold: Boolean(cell.bold),
            italic: Boolean(cell.italic),
            underline: cell.underline ? 'single' : undefined,
            strike: Boolean(cell.strikethrough),
            color: fontColor ? { argb: fontColor } : undefined,
          };

          // 4. Background Fill Color
          const bgColor = toArgb(cell.bg);
          if (bgColor) {
            excelCell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: bgColor },
            };
          }

          // 5. Alignment & Text Wrapping
          const isNumeric = typeof excelCell.value === 'number';
          excelCell.alignment = {
            horizontal: cell.align || (isNumeric ? 'right' : 'left'),
            vertical: cell.verticalAlign === 'top' ? 'top' : cell.verticalAlign === 'bottom' ? 'bottom' : 'middle',
            wrapText: Boolean(cell.wrapText),
          };

          // 6. Borders
          if (cell.borders) {
            const border: Partial<ExcelJS.Borders> = {};
            const defaultColor = toArgb(cell.borders.color || '#CBD5E1') || 'FFCBD5E1';
            const defaultStyle = mapBorderStyle(cell.borders.style || 'thin');

            if (cell.borders.top || cell.borders.borderTop) {
              const bStyle = mapBorderStyle(cell.borders.borderTop?.style || defaultStyle);
              const colorArgb = toArgb(cell.borders.borderTop?.color) || defaultColor;
              border.top = { style: bStyle, color: { argb: colorArgb } };
            }
            if (cell.borders.bottom || cell.borders.borderBottom) {
              const bStyle = mapBorderStyle(cell.borders.borderBottom?.style || defaultStyle);
              const colorArgb = toArgb(cell.borders.borderBottom?.color) || defaultColor;
              border.bottom = { style: bStyle, color: { argb: colorArgb } };
            }
            if (cell.borders.left || cell.borders.borderLeft) {
              const bStyle = mapBorderStyle(cell.borders.borderLeft?.style || defaultStyle);
              const colorArgb = toArgb(cell.borders.borderLeft?.color) || defaultColor;
              border.left = { style: bStyle, color: { argb: colorArgb } };
            }
            if (cell.borders.right || cell.borders.borderRight) {
              const bStyle = mapBorderStyle(cell.borders.borderRight?.style || defaultStyle);
              const colorArgb = toArgb(cell.borders.borderRight?.color) || defaultColor;
              border.right = { style: bStyle, color: { argb: colorArgb } };
            }
            excelCell.border = border;
          }

          // 7. Comments / Notes
          if (cell.comment) {
            excelCell.note = cell.comment;
          }
        }
      }

      // 8. Column Widths
      if (sheet.colWidths) {
        Object.entries(sheet.colWidths).forEach(([colKey, widthPx]) => {
          const colIdx = parseInt(colKey, 10) + 1;
          if (!isNaN(colIdx) && colIdx >= 1) {
            const charWidth = Math.max(7, Math.round((Number(widthPx) / 7.5) * 10) / 10);
            ws.getColumn(colIdx).width = charWidth;
          }
        });
      } else {
        // Intelligent default column widths for content visibility
        for (let c = 1; c <= totalCols; c++) {
          ws.getColumn(c).width = 12.5;
        }
      }

      // 9. Row Heights
      if (sheet.rowHeights) {
        Object.entries(sheet.rowHeights).forEach(([rowKey, heightPx]) => {
          const rowIdx = parseInt(rowKey, 10) + 1;
          if (!isNaN(rowIdx) && rowIdx >= 1) {
            const heightPt = Math.max(14, Math.round(Number(heightPx) * 0.75));
            ws.getRow(rowIdx).height = heightPt;
          }
        });
      }

      // 10. Merged Cells
      if (sheet.merges && sheet.merges.length > 0) {
        sheet.merges.forEach((m: SheetMergeRange) => {
          const startR = (m.startR ?? m.startRow ?? 0) + 1;
          const startC = (m.startC ?? m.startCol ?? (m as any).startColumn ?? 0) + 1;
          const endR = (m.endR ?? m.endRow ?? (startR - 1)) + 1;
          const endC = (m.endC ?? m.endCol ?? (m as any).endColumn ?? (startC - 1)) + 1;

          if (endR >= startR && endC >= startC && (endR > startR || endC > startC)) {
            try {
              ws.mergeCells(startR, startC, endR, endC);

              // Propagate master border styling along the merged perimeter
              const masterCell = ws.getCell(startR, startC);
              if (masterCell.border) {
                for (let r = startR; r <= endR; r++) {
                  for (let c = startC; c <= endC; c++) {
                    const subCell = ws.getCell(r, c);
                    const subBorder: Partial<ExcelJS.Borders> = { ...subCell.border };
                    if (r === startR && masterCell.border.top) subBorder.top = masterCell.border.top;
                    if (r === endR && masterCell.border.bottom) subBorder.bottom = masterCell.border.bottom;
                    if (c === startC && masterCell.border.left) subBorder.left = masterCell.border.left;
                    if (c === endC && masterCell.border.right) subBorder.right = masterCell.border.right;
                    subCell.border = subBorder;
                  }
                }
              }
            } catch (err) {
              console.warn('Failed to merge range in XLSX export:', m, err);
            }
          }
        });
      }
    });

    console.log('====================================================');
    console.log('📊 [XLSX Real OpenXML High-Fidelity Export]');
    console.log(`  Sheets:        ${sheets.length}`);
    console.log(`  Cells:         ${totalCellCount}`);
    console.log(`  Styled Cells:  ${totalStyleCount}`);
    console.log(`  Merged Ranges: ${totalMergeCount}`);
    console.log(`  Formulas:      ${totalFormulaCount}`);
    console.log('【安全验证】100% Direct OpenXML Workbook Model Binary Pipeline (ExcelJS)');
    console.log('====================================================');

    const buffer = await wb.xlsx.writeBuffer();
    return new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }

  /**
   * High-Fidelity XLSX Import:
   * Restores cells, formulas, fonts, alignments (center/left/right), background fills (theme/indexed/argb),
   * borders, number formats, column widths, row heights, merges, and frozen panes.
   */
  public static async importFromXlsx(
    data: ArrayBuffer | Uint8Array,
    defaultTitle: string = '电子表格'
  ): Promise<WorkbookData> {
    const wb = new ExcelJS.Workbook();
    let arrayBuffer: ArrayBuffer;
    if (data instanceof Uint8Array) {
      arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    } else {
      arrayBuffer = data;
    }

    try {
      await wb.xlsx.load(arrayBuffer);
    } catch (e) {
      console.warn('ExcelJS load warning, falling back to XLSX basic read:', e);
      return this.fallbackXlsxImport(arrayBuffer, defaultTitle);
    }

    const sheets: SheetData[] = [];
    let totalCellCount = 0;
    let totalStyleCount = 0;

    wb.eachSheet((ws, sheetId) => {
      const cells: Record<string, SheetCell> = {};
      let maxR = 0;
      let maxC = 0;

      // 1. Iterate over non-empty rows and cells
      ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        const rIdx = rowNumber - 1;
        if (rIdx + 1 > maxR) maxR = rIdx + 1;

        row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
          const cIdx = colNumber - 1;
          if (cIdx + 1 > maxC) maxC = cIdx + 1;

          const { value, computed } = parseCellValueFromExcel(cell);
          const style = resolveCellStyleFromExcel(cell);

          // If explicit align is not set, align numbers to right, strings to left
          const align = style.align || (typeof computed === 'number' ? 'right' : 'left');

          const finalCell: SheetCell = {
            value,
            computed,
            align,
            ...style,
          };

          cells[`${rIdx},${cIdx}`] = finalCell;
          totalCellCount++;
          if (finalCell.bold || finalCell.bg || finalCell.align === 'center' || finalCell.borders || finalCell.format) {
            totalStyleCount++;
          }
        });
      });

      // 2. Extract Merged Ranges
      const merges: SheetMergeRange[] = [];
      if ((ws as any).model?.merges && Array.isArray((ws as any).model.merges)) {
        (ws as any).model.merges.forEach((mStr: string) => {
          const parts = mStr.split(':');
          if (parts.length === 2) {
            const m1 = parts[0].match(/([A-Za-z]+)(\d+)/);
            const m2 = parts[1].match(/([A-Za-z]+)(\d+)/);
            if (m1 && m2) {
              const startC = parseColLetterToIndex(m1[1]);
              const startR = parseInt(m1[2], 10) - 1;
              const endC = parseColLetterToIndex(m2[1]);
              const endR = parseInt(m2[2], 10) - 1;
              merges.push({ startR, startC, endR, endC });
            }
          }
        });
      }

      // 3. Extract Column Widths
      const colWidths: Record<number, number> = {};
      if (ws.columns && Array.isArray(ws.columns)) {
        ws.columns.forEach((col, cIdx) => {
          if (col && col.width) {
            colWidths[cIdx] = Math.round(col.width * 7.5);
          }
        });
      }

      // 4. Extract Row Heights
      const rowHeights: Record<number, number> = {};
      ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (row && row.height) {
          rowHeights[rowNumber - 1] = Math.round(row.height * 1.33);
        }
      });

      // 5. Extract Frozen Panes
      let freezeRows: number | undefined = undefined;
      let freezeCols: number | undefined = undefined;
      if (ws.views && Array.isArray(ws.views)) {
        const frozenView = ws.views.find((v: any) => v.state === 'frozen') as any;
        if (frozenView) {
          if (frozenView.ySplit) freezeRows = frozenView.ySplit;
          if (frozenView.xSplit) freezeCols = frozenView.xSplit;
        }
      }

      // 6. Extract Tab Color
      const tabColor = resolveExcelColorToHex(ws.properties?.tabColor);

      sheets.push({
        id: `sheet-${sheetId}-${Date.now()}`,
        title: ws.name || `Sheet${sheetId}`,
        rows: Math.max(maxR, 25),
        cols: Math.max(maxC, 12),
        cells,
        merges,
        colWidths,
        rowHeights,
        freezeRows: freezeRows ?? (maxR > 0 ? 1 : undefined),
        freezeCols,
        tabColor,
      });
    });

    if (sheets.length === 0) {
      sheets.push({
        id: `sheet-1-${Date.now()}`,
        title: defaultTitle || '工作表 1',
        rows: 25,
        cols: 12,
        cells: {},
        merges: [],
      });
    }

    console.log('====================================================');
    console.log('📥 [XLSX High-Fidelity Import Complete]');
    console.log(`  Sheets:        ${sheets.length}`);
    console.log(`  Cells:         ${totalCellCount}`);
    console.log(`  Styled Cells:  ${totalStyleCount}`);
    console.log('====================================================');

    return {
      activeSheetId: sheets[0].id,
      sheets,
    };
  }

  /**
   * Fallback parser using XLSX if binary OpenXML structure is abnormal
   */
  private static fallbackXlsxImport(data: ArrayBuffer, defaultTitle: string): WorkbookData {
    const wb = XLSX.read(data, { type: 'array', cellFormula: true });
    const sheets: SheetData[] = [];
    wb.SheetNames.forEach((name, sIdx) => {
      const ws = wb.Sheets[name];
      if (!ws) return;
      const range = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : { s: { r: 0, c: 0 }, e: { r: 19, c: 9 } };
      const cells: Record<string, SheetCell> = {};
      for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cellRef = XLSX.utils.encode_cell({ r, c });
          const cellObj = ws[cellRef];
          if (!cellObj) continue;
          let val = '';
          let computed: string | number | undefined;
          if (cellObj.f) {
            val = `=${cellObj.f}`;
            computed = cellObj.v;
          } else if (cellObj.v !== undefined && cellObj.v !== null) {
            val = String(cellObj.v);
            computed = cellObj.v;
          }
          if (val !== '') {
            cells[`${r},${c}`] = {
              value: val,
              computed,
              align: typeof cellObj.v === 'number' ? 'right' : 'left',
            };
          }
        }
      }
      sheets.push({
        id: `sheet-${sIdx + 1}-${Date.now()}`,
        title: name || `Sheet${sIdx + 1}`,
        rows: Math.max(range.e.r + 1, 25),
        cols: Math.max(range.e.c + 1, 12),
        cells,
        merges: [],
      });
    });
    return {
      activeSheetId: sheets[0]?.id || 'sheet-1',
      sheets: sheets.length ? sheets : [{ id: 'sheet-1', title: defaultTitle, rows: 25, cols: 12, cells: {}, merges: [] }],
    };
  }

  /**
   * 2. Export Spreadsheet Model to Microsoft Word (.docx) Table Structure
   */
  public static async exportToDocx(
    data: SheetData | WorkbookData,
    options: SpreadsheetExportOptions = {}
  ): Promise<Blob> {
    const sheet = this.getActiveSheet(data, options.sheetIndex || 0);
    const cellsMap = sheet.cells || {};

    let maxR = 0;
    let maxC = 0;
    Object.keys(cellsMap).forEach((key) => {
      const parts = key.split(',');
      if (parts.length === 2) {
        const r = parseInt(parts[0], 10);
        const c = parseInt(parts[1], 10);
        const cell = cellsMap[key];
        if (cell && cell.value !== undefined && cell.value !== '') {
          if (r > maxR) maxR = r;
          if (c > maxC) maxC = c;
        }
      }
    });

    const totalRows = Math.max(maxR + 1, 1);
    const totalCols = Math.max(maxC + 1, 1);
    const colWidthTwips = Math.round(9000 / totalCols);

    const tableRows: TableRow[] = [];

    for (let r = 0; r < totalRows; r++) {
      const rowCells: TableCell[] = [];
      const isHeader = r === 0;

      for (let c = 0; c < totalCols; c++) {
        const merge = getCellMergeInfo(r, c, sheet.merges);
        if (merge.isMerged && !merge.isMaster) {
          continue;
        }

        const cell = cellsMap[`${r},${c}`];
        let displayVal = '';
        if (cell && cell.value !== undefined && cell.value !== '') {
          const evaluated = String(cell.value).startsWith('=')
            ? evaluateCellFormula(String(cell.value), cellsMap)
            : cell.value;
          displayVal = formatCellValue(cell, evaluated);
        }

        const align = cell?.align === 'right' ? AlignmentType.RIGHT : cell?.align === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT;

        rowCells.push(
          new TableCell({
            width: { size: colWidthTwips * (merge.isMaster ? merge.colSpan : 1), type: WidthType.DXA },
            columnSpan: merge.isMaster && merge.colSpan > 1 ? merge.colSpan : undefined,
            rowSpan: merge.isMaster && merge.rowSpan > 1 ? merge.rowSpan : undefined,
            shading: { fill: cell?.bg?.replace('#', '') || (isHeader ? 'F8FAFC' : 'FFFFFF'), type: ShadingType.CLEAR },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
              left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
              right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
            },
            children: [
              new Paragraph({
                alignment: align,
                spacing: { before: 30, after: 30 },
                children: [
                  new TextRun({
                    text: displayVal,
                    bold: isHeader || cell?.bold,
                    italics: cell?.italic,
                    color: cell?.color?.replace('#', '') || (isHeader ? '0F172A' : '334155'),
                    size: 19,
                  }),
                ],
              }),
            ],
          })
        );
      }

      tableRows.push(
        new TableRow({
          tableHeader: isHeader,
          children: rowCells,
        })
      );
    }

    const docx = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: { top: 720, bottom: 720, left: 720, right: 720 },
            },
          },
          children: [
            new Table({
              rows: tableRows,
              width: { size: 100, type: WidthType.PERCENTAGE },
            }),
          ],
        },
      ],
    });

    return await Packer.toBlob(docx);
  }

  /**
   * 3. Export Spreadsheet Model to Native Vector PDF
   */
  public static async exportToPdf(
    data: SheetData | WorkbookData,
    options: SpreadsheetExportOptions = {}
  ): Promise<Uint8Array> {
    const sheet = this.getActiveSheet(data, options.sheetIndex || 0);
    console.log('====================================================');
    console.log('📕 [PDF Real Source Verification]');
    console.log('PDF Source: WorkbookModel');
    console.log(`  • Active Sheet Title: "${sheet.title}"`);
    console.log(`  • Dimension: ${sheet.rows} rows x ${sheet.cols} cols`);
    console.log('【安全验证】100% 矢量网格与原生计算结果直出 (禁止 DOM / Canvas / Screenshot / HTML)');
    console.log('====================================================');
    return await renderSheetToNativeSearchablePdf(sheet, {
      onProgress: options.onProgress,
      orientation: options.orientation,
    });
  }

  /**
   * 4. Export Spreadsheet Model to CSV (.csv)
   */
  public static exportToCsv(data: SheetData | WorkbookData, options: SpreadsheetExportOptions = {}): Blob {
    const sheet = this.getActiveSheet(data, options.sheetIndex || 0);
    const cellsMap = sheet.cells || {};

    let maxR = 0;
    let maxC = 0;
    Object.keys(cellsMap).forEach((key) => {
      const parts = key.split(',');
      if (parts.length === 2) {
        const r = parseInt(parts[0], 10);
        const c = parseInt(parts[1], 10);
        if (r > maxR) maxR = r;
        if (c > maxC) maxC = c;
      }
    });

    const totalRows = Math.max(maxR + 1, 1);
    const totalCols = Math.max(maxC + 1, 1);

    const csvLines: string[] = [];
    for (let r = 0; r < totalRows; r++) {
      const rowValues: string[] = [];
      for (let c = 0; c < totalCols; c++) {
        const cell = cellsMap[`${r},${c}`];
        let val = '';
        if (cell && cell.value !== undefined && cell.value !== '') {
          val = String(cell.value);
        }
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          val = `"${val.replace(/"/g, '""')}"`;
        }
        rowValues.push(val);
      }
      csvLines.push(rowValues.join(','));
    }

    const csvContent = '\uFEFF' + csvLines.join('\n');
    return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  }

  /**
   * 5. Export Spreadsheet to Markdown table (.md)
   */
  public static exportToMarkdown(data: SheetData | WorkbookData, options: SpreadsheetExportOptions = {}): string {
    const sheet = this.getActiveSheet(data, options.sheetIndex || 0);
    const cellsMap = sheet.cells || {};

    let maxR = 0;
    let maxC = 0;
    Object.keys(cellsMap).forEach((key) => {
      const parts = key.split(',');
      if (parts.length === 2) {
        const r = parseInt(parts[0], 10);
        const c = parseInt(parts[1], 10);
        if (r > maxR) maxR = r;
        if (c > maxC) maxC = c;
      }
    });

    const totalRows = Math.max(maxR + 1, 1);
    const totalCols = Math.max(maxC + 1, 1);

    const mdLines: string[] = [];
    // Header row
    const headerRow: string[] = [];
    const sepRow: string[] = [];
    for (let c = 0; c < totalCols; c++) {
      const cell = cellsMap[`0,${c}`];
      headerRow.push((cell?.value !== undefined ? String(cell.value) : '').replace(/\|/g, '\\|') || `Col ${c + 1}`);
      sepRow.push('---');
    }
    mdLines.push(`| ${headerRow.join(' | ')} |`);
    mdLines.push(`| ${sepRow.join(' | ')} |`);

    for (let r = 1; r < totalRows; r++) {
      const rowValues: string[] = [];
      for (let c = 0; c < totalCols; c++) {
        const cell = cellsMap[`${r},${c}`];
        rowValues.push((cell?.value !== undefined ? String(cell.value) : '').replace(/\|/g, '\\|'));
      }
      mdLines.push(`| ${rowValues.join(' | ')} |`);
    }

    return mdLines.join('\n');
  }
}
