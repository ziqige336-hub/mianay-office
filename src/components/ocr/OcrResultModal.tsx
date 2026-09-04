import React, { useState } from 'react';
import {
  X,
  ScanText,
  Copy,
  Check,
  Download,
  Loader2,
  Sparkles,
  Layers,
  FileText,
} from 'lucide-react';
import type { OcrResult } from '../../types';

export interface OcrResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: OcrResult | null;
  isLoading: boolean;
  progressMessage?: string;
  onDownloadTxt: (text: string) => void;
}

export const OcrResultModal: React.FC<OcrResultModalProps> = ({
  isOpen,
  onClose,
  result,
  isLoading,
  progressMessage,
  onDownloadTxt,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (result?.text) {
      navigator.clipboard.writeText(result.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-white dark:bg-[#1c1c1e] rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden text-neutral-800 dark:text-neutral-100 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-900/30 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <ScanText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold leading-tight">OCR 离线文字识别结果</h2>
              <p className="text-[11px] text-neutral-400">基于 Tesseract.js WebAssembly 端侧引擎</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                {progressMessage || '正在执行 OCR 识别...'}
              </div>
              <div className="text-[11px] text-neutral-400">
                全本地离线运算，无任何文件上传至外部服务器
              </div>
            </div>
          ) : result ? (
            <>
              {/* Stats pill */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
                <div className="flex items-center space-x-4">
                  <div>
                    <div className="text-[10px] text-indigo-500 font-medium">综合置信度</div>
                    <div className="text-sm font-bold text-indigo-900 dark:text-indigo-200">
                      {(result.confidence * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="h-6 w-[1px] bg-indigo-200 dark:bg-indigo-800/60" />
                  <div>
                    <div className="text-[10px] text-indigo-500 font-medium">识别字符数</div>
                    <div className="text-sm font-bold text-indigo-900 dark:text-indigo-200">
                      {result.text.length}
                    </div>
                  </div>
                  <div className="h-6 w-[1px] bg-indigo-200 dark:bg-indigo-800/60" />
                  <div>
                    <div className="text-[10px] text-indigo-500 font-medium">段落行数</div>
                    <div className="text-sm font-bold text-indigo-900 dark:text-indigo-200">
                      {result.lines?.length || 1} 行
                    </div>
                  </div>
                </div>
              </div>

              {/* Text area */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-neutral-500 font-medium">
                  <span>提取文本内容</span>
                  <span>UTF-8 字符流</span>
                </div>
                <textarea
                  readOnly
                  value={result.text}
                  rows={10}
                  className="w-full p-3 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-750 text-neutral-800 dark:text-neutral-200 text-xs font-mono focus:outline-none select-text resize-none"
                />
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-neutral-400">
              未获取到有效识别结果，请重新尝试。
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3 border-t border-neutral-200 dark:border-neutral-800/80 flex items-center justify-between bg-neutral-50/30 dark:bg-neutral-900/20 shrink-0">
          <div className="text-[11px] text-neutral-400">
            {result?.text ? '可直接复制或保存为 TXT 纯文本' : ''}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              disabled={!result?.text || isLoading}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700/60 text-neutral-700 dark:text-neutral-200 transition-colors flex items-center space-x-1.5 disabled:opacity-40 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '已复制' : '复制文本'}</span>
            </button>
            <button
              onClick={() => result?.text && onDownloadTxt(result.text)}
              disabled={!result?.text || isLoading}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center space-x-1.5 shadow-2xs disabled:opacity-40 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>导出为 TXT</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
