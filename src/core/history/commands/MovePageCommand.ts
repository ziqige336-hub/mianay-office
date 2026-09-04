import { Command } from '../Command';

export type PageMoveFn = (fromIndex: number, toIndex: number) => void;

/**
 * MovePageCommand
 * Encapsulates moving/reordering a page within the document.
 * Supports undo() and redo() via reverse index transposition.
 */
export class MovePageCommand implements Command {
  public readonly description: string;
  public readonly name: string;

  constructor(
    private fromIndex: number,
    private toIndex: number,
    private moveFn: PageMoveFn,
    description?: string
  ) {
    this.description = description || `移动页面从第 ${fromIndex + 1} 页至第 ${toIndex + 1} 页`;
    this.name = this.description;
  }

  public execute(): void {
    this.moveFn(this.fromIndex, this.toIndex);
  }

  public undo(): void {
    this.moveFn(this.toIndex, this.fromIndex);
  }

  public redo(): void {
    this.execute();
  }

  public getFromIndex(): number {
    return this.fromIndex;
  }

  public getToIndex(): number {
    return this.toIndex;
  }
}
