import { Command } from './Command';

/**
 * HistoryManager
 * High-performance, professional editor-grade Undo / Redo engine for Lumina PDF.
 *
 * Execution Rules:
 * - execute(command): command.execute() -> push undoStack -> clear redoStack
 * - undo(): pop undoStack -> command.undo() -> push redoStack
 * - redo(): pop redoStack -> command.redo() -> push undoStack
 *
 * Performance: Stores operation diffs only, strictly prohibits whole-document snapshots.
 */
export class HistoryManager {
  private static instance: HistoryManager | null = null;
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxHistorySize: number = 50;
  private listeners: Set<() => void> = new Set();
  private isExecutingInternal: boolean = false;

  public constructor(maxHistorySize: number = 50) {
    this.maxHistorySize = maxHistorySize;
  }

  public static getInstance(): HistoryManager {
    if (!HistoryManager.instance) {
      HistoryManager.instance = new HistoryManager();
    }
    return HistoryManager.instance;
  }

  /**
   * Execute a command and record it onto the undo stack.
   * Clears the redo stack.
   */
  public execute(command: Command): void {
    if (this.isExecutingInternal) {
      // Guard against re-entrant calls
      command.execute();
      return;
    }

    try {
      this.isExecutingInternal = true;
      command.execute();
    } finally {
      this.isExecutingInternal = false;
    }

    this.undoStack.push(command);
    if (this.undoStack.length > this.maxHistorySize) {
      this.undoStack.shift();
    }

    // A new action invalidates future redo history
    this.redoStack = [];
    this.notify();
  }

  /**
   * Alias for execute() to support CommandManager signature
   */
  public executeCommand(command: Command): void {
    this.execute(command);
  }

  /**
   * Undo the latest command.
   * Returns true if a command was undone, false otherwise.
   */
  public undo(): boolean {
    if (!this.canUndo()) {
      return false;
    }

    const command = this.undoStack.pop()!;
    try {
      this.isExecutingInternal = true;
      command.undo();
    } finally {
      this.isExecutingInternal = false;
    }

    this.redoStack.push(command);
    this.notify();
    return true;
  }

  /**
   * Redo the previously undone command.
   * Returns true if a command was redone, false otherwise.
   */
  public redo(): boolean {
    if (!this.canRedo()) {
      return false;
    }

    const command = this.redoStack.pop()!;
    try {
      this.isExecutingInternal = true;
      command.redo();
    } finally {
      this.isExecutingInternal = false;
    }

    this.undoStack.push(command);
    this.notify();
    return true;
  }

  /**
   * Whether undo is currently available
   */
  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Whether redo is currently available
   */
  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Clears all history (e.g. on opening a new document)
   */
  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }

  /**
   * Description of the command that will be undone on next undo()
   */
  public getLastUndoDescription(): string | null {
    if (this.undoStack.length === 0) return null;
    return this.undoStack[this.undoStack.length - 1].description;
  }

  /**
   * Description of the command that will be redone on next redo()
   */
  public getLastRedoDescription(): string | null {
    if (this.redoStack.length === 0) return null;
    return this.redoStack[this.redoStack.length - 1].description;
  }

  public getUndoStackNames(): string[] {
    return this.undoStack.map((c) => c.name || c.description);
  }

  public getRedoStackNames(): string[] {
    return this.redoStack.map((c) => c.name || c.description);
  }

  public getUndoCount(): number {
    return this.undoStack.length;
  }

  public getRedoCount(): number {
    return this.redoStack.length;
  }

  public getUndoStack(): ReadonlyArray<Command> {
    return [...this.undoStack];
  }

  public getRedoStack(): ReadonlyArray<Command> {
    return [...this.redoStack];
  }

  /**
   * Subscribe to history state changes (undo/redo stack mutations)
   */
  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Error in HistoryManager listener:', err);
      }
    });
  }
}

export const historyManager = HistoryManager.getInstance();
