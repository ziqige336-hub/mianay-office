import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Download,
  Image as ImageIcon,
  Check,
  Plus,
  Layers,
  Sparkles,
  FileText,
  FileCode,
  FileSpreadsheet,
  CheckSquare,
  Square,
  Sliders,
  AlertCircle,
  Loader2,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import type { OfficeFile } from '../../types';
import {
  renderDocumentPageToCleanCanvas,
  getOrRenderPdfForDocument,
} from '../../utils/universalExportPipeline';

export interface ExportImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFile: OfficeFile | null;
  allFiles: OfficeFile[];
  onShowToast: (type: 'success' | 'error' | 'info' | 'vip-free', title: string, description?: string) => void;
}

export const ExportImageModal: React.FC<ExportImageModalProps> = ({
  isOpen,
  onClose,
  currentFile,
  allFiles,
  onShowToast,
}) => {
  // Documents to export (starts with current file)
  const [selectedDocuments, setSelectedDocuments] = useState<OfficeFile[]>([]);
  // Checked pages: map from docId -> Set of pageIndices (0-indexed)
  const [checkedPages, setCheckedPages] = useState<Record<string, Set<number>>>({});
  // Page count estimation for each doc
  const [docPageCounts, setDocPageCounts] = useState<Record<string, number>>({});
  // Explicit errors during page inspection (strictly avoid falsifying 1 page)
  const [docPageErrors, setDocPageErrors] = useState<Record<string, string>>({});
  // Loading state for authentic page topology inspection
  const [loadingDocPages, setLoadingDocPages] = useState<Record<string, boolean>>({});

  // Export parameters
  const [exportMode, setExportMode] = useState<'separate' | 'longStrip'>('separate');
  const [format, setFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
  const [resolutionScale, setResolutionScale] = useState<number>(2); // 1 = 1080p, 2 = 2K, 4 = 4K
  const [colorMode, setColorMode] = useState<'color' | 'grayscale' | 'monochrome'>('color');
  const [dpi, setDpi] = useState<number>(96);
  const [fileName, setFileName] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [showAddDocPicker, setShowAddDocPicker] = useState<boolean>(false);

  // Hidden container for rendering HTML docs
  const hiddenRenderContainerRef = useRef<HTMLDivElement>(null);
  // Per-doc request sequence counter to prevent race conditions from outdated async operations
  const inspectionSeqMapRef = useRef<Map<string, number>>(new Map());
  // Modal active mount status to prevent stale state updates after closing
  const isMountedRef = useRef<boolean>(false);

  /**
   * Inspect authentic physical page count using LibreOffice/PDF topology
   * Zero guesswork (strictly authentic pdfJsDoc.numPages, no textLen/1200 or 1-page fallback)
   */
  const inspectPagesForDoc = async (doc: OfficeFile) => {
    const nextSeq = (inspectionSeqMapRef.current.get(doc.id) || 0) + 1;
    inspectionSeqMapRef.current.set(doc.id, nextSeq);

    setLoadingDocPages((prev) => ({ ...prev, [doc.id]: true }));
    setDocPageErrors((prev) => {
      const copy = { ...prev };
      delete copy[doc.id];
      return copy;
    });

    try {
      if (doc.type === 'doc' || (doc.name && (doc.name.endsWith('.docx') || doc.name.endsWith('.doc')))) {
        const { numPages } = await getOrRenderPdfForDocument(doc);
        if (inspectionSeqMapRef.current.get(doc.id) !== nextSeq || !isMountedRef.current) {
          return;
        }
        if (!numPages || numPages <= 0 || isNaN(numPages)) {
          throw new Error('未能从排版引擎解析到有效的页面');
        }
        setDocPageCounts((prev) => ({ ...prev, [doc.id]: numPages }));
        setCheckedPages((prev) => {
          const existingSet = prev[doc.id];
          const newSet = new Set<number>();
          if (existingSet && existingSet.size > 0) {
            for (const idx of existingSet) {
              if (idx >= 0 && idx < numPages) newSet.add(idx);
            }
            if (newSet.size === 0) {
              for (let i = 0; i < numPages; i++) newSet.add(i);
            }
          } else {
            for (let i = 0; i < numPages; i++) newSet.add(i);
          }
          return { ...prev, [doc.id]: newSet };
        });
      } else if (doc.type === 'pdf' || (doc.name && doc.name.endsWith('.pdf'))) {
        const { numPages } = await getOrRenderPdfForDocument(doc);
        if (inspectionSeqMapRef.current.get(doc.id) !== nextSeq || !isMountedRef.current) {
          return;
        }
        if (!numPages || numPages <= 0 || isNaN(numPages)) {
          throw new Error('未能从 PDF 文件解析到有效页面');
        }
        setDocPageCounts((prev) => ({ ...prev, [doc.id]: numPages }));
        setCheckedPages((prev) => {
          const existingSet = prev[doc.id];
          const newSet = new Set<number>();
          if (existingSet && existingSet.size > 0) {
            for (const idx of existingSet) {
              if (idx >= 0 && idx < numPages) newSet.add(idx);
            }
            if (newSet.size === 0) {
              for (let i = 0; i < numPages; i++) newSet.add(i);
            }
          } else {
            for (let i = 0; i < numPages; i++) newSet.add(i);
          }
          return { ...prev, [doc.id]: newSet };
        });
      } else {
        if (inspectionSeqMapRef.current.get(doc.id) !== nextSeq || !isMountedRef.current) {
          return;
        }
        setDocPageCounts((prev) => ({ ...prev, [doc.id]: 1 }));
        setCheckedPages((prev) => ({ ...prev, [doc.id]: new Set([0]) }));
      }
    } catch (err: any) {
      if (inspectionSeqMapRef.current.get(doc.id) !== nextSeq || !isMountedRef.current) {
        return;
      }
      console.warn('Failed to inspect document pages:', err);
      // Strictly avoid fabricating 1 page on failure; set explicit error state
      setDocPageErrors((prev) => ({ ...prev, [doc.id]: err?.message || '页面识别失败，请重试' }));
      setDocPageCounts((prev) => {
        const copy = { ...prev };
        delete copy[doc.id];
        return copy;
      });
      setCheckedPages((prev) => {
        const copy = { ...prev };
        delete copy[doc.id];
        return copy;
      });
    } finally {
      if (inspectionSeqMapRef.current.get(doc.id) === nextSeq && isMountedRef.current) {
        setLoadingDocPages((prev) => ({ ...prev, [doc.id]: false }));
      }
    }
  };

  // Lifecycle control: clean state on open/close and trigger fresh inspection
  useEffect(() => {
    isMountedRef.current = isOpen;
    if (isOpen && currentFile) {
      inspectionSeqMapRef.current.clear();
      setSelectedDocuments([currentFile]);
      setFileName(currentFile.name.replace(/\.[^/.]+$/, ''));
      setDocPageCounts({});
      setCheckedPages({});
      setDocPageErrors({});
      inspectPagesForDoc(currentFile);
    } else if (!isOpen) {
      inspectionSeqMapRef.current.clear();
    }
    return () => {
      isMountedRef.current = false;
    };
  }, [isOpen, currentFile]);

  if (!isOpen) return null;

  const togglePage = (docId: string, pageIdx: number) => {
    const total = docPageCounts[docId] || 0;
    if (pageIdx < 0 || pageIdx >= total) return;

    setCheckedPages((prev) => {
      const currentSet = new Set(prev[docId] || []);
      if (currentSet.has(pageIdx)) {
        currentSet.delete(pageIdx);
      } else {
        currentSet.add(pageIdx);
      }
      return { ...prev, [docId]: currentSet };
    });
  };

  const toggleAllPagesForDoc = (docId: string) => {
    const total = docPageCounts[docId] || 0;
    if (total === 0) return;
    const currentSet = checkedPages[docId] || new Set();
    const isAllChecked = currentSet.size === total;

    setCheckedPages((prev) => {
      const newSet = new Set<number>();
      if (!isAllChecked) {
        for (let i = 0; i < total; i++) newSet.add(i);
      }
      return { ...prev, [docId]: newSet };
    });
  };

  const handleAddDocument = (file: OfficeFile) => {
    if (selectedDocuments.some((d) => d.id === file.id)) return;
    if (file.type === 'sheet') {
      onShowToast('info', '表格暂不支持作为图片导出');
      return;
    }

    const updated = [...selectedDocuments, file];
    setSelectedDocuments(updated);
    inspectPagesForDoc(file);
    setShowAddDocPicker(false);
    onShowToast('success', '已添加到导出队列', file.name);
  };

  const handleRemoveDoc = (docId: string) => {
    if (selectedDocuments.length <= 1) {
      onShowToast('info', '队列中至少保留一个文档');
      return;
    }
    setSelectedDocuments((prev) => prev.filter((d) => d.id !== docId));
  };

  // Total pages selected across all docs
  const totalSelectedPagesCount = selectedDocuments.reduce((acc, doc) => {
    return acc + (checkedPages[doc.id]?.size || 0);
  }, 0);

  // Apply color filter to Canvas
  const applyColorFilter = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (colorMode === 'grayscale') {
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        data[i] = avg;
        data[i + 1] = avg;
        data[i + 2] = avg;
      }
      ctx.putImageData(imgData, 0, 0);
    } else if (colorMode === 'monochrome') {
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const val = avg > 140 ? 255 : 0;
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
      }
      ctx.putImageData(imgData, 0, 0);
    }
  };

  // Render a specific document page onto a canvas (100% clean, zero pollution)
  const renderDocPageToCanvas = async (doc: OfficeFile, pageIdx: number): Promise<HTMLCanvasElement> => {
    const effectiveDpi = Math.round(dpi * (resolutionScale / 2));
    return await renderDocumentPageToCleanCanvas(doc, pageIdx, effectiveDpi, colorMode);
  };

  // Execute Real Image Export
  const handleStartExport = async () => {
    if (totalSelectedPagesCount === 0) {
      onShowToast('error', '请至少勾选一页需要输出的页面');
      return;
    }

    setIsExporting(true);
    setExportProgress(10);

    try {
      const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
      const ext = format === 'jpeg' ? 'jpg' : format;
      const baseOutName = fileName.trim() || 'Lumina_Export';

      const renderedCanvases: { name: string; canvas: HTMLCanvasElement }[] = [];

      let currentStep = 0;
      for (const doc of selectedDocuments) {
        const pagesSet = checkedPages[doc.id] || new Set();
        const pagesList = Array.from(pagesSet).sort((a, b) => a - b);

        for (const pageIdx of pagesList) {
          const cvs = await renderDocPageToCanvas(doc, pageIdx);
          const pageName = `${doc.name.replace(/\.[^/.]+$/, '')}_第${pageIdx + 1}页.${ext}`;
          renderedCanvases.push({ name: pageName, canvas: cvs });

          currentStep++;
          setExportProgress(10 + Math.round((currentStep / totalSelectedPagesCount) * 70));
        }
      }

      if (exportMode === 'longStrip') {
        // Stitch all canvases vertically into a single long strip
        setExportProgress(85);
        const totalHeight = renderedCanvases.reduce((h, item) => h + item.canvas.height, 0);
        const maxWidth = Math.max(...renderedCanvases.map((item) => item.canvas.width));

        // Safety limit check: Browsers typically cap canvas height at ~32,767 px.
        const MAX_CANVAS_HEIGHT = 30000;
        if (totalHeight > MAX_CANVAS_HEIGHT) {
          onShowToast(
            'error',
            '长图尺寸超限',
            `当前分辨率下合并长图总高度为 ${totalHeight}px，超过浏览器安全上限 (${MAX_CANVAS_HEIGHT}px)。请降低 DPI 或改用“逐页输出”模式。`
          );
          setIsExporting(false);
          return;
        }

        const longCanvas = document.createElement('canvas');
        longCanvas.width = maxWidth;
        longCanvas.height = totalHeight;
        const longCtx = longCanvas.getContext('2d')!;
        longCtx.fillStyle = '#ffffff';
        longCtx.fillRect(0, 0, maxWidth, totalHeight);

        let currentY = 0;
        for (const item of renderedCanvases) {
          longCtx.drawImage(item.canvas, 0, currentY);
          currentY += item.canvas.height;
        }

        const dataUrl = longCanvas.toDataURL(mimeType, 0.95);
        const link = document.createElement('a');
        link.download = `${baseOutName}_长图合并.${ext}`;
        link.href = dataUrl;
        link.click();

        setExportProgress(100);
        onShowToast('vip-free', '已成功输出高清长图！', `共合成 ${renderedCanvases.length} 页 • ${dpi} DPI`);
      } else {
        // Separate images
        if (renderedCanvases.length === 1) {
          // Single image direct download
          const item = renderedCanvases[0];
          const dataUrl = item.canvas.toDataURL(mimeType, 0.95);
          const link = document.createElement('a');
          link.download = `${baseOutName}.${ext}`;
          link.href = dataUrl;
          link.click();
          onShowToast('success', '已成功输出单页图片', `${baseOutName}.${ext}`);
        } else {
          // Multiple images -> Zip package
          setExportProgress(85);
          const zip = new JSZip();
          for (let i = 0; i < renderedCanvases.length; i++) {
            const item = renderedCanvases[i];
            const dataUrl = item.canvas.toDataURL(mimeType, 0.95);
            const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
            zip.file(item.name, base64Data, { base64: true });
          }

          const content = await zip.generateAsync({ type: 'blob' });
          const url = URL.createObjectURL(content);
          const link = document.createElement('a');
          link.download = `${baseOutName}_图片包(${renderedCanvases.length}页).zip`;
          link.href = url;
          link.click();
          URL.revokeObjectURL(url);

          setExportProgress(100);
          onShowToast('vip-free', '已成功打包输出全部图片 (ZIP)！', `共 ${renderedCanvases.length} 页高清图像`);
        }
      }

      setTimeout(() => {
        setIsExporting(false);
        onClose();
      }, 500);
    } catch (err) {
      console.error(err);
      setIsExporting(false);
      onShowToast('error', '输出图片失败', '生成图像数据流时发生异常');
    }
  };

  const getDpiLabel = (d: number) => {
    switch (d) {
      case 72:
        return '72 DPI (网页预览)';
      case 96:
        return '96 DPI (普通办公 - 默认)';
      case 150:
        return '150 DPI (高清文档)';
      case 300:
        return '300 DPI (打印出版)';
      case 600:
        return '600 DPI (专业印刷)';
      default:
        return `${d} DPI`;
    }
  };

  return (
    <div
      id="export-image-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150"
    >
      <div
        id="export-image-modal-container"
        className="w-full max-w-4xl bg-white dark:bg-[#1c1c1e] rounded-2xl shadow-2xl border border-neutral-200/80 dark:border-neutral-700/80 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="h-14 px-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-850/50 select-none">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-900 dark:text-white">
                输出为图片 (Export as Images)
              </h2>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                支持逐页高精度渲染、长图合并、DPI 定制与多文档批量合成
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Left Thumbnails + Right Parameter Form */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left: Page Thumbnails & Multi-doc List */}
          <div className="w-full md:w-5/12 border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-900/40 flex flex-col p-4 overflow-y-auto select-none space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                待输出页面 ({totalSelectedPagesCount} 页已选)
              </span>
              <span className="text-[10px] text-neutral-400">
                {selectedDocuments.length} 个文档
              </span>
            </div>

            {/* Document Pages List */}
            <div className="space-y-4 flex-1">
              {selectedDocuments.map((doc) => {
                const totalPages = docPageCounts[doc.id] || 0;
                const checkedSet = checkedPages[doc.id] || new Set();
                const isAllChecked = totalPages > 0 && checkedSet.size === totalPages;
                const hasError = !!docPageErrors[doc.id];
                const isLoading = !!loadingDocPages[doc.id];

                return (
                  <div
                    key={doc.id}
                    className="p-3 bg-white dark:bg-neutral-800/90 rounded-xl border border-neutral-200/80 dark:border-neutral-700/70 space-y-2.5 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 truncate">
                        {doc.type === 'doc' ? (
                          <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                        ) : (
                          <FileCode className="w-4 h-4 text-rose-500 shrink-0" />
                        )}
                        <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                          {doc.name}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        {totalPages > 0 && !hasError && !isLoading && (
                          <button
                            onClick={() => toggleAllPagesForDoc(doc.id)}
                            className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {isAllChecked ? '取消全选' : '全选'}
                          </button>
                        )}
                        {selectedDocuments.length > 1 && (
                          <button
                            onClick={() => handleRemoveDoc(doc.id)}
                            className="text-neutral-400 hover:text-rose-500 p-0.5"
                            title="移除此文档"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Page Grid or Status of this Doc */}
                    {isLoading ? (
                      <div className="py-6 flex flex-col items-center justify-center space-y-2 text-neutral-400">
                        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                        <span className="text-[11px]">正在解析文档真实排版与分页...</span>
                      </div>
                    ) : hasError ? (
                      <div className="py-5 px-3 flex flex-col items-center justify-center space-y-2 text-rose-500 bg-rose-50/50 dark:bg-rose-950/20 rounded-lg border border-rose-200/60 dark:border-rose-900/40">
                        <AlertCircle className="w-5 h-5 text-rose-500" />
                        <span className="text-[11px] font-medium text-center">{docPageErrors[doc.id]}</span>
                        <button
                          onClick={() => inspectPagesForDoc(doc)}
                          className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center space-x-1 mt-1 font-semibold"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>重新识别页面</span>
                        </button>
                      </div>
                    ) : totalPages === 0 ? (
                      <div className="py-6 flex flex-col items-center justify-center space-y-2 text-neutral-400">
                        <span className="text-[11px]">未识别到可用页面</span>
                        <button
                          onClick={() => inspectPagesForDoc(doc)}
                          className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center space-x-1"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>重新识别</span>
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {Array.from({ length: totalPages }).map((_, pIdx) => {
                          const isChecked = checkedSet.has(pIdx);
                          return (
                            <div
                              key={pIdx}
                              onClick={() => togglePage(doc.id, pIdx)}
                              className={`relative group cursor-pointer aspect-3/4 rounded-lg border flex flex-col justify-between p-2 transition-all ${
                                isChecked
                                  ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-950/20 ring-1 ring-blue-500'
                                  : 'border-neutral-200 dark:border-neutral-700 bg-neutral-100/50 dark:bg-neutral-850 opacity-60'
                              }`}
                            >
                              {/* Checkbox badge */}
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-mono font-bold text-neutral-500">
                                  P{pIdx + 1}
                                </span>
                                {isChecked ? (
                                  <CheckSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                ) : (
                                  <Square className="w-3.5 h-3.5 text-neutral-400" />
                                )}
                              </div>

                              {/* Simulated miniature lines */}
                              <div className="space-y-1 py-1">
                                <div className="h-1 bg-neutral-300 dark:bg-neutral-600 rounded-full w-4/5" />
                                <div className="h-1 bg-neutral-200 dark:bg-neutral-700 rounded-full w-full" />
                                <div className="h-1 bg-neutral-200 dark:bg-neutral-700 rounded-full w-3/4" />
                              </div>

                              <span className="text-[8px] text-center text-neutral-400">
                                第 {pIdx + 1} 页
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom Add Document Button */}
            <div className="pt-2">
              <button
                onClick={() => setShowAddDocPicker(true)}
                className="w-full flex items-center justify-center space-x-1.5 py-2 rounded-xl border border-dashed border-blue-400 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 text-xs font-semibold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>添加其他文档合并输出</span>
              </button>
            </div>
          </div>

          {/* Right: Output Parameter Options */}
          <div className="flex-1 p-6 overflow-y-auto space-y-5 select-none bg-white dark:bg-[#1c1c1e]">
            {/* 1. Export Mode */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                导出模式 (Export Mode)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setExportMode('separate')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    exportMode === 'separate'
                      ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500 font-semibold'
                      : 'border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  <div className="text-xs font-bold">逐页输出 (Separate)</div>
                  <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                    每页导出为单独图片文件，多页自动打包 ZIP
                  </div>
                </button>

                <button
                  onClick={() => setExportMode('longStrip')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    exportMode === 'longStrip'
                      ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500 font-semibold'
                      : 'border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  <div className="text-xs font-bold">合成长图 (Long Strip)</div>
                  <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                    所有选定页面纵向拼接为一张高清长图
                  </div>
                </button>
              </div>
            </div>

            {/* 2. Format & Resolution Grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* Output Format */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                  输出格式 (Format)
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['png', 'jpeg', 'webp'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setFormat(fmt)}
                      className={`py-1.5 rounded-lg border text-xs font-medium uppercase transition-colors ${
                        format === fmt
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold'
                          : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Output Scale / Resolution */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                  输出尺寸 (Resolution)
                </label>
                <select
                  value={resolutionScale}
                  onChange={(e) => setResolutionScale(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value={1}>标准尺寸 1080P (1x)</option>
                  <option value={2}>高清画质 2K (2x) - 推荐</option>
                  <option value={4}>超清画质 4K (4x) - 极致细腻</option>
                </select>
              </div>
            </div>

            {/* 3. Output DPI (WPS Office Standard) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                <span>输出 DPI (Resolution DPI)</span>
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-normal">
                  {getDpiLabel(dpi)}
                </span>
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {[72, 96, 150, 300, 600].map((val) => (
                  <button
                    key={val}
                    onClick={() => setDpi(val)}
                    className={`py-1.5 rounded-lg border text-xs transition-colors flex flex-col items-center justify-center ${
                      dpi === val
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold'
                        : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <span className="font-mono text-xs">{val}</span>
                    <span className="text-[8px] text-neutral-400">
                      {val === 72 ? '预览' : val === 96 ? '办公' : val === 150 ? '高清' : val === 300 ? '打印' : '印刷'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Output Color Mode */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                输出色彩 (Color Mode)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'color', label: '彩色 (RGB)', desc: '保留全部原文档颜色' },
                  { id: 'grayscale', label: '灰度 (Grayscale)', desc: '高质感 256 阶灰度' },
                  { id: 'monochrome', label: '黑白 (B&W)', desc: '高对比度纯黑白二值' },
                ].map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setColorMode(c.id as any)}
                    className={`p-2.5 rounded-xl border text-left transition-colors ${
                      colorMode === c.id
                        ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500'
                        : 'border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <div className="text-xs font-bold">{c.label}</div>
                    <div className="text-[9px] text-neutral-400 mt-0.5">{c.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 5. File Name & Directory info */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                输出文件名
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="输出文件名称"
                  className="flex-1 px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                />
                <span className="text-xs text-neutral-400 font-mono">
                  .{format}
                </span>
              </div>
              <p className="text-[10px] text-neutral-400">
                默认输出至：浏览器默认下载文件夹 (Downloads)
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="h-16 px-6 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-850/50 select-none">
          <div className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center space-x-2">
            <span>预计输出：</span>
            <span className="font-semibold text-neutral-800 dark:text-neutral-200">
              {exportMode === 'longStrip' ? '1 张长图' : `${totalSelectedPagesCount} 张图片`}
            </span>
            <span>•</span>
            <span className="font-mono">{dpi} DPI</span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-750 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleStartExport}
              disabled={isExporting || totalSelectedPagesCount === 0}
              className="flex items-center space-x-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-all active:scale-[0.98]"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>渲染生成中 ({exportProgress}%)...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>开始输出图片</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Doc Picker Modal Popup */}
      {showAddDocPicker && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white dark:bg-neutral-850 rounded-2xl p-5 shadow-2xl border border-neutral-200 dark:border-neutral-700 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-neutral-900 dark:text-white">
                选择要加入批量导出的文档
              </h3>
              <button
                onClick={() => setShowAddDocPicker(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {allFiles
                .filter((f) => !f.isTrash && f.type !== 'sheet' && !selectedDocuments.some((sd) => sd.id === f.id))
                .map((file) => (
                  <div
                    key={file.id}
                    onClick={() => handleAddDocument(file)}
                    className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 cursor-pointer flex items-center justify-between transition-all"
                  >
                    <div className="flex items-center space-x-2 truncate">
                      {file.type === 'doc' ? (
                        <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                      ) : (
                        <FileCode className="w-4 h-4 text-rose-500 shrink-0" />
                      )}
                      <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate">
                        {file.name}
                      </span>
                    </div>
                    <Plus className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  </div>
                ))}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowAddDocPicker(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 text-neutral-700 dark:text-neutral-300"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
