import { PDFDocument } from 'pdf-lib';
import { HistoryManager, documentHistoryManager } from '../history';
import { DocumentSession } from './DocumentSession';
import { analyzePdfDocument, loadPdfJsDocument } from '../../utils/pdfLibWrapper';
import { createSamplePdfDocument } from '../../utils/sampleDocs';
import { useState, useEffect } from 'react';

export type DocumentManagerListener = (sessions: DocumentSession[], activeId: string | null) => void;

/**
 * DocumentManager
 * High-performance multi-document session manager for Lumina PDF.
 * Enables multiple concurrent PDF documents to remain open, with isolated state,
 * page caches, annotations, and independent undo/redo history trees.
 */
export class DocumentManager {
  private static instance: DocumentManager | null = null;
  private sessions: DocumentSession[] = [];
  private activeSessionId: string | null = null;
  private listeners: Set<DocumentManagerListener> = new Set();
  private newDocCounter: number = 1;

  public static getInstance(): DocumentManager {
    if (!DocumentManager.instance) {
      DocumentManager.instance = new DocumentManager();
    }
    return DocumentManager.instance;
  }

  public getSessions(): DocumentSession[] {
    return [...this.sessions];
  }

  public getActiveSessionId(): string | null {
    return this.activeSessionId;
  }

  public getActiveSession(): DocumentSession | null {
    if (!this.activeSessionId) return null;
    return this.sessions.find((s) => s.id === this.activeSessionId) || null;
  }

  public subscribe(listener: DocumentManagerListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const copy = [...this.sessions];
    this.listeners.forEach((listener) => {
      try {
        listener(copy, this.activeSessionId);
      } catch (e) {
        console.error('[DocumentManager] Listener error:', e);
      }
    });
  }

  /**
   * Switch the active document session
   */
  public switchDocument(sessionId: string): DocumentSession | null {
    const target = this.sessions.find((s) => s.id === sessionId);
    if (target) {
      this.activeSessionId = sessionId;
      documentHistoryManager.setActiveDocument(sessionId);
      this.notify();
      return target;
    }
    return null;
  }

  /**
   * Close a document session without affecting other open sessions.
   * If the closed document was currently active, switch to an adjacent document.
   */
  public async closeDocument(sessionId: string): Promise<boolean> {
    const index = this.sessions.findIndex((s) => s.id === sessionId);
    if (index === -1) return false;

    this.sessions.splice(index, 1);
    documentHistoryManager.removeDocument(sessionId);

    if (this.activeSessionId === sessionId) {
      if (this.sessions.length > 0) {
        const nextIndex = Math.min(index, this.sessions.length - 1);
        this.activeSessionId = this.sessions[nextIndex].id;
        documentHistoryManager.setActiveDocument(this.activeSessionId);
      } else {
        this.activeSessionId = null;
      }
    }

    this.notify();
    return true;
  }

  /**
   * Update the active document session
   */
  public updateActiveSession(updater: (prev: DocumentSession) => DocumentSession): void {
    if (!this.activeSessionId) return;
    this.updateSession(this.activeSessionId, updater);
  }

  /**
   * Update a specific session by ID
   */
  public updateSession(sessionId: string, updater: (prev: DocumentSession) => DocumentSession): void {
    const index = this.sessions.findIndex((s) => s.id === sessionId);
    if (index === -1) return;

    const oldSession = this.sessions[index];
    const newSession = updater(oldSession);
    newSession.lastModifiedAt = Date.now();
    this.sessions[index] = newSession;

    this.notify();
  }

  /**
   * Rename a document session
   */
  public renameDocument(sessionId: string, newName: string): void {
    this.updateSession(sessionId, (prev) => ({
      ...prev,
      fileName: newName.trim().endsWith('.pdf') ? newName.trim() : `${newName.trim()}.pdf`,
    }));
  }

  /**
   * Create a new blank PDF document without closing or overwriting existing sessions.
   */
  public async createBlankDocument(title?: string, customSessionId?: string): Promise<DocumentSession> {
    const docName = title || `新建文档 ${this.newDocCounter++}.pdf`;
    
    // Generate clean A4 PDF bytes
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([595.28, 841.89]); // Standard A4: 595.28 x 841.89 pt
    const pdfBytes = await pdfDoc.save();

    return this.createSessionFromBytes(pdfBytes, docName, pdfBytes.byteLength, customSessionId);
  }

  /**
   * Create a sample PDF document session (e.g. contract with watermark)
   */
  public async createSampleDocument(
    sampleType: 'contract-watermark' | 'invoice' | 'report' = 'contract-watermark',
    customSessionId?: string,
    customFileName?: string
  ): Promise<DocumentSession> {
    const pdfBytes = await createSamplePdfDocument(sampleType);
    const fileName = customFileName || (sampleType === 'contract-watermark'
      ? '商业技术合作与知识产权保护协议.pdf'
      : sampleType === 'invoice'
      ? '标准增值税财务发票.pdf'
      : '季度业务运营分析报告.pdf');

    return this.createSessionFromBytes(pdfBytes, fileName, pdfBytes.byteLength, customSessionId);
  }

  /**
   * Open an existing PDF document from a browser File object.
   * Preserves all other existing sessions.
   */
  public async openDocumentFromFile(file: File): Promise<DocumentSession> {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    return this.createSessionFromBytes(bytes, file.name, file.size);
  }

  /**
   * Internal helper: Initialize and register a new DocumentSession from binary bytes.
   */
  public async createSessionFromBytes(
    bytes: Uint8Array,
    fileName: string,
    fileSize: number = 0,
    customSessionId?: string
  ): Promise<DocumentSession> {
    const { pages, pageCount } = await analyzePdfDocument(bytes);
    const pdfJsDoc = await loadPdfJsDocument(bytes);

    const sessionId = customSessionId || `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    
    // Check if session with this ID already exists, update if so
    const existingIndex = this.sessions.findIndex((s) => s.id === sessionId);
    const sessionHistory = documentHistoryManager.getOrCreateHistory(sessionId, 50);

    const newSession: DocumentSession = {
      id: sessionId,
      fileName,
      fileSize: fileSize || bytes.byteLength,
      pdfBytes: bytes,
      pdfJsDoc,
      pages,
      pageCount,
      currentPageIndex: 0,
      zoom: 1.0,
      viewMode: 'continuous',
      annotations: [],
      isModified: false,
      historyManager: sessionHistory, // Isolated history engine for this session
      createdAt: Date.now(),
      lastModifiedAt: Date.now(),
      watermarkCount: 0,
    };

    if (existingIndex >= 0) {
      this.sessions[existingIndex] = newSession;
    } else {
      this.sessions.push(newSession);
    }
    
    this.activeSessionId = newSession.id;
    documentHistoryManager.setActiveDocument(newSession.id);
    this.notify();

    return newSession;
  }
}

/** Global singleton instance */
export const documentManager = DocumentManager.getInstance();

/**
 * React hook to bind components to the DocumentManager
 */
export function useDocumentManager() {
  const [sessions, setSessions] = useState<DocumentSession[]>(() => documentManager.getSessions());
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => documentManager.getActiveSessionId());

  useEffect(() => {
    return documentManager.subscribe((newSessions, newActiveId) => {
      setSessions([...newSessions]);
      setActiveSessionId(newActiveId);
    });
  }, []);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;

  return {
    sessions,
    activeSessionId,
    activeSession,
    documentManager,
    switchDocument: (id: string) => documentManager.switchDocument(id),
    closeDocument: (id: string) => documentManager.closeDocument(id),
    createBlankDocument: (title?: string, customSessionId?: string) => documentManager.createBlankDocument(title, customSessionId),
    createSampleDocument: (type?: any, customSessionId?: string, customFileName?: string) =>
      documentManager.createSampleDocument(type, customSessionId, customFileName),
    createSessionFromBytes: (bytes: Uint8Array, fileName: string, fileSize?: number, customSessionId?: string) =>
      documentManager.createSessionFromBytes(bytes, fileName, fileSize, customSessionId),
    openDocumentFromFile: (file: File) => documentManager.openDocumentFromFile(file),
    updateActiveSession: (updater: (prev: DocumentSession) => DocumentSession) => documentManager.updateActiveSession(updater),
    updateSession: (id: string, updater: (prev: DocumentSession) => DocumentSession) => documentManager.updateSession(id, updater),
    renameDocument: (id: string, name: string) => documentManager.renameDocument(id, name),
  };
}
