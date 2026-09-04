import { Command, ObjectUpdateFn } from '../Command';

export interface Position2D {
  x: number;
  y: number;
}

/**
 * MoveObjectCommand
 * Granular undo/redo for object translation.
 *
 * Saves ONLY operation diff: { objectId, before: {x, y}, after: {x, y} }
 * Absolutely avoids full document copies.
 */
export class MoveObjectCommand implements Command {
  public readonly description: string;

  constructor(
    private objectId: string,
    private before: Position2D,
    private after: Position2D,
    private updateFn: ObjectUpdateFn,
    description?: string
  ) {
    this.description = description || '移动对象';
  }

  public execute(): void {
    this.updateFn(this.objectId, { x: this.after.x, y: this.after.y });
  }

  public undo(): void {
    this.updateFn(this.objectId, { x: this.before.x, y: this.before.y });
  }

  public redo(): void {
    this.execute();
  }

  public getObjectId(): string {
    return this.objectId;
  }

  public getBefore(): Position2D {
    return { ...this.before };
  }

  public getAfter(): Position2D {
    return { ...this.after };
  }
}
