import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { Node, getSchema } from '@tiptap/core';
import type { Schema } from '@tiptap/pm/model';
import { FontSize, LineHeight } from '../../components/doc/DocFormatControls';
import { PagedLayoutExtension, type PagedLayoutPluginOptions } from './PagedLayoutPlugin';

/**
 * Custom PageBreak Extension representing an explicit OpenXML page break (<w:br w:type="page"/>)
 */
export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  selectable: true,
  draggable: true,
  atom: true,
  parseHTML() {
    return [
      { tag: 'div[data-type="page-break"]' },
      { tag: 'div.page-break' },
      { tag: 'hr.page-break' },
      { tag: 'page-break' },
    ];
  },
  renderHTML() {
    return [
      'div',
      {
        'data-type': 'page-break',
        class: 'page-break-node my-6 py-2 border-b-2 border-dashed border-sky-400 dark:border-sky-600 relative flex items-center justify-center select-none cursor-pointer',
      },
      [
        'span',
        {
          class: 'bg-sky-50 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 text-[11px] font-medium px-2.5 py-0.5 rounded-full border border-sky-200 dark:border-sky-800 shadow-2xs select-none',
        },
        '--- 分页符 (Page Break) ---',
      ],
    ];
  },
  addCommands() {
    return {
      setPageBreak:
        () =>
        ({ chain }) => {
          return chain().insertContent({ type: this.name }).run();
        },
    } as any;
  },
});

/**
 * Custom TableCell with support for background color attribute (OOXML cell shading)
 */
export const CustomTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      background: {
        default: null,
        parseHTML: (element) => element.style.backgroundColor || element.getAttribute('data-background'),
        renderHTML: (attributes) => {
          if (!attributes.background) return {};
          return {
            style: `background-color: ${attributes.background}`,
            'data-background': attributes.background,
          };
        },
      },
    };
  },
});

/**
 * Custom TableHeader with support for background color attribute (OOXML cell shading)
 */
export const CustomTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      background: {
        default: null,
        parseHTML: (element) => element.style.backgroundColor || element.getAttribute('data-background'),
        renderHTML: (attributes) => {
          if (!attributes.background) return {};
          return {
            style: `background-color: ${attributes.background}`,
            'data-background': attributes.background,
          };
        },
      },
    };
  },
});

/**
 * Factory for complete Tiptap extensions array.
 * Explicitly disables duplicate extensions (link, underline) in StarterKit to prevent warnings.
 */
export function getLuminaDocExtensions(pagedOptions?: Partial<PagedLayoutPluginOptions>) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      link: false,
      underline: false,
    }),
    TextStyle,
    Color,
    FontFamily,
    Highlight.configure({ multicolor: true }),
    Underline,
    Subscript,
    Superscript,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Link.configure({ openOnClick: false }),
    Image.configure({ inline: true, allowBase64: true }),
    Table.configure({ resizable: true }),
    TableRow,
    CustomTableCell,
    CustomTableHeader,
    FontSize,
    LineHeight,
    PageBreak,
    PagedLayoutExtension.configure(pagedOptions || {}),
  ];
}

let cachedSchema: Schema | null = null;

/**
 * Retrieve the active ProseMirror Schema generated from Lumina's Tiptap extensions.
 */
export function getLuminaDocSchema(): Schema {
  if (!cachedSchema) {
    cachedSchema = getSchema(getLuminaDocExtensions());
  }
  return cachedSchema;
}
