import React from 'react';
import {
  X,
  FileText,
  FileCode,
  Table as TableIcon,
  HardDrive,
  Calendar,
  Layers,
  ShieldCheck,
  Check,
  Hash,
  Clock,
  Sparkles,
} from 'lucide-react';
import type { OfficeFile } from '../../types';
import { formatBytes } from '../../utils/pdfLibWrapper';

export interface DocumentPropertiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: OfficeFile | null;
}

export const DocumentPropertiesModal: React.FC<DocumentPropertiesModalProps> = ({
  isOpen,
  onClose,
  file,
}) => {
  if (!isOpen || !file) return null;

  let sizeBytes = 0;
  let pageCount = 1;
  let charCount = 0;
  let rowCount = 0;
  let colCount = 0;
  let watermarkCount = 0;

  if (file.type === 'pdf' && file.content?.bytes) {
    sizeBytes = file.content.bytes.byteLength;
    pageCount = file.content.pages?.length || 1;
    watermarkCount = (file.content.pages || []).reduce(
      (acc: number, p: any) => acc + (p.detectedWatermarks?.length || 0),
      0
    );
  } else if (file.type === 'doc' && file.content) {
    const raw = typeof file.content === 'string' ? file.content : JSON.stringify(file.content);
    charCount = raw.length;
    sizeBytes = new Blob([raw]).size;
    pageCount = Math.max(1, Math.ceil(charCount / 1200));
  } else if (file.type === 'sheet' && file.content) {
    const sheet = file.content;
    rowCount = sheet.rows || 35;
    colCount = sheet.cols || 15;
    const filledCells = Object.keys(sheet.cells || {}).length;
    sizeBytes = filledCells * 64 + 512;
  }

  const updatedDate = new Date(file.modifiedAt || file.createdAt || Date.now()).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white dark:bg-[#1c1c1e] rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden text-neutral-800 dark:text-neutral-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-900/30">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              {file.type === 'pdf' ? (
                <FileCode className="w-4 h-4" />
              ) : file.type === 'sheet' ? (
                <TableIcon className="w-4 h-4" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-semibold leading-tight">文档属性与元数据</h2>
              <p className="text-[11px] text-neutral-400">实时计算提取的物理与逻辑特征</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* File Name & Type */}
          <div className="bg-neutral-50 dark:bg-neutral-800/40 rounded-xl p-3 border border-neutral-100 dark:border-neutral-800">
            <div className="text-[11px] text-neutral-400 mb-1">文件名称</div>
            <div className="font-semibold text-neutral-900 dark:text-white break-all">{file.name}</div>
            <div className="mt-2 flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                {file.type.toUpperCase()} 格式
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                本地离线解析
              </span>
            </div>
          </div>

          {/* Properties Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl border border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-850/40">
              <div className="flex items-center space-x-1.5 text-neutral-400 mb-1">
                <HardDrive className="w-3.5 h-3.5" />
                <span className="text-[11px]">文件体积</span>
              </div>
              <div className="font-semibold text-sm text-neutral-800 dark:text-neutral-200">
                {formatBytes(sizeBytes)}
              </div>
              <div className="text-[10px] text-neutral-400">{sizeBytes.toLocaleString()} 字节</div>
            </div>

            <div className="p-3 rounded-xl border border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-850/40">
              <div className="flex items-center space-x-1.5 text-neutral-400 mb-1">
                <Layers className="w-3.5 h-3.5" />
                <span className="text-[11px]">页面与结构</span>
              </div>
              <div className="font-semibold text-sm text-neutral-800 dark:text-neutral-200">
                {file.type === 'sheet'
                  ? `${rowCount} 行 × ${colCount} 列`
                  : `${pageCount} 页`}
              </div>
              <div className="text-[10px] text-neutral-400">
                {file.type === 'doc'
                  ? `约 ${charCount} 字符`
                  : file.type === 'pdf'
                  ? `含 ${watermarkCount} 处水印识别`
                  : '标准表格矩阵'}
              </div>
            </div>

            <div className="p-3 rounded-xl border border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-850/40">
              <div className="flex items-center space-x-1.5 text-neutral-400 mb-1">
                <Clock className="w-3.5 h-3.5" />
                <span className="text-[11px]">修改时间</span>
              </div>
              <div className="font-medium text-xs text-neutral-800 dark:text-neutral-200 leading-snug">
                {updatedDate}
              </div>
            </div>

            <div className="p-3 rounded-xl border border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-850/40">
              <div className="flex items-center space-x-1.5 text-neutral-400 mb-1">
                <Hash className="w-3.5 h-3.5" />
                <span className="text-[11px]">文档 ID</span>
              </div>
              <div className="font-mono text-[11px] text-neutral-600 dark:text-neutral-400 truncate">
                {file.id}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-200 dark:border-neutral-800/80 flex justify-end bg-neutral-50/30 dark:bg-neutral-900/20">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:hover:bg-white dark:text-neutral-900 transition-colors shadow-2xs cursor-pointer"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
