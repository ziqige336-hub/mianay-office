/**
 * CommandSystem.ts
 * Unified bridge to the core History Engine for Lumina PDF.
 * Re-exports the professional HistoryManager and all concrete commands.
 */

import { PDFUnifiedObject, PDFImageCropRect } from '../../types/pdfObject';
import {
  Command,
  HistoryManager,
  historyManager,
  CreateObjectCommand,
  DeleteObjectCommand,
  MoveObjectCommand,
  ResizeObjectCommand,
  RotateObjectCommand,
  CropImageCommand,
  UpdatePropertyCommand,
  ReorderObjectCommand,
  ObjectUpdateFn,
  ObjectAddFn,
  ObjectDeleteFn,
} from '../history';

export type ICommand = Command;
export {
  HistoryManager,
  HistoryManager as CommandManager,
  historyManager,
  historyManager as commandManager,
  CreateObjectCommand,
  CreateObjectCommand as AddObjectCommand,
  DeleteObjectCommand,
  MoveObjectCommand,
  ResizeObjectCommand,
  RotateObjectCommand,
  CropImageCommand,
  UpdatePropertyCommand,
  ReorderObjectCommand,
};
export type { ObjectUpdateFn, ObjectAddFn, ObjectDeleteFn };

export type CommandSystemListener = () => void;

/**
 * Legacy TransformObjectCommand adapter for composite transformations
 */
export class TransformObjectCommand implements Command {
  public id: string;
  public timestamp: number;
  public description: string;
  public name: string;

  constructor(
    private objectId: string,
    private prevTransform: {
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
    },
    private nextTransform: {
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
    },
    private updateFn: (id: string, updates: any) => void,
    description: string = '变换对象'
  ) {
    this.id = `cmd-tf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    this.timestamp = Date.now();
    this.description = description;
    this.name = description;
  }

  public execute(): void {
    this.updateFn(this.objectId, this.nextTransform);
  }

  public undo(): void {
    this.updateFn(this.objectId, this.prevTransform);
  }

  public redo(): void {
    this.updateFn(this.objectId, this.nextTransform);
  }
}

/**
 * Command: Non-Destructive Image Replace
 */
export class ReplaceImageCommand implements Command {
  public id: string;
  public timestamp: number;
  public description: string;
  public name: string;

  constructor(
    private objectId: string,
    private prevData: { dataUrl: string; cropRect?: PDFImageCropRect },
    private nextData: { dataUrl: string; cropRect?: PDFImageCropRect },
    private updateFn: (id: string, updates: any) => void,
    description: string = '替换图片资源'
  ) {
    this.id = `cmd-replace-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    this.timestamp = Date.now();
    this.description = description;
    this.name = description;
  }

  public execute(): void {
    this.updateFn(this.objectId, {
      dataUrl: this.nextData.dataUrl,
      cropRect: this.nextData.cropRect,
    });
  }

  public undo(): void {
    this.updateFn(this.objectId, {
      dataUrl: this.prevData.dataUrl,
      cropRect: this.prevData.cropRect,
    });
  }

  public redo(): void {
    this.execute();
  }
}
