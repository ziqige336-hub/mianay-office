import React, { useState } from 'react';
import {
  X,
  Download,
  FileCode,
  Image as ImageIcon,
  FileText,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Archive,
  RefreshCw,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface PdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  pageCount: number;
  onExportCleanPdf: () => Promise<void>;
  onExportImagesZip: (quality: number) => Promise<void>;
  onExportDocx: () => Promise<void>;
  onExportText: () => Promise<void>;
}

export const PdfExportModal: React.FC<PdfExportModalProps> = ({
  isOpen,
  onClose,
  fileName,
  pageCount,
  onExportCleanPdf,
  onExportImagesZip,
  onExportDocx,
  onExportText,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<'pdf' | 'images' | 'docx' | 'txt'>('pdf');
  const [imageQuality, setImageQuality] = useState<number>(2.0); // 2x Retina
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  if (!isOpen) return null;

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
      });
    } catch {}
  };

  const handleStartExport = async () => {
    setIsExporting(true);
    setExportProgress(20);
    try {
      if (selectedFormat === 'pdf') {
        setExportProgress(60);
        await onExportCleanPdf();
      } else if (selectedFormat === 'images') {
        setExportProgress(50);
        await onExportImagesZip(imageQuality);
      } else if (selectedFormat === 'docx') {
        setExportProgress(60);
        await onExportDocx();
      } else if (selectedFormat === 'txt') {
        setExportProgress(80);
        await onExportText();
      }
      setExportProgress(100);
      triggerConfetti();
      setTimeout(() => {
        setIsExporting(false);
        onClose();
      }, 600);
    } catch (err) {
      console.error('Export error:', err);
      setIsExporting(false);
    }
  };

  return (
    <div
      data-no-canvas-click="true"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4"
    >
      <div className="w-full max-w-lg bg-white dark:bg-[#1c1c1e] rounded-2xl shadow-2xl border border-neutral-200/80 dark:border-neutral-800 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                纯净格式导出中心
              </h3>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                100% 绝对纯净无水印 · 无任何导出页数限制
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Format: PDF */}
            <div
              onClick={() => setSelectedFormat('pdf')}
              className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between space-y-2 ${
                selectedFormat === 'pdf'
                  ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                  : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <FileCode className="w-5 h-5 text-rose-500" />
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold">
                  无水印 Pro
                </span>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  标准纯净 PDF
                </h4>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  应用所有旋转、去水印与批注
                </p>
              </div>
            </div>

            {/* Format: Images ZIP */}
            <div
              onClick={() => setSelectedFormat('images')}
              className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between space-y-2 ${
                selectedFormat === 'images'
                  ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                  : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <ImageIcon className="w-5 h-5 text-amber-500" />
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-bold">
                  高清分图
                </span>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  多页高清 PNG (ZIP)
                </h4>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  打包全部 {pageCount} 页高分辨率图
                </p>
              </div>
            </div>

            {/* Format: DOCX */}
            <div
              onClick={() => setSelectedFormat('docx')}
              className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between space-y-2 ${
                selectedFormat === 'docx'
                  ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                  : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <FileText className="w-5 h-5 text-blue-500" />
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 font-bold">
                  Word
                </span>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  转换为 Word (.docx)
                </h4>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  结构化提取并转换格式
                </p>
              </div>
            </div>

            {/* Format: Text TXT */}
            <div
              onClick={() => setSelectedFormat('txt')}
              className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between space-y-2 ${
                selectedFormat === 'txt'
                  ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                  : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <Archive className="w-5 h-5 text-indigo-500" />
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-bold">
                  纯文本
                </span>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  提取纯文本 (.txt)
                </h4>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  全文档文字无损抽取
                </p>
              </div>
            </div>
          </div>

          {/* Sub options for Images */}
          {selectedFormat === 'images' && (
            <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                渲染清晰度倍率:
              </span>
              <div className="flex space-x-1.5">
                {[
                  { label: '标准 (1.5x)', val: 1.5 },
                  { label: '视网膜 (2.0x)', val: 2.0 },
                  { label: '超清打印 (3.0x)', val: 3.0 },
                ].map((q) => (
                  <button
                    key={q.val}
                    onClick={() => setImageQuality(q.val)}
                    className={`px-2.5 py-1 text-[11px] rounded-lg font-medium transition-colors ${
                      imageQuality === q.val
                        ? 'bg-blue-600 text-white'
                        : 'bg-neutral-200/70 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Privacy Guarantee Note */}
          <div className="p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>
              已启用「绝对纯净无水印协议」，导出的文件不会添加任何软件水印或限制标识。
            </span>
          </div>

          {/* Progress Bar when exporting */}
          {isExporting && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400">
                <span>正在本地打包并生成文件...</span>
                <span className="font-mono">{exportProgress}%</span>
              </div>
              <div className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300 rounded-full"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-2 px-5 py-3.5 bg-neutral-50 dark:bg-neutral-900/50 border-t border-neutral-100 dark:border-neutral-800">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="px-3.5 py-1.5 text-xs font-medium rounded-xl text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleStartExport}
            disabled={isExporting}
            className="flex items-center space-x-1.5 px-4 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all active:scale-95 disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>正在导出...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>立即纯净下载</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
