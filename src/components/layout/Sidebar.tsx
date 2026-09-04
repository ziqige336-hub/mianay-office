import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,
  Table as TableIcon,
  Wrench,
  FileCode,
  FolderOpen,
  Plus,
  Home,
  Star,
  Trash2,
  Clock,
  ListTree,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Save,
  Image as ImageIcon,
  FileDown,
  Download,
  Share2,
  Layers,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
  PanelLeft,
  Eraser,
  X,
} from 'lucide-react';
import { FileMenu } from './FileMenu';
import type { AppModule, DocOutlineItem, FileType, HomeViewFilter, OfficeFile } from '../../types';
import { useDocumentManager } from '../../core/document';

interface SidebarProps {
  activeModule: AppModule;
  onSelectModule: (module: AppModule) => void;
  activeHomeFilter?: HomeViewFilter;
  onSelectHomeFilter?: (filter: HomeViewFilter) => void;
  onOpenFile: () => void;
  onNewDoc: (type: FileType) => void;
  onSaveCurrent?: () => void;
  onExportImage?: () => void;
  onExportPdf?: () => void;
  onExportWord?: () => void;
  onExportExcel?: () => void;
  onExportMarkdown?: () => void;
  currentFileType?: FileType | null;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  docOutline?: DocOutlineItem[];
  onJumpToHeading?: (pos: number) => void;
  hasActivePdf?: boolean;
  pdfFileName?: string;
  pdfPageCount?: number;
  openFiles?: OfficeFile[];
  activeFileId?: string | null;
  onSelectFile?: (fileId: string | null) => void;
  isWatermarkPanelOpen?: boolean;
  onToggleWatermarkPanel?: () => void;
  watermarkCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  onSelectModule,
  activeHomeFilter = 'all',
  onSelectHomeFilter,
  onOpenFile,
  onNewDoc,
  onSaveCurrent,
  onExportImage,
  onExportPdf,
  onExportWord,
  onExportExcel,
  onExportMarkdown,
  currentFileType,
  isCollapsed,
  onToggleCollapse,
  docOutline = [],
  onJumpToHeading,
  hasActivePdf,
  pdfFileName,
  pdfPageCount,
  openFiles = [],
  activeFileId,
  onSelectFile,
  isWatermarkPanelOpen = false,
  onToggleWatermarkPanel,
  watermarkCount = 0,
}) => {
  const {
    sessions: pdfSessions,
    activeSessionId: activePdfSessionId,
    switchDocument: switchPdfDocument,
    closeDocument: closePdfDocument,
  } = useDocumentManager();

  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const fileMenuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (fileMenuRef.current && !fileMenuRef.current.contains(e.target as Node)) {
        setIsFileMenuOpen(false);
      }
    };
    if (isFileMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isFileMenuOpen]);

  const handleSelectNav = (filter: HomeViewFilter) => {
    onSelectHomeFilter?.(filter);
    onSelectModule('home');
  };

  const isSheet = currentFileType === 'sheet';

  return (
    <aside
      id="lumina-sidebar"
      className={`${
        isCollapsed ? 'w-16' : 'w-60'
      } shrink-0 h-full min-h-0 bg-neutral-100/70 dark:bg-neutral-800 backdrop-blur-2xl border-r border-neutral-200/70 dark:border-neutral-700 flex flex-col justify-between p-3 transition-all duration-200 select-none ${
        isFileMenuOpen ? 'overflow-visible z-50' : 'overflow-y-auto no-scrollbar z-20'
      } relative`}
    >
      <div className="flex flex-col space-y-3">
        {/* Top Header with Symbol-Only Collapse Toggle */}
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} pb-1 border-b border-neutral-200/50 dark:border-neutral-700/60`}>
          {!isCollapsed && (
            <span className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">
              导航目录
            </span>
          )}
          <button
            id="sidebar-btn-collapse-top"
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60 transition-colors"
            title={isCollapsed ? '展开侧边栏 (Cmd+B)' : '折叠侧边栏 (Cmd+B)'}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Quick Actions: 1. 打开文件, 2. 文件 (File) 下拉菜单 */}
        <div className="flex flex-col space-y-2 relative" ref={fileMenuRef}>
          {/* 1. 打开文件 */}
          <button
            id="sidebar-btn-open-file"
            onClick={onOpenFile}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all active:scale-[0.98]"
            title="打开文件 (Cmd+O)"
          >
            <FolderOpen className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>打开文件</span>}
          </button>

          {/* 2. 文件 (File) 按钮 - 专业级二级/三级菜单入口 */}
          <div className="relative">
            <button
              id="sidebar-btn-file-menu"
              type="button"
              onClick={() => setIsFileMenuOpen(!isFileMenuOpen)}
              className={`w-full flex items-center justify-center py-2 ${
                isCollapsed ? 'px-0' : 'px-3'
              } ${
                isFileMenuOpen && !isCollapsed
                  ? 'rounded-t-xl rounded-b-none border-b-0 bg-white dark:bg-[#1c1c1e] text-blue-600 dark:text-blue-400 shadow-none z-40'
                  : 'rounded-xl bg-white dark:bg-neutral-800/90 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-750 shadow-2xs'
              } border border-neutral-200 dark:border-neutral-700 text-xs font-semibold transition-all select-none relative`}
              title="文件菜单 (二级与多级导出系统)"
            >
              <div className="flex items-center justify-center space-x-1.5 w-full text-center">
                <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                {!isCollapsed && <span>文件 (File)</span>}
                {!isCollapsed && (
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-neutral-400 transition-transform duration-150 ${
                      isFileMenuOpen ? 'rotate-180 text-blue-500' : ''
                    }`}
                  />
                )}
              </div>
            </button>

            {/* Hierarchical Cascading File Menu */}
            <FileMenu
              isOpen={isFileMenuOpen}
              onClose={() => setIsFileMenuOpen(false)}
              isCollapsed={isCollapsed}
            />
          </div>
        </div>

        {/* Dedicated Pages Navigation: 独立专页 */}
        <div className="space-y-1">
          {!isCollapsed && (
            <div className="px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase text-neutral-400 dark:text-neutral-500">
              文件管理
            </div>
          )}

          {/* 全部工作空间 */}
          <button
            id="sidebar-nav-home-all"
            onClick={() => handleSelectNav('all')}
            className={`w-full flex items-center ${
              isCollapsed ? 'justify-center px-0' : 'justify-start px-2.5 space-x-2.5'
            } py-2 rounded-xl text-xs font-medium transition-colors ${
              activeModule === 'home' && activeHomeFilter === 'all'
                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold'
                : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50'
            }`}
            title="工作空间 (全部文件)"
          >
            <Home className="w-4 h-4 text-blue-500 shrink-0" />
            {!isCollapsed && <span>工作空间</span>}
          </button>

          {/* 最近使用 独立专页 */}
          <button
            id="sidebar-nav-home-recent"
            onClick={() => handleSelectNav('recent')}
            className={`w-full flex items-center ${
              isCollapsed ? 'justify-center px-0' : 'justify-start px-2.5 space-x-2.5'
            } py-2 rounded-xl text-xs font-medium transition-colors ${
              activeModule === 'home' && activeHomeFilter === 'recent'
                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold'
                : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50'
            }`}
            title="最近使用"
          >
            <Clock className="w-4 h-4 text-indigo-500 shrink-0" />
            {!isCollapsed && <span>最近使用</span>}
          </button>

          {/* 已加星标 独立专页 */}
          <button
            id="sidebar-nav-home-favorites"
            onClick={() => handleSelectNav('favorites')}
            className={`w-full flex items-center ${
              isCollapsed ? 'justify-center px-0' : 'justify-start px-2.5 space-x-2.5'
            } py-2 rounded-xl text-xs font-medium transition-colors ${
              activeModule === 'home' && activeHomeFilter === 'favorites'
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold'
                : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50'
            }`}
            title="已加星标"
          >
            <Star className="w-4 h-4 text-amber-500 shrink-0" />
            {!isCollapsed && <span>已加星标</span>}
          </button>

          {/* 废纸篓 独立专页 */}
          <button
            id="sidebar-nav-home-trash"
            onClick={() => handleSelectNav('trash')}
            className={`w-full flex items-center ${
              isCollapsed ? 'justify-center px-0' : 'justify-start px-2.5 space-x-2.5'
            } py-2 rounded-xl text-xs font-medium transition-colors ${
              activeModule === 'home' && activeHomeFilter === 'trash'
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold'
                : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50'
            }`}
            title="废纸篓"
          >
            <Trash2 className="w-4 h-4 text-rose-500 shrink-0" />
            {!isCollapsed && <span>废纸篓</span>}
          </button>
        </div>

        {/* 4 Core Workbenches */}
        <div className="space-y-1">
          {!isCollapsed && (
            <div className="px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase text-neutral-400 dark:text-neutral-500">
              专业工作台
            </div>
          )}

          <button
            id="sidebar-nav-doc"
            onClick={() => onSelectModule('doc')}
            className={`w-full flex items-center ${
              isCollapsed ? 'justify-center px-0' : 'justify-start px-2.5 space-x-2.5'
            } py-2 rounded-xl text-xs font-medium transition-colors ${
              activeModule === 'doc'
                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold'
                : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50'
            }`}
            title="文稿 Doc"
          >
            <FileText className="w-4 h-4 text-blue-500 shrink-0" />
            {!isCollapsed && <span>文稿 Doc</span>}
          </button>

          <button
            id="sidebar-nav-sheet"
            onClick={() => onSelectModule('sheet')}
            className={`w-full flex items-center ${
              isCollapsed ? 'justify-center px-0' : 'justify-start px-2.5 space-x-2.5'
            } py-2 rounded-xl text-xs font-medium transition-colors ${
              activeModule === 'sheet'
                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold'
                : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50'
            }`}
            title="表格 Sheet"
          >
            <TableIcon className="w-4 h-4 text-emerald-500 shrink-0" />
            {!isCollapsed && <span>表格 Sheet</span>}
          </button>

          <button
            id="sidebar-nav-pdf"
            onClick={() => onSelectModule('pdf')}
            className={`w-full flex items-center ${
              isCollapsed ? 'justify-center px-0' : 'justify-start px-2.5 space-x-2.5'
            } py-2 rounded-xl text-xs font-medium transition-colors ${
              activeModule === 'pdf'
                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold'
                : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50'
            }`}
            title="PDF 编辑"
          >
            <FileCode className="w-4 h-4 text-rose-500 shrink-0" />
            {!isCollapsed && <span>PDF 编辑</span>}
          </button>
        </div>

        {/* Outline Navigation when in Doc module */}
        {activeModule === 'doc' && !isCollapsed && docOutline && docOutline.length > 0 && (() => {
          const uniqueOutline: DocOutlineItem[] = [];
          const seenTitles = new Set<string>();
          for (const item of docOutline) {
            const key = `${item.level}:::${(item.title || '').trim()}`;
            if (!seenTitles.has(key)) {
              seenTitles.add(key);
              uniqueOutline.push(item);
            }
          }
          if (uniqueOutline.length === 0) return null;
          return (
            <div className="pt-3 border-t border-neutral-200/60 dark:border-neutral-800/60 space-y-2">
              <div className="flex items-center space-x-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                <ListTree className="w-3 h-3" />
                <span>文档大纲 (Outline)</span>
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto no-scrollbar">
                {uniqueOutline.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onJumpToHeading?.(item.pos)}
                    className={`w-full text-left truncate py-1 px-2 rounded-lg text-xs hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60 transition-colors ${
                      item.level === 1
                        ? 'font-semibold text-neutral-800 dark:text-neutral-200'
                        : item.level === 2
                        ? 'pl-4 text-neutral-600 dark:text-neutral-400'
                        : 'pl-6 text-neutral-500 dark:text-neutral-500 text-[11px]'
                    }`}
                    title={item.title}
                  >
                    {item.title || '无标题'}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Module-Specific Open Documents Navigation without icons, Apple HIG neutral style */}
        {!isCollapsed && activeModule !== 'home' && (
          <div className="pt-2.5 border-t border-neutral-200/60 dark:border-neutral-800/60 space-y-1">
            <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              {activeModule === 'doc'
                ? '当前已打开文稿'
                : activeModule === 'sheet'
                ? '当前已打开表格'
                : '当前已打开 PDF'}
            </div>
            <div className="space-y-1 max-h-52 overflow-y-auto no-scrollbar">
              {(() => {
                if (activeModule === 'pdf') {
                  const pdfFiles = (openFiles || []).filter((f) => f.type === 'pdf');
                  if (pdfFiles.length === 0) {
                    return (
                      <div className="px-2 py-1.5 text-[11px] text-neutral-400 dark:text-neutral-500 italic">
                        暂无打开的 PDF
                      </div>
                    );
                  }
                  return pdfFiles.map((file) => {
                    const isActive = file.id === activeFileId;
                    return (
                      <div
                        key={file.id}
                        onClick={() => {
                          switchPdfDocument(file.id);
                          onSelectFile?.(file.id);
                        }}
                        className={`w-full group flex items-center justify-between p-2 rounded-lg text-[11px] cursor-pointer transition-colors ${
                          isActive
                            ? 'bg-neutral-200/80 dark:bg-neutral-800/80 font-medium text-neutral-900 dark:text-neutral-100 shadow-2xs'
                            : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/40 dark:hover:bg-neutral-800/40'
                        }`}
                        title={file.name}
                      >
                        <div className="truncate flex-1 mr-1">{file.name}</div>
                        {pdfFiles.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              closePdfDocument(file.id);
                              if (onSelectFile && activeFileId === file.id) {
                                const remaining = pdfFiles.filter((f) => f.id !== file.id);
                                onSelectFile(remaining.length > 0 ? remaining[0].id : null);
                              }
                            }}
                            className="opacity-0 group-hover:opacity-100 hover:bg-black/[0.08] dark:hover:bg-white/[0.1] rounded p-0.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                            title="关闭文档"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  });
                }

                const moduleFiles = (openFiles || []).filter((f) => f.type === activeModule);
                if (moduleFiles.length === 0) {
                  return (
                    <div className="px-2 py-1.5 text-[11px] text-neutral-400 dark:text-neutral-500 italic">
                      暂无打开的{activeModule === 'doc' ? '文稿' : '表格'}
                    </div>
                  );
                }

                return moduleFiles.map((file) => {
                  const isActive = file.id === activeFileId;
                  return (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => onSelectFile?.(file.id)}
                      className={`w-full text-left p-2 rounded-lg text-[11px] transition-colors block ${
                        isActive
                          ? 'bg-neutral-200/80 dark:bg-neutral-800/80 font-medium text-neutral-900 dark:text-neutral-100 shadow-2xs'
                          : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/40 dark:hover:bg-neutral-800/40'
                      }`}
                      title={file.name}
                    >
                      <div className="truncate">{file.name}</div>
                    </button>
                  );
                });
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Collapse Toggle */}
      <div className="pt-2 border-t border-neutral-200/60 dark:border-neutral-800/60">
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center p-2 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60 transition-colors text-xs"
          title={isCollapsed ? '展开侧边栏 (Cmd+B)' : '收起侧边栏 (Cmd+B)'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
};
