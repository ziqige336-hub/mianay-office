export type AppModule = 'home' | 'pdf' | 'doc' | 'sheet' | 'tools';

export type ThemeMode = 'light' | 'dark' | 'system';

// ==================== FILE MANAGEMENT SYSTEM ====================

export type FileType = 'doc' | 'sheet' | 'pdf';

export interface VersionHistoryItem {
  id: string;
  timestamp: number;
  summary: string;
  author?: string;
  content: any; // snapshot of document data
}

export interface OfficeFile {
  id: string;
  name: string;
  type: FileType;
  createdAt: number;
  modifiedAt: number;
  isFavorite?: boolean;
  isTrash?: boolean;
  saveStatus?: 'saved' | 'saving' | 'unsaved';
  content: any; // HTML string for Doc, WorkbookData for Sheet, { pdfBytes: Uint8Array | number[], annotations: PdfAnnotation[], pages: PageMeta[] } for PDF
  versionHistory: VersionHistoryItem[];
}

export type HomeViewFilter = 'all' | 'recent' | 'favorites' | 'trash' | 'doc' | 'sheet' | 'pdf';

export interface TabItem {
  id: string;
  fileId: string;
  title: string;
  type: FileType;
  isModified?: boolean;
}

// ==================== PDF MODULE TYPES ====================

export type PdfToolbarCategory =
  | 'home'
  | 'edit'
  | 'page'
  | 'merge-split'
  | 'comment'
  | 'sign'
  | 'security'
  | 'convert'
  | 'tools';

export type PdfToolMode =
  | 'select'
  | 'hand'
  | 'text'
  | 'textbox'
  | 'image'
  | 'rect'
  | 'circle'
  | 'arrow'
  | 'line'
  | 'table'
  | 'highlight'
  | 'underline'
  | 'strikethrough'
  | 'squiggly'
  | 'signature'
  | 'stamp'
  | 'draw'
  | 'comment'
  | 'redact'
  | 'form-text'
  | 'form-checkbox'
  | 'form-radio'
  | 'form-dropdown'
  | 'measure-distance'
  | 'measure-area'
  | 'scanned-eraser';

export type PdfViewMode = 'single' | 'double' | 'continuous';

export interface Point {
  x: number;
  y: number;
}

export interface AnnotationBase {
  id: string;
  pageIndex: number;
  createdAt: number;
}

export interface TextAnnotation extends AnnotationBase {
  type: 'text';
  x: number; // percentage (0-100) or pt
  y: number;
  width?: number;
  height?: number;
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
  opacity?: number;
  rotation?: number;
  isOriginalReplacement?: boolean;
  originalText?: string;
}

export interface ShapeAnnotation extends AnnotationBase {
  type: 'shape';
  shapeType: 'rect' | 'circle' | 'arrow' | 'line' | 'table';
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor: string;
  fillColor?: string;
  strokeWidth: number;
  strokeDash?: 'solid' | 'dashed';
  opacity?: number;
  rows?: number;
  cols?: number;
}

export interface HighlightAnnotation extends AnnotationBase {
  type: 'highlight';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  opacity: number;
}

export interface UnderlineAnnotation extends AnnotationBase {
  type: 'underline';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface StrikethroughAnnotation extends AnnotationBase {
  type: 'strikethrough';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface SquigglyAnnotation extends AnnotationBase {
  type: 'squiggly';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface DrawingAnnotation extends AnnotationBase {
  type: 'draw';
  points: Point[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  color: string;
  strokeWidth: number;
  opacity: number;
}

export interface SignatureAnnotation extends AnnotationBase {
  type: 'signature';
  x: number;
  y: number;
  width: number;
  height: number;
  dataUrl: string;
  signerName?: string;
  signDate?: string;
  isVerified?: boolean;
}

export interface ImageAnnotation extends AnnotationBase {
  type: 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  dataUrl: string;
  opacity?: number;
  rotation?: number;
  aspectRatioLocked?: boolean;
}

export interface CommentAnnotation extends AnnotationBase {
  type: 'comment';
  x: number;
  y: number;
  text: string;
  author: string;
  resolved?: boolean;
  color: string;
  replies?: { id: string; author: string; text: string; time: number }[];
}

export type StampType = 'APPROVED' | 'CONFIDENTIAL' | 'URGENT' | 'PAID' | 'COMPLETED' | 'REJECTED' | 'DRAFT' | 'CUSTOM';

export interface StampAnnotation extends AnnotationBase {
  type: 'stamp';
  x: number;
  y: number;
  stampType: StampType;
  customText?: string;
  color: string;
  dataUrl?: string; // custom image stamp
}

export interface RedactionAnnotation extends AnnotationBase {
  type: 'redact';
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor: string; // usually #000000
  isApplied: boolean; // permanently baked & stripped
  overlayText?: string;
}

export interface FormFieldAnnotation extends AnnotationBase {
  type: 'form-field';
  fieldType: 'text' | 'checkbox' | 'radio' | 'dropdown';
  x: number;
  y: number;
  width: number;
  height: number;
  fieldName: string;
  value: string;
  checked?: boolean;
  options?: string[];
  required?: boolean;
}

export interface MeasureAnnotation extends AnnotationBase {
  type: 'measure';
  measureType: 'distance' | 'area';
  points: Point[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  valueText: string;
  unit: 'mm' | 'cm' | 'm' | 'px';
  scaleRatio: number; // 1px = X mm
}

export interface EraserMaskAnnotation extends AnnotationBase {
  type: 'eraser-mask';
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor: string; // e.g. '#ffffff' or sampled background color
}

import type { PDFUnifiedObject } from './pdfObject';
export * from './pdfObject';

export type PdfAnnotation =
  | TextAnnotation
  | ShapeAnnotation
  | HighlightAnnotation
  | UnderlineAnnotation
  | StrikethroughAnnotation
  | SquigglyAnnotation
  | DrawingAnnotation
  | SignatureAnnotation
  | ImageAnnotation
  | CommentAnnotation
  | StampAnnotation
  | RedactionAnnotation
  | FormFieldAnnotation
  | MeasureAnnotation
  | EraserMaskAnnotation
  | PDFUnifiedObject;

export interface WatermarkConfig {
  type: 'text' | 'image';
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  opacity: number;
  rotation: number;
  isTiled: boolean;
  tileSpacing: number;
  imageUrl?: string;
  scale: number;
  targetPages: 'all' | 'current' | 'odd' | 'even' | 'custom';
  pageRange?: string;
}

export interface SecurityConfig {
  hasPassword: boolean;
  userPassword?: string;
  ownerPassword?: string;
  allowPrinting: boolean;
  allowCopying: boolean;
  allowModifying: boolean;
  encryptionKeyLength: 128 | 256;
}

export interface SearchMatchItem {
  pageIndex: number;
  matchIndex: number;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfObjectItem {
  id: string;
  pageIndex: number;
  type: 'text' | 'image' | 'vector' | 'annotation';
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  opacity?: number;
  rotation?: number;
  isWatermarkSuspect?: boolean;
  selected?: boolean;
}

export interface DetectedWatermarkItem {
  id: string;
  content: string;
  pageIndex: number;
  type: 'text' | 'image' | 'annotation' | 'transparent';
  confidence: number;
  selected: boolean;
  rect?: { x: number; y: number; width: number; height: number };
  locationDescription?: string;
  suggestedAction?: string;
  rotation?: number;
  opacity?: number;
  repeatCount?: number;
}

export interface PageMeta {
  pageIndex: number;
  originalIndex: number;
  rotation: number; // 0, 90, 180, 270
  width: number;
  height: number;
  scale: number;
  aspectRatio: number;
  thumbnailUrl?: string;
  detectedWatermarks: DetectedWatermarkItem[];
  objects?: PdfObjectItem[];
  isDeleted?: boolean;
}

export interface PdfDocumentState {
  file: File | null;
  fileName: string;
  fileSize: number;
  pageCount: number;
  pages: PageMeta[];
  annotations: PdfAnnotation[];
  currentPageIndex: number;
  zoom: number; // e.g. 1.0 = 100%
  pdfBytes: Uint8Array | null;
  isModified: boolean;
  historyStack?: Uint8Array[];
}

// ==================== PURE DOC TYPES ====================

export interface DocOutlineItem {
  id: string;
  title: string;
  level: 1 | 2 | 3;
  pos: number;
}

export interface DocPageLayoutSettings {
  paperSize: 'A4' | 'Letter' | 'A3' | 'Legal';
  orientation: 'portrait' | 'landscape';
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  columns: 1 | 2 | 3;
  headerText?: string;
  footerText?: string;
  showPageNumbers?: boolean;
}

export interface DocBlock {
  id: string;
  type: 'paragraph' | 'heading-1' | 'heading-2' | 'heading-3' | 'bullet' | 'ordered' | 'number' | 'quote' | 'callout' | 'code' | 'divider' | 'table' | 'image';
  content?: string;
  level?: number;
  checked?: boolean;
  tableData?: string[][];
}

export interface FormattedRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string; // hex without #
  highlight?: string;
  size?: number; // pt
  fontFamily?: string;
  subscript?: boolean;
  superscript?: boolean;
  vanished?: boolean;
}

export interface DocTableCell {
  text: string;
  bold?: boolean;
  bg?: string;
  colSpan?: number;
  rowSpan?: number;
  runs?: FormattedRun[];
}

export interface DocTableData {
  headers?: string[];
  rows: DocTableCell[][];
}

export interface StructuredDocNode {
  type: 'heading' | 'paragraph' | 'bullet' | 'ordered' | 'quote' | 'table' | 'divider' | 'image' | 'code' | 'page-break';
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  runs: FormattedRun[];
  align?: 'left' | 'center' | 'right' | 'justify';
  indent?: { firstLine?: number; left?: number; right?: number };
  spacing?: { before?: number; after?: number; line?: number };
  tableData?: DocTableData;
  imageData?: { src: string; width?: number; height?: number; alt?: string; ocrText?: string };
}

export interface DocumentModel {
  id?: string;
  title: string;
  updatedAt: number;
  nodes: StructuredDocNode[];
  blocks?: StructuredDocNode[];
  proseMirrorJson?: any;
  layoutSettings?: DocPageLayoutSettings;
  metadata?: {
    id?: string;
    title?: string;
    author?: string;
    createdAt?: number;
    updatedAt?: number;
  };
}

export interface PureDocument {
  id: string;
  title: string;
  updatedAt: number;
  model?: DocumentModel;
  nodes?: StructuredDocNode[];
  proseMirrorJson?: any;
  htmlContent?: string;
  blocks?: DocBlock[];
  layoutSettings?: DocPageLayoutSettings;
}

// ==================== PURE SHEET TYPES ====================

export interface BorderSideConfig {
  style?: 'solid' | 'dashed' | 'dotted' | 'double' | 'none' | 'thin' | 'medium' | 'thick';
  color?: string;
  width?: number;
}

export interface CellBorderConfig {
  top?: boolean;
  bottom?: boolean;
  left?: boolean;
  right?: boolean;
  borderTop?: BorderSideConfig;
  borderBottom?: BorderSideConfig;
  borderLeft?: BorderSideConfig;
  borderRight?: BorderSideConfig;
  color?: string; // e.g. '#000000', '#2563eb'
  style?: 'thin' | 'medium' | 'thick' | 'double' | 'dashed';
}

export interface SheetCell {
  value: string; // formula "=SUM(A1:A5)" or raw value
  v?: any;
  f?: string;
  style?: any;
  computed?: string | number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  strike?: boolean;
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  bg?: string;
  color?: string;
  borders?: CellBorderConfig;
  format?: 'general' | 'number' | 'currency' | 'percent' | 'date' | 'time' | 'shortDate' | 'scientific' | 'text';
  numFmt?: string;
  decimalPlaces?: number;
  thousandSeparator?: boolean;
  fontFamily?: string;
  fontSize?: number;
  wrapText?: boolean;
  comment?: string;
  hyperlink?: string;
  validationRule?: {
    type: 'list' | 'range' | 'textLength';
    values?: string[];
    min?: number;
    max?: number;
  };
}

export interface SheetMergeRange {
  startR: number;
  startC: number;
  endR: number;
  endC: number;
  startRow?: number;
  startColumn?: number;
  startCol?: number;
  endRow?: number;
  endColumn?: number;
  endCol?: number;
}

export interface ConditionalFormattingRule {
  id: string;
  range: string; // e.g. "B2:B10"
  type: 'greaterThan' | 'lessThan' | 'between' | 'equal' | 'contains' | 'colorScale' | 'duplicate';
  value1?: number | string;
  value2?: number;
  bg?: string;
  color?: string;
}

export interface SheetChartConfig {
  id: string;
  title: string;
  type: 'bar' | 'line' | 'pie' | 'radar' | 'area';
  dataRange: string; // e.g. "A1:D6"
  labelColumn: number; // e.g. 0
  seriesColumns: number[]; // e.g. [1, 2, 3]
  position: { x: number; y: number; width: number; height: number };
}

export interface SheetFilterState {
  enabled: boolean;
  headerRow: number; // 0-indexed
  activeFilters: Record<number, string[]>; // colIndex -> allowed values
}

export interface SheetData {
  id: string;
  title: string;
  rows: number;
  cols: number;
  rowHeights?: Record<number, number>;
  colWidths?: Record<number, number>;
  cells: Record<string, SheetCell>; // key: "R,C" e.g. "0,0" = A1
  merges?: SheetMergeRange[];
  freezeRows?: number; // e.g. 1 = freeze row 1
  freezeCols?: number; // e.g. 1 = freeze col A
  tabColor?: string;
  conditionalRules?: ConditionalFormattingRule[];
  charts?: SheetChartConfig[];
  filterState?: SheetFilterState;
}

export interface WorkbookData {
  activeSheetId: string;
  sheets: SheetData[];
}

export interface PivotTableConfig {
  sourceRange: string; // e.g. "A1:E10"
  rowField: number;
  colField?: number;
  valueField: number;
  aggregation: 'SUM' | 'COUNT' | 'AVERAGE' | 'MAX' | 'MIN';
}

// ==================== TOOLBOX TYPES ====================

export interface OcrResult {
  text: string;
  confidence: number;
  lines?: { text: string; confidence: number; bbox?: { x0: number; y0: number; x1: number; y1: number } }[];
}

export interface ImageCompressItem {
  id: string;
  file: File;
  name: string;
  originalSize: number;
  compressedSize?: number;
  previewUrl: string;
  compressedUrl?: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  quality: number; // 0.1 - 1.0
  format: 'image/jpeg' | 'image/png' | 'image/webp';
}
