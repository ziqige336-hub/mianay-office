import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import {
  FileText,
  Save,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Cpu,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Share2,
  BookOpen,
  Scroll,
  Layers,
  ChevronLeft,
  ChevronRight,
  Maximize,
  Sliders,
  X,
} from 'lucide-react';
import type { OfficeFile, DocOutlineItem, DocumentModel, ThemeMode } from '../../types';

export interface DocWordStats {
  characters: number;
  charactersNoSpaces: number;
  words: number;
  asianChars: number;
  nonAsianWords: number;
  paragraphs: number;
}

export function computeDocWordStats(text: string, rawDocJson?: any): DocWordStats {
  if (!text) {
    return {
      characters: 0,
      charactersNoSpaces: 0,
      words: 0,
      asianChars: 0,
      nonAsianWords: 0,
      paragraphs: 0,
    };
  }

  const characters = text.length;
  const charactersNoSpaces = text.replace(/\s+/g, '').length;

  // Chinese/Japanese/Korean character count
  const asianCharsMatch = text.match(/[\u4e00-\u9fa5\u0800-\u4e00\uac00-\ud7a3]/g);
  const asianChars = asianCharsMatch ? asianCharsMatch.length : 0;

  // Non-Asian words (Latin words, digits, hyphenated words)
  const nonAsianText = text.replace(/[\u4e00-\u9fa5\u0800-\u4e00\uac00-\ud7a3]/g, ' ');
  const nonAsianWordsMatch = nonAsianText.trim().match(/[a-zA-Z0-9_\u00C0-\u024F]+(-[a-zA-Z0-9_\u00C0-\u024F]+)*/g);
  const nonAsianWords = nonAsianWordsMatch ? nonAsianWordsMatch.length : 0;

  // Words per WPS Office & Microsoft Word standard: Asian characters count as 1 word each + non-Asian words
  const words = asianChars + nonAsianWords;

  // Paragraph count
  let paragraphs = 0;
  if (rawDocJson && Array.isArray(rawDocJson.content)) {
    paragraphs = rawDocJson.content.filter((n: any) => n.type === 'paragraph' || n.type === 'heading').length;
  } else {
    paragraphs = text.split(/\r?\n/).filter((l) => l.trim().length > 0).length || 1;
  }

  return {
    characters,
    charactersNoSpaces,
    words,
    asianChars,
    nonAsianWords,
    paragraphs,
  };
}
import { officeEngine } from '../../core/office';
import { documentService } from '../../services/DocumentService';
import { ProseMirrorAdapter } from '../../core/document/ProseMirrorAdapter';
import { ProseMirrorValidator } from '../../core/document/ProseMirrorValidator';
import { getLuminaDocExtensions } from '../../core/document/TiptapExtensions';
import { DocumentModelTracer } from '../../core/models/DocumentModel';
import { DocumentContentNormalizer } from '../../core/document/DocumentContentNormalizer';
import { DocumentSessionManager } from '../../core/document/DocumentSessionManager';
import { DocFormatControls } from './DocFormatControls';
import { EngineStatusModal } from '../engine/EngineStatusModal';
import { PageLayoutEngine, PageLayout, ComputedPageGeometry } from '../../core/document/PageLayoutEngine';
import { createPageBreakDecorations, pagedLayoutPluginKey } from '../../core/document/PagedLayoutPlugin';
import { DecorationSet } from '@tiptap/pm/view';
import { commandDispatcher } from '../../core/commands';

interface PureDocWorkbenchProps {
  currentFile?: OfficeFile;
  initialContent?: string;
  initialJson?: any;
  initialModel?: DocumentModel;
  initialTitle?: string;
  isActive?: boolean;
  themeMode?: ThemeMode;
  isInspectorOpen?: boolean;
  onToggleInspector?: () => void;
  onDocStatsChange?: (stats: { characters: number; words: number }) => void;
  onOutlineChange?: (outline: DocOutlineItem[]) => void;
  onEditorReady?: (editor: any) => void;
  onChangeContent?: (content: any, title: string, model?: DocumentModel, json?: any, status?: 'unsaved' | 'saved') => void;
  onShowToast: (type: 'success' | 'error' | 'info' | 'vip-free', title: string, description?: string) => void;
  onRequestExport?: () => void;
}

export type DocViewMode = 'paged' | 'continuous';

export const PureDocWorkbench: React.FC<PureDocWorkbenchProps> = ({
  currentFile,
  initialContent,
  initialJson,
  initialModel,
  initialTitle = '未命名文稿.docx',
  isActive = true,
  themeMode = 'light',
  isInspectorOpen = false,
  onToggleInspector,
  onDocStatsChange,
  onOutlineChange,
  onEditorReady,
  onChangeContent,
  onShowToast,
  onRequestExport,
}) => {
  const [docTitle, setDocTitle] = useState(initialTitle);
  const [isEngineStatusOpen, setIsEngineStatusOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [viewMode, setViewMode] = useState<DocViewMode>('paged');
  const [pageMargin, setPageMargin] = useState<'normal' | 'narrow' | 'wide'>('normal');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageCount, setPageCount] = useState<number>(1);
  const [docNodes, setDocNodes] = useState<any[]>([]);
  const [docStatsData, setDocStatsData] = useState<DocWordStats>(() =>
    computeDocWordStats(typeof initialContent === 'string' ? initialContent : '')
  );
  const [selectedStatsData, setSelectedStatsData] = useState<DocWordStats | null>(null);
  const [isWordCountModalOpen, setIsWordCountModalOpen] = useState<boolean>(false);

  const fileId = currentFile?.id || 'doc-default-1';
  const effectiveFileName = currentFile?.name || initialTitle || '文档.docx';
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const editorWrapperRef = useRef<HTMLDivElement>(null);
  const viewModeRef = useRef<DocViewMode>('paged');
  const pageMarginRef = useRef<'normal' | 'narrow' | 'wide'>(pageMargin);
  const zoomLevelRef = useRef<number>(zoomLevel);
  const editorRef = useRef<any>(null);

  const activeLayoutSettings = useMemo(() => {
    return initialModel?.layoutSettings || (currentFile?.content && typeof currentFile.content === 'object' ? currentFile.content.layoutSettings : null);
  }, [initialModel, currentFile]);
  const activeLayoutSettingsRef = useRef(activeLayoutSettings);

  useEffect(() => {
    activeLayoutSettingsRef.current = activeLayoutSettings;
  }, [activeLayoutSettings]);

  const computedGeometry: ComputedPageGeometry = useMemo(() => {
    return PageLayoutEngine.computeGeometry(activeLayoutSettings || pageMargin);
  }, [pageMargin, activeLayoutSettings]);
  const computedGeometryRef = useRef(computedGeometry);

  useEffect(() => {
    computedGeometryRef.current = computedGeometry;
  }, [computedGeometry]);

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  useEffect(() => {
    pageMarginRef.current = pageMargin;
  }, [pageMargin]);

  useEffect(() => {
    zoomLevelRef.current = zoomLevel;
  }, [zoomLevel]);

  // Parse any incoming payload (string HTML, ProseMirror JSON, DocumentModel, or plain text) into validated Editor-ready JSON or HTML
  const getInitialEditorContent = useCallback(() => {
    let rawContent: any = null;

    // 1. Direct initialJson or initialModel
    if (initialJson && typeof initialJson === 'object') {
      rawContent = initialJson;
    } else if (initialModel && (Array.isArray(initialModel.nodes) || Array.isArray(initialModel.blocks))) {
      rawContent =
        initialModel.proseMirrorJson ||
        ProseMirrorAdapter.structuredNodesToProseMirror(initialModel.nodes || initialModel.blocks || []);
    } else {
      // 2. Check currentFile.content
      const payload = currentFile?.content ?? initialContent;
      if (payload !== null && payload !== undefined) {
        if (typeof payload === 'string') {
          const trimmed = payload.trim();
          if (trimmed.length > 0) {
            // Check if string is JSON representation
            if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
              try {
                const parsed = JSON.parse(trimmed);
                if (parsed.type === 'doc') {
                  rawContent = parsed;
                } else if (parsed.proseMirrorJson) {
                  rawContent = parsed.proseMirrorJson;
                } else if (Array.isArray(parsed.nodes) || Array.isArray(parsed.blocks)) {
                  rawContent = ProseMirrorAdapter.structuredNodesToProseMirror(parsed.nodes || parsed.blocks);
                }
              } catch {
                // Not JSON, continue with normalizer
              }
            }
            if (!rawContent) {
              rawContent = DocumentContentNormalizer.extractHtmlString(payload);
            }
          }
        } else if (typeof payload === 'object') {
          if (payload.type === 'doc') {
            rawContent = payload;
          } else if (payload.proseMirrorJson) {
            rawContent = payload.proseMirrorJson;
          } else if (Array.isArray(payload.nodes) || Array.isArray(payload.blocks)) {
            rawContent = ProseMirrorAdapter.structuredNodesToProseMirror(payload.nodes || payload.blocks);
          } else {
            rawContent = DocumentContentNormalizer.extractHtmlString(payload);
          }
        }
      }
    }

    if (!rawContent) {
      return { type: 'doc', content: [{ type: 'paragraph' }] };
    }

    // Deduplicate any repeated sections if legacy state concatenated copies of the document
    if (typeof rawContent === 'string') {
      const h1Match = rawContent.match(/<h1[^>]*>(.*?)<\/h1>/i);
      if (h1Match && h1Match[1]) {
        const title = h1Match[1].trim();
        const escaped = title.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        const re = new RegExp(`<h1[^>]*>\\s*${escaped}\\s*<\\/h1>`, 'gi');
        const allMatches = Array.from(rawContent.matchAll(re));
        if (allMatches.length > 1 && allMatches[1].index !== undefined) {
          rawContent = rawContent.substring(0, allMatches[1].index).trim();
        }
      }
    } else if (typeof rawContent === 'object' && rawContent.type === 'doc' && Array.isArray(rawContent.content)) {
      const headings = rawContent.content.filter((n: any) => n.type === 'heading' && (!n.attrs || n.attrs.level === 1));
      if (headings.length > 1) {
        const firstTitle = (headings[0].content?.map((c: any) => c.text).join('') || '').trim();
        if (firstTitle) {
          const secondIdx = rawContent.content.findIndex(
            (n: any, i: number) => i > 0 && n.type === 'heading' && (n.content?.map((c: any) => c.text).join('') || '').trim() === firstTitle
          );
          if (secondIdx > 0) {
            rawContent = {
              ...rawContent,
              content: rawContent.content.slice(0, secondIdx),
            };
          }
        }
      }
    }

    if (typeof rawContent === 'object' && rawContent.type === 'doc') {
      const { report, sanitizedDoc } = ProseMirrorValidator.validate(rawContent);
      if (!report.isValid && report.errorMessage) {
        console.warn('⚠️ ProseMirror JSON Schema Validation Warning:', report);
      }
      return sanitizedDoc;
    }

    return rawContent;
  }, [currentFile, initialContent, initialJson, initialModel]);

  // Recalculate dynamic page metrics
  const updatePageMetrics = useCallback(() => {
    if (editorRef.current && !editorRef.current.isDestroyed) {
      (editorRef.current.commands as any).recomputePagedLayout?.();
    }
  }, []);

  // Initialize Tiptap Editor with dedicated non-conflicting extensions & coordinates filtering
  const editor = useEditor({
    extensions: getLuminaDocExtensions({
      getViewMode: () => viewModeRef.current,
      getMargin: () => activeLayoutSettingsRef.current || pageMarginRef.current,
      onPageCountChange: (count) => {
        setPageCount((prev) => (prev !== count ? count : prev));
      },
    }),
    content: getInitialEditorContent(),
    editorProps: {
      handleKeyDown: (view, event) => {
        if (viewModeRef.current !== 'paged') return false;
        return PageLayoutEngine.handlePagedKeyDown(
          view,
          event,
          editorWrapperRef.current,
          activeLayoutSettingsRef.current || pageMarginRef.current,
          zoomLevelRef.current / 100
        );
      },
      handleClick: (view, pos, event) => {
        if (viewModeRef.current !== 'paged') return false;
        const target = event.target as HTMLElement;
        if (
          target.closest('.doc-page-gap') ||
          target.closest('.doc-page-header') ||
          target.closest('.doc-page-footer')
        ) {
          return true; // handled, don't let ProseMirror focus or place caret
        }
        return false;
      },
      handleDOMEvents: {
        mousedown: (view, event) => {
          if (viewModeRef.current !== 'paged') return false;
          const target = event.target as HTMLElement;
          if (
            target.closest('.doc-page-gap') ||
            target.closest('.doc-page-header') ||
            target.closest('.doc-page-footer')
          ) {
            event.preventDefault();
            event.stopPropagation();
            return true;
          }
          if (editorWrapperRef.current) {
            const rect = editorWrapperRef.current.getBoundingClientRect();
            const scale = zoomLevelRef.current / 100;
            const relY = (event.clientY - rect.top) / scale;
            if (PageLayoutEngine.isPointInPageGap(relY, activeLayoutSettingsRef.current || pageMarginRef.current)) {
              event.preventDefault();
              event.stopPropagation();
              return true;
            }
          }
          return false;
        },
        pointerdown: (view, event) => {
          if (viewModeRef.current !== 'paged') return false;
          const target = event.target as HTMLElement;
          if (
            target.closest('.doc-page-gap') ||
            target.closest('.doc-page-header') ||
            target.closest('.doc-page-footer')
          ) {
            event.preventDefault();
            event.stopPropagation();
            return true;
          }
          if (editorWrapperRef.current) {
            const rect = editorWrapperRef.current.getBoundingClientRect();
            const scale = zoomLevelRef.current / 100;
            const relY = (event.clientY - rect.top) / scale;
            if (PageLayoutEngine.isPointInPageGap(relY, activeLayoutSettingsRef.current || pageMarginRef.current)) {
              event.preventDefault();
              event.stopPropagation();
              return true;
            }
          }
          return false;
        },
      },
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      if (from !== to) {
        const selText = editor.state.doc.textBetween(from, to, ' ');
        if (selText.trim().length > 0) {
          setSelectedStatsData(computeDocWordStats(selText));
        } else {
          setSelectedStatsData(null);
        }
      } else {
        setSelectedStatsData(null);
      }
    },
    onUpdate: ({ editor }) => {
      // IME Composition Guard: Do not churn React state during active IME pinyin input
      if ((editor?.view as any)?.composing) {
        return;
      }

      const html = editor.getHTML();
      const text = editor.getText();
      const json = editor.getJSON();
      const calculatedStats = computeDocWordStats(text, json);
      setDocStatsData(calculatedStats);

      // Real Data Tracking: Editor Input -> Adapter -> DocumentModel -> Export Source
      const structuredNodes = ProseMirrorAdapter.proseMirrorToStructuredNodes(json);
      setDocNodes(structuredNodes);
      const activeDocModel: DocumentModel = {
        id: fileId,
        title: docTitle,
        updatedAt: Date.now(),
        nodes: structuredNodes,
        blocks: structuredNodes,
        metadata: {
          id: fileId,
          title: docTitle,
          createdAt: currentFile?.createdAt || Date.now(),
          updatedAt: Date.now(),
        },
      };
      DocumentModelTracer.traceInputToModel(text.substring(0, 100), 'Tiptap ProseMirror Editor', activeDocModel);

      // Update DocumentSessionManager directly with live functions
      DocumentSessionManager.updateSessionContent(fileId, {
        docState: json,
        getVisibleTextPreview: () => editor.getText(),
        getExportContent: () => editor.getHTML(),
      });

      // Real-Time Diagnostic Log Matching User Specification
      DocumentSessionManager.logSyncStatus({
        editorText: text,
        editorStateSize: JSON.stringify(json).length,
        sessionContent: html,
        fileContent: typeof currentFile?.content === 'string' ? currentFile.content : JSON.stringify(currentFile?.content || ''),
        exportPayload: html,
      });

      onDocStatsChange?.({ characters: calculatedStats.characters, words: calculatedStats.words });
      setSaveStatus('unsaved');
      onChangeContent?.(html, docTitle, activeDocModel, json);

      // Extract outline with strict deduplication
      const outline: DocOutlineItem[] = [];
      const seenOutline = new Set<string>();
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          const rawLevel = node.attrs.level || 1;
          const validLevel = (rawLevel >= 1 && rawLevel <= 3 ? rawLevel : 1) as 1 | 2 | 3;
          const title = (node.textContent || '').trim();
          if (title) {
            const key = `${validLevel}:::${title}`;
            if (!seenOutline.has(key)) {
              seenOutline.add(key);
              outline.push({
                id: `h-${pos}`,
                title,
                level: validLevel,
                pos,
              });
            }
          }
        }
      });
      onOutlineChange?.(outline);

      // Real-time pagination calculation (EMERGENCY FUSE: strictly disabled)
    },
  });
  editorRef.current = editor;

  // Track layout & mode changes
  useEffect(() => {
    if (viewMode !== 'paged') {
      if (editorWrapperRef.current) {
        PageLayoutEngine.clearPagedLayoutFromDom(editorWrapperRef.current);
      }
      if (editor && !editor.isDestroyed) {
        (editor.commands as any).resetPagedLayout?.();
      }
      setPageCount(1);
      setCurrentPage(1);
    } else {
      if (editor && !editor.isDestroyed) {
        (editor.commands as any).recomputePagedLayout?.(true);
      }
    }
  }, [viewMode, pageMargin, editor]);

  // Track scroll position to update current active page indicator
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (viewMode !== 'paged') return;
      const scrollTop = container.scrollTop;
      const pageStride = computedGeometry.pageStridePx;
      const current = Math.min(pageCount, Math.max(1, Math.floor((scrollTop + 200) / pageStride) + 1));
      setCurrentPage(current);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [viewMode, pageCount, computedGeometry.pageStridePx]);

  // Register session with DocumentSessionManager and DocumentService
  useEffect(() => {
    if (editor) {
      const text = editor.getText();
      const json = editor.getJSON();
      const calculatedStats = computeDocWordStats(text, json);
      setDocStatsData(calculatedStats);
      onDocStatsChange?.({ characters: calculatedStats.characters, words: calculatedStats.words });

      const outline: DocOutlineItem[] = [];
      const seenOutline = new Set<string>();
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          const rawLevel = node.attrs.level || 1;
          const validLevel = (rawLevel >= 1 && rawLevel <= 3 ? rawLevel : 1) as 1 | 2 | 3;
          const title = (node.textContent || '').trim();
          if (title) {
            const key = `${validLevel}:::${title}`;
            if (!seenOutline.has(key)) {
              seenOutline.add(key);
              outline.push({
                id: `h-${pos}`,
                title,
                level: validLevel,
                pos,
              });
            }
          }
        }
      });
      onOutlineChange?.(outline);

      const initialStructured = ProseMirrorAdapter.proseMirrorToStructuredNodes(editor.getJSON());
      setDocNodes(initialStructured);

      DocumentSessionManager.registerSession({
        fileId,
        fileName: effectiveFileName,
        type: 'doc',
        docState: editor.getJSON(),
        getVisibleTextPreview: () => editor.getText(),
        getExportContent: () => editor.getHTML(),
      });

      documentService.registerEditor(editor, currentFile || {
        id: fileId,
        name: effectiveFileName,
        type: 'doc',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        content: editor.getHTML(),
        versionHistory: [],
      });
      onEditorReady?.(editor);
    }
  }, [editor, fileId, effectiveFileName]);

  // Sync with file prop changes (when switching files or when external content is injected)
  useEffect(() => {
    if (editor && currentFile) {
      const contentToSet = getInitialEditorContent();
      editor.commands.setContent(contentToSet);
      setDocTitle(currentFile.name || initialTitle);
      const text = editor.getText();
      const json = editor.getJSON();
      const calculatedStats = computeDocWordStats(text, json);
      setDocStatsData(calculatedStats);
      onDocStatsChange?.({ characters: calculatedStats.characters, words: calculatedStats.words });
      
      DocumentSessionManager.updateSessionContent(fileId, {
        docState: editor.getJSON(),
        getVisibleTextPreview: () => editor.getText(),
        getExportContent: () => editor.getHTML(),
      });
    }
  }, [currentFile?.id, currentFile?.modifiedAt]);

  // Sync to office engine store on mount
  useEffect(() => {
    const fileToSync: OfficeFile = currentFile || {
      id: fileId,
      name: effectiveFileName,
      type: 'doc',
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      content: editor ? editor.getHTML() : '',
      versionHistory: [],
    };
    officeEngine.openDocument(fileToSync).catch(console.warn);
  }, [fileId, effectiveFileName]);

  // Real Physical Page Layout Computation
  const pages: PageLayout[] = useMemo(() => {
    return [{
      pageIndex: 0,
      pageNumber: 1,
      blocks: docNodes || [],
      usedHeight: 0,
      maxHeight: 1000,
    }];
  }, [docNodes]);

  const isSavingRef = useRef(false);

  const handleSave = useCallback(async () => {
    if (!editor || isSavingRef.current || saveStatus === 'saving') return;
    isSavingRef.current = true;
    setSaveStatus('saving');
    try {
      const html = editor.getHTML();
      const saveRes = await documentService.saveDocument();
      setSaveStatus('saved');
      onChangeContent?.(html, docTitle, undefined, undefined, 'saved');
      onShowToast('success', '文档已成功保存', `LibreOffice 原生 DOCX 格式 (${Math.round(saveRes.size / 1024)} KB)`);
    } catch (err: any) {
      setSaveStatus('unsaved');
      onShowToast('error', '保存失败', err?.message || '无法写入引擎');
    } finally {
      isSavingRef.current = false;
    }
  }, [editor, saveStatus, docTitle, onChangeContent, onShowToast]);

  // Unified Command Dispatcher Subscription for Pure Doc
  useEffect(() => {
    if (!isActive) return;

    const unregister = commandDispatcher.registerMany({
      SAVE_DOCUMENT: () => {
        handleSave();
      },
    });

    return () => unregister();
  }, [isActive, handleSave]);

  const handleZoom = (delta: number) => {
    setZoomLevel((prev) => Math.min(200, Math.max(50, prev + delta)));
  };

  // Wheel zoom with Ctrl / Cmd key (Word/WPS standard)
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || !isActive) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 10 : -10;
        setZoomLevel((prev) => Math.min(200, Math.max(50, prev + delta)));
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [isActive]);

  // Global Keyboard Shortcuts for PureDoc (Ctrl/Cmd +/-, Ctrl/Cmd 0)
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      if (isCtrlOrCmd) {
        if (e.key === '=' || e.key === '+' || e.code === 'NumpadAdd') {
          e.preventDefault();
          handleZoom(10);
        } else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') {
          e.preventDefault();
          handleZoom(-10);
        } else if (e.key === '0' || e.code === 'Numpad0') {
          e.preventDefault();
          setZoomLevel(100);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive]);

  const handleFitWidth = () => {
    if (!scrollContainerRef.current) return;
    const containerWidth = scrollContainerRef.current.clientWidth - 48;
    const targetWidth = viewMode === 'paged' ? computedGeometryRef.current.pageWidthPx : 794;
    if (targetWidth > 0) {
      const calculatedZoom = Math.min(180, Math.max(50, Math.round((containerWidth / targetWidth) * 100)));
      setZoomLevel(calculatedZoom);
    }
  };

  const scrollToPage = (targetPage: number) => {
    if (!scrollContainerRef.current) return;
    const pageStride = computedGeometryRef.current.pageStridePx;
    const targetTop = (targetPage - 1) * pageStride;
    scrollContainerRef.current.scrollTo({
      top: targetTop,
      behavior: 'smooth',
    });
    setCurrentPage(targetPage);
  };

  // Diagnostic logging for Paged Mode startup & layout verification (Matching spec)
  useEffect(() => {
    if (viewMode === 'paged' && editor) {
      const timer = setTimeout(() => {
        const pmEl = editorWrapperRef.current?.querySelector('.ProseMirror') as HTMLElement | null;
        const viewportEl = scrollContainerRef.current;
        const workspaceEl = viewportEl?.parentElement;

        const editorRect = pmEl?.getBoundingClientRect() || { top: 0, left: 0, width: 0, height: 0 };
        const viewportRect = viewportEl?.getBoundingClientRect() || { top: 0, left: 0, width: 0, height: 0 };
        const workspaceRect = workspaceEl?.getBoundingClientRect() || { top: 0, left: 0, width: 0, height: 0 };
        const geo = computedGeometryRef.current;

        const diag = {
          viewMode: 'paged',
          editorEditable: editor.isEditable,
          contentEditable: pmEl?.contentEditable === 'true',
          editorInstanceId: (editor as any)?.view?.dom?.id || `tiptap-${fileId}`,
          documentNodeCount: editor.state.doc.childCount,
          pageCount: Math.max(1, pageCount),
          pageContainers: Math.max(1, pageCount),
          geometry: {
            pageWidthPx: geo.pageWidthPx,
            pageHeightPx: geo.pageHeightPx,
            pageStridePx: geo.pageStridePx,
            marginTopPx: geo.marginTopPx,
            marginBottomPx: geo.marginBottomPx,
            contentHeightPx: geo.contentHeightPx,
          },
          editorRect: {
            top: Math.round(editorRect.top),
            left: Math.round(editorRect.left),
            width: Math.round(editorRect.width),
            height: Math.round(editorRect.height),
          },
          viewportRect: {
            top: Math.round(viewportRect.top),
            left: Math.round(viewportRect.left),
            width: Math.round(viewportRect.width),
            height: Math.round(viewportRect.height),
          },
          workspaceRect: {
            top: Math.round(workspaceRect.top),
            left: Math.round(workspaceRect.left),
            width: Math.round(workspaceRect.width),
            height: Math.round(workspaceRect.height),
          },
        };
        console.log('📑 [Lumina PureDoc Paged Mode Startup Diagnostic]:', diag);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [viewMode, editor, pageCount, fileId]);

  // Diagnostic 4-Page Verification Logging (Page 1-4 validation against PageFrame geometry)
  useEffect(() => {
    if (viewMode === 'paged' && editor && pageCount >= 1) {
      const timer = setTimeout(() => {
        const pmEl = editorWrapperRef.current?.querySelector('.ProseMirror') as HTMLElement | null;
        if (!pmEl) return;

        const pmRect = pmEl.getBoundingClientRect();
        const scale = zoomLevelRef.current / 100;
        const geo = computedGeometryRef.current;

        const pageData: Record<number, any> = {};
        const children = Array.from(pmEl.children) as HTMLElement[];

        for (let p = 0; p < Math.min(4, pageCount); p++) {
          const pageTop = p * geo.pageStridePx;
          const pageBottom = pageTop + geo.pageHeightPx;
          const contentTop = pageTop + geo.marginTopPx;
          const contentBottom = pageBottom - geo.marginBottomPx;

          const blocksOnPage = children.filter(
            (c) => c.getAttribute('data-page-index') === `${p}` && !c.classList.contains('pm-page-break-widget')
          );
          const breakWidget = children.find(
            (c) => c.classList.contains('pm-page-break-widget') && c.getAttribute('data-page-break-index') === `${p}`
          );

          let firstBlockTop = 0;
          let firstLineTop = 0;
          let lastBlockBottom = 0;
          let lastLineBottom = 0;

          if (blocksOnPage.length > 0) {
            const firstEl = blocksOnPage[0];
            const lastEl = blocksOnPage[blocksOnPage.length - 1];
            const firstRect = firstEl.getBoundingClientRect();
            const lastRect = lastEl.getBoundingClientRect();

            firstBlockTop = Math.round((firstRect.top - pmRect.top) / scale);
            firstLineTop = firstBlockTop;
            lastBlockBottom = Math.round((lastRect.bottom - pmRect.top) / scale);
            lastLineBottom = lastBlockBottom;
          }

          const firstLineOffset = firstLineTop - pageTop;
          const lastLineOffset = pageBottom - lastLineBottom;

          pageData[p + 1] = {
            page: p + 1,
            pageTop,
            pageBottom,
            contentTop,
            contentBottom,
            firstBlockTop,
            firstLineTop,
            lastBlockBottom,
            lastLineBottom,
            firstLineOffset,
            lastLineOffset,
            widgetHeight: breakWidget ? parseInt(breakWidget.style.height || '0', 10) : 0,
            blockCount: blocksOnPage.length,
          };
        }

        console.log('📐 [PageFrame Geometry 4-Page Verification]:', {
          geometry: {
            pageWidthPx: geo.pageWidthPx,
            pageHeightPx: geo.pageHeightPx,
            pageStridePx: geo.pageStridePx,
            marginTopPx: geo.marginTopPx,
            marginBottomPx: geo.marginBottomPx,
            contentHeightPx: geo.contentHeightPx,
          },
          pages: pageData,
          strideConsistency:
            pageCount > 1 && pageData[2] && pageData[1]
              ? `${pageData[2].pageTop - pageData[1].pageTop}px (expected ${geo.pageStridePx}px)`
              : 'Single page',
        });
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [viewMode, editor, pageCount, pageMargin, computedGeometry]);

  // Click & Cursor Placement Diagnostic
  const handleViewportClick = (e: React.MouseEvent) => {
    if (viewMode !== 'paged') return;
    const target = e.target as HTMLElement;
    if (
      target.closest('.doc-page-gap') ||
      target.closest('.doc-page-header') ||
      target.closest('.doc-page-footer')
    ) {
      return;
    }
    const nearestCE = target.closest('[contenteditable="true"]');
    const computedStyle = window.getComputedStyle(target);

    const viewportTop = scrollContainerRef.current?.getBoundingClientRect().top || 0;
    const clickYRelative = e.clientY - viewportTop + (scrollContainerRef.current?.scrollTop || 0);
    const pageIdx = Math.max(0, Math.floor(clickYRelative / computedGeometryRef.current.pageStridePx));

    const clickDiag = {
      eventTarget: target.tagName.toLowerCase() + (target.className ? `.${target.className.split(' ').slice(0, 2).join('.')}` : ''),
      nearestContentEditable: nearestCE ? 'contenteditable="true"' : 'none',
      editorInstanceId: (editor as any)?.view?.dom?.id || `tiptap-${fileId}`,
      pageIndex: pageIdx + 1,
      pointerEvents: computedStyle.pointerEvents,
      zIndex: computedStyle.zIndex,
    };
    console.log('🎯 [PureDoc Paged Click / Cursor Placement Diagnostic]:', clickDiag);
  };

  const getMarginClass = () => {
    switch (pageMargin) {
      case 'narrow':
        return 'px-8 sm:px-10 pt-[40px] pb-[40px]';
      case 'wide':
        return 'px-16 sm:px-24 pt-[72px] pb-[72px]';
      default:
        return 'px-12 sm:px-16 pt-[56px] pb-[56px]';
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#f8fafc] dark:bg-neutral-950 select-none">
      {/* Workbench Toolbar with Rich Formatting Controls and Quick Save on the far right */}
      {editor && (
        <div className="border-b border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 relative z-50 overflow-visible flex items-center justify-between">
          <div className="flex-1 overflow-visible min-w-0">
            <DocFormatControls editor={editor} onShowToast={onShowToast} />
          </div>
          <div className="flex items-center px-3 py-1.5 shrink-0 select-none">
            {onToggleInspector && (
              <button
                id="doc-workbench-inspector-btn"
                type="button"
                onClick={onToggleInspector}
                title="检查器面板 (Cmd+Alt+I)"
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors mr-2.5 cursor-pointer ${
                  isInspectorOpen
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold ring-1 ring-blue-500/30'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700/60'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>检查器</span>
              </button>
            )}
            <div className="h-4 w-[1px] bg-slate-200 dark:bg-neutral-700 mr-2.5" />
            <button
              id="doc-quick-save-btn"
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
              title="保存文档 (Ctrl/Cmd + S)"
            >
              {saveStatus === 'saving' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>保存</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Document Canvas Viewport */}
      <div
        ref={scrollContainerRef}
        onClick={handleViewportClick}
        className="flex-1 overflow-auto p-4 sm:p-8 flex justify-center items-start bg-[#f1f5f9] dark:bg-neutral-950 relative"
      >
        <div
          style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
          className="transition-transform duration-150 ease-out my-2 flex flex-col items-center"
        >
          {viewMode === 'paged' ? (
            /* Paged Mode: Word / WPS A4 Discrete Physical Sheet Presentation with Live Interactive Editor */
            <div
              id="doc-paged-viewport"
              className="relative flex flex-col items-center pb-16"
              style={{
                minHeight: `${pageCount * computedGeometry.pageStridePx - computedGeometry.pageGapPx}px`,
                width: `${computedGeometry.pageWidthPx}px`,
              }}
            >
              {/* Visual Page Shells: Background, Headers, Footers, Page Numbers, Drop Shadows */}
              <div
                className="flex flex-col items-center select-none z-0 w-full"
                style={{ gap: `${computedGeometry.pageGapPx}px` }}
              >
                {Array.from({ length: Math.max(1, pageCount) }).map((_, pIdx) => {
                  const pageNum = pIdx + 1;
                  return (
                    <div
                      key={`doc-page-container-${pageNum}`}
                      id={`doc-page-container-${pageNum}`}
                      style={{
                        width: `${computedGeometry.pageWidthPx}px`,
                        height: `${computedGeometry.pageHeightPx}px`,
                        minHeight: `${computedGeometry.pageHeightPx}px`,
                        maxHeight: `${computedGeometry.pageHeightPx}px`,
                      }}
                      className="bg-white dark:bg-[#131b2e] text-slate-800 dark:text-slate-100 rounded-sm shadow-xl dark:shadow-2xl border border-slate-200/80 dark:border-slate-800/80 relative overflow-hidden shrink-0 pointer-events-none"
                    >
                      {/* Page Top Header - Absolute floating inside top margin band */}
                      <div
                        style={{
                          position: 'absolute',
                          top: '28px',
                          left: `${computedGeometry.marginLeftPx}px`,
                          right: `${computedGeometry.marginRightPx}px`,
                          height: '24px',
                          pointerEvents: 'none',
                        }}
                        className="docx-page-header doc-page-header flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800/50 select-none"
                      >
                        <span className="truncate max-w-[280px] font-medium">{docTitle}</span>
                        <span className="font-mono text-slate-400">标准页面排版 • 第 {pageNum} / {pageCount} 页</span>
                      </div>

                      {/* Page Bottom Footer - Absolute floating inside bottom margin band */}
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '28px',
                          left: `${computedGeometry.marginLeftPx}px`,
                          right: `${computedGeometry.marginRightPx}px`,
                          height: '24px',
                          pointerEvents: 'none',
                        }}
                        className="docx-page-footer doc-page-footer flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800/50 select-none"
                      >
                        <span className="font-medium">Mianay 文档 • 页面排版 ({computedGeometry.pageWidthPx}px × {computedGeometry.pageHeightPx}px)</span>
                        <span className="font-mono font-medium">第 {pageNum} 页 / 共 {pageCount} 页</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* The Live Interactive ProseMirror Editor directly interactive over the pages */}
              <div
                ref={editorWrapperRef}
                id="doc-paged-editor-wrapper"
                style={{
                  width: `${computedGeometry.pageWidthPx}px`,
                  ['--doc-margin-top' as any]: `${computedGeometry.marginTopPx}px`,
                }}
                className="absolute top-0 left-0 h-full pointer-events-none flex flex-col items-center z-10"
              >
                <div
                  className="pointer-events-auto focus-within:outline-none"
                  style={{
                    width: `${computedGeometry.pageWidthPx}px`,
                    minHeight: `${pageCount * computedGeometry.pageStridePx - computedGeometry.pageGapPx}px`,
                    paddingTop: 0,
                    paddingBottom: `${computedGeometry.marginBottomPx}px`,
                    paddingLeft: `${computedGeometry.marginLeftPx}px`,
                    paddingRight: `${computedGeometry.marginRightPx}px`,
                  }}
                >
                  {editor ? (
                    <EditorContent
                      editor={editor}
                      className="max-w-none focus:outline-none min-h-[1000px] text-[14px] leading-[21px]"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-96 text-slate-400">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
                      <p className="text-sm">正在载入文档排版引擎...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Continuous Mode: Uninterrupted Single-Stream Longitudinal Canvas */
            <div
              ref={editorWrapperRef}
              id="doc-continuous-container"
              className="docx-continuous-canvas w-[794px] max-w-full bg-white dark:bg-[#131b2e] text-slate-800 dark:text-slate-100 rounded-sm shadow-md dark:shadow-xl border border-slate-200/80 dark:border-slate-800/80 px-12 sm:px-16 py-10 min-h-[600px] focus-within:ring-2 focus-within:ring-blue-500/20 transition-all mx-auto"
            >
              {editor ? (
                <EditorContent
                  editor={editor}
                  className="max-w-none focus:outline-none min-h-[500px] text-[14px] leading-[21px]"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-96 text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
                  <p className="text-sm">正在载入文档排版引擎...</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* WPS Office Style Bottom Status Bar */}
      <div
        id="docx-bottom-status-bar"
        className="h-8 px-3 sm:px-4 border-t border-slate-200 dark:border-neutral-700 bg-white/95 dark:bg-neutral-800/95 backdrop-blur-md flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 select-none z-30 shrink-0"
      >
        {/* Left: Page Navigator & Word Count & Language */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Page Navigator / Counter */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/90 rounded px-1.5 py-0.5 border border-slate-200/60 dark:border-slate-700/60">
            <button
              id="doc-prev-page-btn"
              onClick={() => scrollToPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="p-0.5 rounded hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-700 dark:text-slate-300"
              title="上一页"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-1 font-mono text-[11px] font-medium text-slate-700 dark:text-slate-200">
              第 {currentPage} / {Math.max(1, pageCount)} 页
            </span>
            <button
              id="doc-next-page-btn"
              onClick={() => scrollToPage(Math.min(pageCount, currentPage + 1))}
              disabled={currentPage >= pageCount}
              className="p-0.5 rounded hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-700 dark:text-slate-300"
              title="下一页"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Word Count Display - Interactive WPS Dialog on Click */}
          <button
            id="doc-word-count-btn"
            onClick={() => setIsWordCountModalOpen(true)}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all cursor-pointer text-slate-600 dark:text-slate-300 group"
            title="点击查看详细字数统计"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span className="text-[11px] font-medium">
              {selectedStatsData ? (
                <>
                  已选 <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">{selectedStatsData.words}</span> / 共 <span className="font-mono">{docStatsData.words}</span> 字
                </>
              ) : (
                <>
                  字数: <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{docStatsData.words}</span>
                </>
              )}
            </span>
          </button>

          {/* Save Status Indicator (replaces "中文(中国)") */}
          <div
            id="doc-bottom-save-status"
            className="flex items-center gap-1.5 text-[11px] px-1.5 py-0.5 rounded select-none text-slate-500 dark:text-slate-400"
            title="文档保存状态"
          >
            {saveStatus === 'saved' ? (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> 已同步
              </span>
            ) : saveStatus === 'saving' ? (
              <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> 保存中...
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> 未保存
              </span>
            )}
          </div>
        </div>

        {/* Right: View Mode Switcher, Divider, Zoom Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* View Mode Switcher (WPS layout: next to zoom) */}
          <div className="flex items-center p-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-slate-600 dark:text-slate-300">
            <button
              id="doc-status-view-paged-btn"
              onClick={() => setViewMode('paged')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition-all cursor-pointer ${
                viewMode === 'paged'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs font-semibold'
                  : 'hover:text-slate-900 dark:hover:text-slate-100'
              }`}
              title="页面视图 (A4 标准页面)"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">页面视图</span>
            </button>
            <button
              id="doc-status-view-continuous-btn"
              onClick={() => setViewMode('continuous')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition-all cursor-pointer ${
                viewMode === 'continuous'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs font-semibold'
                  : 'hover:text-slate-900 dark:hover:text-slate-100'
              }`}
              title="Web版式 / 连续视图"
            >
              <Scroll className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">连续视图</span>
            </button>
          </div>

          {/* Vertical Divider */}
          <div className="h-3.5 w-px bg-slate-200 dark:bg-slate-700"></div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            <button
              id="doc-zoom-out-btn"
              onClick={() => handleZoom(-10)}
              disabled={zoomLevel <= 50}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="缩小 (Ctrl/Cmd -)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <input
              id="doc-zoom-slider"
              type="range"
              min="50"
              max="200"
              step="5"
              value={zoomLevel}
              onChange={(e) => setZoomLevel(Number(e.target.value))}
              className="w-16 sm:w-24 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
              title={`当前缩放: ${zoomLevel}% (Ctrl+滚轮 或 Ctrl +/-)`}
            />

            <button
              id="doc-zoom-in-btn"
              onClick={() => handleZoom(10)}
              disabled={zoomLevel >= 200}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="放大 (Ctrl/Cmd +)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            <button
              id="doc-zoom-percent-btn"
              onClick={() => setZoomLevel(100)}
              className="px-1 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 font-mono text-[11px] font-medium text-slate-700 dark:text-slate-200 min-w-[38px] text-center transition-colors"
              title="点击重置为 100%"
            >
              {zoomLevel}%
            </button>

            <button
              id="doc-zoom-fit-btn"
              onClick={handleFitWidth}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
              title="自适应页面宽度"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* WPS Office Style Word Count Statistics Modal */}
      {isWordCountModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setIsWordCountModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-[#151c2c] rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">字数统计</h3>
              </div>
              <button
                onClick={() => setIsWordCountModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: WPS Statistics Table */}
            <div className="p-4 space-y-2 text-xs">
              {selectedStatsData && (
                <div className="mb-3 px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/60 rounded-lg text-blue-700 dark:text-blue-300 flex items-center justify-between">
                  <span>当前处于选中统计状态</span>
                  <span className="font-medium">已选内容 / 整篇文档</span>
                </div>
              )}

              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                <div className="flex justify-between py-1.5 text-slate-600 dark:text-slate-300">
                  <span>页数</span>
                  <span className="font-mono font-medium text-slate-900 dark:text-slate-100">{pageCount}</span>
                </div>
                <div className="flex justify-between py-1.5 text-slate-600 dark:text-slate-300">
                  <span className="font-medium text-slate-800 dark:text-slate-200">字数 (Word标准)</span>
                  <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                    {selectedStatsData ? `${selectedStatsData.words} / ${docStatsData.words}` : docStatsData.words}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 text-slate-600 dark:text-slate-300">
                  <span>字符数 (计空格)</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">
                    {selectedStatsData ? `${selectedStatsData.characters} / ${docStatsData.characters}` : docStatsData.characters}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 text-slate-600 dark:text-slate-300">
                  <span>字符数 (不计空格)</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">
                    {selectedStatsData ? `${selectedStatsData.charactersNoSpaces} / ${docStatsData.charactersNoSpaces}` : docStatsData.charactersNoSpaces}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 text-slate-600 dark:text-slate-300">
                  <span>中文字符数 (汉字)</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">
                    {selectedStatsData ? `${selectedStatsData.asianChars} / ${docStatsData.asianChars}` : docStatsData.asianChars}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 text-slate-600 dark:text-slate-300">
                  <span>非中文字词数 (英文/数字)</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">
                    {selectedStatsData ? `${selectedStatsData.nonAsianWords} / ${docStatsData.nonAsianWords}` : docStatsData.nonAsianWords}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 text-slate-600 dark:text-slate-300">
                  <span>段落数</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">{docStatsData.paragraphs}</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setIsWordCountModalOpen(false)}
                className="px-3 py-1 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white rounded-md text-xs font-medium transition-colors cursor-pointer"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Engine Status Diagnostic Modal */}
      <EngineStatusModal
        isOpen={isEngineStatusOpen}
        onClose={() => setIsEngineStatusOpen(false)}
        onShowToast={onShowToast}
      />
    </div>
  );
};
