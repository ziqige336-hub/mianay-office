import * as pdfjsLib from 'pdfjs-dist';
import { HistoryManager } from '../history';
import type { PageMeta, PdfAnnotation, PdfViewMode } from '../../types';

/**
 * DocumentSession
 * Encapsulates an open document instance.
 * Ensures complete isolation: each document has its own PDF binary buffer,
 * page list, annotations, zoom, viewport, and undo/redo HistoryManager.
 */
export interface DocumentSession {
  id: string;
  fileName: string;
  fileSize: number;
  pdfBytes: Uint8Array | null;
  pdfJsDoc: pdfjsLib.PDFDocumentProxy | null;
  pages: PageMeta[];
  pageCount: number;
  currentPageIndex: number;
  zoom: number;
  viewMode: PdfViewMode;
  annotations: PdfAnnotation[];
  isModified: boolean;
  historyManager: HistoryManager;
  createdAt: number;
  lastModifiedAt: number;
  watermarkCount: number;
  password?: string;
}
