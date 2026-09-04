import * as pdfjsLib from 'pdfjs-dist';

export interface ExtractedPdfTextItem {
  id: string;
  pageIndex: number;
  text: string;
  x: number; // percentage (0-100) of page display width
  y: number; // percentage (0-100) of page display height
  width: number; // percentage (0-100)
  height: number; // percentage (0-100)
  fontSize: number; // in pt / px
  fontFamily: string;
  color: string;
  rotation: number;
  isOriginalReplacement?: boolean;
}

/**
 * Extract native text items from a PDF.js page and convert coordinates into
 * standard 0-100% viewport space with line-level grouping.
 */
export async function extractPdfPageTextItems(
  pdfJsDoc: pdfjsLib.PDFDocumentProxy,
  pageIndex: number,
  rotation: number = 0
): Promise<ExtractedPdfTextItem[]> {
  try {
    if (!pdfJsDoc || !pdfJsDoc.numPages || pageIndex < 0 || pageIndex >= pdfJsDoc.numPages) {
      return [];
    }

    const pageNum = pageIndex + 1;
    const page = await pdfJsDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1, rotation });

    if (!textContent || !textContent.items || textContent.items.length === 0) {
      return [];
    }

    const rawItems: {
      str: string;
      x: number;
      y: number;
      width: number;
      height: number;
      fontSize: number;
      fontName: string;
      rotation: number;
    }[] = [];

    for (let i = 0; i < textContent.items.length; i++) {
      const item: any = textContent.items[i];
      if (!('str' in item)) continue;
      const str = item.str;
      if (!str || str.length === 0) continue;

      const tx = item.transform || [1, 0, 0, 1, 0, 0];
      const itemWidth = item.width || 20;
      const itemHeight = item.height || Math.abs(tx[0]) || 12;

      // In PDF coordinate space, (tx[4], tx[5]) is the baseline point.
      // The bounding box in PDF points is [tx[4], tx[5] - itemHeight * 0.2, tx[4] + itemWidth, tx[5] + itemHeight * 0.8]
      const pdfX1 = tx[4];
      const pdfY1 = tx[5] - itemHeight * 0.2;
      const pdfX2 = tx[4] + itemWidth;
      const pdfY2 = tx[5] + itemHeight * 0.8;

      // Convert PDF coordinate box to viewport CSS coordinates
      let vx1: number, vy1: number, vx2: number, vy2: number;
      try {
        const pt1 = (viewport as any).convertToViewportPoint ? (viewport as any).convertToViewportPoint(pdfX1, pdfY2) : [pdfX1, viewport.height - pdfY2];
        const pt2 = (viewport as any).convertToViewportPoint ? (viewport as any).convertToViewportPoint(pdfX2, pdfY1) : [pdfX2, viewport.height - pdfY1];
        vx1 = Math.min(pt1[0], pt2[0]);
        vy1 = Math.min(pt1[1], pt2[1]);
        vx2 = Math.max(pt1[0], pt2[0]);
        vy2 = Math.max(pt1[1], pt2[1]);
      } catch {
        // Fallback standard math if convertToViewportPoint fails
        vx1 = (tx[4] / viewport.width) * viewport.width;
        vy1 = (1 - tx[5] / viewport.height) * viewport.height;
        vx2 = vx1 + itemWidth;
        vy2 = vy1 + itemHeight;
      }

      const itemW = Math.max(vx2 - vx1, 4);
      const itemH = Math.max(vy2 - vy1, 8);

      // Percentage relative to page viewport
      const xPct = (vx1 / viewport.width) * 100;
      const yPct = (vy1 / viewport.height) * 100;
      const wPct = (itemW / viewport.width) * 100;
      const hPct = (itemH / viewport.height) * 100;

      const angle = Math.round(Math.atan2(tx[1], tx[0]) * (180 / Math.PI));

      rawItems.push({
        str,
        x: Math.max(0, Math.min(100, xPct)),
        y: Math.max(0, Math.min(100, yPct)),
        width: Math.max(0.5, Math.min(100, wPct)),
        height: Math.max(0.5, Math.min(100, hPct)),
        fontSize: Math.round(itemHeight * 10) / 10 || 14,
        fontName: item.fontName || 'Helvetica, Arial, sans-serif',
        rotation: angle,
      });
    }

    if (rawItems.length === 0) return [];

    // Group adjacent items on the same line into coherent text runs
    const mergedItems: ExtractedPdfTextItem[] = [];
    let currentBlock: ExtractedPdfTextItem | null = null;

    for (let i = 0; i < rawItems.length; i++) {
      const item = rawItems[i];
      if (!item.str.trim() && !currentBlock) continue;

      if (!currentBlock) {
        currentBlock = {
          id: `orig-txt-${pageIndex}-${mergedItems.length}`,
          pageIndex,
          text: item.str,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          fontSize: item.fontSize,
          fontFamily: item.fontName,
          color: '#000000',
          rotation: item.rotation,
          isOriginalReplacement: false,
        };
      } else {
        // Check if item is on the same line (close Y) and follows currentBlock horizontally
        const isSameLine = Math.abs(item.y - currentBlock.y) < 0.7; // ~0.7% Y threshold
        const isHorizontalNext = item.x >= currentBlock.x - 0.2 && item.x <= currentBlock.x + currentBlock.width + 2.5;
        const isSameFont = Math.abs(item.fontSize - currentBlock.fontSize) <= 2;

        if (isSameLine && isHorizontalNext && isSameFont) {
          // Merge into currentBlock
          const nextRight = Math.max(currentBlock.x + currentBlock.width, item.x + item.width);
          currentBlock.width = nextRight - currentBlock.x;
          currentBlock.height = Math.max(currentBlock.height, item.height);
          // If spacing exists between items, ensure space is preserved
          if (item.x > currentBlock.x + currentBlock.width - 0.5 && !currentBlock.text.endsWith(' ') && !item.str.startsWith(' ')) {
            currentBlock.text += item.str;
          } else {
            currentBlock.text += item.str;
          }
        } else {
          // Commit currentBlock and start a new one
          if (currentBlock.text.trim()) {
            mergedItems.push(currentBlock);
          }
          currentBlock = {
            id: `orig-txt-${pageIndex}-${mergedItems.length}`,
            pageIndex,
            text: item.str,
            x: item.x,
            y: item.y,
            width: item.width,
            height: item.height,
            fontSize: item.fontSize,
            fontFamily: item.fontName,
            color: '#000000',
            rotation: item.rotation,
            isOriginalReplacement: false,
          };
        }
      }
    }

    if (currentBlock && currentBlock.text.trim()) {
      mergedItems.push(currentBlock);
    }

    return mergedItems;
  } catch (err) {
    console.warn(`Error extracting text items from page ${pageIndex}:`, err);
    return [];
  }
}
