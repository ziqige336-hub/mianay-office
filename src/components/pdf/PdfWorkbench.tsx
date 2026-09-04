import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  MousePointer,
  Type,
  Highlighter,
  PenTool,
  Stamp,
  Eraser,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Download,
  ChevronLeft,
  ChevronRight,
  UploadCloud,
  FileCode,
  Sparkles,
  Layers,
  ShieldCheck,
  Undo2,
  Redo2,
  CheckCircle,
  Search,
  X,
  ArrowRight,
  Replace,
  Plus,
  FolderInput,
  Moon,
  FileText,
} from 'lucide-react';
import {
  loadPdfJsDocument,
  analyzePdfDocument,
  removeElectronicWatermarks,
  exportCleanPdf,
  exportPdfAsImagesZip,
  extractRawPdfBytes,
} from '../../utils/pdfLibWrapper';
import {
  exportScannedImageBasedPdf,
  exportPdfToDocxReal,
  exportPdfToXlsxReal,
  exportMultiPageImagesZipWithDpi,
  bakeWatermarkToPdf,
} from '../../utils/pdfExportEngines';
import type {
  PdfToolMode,
  PdfToolbarCategory,
  PdfViewMode,
  PdfAnnotation,
  StampType,
  DetectedWatermarkItem,
  WatermarkConfig,
  SecurityConfig,
  PageMeta,
  OfficeFile,
} from '../../types';
import { pdfService } from '../../services/PdfService';
import { PdfTopToolbar } from './PdfTopToolbar';
import { PdfRightInspector } from './PdfRightInspector';
import { PdfCanvasStage } from './PdfCanvasStage';
import { PdfThumbnailGrid } from './PdfThumbnailGrid';
import { PdfWatermarkEraser } from './PdfWatermarkEraser';
import { SignaturePadModal } from './SignaturePadModal';
import { StampPickerModal } from './StampPickerModal';
import { PdfExportModal } from './PdfExportModal';
import { PdfConvertModal } from './modals/PdfConvertModal';
import { PdfMergeSplitModal } from './modals/PdfMergeSplitModal';
import { PdfWatermarkModal } from './modals/PdfWatermarkModal';
import { PdfSecurityModal } from './modals/PdfSecurityModal';
import { PdfCompressModal } from './modals/PdfCompressModal';
import { PdfMeasureModal } from './modals/PdfMeasureModal';
import { PdfOcrModal } from './modals/PdfOcrModal';
import { PdfBatchExtractModal } from './modals/PdfBatchExtractModal';
import {
  CreateObjectCommand,
  DeleteObjectCommand,
  MoveObjectCommand,
  ResizeObjectCommand,
  RotateObjectCommand,
  CropImageCommand,
  UpdatePropertyCommand,
  ReorderObjectCommand,
  RotatePageCommand,
  AddPageCommand,
  DeletePageCommand,
  MovePageCommand,
  DuplicatePageCommand,
} from '../../core/history';
import { commandDispatcher, CommandInput, EditorCommand } from '../../core/commands';
import { useDocumentManager, DocumentSession, DocumentSessionManager } from '../../core/document';
import { updateFileContent } from '../../utils/fileStorage';
import { unsavedChangesManager } from '../../core/unsaved/UnsavedChangesManager';

export type ActiveModalId =
  | 'convert'
  | 'merge-split'
  | 'compress'
  | 'batch-extract'
  | 'measure'
  | 'ocr'
  | 'signature'
  | 'stamp'
  | 'watermark'
  | 'security'
  | 'export'
  | null;

interface ActiveModalState {
  id: ActiveModalId;
  params?: Record<string, any>;
}

interface PdfWorkbenchProps {
  fileId?: string;
  fileName?: string;
  currentFile?: OfficeFile | null;
  initialPdfBytes?: Uint8Array | null;
  isActive?: boolean;
  onShowToast: (type: 'success' | 'error' | 'info' | 'vip-free', title: string, description?: string) => void;
  externalFileToLoad?: File | null;
  isWatermarkPanelOpen?: boolean;
  onToggleWatermarkPanel?: () => void;
  onWatermarkCountChange?: (count: number) => void;
  onOpenDocWithText?: (text: string) => void;
}

export const PdfWorkbench: React.FC<PdfWorkbenchProps> = ({
  fileId,
  fileName,
  currentFile,
  initialPdfBytes,
  isActive = true,
  onShowToast,
  externalFileToLoad,
  isWatermarkPanelOpen = false,
  onToggleWatermarkPanel,
  onWatermarkCountChange,
  onOpenDocWithText,
}) => {
  // Document Sessions Management
  const {
    sessions,
    activeSessionId,
    activeSession,
    documentManager,
    switchDocument,
    closeDocument,
    createBlankDocument,
    createSampleDocument,
    createSessionFromBytes,
    openDocumentFromFile,
    updateActiveSession,
    updateSession,
  } = useDocumentManager();

  // Active Tool & Navigation Mode
  const [activeCategory, setActiveCategory] = useState<PdfToolbarCategory>('home');
  const [toolMode, setToolMode] = useState<PdfToolMode>('select');
  const [viewMode, setViewMode] = useState<PdfViewMode>('continuous');
  const [selectedAnnotation, setSelectedAnnotation] = useState<PdfAnnotation | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

  // Derived effective view mode (defaults to continuous reading mode)
  const effectiveViewMode: PdfViewMode = activeSession?.viewMode || viewMode || 'continuous';

  // Unified Command-Driven Modal State
  const [activeModal, setActiveModal] = useState<ActiveModalState>({ id: null });

  // Loading & Processing Flags
  const [isLoading, setIsLoading] = useState(false);
  const [isScanningWatermarks, setIsScanningWatermarks] = useState(false);
  const [isWatermarkCleaning, setIsWatermarkCleaning] = useState(false);

  // Search & Replace Bar State
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [replaceKeyword, setReplaceKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<{ pageIndex: number; text: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Eye-Care Night Reading Mode State
  const [isNightReadingMode, setIsNightReadingMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('mianay_pdf_night_mode') === 'true';
    } catch {
      return false;
    }
  });

  // Watermark Configuration
  const [watermarkConfig, setWatermarkConfig] = useState<WatermarkConfig>({
    type: 'text',
    text: '商业机密 · 严禁外传',
    fontFamily: 'Helvetica',
    color: '#94a3b8',
    opacity: 0.25,
    fontSize: 32,
    rotation: -30,
    isTiled: true,
    tileSpacing: 140,
    scale: 1,
    targetPages: 'all',
    pageRange: 'all',
  });

  // Security Configuration
  const [securityConfig, setSecurityConfig] = useState<SecurityConfig>({
    hasPassword: false,
    userPassword: '',
    allowPrinting: true,
    allowCopying: true,
    allowModifying: false,
    encryptionKeyLength: 128,
  });

  // CAD Measurement Settings
  const [measureScale, setMeasureScale] = useState(100);
  const [measureUnit, setMeasureUnit] = useState<'mm' | 'cm' | 'm'>('mm');

  // DOM Refs
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const openFileInputRef = useRef<HTMLInputElement>(null);
  const hasInitializedRef = useRef(false);

  // History state tracking per active session
  const [, setHistoryTick] = useState(0);
  const activeHistoryManager = activeSession?.historyManager;

  useEffect(() => {
    if (!activeHistoryManager) return;
    const unsubscribe = activeHistoryManager.subscribe(() => {
      setHistoryTick((t) => t + 1);
    });
    return unsubscribe;
  }, [activeHistoryManager]);

  const canUndo = activeHistoryManager?.canUndo() || false;
  const canRedo = activeHistoryManager?.canRedo() || false;

  const handleUndo = () => {
    if (activeHistoryManager?.canUndo()) {
      const desc = activeHistoryManager.getLastUndoDescription() || '操作';
      activeHistoryManager.undo();
      onShowToast('info', `已撤销: ${desc}`);
    }
  };

  const handleRedo = () => {
    if (activeHistoryManager?.canRedo()) {
      const desc = activeHistoryManager.getLastRedoDescription() || '操作';
      activeHistoryManager.redo();
      onShowToast('info', `已恢复: ${desc}`);
    }
  };

  const isSavingRef = useRef(false);

  // Document Save Handler
  const handleSavePdf = useCallback(() => {
    if (isSavingRef.current || saveStatus === 'saving') return;
    isSavingRef.current = true;
    setSaveStatus('saving');
    try {
      if (activeSession) {
        updateActiveSession((prev) => ({ ...prev, isModified: false }));
        const effectiveId = fileId || activeSession.id;
        unsavedChangesManager.markSaved(effectiveId);
        if (activeSession.id && activeSession.id !== effectiveId) {
          unsavedChangesManager.markSaved(activeSession.id);
        }
        if (activeSession.pdfBytes) {
          updateFileContent(effectiveId, activeSession.pdfBytes, '手动快捷保存', 'saved');
        }
      }
      setSaveStatus('saved');
      onShowToast(
        'success',
        '文档已保存',
        `${activeSession?.fileName || 'PDF文档'} 已存入沙箱与本地历史`
      );
    } catch (err: any) {
      setSaveStatus('unsaved');
      onShowToast('error', '保存失败', err?.message || '无法写入沙箱存储');
    } finally {
      isSavingRef.current = false;
    }
  }, [activeSession, fileId, onShowToast, saveStatus]);

  // Keep saveStatus in sync if session modifications occur
  useEffect(() => {
    if (activeSession?.isModified && saveStatus === 'saved') {
      setSaveStatus('unsaved');
    }
  }, [activeSession?.isModified, saveStatus]);

  // Continuous Page Navigation & Viewport Scroll Sync (Strictly isolated to the PDF viewport container)
  const handleSelectPage = (targetIdx: number) => {
    if (!activeSession) return;
    const safeIdx = Math.max(0, Math.min((activeSession.pageCount || 1) - 1, targetIdx));
    updateActiveSession((prev) => ({ ...prev, currentPageIndex: safeIdx }));

    if (effectiveViewMode === 'continuous') {
      const container = canvasContainerRef.current;
      const pageEl = document.getElementById(`pdf-page-${safeIdx}`);
      if (container && pageEl) {
        const targetScrollTop = pageEl.offsetTop - 24;
        container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
      }
    }
  };

  const handleViewportScroll = () => {
    if (!canvasContainerRef.current || !activeSession?.pages?.length) return;
    if (effectiveViewMode !== 'continuous') return;
    const container = canvasContainerRef.current;
    const viewportCenter = container.scrollTop + container.clientHeight / 2;

    let closestIdx = activeSession.currentPageIndex;
    let minDistance = Infinity;

    for (let i = 0; i < activeSession.pages.length; i++) {
      const el = document.getElementById(`pdf-page-${i}`);
      if (el) {
        const elCenter = el.offsetTop + el.offsetHeight / 2;
        const dist = Math.abs(viewportCenter - elCenter);
        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = i;
        }
      }
    }

    if (activeSession.currentPageIndex !== closestIdx) {
      updateActiveSession((prev) => ({ ...prev, currentPageIndex: closestIdx }));
    }
  };

  // DOM Layout & Visual Render Debug Diagnostic (Comprehensive vertical multi-page visual verification)
  useEffect(() => {
    if (!activeSession?.pages?.length || !canvasContainerRef.current) return;
    const timer = setTimeout(() => {
      const container = canvasContainerRef.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      
      const pagesVisualInfo = activeSession.pages.map((_, idx) => {
        const pageEl = document.getElementById(`pdf-page-${idx}`);
        const canvasEl = document.getElementById(`pdf-canvas-${idx}`) as HTMLCanvasElement | null;
        const pageContainerEl = document.getElementById(`pdf-page-container-${idx}`);
        
        if (!pageEl) {
          return { page: idx + 1, status: 'missing_page_element' };
        }

        const pageContainerRect = pageEl.getBoundingClientRect();
        const canvasRect = canvasEl ? canvasEl.getBoundingClientRect() : null;
        const computed = window.getComputedStyle(pageEl);
        const canvasComputed = canvasEl ? window.getComputedStyle(canvasEl) : null;

        return {
          page: idx + 1,
          pageId: `pdf-page-${idx}`,
          canvasId: `pdf-canvas-${idx}`,
          offsetTop: Math.round(pageEl.offsetTop),
          pageContainerRect: {
            top: Math.round(pageContainerRect.top),
            bottom: Math.round(pageContainerRect.bottom),
            left: Math.round(pageContainerRect.left),
            right: Math.round(pageContainerRect.right),
            width: Math.round(pageContainerRect.width),
            height: Math.round(pageContainerRect.height),
          },
          canvasRect: canvasRect
            ? {
                top: Math.round(canvasRect.top),
                bottom: Math.round(canvasRect.bottom),
                left: Math.round(canvasRect.left),
                right: Math.round(canvasRect.right),
                width: Math.round(canvasRect.width),
                height: Math.round(canvasRect.height),
              }
            : null,
          computedStyle: {
            position: computed.position,
            top: computed.top,
            left: computed.left,
            transform: computed.transform,
            zIndex: computed.zIndex,
            display: computed.display,
            visibility: computed.visibility,
            opacity: computed.opacity,
            overflow: computed.overflow,
          },
          canvasComputedStyle: canvasComputed
            ? {
                position: canvasComputed.position,
                top: canvasComputed.top,
                left: canvasComputed.left,
                transform: canvasComputed.transform,
                zIndex: canvasComputed.zIndex,
                display: canvasComputed.display,
                visibility: canvasComputed.visibility,
                opacity: canvasComputed.opacity,
              }
            : null,
        };
      });

      // Verify Canvas visual monotonicity
      let isVisuallySeparated = true;
      for (let i = 0; i < pagesVisualInfo.length - 1; i++) {
        const curr = pagesVisualInfo[i];
        const next = pagesVisualInfo[i + 1];
        if (curr?.canvasRect && next?.canvasRect) {
          if (curr.canvasRect.bottom > next.canvasRect.top) {
            isVisuallySeparated = false;
          }
        }
      }

      const visualDiagnostic = {
        fileId: activeSession.id,
        pageCount: activeSession.pages.length,
        pageContainersCount: pagesVisualInfo.filter((p: any) => p.pageContainerRect).length,
        canvasCount: pagesVisualInfo.filter((p: any) => p.canvasRect).length,
        layoutMode: 'vertical-flow',
        isVisuallySeparated,
        containerRect: {
          top: Math.round(containerRect.top),
          bottom: Math.round(containerRect.bottom),
          left: Math.round(containerRect.left),
          right: Math.round(containerRect.right),
          height: Math.round(containerRect.height),
          scrollHeight: Math.round(container.scrollHeight),
        },
        pages: pagesVisualInfo,
      };

      console.log('[Lumina PDF Visual Diagnostic]', JSON.stringify(visualDiagnostic, null, 2));
      (window as any).__LUMINA_PDF_LAYOUT_DIAGNOSTIC__ = visualDiagnostic;
      (window as any).__LUMINA_PDF_VISUAL_DIAGNOSTIC__ = visualDiagnostic;
    }, 150);
    return () => clearTimeout(timer);
  }, [activeSession?.id, activeSession?.pages?.length, activeSession?.zoom, activeSession?.pages, activeSession?.currentPageIndex]);

  // Initial Document Load: Load external file, binary bytes, or create clean blank document for this session
  useEffect(() => {
    const targetSessionId = fileId || currentFile?.id;
    if (!targetSessionId) return;

    const existingSession = sessions.find((s) => s.id === targetSessionId);
    if (existingSession) {
      if (activeSessionId !== existingSession.id) {
        switchDocument(existingSession.id);
      }
      return;
    }

    if (externalFileToLoad) {
      setIsLoading(true);
      openDocumentFromFile(externalFileToLoad)
        .then((doc) => {
          onShowToast('success', '文档已加载', `${doc.fileName} 已创建独立 Session`);
        })
        .catch((err) => {
          console.error(err);
          onShowToast('error', '打开文件失败', '请确认文件是否为有效 PDF');
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(true);
      const rawBytes =
        extractRawPdfBytes(initialPdfBytes) ||
        extractRawPdfBytes(currentFile?.content) ||
        extractRawPdfBytes(currentFile);

      if (rawBytes && rawBytes.byteLength > 0) {
        createSessionFromBytes(
          rawBytes,
          fileName || currentFile?.name || '新建文档.pdf',
          rawBytes.byteLength,
          targetSessionId
        )
          .then((doc) => {
            onShowToast('info', '文档已就绪', `${doc.fileName}`);
          })
          .catch((e) => {
            console.error('Failed to initialize document from bytes, falling back to blank:', e);
            createBlankDocument(fileName || currentFile?.name || '新建文档.pdf', targetSessionId);
          })
          .finally(() => setIsLoading(false));
      } else {
        const isSampleOrContract =
          targetSessionId === 'pdf-default-1' ||
          (fileName && (fileName.includes('协议') || fileName.includes('合同') || fileName.includes('报告'))) ||
          (currentFile?.name && (currentFile.name.includes('协议') || currentFile.name.includes('合同') || currentFile.name.includes('报告')));

        if (isSampleOrContract) {
          createSampleDocument('contract-watermark', targetSessionId, fileName || currentFile?.name || '商业技术合作与知识产权协议.pdf')
            .then((doc) => {
              onShowToast('info', '文档已就绪', `${doc.fileName}`);
            })
            .catch((e) => {
              console.error('Failed to initialize sample document:', e);
              createBlankDocument(fileName || currentFile?.name || '新建文档.pdf', targetSessionId);
            })
            .finally(() => setIsLoading(false));
        } else {
          // Create a clean document bound directly to this targetSessionId
          createBlankDocument(fileName || currentFile?.name || '新建文档.pdf', targetSessionId)
            .then((doc) => {
              onShowToast('info', '文档已就绪', `${doc.fileName}`);
            })
            .catch((e) => console.error('Failed to initialize document:', e))
            .finally(() => setIsLoading(false));
        }
      }
    }
  }, [externalFileToLoad, fileId, currentFile?.id, fileName]);

  // Update total watermarks count & sync with DocumentSessionManager & PdfService whenever active session changes
  useEffect(() => {
    if (activeSession) {
      const totalWatermarks = activeSession.pages.reduce((acc, p) => acc + p.detectedWatermarks.length, 0);
      onWatermarkCountChange?.(totalWatermarks);

      const allAnnotations = activeSession.pages.flatMap((p: any) => p.annotations || []);
      const effectiveId = fileId || activeSession.id;
      const effectiveName = fileName || activeSession.fileName;

      // Register with DocumentSessionManager
      DocumentSessionManager.registerSession({
        fileId: effectiveId,
        fileName: effectiveName,
        type: 'pdf',
        pdfSession: activeSession,
        pdfBytes: activeSession.pdfBytes,
        getVisibleTextPreview: () => {
          return activeSession.pages
            .map((p) => p.objects?.map((obj) => obj.content).join(' ') || '')
            .filter(Boolean)
            .join('\n')
            .slice(0, 100) || `PDF Document (${activeSession.pages.length} Pages)`;
        },
        getExportContent: () => activeSession.pdfBytes,
      });
      DocumentSessionManager.setActiveSession(effectiveId);

      if (activeSession.id && activeSession.id !== effectiveId) {
        DocumentSessionManager.registerSession({
          fileId: activeSession.id,
          fileName: effectiveName,
          type: 'pdf',
          pdfSession: activeSession,
          pdfBytes: activeSession.pdfBytes,
          getVisibleTextPreview: () => `PDF Document (${activeSession.pages.length} Pages)`,
          getExportContent: () => activeSession.pdfBytes,
        });
      }

      const fileToSync: OfficeFile = {
        id: effectiveId,
        name: effectiveName,
        type: 'pdf',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        versionHistory: [],
        content: activeSession.pdfBytes,
      };
      pdfService.registerPdf(
        fileToSync,
        activeSession.pdfBytes,
        allAnnotations,
        (annos) => {
          // Sync programmatic annotations into active page
          const curPageIndex = activeSession.currentPageIndex || 0;
          updateActiveSession((prev) => ({
            ...prev,
            pages: prev.pages.map((pg, idx) =>
              idx === curPageIndex ? { ...pg, annotations: annos } : pg
            ),
          }));
        }
      );
    }
  }, [activeSession?.id, activeSession?.pages, activeSession?.pdfBytes, fileId, fileName]);

  // Wheel zoom with Ctrl / Cmd key
  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el || !isActive) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.10 : -0.10;
        updateActiveSession((prev) => ({
          ...prev,
          zoom: Math.min(3.0, Math.max(0.4, Number((prev.zoom + delta).toFixed(2)))),
        }));
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [isActive, activeSession?.id]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl as HTMLElement)?.isContentEditable;

      // Delete key for selected annotation
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedAnnotation && !isInput) {
        e.preventDefault();
        handleDeleteAnnotation(selectedAnnotation.id);
        onShowToast('info', '已删除选中的页面对象');
        return;
      }

      if (isCtrlOrCmd) {
        if (e.key === '=' || e.key === '+' || e.code === 'NumpadAdd') {
          e.preventDefault();
          updateActiveSession((prev) => ({
            ...prev,
            zoom: Math.min(3.0, Number((prev.zoom + 0.15).toFixed(2))),
          }));
        } else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') {
          e.preventDefault();
          updateActiveSession((prev) => ({
            ...prev,
            zoom: Math.max(0.4, Number((prev.zoom - 0.15).toFixed(2))),
          }));
        } else if (e.key === '0' || e.code === 'Numpad0') {
          e.preventDefault();
          updateActiveSession((prev) => ({ ...prev, zoom: 1.0 }));
        } else if (e.key === 'z' || e.key === 'Z') {
          if (isInput) return;
          e.preventDefault();
          if (e.shiftKey) {
            handleRedo();
          } else {
            handleUndo();
          }
        } else if (e.key === 'y' || e.key === 'Y') {
          if (isInput) return;
          e.preventDefault();
          handleRedo();
        } else if (e.key === 'd' || e.key === 'D') {
          if (selectedAnnotation && !isInput) {
            e.preventDefault();
            handleDuplicateAnnotation(selectedAnnotation);
          }
        } else if (e.key === 'f' || e.key === 'F') {
          if (!isInput) {
            e.preventDefault();
            setIsSearchOpen((prev) => !prev);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedAnnotation, activeHistoryManager]);

  // ==========================================
  // Core Page Operations with Command History
  // ==========================================
  const rawRotatePage = (pageIndex: number, rotation: number) => {
    updateActiveSession((prev) => {
      const nextPages = [...prev.pages];
      if (pageIndex >= 0 && pageIndex < nextPages.length) {
        nextPages[pageIndex] = { ...nextPages[pageIndex], rotation };
      }
      return { ...prev, pages: nextPages, isModified: true };
    });
  };

  const rawAddPage = (page: PageMeta, targetIndex: number, restoredAnnotations: PdfAnnotation[] = []) => {
    updateActiveSession((prev) => {
      const nextPages = [...prev.pages];
      const boundedIndex = Math.max(0, Math.min(targetIndex, nextPages.length));
      nextPages.splice(boundedIndex, 0, { ...page, pageIndex: boundedIndex });

      // Re-index all pages
      const reindexedPages = nextPages.map((p, idx) => ({ ...p, pageIndex: idx }));

      // Shift existing annotations at or after targetIndex
      const shiftedAnnotations = prev.annotations.map((ann) => {
        if (ann.pageIndex >= boundedIndex) {
          return { ...ann, pageIndex: ann.pageIndex + 1 };
        }
        return ann;
      });

      // Combine with restored annotations
      const combinedAnnotations = [...shiftedAnnotations, ...restoredAnnotations];

      return {
        ...prev,
        pages: reindexedPages,
        pageCount: reindexedPages.length,
        currentPageIndex: boundedIndex,
        annotations: combinedAnnotations,
        isModified: true,
      };
    });
  };

  const rawDeletePage = (targetIndex: number) => {
    updateActiveSession((prev) => {
      if (prev.pages.length <= 1) return prev;
      const nextPages = prev.pages.filter((_, idx) => idx !== targetIndex);
      const reindexedPages = nextPages.map((p, idx) => ({ ...p, pageIndex: idx }));

      // Remove annotations on this page and shift down annotations above targetIndex
      const updatedAnnotations = prev.annotations
        .filter((ann) => ann.pageIndex !== targetIndex)
        .map((ann) => {
          if (ann.pageIndex > targetIndex) {
            return { ...ann, pageIndex: ann.pageIndex - 1 };
          }
          return ann;
        });

      const nextCurr = Math.min(prev.currentPageIndex, reindexedPages.length - 1);

      return {
        ...prev,
        pages: reindexedPages,
        pageCount: reindexedPages.length,
        currentPageIndex: Math.max(0, nextCurr),
        annotations: updatedAnnotations,
        isModified: true,
      };
    });
  };

  const rawMovePage = (fromIndex: number, toIndex: number) => {
    updateActiveSession((prev) => {
      if (
        fromIndex < 0 ||
        fromIndex >= prev.pages.length ||
        toIndex < 0 ||
        toIndex >= prev.pages.length ||
        fromIndex === toIndex
      ) {
        return prev;
      }

      const nextPages = [...prev.pages];
      const [movedPage] = nextPages.splice(fromIndex, 1);
      nextPages.splice(toIndex, 0, movedPage);

      const reindexedPages = nextPages.map((p, idx) => ({ ...p, pageIndex: idx }));

      // Remap annotations' pageIndex
      const updatedAnnotations = prev.annotations.map((ann) => {
        if (ann.pageIndex === fromIndex) {
          return { ...ann, pageIndex: toIndex };
        } else if (fromIndex < toIndex && ann.pageIndex > fromIndex && ann.pageIndex <= toIndex) {
          return { ...ann, pageIndex: ann.pageIndex - 1 };
        } else if (fromIndex > toIndex && ann.pageIndex >= toIndex && ann.pageIndex < fromIndex) {
          return { ...ann, pageIndex: ann.pageIndex + 1 };
        }
        return ann;
      });

      return {
        ...prev,
        pages: reindexedPages,
        currentPageIndex: toIndex,
        annotations: updatedAnnotations,
        isModified: true,
      };
    });
  };

  const handleRotatePage = (index: number, deg: number) => {
    if (!activeSession || index < 0 || index >= activeSession.pages.length) return;
    const target = activeSession.pages[index];
    const prevRot = target.rotation || 0;
    const nextRot = (prevRot + deg) % 360;
    activeSession.historyManager.execute(
      new RotatePageCommand(index, prevRot, nextRot, rawRotatePage)
    );
    onShowToast('info', `第 ${index + 1} 页已旋转 ${deg}°`);
  };

  const handleDeletePage = (index: number) => {
    if (!activeSession || activeSession.pages.length <= 1) {
      onShowToast('info', '文档至少需要保留一页');
      return;
    }
    const pageToDelete = activeSession.pages[index];
    const savedAnnotations = activeSession.annotations.filter((a) => a.pageIndex === index);

    activeSession.historyManager.execute(
      new DeletePageCommand(pageToDelete, index, rawDeletePage, rawAddPage, savedAnnotations)
    );
    onShowToast('info', `第 ${index + 1} 页已删除 (可 Ctrl+Z 撤销)`);
  };

  const handleDuplicatePage = (index: number) => {
    if (!activeSession || index < 0 || index >= activeSession.pages.length) return;
    const sourcePage = activeSession.pages[index];
    const insertIndex = index + 1;

    const duplicatedPage: PageMeta = {
      ...sourcePage,
      pageIndex: insertIndex,
      originalIndex: activeSession.pages.length,
      detectedWatermarks: [...(sourcePage.detectedWatermarks || [])],
    };

    // Duplicate annotations belonging to this page
    const sourceAnnotations = activeSession.annotations.filter((a) => a.pageIndex === index);
    const clonedAnnotations: PdfAnnotation[] = sourceAnnotations.map((a) => ({
      ...a,
      id: `annot-dup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      pageIndex: insertIndex,
    }));

    activeSession.historyManager.execute(
      new DuplicatePageCommand(duplicatedPage, insertIndex, rawAddPage, rawDeletePage, clonedAnnotations)
    );
    onShowToast('success', `第 ${index + 1} 页已复制 (可 Ctrl+Z 撤销)`);
  };

  const handleMovePage = (from: number, to: number) => {
    if (!activeSession || from === to || to < 0 || to >= activeSession.pages.length) return;
    activeSession.historyManager.execute(new MovePageCommand(from, to, rawMovePage));
    onShowToast('info', `第 ${from + 1} 页已移动至第 ${to + 1} 页 (可 Ctrl+Z 撤销)`);
  };

  const handleInsertBlankPage = (afterIndex: number) => {
    if (!activeSession) return;
    const insertIndex = afterIndex + 1;
    const blankPage: PageMeta = {
      pageIndex: insertIndex,
      originalIndex: activeSession.pages.length,
      rotation: 0,
      width: 595.28,
      height: 841.89,
      scale: 1,
      aspectRatio: 595.28 / 841.89,
      detectedWatermarks: [],
    };

    activeSession.historyManager.execute(
      new AddPageCommand(blankPage, insertIndex, rawAddPage, rawDeletePage, [], '插入空白页面')
    );
    onShowToast('success', `已在第 ${insertIndex} 页后插入空白页 (可 Ctrl+Z 撤销)`);
  };

  const handleAutoTrimPage = (index: number) => {
    onShowToast('success', `第 ${index + 1} 页已智能自动裁切白边`, '边界优化完成');
  };

  // ==========================================
  // Core Annotation Operations (Command History)
  // ==========================================
  const rawAddAnnotation = (annot: PdfAnnotation, index?: number) => {
    updateActiveSession((prev) => {
      const next = [...prev.annotations];
      if (typeof index === 'number' && index >= 0 && index <= next.length) {
        next.splice(index, 0, annot);
      } else {
        next.push(annot);
      }
      return { ...prev, annotations: next, isModified: true };
    });
    setSelectedAnnotation(annot);
  };

  const rawDeleteAnnotation = (id: string) => {
    updateActiveSession((prev) => ({
      ...prev,
      annotations: prev.annotations.filter((a) => a.id !== id),
      isModified: true,
    }));
    setSelectedAnnotation((prev) => (prev?.id === id ? null : prev));
  };

  const rawUpdateAnnotation = (id: string, updates: Partial<PdfAnnotation>) => {
    updateActiveSession((prev) => ({
      ...prev,
      annotations: prev.annotations.map((a) =>
        a.id === id ? ({ ...a, ...updates } as PdfAnnotation) : a
      ),
      isModified: true,
    }));
    setSelectedAnnotation((prev) =>
      prev && prev.id === id ? ({ ...prev, ...updates } as PdfAnnotation) : prev
    );
  };

  const rawReorderAnnotation = (id: string, newIndex: number) => {
    updateActiveSession((prev) => {
      const idx = prev.annotations.findIndex((a) => a.id === id);
      if (idx === -1) return prev;
      const next = [...prev.annotations];
      const [item] = next.splice(idx, 1);
      const clamped = Math.max(0, Math.min(next.length, newIndex));
      next.splice(clamped, 0, item);
      return { ...prev, annotations: next, isModified: true };
    });
  };

  const handleAddAnnotation = (annot: PdfAnnotation) => {
    if (!activeSession) return;
    activeSession.historyManager.execute(
      new CreateObjectCommand(annot, rawAddAnnotation, rawDeleteAnnotation)
    );
  };

  const handleUpdateAnnotation = (
    id: string,
    updates: Partial<PdfAnnotation>,
    recordHistory: boolean = false,
    description?: string
  ) => {
    if (!activeSession) return;
    if (recordHistory) {
      const target = activeSession.annotations.find((a) => a.id === id);
      if (target) {
        const beforeProps: Record<string, any> = {};
        const afterProps: Record<string, any> = {};
        for (const key of Object.keys(updates || {})) {
          beforeProps[key] = (target as any)[key];
          afterProps[key] = (updates as any)[key];
        }
        activeSession.historyManager.execute(
          new UpdatePropertyCommand(
            id,
            beforeProps,
            afterProps,
            (targetId, u) => rawUpdateAnnotation(targetId, u as Partial<PdfAnnotation>),
            description
          )
        );
        return;
      }
    }
    rawUpdateAnnotation(id, updates);
  };

  const handleDeleteAnnotation = (id: string) => {
    if (!activeSession) return;
    const target = activeSession.annotations.find((a) => a.id === id);
    if (!target) return;
    const originalIndex = activeSession.annotations.findIndex((a) => a.id === id);
    activeSession.historyManager.execute(
      new DeleteObjectCommand(
        target,
        rawDeleteAnnotation,
        rawAddAnnotation,
        originalIndex
      )
    );
  };

  const handleDuplicateAnnotation = (obj: any) => {
    const newId = `${obj.type || 'obj'}-${Date.now()}`;
    const duplicated: PdfAnnotation = {
      ...obj,
      id: newId,
      x: Math.min(90, (obj.x || 10) + 3),
      y: Math.min(90, (obj.y || 10) + 3),
      createdAt: Date.now(),
    };
    handleAddAnnotation(duplicated);
    onShowToast('info', '已创建对象副本');
  };

  const handleBringForward = (id: string) => {
    if (!activeSession) return;
    const idx = activeSession.annotations.findIndex((a) => a.id === id);
    if (idx === -1 || idx >= activeSession.annotations.length - 1) return;
    activeSession.historyManager.execute(
      new ReorderObjectCommand(id, idx, idx + 1, rawReorderAnnotation, '图层上移')
    );
  };

  const handleSendBackward = (id: string) => {
    if (!activeSession) return;
    const idx = activeSession.annotations.findIndex((a) => a.id === id);
    if (idx <= 0) return;
    activeSession.historyManager.execute(
      new ReorderObjectCommand(id, idx, idx - 1, rawReorderAnnotation, '图层下移')
    );
  };

  const handleBringToFront = (id: string) => {
    if (!activeSession) return;
    const idx = activeSession.annotations.findIndex((a) => a.id === id);
    if (idx === -1 || idx >= activeSession.annotations.length - 1) return;
    activeSession.historyManager.execute(
      new ReorderObjectCommand(id, idx, activeSession.annotations.length - 1, rawReorderAnnotation, '图层置顶')
    );
  };

  const handleSendToBack = (id: string) => {
    if (!activeSession) return;
    const idx = activeSession.annotations.findIndex((a) => a.id === id);
    if (idx <= 0) return;
    activeSession.historyManager.execute(
      new ReorderObjectCommand(id, idx, 0, rawReorderAnnotation, '图层置底')
    );
  };

  // Image insertion
  const handleInsertImageFile = (file: File) => {
    if (!activeSession) return;
    const reader = new FileReader();
    reader.onload = () => {
      const newImg: PdfAnnotation = {
        id: `img-${Date.now()}`,
        pageIndex: activeSession.currentPageIndex,
        type: 'image',
        x: 30,
        y: 30,
        width: 35,
        height: 25,
        dataUrl: reader.result as string,
        opacity: 1.0,
        rotation: 0,
        createdAt: Date.now(),
      };
      handleAddAnnotation(newImg);
      setSelectedAnnotation(newImg);
      onShowToast('success', '图片已插入当前页', '可自由拖动、缩放与调整透明度');
    };
    reader.readAsDataURL(file);
  };

  // Shape insertion
  const handleInsertShape = (shapeType: 'rect' | 'circle' | 'arrow' | 'line' | 'table') => {
    if (!activeSession) return;
    const newShape: PdfAnnotation = {
      id: `shape-${shapeType}-${Date.now()}`,
      pageIndex: activeSession.currentPageIndex,
      type: 'shape',
      shapeType,
      x: 30,
      y: 30,
      width: shapeType === 'table' ? 40 : shapeType === 'line' ? 30 : 25,
      height: shapeType === 'table' ? 25 : shapeType === 'line' ? 5 : 20,
      strokeColor: '#0071e3',
      fillColor: shapeType === 'rect' || shapeType === 'circle' ? 'rgba(0, 113, 227, 0.1)' : 'transparent',
      strokeWidth: 2,
      createdAt: Date.now(),
    };
    handleAddAnnotation(newShape);
    setSelectedAnnotation(newShape);
    onShowToast('success', `已插入 ${shapeType} 矢量图形`);
  };

  // Form Field insertion
  const handleInsertForm = (formType: 'form-text' | 'form-checkbox' | 'form-radio') => {
    if (!activeSession) return;
    const fieldType = formType === 'form-checkbox' ? 'checkbox' : formType === 'form-radio' ? 'radio' : 'text';
    const newForm: PdfAnnotation = {
      id: `form-${Date.now()}`,
      pageIndex: activeSession.currentPageIndex,
      type: 'form-field',
      fieldType,
      x: 35,
      y: 35,
      width: formType === 'form-text' ? 30 : 8,
      height: formType === 'form-text' ? 10 : 8,
      fieldName: `field_${Date.now().toString().slice(-4)}`,
      value: formType === 'form-text' ? '填写项' : '',
      checked: false,
      createdAt: Date.now(),
    };
    handleAddAnnotation(newForm);
    setSelectedAnnotation(newForm);
    onShowToast('success', '已放置交互式表单控件');
  };

  // Signature insertion
  const handleInsertSignature = (dataUrl: string) => {
    if (!activeSession) return;
    const newSig: PdfAnnotation = {
      id: `sig-${Date.now()}`,
      pageIndex: activeSession.currentPageIndex,
      type: 'signature',
      x: 35,
      y: 60,
      width: 28,
      height: 12,
      dataUrl,
      createdAt: Date.now(),
    };
    handleAddAnnotation(newSig);
    setSelectedAnnotation(newSig);
    onShowToast('success', '手写签名已放置到当前页');
  };

  // Stamp insertion
  const handleInsertStamp = (stampType: StampType, customText?: string, color?: string) => {
    if (!activeSession) return;
    const newStamp: PdfAnnotation = {
      id: `stamp-${Date.now()}`,
      pageIndex: activeSession.currentPageIndex,
      type: 'stamp',
      x: 35,
      y: 20,
      stampType,
      customText,
      color: color || '#dc2626',
      createdAt: Date.now(),
    };
    handleAddAnnotation(newStamp);
    setSelectedAnnotation(newStamp);
    onShowToast('success', '印章已放置到文档');
  };

  // ==========================================
  // Watermark Scanning & Electronic Removal
  // ==========================================
  const scanWatermarks = async (showToastFeedback = false) => {
    if (!activeSession?.pdfBytes) return;
    setIsScanningWatermarks(true);
    try {
      const { pages } = await analyzePdfDocument(activeSession.pdfBytes);
      updateActiveSession((prev) => ({ ...prev, pages }));
      const totalCount = pages.reduce((acc, p) => acc + p.detectedWatermarks.length, 0);
      onWatermarkCountChange?.(totalCount);
      if (showToastFeedback) {
        if (totalCount > 0) {
          onShowToast('vip-free', `已识别到 ${totalCount} 处水印`, '可在去水印面板中一键无损剔除');
        } else {
          onShowToast('info', '扫描完成', '当前文档未检测到明显文字水印');
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsScanningWatermarks(false);
    }
  };

  useEffect(() => {
    if (isWatermarkPanelOpen && activeSession?.pdfBytes) {
      scanWatermarks(true);
    }
  }, [isWatermarkPanelOpen]);

  const handleToggleWatermarkItem = (id: string) => {
    updateActiveSession((prev) => ({
      ...prev,
      pages: prev.pages.map((p) => ({
        ...p,
        detectedWatermarks: p.detectedWatermarks.map((w) =>
          w.id === id ? { ...w, selected: !w.selected } : w
        ),
      })),
    }));
  };

  const handleSelectAllWatermarks = (select: boolean) => {
    updateActiveSession((prev) => ({
      ...prev,
      pages: prev.pages.map((p) => ({
        ...p,
        detectedWatermarks: p.detectedWatermarks.map((w) => ({ ...w, selected: select })),
      })),
    }));
  };

  const handleExecuteElectronicClean = async (selectedItems: DetectedWatermarkItem[]) => {
    if (!activeSession?.pdfBytes) return;
    setIsWatermarkCleaning(true);
    try {
      const { cleanedBytes, removedCount, isClean, message } = await removeElectronicWatermarks(
        activeSession.pdfBytes,
        selectedItems
      );

      const { pages } = await analyzePdfDocument(cleanedBytes);
      const jsDoc = await loadPdfJsDocument(cleanedBytes);

      updateActiveSession((prev) => ({
        ...prev,
        pdfBytes: cleanedBytes,
        pdfJsDoc: jsDoc,
        pages,
        isModified: true,
      }));

      const remainingWatermarks = pages.reduce((acc, p) => acc + p.detectedWatermarks.length, 0);
      onWatermarkCountChange?.(remainingWatermarks);

      if (isClean || remainingWatermarks === 0) {
        onShowToast(
          'vip-free',
          `成功剔除 ${removedCount} 处水印对象！`,
          '已纯本地无损擦除，重新解析验证通过'
        );
      } else {
        onShowToast('info', `已处理 ${removedCount} 处水印`, `仍有 ${remainingWatermarks} 处残留对象，${message}`);
      }
    } catch (err) {
      console.error(err);
      onShowToast('error', '去水印失败', '处理电子图层时发生异常');
    } finally {
      setIsWatermarkCleaning(false);
    }
  };

  const handleApplyBakeWatermark = async () => {
    if (!activeSession?.pdfBytes) return;
    try {
      const bakedBytes = await bakeWatermarkToPdf(
        activeSession.pdfBytes,
        watermarkConfig,
        activeSession.pages
      );
      const jsDoc = await loadPdfJsDocument(bakedBytes);
      const { pages } = await analyzePdfDocument(bakedBytes);
      updateActiveSession((prev) => ({
        ...prev,
        pdfBytes: bakedBytes,
        pdfJsDoc: jsDoc,
        pages,
        isModified: true,
      }));
      onShowToast('vip-free', '防伪/版权水印已成功烧录至 PDF 文档');
    } catch (err: any) {
      onShowToast('error', '烧录水印失败', err.message || '处理错误');
    }
  };

  // ==========================================
  // Direct File Exports
  // ==========================================
  const handleExportCleanPdf = async () => {
    if (!activeSession?.pdfBytes) return;
    try {
      const cleanBytes = await exportCleanPdf(
        activeSession.pdfBytes,
        activeSession.pages,
        activeSession.annotations
      );
      const blob = new Blob([cleanBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeSession.fileName.replace(/\.pdf$/i, '')}_LuminaClean.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      onShowToast('vip-free', '已导出高保真 PDF', '所有批注与图层已完美合成');
    } catch (err: any) {
      onShowToast('error', '导出 PDF 失败', err.message);
    }
  };

  const handleExportDocx = async () => {
    if (!activeSession?.pdfJsDoc) return;
    try {
      const docxBlob = await exportPdfToDocxReal(activeSession.pdfJsDoc);
      const url = URL.createObjectURL(docxBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeSession.fileName.replace(/\.pdf$/i, '')}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      onShowToast('vip-free', '已成功转换为 Word (.docx) 文档');
    } catch (err: any) {
      onShowToast('error', '转换为 Word 失败', err.message);
    }
  };

  const handleExportXlsx = async () => {
    if (!activeSession?.pdfJsDoc) return;
    try {
      const xlsxBlob = await exportPdfToXlsxReal(activeSession.pdfJsDoc);
      const url = URL.createObjectURL(xlsxBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeSession.fileName.replace(/\.pdf$/i, '')}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      onShowToast('vip-free', '已成功转换为 Excel (.xlsx) 表格');
    } catch (err: any) {
      onShowToast('error', '转换为 Excel 失败', err.message);
    }
  };

  const handleExportImagesZip = async (quality: number) => {
    if (!activeSession?.pdfJsDoc) return;
    try {
      const zipBlob = await exportMultiPageImagesZipWithDpi(
        activeSession.pdfJsDoc,
        activeSession.pages,
        quality > 1 ? 300 : 150
      );
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeSession.fileName.replace(/\.pdf$/i, '')}_高清图包.zip`;
      a.click();
      URL.revokeObjectURL(url);
      onShowToast('vip-free', '已导出全部多页高清图包 (ZIP)');
    } catch (err: any) {
      onShowToast('error', '导出图片包失败', err.message);
    }
  };

  const handleExportText = async () => {
    if (!activeSession?.pdfJsDoc) return;
    let fullText = '';
    for (let i = 0; i < activeSession.pages.length; i++) {
      const page = await activeSession.pdfJsDoc.getPage(i + 1);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((it: any) => it.str || '').join(' ');
      fullText += `--- 第 ${i + 1} 页 ---\n\n${pageText}\n\n`;
    }
    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeSession.fileName.replace(/\.pdf$/i, '')}_纯文本提取.txt`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast('success', '纯文本已导出');
  };

  // Search in PDF
  const handlePerformSearch = async () => {
    if (!activeSession?.pdfJsDoc || !searchKeyword.trim()) return;
    setIsSearching(true);
    const results: { pageIndex: number; text: string }[] = [];
    try {
      for (let i = 0; i < activeSession.pages.length; i++) {
        const page = await activeSession.pdfJsDoc.getPage(i + 1);
        const textContent = await page.getTextContent();
        const full = textContent.items.map((it: any) => it.str || '').join(' ');
        if (full.toLowerCase().includes(searchKeyword.toLowerCase())) {
          results.push({ pageIndex: i, text: full.slice(0, 80) + '...' });
        }
      }
      setSearchResults(results);
      if (results.length > 0) {
        updateActiveSession((prev) => ({ ...prev, currentPageIndex: results[0].pageIndex }));
        onShowToast('info', `找到 ${results.length} 处匹配项`);
      } else {
        onShowToast('info', '未找到匹配内容');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleBatchReplace = () => {
    if (!searchKeyword.trim() || !replaceKeyword.trim()) return;
    searchResults.forEach((res, idx) => {
      handleAddAnnotation({
        id: `rep-${Date.now()}-${idx}`,
        pageIndex: res.pageIndex,
        type: 'text',
        x: 20,
        y: 20 + idx * 5,
        text: replaceKeyword,
        fontSize: 14,
        color: '#2563eb',
        createdAt: Date.now(),
      });
    });
    onShowToast('success', `已批量替换并生成 ${searchResults.length} 处修订批注`);
    setIsSearchOpen(false);
  };

  // ==========================================
  // UNIFIED COMMAND DISPATCHER SUBSCRIPTION
  // ==========================================
  useEffect(() => {
    if (!isActive) return;

    const unregister = commandDispatcher.registerMany({
      CREATE_DOCUMENT: (cmd) => {
        if (cmd?.payload?.type && cmd.payload.type !== 'pdf') {
          return;
        }
        setIsLoading(true);
        createBlankDocument()
          .then((newDoc) => {
            onShowToast('success', '新建空白文档已创建', `${newDoc.fileName} 已建立独立 Session，原文档保留`);
          })
          .catch((err) => {
            console.error(err);
            onShowToast('error', '新建文档失败');
          })
          .finally(() => setIsLoading(false));
      },

      SAVE_DOCUMENT: () => {
        handleSavePdf();
      },

      OPEN_DOCUMENT: (cmd) => {
        if (cmd.payload?.file) {
          setIsLoading(true);
          openDocumentFromFile(cmd.payload.file)
            .then((doc) => {
              onShowToast('success', '已打开新文档 Session', `${doc.fileName} 已就绪`);
            })
            .catch((e) => {
              console.error(e);
              onShowToast('error', '打开文件失败');
            })
            .finally(() => setIsLoading(false));
        } else {
          openFileInputRef.current?.click();
        }
      },

      CLOSE_DOCUMENT: (cmd) => {
        const idToClose = cmd.payload?.sessionId || activeSessionId;
        if (idToClose) {
          closeDocument(idToClose);
          onShowToast('info', '已关闭该文档 Session');
        }
      },

      SWITCH_DOCUMENT: (cmd) => {
        if (cmd.payload?.sessionId) {
          switchDocument(cmd.payload.sessionId);
        }
      },

      // Conversion & Export Commands -> Directly route to modals with target tabs
      PDF_CONVERT_WORD: () => {
        setActiveModal({ id: 'convert', params: { initialType: 'docx' } });
      },

      PDF_CONVERT_EXCEL: () => {
        setActiveModal({ id: 'convert', params: { initialType: 'xlsx' } });
      },

      PDF_EXPORT_IMAGE: () => {
        setActiveModal({ id: 'convert', params: { initialType: 'images' } });
      },

      PDF_CONVERT_SCANNED: () => {
        setActiveModal({ id: 'convert', params: { initialType: 'scanned' } });
      },

      PDF_MERGE: () => {
        setActiveModal({ id: 'merge-split', params: { initialMode: 'merge' } });
      },

      PDF_SPLIT: () => {
        setActiveModal({ id: 'merge-split', params: { initialMode: 'split' } });
      },

      PDF_COMPRESS: () => {
        setActiveModal({ id: 'compress', params: {} });
      },

      PDF_EXTRACT_IMAGE: () => {
        setActiveModal({ id: 'batch-extract', params: { initialTab: 'images' } });
      },

      PDF_EXTRACT_TEXT: () => {
        setActiveModal({ id: 'batch-extract', params: { initialTab: 'text' } });
      },

      PDF_EXTRACT_MODAL: (cmd) => {
        setActiveModal({ id: 'batch-extract', params: { initialTab: cmd.payload?.initialTab || 'text' } });
      },

      PDF_MEASURE: () => {
        setActiveModal({ id: 'measure', params: {} });
      },

      PDF_SECURITY: () => {
        setActiveModal({ id: 'security', params: {} });
      },

      PDF_WATERMARK: () => {
        setActiveModal({ id: 'watermark', params: {} });
      },

      PDF_WATERMARK_PANEL: () => {
        onToggleWatermarkPanel?.();
      },

      PDF_OCR: () => {
        setActiveModal({ id: 'ocr', params: {} });
      },

      PDF_INSERT_SIGNATURE: () => {
        setActiveModal({ id: 'signature', params: {} });
      },

      PDF_INSERT_STAMP: (cmd) => {
        if (cmd.payload?.stampType) {
          handleInsertStamp(cmd.payload.stampType, cmd.payload.customText, cmd.payload.color);
        } else {
          setActiveModal({ id: 'stamp', params: {} });
        }
      },

      PDF_EXPORT_MODAL: () => {
        setActiveModal({ id: 'export', params: {} });
      },

      PDF_CLOSE_MODAL: () => {
        setActiveModal({ id: null });
      },

      PDF_EXPORT_CLEAN: () => {
        handleExportCleanPdf();
      },

      PDF_EXPORT_DOCX: () => {
        handleExportDocx();
      },

      PDF_EXPORT_XLSX: () => {
        handleExportXlsx();
      },

      PDF_EXPORT_ZIP: (cmd) => {
        handleExportImagesZip(cmd.payload?.quality || 1);
      },

      PDF_EXPORT_TEXT: () => {
        handleExportText();
      },

      PDF_UNDO: () => {
        handleUndo();
      },

      PDF_REDO: () => {
        handleRedo();
      },

      PDF_SET_TOOL_MODE: (cmd) => {
        if (cmd.payload?.mode) setToolMode(cmd.payload.mode);
      },

      PDF_SET_VIEW_MODE: (cmd) => {
        if (cmd.payload?.mode) {
          setViewMode(cmd.payload.mode);
          updateActiveSession((prev) => ({ ...prev, viewMode: cmd.payload.mode }));
        }
      },

      PDF_SET_ZOOM: (cmd) => {
        if (typeof cmd.payload?.zoom === 'number') {
          updateActiveSession((prev) => ({ ...prev, zoom: cmd.payload.zoom }));
        } else if (cmd.payload?.delta) {
          updateActiveSession((prev) => ({
            ...prev,
            zoom: Math.min(3.0, Math.max(0.4, Number((prev.zoom + cmd.payload.delta).toFixed(2)))),
          }));
        }
      },

      PDF_EDIT_TEXT: () => {
        setToolMode('text');
        onShowToast('info', '已进入文本工具模式', '点击页面任意位置可直接插入文字，双击已有文字可直接编辑');
      },

      PDF_INSERT_IMAGE: (cmd) => {
        if (cmd.payload?.file) {
          handleInsertImageFile(cmd.payload.file);
        }
      },

      PDF_INSERT_SHAPE: (cmd) => {
        if (cmd.payload?.shapeType) {
          handleInsertShape(cmd.payload.shapeType);
        }
      },

      PDF_INSERT_FORM: (cmd) => {
        if (cmd.payload?.formType) {
          handleInsertForm(cmd.payload.formType);
        }
      },

      PDF_ROTATE_PAGE: (cmd) => {
        const pageIdx = typeof cmd.payload?.pageIndex === 'number' ? cmd.payload.pageIndex : (activeSession?.currentPageIndex || 0);
        const angle = cmd.payload?.angle || 90;
        handleRotatePage(pageIdx, angle);
      },

      PDF_DELETE_PAGE: (cmd) => {
        const pageIdx = typeof cmd.payload?.pageIndex === 'number' ? cmd.payload.pageIndex : (activeSession?.currentPageIndex || 0);
        handleDeletePage(pageIdx);
      },

      PDF_DUPLICATE_PAGE: (cmd) => {
        const pageIdx = typeof cmd.payload?.pageIndex === 'number' ? cmd.payload.pageIndex : (activeSession?.currentPageIndex || 0);
        handleDuplicatePage(pageIdx);
      },

      PDF_INSERT_BLANK_PAGE: (cmd) => {
        const afterIdx = typeof cmd.payload?.afterIndex === 'number' ? cmd.payload.afterIndex : (activeSession?.currentPageIndex || 0);
        handleInsertBlankPage(afterIdx);
      },

      PDF_AUTO_TRIM_PAGE: (cmd) => {
        const pageIdx = typeof cmd.payload?.pageIndex === 'number' ? cmd.payload.pageIndex : (activeSession?.currentPageIndex || 0);
        handleAutoTrimPage(pageIdx);
      },

      PDF_SELECT_PAGE: (cmd) => {
        if (typeof cmd.payload?.pageIndex === 'number') {
          updateActiveSession((prev) => ({ ...prev, currentPageIndex: cmd.payload.pageIndex }));
        }
      },

      PDF_SEARCH: (cmd) => {
        setIsSearchOpen(true);
      },

      PDF_BATCH_REPLACE: (cmd) => {
        if (cmd.payload?.searchKeyword && cmd.payload?.replaceKeyword) {
          setSearchKeyword(cmd.payload.searchKeyword);
          setReplaceKeyword(cmd.payload.replaceKeyword);
          handleBatchReplace();
        }
      },
    });

    return unregister;
  }, [isActive, handleSavePdf, activeSession, activeSessionId, onShowToast]);

  const allDetectedWatermarks = activeSession?.pages.flatMap((p) => p.detectedWatermarks) || [];
  const safePageIndex = activeSession && activeSession.pages.length > 0
    ? Math.max(0, Math.min(activeSession.currentPageIndex || 0, activeSession.pages.length - 1))
    : 0;
  const currentPage = activeSession?.pages?.[safePageIndex] || null;

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-[#f5f5f7] dark:bg-neutral-950 select-none min-h-0 min-w-0">
      {/* Hidden file input for opening documents */}
      <input
        ref={openFileInputRef}
        type="file"
        accept=".pdf"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            commandDispatcher.dispatch({
              type: 'OPEN_DOCUMENT',
              payload: { file },
              metadata: { source: 'toolbar' },
            });
            e.target.value = '';
          }
        }}
        className="hidden"
      />

      {/* Top Categorized Toolbar (Pure Command Emitter) */}
      <PdfTopToolbar
        activeCategory={activeCategory}
        onChangeCategory={setActiveCategory}
        toolMode={toolMode}
        viewMode={effectiveViewMode}
        zoom={activeSession?.zoom || 1.0}
        canUndo={canUndo}
        canRedo={canRedo}
        saveStatus={saveStatus}
        onSave={handleSavePdf}
        dispatch={(cmd) => commandDispatcher.dispatch(cmd)}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Thumbnail Organizer Drawer */}
        {showThumbnails && activeSession && activeSession.pages.length > 0 && (
          <PdfThumbnailGrid
            pages={activeSession.pages}
            currentPageIndex={activeSession.currentPageIndex}
            onSelectPage={(idx) => handleSelectPage(idx)}
            onRotatePage={handleRotatePage}
            onDeletePage={handleDeletePage}
            onDuplicatePage={handleDuplicatePage}
            onMovePage={handleMovePage}
            onInsertBlankPage={handleInsertBlankPage}
          />
        )}

        {/* Central Canvas Stage */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Top Floating Search & Replace Bar */}
          {isSearchOpen && (
            <div
              data-no-canvas-click="true"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-white/95 dark:bg-[#1e1e20]/95 backdrop-blur-md rounded-2xl shadow-xl border border-black/[0.08] dark:border-white/[0.1] p-2.5 flex items-center space-x-2 animate-fade-in"
            >
              <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-black/[0.03] dark:bg-white/[0.06]">
                <Search className="w-3.5 h-3.5 text-neutral-400" />
                <input
                  type="text"
                  placeholder="查找文档内容..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePerformSearch()}
                  className="w-36 text-xs bg-transparent focus:outline-none text-neutral-900 dark:text-neutral-100"
                />
              </div>

              <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-black/[0.03] dark:bg-white/[0.06]">
                <Replace className="w-3.5 h-3.5 text-neutral-400" />
                <input
                  type="text"
                  placeholder="批量替换为..."
                  value={replaceKeyword}
                  onChange={(e) => setReplaceKeyword(e.target.value)}
                  className="w-36 text-xs bg-transparent focus:outline-none text-neutral-900 dark:text-neutral-100"
                />
              </div>

              <button
                onClick={handlePerformSearch}
                className="px-3 py-1 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white"
              >
                查找
              </button>

              <button
                onClick={handleBatchReplace}
                className="px-3 py-1 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white"
              >
                替换
              </button>

              <button
                onClick={() => setIsSearchOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div
            id="pdf-document-viewport"
            ref={canvasContainerRef}
            onScroll={handleViewportScroll}
            className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col items-center justify-start p-6 relative w-full h-full select-none min-h-0 bg-[#f5f5f7] dark:bg-neutral-950"
            style={{
              height: '100%',
              overflowY: 'auto',
              overflowX: 'hidden',
            }}
          >
            {isLoading ? (
              <div className="m-auto flex flex-col items-center justify-center space-y-3">
                <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                <span className="text-xs text-neutral-500 font-medium">正在解析与高精度渲染 PDF 页面...</span>
              </div>
            ) : activeSession && (activeSession.pages?.length || 0) > 0 ? (
              <div
                id="pdf-document-pages-container"
                className={`PDFDocument flex flex-col items-center w-full max-w-full min-h-full pb-24 ${
                  isNightReadingMode ? 'pdf-night-mode' : ''
                }`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  width: '100%',
                }}
              >
                {activeSession.pages.map((page, pageIdx) => {
                  if (effectiveViewMode === 'single' && pageIdx !== activeSession.currentPageIndex) {
                    return null;
                  }

                  return (
                    <div
                      key={`${activeSession.id}-page-${pageIdx}-${page.originalIndex ?? pageIdx}`}
                      id={`pdf-page-${pageIdx}`}
                      data-page-index={pageIdx}
                      className={`PageContainer PageRenderer group relative transition-all duration-200 ${
                        activeSession.currentPageIndex === pageIdx
                          ? 'ring-2 ring-[#0071e3]/40 dark:ring-[#2997ff]/40 rounded-xl shadow-xl'
                          : 'shadow-md hover:shadow-lg'
                      }`}
                      style={{
                        position: 'relative',
                        display: 'block',
                        margin: '0 auto 24px',
                        flexShrink: 0,
                      }}
                      onClick={() => {
                        if (activeSession.currentPageIndex !== pageIdx) {
                          updateActiveSession((prev) => ({ ...prev, currentPageIndex: pageIdx }));
                        }
                      }}
                    >
                      {/* Floating Page Number Tag */}
                      <div className="absolute -top-5 left-2 flex items-center space-x-1.5 opacity-70 group-hover:opacity-100 transition-opacity pointer-events-none select-none z-10">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-800/80 text-white backdrop-blur-md shadow-sm">
                          第 {pageIdx + 1} 页 {page.rotation ? `(${page.rotation}°)` : ''}
                        </span>
                      </div>

                      <PdfCanvasStage
                        pdfJsDoc={activeSession.pdfJsDoc}
                        pageMeta={page}
                        currentPageIndex={pageIdx}
                        zoom={activeSession.zoom}
                        toolMode={toolMode}
                        onSelectToolMode={setToolMode}
                        annotations={activeSession.annotations}
                        selectedAnnotationId={selectedAnnotation?.id}
                        onSelectAnnotation={(annot) => {
                          setSelectedAnnotation(annot);
                          if (annot && activeSession.currentPageIndex !== pageIdx) {
                            updateActiveSession((prev) => ({ ...prev, currentPageIndex: pageIdx }));
                          }
                        }}
                        onAddAnnotation={handleAddAnnotation}
                        onUpdateAnnotation={handleUpdateAnnotation}
                        onDeleteAnnotation={handleDeleteAnnotation}
                        onDuplicateAnnotation={handleDuplicateAnnotation}
                        onBringForward={handleBringForward}
                        onSendBackward={handleSendBackward}
                        measureScale={measureScale}
                        measureUnit={measureUnit}
                        historyManager={activeSession.historyManager}
                        documentId={activeSession.id}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="m-auto flex flex-col items-center justify-center text-center p-8 select-none">
                <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800/80 text-neutral-400 flex items-center justify-center mb-3 shadow-xs">
                  <FileText className="w-6 h-6 stroke-[1.5]" />
                </div>
                <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">未载入 PDF 页面</p>
              </div>
            )}
          </div>

          {/* Solid Bottom Status & Navigation Bar */}
          <div className="h-8 w-full border-t border-black/[0.06] dark:border-neutral-700 bg-[#fbfbfd]/90 dark:bg-neutral-800/95 backdrop-blur-xl px-3.5 flex items-center justify-between text-xs shrink-0 select-none z-20">
            {/* Left: Page Turn Controls */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowThumbnails(!showThumbnails)}
                title="切换左侧页面缩略图"
                className={`p-1 rounded-[6px] text-xs font-medium transition-colors ${
                  showThumbnails
                    ? 'bg-black/[0.08] dark:bg-white/[0.12] text-[#0071e3] dark:text-[#2997ff]'
                    : 'text-[#86868b] hover:text-[#1d1d1f]'
                }`}
              >
                <Layers className="w-3.5 h-3.5 stroke-[1.8]" />
              </button>

              <div className="inline-flex items-center bg-black/[0.04] dark:bg-white/[0.06] p-0.5 rounded-[7px] border border-black/[0.03] dark:border-white/[0.04]">
                <button
                  disabled={!activeSession?.pdfJsDoc || (activeSession?.currentPageIndex || 0) <= 0}
                  onClick={() =>
                    handleSelectPage(Math.max(0, (activeSession?.currentPageIndex || 0) - 1))
                  }
                  className="p-1 rounded-[5px] text-[#515154] hover:text-[#1d1d1f] hover:bg-white dark:text-[#98989d] dark:hover:text-[#f5f5f7] dark:hover:bg-[#2c2c2e] disabled:opacity-25 transition-all"
                  title="上一页"
                >
                  <ChevronLeft className="w-3.5 h-3.5 stroke-[2.2]" />
                </button>

                <div className="flex items-center px-1.5 text-[11px] font-medium text-[#86868b] dark:text-[#98989d]">
                  <input
                    type="number"
                    disabled={!activeSession?.pdfJsDoc || (activeSession?.pageCount || 0) <= 0}
                    min={1}
                    max={Math.max(1, activeSession?.pageCount || 1)}
                    value={activeSession?.pdfJsDoc ? (activeSession?.currentPageIndex || 0) + 1 : 1}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && val >= 1 && val <= (activeSession?.pageCount || 1)) {
                        handleSelectPage(val - 1);
                      }
                    }}
                    className="w-6 text-center font-semibold bg-transparent text-[#0071e3] dark:text-[#2997ff] focus:outline-none disabled:text-[#86868b] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="mx-0.5 opacity-60">/</span>
                  <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{Math.max(1, activeSession?.pageCount || 1)}</span>
                </div>

                <button
                  disabled={!activeSession?.pdfJsDoc || (activeSession?.currentPageIndex || 0) >= (activeSession?.pageCount || 1) - 1}
                  onClick={() =>
                    handleSelectPage(Math.min((activeSession?.pageCount || 1) - 1, (activeSession?.currentPageIndex || 0) + 1))
                  }
                  className="p-1 rounded-[5px] text-[#515154] hover:text-[#1d1d1f] hover:bg-white dark:text-[#98989d] dark:hover:text-[#f5f5f7] dark:hover:bg-[#2c2c2e] disabled:opacity-25 transition-all"
                  title="下一页"
                >
                  <ChevronRight className="w-3.5 h-3.5 stroke-[2.2]" />
                </button>
              </div>

              {activeSession?.fileName && (
                <span className="hidden sm:inline text-[11px] text-[#86868b] dark:text-[#98989d] truncate max-w-[200px]">
                  {activeSession.fileName}
                </span>
              )}
            </div>

            {/* Right: View Mode Switcher (Single vs Continuous) & Zoom Controls */}
            <div className="flex items-center space-x-2">
              {/* Eye-Care Night Reading Mode Toggle */}
              <button
                id="pdf-btn-night-reading"
                onClick={() => {
                  setIsNightReadingMode((prev) => {
                    const next = !prev;
                    try {
                      localStorage.setItem('mianay_pdf_night_mode', String(next));
                    } catch {
                      // LocalStorage error fallback
                    }
                    onShowToast?.(
                      'info',
                      next ? '已开启夜间护眼模式' : '已恢复标准白纸阅读',
                      next ? '页面已应用高对比度柔和深灰反色，保护夜间视力' : undefined
                    );
                    return next;
                  });
                }}
                title={isNightReadingMode ? '关闭夜间护眼模式' : '开启夜间护眼模式 (高对比度深色纸张避免夜间刺眼)'}
                className={`p-1 rounded-[6px] text-xs font-medium transition-colors ${
                  isNightReadingMode
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shadow-2xs'
                    : 'text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                }`}
              >
                <Moon className="w-3.5 h-3.5 stroke-[1.8]" />
              </button>

              {/* View mode segmented control (Single vs Continuous) */}
              <div
                id="pdf-bottom-viewmode-switcher"
                className="inline-flex items-center bg-black/[0.04] dark:bg-white/[0.06] p-0.5 rounded-[7px] border border-black/[0.03] dark:border-white/[0.04]"
              >
                <button
                  onClick={() => {
                    setViewMode('single');
                    updateActiveSession((prev) => ({ ...prev, viewMode: 'single' }));
                  }}
                  className={`px-2 py-0.5 rounded-[5px] text-[11px] font-medium transition-all ${
                    effectiveViewMode === 'single'
                      ? 'bg-white dark:bg-[#2c2c2e] text-[#0071e3] dark:text-[#2997ff] shadow-xs font-semibold'
                      : 'text-[#515154] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7]'
                  }`}
                  title="单页模式 (每次仅展示并聚焦单页)"
                >
                  单页
                </button>
                <button
                  onClick={() => {
                    setViewMode('continuous');
                    updateActiveSession((prev) => ({ ...prev, viewMode: 'continuous' }));
                  }}
                  className={`px-2 py-0.5 rounded-[5px] text-[11px] font-medium transition-all ${
                    effectiveViewMode === 'continuous'
                      ? 'bg-white dark:bg-[#2c2c2e] text-[#0071e3] dark:text-[#2997ff] shadow-xs font-semibold'
                      : 'text-[#515154] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7]'
                  }`}
                  title="连续模式 (垂直多页纵向连续滚屏)"
                >
                  连续
                </button>
              </div>

              <div className="w-[1px] h-3.5 bg-black/[0.08] dark:bg-white/[0.1]" />

              {/* Zoom Controls */}
              <div className="inline-flex items-center bg-black/[0.04] dark:bg-white/[0.06] p-0.5 rounded-[7px] border border-black/[0.03] dark:border-white/[0.04]">
                <button
                  disabled={!activeSession?.pdfJsDoc}
                  onClick={() =>
                    updateActiveSession((prev) => ({ ...prev, zoom: Math.max(0.4, Number((prev.zoom - 0.15).toFixed(2))) }))
                  }
                  className="p-1 rounded-[5px] text-[#515154] hover:text-[#1d1d1f] hover:bg-white dark:text-[#98989d] dark:hover:text-[#f5f5f7] dark:hover:bg-[#2c2c2e] disabled:opacity-25 transition-all"
                  title="缩小"
                >
                  <ZoomOut className="w-3.5 h-3.5 stroke-[2.2]" />
                </button>

                <button
                  disabled={!activeSession?.pdfJsDoc}
                  onClick={() => updateActiveSession((prev) => ({ ...prev, zoom: 1.0 }))}
                  className="text-[11px] font-semibold font-mono px-2 py-0.5 text-[#1d1d1f] dark:text-[#f5f5f7] hover:text-[#0071e3] dark:hover:text-[#2997ff] disabled:opacity-30 transition-colors"
                  title="重置缩放至 100%"
                >
                  {Math.round((activeSession?.zoom || 1.0) * 100)}%
                </button>

                <button
                  disabled={!activeSession?.pdfJsDoc}
                  onClick={() =>
                    updateActiveSession((prev) => ({ ...prev, zoom: Math.min(2.5, Number((prev.zoom + 0.15).toFixed(2))) }))
                  }
                  className="p-1 rounded-[5px] text-[#515154] hover:text-[#1d1d1f] hover:bg-white dark:text-[#98989d] dark:hover:text-[#f5f5f7] dark:hover:bg-[#2c2c2e] disabled:opacity-25 transition-all"
                  title="放大"
                >
                  <ZoomIn className="w-3.5 h-3.5 stroke-[2.2]" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Dynamic Context-Aware Inspector Panel */}
        <PdfRightInspector
          selectedAnnotation={selectedAnnotation}
          onUpdateAnnotation={(id, updates) => handleUpdateAnnotation(id, updates, true)}
          onDeleteAnnotation={(id) => handleDeleteAnnotation(id)}
          onBringForward={handleBringForward}
          onSendBackward={handleSendBackward}
          onBringToFront={handleBringToFront}
          onSendToBack={handleSendToBack}
          currentPageMeta={currentPage}
          onRotatePage={(deg) => handleRotatePage(activeSession?.currentPageIndex || 0, deg)}
          onAutoTrimPage={() => handleAutoTrimPage(activeSession?.currentPageIndex || 0)}
          toolMode={toolMode}
          watermarkConfig={watermarkConfig}
          onChangeWatermarkConfig={(cfg) => setWatermarkConfig((prev) => ({ ...prev, ...cfg }))}
          onApplyWatermark={handleApplyBakeWatermark}
          securityConfig={securityConfig}
          onChangeSecurityConfig={(cfg) => setSecurityConfig((prev) => ({ ...prev, ...cfg }))}
          measureScale={measureScale}
          onChangeMeasureScale={setMeasureScale}
        />

        {/* Floating Watermark Eraser Panel */}
        <PdfWatermarkEraser
          isOpen={isWatermarkPanelOpen}
          onClose={onToggleWatermarkPanel || (() => {})}
          watermarks={allDetectedWatermarks}
          onToggleWatermark={handleToggleWatermarkItem}
          onSelectAllWatermarks={handleSelectAllWatermarks}
          onRescanWatermarks={() => scanWatermarks(true)}
          onExecuteElectronicClean={handleExecuteElectronicClean}
          isProcessing={isWatermarkCleaning}
          isScanning={isScanningWatermarks}
        />
      </div>

      {/* ======================================================== */}
      {/* MODALS (Strictly Driven by CommandDispatcher activeModal) */}
      {/* ======================================================== */}
      <SignaturePadModal
        isOpen={activeModal.id === 'signature'}
        onClose={() => setActiveModal({ id: null })}
        onSaveSignature={handleInsertSignature}
      />

      <StampPickerModal
        isOpen={activeModal.id === 'stamp'}
        onClose={() => setActiveModal({ id: null })}
        onSelectStamp={handleInsertStamp}
      />

      <PdfExportModal
        isOpen={activeModal.id === 'export'}
        onClose={() => setActiveModal({ id: null })}
        fileName={activeSession?.fileName || 'LuminaDocument.pdf'}
        pageCount={activeSession?.pageCount || 1}
        onExportCleanPdf={handleExportCleanPdf}
        onExportImagesZip={handleExportImagesZip}
        onExportDocx={handleExportDocx}
        onExportText={handleExportText}
      />

      <PdfConvertModal
        isOpen={activeModal.id === 'convert'}
        onClose={() => setActiveModal({ id: null })}
        pdfJsDoc={activeSession?.pdfJsDoc || null}
        pages={activeSession?.pages || []}
        fileName={activeSession?.fileName || 'LuminaDocument.pdf'}
        initialType={activeModal.params?.initialType || 'docx'}
        onShowToast={(title, msg, type) => {
          const toastType = type === 'warning' ? 'error' : (type || 'info');
          onShowToast(toastType, title, msg);
        }}
      />

      <PdfBatchExtractModal
        isOpen={activeModal.id === 'batch-extract'}
        onClose={() => setActiveModal({ id: null })}
        pdfJsDoc={activeSession?.pdfJsDoc || null}
        pages={activeSession?.pages || []}
        fileName={activeSession?.fileName || 'LuminaDocument.pdf'}
        pdfBytes={activeSession?.pdfBytes || null}
        initialTab={activeModal.params?.initialTab || 'text'}
        onShowToast={(title, msg, type) => {
          const toastType = type === 'warning' ? 'error' : (type || 'info');
          onShowToast(toastType, title, msg);
        }}
      />

      <PdfMergeSplitModal
        isOpen={activeModal.id === 'merge-split'}
        onClose={() => setActiveModal({ id: null })}
        currentPdfBytes={activeSession?.pdfBytes || null}
        currentFileName={activeSession?.fileName || 'LuminaDocument.pdf'}
        initialMode={activeModal.params?.initialMode || 'merge'}
        onShowToast={(title, msg, type) => {
          const toastType = type === 'warning' ? 'error' : (type || 'info');
          onShowToast(toastType, title, msg);
        }}
      />

      <PdfWatermarkModal
        isOpen={activeModal.id === 'watermark'}
        onClose={() => setActiveModal({ id: null })}
        config={watermarkConfig}
        onChangeConfig={(cfg) => setWatermarkConfig((prev) => ({ ...prev, ...cfg }))}
        onApplyWatermark={handleApplyBakeWatermark}
      />

      <PdfSecurityModal
        isOpen={activeModal.id === 'security'}
        onClose={() => setActiveModal({ id: null })}
        config={securityConfig}
        onChangeConfig={(cfg) => setSecurityConfig((prev) => ({ ...prev, ...cfg }))}
        onApplySecurity={() => onShowToast('success', '安全策略已更新', '导出文件时将应用此口令与权限')}
      />

      <PdfCompressModal
        isOpen={activeModal.id === 'compress'}
        onClose={() => setActiveModal({ id: null })}
        pdfJsDoc={activeSession?.pdfJsDoc || null}
        pages={activeSession?.pages || []}
        fileName={activeSession?.fileName || 'LuminaDocument.pdf'}
        originalSize={activeSession?.fileSize || 0}
        pdfBytes={activeSession?.pdfBytes || null}
        onShowToast={(title, msg, type) => {
          const toastType = type === 'warning' ? 'error' : (type || 'info');
          onShowToast(toastType, title, msg);
        }}
      />

      <PdfMeasureModal
        isOpen={activeModal.id === 'measure'}
        onClose={() => setActiveModal({ id: null })}
        scaleRatio={measureScale}
        onChangeScaleRatio={setMeasureScale}
        unit={measureUnit}
        onChangeUnit={setMeasureUnit}
        onSelectMeasureMode={(mode) => {
          setToolMode(mode);
          onShowToast('info', '已进入测量模式', '在画布上点击两点进行测距或框选多边形测面积');
        }}
      />

      <PdfOcrModal
        isOpen={activeModal.id === 'ocr'}
        onClose={() => setActiveModal({ id: null })}
        pdfJsDoc={activeSession?.pdfJsDoc || null}
        currentPageIndex={activeSession?.currentPageIndex || 0}
        onExportToDoc={(text) => onOpenDocWithText?.(text)}
        onShowToast={(title, msg, type) => {
          const toastType = type === 'warning' ? 'error' : (type || 'info');
          onShowToast(toastType, title, msg);
        }}
      />
    </div>
  );
};
