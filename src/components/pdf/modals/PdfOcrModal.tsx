import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Copy,
  Download,
  Loader2,
  FileText,
  Check,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { renderPdfPageToCanvas } from '../../../utils/pdfLibWrapper';
import { runRealTesseractOcr } from '../../../utils/ocrEngine';

interface PdfOcrModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfJsDoc: pdfjsLib.PDFDocumentProxy | null;
  currentPageIndex: number;
  onExportToDoc?: (text: string) => void;
  onShowToast?: (title: string, message: string, type?: 'success' | 'info' | 'warning') => void;
}

export const PdfOcrModal: React.FC<PdfOcrModalProps> = ({
  isOpen,
  onClose,
  pdfJsDoc,
  currentPageIndex,
  onExportToDoc,
  onShowToast,
}) => {
  const [ocrLang, setOcrLang] = useState<'chi_sim+eng' | 'eng' | 'chi_tra+eng'>('chi_sim+eng');
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleStartOcr = async () => {
    if (!pdfJsDoc) return;
    setIsRecognizing(true);
    setProgress(0.1);
    try {
      const canvas = document.createElement('canvas');
      await renderPdfPageToCanvas(pdfJsDoc, currentPageIndex, canvas, 2.0, 0);
      setProgress(0.4);
      const res = await runRealTesseractOcr(canvas, ocrLang);
      setRecognizedText(res.text || '未识别到文本内容');
      setProgress(1.0);
      onShowToast?.('OCR 识别成功', '已高精度提取文字内容', 'success');
    } catch (err: any) {
      onShowToast?.('OCR 识别失败', err.message || '识别出错', 'warning');
    } finally {
      setIsRecognizing(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(recognizedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      data-no-canvas-click="true"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in"
    >
      <div className="w-full max-w-lg bg-white dark:bg-[#1e1e20] rounded-2xl shadow-2xl border border-black/[0.08] dark:border-white/[0.1] overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              Tesseract AI 高精度 OCR 识别
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-neutral-600 dark:text-neutral-400">识别语言：</span>
              <select
                value={ocrLang}
                onChange={(e) => setOcrLang(e.target.value as any)}
                className="px-2.5 py-1 text-xs rounded-lg bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.1] text-neutral-800 dark:text-neutral-200 font-medium"
              >
                <option value="chi_sim+eng">简体中文 + 英文</option>
                <option value="eng">仅英文 (English)</option>
                <option value="chi_tra+eng">繁体中文 + 英文</option>
              </select>
            </div>

            <button
              onClick={handleStartOcr}
              disabled={isRecognizing}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs flex items-center space-x-1.5 disabled:opacity-50"
            >
              {isRecognizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{recognizedText ? '重新识别' : '开始识别当前页'}</span>
            </button>
          </div>

          {/* Text output area */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
              识别结果与排版文本：
            </label>
            <textarea
              value={recognizedText}
              onChange={(e) => setRecognizedText(e.target.value)}
              placeholder="点击上方“开始识别当前页”按钮以提取当前 PDF 页面的印刷体与手写文字..."
              rows={10}
              className="w-full p-3 text-xs rounded-xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.1] text-neutral-900 dark:text-neutral-100 font-sans leading-relaxed focus:outline-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-black/[0.02] dark:bg-white/[0.02] border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between">
          <button
            onClick={handleCopy}
            disabled={!recognizedText}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-black/[0.04] flex items-center space-x-1 disabled:opacity-30"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? '已复制' : '复制文本'}</span>
          </button>

          <div className="flex items-center space-x-2">
            {onExportToDoc && (
              <button
                onClick={() => {
                  onExportToDoc(recognizedText);
                  onClose();
                }}
                disabled={!recognizedText}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300 hover:bg-blue-100 flex items-center space-x-1 disabled:opacity-30"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>导入到文稿编辑</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 dark:bg-white dark:text-neutral-900 text-white shadow-xs"
            >
              完成
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
