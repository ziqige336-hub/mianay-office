import type { OfficeFile, FileType, DocumentModel, WorkbookData } from '../types';

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
  format: FileType;
  isLoaded: boolean;
  engine: 'Electron Native' | 'LibreOffice Engine' | 'Local Bridge';
  lastSyncedAt: number;
  model?: DocumentModel | WorkbookData | any;
}

export interface ParsedDocumentStructure {
  title: string;
  format: FileType;
  paragraphs: Array<{
    id: string;
    text: string;
    headingLevel?: number;
    style?: Record<string, any>;
  }>;
  tables: Array<{
    id: string;
    rows: number;
    cols: number;
    data: string[][];
  }>;
  sheets?: Array<{
    id: string;
    name: string;
    rows: number;
    cols: number;
    formulaCount: number;
    summary: string;
  }>;
  wordCount: number;
  rawText: string;
}

export interface AiModificationCommand {
  type: 'insert_paragraph' | 'replace_text' | 'format_heading' | 'insert_table' | 'update_sheet_cell' | 'add_formula' | 'summarize' | 'polish_text';
  target?: string;
  payload: any;
  explanation: string;
}

export interface AiOfficeExecutionResult {
  success: boolean;
  appliedCommands: number;
  summary: string;
  updatedContent: any;
}
