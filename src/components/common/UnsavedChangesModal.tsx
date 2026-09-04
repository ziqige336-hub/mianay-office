import React, { useEffect } from 'react';
import { AlertCircle, Save, LogOut, X, FileText, Table as TableIcon, FileCode } from 'lucide-react';
import type { OfficeFile } from '../../types';

interface UnsavedChangesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveAndExit: () => void;
  onDiscardAndExit: () => void;
  activeFile?: OfficeFile | null;
  unsavedFiles?: OfficeFile[];
  isSaving?: boolean;
}

export const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({
  isOpen,
  onClose,
  onSaveAndExit,
  onDiscardAndExit,
  activeFile,
  unsavedFiles = [],
  isSaving = false,
}) => {
  // Keyboard accessibility: Escape to cancel, Enter to save & exit
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        onSaveAndExit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onSaveAndExit]);

  if (!isOpen) return null;

  const targetFiles = unsavedFiles.length > 0 ? unsavedFiles : activeFile ? [activeFile] : [];
  const primaryFileName = activeFile?.name || (targetFiles[0]?.name ?? '未命名文档');

  const getFileIcon = (type?: string) => {
    switch (type) {
      case 'doc':
        return <FileText className="w-4 h-4 text-blue-500 shrink-0" />;
      case 'sheet':
        return <TableIcon className="w-4 h-4 text-emerald-500 shrink-0" />;
      case 'pdf':
        return <FileCode className="w-4 h-4 text-rose-500 shrink-0" />;
      default:
        return <FileText className="w-4 h-4 text-neutral-500 shrink-0" />;
    }
  };

  return (
    <div
      id="unsaved-changes-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="unsaved-changes-modal-card"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] bg-white dark:bg-[#1e1e20] rounded-2xl shadow-2xl border border-black/[0.08] dark:border-neutral-700/80 p-6 flex flex-col space-y-5 animate-in zoom-in-95 duration-200 select-none text-neutral-900 dark:text-neutral-100"
      >
        {/* Header: Icon + Title */}
        <div className="flex items-start space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400 shadow-2xs">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
              是否保存对文档的更改？
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
              如果您直接退出，在本次编辑会话中所做的更改将全部丢失且无法恢复。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center transition-colors"
            title="关闭对话框 (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content: Unsaved Document Pill List */}
        <div className="bg-neutral-50 dark:bg-neutral-800/60 rounded-xl p-3 border border-neutral-200/70 dark:border-neutral-700/60 space-y-2">
          <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 px-0.5">
            检测到以下文档存在未保存的修改：
          </div>
          <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
            {targetFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-700 shadow-2xs text-xs"
              >
                <div className="flex items-center space-x-2 min-w-0">
                  {getFileIcon(file.type)}
                  <span className="font-medium text-neutral-800 dark:text-neutral-200 truncate max-w-[240px]">
                    {file.name}
                  </span>
                </div>
                <span className="inline-flex items-center text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-900/60 shrink-0">
                  未保存
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons with Apple HIG Visual Hierarchy */}
        <div className="flex flex-col sm:flex-row items-center justify-end space-y-2 sm:space-y-0 sm:space-x-2.5 pt-1">
          {/* Cancel */}
          <button
            type="button"
            id="btn-unsaved-cancel"
            onClick={onClose}
            disabled={isSaving}
            className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 hover:bg-neutral-200/80 dark:bg-neutral-800 dark:hover:bg-neutral-700 transition-colors cursor-pointer border border-transparent disabled:opacity-50"
          >
            取消
          </button>

          {/* Discard & Exit */}
          <button
            type="button"
            id="btn-unsaved-discard-and-exit"
            onClick={onDiscardAndExit}
            disabled={isSaving}
            className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 hover:bg-red-100/90 dark:bg-red-950/40 dark:hover:bg-red-900/50 transition-colors cursor-pointer border border-red-200/60 dark:border-red-900/40 flex items-center justify-center space-x-1.5 disabled:opacity-50"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>直接退出</span>
          </button>

          {/* Save & Exit (Primary Action) */}
          <button
            type="button"
            id="btn-unsaved-save-and-exit"
            onClick={onSaveAndExit}
            disabled={isSaving}
            className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-medium text-white bg-[#0071e3] hover:bg-[#0077ed] active:bg-[#0062c4] shadow-sm transition-all cursor-pointer flex items-center justify-center space-x-1.5 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? '正在保存...' : '保存并退出'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
