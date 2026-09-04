import type { DocumentModel, WorkbookData, OfficeFile } from '../types';
import { DocxParser } from '../core/document/DocxParser';
import { importXlsxToWorkbook } from '../utils/sheetUtils';
import { DOMParser as XMLDOMParser } from '@xmldom/xmldom';
import type { ParsedDocumentStructure } from './types';

function parseXmlOrHtml(str: string): any {
  if (typeof window !== 'undefined' && window.DOMParser) {
    try {
      return new window.DOMParser().parseFromString(str, 'text/html');
    } catch {
      return new window.DOMParser().parseFromString(`<root>${str}</root>`, 'application/xml');
    }
  }
  try {
    const wrapped = `<root>${str.replace(/&(?!(amp|lt|gt|quot|apos);)/g, '&amp;')}</root>`;
    return new XMLDOMParser({ onError: () => {} }).parseFromString(wrapped, 'application/xml');
  } catch {
    return null;
  }
}

/**
 * DocumentParser
 * High-fidelity parser extracting semantic structure from DOCX, XLSX, PDF, and HTML for the AI Layer.
 * Pipeline: Office Engine -> Document Parser -> AI Model -> Command Generation
 */
export class DocumentParser {
  /**
   * Parse arbitrary document format into unified ParsedDocumentStructure
   */
  public static async parse(file: OfficeFile | { name: string; type: string; content: any }): Promise<ParsedDocumentStructure> {
    const format = (file.type || 'doc') as 'doc' | 'sheet' | 'pdf';
    const title = file.name || 'Untitled';

    if (format === 'sheet') {
      return this.parseSheet(file.content, title);
    } else if (format === 'pdf') {
      return this.parsePdf(file.content, title);
    } else {
      return this.parseDoc(file.content, title);
    }
  }

  /**
   * Parse Doc / DOCX content
   */
  public static async parseDoc(content: any, title: string): Promise<ParsedDocumentStructure> {
    const paragraphs: Array<{ id: string; text: string; headingLevel?: number; style?: Record<string, any> }> = [];
    const tables: Array<{ id: string; rows: number; cols: number; data: string[][] }> = [];
    let rawText = '';

    if (content instanceof Uint8Array || content instanceof ArrayBuffer) {
      try {
        const parsedDoc = await DocxParser.parseDocx(content, title);
        let nodeIdx = 0;
        for (const node of parsedDoc.nodes) {
          nodeIdx++;
          if (node.type === 'paragraph' || node.type === 'heading') {
            const pText = node.runs.map((r) => r.text).join('');
            paragraphs.push({
              id: `node-${nodeIdx}`,
              text: pText,
              headingLevel: node.level,
              style: { align: node.align },
            });
            rawText += pText + '\n';
          } else if (node.type === 'table' && node.tableData) {
            const rowData: string[][] = [];
            for (const r of node.tableData.rows) {
              const cTexts: string[] = [];
              for (const cell of r) {
                cTexts.push(cell.text || '');
              }
              rowData.push(cTexts);
            }
            tables.push({
              id: `tbl-${nodeIdx}`,
              rows: node.tableData.rows.length,
              cols: rowData[0]?.length || 0,
              data: rowData,
            });
            rawText += `[Table ${tables.length}: ${rowData.map((row) => row.join(' | ')).join('\n')}]\n`;
          } else if (node.type === 'image') {
            const ocrText = node.imageData?.ocrText || node.imageData?.alt || '';
            if (ocrText.trim()) {
              const imgText = `[图片文字: ${ocrText.trim()}]`;
              paragraphs.push({
                id: `img-${nodeIdx}`,
                text: imgText,
              });
              rawText += imgText + '\n';
            }
          }
        }
      } catch (err) {
        console.warn('DocumentParser: DOCX parse fallback', err);
      }
    } else if (content && typeof content === 'object' && Array.isArray(content.nodes)) {
      let nodeIdx = 0;
      for (const node of content.nodes) {
        nodeIdx++;
        if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'bullet' || node.type === 'ordered') {
          const pText = (node.runs || []).map((r: any) => r.text).join('');
          if (pText.trim()) {
            paragraphs.push({
              id: `node-${nodeIdx}`,
              text: pText,
              headingLevel: node.level,
              style: { align: node.align },
            });
            rawText += pText + '\n';
          }
        } else if (node.type === 'table' && node.tableData) {
          const rowData: string[][] = [];
          for (const r of node.tableData.rows) {
            const cTexts: string[] = [];
            for (const cell of r) {
              cTexts.push(cell.text || '');
            }
            rowData.push(cTexts);
          }
          tables.push({
            id: `tbl-${nodeIdx}`,
            rows: node.tableData.rows.length,
            cols: rowData[0]?.length || 0,
            data: rowData,
          });
          rawText += `[Table ${tables.length}: ${rowData.map((row) => row.join(' | ')).join('\n')}]\n`;
        } else if (node.type === 'image') {
          const ocrText = node.imageData?.ocrText || node.imageData?.alt || '';
          if (ocrText.trim()) {
            const imgText = `[图片文字: ${ocrText.trim()}]`;
            paragraphs.push({
              id: `img-${nodeIdx}`,
              text: imgText,
            });
            rawText += imgText + '\n';
          }
        }
      }
    } else if (typeof content === 'string') {
      // HTML or plain text string
      const doc = parseXmlOrHtml(content);
      if (doc) {
        const getEls = (tag: string) => {
          const els: any[] = [];
          const list = doc.getElementsByTagName(tag);
          if (list) {
            for (let i = 0; i < list.length; i++) els.push(list[i]);
          }
          return els;
        };

        const headingTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
        headingTags.forEach((ht, hIdx) => {
          getEls(ht).forEach((el, idx) => {
            const text = el.textContent || '';
            if (text.trim()) {
              paragraphs.push({ id: `h-${hIdx}-${idx}`, text, headingLevel: hIdx + 1 });
              rawText += text + '\n';
            }
          });
        });

        getEls('p').forEach((el, idx) => {
          const text = el.textContent || '';
          if (text.trim()) {
            paragraphs.push({ id: `p-${idx}`, text });
            rawText += text + '\n';
          }
        });

        getEls('img').forEach((el, idx) => {
          const alt = el.getAttribute('alt') || el.getAttribute('data-ocr') || el.getAttribute('title') || '';
          if (alt.trim()) {
            const imgText = `[图片文字: ${alt.trim()}]`;
            paragraphs.push({ id: `img-${idx}`, text: imgText });
            rawText += imgText + '\n';
          }
        });

        getEls('table').forEach((tbl, tIdx) => {
          const rowData: string[][] = [];
          const trs = tbl.getElementsByTagName('tr');
          if (trs) {
            for (let r = 0; r < trs.length; r++) {
              const tr = trs[r];
              const cells = tr.getElementsByTagName('th');
              const tdCells = tr.getElementsByTagName('td');
              const rowCells: string[] = [];
              if (cells) {
                for (let c = 0; c < cells.length; c++) rowCells.push(cells[c].textContent || '');
              }
              if (tdCells) {
                for (let c = 0; c < tdCells.length; c++) rowCells.push(tdCells[c].textContent || '');
              }
              if (rowCells.length > 0) rowData.push(rowCells);
            }
          }
          if (rowData.length > 0) {
            tables.push({
              id: `tbl-${tIdx}`,
              rows: rowData.length,
              cols: rowData[0]?.length || 0,
              data: rowData,
            });
            rawText += `[Table: ${rowData.map((r) => r.join(' | ')).join('\n')}]\n`;
          }
        });
      }

      if (paragraphs.length === 0) {
        const lines = content.replace(/<[^>]*>/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
        lines.forEach((line, idx) => {
          paragraphs.push({ id: `p-${idx}`, text: line });
          rawText += line + '\n';
        });
      }
    }

    const wordCount = rawText.trim().split(/\s+/).filter(Boolean).length;

    return {
      title,
      format: 'doc',
      paragraphs,
      tables,
      wordCount,
      rawText: rawText.trim(),
    };
  }

  /**
   * Parse Sheet / XLSX content
   */
  public static async parseSheet(content: any, title: string): Promise<ParsedDocumentStructure> {
    const paragraphs: Array<{ id: string; text: string; headingLevel?: number; style?: Record<string, any> }> = [];
    const tables: Array<{ id: string; rows: number; cols: number; data: string[][] }> = [];
    const sheetsMeta: Array<{ id: string; name: string; rows: number; cols: number; formulaCount: number; summary: string }> = [];
    let rawText = '';

    let wb: WorkbookData | null = null;

    if (content && typeof content === 'object' && 'sheets' in content) {
      wb = content as WorkbookData;
    } else if (content instanceof Uint8Array || content instanceof ArrayBuffer) {
      wb = await importXlsxToWorkbook(content as any);
    }

    if (wb && wb.sheets) {
      for (const sheet of wb.sheets) {
        let formulaCount = 0;
        const rowData: string[][] = [];

        // Build 2D matrix preview
        const maxR = Math.min(sheet.rows || 20, 30);
        const maxC = Math.min(sheet.cols || 10, 15);

        for (let r = 0; r < maxR; r++) {
          const row: string[] = [];
          for (let c = 0; c < maxC; c++) {
            const cell = sheet.cells[`${r},${c}`] || sheet.cells[`${r}:${c}`];
            const val = cell ? String(cell.value ?? '') : '';
            if (val.startsWith('=')) formulaCount++;
            row.push(val);
          }
          if (row.some((cellVal) => cellVal !== '')) {
            rowData.push(row);
          }
        }

        sheetsMeta.push({
          id: sheet.id,
          name: sheet.title || sheet.id,
          rows: sheet.rows,
          cols: sheet.cols,
          formulaCount,
          summary: `${sheet.title}: ${rowData.length} 数据行, ${formulaCount} 处公式`,
        });

        tables.push({
          id: sheet.id,
          rows: rowData.length,
          cols: rowData[0]?.length || 0,
          data: rowData,
        });

        rawText += `[Sheet: ${sheet.title}]\n${rowData.map((row) => row.join('\t')).join('\n')}\n\n`;
      }
    }

    return {
      title,
      format: 'sheet',
      paragraphs,
      tables,
      sheets: sheetsMeta,
      wordCount: rawText.split(/\s+/).filter(Boolean).length,
      rawText: rawText.trim(),
    };
  }

  /**
   * Parse PDF content
   */
  public static async parsePdf(content: any, title: string): Promise<ParsedDocumentStructure> {
    let rawText = '';
    const paragraphs: Array<{ id: string; text: string }> = [];

    if (content && typeof content === 'object' && content.annotations) {
      const texts = content.annotations
        .filter((a: any) => a.type === 'text' || a.type === 'comment')
        .map((a: any) => a.text || a.content || '')
        .filter(Boolean);
      texts.forEach((txt: string, idx: number) => {
        paragraphs.push({ id: `anno-${idx}`, text: txt });
        rawText += txt + '\n';
      });
    }

    return {
      title,
      format: 'pdf',
      paragraphs,
      tables: [],
      wordCount: rawText.split(/\s+/).filter(Boolean).length,
      rawText: rawText.trim() || `[PDF Document: ${title}]`,
    };
  }
}
