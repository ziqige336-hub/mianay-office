import React, { useState } from 'react';
import {
  FileText,
  Table as TableIcon,
  FileCode,
  Home,
  Plus,
  X,
  Check,
  Loader2,
  Circle,
  FolderOpen,
  GripVertical,
} from 'lucide-react';
import type { OfficeFile, FileType } from '../../types';

interface TabBarProps {
  openFiles: OfficeFile[];
  activeFileId: string | null; // null means Home is active
  onSelectTab: (fileId: string | null) => void;
  onCloseTab: (fileId: string, e: React.MouseEvent) => void;
  onCreateNew: (type: FileType) => void;
  onImportFile: () => void;
  onReorderFiles?: (newFiles: OfficeFile[]) => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  openFiles,
  activeFileId,
  onSelectTab,
  onCloseTab,
  onCreateNew,
  onImportFile,
  onReorderFiles,
}) => {
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const getFileIcon = (type: FileType) => {
    switch (type) {
      case 'doc':
        return <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />;
      case 'sheet':
        return <TableIcon className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
      case 'pdf':
        return <FileCode className="w-3.5 h-3.5 text-rose-500 shrink-0" />;
    }
  };

  const getSaveIndicator = (status?: 'saved' | 'saving' | 'unsaved') => {
    if (status === 'saving') {
      return (
        <span title="正在自动保存..." className="flex items-center text-amber-500 ml-1.5">
          <Loader2 className="w-2.5 h-2.5 animate-spin" />
        </span>
      );
    }
    if (status === 'unsaved') {
      return (
        <span title="有未保存的改动" className="w-1.5 h-1.5 rounded-full bg-blue-500 ml-1.5" />
      );
    }
    return null;
  };

  const handleDragStart = (idx: number, e: React.DragEvent) => {
    setDraggedIndex(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
  };

  const handleDragOver = (idx: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== idx) {
      setDragOverIndex(idx);
    }
  };

  const handleDrop = (targetIdx: number, e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIdx) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newFiles = [...openFiles];
    const [moved] = newFiles.splice(draggedIndex, 1);
    newFiles.splice(targetIdx, 0, moved);
    onReorderFiles?.(newFiles);

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div
      id="lumina-tab-bar"
      className="h-[34px] w-full bg-[#fbfbfd]/90 dark:bg-neutral-800/95 backdrop-blur-xl border-b border-black/[0.06] dark:border-neutral-700 flex items-center px-2 z-20 select-none overflow-x-auto no-scrollbar gap-1"
    >
      {/* Home Workspace Tab */}
      <button
        onClick={() => onSelectTab(null)}
        className={`h-[26px] px-2.5 rounded-[6px] text-xs font-medium flex items-center space-x-1.5 transition-all shrink-0 ${
          activeFileId === null
            ? 'bg-white dark:bg-neutral-700 text-[#0071e3] dark:text-[#2997ff] shadow-[0_1px_2px_rgba(0,0,0,0.06)] font-semibold border border-black/[0.04] dark:border-neutral-600'
            : 'text-[#86868b] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
        }`}
      >
        <Home className="w-3.5 h-3.5 stroke-[2]" />
        <span>工作空间</span>
      </button>

      {/* Document Tabs with Drag and Drop Reordering */}
      <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar">
        {openFiles.map((file, idx) => {
          const isActive = activeFileId === file.id;
          const isDragging = draggedIndex === idx;
          const isOver = dragOverIndex === idx && draggedIndex !== idx;

          return (
            <div
              key={file.id}
              draggable
              onDragStart={(e) => handleDragStart(idx, e)}
              onDragOver={(e) => handleDragOver(idx, e)}
              onDrop={(e) => handleDrop(idx, e)}
              onDragEnd={handleDragEnd}
              onClick={() => onSelectTab(file.id)}
              className={`group h-[26px] px-2.5 rounded-[6px] text-xs flex items-center space-x-1.5 transition-all shrink-0 cursor-grab active:cursor-grabbing border max-w-[200px] relative ${
                isActive
                  ? 'bg-white dark:bg-neutral-700 border-black/[0.04] dark:border-neutral-600 text-[#1d1d1f] dark:text-[#f5f5f7] shadow-[0_1px_2px_rgba(0,0,0,0.06)] font-medium'
                  : 'bg-transparent border-transparent text-[#86868b] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
              } ${isDragging ? 'opacity-40 scale-95 border-dashed border-[#0071e3]' : ''} ${
                isOver ? 'ring-1 ring-[#0071e3] bg-blue-50/40 dark:bg-blue-950/30' : ''
              }`}
              title="按住并拖拽可调整文档标签顺序"
            >
              {/* Insert Marker Line when drag-over */}
              {isOver && (
                <div className="absolute -left-1 top-1 bottom-1 w-1 bg-[#0071e3] rounded-full shadow-xs animate-pulse z-30" />
              )}

              {getFileIcon(file.type)}
              <span className="truncate text-xs font-normal">{file.name}</span>
              {getSaveIndicator(file.saveStatus)}

              {/* Close Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(file.id, e);
                }}
                className={`p-0.5 rounded-[4px] text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-black/[0.06] dark:hover:bg-white/[0.1] transition-colors ml-1 ${
                  isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
                title="关闭标签页 (Cmd+W)"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Plus New Button Dropdown */}
      <div className="relative shrink-0 ml-0.5">
        <button
          onClick={() => setShowNewMenu(!showNewMenu)}
          className="w-[26px] h-[26px] rounded-[6px] flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
          title="新建文档 (Cmd+T)"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2]" />
        </button>

        {showNewMenu && (
          <div
            onClick={() => setShowNewMenu(false)}
            className="absolute left-0 top-full mt-1.5 w-48 rounded-[10px] bg-white/95 dark:bg-[#252528]/95 backdrop-blur-2xl shadow-[0_10px_30px_rgba(0,0,0,0.12)] border border-black/[0.08] dark:border-white/[0.1] p-1 z-50 text-xs text-[#1d1d1f] dark:text-[#f5f5f7]"
          >
            <button
              onClick={() => onCreateNew('doc')}
              className="w-full px-2.5 py-1.5 rounded-[6px] text-left flex items-center space-x-2 hover:bg-[#0071e3] hover:text-white dark:hover:bg-[#0071e3] group transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-blue-500 group-hover:text-white" />
              <span>新建文稿 (Docx)</span>
            </button>
            <button
              onClick={() => onCreateNew('sheet')}
              className="w-full px-2.5 py-1.5 rounded-[6px] text-left flex items-center space-x-2 hover:bg-[#0071e3] hover:text-white dark:hover:bg-[#0071e3] group transition-colors"
            >
              <TableIcon className="w-3.5 h-3.5 text-emerald-500 group-hover:text-white" />
              <span>新建电子表格 (Xlsx)</span>
            </button>
            <button
              onClick={() => onCreateNew('pdf')}
              className="w-full px-2.5 py-1.5 rounded-[6px] text-left flex items-center space-x-2 hover:bg-[#0071e3] hover:text-white dark:hover:bg-[#0071e3] group transition-colors"
            >
              <FileCode className="w-3.5 h-3.5 text-rose-500 group-hover:text-white" />
              <span>编辑 PDF</span>
            </button>
            <div className="my-1 border-t border-black/[0.06] dark:border-white/[0.08]" />
            <button
              onClick={onImportFile}
              className="w-full px-2.5 py-1.5 rounded-[6px] text-left flex items-center space-x-2 hover:bg-[#0071e3] hover:text-white dark:hover:bg-[#0071e3] group transition-colors text-[#86868b] dark:text-[#98989d]"
            >
              <FolderOpen className="w-3.5 h-3.5 text-amber-500 group-hover:text-white" />
              <span className="group-hover:text-white">打开本地文件...</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

