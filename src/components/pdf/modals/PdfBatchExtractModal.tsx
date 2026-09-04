import React, { useState } from 'react';
import {
  X,
  FileDown,
  FileText,
  Image as ImageIcon,
  Download,
  Loader2,
  CheckCircle2,
  Sparkles,
  Archive,
  Layers,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import type { PageMeta } from '../../../types';
import { exportPdfHighDpiImages, DPI_SETTINGS } from '../../../utils/pdfExportEngines';

interface PdfBatchExtractModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfJsDoc: pdfjsLib.PDFDocumentProxy | null;
  pages: PageMeta[];
  fileName: string;
  pdfBytes?: Uint8Array | null;
  initialTab?: 'text' | 'images' | 'pages';
  onShowToast?: (title: string, message: string, type?: 'success' | 'info' | 'warning') => void;
}

export const PdfBatchExtractModal: React.FC<PdfBatchExtractModalProps> = ({
  isOpen,
  onClose,
  pdfJsDoc,
  pages,
  fileName,
  pdfBytes,
  initialTab = 'text',
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'text' | 'images' | 'pages'>(initialTab);
  const [textFormat, setTextFormat] = useState<'txt' | 'md' | 'json'>('txt');
  const [includePageHeaders, setIncludePageHeaders] = useState<boolean>(true);
  const [selectedDpi, setSelectedDpi] = useState<number>(150);
  const [imageFormat, setImageFormat] = useState<'png' | 'jpeg'>('png');
  const [pageRange, setPageRange] = useState<string>('all');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>('');

  // Synchronize activeTab whenever initialTab or modal open state changes
  React.useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const baseName = fileName.replace(/\.[^/.]+$/, '');

  // 1. 批量提取文字 (TXT / Markdown / JSON)
  const handleExtractText = async () => {
    if (!pdfJsDoc) return;
    setIsProcessing(true);
    setProgress(0);
    setStatusText('正在解析文档文本流...');

    try {
      let outputContent = '';
      const jsonData: { page: number; text: string }[] = [];

      for (let p = 1; p <= pdfJsDoc.numPages; p++) {
        setProgress(p / pdfJsDoc.numPages);
        setStatusText(`正在提取第 ${p} / ${pdfJsDoc.numPages} 页文本...`);
        const page = await pdfJsDoc.getPage(p);
        const textContent = await page.getTextContent();
        
        // Group text items roughly by lines
        const lines: string[] = [];
        let currentLine = '';
        let lastY: number | null = null;

        for (const item of textContent.items as any[]) {
          if (!('str' in item)) continue;
          const str = item.str;
          if (!str.trim() && !str.includes(' ')) continue;

          const y = item.transform ? Math.round(item.transform[5]) : null;
          if (lastY !== null && y !== null && Math.abs(y - lastY) > 6) {
            if (currentLine.trim()) lines.push(currentLine.trim());
            currentLine = str;
          } else {
            currentLine += (currentLine ? ' ' : '') + str;
          }
          lastY = y;
        }
        if (currentLine.trim()) lines.push(currentLine.trim());
        const pageText = lines.join('\n');

        if (textFormat === 'json') {
          jsonData.push({ page: p, text: pageText });
        } else if (textFormat === 'md') {
          if (includePageHeaders) outputContent += `\n\n## 第 ${p} 页\n\n`;
          outputContent += pageText + '\n';
        } else {
          if (includePageHeaders) outputContent += `\n=== 第 ${p} 页 ===\n\n`;
          outputContent += pageText + '\n\n';
        }
      }

      let blob: Blob;
      let ext = 'txt';
      if (textFormat === 'json') {
        blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json;charset=utf-8' });
        ext = 'json';
      } else if (textFormat === 'md') {
        blob = new Blob([outputContent.trim()], { type: 'text/markdown;charset=utf-8' });
        ext = 'md';
      } else {
        blob = new Blob([outputContent.trim()], { type: 'text/plain;charset=utf-8' });
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseName}_extracted_text.${ext}`;
      a.click();
      URL.revokeObjectURL(url);

      onShowToast?.('批量提取文本成功', `已提取 ${pdfJsDoc.numPages} 页文本并下载`, 'success');
      onClose();
    } catch (err: any) {
      console.error(err);
      onShowToast?.('提取失败', err.message || '提取过程中发生异常', 'warning');
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. 批量提取内嵌图片对象 (原生提取)
  const handleExtractEmbeddedImages = async () => {
    if (!pdfJsDoc) return;
    setIsProcessing(true);
    setProgress(0);
    setStatusText('正在扫描 PDF 内嵌图像对象...');

    try {
      const zip = new JSZip();
      let extractedCount = 0;

      for (let p = 1; p <= pdfJsDoc.numPages; p++) {
        setProgress(p / pdfJsDoc.numPages);
        setStatusText(`正在扫描第 ${p} / ${pdfJsDoc.numPages} 页图像资源...`);
        const page = await pdfJsDoc.getPage(p);
        const operatorList = await page.getOperatorList();
        
        // Scan for paintImageXObject operations
        const imageIndexSet = new Set<string>();
        for (let i = 0; i < operatorList.fnArray.length; i++) {
          const fn = operatorList.fnArray[i];
          if (fn === pdfjsLib.OPS.paintImageXObject || fn === pdfjsLib.OPS.paintInlineImageXObject) {
            const imgName = operatorList.argsArray[i][0];
            if (imgName && !imageIndexSet.has(imgName)) {
              imageIndexSet.add(imgName);
              try {
                const imgObj = await new Promise<any>((resolve) => {
                  (page as any).objs.get(imgName, (img: any) => resolve(img));
                });

                if (imgObj && imgObj.data) {
                  // Render imgObj to an offscreen canvas
                  const canvas = document.createElement('canvas');
                  canvas.width = imgObj.width;
                  canvas.height = imgObj.height;
                  const ctx = canvas.getContext('2d');
                  if (ctx) {
                    const imgData = ctx.createImageData(imgObj.width, imgObj.height);
                    if (imgObj.data.length === imgObj.width * imgObj.height * 4) {
                      imgData.data.set(imgObj.data);
                    } else if (imgObj.data.length === imgObj.width * imgObj.height * 3) {
                      // RGB to RGBA
                      let srcIdx = 0;
                      let dstIdx = 0;
                      while (srcIdx < imgObj.data.length) {
                        imgData.data[dstIdx] = imgObj.data[srcIdx];
                        imgData.data[dstIdx + 1] = imgObj.data[srcIdx + 1];
                        imgData.data[dstIdx + 2] = imgObj.data[srcIdx + 2];
                        imgData.data[dstIdx + 3] = 255;
                        srcIdx += 3;
                        dstIdx += 4;
                      }
                    }
                    ctx.putImageData(imgData, 0, 0);
                    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
                    if (blob) {
                      extractedCount++;
                      zip.file(`image_p${p}_${imgName}.png`, blob);
                    }
                  }
                }
              } catch (e) {
                console.warn('Could not extract image object:', imgName, e);
              }
            }
          }
        }
      }

      // If no native inline image objects were found (e.g. vector-only or scanned flattened), fallback to high-DPI page render
      if (extractedCount === 0) {
        setStatusText('文档内嵌图像为扁平图层，正在切片提取高清页面图...');
        const pageZipBlob = await exportPdfHighDpiImages(pdfJsDoc, pages, 150, 'png', (c, t) => {
          setProgress(c / t);
        });
        const url = URL.createObjectURL(pageZipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseName}_extracted_pages.zip`;
        a.click();
        URL.revokeObjectURL(url);
        onShowToast?.('提取完成', '已将各页图像素材打包为 ZIP 下载', 'success');
      } else {
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseName}_embedded_images.zip`;
        a.click();
        URL.revokeObjectURL(url);
        onShowToast?.('批量提取图片成功', `共提取到 ${extractedCount} 个独立图像资源`, 'success');
      }

      onClose();
    } catch (err: any) {
      console.error(err);
      onShowToast?.('提取失败', err.message || '提取过程中发生异常', 'warning');
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. 批量将页面导出为图片 (ZIP)
  const handleExportPagesAsImages = async () => {
    if (!pdfJsDoc) return;
    setIsProcessing(true);
    setProgress(0);
    setStatusText('正在按指定 DPI 渲染页面图像...');

    try {
      const zipBlob = await exportPdfHighDpiImages(
        pdfJsDoc,
        pages,
        selectedDpi,
        imageFormat,
        (curr, total) => {
          setProgress(curr / total);
          setStatusText(`正在导出第 ${curr} / ${total} 页 (${selectedDpi} DPI)...`);
        }
      );

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseName}_pages_${selectedDpi}dpi.zip`;
      a.click();
      URL.revokeObjectURL(url);

      onShowToast?.('页面切图导出成功', `已将 ${pages.length} 页导出为 ${selectedDpi} DPI 压缩包`, 'success');
      onClose();
    } catch (err: any) {
      console.error(err);
      onShowToast?.('导出失败', err.message || '处理过程中发生异常', 'warning');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      data-no-canvas-click="true"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in"
    >
      <div className="w-full max-w-2xl bg-white dark:bg-[#1e1e20] rounded-2xl shadow-2xl border border-black/[0.08] dark:border-white/[0.1] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileDown className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              批量提取文字与素材资产
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-black/[0.04] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="px-5 pt-3 flex items-center space-x-2 border-b border-black/[0.04] dark:border-white/[0.06]">
          {[
            { id: 'text', label: '批量提取纯文本 / Markdown', icon: FileText, color: 'text-blue-600' },
            { id: 'images', label: '批量提取内嵌图片素材', icon: ImageIcon, color: 'text-emerald-600' },
            { id: 'pages', label: '批量页面切图 (ZIP)', icon: Archive, color: 'text-purple-600' },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => !isProcessing && setActiveTab(tab.id as any)}
                className={`px-3.5 py-2 text-xs font-medium rounded-lg flex items-center space-x-2 transition-all ${
                  isActive
                    ? 'bg-black/[0.05] dark:bg-white/[0.1] text-neutral-900 dark:text-white font-semibold shadow-2xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${tab.color}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {activeTab === 'text' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-2 block">
                  输出文本格式
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'txt', name: '纯文本 (.txt)', desc: '标准文本流，保留换行与段落' },
                    { id: 'md', name: 'Markdown (.md)', desc: '结构化标记，包含分级页码标题' },
                    { id: 'json', name: '数据对象 (.json)', desc: '包含页码与结构化文本数组' },
                  ].map((fmt) => (
                    <button
                      key={fmt.id}
                      onClick={() => setTextFormat(fmt.id as any)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        textFormat === fmt.id
                          ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/30 ring-1 ring-blue-600'
                          : 'border-black/[0.08] dark:border-white/[0.1] hover:border-black/20'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                          {fmt.name}
                        </span>
                        {textFormat === fmt.id && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />}
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-1">{fmt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.04]">
                <div>
                  <div className="text-xs font-medium text-neutral-800 dark:text-neutral-200">
                    添加页码与分页隔离标识
                  </div>
                  <div className="text-[11px] text-neutral-500">在提取的文字中自动插入每页的分隔提示符</div>
                </div>
                <input
                  type="checkbox"
                  checked={includePageHeaders}
                  onChange={(e) => setIncludePageHeaders(e.target.checked)}
                  className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                />
              </div>
            </div>
          )}

          {activeTab === 'images' && (
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/30 text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">
                <p className="font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
                  ⚡ 原生内嵌图像智能解包引擎：
                </p>
                <p>
                  直接深度遍历 PDF 内部的 XObject 图形字典，提取文档中插入的原始高清配图、插图、Logo、印章与图表，以无损 PNG 格式打包为 ZIP 归档。
                </p>
              </div>
              <div className="text-xs text-neutral-500 flex items-center justify-between px-1">
                <span>文档总页数：{pdfJsDoc?.numPages || 0} 页</span>
                <span>解包格式：ZIP 压缩包</span>
              </div>
            </div>
          )}

          {activeTab === 'pages' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-2 block">
                  切图分辨率与画质
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(DPI_SETTINGS).slice(0, 4).map(([dpiStr, item]) => {
                    const dpi = Number(dpiStr);
                    const isSel = selectedDpi === dpi;
                    return (
                      <button
                        key={dpi}
                        onClick={() => setSelectedDpi(dpi)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          isSel
                            ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/30 ring-1 ring-blue-600'
                            : 'border-black/[0.08] dark:border-white/[0.1] hover:border-black/20'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                            {item.name}
                          </span>
                          {isSel && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />}
                        </div>
                        <p className="text-[11px] text-neutral-500 mt-0.5">{item.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">格式：</label>
                <div className="flex items-center space-x-2">
                  {(['png', 'jpeg'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setImageFormat(fmt)}
                      className={`px-3 py-1 text-xs rounded-lg uppercase font-medium transition-all ${
                        imageFormat === fmt
                          ? 'bg-blue-600 text-white'
                          : 'bg-black/[0.05] dark:bg-white/[0.05] text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Progress Bar when processing */}
          {isProcessing && (
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400">
                <span className="flex items-center space-x-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  <span>{statusText || '正在处理中...'}</span>
                </span>
                <span className="font-mono font-medium">{Math.round(progress * 100)}%</span>
              </div>
              <div className="w-full h-1.5 bg-black/[0.06] dark:bg-white/[0.1] rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-200"
                  style={{ width: `${Math.max(5, progress * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-black/[0.02] dark:bg-white/[0.02] border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between">
          <div className="text-[11px] text-neutral-500">
            全部处理均在浏览器本地安全完成，不上传服务器
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-colors"
            >
              取消
            </button>
            <button
              onClick={() => {
                if (activeTab === 'text') handleExtractText();
                else if (activeTab === 'images') handleExtractEmbeddedImages();
                else if (activeTab === 'pages') handleExportPagesAsImages();
              }}
              disabled={isProcessing}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white flex items-center space-x-1.5 shadow-sm transition-all disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>正在导出...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>开始批量提取并下载</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
