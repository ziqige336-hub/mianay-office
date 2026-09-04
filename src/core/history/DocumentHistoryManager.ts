import { Command } from './Command';
import { HistoryManager } from './HistoryManager';

export type DocumentHistoryListener = (activeDocId: string | null) => void;

/**
 * DocumentHistoryManager
 * Enterprise multi-document independent undo/redo stack engine.
 * 
 * Architectural Guarantee:
 * - Each open document has its own isolated HistoryManager instance with private undo/redo stacks.
 * - Switching between documents preserves full undo/redo state for every document.
 * - No global state leakage or command cross-contamination between documents.
 */
export class DocumentHistoryManager {
  private static instance: DocumentHistoryManager | null = null;
  private documentHistories: Map<string, HistoryManager> = new Map();
  private activeDocumentId: string | null = null;
  private listeners: Set<DocumentHistoryListener> = new Set();
  private maxHistoryPerDoc: number = 50;

  public constructor(maxHistoryPerDoc: number = 50) {
    this.maxHistoryPerDoc = maxHistoryPerDoc;
  }

  public static getInstance(): DocumentHistoryManager {
    if (!DocumentHistoryManager.instance) {
      DocumentHistoryManager.instance = new DocumentHistoryManager();
    }
    return DocumentHistoryManager.instance;
  }

  /**
   * Get or create a dedicated HistoryManager instance for a document
   */
  public getOrCreateHistory(documentId: string, maxHistorySize?: number): HistoryManager {
    let history = this.documentHistories.get(documentId);
    if (!history) {
      history = new HistoryManager(maxHistorySize || this.maxHistoryPerDoc);
      this.documentHistories.set(documentId, history);
    }
    return history;
  }

  /**
   * Get existing HistoryManager for a document
   */
  public getHistory(documentId: string): HistoryManager | null {
    return this.documentHistories.get(documentId) || null;
  }

  /**
   * Set active document ID
   */
  public setActiveDocument(documentId: string | null): void {
    if (this.activeDocumentId === documentId) return;
    this.activeDocumentId = documentId;
    this.notify();
  }

  /**
   * Get current active document ID
   */
  public getActiveDocumentId(): string | null {
    return this.activeDocumentId;
  }

  /**
   * Get the active document's HistoryManager
   */
  public getActiveHistory(): HistoryManager | null {
    if (!this.activeDocumentId) return null;
    return this.getOrCreateHistory(this.activeDocumentId);
  }

  /**
   * Execute a command on a specific document's history stack
   */
  public execute(documentId: string, command: Command): void {
    const history = this.getOrCreateHistory(documentId);
    history.execute(command);
  }

  /**
   * Execute a command on the active document's history stack
   */
  public executeOnActive(command: Command): boolean {
    const history = this.getActiveHistory();
    if (!history) return false;
    history.execute(command);
    return true;
  }

  /**
   * Undo last operation on specified document (or active document)
   */
  public undo(documentId?: string): boolean {
    const targetId = documentId || this.activeDocumentId;
    if (!targetId) return false;
    const history = this.documentHistories.get(targetId);
    if (!history) return false;
    return history.undo();
  }

  /**
   * Redo previously undone operation on specified document (or active document)
   */
  public redo(documentId?: string): boolean {
    const targetId = documentId || this.activeDocumentId;
    if (!targetId) return false;
    const history = this.documentHistories.get(targetId);
    if (!history) return false;
    return history.redo();
  }

  /**
   * Check if undo is available
   */
  public canUndo(documentId?: string): boolean {
    const targetId = documentId || this.activeDocumentId;
    if (!targetId) return false;
    const history = this.documentHistories.get(targetId);
    return history ? history.canUndo() : false;
  }

  /**
   * Check if redo is available
   */
  public canRedo(documentId?: string): boolean {
    const targetId = documentId || this.activeDocumentId;
    if (!targetId) return false;
    const history = this.documentHistories.get(targetId);
    return history ? history.canRedo() : false;
  }

  /**
   * Remove a document's history when document is closed
   */
  public removeDocument(documentId: string): void {
    this.documentHistories.delete(documentId);
    if (this.activeDocumentId === documentId) {
      this.activeDocumentId = null;
    }
    this.notify();
  }

  /**
   * Clear a document's history
   */
  public clearDocument(documentId: string): void {
    const history = this.documentHistories.get(documentId);
    if (history) {
      history.clear();
    }
  }

  /**
   * Clear all document histories
   */
  public clearAll(): void {
    this.documentHistories.clear();
    this.activeDocumentId = null;
    this.notify();
  }

  /**
   * Subscribe to document history changes
   */
  public subscribe(listener: DocumentHistoryListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.activeDocumentId);
      } catch (err) {
        console.error('Error in DocumentHistoryManager listener:', err);
      }
    });
  }
}

export const documentHistoryManager = DocumentHistoryManager.getInstance();
