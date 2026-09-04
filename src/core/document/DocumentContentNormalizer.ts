/**
 * DocumentContentNormalizer.ts
 * 
 * Unified Normalizer for Lumina Office Document Content.
 * Ensures that any input (raw HTML, JSON wrapped objects, DocumentModel, Tiptap JSON, or serialized strings)
 * is cleanly and deterministically unpacked into pure, valid HTML or CSV for the LibreOffice Native Engine.
 * 
 * Strict Constraint:
 * NO JSON-wrapped objects or stringified JSON objects may ever enter the LibreOffice rendering pipeline.
 */

export interface NormalizedDocumentOutput {
  format: 'html' | 'csv' | 'raw';
  cleanContent: string;
  originalType: string;
  charCount: number;
  snippet: string;
  pageEstimate: number;
  blockCount: number;
}

export class DocumentContentNormalizer {
  /**
   * Recursively extract raw HTML or text content from any unknown payload.
   */
  public static extractHtmlString(input: any): string {
    if (input === null || input === undefined) {
      return '<p></p>';
    }

    // Binary Guard: Never normalize PDF binary into HTML
    if (input instanceof Uint8Array || input instanceof ArrayBuffer) {
      const u8 = input instanceof Uint8Array ? input : new Uint8Array(input);
      if (u8.length >= 4 && u8[0] === 0x25 && u8[1] === 0x50 && u8[2] === 0x44 && u8[3] === 0x46) {
        throw new Error('PDF_ENGINE_ERROR: Native PDF binary data must not be passed into DocumentContentNormalizer. Use PdfExportService instead.');
      }
      try {
        const decoded = new TextDecoder('utf-8').decode(u8);
        return DocumentContentNormalizer.extractHtmlString(decoded);
      } catch {
        return '<p></p>';
      }
    }

    // 1. If string
    if (typeof input === 'string') {
      const trimmed = input.trim();
      if (!trimmed) {
        return '<p></p>';
      }

      // Check if it's a JSON string representing a wrapped object or AST
      if (
        (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))
      ) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed && typeof parsed === 'object') {
            return DocumentContentNormalizer.extractHtmlString(parsed);
          }
        } catch {
          // Not valid JSON, treat as raw HTML / text
        }
      }

      // If it looks like plain text without any HTML tags, wrap in paragraphs
      if (!trimmed.includes('<') && !trimmed.includes('>')) {
        const paragraphs = trimmed.split('\n\n').filter(Boolean);
        if (paragraphs.length > 0) {
          return paragraphs.map((p) => `<p>${escapeXml(p.trim())}</p>`).join('');
        }
      }

      return trimmed;
    }

    // 2. If array of StructuredDocNodes / blocks
    if (Array.isArray(input)) {
      return DocumentContentNormalizer.renderStructuredNodesToHtml(input);
    }

    // 3. If DocumentModel or object with nodes / blocks
    if (Array.isArray(input.nodes)) {
      return DocumentContentNormalizer.renderStructuredNodesToHtml(input.nodes);
    }
    if (Array.isArray(input.blocks)) {
      return DocumentContentNormalizer.renderStructuredNodesToHtml(input.blocks);
    }

    // 4. If object with document property
    if (input.document && typeof input.document === 'object') {
      return DocumentContentNormalizer.extractHtmlString(input.document);
    }

    // 5. Direct HTML properties
    if (typeof input.htmlContent === 'string') {
      return DocumentContentNormalizer.extractHtmlString(input.htmlContent);
    }
    if (typeof input.content === 'string') {
      return DocumentContentNormalizer.extractHtmlString(input.content);
    }
    if (typeof input.html === 'string') {
      return DocumentContentNormalizer.extractHtmlString(input.html);
    }
    if (typeof input.body === 'string') {
      return DocumentContentNormalizer.extractHtmlString(input.body);
    }
    if (typeof input.text === 'string') {
      return DocumentContentNormalizer.extractHtmlString(input.text);
    }

    // 6. Nested content object: { content: { ... } } or Tiptap AST
    if (input.content && typeof input.content === 'object') {
      if (Array.isArray(input.content)) {
        return DocumentContentNormalizer.renderTiptapNodesToHtml(input.content);
      }
      return DocumentContentNormalizer.extractHtmlString(input.content);
    }

    // 7. Tiptap Doc root: { type: 'doc', content: [...] }
    if (input.type === 'doc' && Array.isArray(input.content)) {
      return DocumentContentNormalizer.renderTiptapNodesToHtml(input.content);
    }

    // 8. Fallback: string representation
    const fallbackStr = String(input).trim();
    if (fallbackStr && fallbackStr !== '[object Object]') {
      return `<p>${escapeXml(fallbackStr)}</p>`;
    }
    return '<p></p>';
  }

  /**
   * Convert StructuredDocNode[] (AST) to complete, rich HTML
   */
  public static renderStructuredNodesToHtml(nodes: any[]): string {
    if (!Array.isArray(nodes) || nodes.length === 0) {
      return '<p></p>';
    }

    return nodes
      .map((node) => {
        if (!node) return '';

        // Heading
        if (node.type === 'heading') {
          const level = node.level || 1;
          const inner = node.runs ? DocumentContentNormalizer.renderRunsToHtml(node.runs) : escapeXml(node.text || '');
          const alignStyle = node.align ? ` style="text-align: ${node.align};"` : '';
          return `<h${level}${alignStyle}>${inner || '&nbsp;'}</h${level}>`;
        }

        // Paragraph
        if (node.type === 'paragraph') {
          const inner = node.runs ? DocumentContentNormalizer.renderRunsToHtml(node.runs) : escapeXml(node.text || '');
          const alignStyle = node.align ? ` style="text-align: ${node.align};"` : '';
          return `<p${alignStyle}>${inner || '&nbsp;'}</p>`;
        }

        // Table
        if (node.type === 'table' && node.table) {
          const rows = node.table.rows || [];
          let tableHtml = '<table border="1" style="width: 100%; border-collapse: collapse; margin: 16px 0;"><tbody>';
          for (let rIdx = 0; rIdx < rows.length; rIdx++) {
            const row = rows[rIdx];
            const isHeaderRow = rIdx === 0 && row.isHeader;
            tableHtml += '<tr>';
            for (const cell of (row.cells || [])) {
              const tag = isHeaderRow ? 'th' : 'td';
              const bgStyle = cell.backgroundColor ? ` background-color: ${cell.backgroundColor};` : (isHeaderRow ? ' background-color: #f1f5f9;' : '');
              const boldStyle = cell.bold ? ' font-weight: 600;' : '';
              const alignStyle = cell.align ? ` text-align: ${cell.align};` : '';
              const borderStyle = ' border: 1px solid #cbd5e1; padding: 8px 12px;';
              const innerText = cell.runs ? DocumentContentNormalizer.renderRunsToHtml(cell.runs) : escapeXml(cell.text || cell.value || '');
              tableHtml += `<${tag} style="${borderStyle}${bgStyle}${boldStyle}${alignStyle}">${innerText || '&nbsp;'}</${tag}>`;
            }
            tableHtml += '</tr>';
          }
          tableHtml += '</tbody></table>';
          return tableHtml;
        }

        // Image
        if (node.type === 'image') {
          const src = node.imageUrl || node.src || node.url || '';
          if (!src) return '';
          const w = node.width ? ` width="${node.width}"` : '';
          const h = node.height ? ` height="${node.height}"` : '';
          const alt = node.caption ? ` alt="${escapeXml(node.caption)}"` : ' alt="image"';
          const align = node.align || 'center';
          return `<p style="text-align: ${align}; margin: 16px 0;"><img src="${src}"${w}${h}${alt} style="max-width: 100%; height: auto; display: inline-block;" /></p>`;
        }

        // Page Break (LibreOffice Native Compatible)
        if (node.type === 'pageBreak') {
          return '<div style="page-break-before: always; break-before: page; clear: both;"><p style="page-break-before: always; margin: 0; line-height: 0.1pt;">&nbsp;</p></div>';
        }

        // Divider
        if (node.type === 'divider' || node.type === 'horizontalRule') {
          return '<hr style="border: 0; border-top: 1px solid #cbd5e1; margin: 18px 0;" />';
        }

        // Callout / Blockquote
        if (node.type === 'callout' || node.type === 'blockquote') {
          const inner = node.runs ? DocumentContentNormalizer.renderRunsToHtml(node.runs) : escapeXml(node.text || '');
          return `<blockquote style="margin: 12pt 0; padding: 8pt 16pt; border-left: 4px solid #3b82f6; background-color: #f8fafc; color: #475569;">${inner}</blockquote>`;
        }

        // List
        if (node.type === 'list') {
          const listTag = node.listType === 'ordered' ? 'ol' : 'ul';
          const items = (node.items || []).map((it: any) => {
            const itText = typeof it === 'string' ? escapeXml(it) : (it.runs ? DocumentContentNormalizer.renderRunsToHtml(it.runs) : escapeXml(it.text || ''));
            return `<li style="margin-bottom: 4px;">${itText}</li>`;
          }).join('');
          return `<${listTag} style="margin: 10pt 0 10pt 20pt;">${items}</${listTag}>`;
        }

        // Code
        if (node.type === 'code') {
          return `<pre style="background-color: #f1f5f9; padding: 12px; border-radius: 4px; font-family: monospace; font-size: 10pt; overflow-x: auto;"><code>${escapeXml(node.code || node.text || '')}</code></pre>`;
        }

        // Fallback
        if (node.text) {
          return `<p>${escapeXml(node.text)}</p>`;
        }
        return '';
      })
      .join('');
  }

  /**
   * Render formatted runs to HTML
   */
  private static renderRunsToHtml(runs: any[]): string {
    if (!Array.isArray(runs)) return '';
    return runs
      .map((r) => {
        if (!r) return '';
        let text = escapeXml(r.text || '');
        if (!text) return '';

        let style = '';
        if (r.color) style += `color: ${r.color};`;
        if (r.fontSize) style += `font-size: ${r.fontSize}pt;`;
        if (r.fontFamily) style += `font-family: ${r.fontFamily};`;
        if (r.highlight) style += `background-color: ${r.highlight};`;

        if (style) {
          text = `<span style="${style}">${text}</span>`;
        }
        if (r.bold) text = `<strong>${text}</strong>`;
        if (r.italic) text = `<em>${text}</em>`;
        if (r.underline) text = `<u>${text}</u>`;
        if (r.strike) text = `<s>${text}</s>`;
        return text;
      })
      .join('');
  }

  /**
   * Robust converter from Tiptap / ProseMirror JSON AST to HTML
   */
  public static renderTiptapNodesToHtml(nodes: any[]): string {
    if (!Array.isArray(nodes)) return '';
    return nodes
      .map((node) => {
        if (!node) return '';

        // Paragraph
        if (node.type === 'paragraph') {
          const inner = node.content ? DocumentContentNormalizer.renderTiptapNodesToHtml(node.content) : '<br/>';
          const align = node.attrs?.textAlign ? ` style="text-align: ${node.attrs.textAlign};"` : '';
          return `<p${align}>${inner}</p>`;
        }

        // Heading
        if (node.type === 'heading') {
          const level = node.attrs?.level || 1;
          const inner = node.content ? DocumentContentNormalizer.renderTiptapNodesToHtml(node.content) : '';
          const align = node.attrs?.textAlign ? ` style="text-align: ${node.attrs.textAlign};"` : '';
          return `<h${level}${align}>${inner}</h${level}>`;
        }

        // Text with marks
        if (node.type === 'text') {
          let text = escapeXml(node.text || '');
          if (node.marks && Array.isArray(node.marks)) {
            for (const mark of node.marks) {
              if (mark.type === 'bold') text = `<strong>${text}</strong>`;
              if (mark.type === 'italic') text = `<em>${text}</em>`;
              if (mark.type === 'underline') text = `<u>${text}</u>`;
              if (mark.type === 'strike') text = `<s>${text}</s>`;
              if (mark.type === 'textStyle') {
                const color = mark.attrs?.color;
                const fontSize = mark.attrs?.fontSize;
                const fontFamily = mark.attrs?.fontFamily;
                let s = '';
                if (color) s += `color: ${color};`;
                if (fontSize) s += `font-size: ${fontSize};`;
                if (fontFamily) s += `font-family: ${fontFamily};`;
                if (s) text = `<span style="${s}">${text}</span>`;
              }
              if (mark.type === 'highlight') {
                const color = mark.attrs?.color || '#fef08a';
                text = `<span style="background-color: ${color};">${text}</span>`;
              }
              if (mark.type === 'link' && mark.attrs?.href) {
                text = `<a href="${escapeXml(mark.attrs.href)}">${text}</a>`;
              }
            }
          }
          return text;
        }

        // Table
        if (node.type === 'table') {
          const inner = node.content ? DocumentContentNormalizer.renderTiptapNodesToHtml(node.content) : '';
          return `<table border="1" style="width: 100%; border-collapse: collapse; margin: 16px 0;"><tbody>${inner}</tbody></table>`;
        }
        if (node.type === 'tableRow') {
          const inner = node.content ? DocumentContentNormalizer.renderTiptapNodesToHtml(node.content) : '';
          return `<tr>${inner}</tr>`;
        }
        if (node.type === 'tableCell') {
          const inner = node.content ? DocumentContentNormalizer.renderTiptapNodesToHtml(node.content) : '&nbsp;';
          return `<td style="border: 1px solid #cbd5e1; padding: 8px 12px; vertical-align: middle;">${inner}</td>`;
        }
        if (node.type === 'tableHeader') {
          const inner = node.content ? DocumentContentNormalizer.renderTiptapNodesToHtml(node.content) : '&nbsp;';
          return `<th style="border: 1px solid #cbd5e1; padding: 8px 12px; background-color: #f1f5f9; font-weight: 600; text-align: left; vertical-align: middle;">${inner}</th>`;
        }

        // Image
        if (node.type === 'image') {
          const src = node.attrs?.src || '';
          if (!src) return '';
          const alt = escapeXml(node.attrs?.alt || 'image');
          const title = node.attrs?.title ? ` title="${escapeXml(node.attrs.title)}"` : '';
          return `<p style="text-align: center; margin: 16px 0;"><img src="${src}" alt="${alt}"${title} style="max-width: 100%; height: auto; display: inline-block;" /></p>`;
        }

        // Lists
        if (node.type === 'bulletList') {
          const inner = node.content ? DocumentContentNormalizer.renderTiptapNodesToHtml(node.content) : '';
          return `<ul style="margin: 10pt 0 10pt 20pt;">${inner}</ul>`;
        }
        if (node.type === 'orderedList') {
          const inner = node.content ? DocumentContentNormalizer.renderTiptapNodesToHtml(node.content) : '';
          return `<ol style="margin: 10pt 0 10pt 20pt;">${inner}</ol>`;
        }
        if (node.type === 'listItem') {
          const inner = node.content ? DocumentContentNormalizer.renderTiptapNodesToHtml(node.content) : '';
          return `<li style="margin-bottom: 4px;">${inner}</li>`;
        }

        // Horizontal Rule / Divider
        if (node.type === 'horizontalRule') {
          return '<hr style="border: 0; border-top: 1px solid #cbd5e1; margin: 18px 0;" />';
        }

        // Page break
        if (node.type === 'pageBreak') {
          return '<div style="page-break-before: always; break-before: page; clear: both;"><p style="page-break-before: always; margin: 0; line-height: 0.1pt;">&nbsp;</p></div>';
        }

        // Blockquote
        if (node.type === 'blockquote') {
          const inner = node.content ? DocumentContentNormalizer.renderTiptapNodesToHtml(node.content) : '';
          return `<blockquote style="margin: 12pt 0; padding: 8pt 16pt; border-left: 4px solid #3b82f6; background-color: #f8fafc; color: #475569;">${inner}</blockquote>`;
        }

        // Code block
        if (node.type === 'codeBlock') {
          const inner = node.content ? DocumentContentNormalizer.renderTiptapNodesToHtml(node.content) : '';
          return `<pre style="background-color: #f1f5f9; padding: 12px; border-radius: 4px; font-family: monospace; font-size: 10pt; overflow-x: auto;"><code>${inner}</code></pre>`;
        }

        // Hard break
        if (node.type === 'hardBreak') {
          return '<br/>';
        }

        // Fallback for nested children
        if (node.content && Array.isArray(node.content)) {
          return DocumentContentNormalizer.renderTiptapNodesToHtml(node.content);
        }

        return '';
      })
      .join('');
  }

  /**
   * Convert sheet data model (WorkbookData or Sheet cells) to clean CSV string
   */
  public static extractSheetCsvString(input: any): string {
    if (typeof input === 'string') {
      return input;
    }

    if (!input || typeof input !== 'object') {
      return '';
    }

    // If it has sheets array
    const sheets = Array.isArray(input.sheets) ? input.sheets : [input];
    const activeSheet =
      sheets.find((s: any) => s.id === input.activeSheetId) || sheets[0] || {};
    const cells = activeSheet.cells || activeSheet.data || {};

    let maxR = 20;
    let maxC = 10;

    Object.keys(cells).forEach((key) => {
      // Handles both "r,c" and "r:c"
      const parts = key.includes(',') ? key.split(',') : key.split(':');
      const r = parseInt(parts[0], 10);
      const c = parseInt(parts[1], 10);
      if (!isNaN(r) && r > maxR) maxR = r;
      if (!isNaN(c) && c > maxC) maxC = c;
    });

    const rows: string[] = [];
    for (let r = 0; r <= maxR; r++) {
      const rowCells: string[] = [];
      for (let c = 0; c <= maxC; c++) {
        const cell = cells[`${r},${c}`] || cells[`${r}:${c}`];
        const rawVal = cell?.value ?? '';
        const valStr = String(rawVal).replace(/"/g, '""');
        rowCells.push(`"${valStr}"`);
      }
      rows.push(rowCells.join(','));
    }

    return rows.join('\n');
  }

  /**
   * Produce 100% compliant, standalone HTML document for LibreOffice Writer conversion.
   */
  public static wrapToFullHtmlDocument(bodyHtml: string, title = '文档'): string {
    let cleanBody = DocumentContentNormalizer.extractHtmlString(bodyHtml);

    if (!cleanBody.trim()) {
      cleanBody = '<p></p>';
    }

    // If it's already a full HTML document, verify and return
    if (cleanBody.toLowerCase().includes('<html') && cleanBody.toLowerCase().includes('</html>')) {
      return cleanBody;
    }

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeXml(title)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 25mm 20mm 25mm 20mm;
    }
    body {
      font-family: 'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Source Han Sans SC', 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.75;
      color: #1e293b;
      background-color: #ffffff;
      margin: 0;
      padding: 0;
    }
    h1 {
      font-size: 22pt;
      font-weight: 700;
      color: #0f172a;
      text-align: center;
      margin-top: 16pt;
      margin-bottom: 18pt;
      line-height: 1.3;
    }
    h2 {
      font-size: 16pt;
      font-weight: 600;
      color: #1e293b;
      margin-top: 20pt;
      margin-bottom: 12pt;
      line-height: 1.35;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4pt;
    }
    h3 {
      font-size: 13pt;
      font-weight: 600;
      color: #334155;
      margin-top: 14pt;
      margin-bottom: 8pt;
    }
    p {
      margin-top: 0;
      margin-bottom: 10pt;
      text-align: justify;
      text-justify: inter-ideograph;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 14pt 0;
      font-size: 10.5pt;
    }
    th, td {
      border: 1px solid #94a3b8;
      padding: 8pt 12pt;
      text-align: left;
      vertical-align: middle;
    }
    th {
      background-color: #f1f5f9;
      font-weight: 600;
      color: #0f172a;
    }
    hr {
      border: 0;
      border-top: 1px solid #cbd5e1;
      margin: 18pt 0;
    }
    img {
      max-width: 100%;
      height: auto;
    }
    blockquote {
      margin: 12pt 0;
      padding: 8pt 16pt;
      border-left: 4px solid #3b82f6;
      background-color: #f8fafc;
      color: #475569;
    }
  </style>
</head>
<body>
${cleanBody}
</body>
</html>`;
  }

  /**
   * Main entry point: Normalizes and logs details prior to sending to LibreOffice
   */
  public static normalizeForEngine(
    rawContent: any,
    format: 'doc' | 'sheet' | string = 'doc',
    title = 'document'
  ): NormalizedDocumentOutput {
    if (format === 'pdf') {
      throw new Error('PDF_ENGINE_ERROR: DocumentContentNormalizer is strictly for DOC/Sheet normalization. Native PDF must follow the dedicated PdfExportService pipeline.');
    }
    const originalType = typeof rawContent;
    let cleanContent = '';
    let targetFormat: 'html' | 'csv' | 'raw' = 'html';

    if (format === 'sheet') {
      targetFormat = 'csv';
      cleanContent = DocumentContentNormalizer.extractSheetCsvString(rawContent);
    } else {
      targetFormat = 'html';
      cleanContent = DocumentContentNormalizer.wrapToFullHtmlDocument(rawContent, title);
    }

    // Calculate audit metrics
    const charCount = cleanContent.length;
    // Estimate page count: count page breaks or approximate by char density
    const explicitPageBreaks = (cleanContent.match(/page-break-before/g) || []).length;
    const estimatedPages = Math.max(1, explicitPageBreaks > 0 ? explicitPageBreaks + 1 : Math.ceil(charCount / 1200));

    // Estimate block count
    const blockMatches = cleanContent.match(/<(p|h[1-6]|table|img|blockquote|pre|hr)/g) || [];
    const blockCount = Math.max(1, blockMatches.length);

    // Extract snippet preview without HTML tags for human reading
    const textPreview = cleanContent.replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 150);

    const auditData = {
      contentLength: `${charCount} chars`,
      pageCount: `${estimatedPages} pages`,
      blocks: `${blockCount} blocks`,
      textPreview: `"${textPreview}"`,
    };

    // Mandatory Log for Engine Audit
    console.log('====================================================');
    console.log('📄 [DocumentContentNormalizer] Pre-Engine Conversion Audit:');
    console.log(JSON.stringify(auditData, null, 2));
    console.log('====================================================');

    return {
      format: targetFormat,
      cleanContent,
      originalType,
      charCount,
      snippet: textPreview,
      pageEstimate: estimatedPages,
      blockCount,
    };
  }
}

function escapeXml(unsafe: string): string {
  if (typeof unsafe !== 'string') return String(unsafe || '');
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

