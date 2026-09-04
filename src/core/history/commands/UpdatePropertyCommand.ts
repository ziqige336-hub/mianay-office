import { Command, ObjectUpdateFn } from '../Command';

/**
 * UpdatePropertyCommand
 * Handles atomic property modifications (opacity, color, font, fontSize, locked, etc.)
 *
 * Saves ONLY operational diff: { objectId, beforeProps, afterProps }
 */
export class UpdatePropertyCommand implements Command {
  public readonly description: string;
  private beforeProps: Record<string, any>;
  private afterProps: Record<string, any>;

  constructor(
    private objectId: string,
    beforeProps: Record<string, any>,
    afterProps: Record<string, any>,
    private updateFn: ObjectUpdateFn,
    description?: string
  ) {
    this.beforeProps = JSON.parse(JSON.stringify(beforeProps));
    this.afterProps = JSON.parse(JSON.stringify(afterProps));
    this.description = description || this.generateDescription(afterProps);
  }

  public execute(): void {
    this.updateFn(this.objectId, JSON.parse(JSON.stringify(this.afterProps)));
  }

  public undo(): void {
    this.updateFn(this.objectId, JSON.parse(JSON.stringify(this.beforeProps)));
  }

  public redo(): void {
    this.execute();
  }

  public getObjectId(): string {
    return this.objectId;
  }

  public getBeforeProps(): Record<string, any> {
    return { ...this.beforeProps };
  }

  public getAfterProps(): Record<string, any> {
    return { ...this.afterProps };
  }

  private generateDescription(props: Record<string, any>): string {
    const keys = Object.keys(props || {});
    if (keys.includes('opacity')) return '修改不透明度';
    if (keys.includes('color')) return '修改颜色';
    if (keys.includes('fontFamily')) return '修改字体';
    if (keys.includes('fontSize')) return '修改字号';
    if (keys.includes('isBold')) return '切换粗体';
    if (keys.includes('isItalic')) return '切换斜体';
    if (keys.includes('textAlign')) return '修改对齐方式';
    if (keys.includes('strokeWidth')) return '修改线条粗细';
    if (keys.includes('strokeColor')) return '修改边框颜色';
    if (keys.includes('fillColor')) return '修改填充颜色';
    if (keys.includes('locked')) return props.locked ? '锁定对象' : '解锁对象';
    if (keys.includes('text')) return '编辑文字内容';
    if (keys.includes('dataUrl')) return '替换图片资源';
    return '修改对象属性';
  }
}
