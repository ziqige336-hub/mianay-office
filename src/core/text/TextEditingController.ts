/**
 * TextEditingController
 * Professional-grade text editing and cursor preservation controller for Lumina Office.
 * 
 * Solves:
 * 1. React re-render cursor jumping / selection reset when typing, deleting, or editing titles and annotations.
 * 2. Chinese/CJK IME (Input Method Editor) composition state disruption.
 * 3. Accurate cursor placement across deletion, insertion, copy, paste, and internal undo/redo.
 * 4. Preventing DOM textarea/input remounting or uncontrolled conflicts.
 */

export interface SelectionRange {
  start: number;
  end: number;
  direction?: 'forward' | 'backward' | 'none';
}

export type TextChangeListener = (
  value: string,
  selection: SelectionRange,
  isComposing: boolean
) => void;

export class TextEditingController {
  private element: HTMLInputElement | HTMLTextAreaElement | null = null;
  private value: string = '';
  private selection: SelectionRange = { start: 0, end: 0, direction: 'none' };
  private isComposing: boolean = false;
  private listeners: Set<TextChangeListener> = new Set();
  private undoStack: Array<{ value: string; selection: SelectionRange }> = [];
  private redoStack: Array<{ value: string; selection: SelectionRange }> = [];
  private isApplyingSelection: boolean = false;
  private isFocused: boolean = false;

  constructor(initialValue: string = '') {
    this.value = initialValue;
    this.selection = { start: initialValue.length, end: initialValue.length, direction: 'none' };
  }

  /**
   * Bind an HTML Input or TextArea element to this controller
   */
  public bindElement(element: HTMLInputElement | HTMLTextAreaElement | null): void {
    if (this.element === element) return;
    this.element = element;

    if (this.element) {
      this.element.value = this.value;
      this.restoreSelection();
    }
  }

  /**
   * Unbind the current element
   */
  public unbindElement(): void {
    this.element = null;
  }

  public getValue(): string {
    return this.value;
  }

  public getSelection(): SelectionRange {
    return { ...this.selection };
  }

  public getIsComposing(): boolean {
    return this.isComposing;
  }

  public getIsFocused(): boolean {
    return this.isFocused;
  }

  /**
   * Update value externally (e.g. from props) without breaking active editing cursor
   */
  public setValue(newValue: string, forceCursorToEnd: boolean = false): void {
    if (this.value === newValue) return;

    const prevValue = this.value;
    this.value = newValue;

    // Adjust cursor if it exceeds new length
    if (forceCursorToEnd || !this.isFocused) {
      this.selection = {
        start: newValue.length,
        end: newValue.length,
        direction: 'none',
      };
    } else {
      // Clamped preservation
      const newStart = Math.min(this.selection.start, newValue.length);
      const newEnd = Math.min(this.selection.end, newValue.length);
      this.selection = { start: newStart, end: newEnd, direction: this.selection.direction };
    }

    if (this.element && this.element.value !== newValue) {
      this.element.value = newValue;
      this.restoreSelection();
    }

    this.notify();
  }

  /**
   * Save the current DOM selection into controller state
   */
  public saveSelection(): SelectionRange {
    if (this.element) {
      this.selection = {
        start: this.element.selectionStart ?? this.value.length,
        end: this.element.selectionEnd ?? this.value.length,
        direction: this.element.selectionDirection ?? 'none',
      };
    }
    return { ...this.selection };
  }

  /**
   * Restore the selection back into the DOM element
   */
  public restoreSelection(customStart?: number, customEnd?: number): void {
    if (this.isApplyingSelection || !this.element) return;

    const start = customStart !== undefined ? customStart : this.selection.start;
    const end = customEnd !== undefined ? customEnd : this.selection.end;
    const clampedStart = Math.max(0, Math.min(start, this.value.length));
    const clampedEnd = Math.max(clampedStart, Math.min(end, this.value.length));

    this.selection = {
      start: clampedStart,
      end: clampedEnd,
      direction: this.selection.direction,
    };

    this.isApplyingSelection = true;
    requestAnimationFrame(() => {
      try {
        if (this.element && document.activeElement === this.element) {
          this.element.setSelectionRange(
            clampedStart,
            clampedEnd,
            this.selection.direction || 'none'
          );
        }
      } catch (err) {
        // Ignore selection range errors if element unmounted
      } finally {
        this.isApplyingSelection = false;
      }
    });
  }

  /**
   * Handle standard DOM input events (typing, deleting, pasting)
   */
  public handleInput(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void {
    const target = e.target;
    const nextVal = target.value;
    const nextStart = target.selectionStart ?? nextVal.length;
    const nextEnd = target.selectionEnd ?? nextVal.length;

    if (!this.isComposing) {
      this.pushHistorySnapshot();
    }

    this.value = nextVal;
    this.selection = {
      start: nextStart,
      end: nextEnd,
      direction: target.selectionDirection ?? 'none',
    };

    this.notify();

    // Schedule instant cursor restoration to prevent React controlled state reset
    this.restoreSelection(nextStart, nextEnd);
  }

  /**
   * Handle Chinese / IME composition start
   */
  public handleCompositionStart(): void {
    this.isComposing = true;
    this.saveSelection();
    this.notify();
  }

  /**
   * Handle Chinese / IME composition update
   */
  public handleCompositionUpdate(): void {
    this.isComposing = true;
    this.saveSelection();
  }

  /**
   * Handle Chinese / IME composition end
   */
  public handleCompositionEnd(e: React.CompositionEvent<HTMLInputElement | HTMLTextAreaElement>): void {
    this.isComposing = false;
    const target = e.currentTarget;
    const finalVal = target.value;
    const finalStart = target.selectionStart ?? finalVal.length;
    const finalEnd = target.selectionEnd ?? finalVal.length;

    this.pushHistorySnapshot();
    this.value = finalVal;
    this.selection = {
      start: finalStart,
      end: finalEnd,
      direction: target.selectionDirection ?? 'none',
    };

    this.notify();
    this.restoreSelection(finalStart, finalEnd);
  }

  public handleFocus(): void {
    this.isFocused = true;
    this.saveSelection();
  }

  public handleBlur(): void {
    this.isFocused = false;
    this.saveSelection();
  }

  /**
   * Insert arbitrary text at current cursor position
   */
  public insertText(textToInsert: string): void {
    this.saveSelection();
    this.pushHistorySnapshot();

    const { start, end } = this.selection;
    const before = this.value.slice(0, start);
    const after = this.value.slice(end);
    const nextVal = before + textToInsert + after;
    const newCursor = start + textToInsert.length;

    this.value = nextVal;
    this.selection = { start: newCursor, end: newCursor, direction: 'none' };

    if (this.element) {
      this.element.value = nextVal;
    }

    this.notify();
    this.restoreSelection(newCursor, newCursor);
  }

  /**
   * Delete text at cursor or delete current selection
   */
  public deleteText(direction: 'back' | 'forward' = 'back'): void {
    this.saveSelection();
    const { start, end } = this.selection;

    if (start !== end) {
      // Range delete
      this.insertText('');
      return;
    }

    if (direction === 'back' && start > 0) {
      this.pushHistorySnapshot();
      const before = this.value.slice(0, start - 1);
      const after = this.value.slice(start);
      const nextVal = before + after;
      const newCursor = start - 1;

      this.value = nextVal;
      this.selection = { start: newCursor, end: newCursor, direction: 'none' };
      if (this.element) {
        this.element.value = nextVal;
      }
      this.notify();
      this.restoreSelection(newCursor, newCursor);
    } else if (direction === 'forward' && start < this.value.length) {
      this.pushHistorySnapshot();
      const before = this.value.slice(0, start);
      const after = this.value.slice(start + 1);
      const nextVal = before + after;
      const newCursor = start;

      this.value = nextVal;
      this.selection = { start: newCursor, end: newCursor, direction: 'none' };
      if (this.element) {
        this.element.value = nextVal;
      }
      this.notify();
      this.restoreSelection(newCursor, newCursor);
    }
  }

  /**
   * Push current text state to local undo stack
   */
  private pushHistorySnapshot(): void {
    this.undoStack.push({
      value: this.value,
      selection: { ...this.selection },
    });
    if (this.undoStack.length > 50) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  public undo(): boolean {
    if (this.undoStack.length === 0) return false;
    const current = { value: this.value, selection: { ...this.selection } };
    const prev = this.undoStack.pop()!;
    this.redoStack.push(current);

    this.value = prev.value;
    this.selection = prev.selection;
    if (this.element) {
      this.element.value = prev.value;
    }
    this.notify();
    this.restoreSelection();
    return true;
  }

  public redo(): boolean {
    if (this.redoStack.length === 0) return false;
    const current = { value: this.value, selection: { ...this.selection } };
    const next = this.redoStack.pop()!;
    this.undoStack.push(current);

    this.value = next.value;
    this.selection = next.selection;
    if (this.element) {
      this.element.value = next.value;
    }
    this.notify();
    this.restoreSelection();
    return true;
  }

  public subscribe(listener: TextChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.value, { ...this.selection }, this.isComposing);
      } catch (err) {
        console.error('Error in TextEditingController listener:', err);
      }
    });
  }
}
