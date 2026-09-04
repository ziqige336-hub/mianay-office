/**
 * Command.ts
 * Core Command Interface for Lumina PDF Editor History Engine.
 * Follows the Gang-of-Four Command Pattern for reversible state mutations.
 */

export interface Command {
  execute(): void;
  undo(): void;
  redo(): void;
  description: string;
  name?: string;
}

export interface ObjectUpdateFn {
  (id: string, updates: Record<string, any>): void;
}

export interface ObjectAddFn {
  (object: any, index?: number): void;
}

export interface ObjectDeleteFn {
  (id: string): void;
}
