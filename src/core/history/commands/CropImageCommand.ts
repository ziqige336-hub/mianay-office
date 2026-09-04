import { Command, ObjectUpdateFn } from '../Command';
import type { PDFImageCropRect } from '../../../types/pdfObject';

/**
 * CropImageCommand
 * Handles non-destructive image cropping undo/redo.
 *
 * Saves ONLY operation diff: { objectId, beforeCropRect, afterCropRect }
 */
export class CropImageCommand implements Command {
  public readonly description: string;
  private beforeCropRect: PDFImageCropRect;
  private afterCropRect: PDFImageCropRect;

  constructor(
    private objectId: string,
    beforeCropRect: PDFImageCropRect,
    afterCropRect: PDFImageCropRect,
    private updateFn: ObjectUpdateFn,
    description?: string
  ) {
    this.beforeCropRect = { ...beforeCropRect };
    this.afterCropRect = { ...afterCropRect };
    this.description = description || '裁剪图片';
  }

  public execute(): void {
    this.updateFn(this.objectId, { cropRect: { ...this.afterCropRect } });
  }

  public undo(): void {
    this.updateFn(this.objectId, { cropRect: { ...this.beforeCropRect } });
  }

  public redo(): void {
    this.execute();
  }

  public getObjectId(): string {
    return this.objectId;
  }

  public getBeforeCrop(): PDFImageCropRect {
    return { ...this.beforeCropRect };
  }

  public getAfterCrop(): PDFImageCropRect {
    return { ...this.afterCropRect };
  }
}
