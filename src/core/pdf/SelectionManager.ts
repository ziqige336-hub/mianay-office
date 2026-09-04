/**
 * SelectionManager.ts
 * Centralized selection coordinator for PDF objects, annotations, and canvas elements.
 * Provides subscription-based reactive state for single and multi-selection.
 */

export interface SelectionState {
  selectedId: string | null;
  selectedIds: string[];
}

export type SelectionListener = (state: SelectionState) => void;

export class SelectionManager {
  private static instance: SelectionManager | null = null;
  private selectedIds: Set<string> = new Set();
  private listeners: Set<SelectionListener> = new Set();

  public static getInstance(): SelectionManager {
    if (!SelectionManager.instance) {
      SelectionManager.instance = new SelectionManager();
    }
    return SelectionManager.instance;
  }

  public getState(): SelectionState {
    const selectedIds = Array.from(this.selectedIds);
    return {
      selectedId: selectedIds.length > 0 ? selectedIds[selectedIds.length - 1] : null,
      selectedIds,
    };
  }

  public getSelectedId(): string | null {
    const arr = Array.from(this.selectedIds);
    return arr.length > 0 ? arr[arr.length - 1] : null;
  }

  public getSelectedIds(): string[] {
    return Array.from(this.selectedIds);
  }

  public isSelected(id: string): boolean {
    return this.selectedIds.has(id);
  }

  public select(id: string, multiSelect: boolean = false): void {
    if (!multiSelect) {
      if (this.selectedIds.size === 1 && this.selectedIds.has(id)) {
        return; // already only this selected
      }
      this.selectedIds.clear();
      this.selectedIds.add(id);
    } else {
      if (this.selectedIds.has(id)) {
        this.selectedIds.delete(id);
      } else {
        this.selectedIds.add(id);
      }
    }
    this.notify();
  }

  public deselect(id?: string): void {
    if (!id) {
      if (this.selectedIds.size === 0) return;
      this.selectedIds.clear();
    } else {
      if (!this.selectedIds.has(id)) return;
      this.selectedIds.delete(id);
    }
    this.notify();
  }

  public clear(): void {
    if (this.selectedIds.size === 0) return;
    this.selectedIds.clear();
    this.notify();
  }

  public subscribe(listener: SelectionListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const state = this.getState();
    this.listeners.forEach((l) => l(state));
  }
}

export const selectionManager = SelectionManager.getInstance();
