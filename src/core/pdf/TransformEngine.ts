/**
 * TransformEngine.ts
 * Centralized geometric transformation calculations for PDF objects:
 * - Movement translation
 * - 8-direction resizing with aspect ratio preservation
 * - Free trigonometric rotation with snapping
 * - Non-destructive image cropping calculations
 */

import {
  calculateResize,
  calculateRotationAngle,
  screenDeltaToPagePercent,
  Rect,
  Point,
} from './CoordinateTransform';
import { PDFImageCropRect } from '../../types/pdfObject';
import { ResizeHandleType } from '../../components/pdf/transformer/TransformBox';

export interface TransformMoveOptions {
  startX: number;
  startY: number;
  deltaScreenX: number;
  deltaScreenY: number;
  displayWidth: number;
  displayHeight: number;
  minX?: number;
  maxX?: number;
  minY?: number;
  maxY?: number;
}

export interface TransformResizeOptions {
  handle: ResizeHandleType;
  startRect: Rect;
  deltaScreenX: number;
  deltaScreenY: number;
  displayWidth: number;
  displayHeight: number;
  lockAspectRatio?: boolean;
  minWidth?: number;
  minHeight?: number;
}

export interface TransformRotateOptions {
  centerX: number;
  centerY: number;
  mouseX: number;
  mouseY: number;
  initialOffset: number;
  shiftKey?: boolean;
}

export interface TransformCropOptions {
  handle: ResizeHandleType;
  startCropRect: PDFImageCropRect;
  deltaPctX: number; // percentage change relative to image width (0-100)
  deltaPctY: number; // percentage change relative to image height (0-100)
  minCropPct?: number; // minimum visible crop dimension (e.g. 5%)
}

export class TransformEngine {
  private static instance: TransformEngine | null = null;

  public static getInstance(): TransformEngine {
    if (!TransformEngine.instance) {
      TransformEngine.instance = new TransformEngine();
    }
    return TransformEngine.instance;
  }

  /**
   * Calculates new position (x, y in page percentage coordinates) during object dragging.
   */
  public applyMove(options: TransformMoveOptions): Point {
    const { deltaXPct, deltaYPct } = screenDeltaToPagePercent(
      options.deltaScreenX,
      options.deltaScreenY,
      options.displayWidth,
      options.displayHeight
    );

    const minX = options.minX ?? -50;
    const maxX = options.maxX ?? 150;
    const minY = options.minY ?? -50;
    const maxY = options.maxY ?? 150;

    const newX = Math.max(minX, Math.min(maxX, options.startX + deltaXPct));
    const newY = Math.max(minY, Math.min(maxY, options.startY + deltaYPct));

    return {
      x: Math.round(newX * 10) / 10,
      y: Math.round(newY * 10) / 10,
    };
  }

  /**
   * Calculates new bounding box (x, y, width, height) during 8-direction resizing.
   */
  public applyResize(options: TransformResizeOptions): Rect {
    const { deltaXPct, deltaYPct } = screenDeltaToPagePercent(
      options.deltaScreenX,
      options.deltaScreenY,
      options.displayWidth,
      options.displayHeight
    );

    return calculateResize(
      options.handle,
      options.startRect,
      deltaXPct,
      deltaYPct,
      {
        minWidth: options.minWidth ?? 2,
        minHeight: options.minHeight ?? 2,
        lockAspectRatio: options.lockAspectRatio,
      }
    );
  }

  /**
   * Calculates new rotation angle in degrees (0-360) with snapping.
   */
  public applyRotation(options: TransformRotateOptions): number {
    return calculateRotationAngle(
      options.centerX,
      options.centerY,
      options.mouseX,
      options.mouseY,
      options.initialOffset,
      options.shiftKey
    );
  }

  /**
   * Calculates non-destructive crop coordinates (in percentages 0-100) when dragging crop handles.
   */
  public applyCrop(options: TransformCropOptions): PDFImageCropRect {
    const { handle, startCropRect, deltaPctX, deltaPctY } = options;
    const minDim = options.minCropPct ?? 5;

    let x = startCropRect.x;
    let y = startCropRect.y;
    let width = startCropRect.width;
    let height = startCropRect.height;

    // East (Right edge)
    if (handle.includes('e')) {
      const maxW = 100 - x;
      width = Math.max(minDim, Math.min(maxW, startCropRect.width + deltaPctX));
    }

    // South (Bottom edge)
    if (handle.includes('s')) {
      const maxH = 100 - y;
      height = Math.max(minDim, Math.min(maxH, startCropRect.height + deltaPctY));
    }

    // West (Left edge)
    if (handle.includes('w')) {
      const maxX = startCropRect.x + startCropRect.width - minDim;
      const proposedX = Math.max(0, Math.min(maxX, startCropRect.x + deltaPctX));
      const deltaApplied = proposedX - startCropRect.x;
      x = proposedX;
      width = startCropRect.width - deltaApplied;
    }

    // North (Top edge)
    if (handle.includes('n')) {
      const maxY = startCropRect.y + startCropRect.height - minDim;
      const proposedY = Math.max(0, Math.min(maxY, startCropRect.y + deltaPctY));
      const deltaApplied = proposedY - startCropRect.y;
      y = proposedY;
      height = startCropRect.height - deltaApplied;
    }

    return this.normalizeCropRect({
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      width: Math.round(width * 10) / 10,
      height: Math.round(height * 10) / 10,
    });
  }

  /**
   * Sanitizes a crop rectangle ensuring values remain within [0, 100]% bounds.
   */
  public normalizeCropRect(cropRect?: Partial<PDFImageCropRect>): PDFImageCropRect {
    if (!cropRect) {
      return { x: 0, y: 0, width: 100, height: 100 };
    }

    const x = Math.max(0, Math.min(95, cropRect.x ?? 0));
    const y = Math.max(0, Math.min(95, cropRect.y ?? 0));
    const width = Math.max(5, Math.min(100 - x, cropRect.width ?? 100));
    const height = Math.max(5, Math.min(100 - y, cropRect.height ?? 100));

    return { x, y, width, height };
  }
}

export const transformEngine = TransformEngine.getInstance();
