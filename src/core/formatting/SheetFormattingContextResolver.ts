import type { WorkbookData, SheetCell, SheetData } from '../../types';
import {
  FormattingContext,
  DEFAULT_FORMATTING_CONTEXT,
  TriState,
  FormattedValue,
  TextAlignValue,
} from './types';

export interface SheetSelectionRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export class SheetFormattingContextResolver {
  public static resolve(
    workbook: WorkbookData | null,
    selectedCell: { r: number; c: number },
    selectionRange?: SheetSelectionRange | null
  ): FormattingContext {
    if (!workbook) {
      return { ...DEFAULT_FORMATTING_CONTEXT, isEditable: false };
    }

    const activeSheet =
      workbook.sheets.find((s) => s.id === workbook.activeSheetId) ||
      workbook.sheets[0];

    if (!activeSheet) {
      return { ...DEFAULT_FORMATTING_CONTEXT, isEditable: false };
    }

    const range = selectionRange || {
      startRow: selectedCell.r,
      startCol: selectedCell.c,
      endRow: selectedCell.r,
      endCol: selectedCell.c,
    };

    const minR = Math.min(range.startRow, range.endRow);
    const maxR = Math.max(range.startRow, range.endRow);
    const minC = Math.min(range.startCol, range.endCol);
    const maxC = Math.max(range.startCol, range.endCol);

    const isSingleCell = minR === maxR && minC === maxC;

    // Single Cell Resolution
    if (isSingleCell) {
      const key = `${minR},${minC}`;
      const altKey = `${minR}:${minC}`;
      const cell: SheetCell =
        activeSheet.cells[key] || activeSheet.cells[altKey] || { value: '' };

      const fontFamily = cell.fontFamily || 'PingFang SC';
      const fontSize = cell.fontSize || 11;
      const bold = Boolean(cell.bold);
      const italic = Boolean(cell.italic);
      const underline = Boolean(cell.underline);
      const strike = Boolean(cell.strike);
      const color = cell.color || '#111827';
      const backgroundColor = cell.bg || null;
      const textAlign: TextAlignValue =
        cell.align === 'center' || cell.align === 'right' ? cell.align : 'left';

      return {
        fontFamily,
        fontSize,
        bold,
        italic,
        underline,
        strike,
        color,
        backgroundColor,
        textAlign,
        headingLevel: 0,
        source: 'object',
        isEditable: true,
      };
    }

    // Multi-Cell Selection Range Resolution
    const cellSamples: Array<{
      fontFamily: string;
      fontSize: number;
      bold: boolean;
      italic: boolean;
      underline: boolean;
      strike: boolean;
      color: string;
      bg: string | null;
      align: TextAlignValue;
    }> = [];

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const key = `${r},${c}`;
        const altKey = `${r}:${c}`;
        const cell =
          activeSheet.cells[key] || activeSheet.cells[altKey] || { value: '' };

        cellSamples.push({
          fontFamily: cell.fontFamily || 'PingFang SC',
          fontSize: cell.fontSize || 11,
          bold: Boolean(cell.bold),
          italic: Boolean(cell.italic),
          underline: Boolean(cell.underline),
          strike: Boolean(cell.strike),
          color: cell.color || '#111827',
          bg: cell.bg || null,
          align: (cell.align === 'center' || cell.align === 'right'
            ? cell.align
            : 'left') as TextAlignValue,
        });
      }
    }

    if (cellSamples.length === 0) {
      return { ...DEFAULT_FORMATTING_CONTEXT, fontSize: 11, source: 'selection' };
    }

    const allBold = cellSamples.every((s) => s.bold);
    const noneBold = cellSamples.every((s) => !s.bold);
    const bold: TriState = allBold ? true : noneBold ? false : 'mixed';

    const allItalic = cellSamples.every((s) => s.italic);
    const noneItalic = cellSamples.every((s) => !s.italic);
    const italic: TriState = allItalic ? true : noneItalic ? false : 'mixed';

    const allUnderline = cellSamples.every((s) => s.underline);
    const noneUnderline = cellSamples.every((s) => !s.underline);
    const underline: TriState = allUnderline ? true : noneUnderline ? false : 'mixed';

    const allStrike = cellSamples.every((s) => s.strike);
    const noneStrike = cellSamples.every((s) => !s.strike);
    const strike: TriState = allStrike ? true : noneStrike ? false : 'mixed';

    const firstFont = cellSamples[0].fontFamily;
    const allSameFont = cellSamples.every((s) => s.fontFamily === firstFont);
    const fontFamily: FormattedValue<string> = allSameFont ? firstFont : 'mixed';

    const firstSize = cellSamples[0].fontSize;
    const allSameSize = cellSamples.every((s) => s.fontSize === firstSize);
    const fontSize: FormattedValue<number> = allSameSize ? firstSize : 'mixed';

    const firstColor = cellSamples[0].color;
    const allSameColor = cellSamples.every((s) => s.color === firstColor);
    const color: FormattedValue<string> = allSameColor ? firstColor : 'mixed';

    const firstBg = cellSamples[0].bg;
    const allSameBg = cellSamples.every((s) => s.bg === firstBg);
    const backgroundColor: FormattedValue<string | null> = allSameBg ? firstBg : 'mixed';

    const firstAlign = cellSamples[0].align;
    const allSameAlign = cellSamples.every((s) => s.align === firstAlign);
    const textAlign: FormattedValue<TextAlignValue> = allSameAlign ? firstAlign : 'mixed';

    return {
      fontFamily,
      fontSize,
      bold,
      italic,
      underline,
      strike,
      color,
      backgroundColor,
      textAlign,
      headingLevel: 0,
      source: 'selection',
      isEditable: true,
    };
  }
}
