import React, { useState } from 'react';
import {
  X,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Scan,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Layers,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PageMeta } from '../../../types';
import {
  convertPdfToWordDocx,
  convertPdfToExcelXlsx,
  exportPdfHighDpiImages,
  exportScannedImageBasedPdf,
  DPI_SETTINGS,
} from '../../../utils/pdfExportEngines';

interface PdfConvertModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfJsDoc: pdfjsLib.PDFDocumentProxy | null;
  pages: PageMeta[];
  fileName: string;
  initialType?: string;
  onShowToast?: (title: string, message: string, type?: 'success' | 'info' | 'warning') => void;
}

export const PdfConvertModal: React.FC<PdfConvertModalProps> = ({
  isOpen,
  onClose,
  pdfJsDoc,
  pages,
  fileName,
  initialType = 'docx',
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'docx' | 'xlsx' | 'images' | 'scanned' | 'txt'>(
    (initialType as any) || 'docx'
  );
  const [selectedDpi, setSelectedDpi] = useState<number>(96);
  const [imageFormat, setImageFormat] = useState<'png' | 'jpeg'>('png');
  const [includeOcrLayer, setIncludeOcrLayer] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>('');

  // Synchronize activeTab whenever initialType or modal open state changes
  React.useEffect(() => {
    if (isOpen && initialType) {
      setActiveTab(initialType as any);
    }
  }, [isOpen, initialType]);

  if (!isOpen) return null;

  const handleStartConversion = async () => {
    if (!pdfJsDoc) return;
    setIsProcessing(true);
    setProgress(0);
    setStatusText('正在初始化引擎...');

    try {
      const baseName = fileName.replace(/\.[^/.]+$/, '');

      if (activeTab === 'docx') {
        const docxBlob = await convertPdfToWordDocx(pdfJsDoc, (p, text) => {
          setProgress(p);
          setStatusText(text);
        });
        const url = URL.createObjectURL(docxBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseName}_converted.docx`;
        a.click();
        URL.revokeObjectURL(url);
        onShowToast?.('Word 转换成功', '已生成标准 .docx 文档并开始下载', 'success');
      } else if (activeTab === 'xlsx') {
        const xlsxBlob = await convertPdfToExcelXlsx(pdfJsDoc, (p, text) => {
          setProgress(p);
          setStatusText(text);
        });
        const url = URL.createObjectURL(xlsxBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseName}_converted.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        onShowToast?.('Excel 转换成功', '已生成结构化 .xlsx 表格并开始下载', 'success');
      } else if (activeTab === 'images') {
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
        a.download = `${baseName}_images_${selectedDpi}dpi.zip`;
        a.click();
        URL.revokeObjectURL(url);
        onShowToast?.('图片包导出成功', `已按 ${selectedDpi} DPI 输出无损图片包`, 'success');
      } else if (activeTab === 'scanned') {
        const scannedBytes = await exportScannedImageBasedPdf(
          pdfJsDoc,
          pages,
          selectedDpi,
          includeOcrLayer,
          (p, text) => {
            setProgress(p);
            setStatusText(text);
          }
        );
        const blob = new Blob([scannedBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseName}_scanned_${selectedDpi}dpi.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        onShowToast?.('扫描型 PDF 导出成功', '已生成防篡改纯图片型 PDF (保留 OCR 检索层)', 'success');
      } else if (activeTab === 'txt') {
        let fullText = '';
        for (let p = 1; p <= pdfJsDoc.numPages; p++) {
          setProgress(p / pdfJsDoc.numPages);
          setStatusText(`正在提取第 ${p} / ${pdfJsDoc.numPages} 页纯文本...`);
          const page = await pdfJsDoc.getPage(p);
          const tc = await page.getTextContent();
          fullText += `--- 第 ${p} 页 ---\n` + tc.items.map((it: any) => it.str || '').join(' ') + '\n\n';
        }
        const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseName}_extracted.txt`;
        a.click();
        URL.revokeObjectURL(url);
        onShowToast?.('纯文本提取成功', '已将所有页面文本提取至 .txt 文件', 'success');
      }

      onClose();
    } catch (err: any) {
      console.error('Conversion failed:', err);
      onShowToast?.('转换失败', err?.message || '处理过程中出现异常', 'warning');
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
      <div className="w-full max-w-3xl bg-white dark:bg-[#1e1e20] rounded-2xl shadow-2xl border border-black/[0.08] dark:border-white/[0.1] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              专业 PDF 格式转换引擎
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
        <div className="px-5 pt-3 flex items-center space-x-2 border-b border-black/[0.04] dark:border-white/[0.06] overflow-x-auto">
          {[
            { id: 'docx', label: '转 Word (.docx)', icon: FileText, color: 'text-blue-600' },
            { id: 'xlsx', label: '转 Excel (.xlsx)', icon: FileSpreadsheet, color: 'text-emerald-600' },
            { id: 'images', label: '转图片 (DPI)', icon: ImageIcon, color: 'text-amber-600' },
            { id: 'scanned', label: '转扫描型 PDF', icon: Scan, color: 'text-purple-600' },
            { id: 'txt', label: '纯文本 (.txt)', icon: FileText, color: 'text-neutral-600' },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => !isProcessing && setActiveTab(tab.id as any)}
                className={`px-3 py-2 text-xs font-medium rounded-lg flex items-center space-x-1.5 transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-black/[0.05] dark:bg-white/[0.1] text-neutral-900 dark:text-white font-semibold'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${tab.color}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Options Content */}
        <div className="p-5 space-y-4">
          {activeTab === 'docx' && (
            <div className="space-y-3 bg-blue-50/50 dark:bg-blue-950/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
              <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">
                <strong>智能排版重构：</strong>自动识别 PDF 中的标题层级（H1/H2/H3）、段落行距、粗体、正文文本流，重构为 Microsoft Word 原生格式。
              </p>
            </div>
          )}

          {activeTab === 'xlsx' && (
            <div className="space-y-3 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
              <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">
                <strong>表格数据重构：</strong>自动检测水平与垂直对齐间距，将 PDF 报表/对账单转为 Microsoft Excel 工作表。
              </p>
            </div>
          )}

          {(activeTab === 'images' || activeTab === 'scanned') && (
            <div className="space-y-4">
              {/* DPI selection */}
              <div>
                <label className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-2 block">
                  输出分辨率 (DPI 行业标准)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(DPI_SETTINGS).map(([dpiStr, item]) => {
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

              {activeTab === 'images' && (
                <div className="flex items-center space-x-4 pt-2">
                  <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">图片格式：</label>
                  <label className="flex items-center space-x-1.5 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                    <input
                      type="radio"
                      name="fmt"
                      checked={imageFormat === 'png'}
                      onChange={() => setImageFormat('png')}
                      className="accent-blue-600"
                    />
                    <span>PNG (无损高保真)</span>
                  </label>
                  <label className="flex items-center space-x-1.5 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                    <input
                      type="radio"
                      name="fmt"
                      checked={imageFormat === 'jpeg'}
                      onChange={() => setImageFormat('jpeg')}
                      className="accent-blue-600"
                    />
                    <span>JPEG (较小体积)</span>
                  </label>
                </div>
              )}

              {activeTab === 'scanned' && (
                <div className="bg-purple-50/50 dark:bg-purple-950/20 p-3 rounded-xl border border-purple-100 dark:border-purple-900/30 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 block">
                      注入 OCR 可检索隐形文本层
                    </span>
                    <span className="text-[11px] text-neutral-500">
                      保留纯图片防篡改视觉效果的同时，允许通过搜索框检索文字
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={includeOcrLayer}
                    onChange={(e) => setIncludeOcrLayer(e.target.checked)}
                    className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                  />
                </div>
              )}
            </div>
          )}

          {/* Progress bar when running */}
          {isProcessing && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400">
                <span className="flex items-center space-x-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  <span>{statusText}</span>
                </span>
                <span className="font-mono font-medium">{Math.round(progress * 100)}%</span>
              </div>
              <div className="w-full h-1.5 bg-black/[0.06] dark:bg-white/[0.1] rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-300"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-black/[0.02] dark:bg-white/[0.02] border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-end space-x-2">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-1.5 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-black/[0.04]"
          >
            取消
          </button>
          <button
            onClick={handleStartConversion}
            disabled={isProcessing}
            className="px-4 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-xs flex items-center space-x-1.5 disabled:opacity-50"
          >
            {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>开始处理并下载</span>
          </button>
        </div>
      </div>
    </div>
  );
};
