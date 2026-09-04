import { Command } from '../Command';

export type PageRotationUpdateFn = (pageIndex: number, rotation: number) => void;

/**
 * RotatePageCommand
 * Handles individual PDF page orientation changes.
 * Saves ONLY operation diff: { pageIndex, beforeRotation, afterRotation }
 */
export class RotatePageCommand implements Command {
  public readonly description: string;
  public readonly name: string;

  constructor(
    private pageIndex: number,
    private beforeRotation: number,
    private afterRotation: number,
    private updateFn: PageRotationUpdateFn,
    description?: string
  ) {
    this.description = description || `第 ${pageIndex + 1} 页旋转 ${((afterRotation - beforeRotation + 360) % 360)}°`;
    this.name = this.description;
  }

  public execute(): void {
    this.updateFn(this.pageIndex, this.afterRotation);
  }

  public undo(): void {
    this.updateFn(this.pageIndex, this.beforeRotation);
  }

  public redo(): void {
    this.execute();
  }

  public getPageIndex(): number {
    return this.pageIndex;
  }
}
