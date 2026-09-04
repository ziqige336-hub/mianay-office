// ==================== UNIFIED PDF OBJECT MODEL ====================

export type PDFObjectType =
  | 'text'
  | 'image'
  | 'stamp'
  | 'watermark'
  | 'signature'
  | 'shape'
  | 'highlight'
  | 'measurement'
  | 'draw'
  | 'comment'
  | 'redact'
  | 'form-field'
  | 'eraser-mask';

export interface BasePDFObject {
  id: string;
  pageIndex: number;
  type: PDFObjectType;
  x: number; // percentage (0-100) relative to page width
  y: number; // percentage (0-100) relative to page height
  width: number; // percentage (0-100)
  height: number; // percentage (0-100)
  rotation: number; // degrees 0-360
  scaleX: number; // 1.0 default
  scaleY: number; // 1.0 default
  opacity: number; // 0.0 - 1.0
  zIndex: number;
  locked: boolean;
  visible: boolean;
  createdAt: number;
  updatedAt?: number;
}

export interface PDFTextObject extends BasePDFObject {
  type: 'text';
  text: string;
  fontSize: number;
  color: string;
  fontFamily?: string;
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  isStrikethrough?: boolean;
  backgroundColor?: string;
  textAlign?: 'left' | 'center' | 'right';
  isOriginalReplacement?: boolean;
  originalText?: string;
}

export interface PDFImageCropRect {
  x: number; // percentage 0-100 relative to original image width
  y: number; // percentage 0-100 relative to original image height
  width: number; // percentage 0-100
  height: number; // percentage 0-100
}

export interface PDFImageObject extends BasePDFObject {
  type: 'image';
  dataUrl: string;
  originalDataUrl?: string; // pristine unmodified source data
  cropRect?: PDFImageCropRect; // non-destructive crop window
  aspectRatioLocked?: boolean;
  naturalWidth?: number;
  naturalHeight?: number;
  filter?: string;
}

export type PDFStampType =
  | 'APPROVED'
  | 'CONFIDENTIAL'
  | 'URGENT'
  | 'PAID'
  | 'COMPLETED'
  | 'REJECTED'
  | 'DRAFT'
  | 'CUSTOM';

export interface PDFStampObject extends BasePDFObject {
  type: 'stamp';
  stampType: PDFStampType;
  customText?: string;
  color: string;
  dataUrl?: string;
}

export interface PDFWatermarkObject extends BasePDFObject {
  type: 'watermark';
  watermarkType: 'text' | 'image';
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  imageUrl?: string;
  isTiled?: boolean;
  tileSpacing?: number;
}

export interface PDFSignatureObject extends BasePDFObject {
  type: 'signature';
  dataUrl: string;
  signerName?: string;
  signDate?: string;
  isVerified?: boolean;
}

export interface PDFShapeObject extends BasePDFObject {
  type: 'shape';
  shapeType: 'rect' | 'circle' | 'arrow' | 'line' | 'table';
  strokeColor: string;
  fillColor?: string;
  strokeWidth: number;
  strokeDash?: 'solid' | 'dashed';
  rows?: number;
  cols?: number;
}

export interface PDFHighlightObject extends BasePDFObject {
  type: 'highlight';
  color: string;
}

export interface PDFMeasurementObject extends BasePDFObject {
  type: 'measurement';
  measureType: 'distance' | 'area';
  points: { x: number; y: number }[];
  valueText: string;
  unit: 'mm' | 'cm' | 'm' | 'px';
  scaleRatio: number;
}

export interface PDFDrawingObject extends BasePDFObject {
  type: 'draw';
  points: { x: number; y: number }[];
  color: string;
  strokeWidth: number;
}

export interface PDFCommentObject extends BasePDFObject {
  type: 'comment';
  text: string;
  author: string;
  resolved?: boolean;
  color: string;
  replies?: { id: string; author: string; text: string; time: number }[];
}

export interface PDFRedactionObject extends BasePDFObject {
  type: 'redact';
  fillColor: string;
  isApplied: boolean;
  overlayText?: string;
}

export interface PDFFormFieldObject extends BasePDFObject {
  type: 'form-field';
  fieldType: 'text' | 'checkbox' | 'radio' | 'dropdown';
  fieldName: string;
  value: string;
  checked?: boolean;
  options?: string[];
  required?: boolean;
}

export interface PDFEraserMaskObject extends BasePDFObject {
  type: 'eraser-mask';
  fillColor: string;
}

export type PDFUnifiedObject =
  | PDFTextObject
  | PDFImageObject
  | PDFStampObject
  | PDFWatermarkObject
  | PDFSignatureObject
  | PDFShapeObject
  | PDFHighlightObject
  | PDFMeasurementObject
  | PDFDrawingObject
  | PDFCommentObject
  | PDFRedactionObject
  | PDFFormFieldObject
  | PDFEraserMaskObject;

/**
 * Ensures all unified fields (x, y, width, height, rotation, scaleX, scaleY, opacity, zIndex, locked, visible)
 * have well-defined default values.
 */
export function normalizePDFObject(obj: any): PDFUnifiedObject {
  const defaults: BasePDFObject = {
    id: obj.id || `obj-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    pageIndex: typeof obj.pageIndex === 'number' ? obj.pageIndex : 0,
    type: obj.type || 'text',
    x: typeof obj.x === 'number' ? obj.x : 10,
    y: typeof obj.y === 'number' ? obj.y : 10,
    width: typeof obj.width === 'number' ? obj.width : 25,
    height: typeof obj.height === 'number' ? obj.height : 10,
    rotation: typeof obj.rotation === 'number' ? obj.rotation : 0,
    scaleX: typeof obj.scaleX === 'number' ? obj.scaleX : 1,
    scaleY: typeof obj.scaleY === 'number' ? obj.scaleY : 1,
    opacity: typeof obj.opacity === 'number' ? obj.opacity : 1,
    zIndex: typeof obj.zIndex === 'number' ? obj.zIndex : 1,
    locked: Boolean(obj.locked),
    visible: obj.visible !== false,
    createdAt: obj.createdAt || Date.now(),
  };

  return {
    ...defaults,
    ...obj,
    // ensure numeric sanitization
    x: Math.max(-50, Math.min(150, defaults.x)),
    y: Math.max(-50, Math.min(150, defaults.y)),
    width: Math.max(1, defaults.width),
    height: Math.max(1, defaults.height),
    rotation: ((defaults.rotation % 360) + 360) % 360,
    ...(defaults.type === 'image'
      ? {
          aspectRatioLocked: obj.aspectRatioLocked !== false,
          cropRect: obj.cropRect
            ? {
                x: Math.max(0, Math.min(95, obj.cropRect.x ?? 0)),
                y: Math.max(0, Math.min(95, obj.cropRect.y ?? 0)),
                width: Math.max(5, Math.min(100 - (obj.cropRect.x ?? 0), obj.cropRect.width ?? 100)),
                height: Math.max(5, Math.min(100 - (obj.cropRect.y ?? 0), obj.cropRect.height ?? 100)),
              }
            : { x: 0, y: 0, width: 100, height: 100 },
        }
      : {}),
  };
}
