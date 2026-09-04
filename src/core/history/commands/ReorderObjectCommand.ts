import { Command } from '../Command';

export interface ObjectReorderFn {
  (id: string, newIndex: number): void;
}

/**
 * ReorderObjectCommand
 * Handles layer z-ordering (bring forward, send backward, bring to front, send to back).
 *
 * Saves ONLY operation diff: { objectId, prevIndex, nextIndex }
 */
export class ReorderObjectCommand implements Command {
  public readonly description: string;

  constructor(
    private objectId: string,
    private prevIndex: number,
    private nextIndex: number,
    private reorderFn: ObjectReorderFn,
    description?: string
  ) {
    this.description = description || '调整图层层级';
  }

  public execute(): void {
    this.reorderFn(this.objectId, this.nextIndex);
  }

  public undo(): void {
    this.reorderFn(this.objectId, this.prevIndex);
  }

  public redo(): void {
    this.execute();
  }

  public getObjectId(): string {
    return this.objectId;
  }
}
