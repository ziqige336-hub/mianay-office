import { Command, ObjectAddFn, ObjectDeleteFn } from '../Command';

/**
 * DeleteObjectCommand
 * Handles deletion of objects with full restoration capability.
 *
 * Saves: Deleted object full snapshot + original layer index
 * Undo: Restores object at its original z-index / position in array
 * Redo: Deletes object again
 */
export class DeleteObjectCommand implements Command {
  public readonly description: string;
  private objectSnapshot: any;
  private originalIndex?: number;

  constructor(
    object: any,
    private deleteFn: ObjectDeleteFn,
    private addFn: ObjectAddFn,
    originalIndex?: number,
    description?: string
  ) {
    this.objectSnapshot = JSON.parse(JSON.stringify(object));
    this.originalIndex = originalIndex;
    this.description = description || `删除${this.getTypeLabel(object.type)}`;
  }

  public execute(): void {
    this.deleteFn(this.objectSnapshot.id);
  }

  public undo(): void {
    this.addFn(JSON.parse(JSON.stringify(this.objectSnapshot)), this.originalIndex);
  }

  public redo(): void {
    this.execute();
  }

  public getObjectId(): string {
    return this.objectSnapshot.id;
  }

  public getSnapshot(): any {
    return JSON.parse(JSON.stringify(this.objectSnapshot));
  }

  private getTypeLabel(type: string): string {
    switch (type) {
      case 'text':
        return '文字';
      case 'image':
        return '图片';
      case 'stamp':
        return '图章';
      case 'signature':
        return '签名';
      case 'shape':
        return '图形';
      case 'draw':
        return '手写笔迹';
      case 'highlight':
        return '高亮';
      default:
        return '对象';
    }
  }
}
