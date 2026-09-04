export type OfficeEngineType = 'libreoffice' | 'native-electron';

export interface OfficeEngineStatus {
  status: 'ok' | 'degraded' | 'error';
  engine: string;
  version: string;
  isAvailable: boolean;
  platform: string;
  arch?: string;
  electronBridgeSupported: boolean;
  supportedFilters: {
    docToDocx: string;
    docToPdf: string;
    sheetToXlsx: string;
    sheetToPdf: string;
    htmlToDocx: string;
    csvToXlsx: string;
  };
  activeFiles: number;
}

export interface EngineVerifyResult {
  success: boolean;
  durationMs: number;
  writer: {
    docxGenerated: boolean;
    docxSize: number;
    pdfGenerated: boolean;
    pdfSize: number;
  };
  calc: {
    xlsxGenerated: boolean;
    xlsxSize: number;
    pdfGenerated: boolean;
    pdfSize: number;
  };
  message: string;
}

export interface OfficeDocumentSession {
  fileId: string;
  filename: string;
  format: 'doc' | 'sheet' | 'pdf';
  isLoaded: boolean;
  engine: 'LibreOffice Engine' | 'Electron Native';
  lastSyncedAt: number;
}

export interface ConvertFormatOptions {
  fileId?: string;
  buffer?: Uint8Array | ArrayBuffer;
  base64?: string;
  content?: any;
  filename?: string;
  fromType: string;
  toType: string;
  filter?: string;
}

export interface ExportPdfOptions {
  fileId?: string;
  content?: any;
  base64?: string;
  format?: 'doc' | 'sheet';
  title?: string;
  pdfa?: boolean;
  dpi?: number;
}
