import type { StructuredDocNode, FormattedRun, DocTableCell, DocTableData, DocPageLayoutSettings } from '../../types';
import { TextSelection } from '@tiptap/pm/state';

export interface PageLayoutOptions {
  pageSize?: 'A4' | 'Letter' | 'A3' | 'Legal' | 'Custom';
  orientation?: 'portrait' | 'landscape';
  margin?: 'normal' | 'narrow' | 'wide';
  customPageHeightPx?: number;
  customPageWidthPx?: number;
  customWidthMm?: number;
  customHeightMm?: number;
}

export interface PageLayout {
  pageIndex: number;
  pageNumber: number;
  blocks: StructuredDocNode[];
  usedHeight: number;
  maxHeight: number;
  hasExplicitPageBreak?: boolean;
}

export interface VisualLine {
  pageIndex: number;
  rect: DOMRect;
  top: number;
  bottom: number;
  left: number;
  right: number;
  centerY: number;
  blockElement: HTMLElement;
  startPos: number;
  endPos: number;
}

export interface ComputedPageGeometry {
  pageWidthPx: number;
  pageHeightPx: number;

  marginTopPx: number;
  marginBottomPx: number;
  marginLeftPx: number;
  marginRightPx: number;

  headerDistancePx: number;
  footerDistancePx: number;

  pageGapPx: number;
  pageStridePx: number;

  contentWidthPx: number;
  contentHeightPx: number;

  pageTop(pageIndex: number): number;
  pageBottom(pageIndex: number): number;
  contentTop(pageIndex: number): number;
  contentBottom(pageIndex: number): number;
}

export interface PageGeometry {
  pageWidth: number;
  pageHeight: number;
  pageGap: number;
  pageStride: number;
  topPadding: number;
  bottomPadding: number;
  usableHeight: number;
  usableWidth: number;
}

export interface PageBreakDescriptor {
  nodeIndex: number;
  pos: number;
  pageIndex: number;
  spacerHeight: number;
}

export interface PageBreakCalculationResult {
  pageCount: number;
  breaks: PageBreakDescriptor[];
  changed: boolean;
}

/**
 * PageLayoutEngine
 * 
 * Computes deterministic physical pagination for rich structured document models.
 * Calculates exact block heights, wraps text lines according to font size and printable width,
 * allocates blocks into discrete page slices, and handles explicit page breaks.
 */
export class PageLayoutEngine {
  public static readonly MM_TO_PX = 96 / 25.4; // 3.779527559055118 CSS px per mm

  // Standard paper dimensions in mm
  public static readonly PAPER_SIZES_MM: Record<string, { width: number; height: number }> = {
    A4: { width: 210, height: 297 },
    Letter: { width: 215.9, height: 279.4 },
    A3: { width: 297, height: 420 },
    Legal: { width: 215.9, height: 355.6 },
  };

  public static readonly A4_WIDTH_PX = Math.round(210 * (96 / 25.4)); // 794
  public static readonly A4_HEIGHT_PX = Math.round(297 * (96 / 25.4)); // 1123
  public static readonly PAGE_GAP_PX = 24;
  public static readonly PAGE_STRIDE_PX = 1147; // 1123 + 24
  public static readonly MARGIN_TOP_PX = 72;
  public static readonly MARGIN_BOTTOM_PX = 72;
  public static readonly MARGIN_LEFT_PX = 72;
  public static readonly MARGIN_RIGHT_PX = 72;
  public static readonly LINE_HEIGHT_PX = 21;
  public static readonly TARGET_LINES_PER_PAGE = 44;
  public static readonly CONTENT_HEIGHT_PX = 979; // 1123 - 72 - 72 = 979px (Mathematical closure: pageHeight - marginTop - marginBottom)

  /**
   * Absolute physical baseline coordinate for the first line of page k (0-indexed):
   * targetTop(k) = k * (pageHeight + pageGap) + marginTop
   */
  public static targetTop(
    k: number,
    pageHeight = this.A4_HEIGHT_PX,
    pageGap = this.PAGE_GAP_PX,
    marginTop = this.MARGIN_TOP_PX
  ): number {
    return k * (pageHeight + pageGap) + marginTop;
  }

  /**
   * Unified ComputedPageGeometry Factory:
   * Translates DocumentModel.layoutSettings or preset options into an immutable physical page geometry.
   * All pages share this mathematically exact, non-accumulating frame.
   */
  public static computeGeometry(
    settings?: Partial<DocPageLayoutSettings> | 'normal' | 'narrow' | 'wide' | null
  ): ComputedPageGeometry {
    const pageGapPx = this.PAGE_GAP_PX;
    const headerDistancePx = 28;
    const footerDistancePx = 28;

    if (typeof settings === 'string' || !settings) {
      const marginPreset = (typeof settings === 'string' ? settings : 'normal') as 'normal' | 'narrow' | 'wide';
      const marginTopPx = marginPreset === 'narrow' ? 48 : marginPreset === 'wide' ? 96 : this.MARGIN_TOP_PX;
      const marginBottomPx = marginPreset === 'narrow' ? 48 : marginPreset === 'wide' ? 96 : this.MARGIN_BOTTOM_PX;
      const marginLeftPx = marginPreset === 'narrow' ? 48 : marginPreset === 'wide' ? 96 : this.MARGIN_LEFT_PX;
      const marginRightPx = marginPreset === 'narrow' ? 48 : marginPreset === 'wide' ? 96 : this.MARGIN_RIGHT_PX;

      const pageWidthPx = this.A4_WIDTH_PX;
      const pageHeightPx = this.A4_HEIGHT_PX;
      const pageStridePx = pageHeightPx + pageGapPx;
      const contentWidthPx = pageWidthPx - marginLeftPx - marginRightPx;
      // Mathematical closure: contentHeight = pageHeight - marginTop - marginBottom (1123 - 72 - 72 = 979px)
      const contentHeightPx = Math.max(200, pageHeightPx - marginTopPx - marginBottomPx);

      return {
        pageWidthPx,
        pageHeightPx,
        marginTopPx,
        marginBottomPx,
        marginLeftPx,
        marginRightPx,
        headerDistancePx,
        footerDistancePx,
        pageGapPx,
        pageStridePx,
        contentWidthPx,
        contentHeightPx,
        pageTop: (p: number) => p * pageStridePx,
        pageBottom: (p: number) => p * pageStridePx + pageHeightPx,
        contentTop: (p: number) => p * pageStridePx + marginTopPx,
        contentBottom: (p: number) => p * pageStridePx + marginTopPx + contentHeightPx,
      };
    }

    // Dynamic settings from DocumentModel.layoutSettings
    const paperName = settings.paperSize || 'A4';
    const orientation = settings.orientation || 'portrait';
    const paperDimensions = this.PAPER_SIZES_MM[paperName] || this.PAPER_SIZES_MM.A4;

    const rawWidthMm = orientation === 'landscape' ? paperDimensions.height : paperDimensions.width;
    const rawHeightMm = orientation === 'landscape' ? paperDimensions.width : paperDimensions.height;

    const pageWidthPx = Math.round(rawWidthMm * this.MM_TO_PX);
    const pageHeightPx = Math.round(rawHeightMm * this.MM_TO_PX);

    // Margins handling
    let marginTopPx = this.MARGIN_TOP_PX;
    let marginBottomPx = this.MARGIN_BOTTOM_PX;
    let marginLeftPx = this.MARGIN_LEFT_PX;
    let marginRightPx = this.MARGIN_RIGHT_PX;

    if (settings.margins) {
      const { top, bottom, left, right } = settings.margins;
      marginTopPx = top > 0 ? (top < 100 ? Math.round(top * this.MM_TO_PX) : top) : this.MARGIN_TOP_PX;
      marginBottomPx = bottom > 0 ? (bottom < 100 ? Math.round(bottom * this.MM_TO_PX) : bottom) : this.MARGIN_BOTTOM_PX;
      marginLeftPx = left > 0 ? (left < 100 ? Math.round(left * this.MM_TO_PX) : left) : this.MARGIN_LEFT_PX;
      marginRightPx = right > 0 ? (right < 100 ? Math.round(right * this.MM_TO_PX) : right) : this.MARGIN_RIGHT_PX;
    }

    const pageStridePx = pageHeightPx + pageGapPx;
    const contentWidthPx = Math.max(200, pageWidthPx - marginLeftPx - marginRightPx);
    // Mathematical closure: contentHeight = pageHeight - marginTop - marginBottom
    const contentHeightPx = Math.max(200, pageHeightPx - marginTopPx - marginBottomPx);

    return {
      pageWidthPx,
      pageHeightPx,
      marginTopPx,
      marginBottomPx,
      marginLeftPx,
      marginRightPx,
      headerDistancePx,
      footerDistancePx,
      pageGapPx,
      pageStridePx,
      contentWidthPx,
      contentHeightPx,
      pageTop: (p: number) => p * pageStridePx,
      pageBottom: (p: number) => p * pageStridePx + pageHeightPx,
      contentTop: (p: number) => p * pageStridePx + marginTopPx,
      contentBottom: (p: number) => p * pageStridePx + marginTopPx + contentHeightPx,
    };
  }

  /**
   * Complete page metrics and dimensional specifications based on unified Page Geometry model.
   * All pages share identical mathematical geometry.
   */
  public static getPageMetrics(
    marginOrSettings: 'normal' | 'narrow' | 'wide' | Partial<DocPageLayoutSettings> = 'normal'
  ): PageGeometry {
    const geo = this.computeGeometry(marginOrSettings);
    return {
      pageWidth: geo.pageWidthPx,
      pageHeight: geo.pageHeightPx,
      pageGap: geo.pageGapPx,
      pageStride: geo.pageStridePx,
      topPadding: geo.marginTopPx,
      bottomPadding: geo.marginBottomPx,
      usableHeight: geo.contentHeightPx,
      usableWidth: geo.contentWidthPx,
    };
  }

  /**
   * Get deterministic Page Coordinates (PC) for any given 0-based page index.
   * Universal formula:
   * pageTop(p) = p * pageStride
   * pageBottom(p) = pageTop(p) + pageHeight
   * contentTop(p) = pageTop(p) + topPadding
   * contentBottom(p) = pageBottom(p) - bottomPadding
   */
  public static getPageCoordinates(
    pageIndex: number,
    marginOrSettings: 'normal' | 'narrow' | 'wide' | Partial<DocPageLayoutSettings> = 'normal'
  ) {
    const geo = this.computeGeometry(marginOrSettings);
    return {
      pageIndex,
      pageTop: geo.pageTop(pageIndex),
      pageBottom: geo.pageBottom(pageIndex),
      contentTop: geo.contentTop(pageIndex),
      contentBottom: geo.contentBottom(pageIndex),
      usableHeight: geo.contentHeightPx,
      usableWidth: geo.contentWidthPx,
    };
  }

  public static getPageTop(pageIndex: number, margin?: any): number {
    return this.computeGeometry(margin).pageTop(pageIndex);
  }

  public static getPageBottom(pageIndex: number, margin?: any): number {
    return this.computeGeometry(margin).pageBottom(pageIndex);
  }

  public static getContentTop(pageIndex: number, margin?: any): number {
    return this.computeGeometry(margin).contentTop(pageIndex);
  }

  public static getContentBottom(pageIndex: number, margin?: any): number {
    return this.computeGeometry(margin).contentBottom(pageIndex);
  }

  /**
   * Determine usable printable height based on margin settings
   */
  public static getUsablePageHeight(margin: 'normal' | 'narrow' | 'wide' = 'normal'): number {
    return this.computeGeometry(margin).contentHeightPx;
  }

  /**
   * Determine usable printable width based on margin settings
   */
  public static getUsablePageWidth(margin: 'normal' | 'narrow' | 'wide' = 'normal'): number {
    return this.computeGeometry(margin).contentWidthPx;
  }

  /**
   * Check if a relative Y coordinate (from top of document flow) falls in an uneditable Page Gap or Margin zone
   * (Used only for pointer click/mousedown boundary checks)
   */
  public static isPointInPageGap(relY: number, margin: 'normal' | 'narrow' | 'wide' = 'normal'): boolean {
    if (relY < 0) return true;
    const geo = this.computeGeometry(margin);
    const pageIndex = Math.floor(relY / geo.pageStridePx);
    const yInPage = relY - pageIndex * geo.pageStridePx;

    // 1. In physical Page Gap between sheets
    if (yInPage >= geo.pageHeightPx) {
      return true;
    }
    // 2. In non-editable top header band
    if (yInPage < geo.marginTopPx - 2) {
      return true;
    }
    // 3. In non-editable bottom footer band
    if (yInPage > geo.pageHeightPx - geo.marginBottomPx + 2) {
      return true;
    }
    return false;
  }

  /**
   * Calculate deterministic physical page metrics from ProseMirror DOM blocks in Paged Mode.
   * Uses real DOM absolute coordinate measurement matching calculatePageBreaks.
   */
  public static applyPagedLayoutToDom(
    container: HTMLElement | null,
    margin: 'normal' | 'narrow' | 'wide' = 'normal'
  ): { pageCount: number } {
    if (!container) return { pageCount: 1 };
    const pmEl = (container.querySelector('.ProseMirror') as HTMLElement) || container;
    const children = (Array.from(pmEl.children) as HTMLElement[]).filter(
      (el) => !el.classList.contains('pm-page-break-widget')
    );
    if (children.length === 0) return { pageCount: 1 };

    const geometry = this.computeGeometry(margin);
    const pageHeight = geometry.pageHeightPx;
    const pageGap = geometry.pageGapPx;
    const marginTop = geometry.marginTopPx;
    const contentHeight = geometry.contentHeightPx;

    const editorRect = pmEl.getBoundingClientRect();
    const scale = (pmEl.offsetWidth > 0 && editorRect.width > 0) ? (editorRect.width / pmEl.offsetWidth) : 1;

    let currentPage = 0;
    let lastBlockOfPrevPage: HTMLElement | null = null;
    let cumulativeSpacerDelta = 0;
    const MAX_SAFE_PAGES = 50;

    for (let i = 0; i < children.length; i++) {
      if (currentPage >= MAX_SAFE_PAGES - 1) break;
      const el = children[i];
      if (el.style.marginTop) {
        el.style.marginTop = '';
      }

      const isExplicitPageBreak =
        el.getAttribute('data-type') === 'page-break' ||
        el.classList.contains('page-break-node');

      if (isExplicitPageBreak) {
        if (lastBlockOfPrevPage !== null) {
          const k = currentPage + 1;
          const targetContentTop = k * (pageHeight + pageGap) + marginTop;
          const prevBlockBottom = ((lastBlockOfPrevPage.getBoundingClientRect().bottom - editorRect.top) / scale) + cumulativeSpacerDelta;
          const dynamicSpacerHeight = Math.max(0, Math.round(targetContentTop - prevBlockBottom));
          const existingWidget = el.previousElementSibling?.classList.contains('pm-page-break-widget')
            ? (el.previousElementSibling as HTMLElement)
            : null;
          const oldWidgetHeight = existingWidget ? (parseFloat(existingWidget.style.height) || 0) : 0;
          cumulativeSpacerDelta += (dynamicSpacerHeight - oldWidgetHeight);
          currentPage = k;
          lastBlockOfPrevPage = el;
        }
        el.setAttribute('data-page-index', `${currentPage}`);
        continue;
      }

      const rawBlockBottom = (el.getBoundingClientRect().bottom - editorRect.top) / scale;
      const blockBottom = rawBlockBottom + cumulativeSpacerDelta;
      const currentContentBottomLimit = currentPage * (pageHeight + pageGap) + marginTop + contentHeight;

      if (blockBottom > currentContentBottomLimit + 1.5 && lastBlockOfPrevPage !== null) {
        const k = currentPage + 1;
        const targetContentTop = k * (pageHeight + pageGap) + marginTop;
        const prevBlockBottom = ((lastBlockOfPrevPage.getBoundingClientRect().bottom - editorRect.top) / scale) + cumulativeSpacerDelta;
        const dynamicSpacerHeight = Math.max(0, Math.round(targetContentTop - prevBlockBottom));
        const existingWidget = el.previousElementSibling?.classList.contains('pm-page-break-widget')
          ? (el.previousElementSibling as HTMLElement)
          : null;
        const oldWidgetHeight = existingWidget ? (parseFloat(existingWidget.style.height) || 0) : 0;
        cumulativeSpacerDelta += (dynamicSpacerHeight - oldWidgetHeight);
        currentPage = k;
        lastBlockOfPrevPage = el;
        el.setAttribute('data-page-index', `${currentPage}`);
      } else {
        lastBlockOfPrevPage = el;
        el.setAttribute('data-page-index', `${currentPage}`);
      }
    }

    return { pageCount: Math.max(1, currentPage + 1) };
  }

  /**
   * High-precision dynamic page break calculation:
   * 1. Real DOM absolute coordinate measurement via getBoundingClientRect() against editorRect.top
   * 2. currentContentBottomLimit = k * (pageHeight + pageGap) + marginTop + contentHeight
   *    (pageHeight = 1123, pageGap = 24, marginTop = 96, contentHeight = 931)
   * 3. Breaks strictly when blockBottom > currentContentBottomLimit (no -12px pre-truncation)
   * 4. dynamicSpacerHeight = targetContentTop - prevBlockBottom (net difference, no double margins)
   * 5. Enforces MAX_SAFE_PAGES = 50 loop guard.
   * 6. Idempotent check comparing against previous layout state.
   */
  public static calculatePageBreaks(
    doc: any,
    dom: HTMLElement,
    geometry: ComputedPageGeometry,
    lastBreaks: { pos: number; spacerHeight: number }[] = [],
    lastPageCount: number = 1
  ): PageBreakCalculationResult {
    if (!dom || !doc) {
      return {
        pageCount: 1,
        breaks: [],
        changed: lastPageCount !== 1 || lastBreaks.length !== 0,
      };
    }

    const pmEl = (dom.querySelector('.ProseMirror') as HTMLElement) || dom;
    const children = (Array.from(pmEl.children) as HTMLElement[]).filter(
      (el) => !el.classList.contains('pm-page-break-widget')
    );

    if (children.length === 0 || doc.childCount === 0) {
      const changed = lastPageCount !== 1 || lastBreaks.length !== 0;
      return { pageCount: 1, breaks: [], changed };
    }

    const pageHeight = geometry.pageHeightPx;
    const pageGap = geometry.pageGapPx;
    const marginTop = geometry.marginTopPx;
    const contentHeight = geometry.contentHeightPx;

    const editorRect = pmEl.getBoundingClientRect();
    const scale = (pmEl.offsetWidth > 0 && editorRect.width > 0) ? (editorRect.width / pmEl.offsetWidth) : 1;

    const blockMeasures: {
      index: number;
      pos: number;
      node: any;
      el: HTMLElement;
      isExplicitPageBreak: boolean;
    }[] = [];

    let childIdx = 0;
    doc.forEach((node: any, pos: number) => {
      const el = children[childIdx];
      childIdx++;
      if (!el) return;

      const isExplicitPageBreak =
        node.type.name === 'pageBreak' ||
        el.getAttribute('data-type') === 'page-break' ||
        el.classList.contains('page-break-node');

      blockMeasures.push({
        index: childIdx - 1,
        pos,
        node,
        el,
        isExplicitPageBreak,
      });
    });

    let currentPage = 0;
    let lastBlockOfPrevPage: HTMLElement | null = null;
    let cumulativeSpacerDelta = 0;
    const breaks: PageBreakDescriptor[] = [];
    const MAX_SAFE_PAGES = 50;

    for (let i = 0; i < blockMeasures.length; i++) {
      if (currentPage >= MAX_SAFE_PAGES - 1) {
        // Enforce maximum safety limit to prevent runaway DOM trees
        break;
      }
      const b = blockMeasures[i];
      const blockEl = b.el;

      // 1. Explicit user-inserted PageBreak
      if (b.isExplicitPageBreak) {
        if (lastBlockOfPrevPage !== null) {
          const k = currentPage + 1;
          const targetContentTop = k * (pageHeight + pageGap) + marginTop;
          const prevBlockBottom = ((lastBlockOfPrevPage.getBoundingClientRect().bottom - editorRect.top) / scale) + cumulativeSpacerDelta;
          const dynamicSpacerHeight = Math.max(0, Math.round(targetContentTop - prevBlockBottom));
          breaks.push({
            nodeIndex: i,
            pos: b.pos,
            pageIndex: k,
            spacerHeight: dynamicSpacerHeight,
          });

          const existingWidget = blockEl.previousElementSibling?.classList.contains('pm-page-break-widget')
            ? (blockEl.previousElementSibling as HTMLElement)
            : null;
          const oldWidgetHeight = existingWidget ? (parseFloat(existingWidget.style.height) || 0) : 0;
          cumulativeSpacerDelta += (dynamicSpacerHeight - oldWidgetHeight);

          currentPage = k;
          lastBlockOfPrevPage = blockEl;
        }
        b.el.setAttribute('data-page-index', `${currentPage}`);
        continue;
      }

      // 2. Real DOM absolute coordinate measurement
      const rawBlockBottom = (blockEl.getBoundingClientRect().bottom - editorRect.top) / scale;
      const blockBottom = rawBlockBottom + cumulativeSpacerDelta;

      // Current page content bottom limit (0-indexed k = currentPage):
      // currentContentBottomLimit = k * (pageHeight + pageGap) + marginTop + contentHeight
      const currentContentBottomLimit = currentPage * (pageHeight + pageGap) + marginTop + contentHeight;

      // 3. Overflow check: blockBottom > currentContentBottomLimit + 1.5
      // (ensuring lastBlockOfPrevPage is not null to prevent infinite loop on empty page)
      if (blockBottom > currentContentBottomLimit + 1.5 && lastBlockOfPrevPage !== null) {
        const k = currentPage + 1;
        // Target baseline for page k: targetContentTop = k * (pageHeight + pageGap) + marginTop
        const targetContentTop = k * (pageHeight + pageGap) + marginTop;
        // Previous block real bottom edge relative to editor
        const prevBlockBottom = ((lastBlockOfPrevPage.getBoundingClientRect().bottom - editorRect.top) / scale) + cumulativeSpacerDelta;
        // Dynamic spacer height is strictly the net difference:
        const dynamicSpacerHeight = Math.max(0, Math.round(targetContentTop - prevBlockBottom));

        breaks.push({
          nodeIndex: i,
          pos: b.pos,
          pageIndex: k,
          spacerHeight: dynamicSpacerHeight,
        });

        const existingWidget = blockEl.previousElementSibling?.classList.contains('pm-page-break-widget')
          ? (blockEl.previousElementSibling as HTMLElement)
          : null;
        const oldWidgetHeight = existingWidget ? (parseFloat(existingWidget.style.height) || 0) : 0;
        cumulativeSpacerDelta += (dynamicSpacerHeight - oldWidgetHeight);

        currentPage = k;
        lastBlockOfPrevPage = blockEl;
        b.el.setAttribute('data-page-index', `${currentPage}`);
      } else {
        lastBlockOfPrevPage = blockEl;
        b.el.setAttribute('data-page-index', `${currentPage}`);
      }
    }

    const pageCount = Math.max(1, currentPage + 1);

    // Idempotent Check: Strictly compare new calculation with last state
    const isSamePageCount = lastPageCount === pageCount;
    const isSameBreaks =
      lastBreaks != null &&
      lastBreaks.length === breaks.length &&
      breaks.every((b, idx) => {
        const lb = lastBreaks[idx];
        return lb && lb.pos === b.pos && Math.abs(lb.spacerHeight - b.spacerHeight) < 2;
      });

    if (isSamePageCount && isSameBreaks) {
      return { pageCount, breaks, changed: false };
    }

    return { pageCount, breaks, changed: true };
  }

  /**
   * Clear all page layout attributes from ProseMirror DOM blocks for seamless Continuous Mode
   */
  public static clearPagedLayoutFromDom(container: HTMLElement | null): void {
    if (!container) return;
    const pmEl = (container.querySelector('.ProseMirror') as HTMLElement) || container;
    const children = (Array.from(pmEl.children) as HTMLElement[]).filter(
      (el) => !el.classList.contains('pm-page-break-widget')
    );
    for (let i = 0; i < children.length; i++) {
      if (children[i].style.marginTop) {
        children[i].style.marginTop = '';
      }
      children[i].removeAttribute('data-page-index');
    }
  }

  /**
   * Scan and construct the complete ordered array of real VisualLines in the editor DOM.
   * Utilizes Range.getClientRects() to precisely map every visual line to its ProseMirror document position.
   */
  public static getVisualLines(view: any, wrapperEl: HTMLElement | null): VisualLine[] {
    if (!view || !wrapperEl) return [];
    const pmEl = (wrapperEl.querySelector('.ProseMirror') as HTMLElement) || wrapperEl;
    const topLevelChildren = (Array.from(pmEl.children) as HTMLElement[]).filter(
      (el) => !el.classList.contains('pm-page-break-widget')
    );
    if (topLevelChildren.length === 0) return [];

    const lines: VisualLine[] = [];

    for (let b = 0; b < topLevelChildren.length; b++) {
      const blockEl = topLevelChildren[b];
      const pageIndex = parseInt(blockEl.getAttribute('data-page-index') || '0', 10);
      const blockLines = this.getVisualLinesForBlock(view, blockEl, pageIndex);
      lines.push(...blockLines);
    }

    return lines;
  }

  /**
   * Scan all visual lines inside a single block element using DOM Range rects
   */
  private static getVisualLinesForBlock(
    view: any,
    blockEl: HTMLElement,
    pageIndex: number
  ): VisualLine[] {
    const lines: VisualLine[] = [];

    // Find all text nodes inside blockEl
    const walker = document.createTreeWalker(blockEl, NodeFilter.SHOW_TEXT, null);
    const textNodes: Text[] = [];
    let currentNode = walker.nextNode();
    while (currentNode) {
      if (currentNode.nodeType === Node.TEXT_NODE) {
        textNodes.push(currentNode as Text);
      }
      currentNode = walker.nextNode();
    }

    // If no text nodes (empty paragraph with <br> or atom block)
    if (textNodes.length === 0) {
      try {
        const pos = view.posAtDOM(blockEl, 0);
        const rect = blockEl.getBoundingClientRect();
        if (rect.height > 0) {
          lines.push({
            pageIndex,
            rect,
            top: rect.top,
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
            centerY: (rect.top + rect.bottom) / 2,
            blockElement: blockEl,
            startPos: pos,
            endPos: pos,
          });
        }
      } catch {
        // ignore
      }
      return lines;
    }

    interface CharInfo {
      pos: number;
      top: number;
      bottom: number;
      left: number;
      right: number;
    }

    const charInfos: CharInfo[] = [];
    const range = document.createRange();

    for (const textNode of textNodes) {
      const textLen = textNode.nodeValue?.length || 0;
      if (textLen === 0) continue;

      for (let i = 0; i < textLen; i++) {
        try {
          range.setStart(textNode, i);
          range.setEnd(textNode, i + 1);
          const rects = range.getClientRects();
          if (rects.length > 0) {
            const r = rects[0];
            if (r.height > 0) {
              const pmPos = view.posAtDOM(textNode, i);
              charInfos.push({
                pos: pmPos,
                top: r.top,
                bottom: r.bottom,
                left: r.left,
                right: r.right,
              });
            }
          }
        } catch {
          // ignore character range errors
        }
      }
    }

    if (charInfos.length === 0) {
      try {
        const pos = view.posAtDOM(blockEl, 0);
        const rect = blockEl.getBoundingClientRect();
        lines.push({
          pageIndex,
          rect,
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          centerY: (rect.top + rect.bottom) / 2,
          blockElement: blockEl,
          startPos: pos,
          endPos: pos,
        });
      } catch {
        // ignore
      }
      return lines;
    }

    // Cluster charInfos into visual lines based on vertical alignment
    let currentLineChars: CharInfo[] = [charInfos[0]];
    let currentLineTop = charInfos[0].top;
    let currentLineBottom = charInfos[0].bottom;

    for (let i = 1; i < charInfos.length; i++) {
      const char = charInfos[i];
      const isSameLine =
        Math.abs(char.top - currentLineTop) < 6 ||
        (char.top < currentLineBottom - 4 && char.bottom > currentLineTop + 4);

      if (isSameLine) {
        currentLineChars.push(char);
        currentLineTop = Math.min(currentLineTop, char.top);
        currentLineBottom = Math.max(currentLineBottom, char.bottom);
      } else {
        const firstChar = currentLineChars[0];
        const lastChar = currentLineChars[currentLineChars.length - 1];
        const minLeft = Math.min(...currentLineChars.map((c) => c.left));
        const maxRight = Math.max(...currentLineChars.map((c) => c.right));

        const lineRect = new DOMRect(
          minLeft,
          currentLineTop,
          maxRight - minLeft,
          currentLineBottom - currentLineTop
        );

        lines.push({
          pageIndex,
          rect: lineRect,
          top: currentLineTop,
          bottom: currentLineBottom,
          left: minLeft,
          right: maxRight,
          centerY: (currentLineTop + currentLineBottom) / 2,
          blockElement: blockEl,
          startPos: firstChar.pos,
          endPos: lastChar.pos + 1,
        });

        currentLineChars = [char];
        currentLineTop = char.top;
        currentLineBottom = char.bottom;
      }
    }

    if (currentLineChars.length > 0) {
      const firstChar = currentLineChars[0];
      const lastChar = currentLineChars[currentLineChars.length - 1];
      const minLeft = Math.min(...currentLineChars.map((c) => c.left));
      const maxRight = Math.max(...currentLineChars.map((c) => c.right));

      const lineRect = new DOMRect(
        minLeft,
        currentLineTop,
        maxRight - minLeft,
        currentLineBottom - currentLineTop
      );

      lines.push({
        pageIndex,
        rect: lineRect,
        top: currentLineTop,
        bottom: currentLineBottom,
        left: minLeft,
        right: maxRight,
        centerY: (currentLineTop + currentLineBottom) / 2,
        blockElement: blockEl,
        startPos: firstChar.pos,
        endPos: lastChar.pos + 1,
      });
    }

    return lines;
  }

  /**
   * Find the VisualLine that currently contains the caret
   */
  public static findCurrentVisualLineIndex(
    view: any,
    visualLines: VisualLine[],
    head: number,
    coords: { top: number; bottom: number; left: number; right: number }
  ): number {
    if (visualLines.length === 0) return -1;

    // 1. First priority: match by document position range
    const matchingIndices: number[] = [];
    for (let i = 0; i < visualLines.length; i++) {
      const line = visualLines[i];
      if (head >= line.startPos && head <= line.endPos) {
        matchingIndices.push(i);
      }
    }

    if (matchingIndices.length === 1) {
      return matchingIndices[0];
    }

    const caretCenterY = (coords.top + coords.bottom) / 2;

    if (matchingIndices.length > 1) {
      let closestIdx = matchingIndices[0];
      let minDiff = Infinity;
      for (const idx of matchingIndices) {
        const line = visualLines[idx];
        const diff = Math.abs(line.centerY - caretCenterY);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = idx;
        }
      }
      return closestIdx;
    }

    // 2. Fallback: closest by vertical coordinates
    let closestIdx = 0;
    let minDiff = Infinity;
    for (let i = 0; i < visualLines.length; i++) {
      const line = visualLines[i];
      const diff = Math.abs(line.centerY - caretCenterY);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }

    return closestIdx;
  }

  /**
   * Find the best matching ProseMirror document position on a target VisualLine
   * that preserves horizontal caret alignment (X coordinate)
   */
  public static findBestPosOnVisualLine(
    view: any,
    targetLine: VisualLine,
    targetX: number
  ): number {
    if (targetLine.startPos >= targetLine.endPos) {
      return targetLine.startPos;
    }

    let bestPos = targetLine.startPos;
    let minDiff = Infinity;

    for (let p = targetLine.startPos; p <= targetLine.endPos; p++) {
      try {
        const coords = view.coordsAtPos(p);
        if (coords) {
          const diff = Math.abs(coords.left - targetX);
          if (diff < minDiff) {
            minDiff = diff;
            bestPos = p;
          }
        }
      } catch {
        // ignore
      }
    }

    return bestPos;
  }

  /**
   * Handle keyboard navigation (ArrowDown / ArrowUp) across Page boundaries in Paged Mode.
   * Intercepts ONLY when crossing pages; intra-page navigation is handled natively by ProseMirror.
   */
  public static handlePagedKeyDown(
    view: any,
    event: KeyboardEvent,
    wrapperEl: HTMLElement | null,
    margin: 'normal' | 'narrow' | 'wide' = 'normal',
    scale: number = 1
  ): boolean {
    if (!view || !wrapperEl) return false;
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return false;

    const { state } = view;
    const { selection } = state;
    const head = selection.head;

    try {
      const cursorCoords = view.coordsAtPos(head);
      if (!cursorCoords) return false;

      // 1. Scan all real visual lines in document
      const visualLines = this.getVisualLines(view, wrapperEl);
      if (visualLines.length === 0) return false;

      // 2. Identify current visual line
      const currentLineIdx = this.findCurrentVisualLineIndex(view, visualLines, head, cursorCoords);
      if (currentLineIdx < 0) return false;

      const currentLine = visualLines[currentLineIdx];
      const currentPageIndex = currentLine.pageIndex;
      const currentX = cursorCoords.left;

      if (event.key === 'ArrowDown') {
        const nextLineIdx = currentLineIdx + 1;
        if (nextLineIdx >= visualLines.length) {
          // Reached end of document; let native behavior handle
          return false;
        }

        const nextLine = visualLines[nextLineIdx];

        // Intra-page movement: let native ProseMirror handle smoothly
        if (nextLine.pageIndex === currentPageIndex) {
          return false;
        }

        // Cross-page movement: jump directly to the first visual line of the next page
        const targetPos = this.findBestPosOnVisualLine(view, nextLine, currentX);
        if (targetPos != null && (targetPos !== head || event.shiftKey)) {
          event.preventDefault();
          event.stopPropagation();

          const newSelection = event.shiftKey
            ? TextSelection.create(state.doc, selection.anchor, targetPos)
            : TextSelection.create(state.doc, targetPos);

          view.dispatch(state.tr.setSelection(newSelection).scrollIntoView());
          view.focus();
          return true;
        }
      } else if (event.key === 'ArrowUp') {
        const prevLineIdx = currentLineIdx - 1;
        if (prevLineIdx < 0) {
          // Reached start of document; let native behavior handle
          return false;
        }

        const prevLine = visualLines[prevLineIdx];

        // Intra-page movement: let native ProseMirror handle smoothly
        if (prevLine.pageIndex === currentPageIndex) {
          return false;
        }

        // Cross-page movement: jump directly to the last visual line of the previous page
        const targetPos = this.findBestPosOnVisualLine(view, prevLine, currentX);
        if (targetPos != null && (targetPos !== head || event.shiftKey)) {
          event.preventDefault();
          event.stopPropagation();

          const newSelection = event.shiftKey
            ? TextSelection.create(state.doc, selection.anchor, targetPos)
            : TextSelection.create(state.doc, targetPos);

          view.dispatch(state.tr.setSelection(newSelection).scrollIntoView());
          view.focus();
          return true;
        }
      }
    } catch (err) {
      console.warn('Paged KeyDown VisualLine Navigation caught error:', err);
    }

    return false;
  }

  /**
   * Estimate the rendered pixel height of a single StructuredDocNode
   */
  public static estimateBlockHeight(
    node: StructuredDocNode,
    usableWidth: number = 630
  ): number {
    if (!node) return 0;

    switch (node.type) {
      case 'page-break':
        return 0; // Handled specially as a hard page split trigger

      case 'divider':
        return 32; // 1px line + 30px spacing

      case 'heading': {
        const level = node.level || 1;
        const totalText = (node.runs || []).map((r) => r.text).join('');
        const fontSizePt = level === 1 ? 22 : level === 2 ? 18 : level === 3 ? 15 : 13;
        const fontSizePx = Math.round(fontSizePt * 1.33);
        const charsPerLine = Math.max(10, Math.floor(usableWidth / (fontSizePx * 0.95)));
        const numLines = Math.max(1, Math.ceil(totalText.length / charsPerLine));
        const lineHeight = Math.round(fontSizePx * 1.4);
        const marginSpacing = level === 1 ? 36 : level === 2 ? 28 : 20;
        return numLines * lineHeight + marginSpacing;
      }

      case 'paragraph': {
        const totalText = (node.runs || []).map((r) => r.text).join('');
        if (!totalText || totalText.trim().length === 0) {
          return 26; // Empty paragraph spacing (1 line)
        }
        // Approximate average font size from runs
        let maxFontSizePt = 12;
        (node.runs || []).forEach((r) => {
          if (r.size && r.size > maxFontSizePt) maxFontSizePt = r.size;
        });
        const fontSizePx = Math.round(maxFontSizePt * 1.33);
        const charsPerLine = Math.max(15, Math.floor(usableWidth / (fontSizePx * 0.9)));
        const numLines = Math.max(1, Math.ceil(totalText.length / charsPerLine));
        const lineHeight = Math.round(fontSizePx * 1.6);
        const spacingAfter = node.spacing?.after ? Math.round(node.spacing.after * 1.33) : 8;
        return numLines * lineHeight + spacingAfter;
      }

      case 'bullet':
      case 'ordered': {
        const totalText = (node.runs || []).map((r) => r.text).join('');
        const charsPerLine = Math.max(15, Math.floor((usableWidth - 30) / 14));
        const numLines = Math.max(1, Math.ceil(totalText.length / charsPerLine));
        return numLines * 24 + 6;
      }

      case 'quote': {
        const totalText = (node.runs || []).map((r) => r.text).join('');
        const charsPerLine = Math.max(15, Math.floor((usableWidth - 40) / 14));
        const numLines = Math.max(1, Math.ceil(totalText.length / charsPerLine));
        return numLines * 26 + 24;
      }

      case 'code': {
        const totalText = (node.runs || []).map((r) => r.text).join('');
        const lines = totalText.split('\n');
        return Math.max(1, lines.length) * 22 + 28;
      }

      case 'image': {
        if (node.imageData?.height) {
          return Math.min(node.imageData.height, 500) + 20;
        }
        return 260; // Default image height + padding
      }

      case 'table': {
        if (node.tableData && Array.isArray(node.tableData.rows)) {
          let totalTableHeight = 12; // Outer margin/padding
          node.tableData.rows.forEach((row, rIdx) => {
            let maxCellLines = 1;
            row.forEach((cell) => {
              const textLen = (cell.text || '').length;
              const approxLines = Math.max(1, Math.ceil(textLen / 20));
              if (approxLines > maxCellLines) maxCellLines = approxLines;
            });
            const rowHeight = Math.max(34, maxCellLines * 22 + 12);
            totalTableHeight += rowHeight;
          });
          return totalTableHeight;
        }
        return 120;
      }

      default:
        return 30;
    }
  }

  /**
   * Partition an array of StructuredDocNode into discrete PageLayout containers
   */
  public static paginate(
    nodes: StructuredDocNode[],
    options: PageLayoutOptions = {}
  ): PageLayout[] {
    const margin = options.margin || 'normal';
    const usableHeight = options.customPageHeightPx || this.getUsablePageHeight(margin);
    const usableWidth = options.customPageWidthPx || this.getUsablePageWidth(margin);

    if (!nodes || nodes.length === 0) {
      return [
        {
          pageIndex: 0,
          pageNumber: 1,
          blocks: [{ type: 'paragraph', runs: [{ text: '' }] }],
          usedHeight: 26,
          maxHeight: usableHeight,
        },
      ];
    }

    const pages: PageLayout[] = [];
    let currentBlocks: StructuredDocNode[] = [];
    let currentHeight = 0;
    let pageIndex = 0;
    const MAX_SAFE_PAGES = 50;

    const finalizeCurrentPage = (hasExplicitBreak = false) => {
      pages.push({
        pageIndex,
        pageNumber: pageIndex + 1,
        blocks: currentBlocks.length > 0 ? currentBlocks : [{ type: 'paragraph', runs: [{ text: '' }] }],
        usedHeight: currentHeight,
        maxHeight: usableHeight,
        hasExplicitPageBreak: hasExplicitBreak,
      });
      pageIndex++;
      currentBlocks = [];
      currentHeight = 0;
    };

    for (let i = 0; i < nodes.length; i++) {
      if (pageIndex >= MAX_SAFE_PAGES) {
        // Safety circuit breaker: append remaining nodes to current page
        currentBlocks.push(...nodes.slice(i));
        break;
      }
      const node = nodes[i];

      // 1. Explicit Page Break: Immediately close current page and move to next
      if (node.type === 'page-break') {
        finalizeCurrentPage(true);
        continue;
      }

      const blockHeight = this.estimateBlockHeight(node, usableWidth);

      // 2. If single block exceeds entire page capacity (e.g. gigantic table or massive image)
      if (blockHeight > usableHeight) {
        if (currentBlocks.length > 0) {
          finalizeCurrentPage(false);
        }
        currentBlocks.push(node);
        currentHeight += blockHeight;
        finalizeCurrentPage(false);
        continue;
      }

      // 3. Overflow check: Does adding this block exceed usable page height?
      if (currentHeight + blockHeight > usableHeight && currentBlocks.length > 0) {
        finalizeCurrentPage(false);
        currentBlocks.push(node);
        currentHeight += blockHeight;
      } else {
        currentBlocks.push(node);
        currentHeight += blockHeight;
      }
    }

    // Push final remaining page
    if (currentBlocks.length > 0 || pages.length === 0) {
      finalizeCurrentPage(false);
    }

    return pages;
  }
}
