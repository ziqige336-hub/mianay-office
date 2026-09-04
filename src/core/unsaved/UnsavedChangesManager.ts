/**
 * UnsavedChangesManager.ts
 * Global State Management for Tracking Unsaved/Dirty Document and Sheet States.
 */

export type UnsavedChangeListener = (unsavedFileIds: string[], hasUnsavedChanges: boolean) => void;

class UnsavedChangesManagerClass {
  private unsavedFileIds: Set<string> = new Set();
  private listeners: Set<UnsavedChangeListener> = new Set();

  /**
   * Check if any file in the workspace has unsaved changes
   */
  public hasUnsavedChanges(): boolean {
    return this.unsavedFileIds.size > 0;
  }

  /**
   * Check if a specific file has unsaved changes
   */
  public isFileDirty(fileId: string): boolean {
    return this.unsavedFileIds.has(fileId);
  }

  /**
   * Get all currently dirty file IDs
   */
  public getUnsavedFileIds(): string[] {
    return Array.from(this.unsavedFileIds);
  }

  /**
   * Mark a file as dirty (unsaved) or clean
   */
  public setFileDirty(fileId: string, dirty: boolean = true): void {
    if (!fileId) return;
    const prevSize = this.unsavedFileIds.size;
    if (dirty) {
      this.unsavedFileIds.add(fileId);
    } else {
      this.unsavedFileIds.delete(fileId);
    }
    if (this.unsavedFileIds.size !== prevSize || dirty) {
      this.notify();
    }
  }

  /**
   * Mark a file as saved
   */
  public markSaved(fileId: string): void {
    this.setFileDirty(fileId, false);
  }

  /**
   * Mark all files as saved
   */
  public markAllSaved(): void {
    if (this.unsavedFileIds.size > 0) {
      this.unsavedFileIds.clear();
      this.notify();
    }
  }

  /**
   * Subscribe to unsaved changes updates
   */
  public subscribe(listener: UnsavedChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const list = this.getUnsavedFileIds();
    const hasUnsaved = list.length > 0;
    this.listeners.forEach((listener) => {
      try {
        listener(list, hasUnsaved);
      } catch (err) {
        console.error('[UnsavedChangesManager] Listener error:', err);
      }
    });
  }
}

export const unsavedChangesManager = new UnsavedChangesManagerClass();
