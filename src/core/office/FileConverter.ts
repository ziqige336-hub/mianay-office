import { DocumentContentNormalizer } from '../document/DocumentContentNormalizer';

export interface ConvertOptions {
  fileId?: string;
  fromType: string;
  toType: string;
  filename?: string;
  content?: any;
  base64?: string;
  filter?: string;
}

export interface ConvertResult {
  blob: Blob;
  filename: string;
  mimeType: string;
  size: number;
}

/**
 * FileConverter
 * Multi-format offline document conversion bridge powered by the local LibreOffice engine.
 * 
 * Filter Matrix:
 * - DOCX -> PDF (`writer_pdf_Export`), ODT (`writer8`), HTML (`HTML`), TXT (`Text`)
 * - XLSX -> PDF (`calc_pdf_Export`), ODS (`calc8`), CSV (`Text - txt - csv (StarCalc)`), HTML (`HTML (StarCalc)`)
 * - PPTX -> PDF (`impress_pdf_Export`), ODP (`impress8`)
 * - HTML -> DOCX (`Office Open XML Text`), PDF (`writer_pdf_Export`)
 * - CSV  -> XLSX (`Calc Office Open XML`), PDF (`calc_pdf_Export`)
 */
export class FileConverter {
  private getOrigin(): string {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return 'http://localhost:3000';
  }

  /**
   * Determine the standard LibreOffice export filter based on source & target extensions
   */
  public getStandardFilter(fromExt: string, toExt: string): string | undefined {
    const src = fromExt.toLowerCase().replace('.', '');
    const tgt = toExt.toLowerCase().replace('.', '');

    if (tgt === 'pdf') {
      if (['xlsx', 'xls', 'csv', 'ods'].includes(src)) return 'calc_pdf_Export';
      if (['pptx', 'ppt', 'odp'].includes(src)) return 'impress_pdf_Export';
      return 'writer_pdf_Export';
    }

    if (tgt === 'docx') return 'Office Open XML Text';
    if (tgt === 'xlsx') return 'Calc Office Open XML';
    if (tgt === 'odt') return 'writer8';
    if (tgt === 'ods') return 'calc8';
    if (tgt === 'odp') return 'impress8';
    if (tgt === 'csv') return 'Text - txt - csv (StarCalc)';
    if (tgt === 'txt') return 'Text';
    if (tgt === 'html') {
      if (['xlsx', 'xls', 'csv', 'ods'].includes(src)) return 'HTML (StarCalc)';
      return 'HTML';
    }

    return undefined;
  }

  /**
   * Get appropriate MIME type for an extension
   */
  public getMimeType(ext: string): string {
    const clean = ext.toLowerCase().replace('.', '');
    switch (clean) {
      case 'pdf':
        return 'application/pdf';
      case 'docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'pptx':
        return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
      case 'odt':
        return 'application/vnd.oasis.opendocument.text';
      case 'ods':
        return 'application/vnd.oasis.opendocument.spreadsheet';
      case 'odp':
        return 'application/vnd.oasis.opendocument.presentation';
      case 'csv':
        return 'text/csv';
      case 'txt':
        return 'text/plain';
      case 'html':
        return 'text/html';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * Execute offline format conversion via LibreOffice Engine
   */
  public async convert(options: ConvertOptions): Promise<ConvertResult> {
    const fromExt = options.fromType.toLowerCase().replace('.', '');
    const toExt = options.toType.toLowerCase().replace('.', '');
    const filter = options.filter || this.getStandardFilter(fromExt, toExt);
    const safeTitle = (options.filename || options.fileId || 'document').replace(/\.[^/.]+$/, '');
    const outFilename = `${safeTitle}.${toExt}`;

    const origin = this.getOrigin();
    const res = await fetch(`${origin}/api/engine/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileId: options.fileId,
        fromType: fromExt,
        toType: toExt,
        filter,
        filename: safeTitle,
        content: options.content,
        base64: options.base64,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Conversion failed' }));
      throw new Error(err.error || `LibreOffice failed to convert from ${fromExt} to ${toExt}`);
    }

    const blob = await res.blob();
    const mimeType = this.getMimeType(toExt);

    return {
      blob: new Blob([blob], { type: mimeType }),
      filename: outFilename,
      mimeType,
      size: blob.size,
    };
  }
}

export const fileConverter = new FileConverter();
