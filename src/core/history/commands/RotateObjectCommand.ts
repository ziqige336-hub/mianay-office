import { Command, ObjectUpdateFn } from '../Command';

/**
 * RotateObjectCommand
 * Granular undo/redo for object rotation.
 *
 * Saves ONLY operation diff: { objectId, beforeRotation, afterRotation }
 */
export class RotateObjectCommand implements Command {
  public readonly description: string;

  constructor(
    private objectId: string,
    private beforeRotation: number,
    private afterRotation: number,
    private updateFn: ObjectUpdateFn,
    description?: string
  ) {
    this.description = description || '旋转对象';
  }

  public execute(): void {
    this.updateFn(this.objectId, { rotation: this.afterRotation });
  }

  public undo(): void {
    this.updateFn(this.objectId, { rotation: this.beforeRotation });
  }

  public redo(): void {
    this.execute();
  }

  public getObjectId(): string {
    return this.objectId;
  }

  public getBeforeRotation(): number {
    return this.beforeRotation;
  }

  public getAfterRotation(): number {
    return this.afterRotation;
  }
}
