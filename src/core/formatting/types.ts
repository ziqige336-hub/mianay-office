export type TriState = boolean | 'mixed';
export type FormattedValue<T> = T | 'mixed';

export type TextAlignValue = 'left' | 'center' | 'right' | 'justify';

export interface FormattingContext {
  /** Font family name or 'mixed' if multiple fonts are in the selection */
  fontFamily: FormattedValue<string>;
  /** Font size in points (pt) or 'mixed' if varying sizes */
  fontSize: FormattedValue<number>;
  /** Bold status (true / false / 'mixed') */
  bold: TriState;
  /** Italic status (true / false / 'mixed') */
  italic: TriState;
  /** Underline status (true / false / 'mixed') */
  underline: TriState;
  /** Strikethrough status (true / false / 'mixed') */
  strike: TriState;
  /** Superscript status (true / false / 'mixed') */
  superscript?: TriState;
  /** Subscript status (true / false / 'mixed') */
  subscript?: TriState;
  /** Text foreground color (hex/rgb string or 'mixed') */
  color: FormattedValue<string>;
  /** Text background / highlight / shading color or null if transparent */
  backgroundColor: FormattedValue<string | null>;
  /** Paragraph / cell / object text alignment */
  textAlign: FormattedValue<TextAlignValue>;
  /** Paragraph line height */
  lineHeight?: FormattedValue<string | number>;
  /** Heading level: 0 = paragraph, 1..6 = heading level, 'mixed' if across multiple types */
  headingLevel?: FormattedValue<number>;
  /** Blockquote active status */
  isBlockquote?: TriState;
  /** Code block active status */
  isCodeBlock?: TriState;
  /** List format */
  listType?: 'bullet' | 'ordered' | null | 'mixed';
  /** Whether the caret/selection is inside a table */
  isInsideTable?: boolean;
  /** Source of formatting context */
  source: 'selection' | 'caret' | 'object' | 'default';
  /** Whether the current context is editable */
  isEditable: boolean;
}

export const DEFAULT_FORMATTING_CONTEXT: FormattingContext = {
  fontFamily: 'PingFang SC',
  fontSize: 10.5,
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  superscript: false,
  subscript: false,
  color: '#111827',
  backgroundColor: null,
  textAlign: 'left',
  lineHeight: '21px',
  headingLevel: 0,
  isBlockquote: false,
  isCodeBlock: false,
  listType: null,
  isInsideTable: false,
  source: 'default',
  isEditable: true,
};
