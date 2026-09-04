import { officeEngine, OfficeEngine } from '../core/office/OfficeEngine';
import { DocumentParser } from './DocumentParser';
import { AiOfficePipeline } from './AiOfficePipeline';
import type {
  OfficeEngineStatus,
  EngineVerifyResult,
  OfficeDocumentSession,
  ParsedDocumentStructure,
  AiOfficeExecutionResult,
} from './types';
import type { OfficeFile, FileType } from '../types';

/**
 * OfficeEngineAdapter
 * Unified Bridge between Lumina UI (React / Electron) and the native LibreOffice Desktop Core.
 */
export class OfficeEngineAdapter {
  private static instance: OfficeEngineAdapter;
  public readonly core: OfficeEngine = officeEngine;

  public static getInstance(): OfficeEngineAdapter {
    if (!OfficeEngineAdapter.instance) {
      OfficeEngineAdapter.instance = new OfficeEngineAdapter();
    }
    return OfficeEngineAdapter.instance;
  }

  /**
   * Check if running within Electron Desktop Environment
   */
  public isElectron(): boolean {
    return this.core.isElectron();
  }

  /**
   * Get live engine status and available LibreOffice filters
   */
  public async getStatus(): Promise<OfficeEngineStatus> {
    return (await this.core.getEngineStatus()) as OfficeEngineStatus;
  }

  /**
   * Run bidirectional verification test
   */
  public async verify(): Promise<EngineVerifyResult> {
    return (await this.core.verifyEngine()) as EngineVerifyResult;
  }

  /**
   * Open document session
   */
  public async openDocument(file: OfficeFile): Promise<OfficeDocumentSession> {
    return (await this.core.openDocument(file)) as OfficeDocumentSession;
  }

  /**
   * Save document to Microsoft Office / WPS native formats
   */
  public async saveDocument(
    fileId: string,
    content: any,
    format: 'doc' | 'sheet' = 'doc',
    title: string = 'document'
  ): Promise<{ blob: Blob; size: number; filename: string }> {
    return await this.core.saveDocument(fileId, content, format, title);
  }

  /**
   * Export PDF with native LibreOffice filter
   */
  public async exportPdf(params: { fileId: string; format?: string; content?: any; title?: string }): Promise<Blob> {
    return await this.core.exportPDF(params as any);
  }

  /**
   * Parse document for AI analysis and structured inspection
   */
  public async parseDocument(file: OfficeFile | { name: string; type: string; content: any }): Promise<ParsedDocumentStructure> {
    return await DocumentParser.parse(file);
  }

  /**
   * Run AI enhancement instruction on active document
   */
  public async executeAiInstruction(
    file: OfficeFile,
    prompt: string,
    currentContent: any
  ): Promise<AiOfficeExecutionResult> {
    return await AiOfficePipeline.processInstruction(file, prompt, currentContent);
  }
}

export const officeEngineAdapter = OfficeEngineAdapter.getInstance();
export default officeEngineAdapter;
