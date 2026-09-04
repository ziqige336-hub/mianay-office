import { Command } from '../Command';
import type { PageMeta, PdfAnnotation } from '../../../types';
import type { PageAddFn, PageDeleteFn } from './AddPageCommand';

/**
 * DuplicatePageCommand
 * Encapsulates duplicating a page and its annotations in Lumina PDF Editor.
 */
export class DuplicatePageCommand implements Command {
  public readonly description: string;
  public readonly name: string;

  constructor(
    private duplicatedPage: PageMeta,
    private insertIndex: number,
    private addFn: PageAddFn,
    private deleteFn: PageDeleteFn,
    private clonedAnnotations: PdfAnnotation[] = [],
    description?: string
  ) {
    this.description = description || `复制第 ${insertIndex} 页`;
    this.name = this.description;
  }

  public execute(): void {
    this.addFn(this.duplicatedPage, this.insertIndex, this.clonedAnnotations);
  }

  public undo(): void {
    this.deleteFn(this.insertIndex);
  }

  public redo(): void {
    this.execute();
  }

  public getInsertIndex(): number {
    return this.insertIndex;
  }
}
