import type {
  DocumentModel,
  StructuredDocNode,
  DocPageLayoutSettings,
  DocBlock,
  PureDocument,
} from '../../types';

export interface LayoutBlock {
  id: string;
  type: string;
  nodeIndex: number;
  heightPt: number;
  heightPx: number;
  node?: StructuredDocNode;
  proseMirrorNode?: any;
  rawText?: string;
  isPageBreak?: boolean;
}

export interface LayoutPageMargin {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface LayoutPageContentArea {
  width: number;
  height: number;
  top: number;
  left: number;
}

export interface LayoutPage {
  pageNumber: number;
  pageWidth: number; // in pt (e.g. 595.28)
  pageHeight: number; // in pt (e.g. 841.89)
  pageWidthPx: number; // in px at 96 DPI (e.g. 793.7)
  pageHeightPx: number; // in px at 96 DPI (e.g. 1122.5)
  margin: LayoutPageMargin; // in pt
  marginPx: LayoutPageMargin; // in px
  contentArea: LayoutPageContentArea; // in pt
  contentAreaPx: LayoutPageContentArea; // in px
  blocks: LayoutBlock[];
  contentHeightPt: number;
  contentHeightPx: number;
  headerText?: string;
  footerText?: string;
  showPageNumbers?: boolean;
}

export interface PaginatedDocument {
  pages: LayoutPage[];
  totalPages: number;
  pageWidth: number;
  pageHeight: number;
  margin: LayoutPageMargin;
  layoutSettings: DocPageLayoutSettings;
  stats: {
    totalCharacters: number;
    totalWords: number;
    totalParagraphs: number;
  };
}

export const PT_TO_PX = 96 / 72; // 1.3333333333333333 px per pt
export const PX_TO_PT = 72 / 96; // 0.75 pt per px

export const DEFAULT_A4_LAYOUT: DocPageLayoutSettings = {
  paperSize: 'A4',
  orientation: 'portrait',
  margins: {
    top: 54,
    bottom: 54,
    left: 54,
    right: 54,
  },
  columns: 1,
  headerText: '',
  footerText: '',
  showPageNumbers: true,
};

/**
 * Standard paper size dimensions in Points (pt)
 */
export const PAPER_DIMENSIONS_PT: Record<string, { width: number; height: number }> = {
  A4: { width: 595.28, height: 841.89 },
  Letter: { width: 612.0, height: 792.0 },
  A3: { width: 841.89, height: 1190.55 },
  Legal: { width: 612.0, height: 1008.0 },
};

/**
 * DocumentLayoutEngine
 * Computes deterministic multi-page layout tree from DocumentModel / StructuredDocNode[] / ProseMirror JSON.
 * Follows standard Word / WPS / ISO pagination rules without corrupting the content model.
 */
export class DocumentLayoutEngine {
  /**
   * Calculate full document pagination
   */
  public static calculateLayout(
    input: {
      model?: DocumentModel;
      pureDoc?: PureDocument;
      nodes?: StructuredDocNode[];
      proseMirrorJson?: any;
      layoutSettings?: Partial<DocPageLayoutSettings>;
    }
  ): PaginatedDocument {
    const settings: DocPageLayoutSettings = {
      ...DEFAULT_A4_LAYOUT,
      ...(input.model?.layoutSettings || input.pureDoc?.layoutSettings || input.layoutSettings || {}),
      margins: {
        ...DEFAULT_A4_LAYOUT.margins,
        ...(input.model?.layoutSettings?.margins || input.pureDoc?.layoutSettings?.margins || input.layoutSettings?.margins || {}),
      },
    };

    const paper = PAPER_DIMENSIONS_PT[settings.paperSize] || PAPER_DIMENSIONS_PT.A4;
    const isLandscape = settings.orientation === 'landscape';
    const pageWidth = isLandscape ? paper.height : paper.width;
    const pageHeight = isLandscape ? paper.width : paper.height;

    const marginPt: LayoutPageMargin = {
      top: settings.margins.top || 54,
      bottom: settings.margins.bottom || 54,
      left: settings.margins.left || 54,
      right: settings.margins.right || 54,
    };

    const contentAreaPt: LayoutPageContentArea = {
      width: Math.max(100, pageWidth - marginPt.left - marginPt.right),
      height: Math.max(100, pageHeight - marginPt.top - marginPt.bottom),
      top: marginPt.top,
      left: marginPt.left,
    };

    const pageWidthPx = pageWidth * PT_TO_PX;
    const pageHeightPx = pageHeight * PT_TO_PX;
    const marginPx: LayoutPageMargin = {
      top: marginPt.top * PT_TO_PX,
      bottom: marginPt.bottom * PT_TO_PX,
      left: marginPt.left * PT_TO_PX,
      right: marginPt.right * PT_TO_PX,
    };
    const contentAreaPx: LayoutPageContentArea = {
      width: contentAreaPt.width * PT_TO_PX,
      height: contentAreaPt.height * PT_TO_PX,
      top: marginPt.top * PT_TO_PX,
      left: marginPt.left * PT_TO_PX,
    };

    // Extract blocks from StructuredDocNode array or ProseMirror JSON
    const extractedBlocks = this.extractBlocks(input);

    // Run pagination algorithm
    const pages: LayoutPage[] = [];
    let currentPageBlocks: LayoutBlock[] = [];
    let currentHeightPt = 0;

    const createNewPage = (pageNumber: number): LayoutPage => ({
      pageNumber,
      pageWidth,
      pageHeight,
      pageWidthPx,
      pageHeightPx,
      margin: marginPt,
      marginPx,
      contentArea: contentAreaPt,
      contentAreaPx,
      blocks: [],
      contentHeightPt: 0,
      contentHeightPx: 0,
      headerText: settings.headerText,
      footerText: settings.footerText,
      showPageNumbers: settings.showPageNumbers !== false,
    });

    let activePage = createNewPage(1);

    for (const block of extractedBlocks) {
      // Explicit Hard Page Break
      if (block.isPageBreak) {
        activePage.blocks = currentPageBlocks;
        activePage.contentHeightPt = currentHeightPt;
        activePage.contentHeightPx = currentHeightPt * PT_TO_PX;
        pages.push(activePage);

        activePage = createNewPage(pages.length + 1);
        currentPageBlocks = [];
        currentHeightPt = 0;
        continue;
      }

      // Check if block overflows current page available height
      if (currentPageBlocks.length > 0 && currentHeightPt + block.heightPt > contentAreaPt.height) {
        activePage.blocks = currentPageBlocks;
        activePage.contentHeightPt = currentHeightPt;
        activePage.contentHeightPx = currentHeightPt * PT_TO_PX;
        pages.push(activePage);

        activePage = createNewPage(pages.length + 1);
        currentPageBlocks = [block];
        currentHeightPt = block.heightPt;
      } else {
        currentPageBlocks.push(block);
        currentHeightPt += block.heightPt;
      }
    }

    // Push trailing page
    if (currentPageBlocks.length > 0 || pages.length === 0) {
      activePage.blocks = currentPageBlocks;
      activePage.contentHeightPt = currentHeightPt;
      activePage.contentHeightPx = currentHeightPt * PT_TO_PX;
      pages.push(activePage);
    }

    // Calculate document statistics
    let totalCharacters = 0;
    let totalWords = 0;
    let totalParagraphs = 0;

    for (const block of extractedBlocks) {
      if (block.rawText) {
        totalCharacters += block.rawText.length;
        const words = block.rawText.trim().split(/\s+/).filter(Boolean);
        totalWords += words.length;
      }
      if (block.type === 'paragraph' || block.type.startsWith('heading')) {
        totalParagraphs++;
      }
    }

    return {
      pages,
      totalPages: pages.length,
      pageWidth,
      pageHeight,
      margin: marginPt,
      layoutSettings: settings,
      stats: {
        totalCharacters,
        totalWords,
        totalParagraphs,
      },
    };
  }

  /**
   * Extract standardized layout blocks with calculated metric heights
   */
  private static extractBlocks(input: {
    model?: DocumentModel;
    pureDoc?: PureDocument;
    nodes?: StructuredDocNode[];
    proseMirrorJson?: any;
  }): LayoutBlock[] {
    const blocks: LayoutBlock[] = [];

    // 1. If StructuredDocNodes exist
    const nodes = input.nodes || input.model?.nodes || input.pureDoc?.nodes;
    if (nodes && nodes.length > 0) {
      nodes.forEach((node, idx) => {
        const heightPt = this.estimateNodeHeightPt(node);
        const rawText = node.runs ? node.runs.map((r) => r.text).join('') : '';
        const isPageBreak = node.type === 'page-break';

        blocks.push({
          id: `node-${idx}`,
          type: node.type,
          nodeIndex: idx,
          heightPt,
          heightPx: heightPt * PT_TO_PX,
          node,
          rawText,
          isPageBreak,
        });
      });
      return blocks;
    }

    // 2. If ProseMirror JSON exists
    const pmJson = input.proseMirrorJson || input.model?.proseMirrorJson || input.pureDoc?.proseMirrorJson;
    if (pmJson && pmJson.content && Array.isArray(pmJson.content)) {
      pmJson.content.forEach((pmNode: any, idx: number) => {
        const heightPt = this.estimateProseMirrorNodeHeightPt(pmNode);
        const rawText = this.extractTextFromPmNode(pmNode);
        const isPageBreak =
          pmNode.type === 'pageBreak' ||
          pmNode.attrs?.pageBreak === true ||
          (pmNode.type === 'horizontalRule' && pmNode.attrs?.isPageBreak === true);

        blocks.push({
          id: `pm-node-${idx}`,
          type: pmNode.type || 'paragraph',
          nodeIndex: idx,
          heightPt,
          heightPx: heightPt * PT_TO_PX,
          proseMirrorNode: pmNode,
          rawText,
          isPageBreak,
        });
      });
      return blocks;
    }

    // 3. Fallback default block
    blocks.push({
      id: 'default-block-0',
      type: 'paragraph',
      nodeIndex: 0,
      heightPt: 24,
      heightPx: 32,
      rawText: '',
    });

    return blocks;
  }

  /**
   * Estimate StructuredDocNode vertical height in Points
   */
  public static estimateNodeHeightPt(node: StructuredDocNode): number {
    if (node.type === 'page-break') return 0;

    switch (node.type) {
      case 'heading': {
        const level = node.level || 1;
        const fontSize = level === 1 ? 24 : level === 2 ? 18 : level === 3 ? 14 : 12;
        const lineHeight = fontSize * 1.35;
        const spaceBefore = node.spacing?.before || (level === 1 ? 16 : 12);
        const spaceAfter = node.spacing?.after || 8;
        const text = node.runs ? node.runs.map((r) => r.text).join('') : '';
        const lines = Math.max(1, Math.ceil((text.length * (fontSize * 0.75)) / 480));
        return spaceBefore + lines * lineHeight + spaceAfter;
      }

      case 'paragraph':
      case 'bullet':
      case 'ordered':
      case 'quote': {
        const fontSize = (node.runs && node.runs[0]?.size) || 12;
        const lineHeight = fontSize * 1.5;
        const spaceBefore = node.spacing?.before || 0;
        const spaceAfter = node.spacing?.after || 6;
        const text = node.runs ? node.runs.map((r) => r.text).join('') : '';
        // Average ~45-50 Chinese characters or ~75 English characters per standard A4 line (width ~480pt)
        const charCount = text.length;
        const estimatedLines = charCount === 0 ? 1 : Math.max(1, Math.ceil(charCount / 42));
        return spaceBefore + estimatedLines * lineHeight + spaceAfter;
      }

      case 'table': {
        if (!node.tableData || !node.tableData.rows || node.tableData.rows.length === 0) {
          return 60;
        }
        let totalTableHeight = 0;
        const headerHeight = node.tableData.headers ? 28 : 0;
        totalTableHeight += headerHeight;
        for (const row of node.tableData.rows) {
          let maxCellLines = 1;
          for (const cell of row) {
            const cellLen = (cell.text || '').length;
            const lines = Math.max(1, Math.ceil(cellLen / 16));
            if (lines > maxCellLines) maxCellLines = lines;
          }
          totalTableHeight += Math.max(26, maxCellLines * 16 + 10);
        }
        return totalTableHeight + 16; // table margin
      }

      case 'image': {
        const imgH = node.imageData?.height;
        if (imgH && typeof imgH === 'number' && imgH > 0) {
          return Math.min(450, imgH * PX_TO_PT) + 16;
        }
        return 180; // default image block height
      }

      case 'divider':
        return 20;

      case 'code': {
        const text = node.runs ? node.runs.map((r) => r.text).join('') : '';
        const lines = text.split('\n').length;
        return lines * 16 + 24;
      }

      default:
        return 24;
    }
  }

  /**
   * Estimate ProseMirror Node vertical height in Points
   */
  public static estimateProseMirrorNodeHeightPt(node: any): number {
    if (!node) return 20;
    const type = node.type;

    switch (type) {
      case 'heading': {
        const level = node.attrs?.level || 1;
        const fontSize = level === 1 ? 24 : level === 2 ? 18 : level === 3 ? 14 : 12;
        const spaceBefore = level === 1 ? 16 : 12;
        const spaceAfter = 8;
        const text = this.extractTextFromPmNode(node);
        const lines = Math.max(1, Math.ceil((text.length * (fontSize * 0.75)) / 480));
        return spaceBefore + lines * (fontSize * 1.35) + spaceAfter;
      }

      case 'paragraph':
      case 'bulletList':
      case 'orderedList':
      case 'listItem':
      case 'blockquote': {
        const text = this.extractTextFromPmNode(node);
        const charCount = text.length;
        const estimatedLines = charCount === 0 ? 1 : Math.max(1, Math.ceil(charCount / 42));
        return estimatedLines * 18 + 6;
      }

      case 'table': {
        const rowCount = node.content ? node.content.length : 3;
        return rowCount * 30 + 16;
      }

      case 'image': {
        const height = node.attrs?.height;
        if (height && typeof height === 'number') {
          return Math.min(450, height * PX_TO_PT) + 16;
        }
        return 180;
      }

      case 'horizontalRule':
      case 'divider':
        return 20;

      case 'codeBlock': {
        const text = this.extractTextFromPmNode(node);
        const lines = text.split('\n').length;
        return lines * 16 + 24;
      }

      default:
        return 24;
    }
  }

  private static extractTextFromPmNode(node: any): string {
    if (!node) return '';
    if (typeof node.text === 'string') return node.text;
    if (node.content && Array.isArray(node.content)) {
      return node.content.map((child: any) => this.extractTextFromPmNode(child)).join('');
    }
    return '';
  }
}
