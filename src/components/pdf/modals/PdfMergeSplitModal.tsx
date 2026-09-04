import React, { useState } from 'react';
import {
  X,
  Layers,
  Scissors,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Download,
  Loader2,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';

interface PdfMergeSplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPdfBytes: Uint8Array | null;
  currentFileName: string;
  initialMode?: 'merge' | 'split';
  onShowToast?: (title: string, message: string, type?: 'success' | 'info' | 'warning') => void;
}

interface MergeItem {
  id: string;
  name: string;
  bytes: Uint8Array;
  pageCount: number;
}

export const PdfMergeSplitModal: React.FC<PdfMergeSplitModalProps> = ({
  isOpen,
  onClose,
  currentPdfBytes,
  currentFileName,
  initialMode = 'merge',
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'merge' | 'split'>(initialMode);
  const [mergeFiles, setMergeFiles] = useState<MergeItem[]>([]);
  const [splitMode, setSplitMode] = useState<'every' | 'range'>('range');
  const [everyN, setEveryN] = useState<number>(1);
  const [pageRange, setPageRange] = useState<string>('1-2, 3');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Synchronize activeTab whenever initialMode or modal open state changes
  React.useEffect(() => {
    if (isOpen && initialMode) {
      setActiveTab(initialMode);
    }
  }, [isOpen, initialMode]);

  // Initialize with current file if available
  React.useEffect(() => {
    if (isOpen && currentPdfBytes && mergeFiles.length === 0) {
      PDFDocument.load(currentPdfBytes, { ignoreEncryption: true })
        .then((doc) => {
          setMergeFiles([
            {
              id: 'current-doc',
              name: currentFileName || '当前文档.pdf',
              bytes: currentPdfBytes,
              pageCount: doc.getPageCount(),
            },
          ]);
        })
        .catch(console.error);
    }
  }, [isOpen, currentPdfBytes, currentFileName]);

  if (!isOpen) return null;

  const handleAddFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    for (const f of files) {
      const buffer = await f.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      try {
        const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        setMergeFiles((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).substring(7),
            name: f.name,
            bytes,
            pageCount: doc.getPageCount(),
          },
        ]);
      } catch (err) {
        onShowToast?.('文件解析失败', `${f.name} 不是有效的 PDF 文件`, 'warning');
      }
    }
  };

  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= mergeFiles.length) return;
    const next = [...mergeFiles];
    const temp = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = temp;
    setMergeFiles(next);
  };

  const handleRemoveItem = (id: string) => {
    setMergeFiles((prev) => prev.filter((it) => it.id !== id));
  };

  const handleExecuteMerge = async () => {
    if (mergeFiles.length < 2) {
      onShowToast?.('提示', '请至少添加 2 个 PDF 文件进行合并', 'info');
      return;
    }
    setIsProcessing(true);
    try {
      const mergedPdf = await PDFDocument.create();
      for (const item of mergeFiles) {
        const srcDoc = await PDFDocument.load(item.bytes, { ignoreEncryption: true });
        const indices = srcDoc.getPageIndices();
        const copiedPages = await mergedPdf.copyPages(srcDoc, indices);
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }
      const finalBytes = await mergedPdf.save();
      const blob = new Blob([finalBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `merged_${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      onShowToast?.('合并成功', `已成功合并 ${mergeFiles.length} 个文档`, 'success');
      onClose();
    } catch (err: any) {
      onShowToast?.('合并失败', err.message || '操作失败', 'warning');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecuteSplit = async () => {
    if (!currentPdfBytes) return;
    setIsProcessing(true);
    try {
      const srcDoc = await PDFDocument.load(currentPdfBytes, { ignoreEncryption: true });
      const totalPages = srcDoc.getPageCount();
      const zip = new JSZip();

      if (splitMode === 'every') {
        const step = Math.max(1, everyN);
        let part = 1;
        for (let i = 0; i < totalPages; i += step) {
          const newDoc = await PDFDocument.create();
          const pageIndices: number[] = [];
          for (let j = i; j < Math.min(i + step, totalPages); j++) {
            pageIndices.push(j);
          }
          const copied = await newDoc.copyPages(srcDoc, pageIndices);
          copied.forEach((p) => newDoc.addPage(p));
          const bytes = await newDoc.save();
          zip.file(`part_${part}_pages_${i + 1}-${Math.min(i + step, totalPages)}.pdf`, bytes);
          part++;
        }
      } else {
        // Range mode: e.g. "1-2, 4"
        const ranges = pageRange.split(',').map((s) => s.trim()).filter(Boolean);
        let part = 1;
        for (const r of ranges) {
          const newDoc = await PDFDocument.create();
          const indices: number[] = [];
          if (r.includes('-')) {
            const [start, end] = r.split('-').map((n) => parseInt(n.trim()));
            if (!isNaN(start) && !isNaN(end)) {
              for (let p = Math.max(1, start); p <= Math.min(end, totalPages); p++) {
                indices.push(p - 1);
              }
            }
          } else {
            const p = parseInt(r);
            if (!isNaN(p) && p >= 1 && p <= totalPages) {
              indices.push(p - 1);
            }
          }
          if (indices.length > 0) {
            const copied = await newDoc.copyPages(srcDoc, indices);
            copied.forEach((p) => newDoc.addPage(p));
            const bytes = await newDoc.save();
            zip.file(`range_${r.replace(/\s+/g, '')}.pdf`, bytes);
            part++;
          }
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `split_results_${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      onShowToast?.('拆分成功', '已生成并下载拆分后的 PDF 压缩包', 'success');
      onClose();
    } catch (err: any) {
      onShowToast?.('拆分失败', err.message || '拆分解析失败', 'warning');
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
            <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              PDF 页面拆分与合并工作台
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab selection */}
        <div className="px-5 pt-3 flex items-center space-x-2 border-b border-black/[0.04] dark:border-white/[0.06]">
          <button
            onClick={() => setActiveTab('merge')}
            className={`px-4 py-2 text-xs font-medium rounded-lg flex items-center space-x-1.5 transition-all ${
              activeTab === 'merge'
                ? 'bg-black/[0.05] dark:bg-white/[0.1] text-blue-600 dark:text-blue-400 font-semibold'
                : 'text-neutral-600'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>多文件合并 (Merge)</span>
          </button>

          <button
            onClick={() => setActiveTab('split')}
            className={`px-4 py-2 text-xs font-medium rounded-lg flex items-center space-x-1.5 transition-all ${
              activeTab === 'split'
                ? 'bg-black/[0.05] dark:bg-white/[0.1] text-emerald-600 dark:text-emerald-400 font-semibold'
                : 'text-neutral-600'
            }`}
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>单文件拆分与提取 (Split)</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[380px] overflow-y-auto">
          {activeTab === 'merge' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  合并文件列表（按顺序拼接）：
                </span>
                <label className="px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-600 hover:bg-blue-100 cursor-pointer flex items-center space-x-1">
                  <Plus className="w-3.5 h-3.5" />
                  <span>添加 PDF 文件</span>
                  <input
                    type="file"
                    accept="application/pdf"
                    multiple
                    className="hidden"
                    onChange={handleAddFiles}
                  />
                </label>
              </div>

              <div className="space-y-1.5">
                {mergeFiles.map((file, idx) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-2.5 bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] rounded-xl"
                  >
                    <div className="flex items-center space-x-2 overflow-hidden">
                      <span className="font-mono text-xs text-neutral-400 w-5">{idx + 1}.</span>
                      <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                      <div className="truncate">
                        <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200 block truncate">
                          {file.name}
                        </span>
                        <span className="text-[11px] text-neutral-400">共 {file.pageCount} 页</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        onClick={() => handleMoveItem(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1 text-neutral-500 hover:text-neutral-800 disabled:opacity-20"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleMoveItem(idx, 'down')}
                        disabled={idx === mergeFiles.length - 1}
                        className="p-1 text-neutral-500 hover:text-neutral-800 disabled:opacity-20"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleRemoveItem(file.id)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-xs font-medium text-neutral-800 dark:text-neutral-200 cursor-pointer">
                  <input
                    type="radio"
                    name="split-mode"
                    checked={splitMode === 'range'}
                    onChange={() => setSplitMode('range')}
                    className="accent-emerald-600"
                  />
                  <span>按页码范围自定义拆分</span>
                </label>
                {splitMode === 'range' && (
                  <div className="pl-6 space-y-1">
                    <input
                      type="text"
                      value={pageRange}
                      onChange={(e) => setPageRange(e.target.value)}
                      placeholder="例：1-3, 4, 5-8"
                      className="w-full px-3 py-1.5 text-xs rounded-lg bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.1] text-neutral-900 dark:text-neutral-100 font-mono"
                    />
                    <p className="text-[11px] text-neutral-500">
                      支持以逗号分隔多个范围，每个范围将独立输出为一个 PDF 文件并打包为 ZIP。
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-xs font-medium text-neutral-800 dark:text-neutral-200 cursor-pointer">
                  <input
                    type="radio"
                    name="split-mode"
                    checked={splitMode === 'every'}
                    onChange={() => setSplitMode('every')}
                    className="accent-emerald-600"
                  />
                  <span>固定每 N 页拆分为一个独立文件</span>
                </label>
                {splitMode === 'every' && (
                  <div className="pl-6 flex items-center space-x-2">
                    <span className="text-xs text-neutral-600 dark:text-neutral-400">每</span>
                    <input
                      type="number"
                      min={1}
                      value={everyN}
                      onChange={(e) => setEveryN(Math.max(1, Number(e.target.value)))}
                      className="w-16 px-2 py-1 text-xs rounded-lg bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.08] text-center font-mono"
                    />
                    <span className="text-xs text-neutral-600 dark:text-neutral-400">页切分</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-black/[0.02] dark:bg-white/[0.02] border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-black/[0.04]"
          >
            取消
          </button>
          <button
            onClick={activeTab === 'merge' ? handleExecuteMerge : handleExecuteSplit}
            disabled={isProcessing}
            className="px-4 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-xs flex items-center space-x-1.5 disabled:opacity-50"
          >
            {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>{activeTab === 'merge' ? '开始合并' : '开始拆分'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
