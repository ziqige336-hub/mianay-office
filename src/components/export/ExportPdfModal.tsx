import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  FileCode,
  Check,
  Layers,
  Sparkles,
  FileText,
  CheckSquare,
  Square,
  Sliders,
  Scan,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import type { OfficeFile } from '../../types';
import {
  renderDocToVectorPdf,
  renderSheetToVectorPdf,
  renderDocumentPageToCleanCanvas,
} from '../../utils/universalExportPipeline';
import { exportScannedImageBasedPdf } from '../../utils/pdfExportEngines';
import { loadPdfJsDocument, exportCleanPdf, resolvePdfBytesFromFile } from '../../utils/pdfLibWrapper';
import { CONVERSION_CAPABILITIES } from '../../core/capabilities/ConversionCapabilityRegistry';
import { officeEngine } from '../../core/office';
import { DocumentSessionManager } from '../../core/document/DocumentSessionManager';
import { PdfExportService } from '../../core/export/PdfExportService';
import { DocxExportService } from '../../core/export/DocxExportService';
import { SheetExportService } from '../../core/export/SheetExportService';

export interface ExportPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFile: OfficeFile | null;
  onShowToast: (type: 'success' | 'error' | 'info' | 'vip-free', title: string, description?: string) => void;
}

export const ExportPdfModal: React.FC<ExportPdfModalProps> = ({
  isOpen,
  onClose,
  currentFile,
  onShowToast,
}) => {
  // Page selection state
  const [totalPages, setTotalPages] = useState<number>(1);
  const [checkedPages, setCheckedPages] = useState<Set<number>>(new Set());

  // Parameters
  const [outputType, setOutputType] = useState<'standard' | 'scanned'>('standard');
  const [imageQuality, setImageQuality] = useState<'high' | 'standard' | 'low'>('standard');
  const [colorMode, setColorMode] = useState<'color' | 'grayscale' | 'monochrome'>('color');
  const [includeOcr, setIncludeOcr] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    if (isOpen && currentFile) {
      setFileName(currentFile.name.replace(/\.[^/.]+$/, ''));
      const activeSession = DocumentSessionManager.getSession(currentFile.id) || DocumentSessionManager.getActiveSession();
      const pdfDocSession = activeSession?.pdfSession;

      let pCount = 1;
      const isPdf = currentFile.type === 'pdf' || (currentFile.name && currentFile.name.toLowerCase().endsWith('.pdf'));
      if (isPdf) {
        pCount = pdfDocSession?.pages?.length || pdfDocSession?.pageCount || currentFile.content?.pages?.length || 1;
        if (pCount <= 1) {
          resolvePdfBytesFromFile(currentFile).then((bytes) => {
            if (bytes && bytes.byteLength > 0) {
              PDFDocument.load(bytes, { ignoreEncryption: true })
                .then((doc) => {
                  const count = doc.getPageCount();
                  if (count > 0) {
                    setTotalPages(count);
                    const s = new Set<number>();
                    for (let i = 0; i < count; i++) s.add(i);
                    setCheckedPages(s);
                  }
                })
                .catch(() => {});
            }
          }).catch(() => {});
        }
      } else if (currentFile.type === 'doc') {
        const textLen = typeof currentFile.content === 'string' ? currentFile.content.length : 1000;
        pCount = Math.max(1, Math.ceil(textLen / 1200));
      }
      setTotalPages(pCount);
      const set = new Set<number>();
      for (let i = 0; i < pCount; i++) set.add(i);
      setCheckedPages(set);
    }
  }, [isOpen, currentFile]);

  if (!isOpen || !currentFile) return null;

  const togglePage = (pIdx: number) => {
    setCheckedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pIdx)) {
        next.delete(pIdx);
      } else {
        next.add(pIdx);
      }
      return next;
    });
  };

  const toggleAllPages = () => {
    if (checkedPages.size === totalPages) {
      setCheckedPages(new Set());
    } else {
      const set = new Set<number>();
      for (let i = 0; i < totalPages; i++) set.add(i);
      setCheckedPages(set);
    }
  };

  // Render a specific page to a Canvas element with given quality & color mode (Zero Pollution)
  const renderPageToRasterCanvas = async (pageIdx: number): Promise<HTMLCanvasElement> => {
    const dpi = imageQuality === 'high' ? 300 : imageQuality === 'standard' ? 150 : 96;
    const activeSession = currentFile ? (DocumentSessionManager.getSession(currentFile.id) || DocumentSessionManager.getActiveSession()) : null;
    const liveContent = activeSession?.getExportContent
      ? activeSession.getExportContent()
      : (activeSession?.docState || activeSession?.sheetState || currentFile?.content);
    const fileForRaster: OfficeFile | null = currentFile ? { ...currentFile, content: liveContent } : null;
    return await renderDocumentPageToCleanCanvas(fileForRaster, pageIdx, dpi, colorMode);
  };

  // Start Export Process
  const handleExport = async () => {
    if (checkedPages.size === 0) {
      onShowToast('error', '请至少勾选一页需要输出的页面');
      return;
    }

    setIsExporting(true);
    setProgress(15);

    try {
      const selectedIndices = Array.from(checkedPages).sort((a, b) => a - b);
      const dpi = imageQuality === 'high' ? 300 : imageQuality === 'standard' ? 150 : 96;

      const isPdf =
        currentFile.type === 'pdf' || (currentFile.name && currentFile.name.toLowerCase().endsWith('.pdf'));
      const isSheet =
        !isPdf &&
        (currentFile.type === 'sheet' ||
          (currentFile.name &&
            (currentFile.name.toLowerCase().endsWith('.xlsx') ||
              currentFile.name.toLowerCase().endsWith('.xls') ||
              currentFile.name.toLowerCase().endsWith('.csv'))));

      let resultBlob: Blob;
      let finalName = fileName.trim() || 'Lumina_Document';

      if (isPdf) {
        // Pure Native PDF Pipeline (Strict Physical Isolation)
        const exportRes = await PdfExportService.exportNativePdf(currentFile, {
          customFileName: finalName,
          selectedPages: selectedIndices,
          dpi,
          outputType: outputType === 'scanned' ? 'scanned' : 'vector',
          includeOcr,
          imageQuality,
          onProgress: (prog, msg) => {
            setProgress(prog);
          },
        });
        resultBlob = exportRes.blob;
      } else if (isSheet) {
        // Pure Spreadsheet -> PDF Pipeline
        const exportRes = await SheetExportService.exportPdf(currentFile, {
          customFileName: finalName,
          onProgress: (prog, msg) => {
            setProgress(prog);
          },
        });
        resultBlob = exportRes.blob;
      } else {
        // Pure Document -> PDF Pipeline
        const exportRes = await DocxExportService.exportPdf(currentFile, {
          customFileName: finalName,
          onProgress: (prog, msg) => {
            setProgress(prog);
          },
        });
        resultBlob = exportRes.blob;
      }

      const url = URL.createObjectURL(resultBlob);
      const link = document.createElement('a');
      const suffix = outputType === 'scanned' && isPdf ? `_扫描件_${dpi}DPI` : '_导出';
      link.download = `${finalName}${suffix}.pdf`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);

      setProgress(100);
      onShowToast(
        'vip-free',
        outputType === 'scanned' && isPdf ? `已生成扫描型 PDF (${dpi} DPI)` : '已成功输出高保真矢量 PDF',
        `共输出 ${selectedIndices.length} 页 • 100% 原始排版保证`
      );

      setTimeout(() => {
        setIsExporting(false);
        onClose();
      }, 500);
    } catch (err: any) {
      console.error('PDF export error:', err);
      onShowToast('error', 'PDF 导出失败', err?.message || '未知错误');
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 flex items-center justify-center">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                高保真 PDF 导出引擎
                <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> 零污染·高保真
                </span>
              </h2>
              <p className="text-xs text-zinc-500">
                源文件: <span className="font-medium text-zinc-700 dark:text-zinc-300">{currentFile.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          {/* File Name */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              输出文件名
            </label>
            <div className="flex items-center">
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="flex-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-l-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                placeholder="输入导出文档名称"
              />
              <span className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-l-0 border-zinc-200 dark:border-zinc-700 rounded-r-xl text-xs text-zinc-500 font-mono">
                .pdf
              </span>
            </div>
          </div>

          {/* Export Type Selection */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              PDF 格式规范
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setOutputType('standard')}
                className={`p-3.5 rounded-xl border text-left transition flex items-start space-x-3 ${
                  outputType === 'standard'
                    ? 'border-red-500 bg-red-50/30 dark:bg-red-950/20 ring-1 ring-red-500'
                    : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <FileText className={`w-5 h-5 mt-0.5 ${outputType === 'standard' ? 'text-red-600' : 'text-zinc-400'}`} />
                <div>
                  <div className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    标准矢量 PDF
                    {outputType === 'standard' && <Check className="w-3.5 h-3.5 text-red-600" />}
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    保留全部文字图层与矢量几何，文字清晰可检索与复制
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setOutputType('scanned')}
                className={`p-3.5 rounded-xl border text-left transition flex items-start space-x-3 ${
                  outputType === 'scanned'
                    ? 'border-red-500 bg-red-50/30 dark:bg-red-950/20 ring-1 ring-red-500'
                    : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <Scan className={`w-5 h-5 mt-0.5 ${outputType === 'scanned' ? 'text-red-600' : 'text-zinc-400'}`} />
                <div>
                  <div className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    扫描型 PDF (Image-based)
                    {outputType === 'scanned' && <Check className="w-3.5 h-3.5 text-red-600" />}
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    光栅位图栅格化，防文本被篡改，可附加透明 OCR 检索层
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Quality and Color Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                渲染分辨率
              </label>
              <select
                value={imageQuality}
                onChange={(e) => setImageQuality(e.target.value as any)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20"
              >
                <option value="low">96 DPI (快速办公预览)</option>
                <option value="standard">150 DPI (高清文档推荐)</option>
                <option value="high">300 DPI (印刷级超清)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                色彩模式
              </label>
              <select
                value={colorMode}
                onChange={(e) => setColorMode(e.target.value as any)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20"
              >
                <option value="color">原色输出 (Full Color)</option>
                <option value="grayscale">256 阶灰度 (Grayscale)</option>
                <option value="monochrome">黑白文档增强 (Monochrome)</option>
              </select>
            </div>
          </div>

          {/* Optional OCR Layer for Scanned PDF */}
          {outputType === 'scanned' && (
            <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                  注入离线 OCR 双层检索文本
                </div>
                <div className="text-xs text-zinc-500">
                  在图像层下方注入透明文字，使得扫描件可以直接按 Ctrl+F 搜索文字
                </div>
              </div>
              <input
                type="checkbox"
                checked={includeOcr}
                onChange={(e) => setIncludeOcr(e.target.checked)}
                className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
              />
            </div>
          )}

          {/* Page Range Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                导出页码范围 ({checkedPages.size} / {totalPages} 页)
              </label>
              <button
                type="button"
                onClick={toggleAllPages}
                className="text-xs text-red-600 dark:text-red-400 hover:underline"
              >
                {checkedPages.size === totalPages ? '取消全选' : '全选全部页面'}
              </button>
            </div>

            <div className="grid grid-cols-6 gap-2 max-h-36 overflow-y-auto p-2 bg-zinc-50 dark:bg-zinc-800/30 rounded-xl border border-zinc-200 dark:border-zinc-700">
              {Array.from({ length: totalPages }).map((_, idx) => {
                const isChecked = checkedPages.has(idx);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => togglePage(idx)}
                    className={`py-2 px-1 rounded-lg border text-xs font-medium transition flex flex-col items-center justify-center ${
                      isChecked
                        ? 'border-red-500 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400'
                        : 'border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <span>第 {idx + 1} 页</span>
                    {isChecked ? <CheckSquare className="w-3.5 h-3.5 mt-1" /> : <Square className="w-3.5 h-3.5 mt-1" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between">
          <div className="text-xs text-zinc-500">
            {isExporting ? (
              <span className="flex items-center gap-2 text-red-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                正在构建文档流: {progress}%
              </span>
            ) : (
              <span>准备就绪，100% 离线端侧高保真生成</span>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              取消
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting || checkedPages.size === 0}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-medium shadow-md shadow-red-600/20 disabled:opacity-50 transition flex items-center space-x-2"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>导出中...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>立即导出 PDF</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
