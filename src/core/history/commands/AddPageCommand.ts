import { Command } from '../Command';
import type { PageMeta, PdfAnnotation } from '../../../types';

export type PageAddFn = (page: PageMeta, index: number, annotations?: PdfAnnotation[]) => void;
export type PageDeleteFn = (index: number) => void;

/**
 * AddPageCommand
 * Encapsulates adding or inserting a page in Lumina PDF Editor.
 * Fully supports undo() and redo() via HistoryManager.
 */
export class AddPageCommand implements Command {
  public readonly description: string;
  public readonly name: string;

  constructor(
    private page: PageMeta,
    private targetIndex: number,
    private addFn: PageAddFn,
    private deleteFn: PageDeleteFn,
    private initialAnnotations: PdfAnnotation[] = [],
    description?: string
  ) {
    this.description = description || `在第 ${targetIndex + 1} 页位置插入页面`;
    this.name = this.description;
  }

  public execute(): void {
    this.addFn(this.page, this.targetIndex, this.initialAnnotations);
  }

  public undo(): void {
    this.deleteFn(this.targetIndex);
  }

  public redo(): void {
    this.execute();
  }

  public getTargetIndex(): number {
    return this.targetIndex;
  }
}
