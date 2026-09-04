import { Command } from '../Command';
import type { PageMeta, PdfAnnotation } from '../../../types';
import type { PageAddFn, PageDeleteFn } from './AddPageCommand';

/**
 * DeletePageCommand
 * Encapsulates deleting a page in Lumina PDF Editor.
 * Saves deleted page metadata and associated annotations to guarantee complete restoration on undo().
 */
export class DeletePageCommand implements Command {
  public readonly description: string;
  public readonly name: string;

  constructor(
    private deletedPage: PageMeta,
    private originalIndex: number,
    private deleteFn: PageDeleteFn,
    private restoreFn: PageAddFn,
    private savedAnnotations: PdfAnnotation[] = [],
    description?: string
  ) {
    this.description = description || `删除第 ${originalIndex + 1} 页`;
    this.name = this.description;
  }

  public execute(): void {
    this.deleteFn(this.originalIndex);
  }

  public undo(): void {
    this.restoreFn(this.deletedPage, this.originalIndex, this.savedAnnotations);
  }

  public redo(): void {
    this.execute();
  }

  public getOriginalIndex(): number {
    return this.originalIndex;
  }
}
