import { Command, ObjectUpdateFn } from '../Command';

export interface ResizeTransform {
  x?: number;
  y?: number;
  width: number;
  height: number;
  scaleX?: number;
  scaleY?: number;
}

/**
 * ResizeObjectCommand
 * Granular undo/redo for object scaling & resizing.
 *
 * Saves ONLY operation diff: { objectId, before: ResizeTransform, after: ResizeTransform }
 */
export class ResizeObjectCommand implements Command {
  public readonly description: string;

  constructor(
    private objectId: string,
    private before: ResizeTransform,
    private after: ResizeTransform,
    private updateFn: ObjectUpdateFn,
    description?: string
  ) {
    this.description = description || '缩放对象';
  }

  public execute(): void {
    this.updateFn(this.objectId, {
      ...(this.after.x !== undefined ? { x: this.after.x } : {}),
      ...(this.after.y !== undefined ? { y: this.after.y } : {}),
      width: this.after.width,
      height: this.after.height,
      scaleX: this.after.scaleX ?? 1,
      scaleY: this.after.scaleY ?? 1,
    });
  }

  public undo(): void {
    this.updateFn(this.objectId, {
      ...(this.before.x !== undefined ? { x: this.before.x } : {}),
      ...(this.before.y !== undefined ? { y: this.before.y } : {}),
      width: this.before.width,
      height: this.before.height,
      scaleX: this.before.scaleX ?? 1,
      scaleY: this.before.scaleY ?? 1,
    });
  }

  public redo(): void {
    this.execute();
  }

  public getObjectId(): string {
    return this.objectId;
  }
}
