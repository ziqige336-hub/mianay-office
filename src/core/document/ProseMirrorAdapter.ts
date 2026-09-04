import type {
  StructuredDocNode,
  FormattedRun,
  DocTableData,
  DocTableCell,
  DocumentModel,
  DocPageLayoutSettings,
} from '../../types';
import { ProseMirrorValidator } from './ProseMirrorValidator';

export interface ProseMirrorMark {
  type: string;
  attrs?: Record<string, any>;
}

export interface ProseMirrorNode {
  type: string;
  attrs?: Record<string, any>;
  content?: ProseMirrorNode[];
  marks?: ProseMirrorMark[];
  text?: string;
}

export interface ProseMirrorDoc {
  type: 'doc';
  content?: ProseMirrorNode[];
}

export class ProseMirrorAdapter {
  /**
   * Convert ProseMirror JSON AST (from editor.getJSON()) into DocumentModel StructuredDocNode array.
   * 100% pure JSON AST conversion with ZERO DOM or HTML string parsing.
   */
  public static proseMirrorToStructuredNodes(json: any): StructuredDocNode[] {
    if (!json || typeof json !== 'object') {
      return [];
    }

    const rootContent: ProseMirrorNode[] = Array.isArray(json.content)
      ? json.content
      : json.type === 'doc'
      ? []
      : [json];

    const structuredNodes: StructuredDocNode[] = [];

    for (const node of rootContent) {
      const parsed = this.parseProseMirrorNode(node);
      if (Array.isArray(parsed)) {
        structuredNodes.push(...parsed);
      } else if (parsed) {
        structuredNodes.push(parsed);
      }
    }

    return structuredNodes;
  }

  /**
   * Convert StructuredDocNode array into a ProseMirror JSON Document (ready for editor.commands.setContent).
   */
  public static structuredNodesToProseMirror(nodes: StructuredDocNode[]): ProseMirrorDoc {
    const docContent: ProseMirrorNode[] = [];
    let currentBulletList: ProseMirrorNode | null = null;
    let currentOrderedList: ProseMirrorNode | null = null;

    const flushLists = () => {
      if (currentBulletList) {
        docContent.push(currentBulletList);
        currentBulletList = null;
      }
      if (currentOrderedList) {
        docContent.push(currentOrderedList);
        currentOrderedList = null;
      }
    };

    for (const node of nodes) {
      if (node.type === 'bullet') {
        if (currentOrderedList) flushLists();
        if (!currentBulletList) {
          currentBulletList = { type: 'bulletList', content: [] };
        }
        const runsContent = this.runsToProseMirrorContent(node.runs);
        currentBulletList.content!.push({
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: runsContent.length > 0 ? runsContent : undefined,
            },
          ],
        });
        continue;
      } else if (node.type === 'ordered') {
        if (currentBulletList) flushLists();
        if (!currentOrderedList) {
          currentOrderedList = { type: 'orderedList', content: [] };
        }
        const runsContent = this.runsToProseMirrorContent(node.runs);
        currentOrderedList.content!.push({
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: runsContent.length > 0 ? runsContent : undefined,
            },
          ],
        });
        continue;
      }

      flushLists();

      switch (node.type) {
        case 'heading': {
          const content = this.runsToProseMirrorContent(node.runs);
          docContent.push({
            type: 'heading',
            attrs: { level: node.level || 1, ...(node.align ? { textAlign: node.align } : {}) },
            content: content.length > 0 ? content : undefined,
          });
          break;
        }

        case 'paragraph': {
          const content = this.runsToProseMirrorContent(node.runs);
          docContent.push({
            type: 'paragraph',
            attrs: node.align ? { textAlign: node.align } : undefined,
            content: content.length > 0 ? content : undefined,
          });
          break;
        }

        case 'quote': {
          const content = this.runsToProseMirrorContent(node.runs);
          docContent.push({
            type: 'blockquote',
            content: [
              {
                type: 'paragraph',
                content: content.length > 0 ? content : undefined,
              },
            ],
          });
          break;
        }

        case 'page-break':
          docContent.push({
            type: 'pageBreak',
          });
          break;

        case 'divider':
          docContent.push({
            type: 'horizontalRule',
          });
          break;

        case 'image':
          if (node.imageData?.src) {
            docContent.push({
              type: 'image',
              attrs: {
                src: node.imageData.src,
                alt: node.imageData.alt || node.imageData.ocrText || '',
                title: node.imageData.ocrText || node.imageData.alt || '',
                width: node.imageData.width,
                height: node.imageData.height,
              },
            });
          }
          break;

        case 'table':
          if (node.tableData && Array.isArray(node.tableData.rows)) {
            const tableRows: ProseMirrorNode[] = node.tableData.rows.map((row, rIdx) => {
              const rowCells: ProseMirrorNode[] = row.map((cell) => {
                const cellType = cell.bold || rIdx === 0 ? 'tableHeader' : 'tableCell';
                const cellRuns: FormattedRun[] =
                  cell.runs && cell.runs.length > 0
                    ? cell.runs
                    : cell.text
                    ? [
                        {
                          text: cell.text,
                          bold: cell.bold,
                          color: cell.bold ? '0F172A' : undefined,
                        },
                      ]
                    : [];

                const runsContent = this.runsToProseMirrorContent(cellRuns);
                return {
                  type: cellType,
                  attrs: {
                    colspan: cell.colSpan && cell.colSpan > 1 ? cell.colSpan : 1,
                    rowspan: cell.rowSpan && cell.rowSpan > 1 ? cell.rowSpan : 1,
                    background: cell.bg ? (cell.bg.startsWith('#') ? cell.bg : `#${cell.bg}`) : undefined,
                  },
                  content: [
                    {
                      type: 'paragraph',
                      content: runsContent.length > 0 ? runsContent : undefined,
                    },
                  ],
                };
              });

              return {
                type: 'tableRow',
                content: rowCells,
              };
            });

            docContent.push({
              type: 'table',
              content: tableRows,
            });
          }
          break;

        case 'code': {
          const content = this.runsToProseMirrorContent(node.runs);
          docContent.push({
            type: 'codeBlock',
            content: content.length > 0 ? content : undefined,
          });
          break;
        }

        default: {
          const content = this.runsToProseMirrorContent(node.runs);
          docContent.push({
            type: 'paragraph',
            content: content.length > 0 ? content : undefined,
          });
          break;
        }
      }
    }

    flushLists();

    const rawDoc: ProseMirrorDoc = {
      type: 'doc',
      content: docContent.length > 0 ? docContent : [{ type: 'paragraph' }],
    };

    return ProseMirrorValidator.sanitizeProseMirrorJson(rawDoc);
  }

  /**
   * Helper: Parse a single ProseMirror node into StructuredDocNode(s)
   */
  private static parseProseMirrorNode(node: ProseMirrorNode): StructuredDocNode | StructuredDocNode[] | null {
    if (!node || !node.type) return null;

    switch (node.type) {
      case 'heading': {
        const level = (node.attrs?.level || 1) as 1 | 2 | 3 | 4 | 5 | 6;
        const align = node.attrs?.textAlign || undefined;
        const runs = this.extractRunsFromNode(node);
        return {
          type: 'heading',
          level,
          align,
          runs,
        };
      }

      case 'paragraph': {
        const align = node.attrs?.textAlign || undefined;
        const runs = this.extractRunsFromNode(node);
        return {
          type: 'paragraph',
          align,
          runs,
        };
      }

      case 'bulletList': {
        const listItems: StructuredDocNode[] = [];
        if (Array.isArray(node.content)) {
          for (const item of node.content) {
            const runs = this.extractRunsFromNode(item);
            listItems.push({
              type: 'bullet',
              runs,
            });
          }
        }
        return listItems;
      }

      case 'orderedList': {
        const listItems: StructuredDocNode[] = [];
        if (Array.isArray(node.content)) {
          for (const item of node.content) {
            const runs = this.extractRunsFromNode(item);
            listItems.push({
              type: 'ordered',
              runs,
            });
          }
        }
        return listItems;
      }

      case 'listItem': {
        const runs = this.extractRunsFromNode(node);
        return {
          type: 'bullet',
          runs,
        };
      }

      case 'blockquote': {
        const runs = this.extractRunsFromNode(node);
        return {
          type: 'quote',
          runs,
        };
      }

      case 'pageBreak':
      case 'page-break':
      case 'page_break': {
        return {
          type: 'page-break',
          runs: [],
        };
      }

      case 'horizontalRule': {
        if (node.attrs?.['data-type'] === 'page-break' || node.attrs?.class?.includes('page-break')) {
          return {
            type: 'page-break',
            runs: [],
          };
        }
        return {
          type: 'divider',
          runs: [],
        };
      }

      case 'image': {
        const alt = node.attrs?.alt || '';
        const title = node.attrs?.title || '';
        const ocrText = title || alt || undefined;
        return {
          type: 'image',
          runs: [],
          imageData: {
            src: node.attrs?.src || '',
            alt: alt || title || '',
            ocrText: ocrText,
            width: node.attrs?.width ? parseInt(String(node.attrs.width), 10) : undefined,
            height: node.attrs?.height ? parseInt(String(node.attrs.height), 10) : undefined,
          },
        };
      }

      case 'table': {
        const rows: DocTableCell[][] = [];
        if (Array.isArray(node.content)) {
          for (let rIdx = 0; rIdx < node.content.length; rIdx++) {
            const rowNode = node.content[rIdx];
            if (rowNode.type === 'tableRow' && Array.isArray(rowNode.content)) {
              const rowCells: DocTableCell[] = [];
              for (const cellNode of rowNode.content) {
                const isHeader = cellNode.type === 'tableHeader';
                const cellRuns = this.extractRunsFromNode(cellNode);
                const cellText = cellRuns.map((r) => r.text).join(' ');
                const hasBoldRun = isHeader || cellRuns.some((r) => r.bold);

                let bg: string | undefined;
                if (cellNode.attrs?.background) {
                  bg = String(cellNode.attrs.background).replace('#', '').toUpperCase();
                }

                rowCells.push({
                  text: cellText,
                  bold: hasBoldRun,
                  bg,
                  runs: cellRuns.length > 0 ? cellRuns : undefined,
                  colSpan: cellNode.attrs?.colspan ? parseInt(String(cellNode.attrs.colspan), 10) : undefined,
                  rowSpan: cellNode.attrs?.rowspan ? parseInt(String(cellNode.attrs.rowspan), 10) : undefined,
                });
              }
              if (rowCells.length > 0) {
                rows.push(rowCells);
              }
            }
          }
        }

        const tableData: DocTableData = { rows };
        return {
          type: 'table',
          runs: [],
          tableData,
        };
      }

      case 'codeBlock': {
        const runs = this.extractRunsFromNode(node);
        return {
          type: 'code',
          runs,
        };
      }

      default: {
        // Fallback for nested wrapper nodes
        if (Array.isArray(node.content)) {
          const nested: StructuredDocNode[] = [];
          for (const c of node.content) {
            const parsed = this.parseProseMirrorNode(c);
            if (Array.isArray(parsed)) nested.push(...parsed);
            else if (parsed) nested.push(parsed);
          }
          return nested;
        }
        return null;
      }
    }
  }

  /**
   * Helper: Extract FormattedRun array recursively from any ProseMirror node
   */
  public static extractRunsFromNode(node: ProseMirrorNode): FormattedRun[] {
    const runs: FormattedRun[] = [];

    const walk = (n: ProseMirrorNode, inheritedMarks: ProseMirrorMark[]) => {
      const activeMarks = [...inheritedMarks, ...(n.marks || [])];

      if (n.type === 'text' && typeof n.text === 'string') {
        if (n.text.length === 0) return;

        let bold = false;
        let italic = false;
        let underline = false;
        let strike = false;
        let color: string | undefined;
        let highlight: string | undefined;
        let size: number | undefined;
        let fontFamily: string | undefined;
        let subscript = false;
        let superscript = false;

        for (const m of activeMarks) {
          if (m.type === 'bold') bold = true;
          if (m.type === 'italic') italic = true;
          if (m.type === 'underline') underline = true;
          if (m.type === 'strike') strike = true;
          if (m.type === 'subscript') subscript = true;
          if (m.type === 'superscript') superscript = true;
          if (m.type === 'highlight') {
            highlight = m.attrs?.color || 'FFFF00';
          }
          if (m.type === 'textStyle') {
            if (m.attrs?.color) {
              const col = String(m.attrs.color).replace('#', '').toUpperCase();
              color = col;
            }
            if (m.attrs?.fontSize) {
              const num = parseFloat(String(m.attrs.fontSize));
              if (!isNaN(num)) size = num;
            }
            if (m.attrs?.fontFamily) {
              fontFamily = String(m.attrs.fontFamily);
            }
          }
        }

        runs.push({
          text: n.text,
          bold: bold || undefined,
          italic: italic || undefined,
          underline: underline || undefined,
          strike: strike || undefined,
          color,
          highlight,
          size,
          fontFamily,
          subscript: subscript || undefined,
          superscript: superscript || undefined,
        });
      } else if (Array.isArray(n.content)) {
        for (const child of n.content) {
          walk(child, activeMarks);
        }
      }
    };

    walk(node, []);
    return runs;
  }

  /**
   * Helper: Convert FormattedRun array to ProseMirror text nodes with proper marks
   */
  public static runsToProseMirrorContent(runs: FormattedRun[]): ProseMirrorNode[] {
    if (!runs || runs.length === 0) {
      return [];
    }

    const validRuns = runs.filter((r) => r && typeof r.text === 'string' && r.text.length > 0);
    if (validRuns.length === 0) {
      return [];
    }

    return validRuns.map((r) => {
      const marks: ProseMirrorMark[] = [];

      if (r.bold) marks.push({ type: 'bold' });
      if (r.italic) marks.push({ type: 'italic' });
      if (r.underline) marks.push({ type: 'underline' });
      if (r.strike) marks.push({ type: 'strike' });
      if (r.subscript) marks.push({ type: 'subscript' });
      if (r.superscript) marks.push({ type: 'superscript' });
      if (r.highlight) marks.push({ type: 'highlight', attrs: { color: r.highlight } });

      if (r.color || r.size || r.fontFamily) {
        marks.push({
          type: 'textStyle',
          attrs: {
            color: r.color ? (r.color.startsWith('#') ? r.color : `#${r.color}`) : undefined,
            fontSize: r.size ? `${r.size}pt` : undefined,
            fontFamily: r.fontFamily || undefined,
          },
        });
      }

      return {
        type: 'text',
        text: r.text,
        marks: marks.length > 0 ? marks : undefined,
      };
    });
  }

  /**
   * Create a standardized DocumentModel from StructuredDocNode array or ProseMirror JSON
   */
  public static createDocumentModel(
    input: StructuredDocNode[] | ProseMirrorDoc | any,
    title: string = '未命名文档',
    layoutSettings?: DocPageLayoutSettings
  ): DocumentModel {
    let nodes: StructuredDocNode[] = [];
    let proseMirrorJson: any = null;

    if (Array.isArray(input)) {
      nodes = input;
      proseMirrorJson = this.structuredNodesToProseMirror(nodes);
    } else if (input && typeof input === 'object') {
      if (Array.isArray(input.nodes)) {
        nodes = input.nodes;
        proseMirrorJson = input.proseMirrorJson || this.structuredNodesToProseMirror(nodes);
      } else if (input.type === 'doc' || Array.isArray(input.content)) {
        proseMirrorJson = input;
        nodes = this.proseMirrorToStructuredNodes(input);
      } else if (typeof input.content === 'string') {
        // Fallback for raw text string
        nodes = [{ type: 'paragraph', runs: [{ text: input.content }] }];
        proseMirrorJson = this.structuredNodesToProseMirror(nodes);
      }
    }

    return {
      title,
      updatedAt: Date.now(),
      nodes,
      proseMirrorJson,
      layoutSettings,
    };
  }
}
