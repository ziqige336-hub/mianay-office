import React, { useState, useEffect, useRef } from 'react';
import {
  Sliders,
  Sparkles,
  Eraser,
  Edit3,
  Check,
  X,
  Minus,
  Square,
  Copy,
  FileText,
  Table as TableIcon,
  FileCode,
  FolderOpen,
  Cpu,
  CheckCircle2,
} from 'lucide-react';
import type { AppModule, OfficeFile } from '../../types';
import { MianayLogo } from '../common/MianayLogo';
import { windowManager } from '../../services/windowManager';

interface TitleBarProps {
  activeModule: AppModule;
  documentTitle?: string;
  activeFile?: OfficeFile | null;
  onRenameDocument?: (newName: string) => void;
  saveStatus?: 'saved' | 'saving' | 'unsaved';
  isInspectorOpen: boolean;
  onToggleInspector: () => void;
  onGoHome?: () => void;
  isWatermarkPanelOpen?: boolean;
  onToggleWatermarkPanel?: () => void;
  watermarkCount?: number;
  onOpenEngineStatus?: () => void;
  onMinimize?: () => void;
  onToggleMaximize?: () => void;
  onCloseWindow?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  activeModule,
  documentTitle = 'Mianay Office',
  activeFile,
  onRenameDocument,
  saveStatus = 'saved',
  isInspectorOpen,
  onToggleInspector,
  onGoHome,
  isWatermarkPanelOpen = false,
  onToggleWatermarkPanel,
  watermarkCount = 0,
  onOpenEngineStatus,
  onMinimize,
  onToggleMaximize,
  onCloseWindow,
}) => {
  const isWatermarkSupported = Boolean(onToggleWatermarkPanel);

  // Window Maximized State tracking
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    // Initial sync with real native window state
    windowManager.isMaximized().then((max) => {
      setIsMaximized(Boolean(max));
    });

    // Subscribe to IPC window-state-changed events from main process (maximize, unmaximize, restore)
    const unsubscribe = windowManager.subscribeWindowState((max) => {
      setIsMaximized(Boolean(max));
    });
    return unsubscribe;
  }, []);

  const handleMinimize = async () => {
    if (onMinimize) {
      await onMinimize();
      return;
    }
    await windowManager.minimizeWindow();
  };

  const handleToggleMaximize = async () => {
    if (onToggleMaximize) {
      await onToggleMaximize();
    } else {
      await windowManager.toggleMaximizeWindow();
    }
    // Re-verify actual state from native window
    const currentMax = await windowManager.isMaximized();
    setIsMaximized(Boolean(currentMax));
  };

  const handleClose = () => {
    if (onCloseWindow) {
      onCloseWindow();
      return;
    }
    windowManager.closeWindow();
  };

  // Inline Rename State
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [nameInput, setNameInput] = useState(documentTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  // Synchronize when documentTitle changes externally only when NOT actively editing
  useEffect(() => {
    if (!isEditingTitle) {
      setNameInput(documentTitle);
    }
  }, [documentTitle, isEditingTitle]);

  // Focus and select input text without extension when entering edit mode
  useEffect(() => {
    if (isEditingTitle && inputRef.current) {
      inputRef.current.focus();
      const dotIndex = nameInput.lastIndexOf('.');
      if (dotIndex > 0) {
        inputRef.current.setSelectionRange(0, dotIndex);
      } else {
        inputRef.current.select();
      }
    }
  }, [isEditingTitle]);

  const handleStartEditing = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!activeFile && !onRenameDocument) return;
    setNameInput(documentTitle);
    setIsEditingTitle(true);
  };

  const handleSaveRename = () => {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== documentTitle && onRenameDocument) {
      onRenameDocument(trimmed);
    }
    setIsEditingTitle(false);
  };

  const handleCancelRename = () => {
    setNameInput(documentTitle);
    setIsEditingTitle(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveRename();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelRename();
    }
  };

  const getFileIcon = () => {
    if (!activeFile) {
      return <FolderOpen className="w-3.5 h-3.5 text-blue-500 shrink-0" />;
    }
    switch (activeFile.type) {
      case 'doc':
        return <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />;
      case 'sheet':
        return <TableIcon className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
      case 'pdf':
        return <FileCode className="w-3.5 h-3.5 text-rose-500 shrink-0" />;
      default:
        return <Sparkles className="w-3.5 h-3.5 text-blue-500 shrink-0" />;
    }
  };

  const getFormatBadge = () => {
    if (!activeFile) return null;
    const ext = activeFile.name.split('.').pop()?.toUpperCase();
    if (!ext) return null;

    const colors: Record<string, string> = {
      DOCX: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
      DOC: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
      XLSX: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
      XLS: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
      CSV: 'bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300',
      PDF: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
    };

    return (
      <span
        className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tracking-tight uppercase ${
          colors[ext] || 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
        }`}
      >
        {ext}
      </span>
    );
  };

  return (
    <header
      id="lumina-titlebar"
      style={{ WebkitAppRegion: 'drag' } as any}
      onDoubleClick={(e) => {
        // 双击标题栏空白区域触发最大化/还原切换（Windows 原生惯例）
        if (e.target === e.currentTarget || (e.target as HTMLElement).id === 'lumina-titlebar') {
          handleToggleMaximize();
        }
      }}
      className="h-11 w-full flex items-center justify-between px-3.5 bg-white/95 dark:bg-neutral-800 backdrop-blur-xl border-b border-neutral-200/80 dark:border-neutral-700 select-none z-30 transition-colors cursor-default"
    >
      {/* Left: Brand & Logo */}
      <div className="flex items-center space-x-3 min-w-[200px]" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <div
          onClick={onGoHome}
          className="flex items-center space-x-2 cursor-pointer group hover:opacity-80 transition-opacity pl-1"
          title="返回工作空间主页"
        >
          <MianayLogo size={22} rounded="md" />
          <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 tracking-tight">
            Mianay Office
          </span>
        </div>
      </div>

      {/* Center: Document Title & Editable Rename Module */}
      <div className="flex items-center justify-center max-w-[500px]" style={{ WebkitAppRegion: 'no-drag' } as any}>
        {isEditingTitle && onRenameDocument ? (
          <div
            id="titlebar-rename-form"
            className="flex items-center space-x-1.5 px-2 py-0.5 rounded-xl bg-white dark:bg-[#202024] border border-blue-500 shadow-md ring-2 ring-blue-500/20 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {getFileIcon()}
            <input
              ref={inputRef}
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={handleSaveRename}
              onKeyDown={handleKeyDown}
              className="px-1.5 py-0.5 text-xs font-medium text-neutral-900 dark:text-neutral-100 bg-transparent border-none focus:outline-none w-56 sm:w-72"
              placeholder="请输入新的文件名..."
            />
            <button
              type="button"
              id="titlebar-btn-confirm-rename"
              onClick={handleSaveRename}
              className="w-5 h-5 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
              title="保存新文件名 (Enter)"
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              type="button"
              id="titlebar-btn-cancel-rename"
              onClick={handleCancelRename}
              className="w-5 h-5 rounded-md bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-neutral-600 dark:text-neutral-300 flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
              title="取消重命名 (Esc)"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div
            id="titlebar-document-pill"
            onDoubleClick={() => handleStartEditing()}
            className={`flex items-center space-x-2 px-3 py-1 rounded-xl text-xs transition-all ${
              activeFile
                ? 'hover:bg-neutral-100 dark:hover:bg-neutral-800/80 cursor-pointer border border-transparent hover:border-neutral-200/80 dark:hover:border-neutral-700/80 group'
                : 'text-neutral-500 dark:text-neutral-400 font-medium'
            }`}
            title={activeFile ? '点击编辑按钮或双击标题以重命名文档' : '工作空间总览'}
          >
            {getFileIcon()}
            <span className="font-semibold text-neutral-900 dark:text-neutral-100 max-w-xs sm:max-w-sm truncate tracking-tight">
              {documentTitle}
            </span>
            {getFormatBadge()}

            {activeFile && onRenameDocument && (
              <button
                type="button"
                id="titlebar-btn-edit-name"
                onClick={handleStartEditing}
                className="w-5 h-5 rounded-md flex items-center justify-center text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 opacity-0 group-hover:opacity-100 transition-all ml-0.5 cursor-pointer"
                title="重命名此文档"
              >
                <Edit3 className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right: Window Controls */}
      <div className="flex items-center space-x-2 min-w-[200px] justify-end pr-1" style={{ WebkitAppRegion: 'no-drag' } as any}>
        {/* Save Status pill (if active file exists) */}
        {activeFile && (
          <div className="mr-1.5 flex items-center">
            {saveStatus === 'unsaved' && (
              <span
                id="titlebar-status-unsaved"
                className="inline-flex items-center text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-full border border-amber-200/80 dark:border-amber-800/60 shadow-2xs select-none transition-all"
                title="当前文档有未保存的更改 (Ctrl+S / Cmd+S 保存)"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse" />
                未保存
              </span>
            )}
            {saveStatus === 'saving' && (
              <span
                id="titlebar-status-saving"
                className="inline-flex items-center text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-full border border-blue-200/80 dark:border-blue-800/60 shadow-2xs select-none transition-all"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 animate-ping" />
                保存中...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span
                id="titlebar-status-saved"
                className="inline-flex items-center text-[11px] text-neutral-400 dark:text-neutral-500 px-1.5 py-0.5 select-none"
                title="所有更改已保存"
              >
                <Check className="w-3 h-3 mr-1 text-emerald-500" />
                已保存
              </span>
            )}
          </div>
        )}

        {/* Standard Window Control Action Group */}
        <div id="titlebar-window-controls" className="flex items-center space-x-1" style={{ WebkitAppRegion: 'no-drag' } as any}>
          {/* Minimize Button */}
          <button
            type="button"
            id="titlebar-btn-minimize"
            onClick={handleMinimize}
            className="w-8 h-7 flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/80 dark:hover:bg-neutral-700/80 rounded-md transition-colors cursor-pointer"
            title="最小化"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          {/* Maximize / Restore Button */}
          <button
            type="button"
            id="titlebar-btn-maximize"
            onClick={handleToggleMaximize}
            className="w-8 h-7 flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/80 dark:hover:bg-neutral-700/80 rounded-md transition-colors cursor-pointer"
            title={isMaximized ? '还原' : '最大化'}
          >
            {isMaximized ? (
              <Copy className="w-3 h-3 rotate-180" />
            ) : (
              <Square className="w-3 h-3" />
            )}
          </button>

          {/* Close Button: hover with danger red background */}
          <button
            type="button"
            id="titlebar-btn-close"
            onClick={handleClose}
            className="w-8 h-7 flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-red-500 hover:text-white dark:hover:bg-red-500 dark:hover:text-white rounded-md transition-colors cursor-pointer"
            title="关闭窗口"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Traffic light elements preserved for compatibility */}
        <div className="hidden">
          <div id="traffic-light-minimize" onClick={handleMinimize} />
          <div id="traffic-light-expand" onClick={handleToggleMaximize} />
          <div id="traffic-light-close" onClick={handleClose} />
        </div>
      </div>
    </header>
  );
};
