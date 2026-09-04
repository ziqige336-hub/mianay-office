import type { PdfAnnotation, TextAnnotation } from '../../types';
import {
  FormattingContext,
  DEFAULT_FORMATTING_CONTEXT,
  TriState,
  FormattedValue,
  TextAlignValue,
} from './types';

export interface PdfTextTarget {
  id?: string;
  fontFamily?: string;
  fontSize?: number;
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  isStrikethrough?: boolean;
  color?: string;
  backgroundColor?: string;
  textAlign?: 'left' | 'center' | 'right';
  text?: string;
}

export class PdfFormattingContextResolver {
  public static resolve(
    target: PdfTextTarget | PdfAnnotation | null,
    isEditing = false
  ): FormattingContext {
    if (!target) {
      return {
        ...DEFAULT_FORMATTING_CONTEXT,
        fontFamily: 'Helvetica',
        fontSize: 14,
        color: '#000000',
        source: 'default',
        isEditable: false,
      };
    }

    const t = target as any;

    const fontFamily = t.fontFamily || 'Helvetica';
    const fontSize = typeof t.fontSize === 'number' && !isNaN(t.fontSize) ? t.fontSize : 14;
    const bold: TriState = Boolean(t.isBold || t.bold);
    const italic: TriState = Boolean(t.isItalic || t.italic);
    const underline: TriState = Boolean(t.isUnderline || t.underline);
    const strike: TriState = Boolean(t.isStrikethrough || t.strike);
    const color: FormattedValue<string> = t.color || '#000000';
    const backgroundColor: FormattedValue<string | null> =
      t.backgroundColor && t.backgroundColor !== 'transparent' ? t.backgroundColor : null;
    const textAlign: FormattedValue<TextAlignValue> =
      t.textAlign === 'center' || t.textAlign === 'right' ? t.textAlign : 'left';

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
      source: isEditing ? 'selection' : 'object',
      isEditable: true,
    };
  }
}
