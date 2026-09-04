import type { OfficeFile, DocumentModel, DocOutlineItem } from '../../types';
import { DocumentContentNormalizer } from '../document/DocumentContentNormalizer';
import { DocxParser } from '../document/DocxParser';
import { DocumentExportAdapter } from '../export/DocumentExportAdapter';
import { renderDocToNativeSearchablePdf } from '../../utils/nativePdfRenderer';

export interface WriterDocumentStats {
  characters: number;
  words: number;
  paragraphs: number;
  headings: number;
  tables: number;
}

export interface WriterExportOptions {
  title?: string;
  dpi?: number;
  pdfa?: boolean;
  filter?: string;
}

/**
 * WriterBridge
 * Manages DOCX / ODT / Text documents, connecting Lumina's UI to the local LibreOffice Writer engine.
 * 
 * Responsibilities:
 * - Parsing DOCX binaries into structural DocumentModel / AST
 * - Generating native DOCX files via LibreOffice Writer (`soffice --headless --convert-to docx`)
 * - Exporting high-fidelity PDF via LibreOffice Writer (`soffice --headless --convert-to pdf:writer_pdf_Export`)
 * - Document structure extraction, outline generation, and statistics calculation
 */
export class WriterBridge {
  private getOrigin(): string {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }
    return 'http://localhost:3000';
  }

  private isElectron(): boolean {
    return typeof window !== 'undefined' && Boolean((window as any).electronAPI?.isElectron);
  }

  /**
   * Parse a DOCX binary / ArrayBuffer / base64 into a high-level DocumentModel
   */
  public async parseDocx(input: ArrayBuffer | Uint8Array | string): Promise<DocumentModel> {
    let buffer: ArrayBuffer | Uint8Array;
    if (typeof input === 'string') {
      const cleanBase64 = input.includes(',') ? input.split(',')[1] : input;
      const binaryString = atob(cleanBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      buffer = bytes;
    } else {
      buffer = input;
    }

    const parsed = await DocxParser.parseDocx(buffer);
    return parsed.documentModel;
  }

  /**
   * Generate an outline / table of contents from document content
   */
  public extractOutline(content: string): DocOutlineItem[] {
    const outline: DocOutlineItem[] = [];
    if (!content) return outline;

    // Parse HTML headings if content is HTML
    if (content.includes('<h') || content.includes('<H')) {
      const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h\1>/gi;
      let match;
      let index = 0;
      while ((match = headingRegex.exec(content)) !== null) {
        const rawLevel = parseInt(match[1], 10);
        const level = (rawLevel <= 1 ? 1 : rawLevel === 2 ? 2 : 3) as (1 | 2 | 3);
        const text = match[2].replace(/<[^>]+>/g, '').trim();
        if (text) {
          outline.push({
            id: `heading-${index}`,
            title: text,
            level,
            pos: index++,
          });
        }
      }
    } else {
      // Parse Markdown headings (# Heading)
      const lines = content.split('\n');
      let pos = 0;
      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('#')) {
          const match = trimmed.match(/^(#{1,6})\s+(.*)$/);
          if (match) {
            const rawLevel = match[1].length;
            const level = (rawLevel <= 1 ? 1 : rawLevel === 2 ? 2 : 3) as (1 | 2 | 3);
            outline.push({
              id: `heading-${idx}`,
              title: match[2].trim(),
              level,
              pos: pos++,
            });
          }
        }
      });
    }

    return outline;
  }

  /**
   * Calculate document statistics
   */
  public calculateStats(content: string): WriterDocumentStats {
    if (!content) {
      return { characters: 0, words: 0, paragraphs: 0, headings: 0, tables: 0 };
    }

    const plainText = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const characters = plainText.length;
    const words = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;
    
    // Paragraph count
    const pMatches = content.match(/<p[^>]*>/gi);
    const paragraphs = pMatches ? pMatches.length : content.split('\n\n').filter(Boolean).length || 1;

    // Heading count
    const hMatches = content.match(/<h[1-6][^>]*>/gi);
    const headings = hMatches ? hMatches.length : (content.match(/^#{1,6}\s+/gm) || []).length;

    // Table count
    const tableMatches = content.match(/<table[^>]*>/gi);
    const tables = tableMatches ? tableMatches.length : 0;

    return {
      characters,
      words,
      paragraphs,
      headings,
      tables,
    };
  }

  /**
   * Generate native DOCX binary via local LibreOffice Writer engine
   */
  public async generateDocx(
    fileId: string,
    content: any,
    title: string = 'document'
  ): Promise<{ blob: Blob; size: number; filename: string }> {
    const safeTitle = title.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]/g, '_');
    const normalized = DocumentContentNormalizer.normalizeForEngine(content, 'doc', safeTitle);

    // 1. If running inside Electron desktop shell
    if (this.isElectron() && (window as any).electronAPI?.saveDocument) {
      try {
        const result = await (window as any).electronAPI.saveDocument({
          format: 'doc',
          content: normalized.cleanContent,
          title: safeTitle,
        });
        if (result && result.success) {
          const uint8 = new Uint8Array(result.buffer || Buffer.from(result.base64, 'base64'));
          return {
            blob: new Blob([uint8], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
            size: result.size || uint8.length,
            filename: result.filename || `${safeTitle}.docx`,
          };
        }
      } catch (err) {
        console.warn('WriterBridge: Electron IPC saveDocument failed, falling back to local server:', err);
      }
    }

    // 2. Local backend LibreOffice Writer bridge
    const origin = this.getOrigin();
    const res = await fetch(`${origin}/api/engine/save-document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileId,
        format: 'doc',
        content: normalized.cleanContent,
        title: safeTitle,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Writer DOCX save failed' }));
      throw new Error(err.error || 'Failed to generate DOCX via LibreOffice Writer Engine');
    }

    const info = await res.json();
    const downloadRes = await fetch(`${origin}/api/engine/file/${fileId}`);
    if (downloadRes.ok) {
      const blob = await downloadRes.blob();
      return {
        blob,
        size: info.size || blob.size,
        filename: info.filename || `${safeTitle}.docx`,
      };
    }

    throw new Error('Failed to download generated DOCX binary from engine');
  }

  /**
   * Export document to high-fidelity PDF via LibreOffice Writer Engine (`writer_pdf_Export`)
   */
  public async exportPdf(
    fileId: string,
    content: any,
    options: WriterExportOptions = {}
  ): Promise<Blob> {
    const safeTitle = (options.title || 'document').replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]/g, '_');
    const normalized = DocumentContentNormalizer.normalizeForEngine(content, 'doc', safeTitle);

    // 1. Electron IPC
    if (this.isElectron() && (window as any).electronAPI?.exportPDF) {
      try {
        const result = await (window as any).electronAPI.exportPDF({
          format: 'doc',
          content: normalized.cleanContent,
          title: safeTitle,
        });
        if (result && result.success) {
          const uint8 = new Uint8Array(result.buffer || Buffer.from(result.base64, 'base64'));
          return new Blob([uint8], { type: 'application/pdf' });
        }
      } catch (err) {
        console.warn('WriterBridge: Electron IPC exportPDF failed, falling back to local server:', err);
      }
    }

    // 2. Local backend
    const origin = this.getOrigin();
    const res = await fetch(`${origin}/api/engine/export-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileId,
        content: normalized.cleanContent,
        format: 'doc',
        title: safeTitle,
        pdfa: options.pdfa,
        dpi: options.dpi,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Writer PDF export failed' }));
      throw new Error(err.error || 'Failed to export PDF via LibreOffice Writer Engine');
    }

    return await res.blob();
  }
}

export const writerBridge = new WriterBridge();
