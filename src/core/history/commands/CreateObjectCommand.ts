import { Command, ObjectAddFn, ObjectDeleteFn } from '../Command';

/**
 * CreateObjectCommand
 * Handles creation of new objects (text, image, stamp, watermark, shapes, signatures).
 *
 * Saves: Single object snapshot (isolated diff, no full PDF copy)
 * Undo: Removes object from document model
 * Redo: Restores object to document model
 */
export class CreateObjectCommand implements Command {
  public readonly description: string;
  private objectSnapshot: any;
  private targetIndex?: number;

  constructor(
    object: any,
    private addFn: ObjectAddFn,
    private deleteFn: ObjectDeleteFn,
    targetIndex?: number,
    description?: string
  ) {
    // Deep clone single object to ensure immutability
    this.objectSnapshot = JSON.parse(JSON.stringify(object));
    this.targetIndex = targetIndex;
    this.description = description || `添加${this.getTypeLabel(object.type)}`;
  }

  public execute(): void {
    this.addFn(JSON.parse(JSON.stringify(this.objectSnapshot)), this.targetIndex);
  }

  public undo(): void {
    this.deleteFn(this.objectSnapshot.id);
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
      case 'comment':
        return '批注评论';
      case 'redact':
        return '密文涂抹';
      case 'eraser-mask':
        return '擦除遮罩';
      default:
        return '对象';
    }
  }
}
