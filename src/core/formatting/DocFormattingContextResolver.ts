import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode, Mark } from 'prosemirror-model';
import {
  FormattingContext,
  DEFAULT_FORMATTING_CONTEXT,
  TriState,
  FormattedValue,
  TextAlignValue,
} from './types';

/**
 * Normalizes font size string into numeric points (pt).
 * E.g. "14pt" -> 14, "16px" -> 12, "14" -> 14.
 */
export function normalizeFontSizeToPt(val: any): number {
  if (typeof val === 'number') return val;
  if (!val || typeof val !== 'string') return 10.5;
  const cleaned = val.trim().toLowerCase();
  if (cleaned.endsWith('pt')) {
    const num = parseFloat(cleaned);
    return isNaN(num) ? 10.5 : num;
  }
  if (cleaned.endsWith('px')) {
    const num = parseFloat(cleaned);
    // Standard 96 DPI CSS px to 72 DPI pt: 1pt = 1.333px, so pt = px * 0.75
    return isNaN(num) ? 10.5 : Math.round(num * 0.75 * 10) / 10;
  }
  const num = parseFloat(cleaned);
  return isNaN(num) ? 10.5 : num;
}

/**
 * Normalizes font family string.
 * E.g. "PingFang SC, sans-serif" -> "PingFang SC"
 */
export function normalizeFontFamily(val: any): string {
  if (!val || typeof val !== 'string') return 'PingFang SC';
  return val.replace(/['"]/g, '').split(',')[0].trim() || 'PingFang SC';
}

/**
 * Extracts mark attributes and active state from a list of ProseMirror Marks.
 */
function extractMarksData(marks: readonly Mark[]) {
  let isBold = false;
  let isItalic = false;
  let isUnderline = false;
  let isStrike = false;
  let isSuper = false;
  let isSub = false;
  let color: string | null = null;
  let backgroundColor: string | null = null;
  let fontFamily: string | null = null;
  let fontSize: number | null = null;

  for (const mark of marks) {
    const name = mark.type.name;
    if (name === 'bold') isBold = true;
    if (name === 'italic') isItalic = true;
    if (name === 'underline') isUnderline = true;
    if (name === 'strike') isStrike = true;
    if (name === 'superscript') isSuper = true;
    if (name === 'subscript') isSub = true;

    if (name === 'textStyle') {
      if (mark.attrs.color) color = mark.attrs.color;
      if (mark.attrs.fontFamily) fontFamily = normalizeFontFamily(mark.attrs.fontFamily);
      if (mark.attrs.fontSize) fontSize = normalizeFontSizeToPt(mark.attrs.fontSize);
    }
    if (name === 'highlight') {
      if (mark.attrs.color) backgroundColor = mark.attrs.color;
    }
  }

  return {
    isBold,
    isItalic,
    isUnderline,
    isStrike,
    isSuper,
    isSub,
    color,
    backgroundColor,
    fontFamily,
    fontSize,
  };
}

/**
 * Context Resolver for Tiptap / ProseMirror Document Editor.
 * Real-time resolves current formatting context following strict priority:
 * Selection (Range) > Caret (Char before cursor) > Block / Parent > Default.
 */
export class DocFormattingContextResolver {
  public static resolve(editor: Editor | null): FormattingContext {
    if (!editor || !editor.state) {
      return { ...DEFAULT_FORMATTING_CONTEXT, isEditable: false };
    }

    const { state } = editor;
    const { selection, doc } = state;
    const { empty, from, to, $from } = selection;

    // Check if selection is inside a table
    let isInsideTable = false;
    let isBlockquote = false;
    let isCodeBlock = false;
    let listType: 'bullet' | 'ordered' | null = null;

    for (let d = $from.depth; d > 0; d--) {
      const node = $from.node(d);
      const name = node.type.name;
      if (name === 'table' || name === 'tableCell' || name === 'tableHeader' || name === 'tableRow') {
        isInsideTable = true;
      }
      if (name === 'blockquote') isBlockquote = true;
      if (name === 'codeBlock') isCodeBlock = true;
      if (name === 'bulletList') listType = 'bullet';
      if (name === 'orderedList') listType = 'ordered';
    }

    const parentBlock = $from.parent;
    const blockTextAlign: TextAlignValue = (parentBlock.attrs?.textAlign as TextAlignValue) || 'left';
    const blockLineHeight = parentBlock.attrs?.lineHeight || '1.68';
    const headingLevel = parentBlock.type.name === 'heading' ? (parentBlock.attrs?.level || 1) : 0;

    // CASE 1: Caret Mode (Empty selection from === to)
    if (empty) {
      // 1. Check character immediately preceding the caret
      const nodeBefore = $from.nodeBefore;
      let caretMarks: readonly Mark[] = [];

      if (state.storedMarks && state.storedMarks.length > 0) {
        caretMarks = state.storedMarks;
      } else if (nodeBefore && nodeBefore.isText && nodeBefore.marks.length > 0) {
        // Prioritize marks on the character immediately before cursor
        caretMarks = nodeBefore.marks;
      } else {
        caretMarks = $from.marks();
      }

      const markData = extractMarksData(caretMarks);
      const activeTextStyle = editor.getAttributes('textStyle') || {};
      const activeHighlight = editor.getAttributes('highlight') || {};

      const fontFamily = markData.fontFamily || normalizeFontFamily(activeTextStyle.fontFamily) || 'PingFang SC';
      const fontSize = markData.fontSize ?? (activeTextStyle.fontSize ? normalizeFontSizeToPt(activeTextStyle.fontSize) : 10.5);
      const color = markData.color || activeTextStyle.color || '#111827';
      const backgroundColor = markData.backgroundColor || activeHighlight.color || null;

      return {
        fontFamily,
        fontSize,
        bold: markData.isBold || editor.isActive('bold'),
        italic: markData.isItalic || editor.isActive('italic'),
        underline: markData.isUnderline || editor.isActive('underline'),
        strike: markData.isStrike || editor.isActive('strike'),
        superscript: markData.isSuper || editor.isActive('superscript'),
        subscript: markData.isSub || editor.isActive('subscript'),
        color,
        backgroundColor,
        textAlign: blockTextAlign,
        lineHeight: blockLineHeight,
        headingLevel,
        isBlockquote,
        isCodeBlock,
        listType,
        isInsideTable,
        source: 'caret',
        isEditable: editor.isEditable,
      };
    }

    // CASE 2: Selection Range Mode (from < to)
    const textNodeSamples: Array<ReturnType<typeof extractMarksData>> = [];
    const blockAlignments = new Set<TextAlignValue>();
    const headingLevels = new Set<number>();

    doc.nodesBetween(from, to, (node: ProseMirrorNode, pos: number) => {
      if (node.isText) {
        const overlapStart = Math.max(pos, from);
        const overlapEnd = Math.min(pos + node.nodeSize, to);
        if (overlapEnd > overlapStart) {
          textNodeSamples.push(extractMarksData(node.marks));
        }
      } else if (node.isBlock) {
        if (node.attrs?.textAlign) {
          blockAlignments.add(node.attrs.textAlign as TextAlignValue);
        } else {
          blockAlignments.add('left');
        }
        if (node.type.name === 'heading') {
          headingLevels.add(node.attrs?.level || 1);
        } else if (node.type.name === 'paragraph') {
          headingLevels.add(0);
        }
      }
    });

    if (textNodeSamples.length === 0) {
      // Empty block range or no text nodes found -> fallback to caret resolution
      return {
        fontFamily: 'PingFang SC',
        fontSize: 10.5,
        bold: false,
        italic: false,
        underline: false,
        strike: false,
        color: '#111827',
        backgroundColor: null,
        textAlign: blockTextAlign,
        lineHeight: blockLineHeight,
        headingLevel,
        isBlockquote,
        isCodeBlock,
        listType,
        isInsideTable,
        source: 'selection',
        isEditable: editor.isEditable,
      };
    }

    // Aggregate values
    const allBold = textNodeSamples.every((s) => s.isBold);
    const noneBold = textNodeSamples.every((s) => !s.isBold);
    const bold: TriState = allBold ? true : noneBold ? false : 'mixed';

    const allItalic = textNodeSamples.every((s) => s.isItalic);
    const noneItalic = textNodeSamples.every((s) => !s.isItalic);
    const italic: TriState = allItalic ? true : noneItalic ? false : 'mixed';

    const allUnderline = textNodeSamples.every((s) => s.isUnderline);
    const noneUnderline = textNodeSamples.every((s) => !s.isUnderline);
    const underline: TriState = allUnderline ? true : noneUnderline ? false : 'mixed';

    const allStrike = textNodeSamples.every((s) => s.isStrike);
    const noneStrike = textNodeSamples.every((s) => !s.isStrike);
    const strike: TriState = allStrike ? true : noneStrike ? false : 'mixed';

    const allSuper = textNodeSamples.every((s) => s.isSuper);
    const noneSuper = textNodeSamples.every((s) => !s.isSuper);
    const superscript: TriState = allSuper ? true : noneSuper ? false : 'mixed';

    const allSub = textNodeSamples.every((s) => s.isSub);
    const noneSub = textNodeSamples.every((s) => !s.isSub);
    const subscript: TriState = allSub ? true : noneSub ? false : 'mixed';

    // Font Family Aggregation
    const firstFont = textNodeSamples[0].fontFamily || 'PingFang SC';
    const allSameFont = textNodeSamples.every(
      (s) => (s.fontFamily || 'PingFang SC') === firstFont
    );
    const fontFamily: FormattedValue<string> = allSameFont ? firstFont : 'mixed';

    // Font Size Aggregation
    const firstSize = textNodeSamples[0].fontSize ?? 10.5;
    const allSameSize = textNodeSamples.every(
      (s) => (s.fontSize ?? 10.5) === firstSize
    );
    const fontSize: FormattedValue<number> = allSameSize ? firstSize : 'mixed';

    // Color Aggregation
    const firstColor = textNodeSamples[0].color || '#111827';
    const allSameColor = textNodeSamples.every(
      (s) => (s.color || '#111827') === firstColor
    );
    const color: FormattedValue<string> = allSameColor ? firstColor : 'mixed';

    // Background Highlight Aggregation
    const firstBg = textNodeSamples[0].backgroundColor;
    const allSameBg = textNodeSamples.every(
      (s) => s.backgroundColor === firstBg
    );
    const backgroundColor: FormattedValue<string | null> = allSameBg ? firstBg : 'mixed';

    // Text Align Aggregation
    const textAlign: FormattedValue<TextAlignValue> =
      blockAlignments.size === 1 ? Array.from(blockAlignments)[0] : blockAlignments.size > 1 ? 'mixed' : blockTextAlign;

    // Heading Level Aggregation
    const aggHeadingLevel: FormattedValue<number> =
      headingLevels.size === 1 ? Array.from(headingLevels)[0] : headingLevels.size > 1 ? 'mixed' : headingLevel;

    return {
      fontFamily,
      fontSize,
      bold,
      italic,
      underline,
      strike,
      superscript,
      subscript,
      color,
      backgroundColor,
      textAlign,
      lineHeight: blockLineHeight,
      headingLevel: aggHeadingLevel,
      isBlockquote,
      isCodeBlock,
      listType,
      isInsideTable,
      source: 'selection',
      isEditable: editor.isEditable,
    };
  }
}
