import React, { useState } from 'react';
import {
  FileText,
  Table as TableIcon,
  FileCode,
  FolderOpen,
  Plus,
  Star,
  Trash2,
  Clock,
  Search,
  MoreVertical,
  Copy,
  Edit2,
  RotateCcw,
  Sparkles,
  Grid,
  List as ListIcon,
  CheckCircle2,
  AlertTriangle,
  Eraser,
  X,
} from 'lucide-react';
import type { OfficeFile, FileType, HomeViewFilter } from '../../types';
import { MianayLogo } from '../common/MianayLogo';

interface HomeWorkspaceProps {
  files: OfficeFile[];
  activeFilter: HomeViewFilter;
  onChangeFilter: (filter: HomeViewFilter) => void;
  onOpenFile: (file: OfficeFile) => void;
  onCreateNew: (type: FileType) => void;
  onImportFile: () => void;
  onToggleFavorite: (fileId: string) => void;
  onTrashFile: (fileId: string, toTrash: boolean) => void;
  onDeletePermanently: (fileId: string) => void;
  onDuplicateFile: (fileId: string) => void;
  onRenameFile: (fileId: string, newName: string) => void;
  onOpenWatermarkStudio?: () => void;
  onShowToast?: (type: 'success' | 'error' | 'info' | 'vip-free', title: string, description?: string) => void;
}

export const HomeWorkspace: React.FC<HomeWorkspaceProps> = ({
  files,
  activeFilter,
  onChangeFilter,
  onOpenFile,
  onCreateNew,
  onImportFile,
  onToggleFavorite,
  onTrashFile,
  onDeletePermanently,
  onDuplicateFile,
  onRenameFile,
  onOpenWatermarkStudio,
  onShowToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [showEmptyTrashConfirm, setShowEmptyTrashConfirm] = useState(false);
  const [showWatermarkDevModal, setShowWatermarkDevModal] = useState(false);

  // Filter & sort files
  const filteredFiles = files
    .filter((f) => {
      // Search query
      if (searchQuery.trim() && !f.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      if (activeFilter === 'trash') {
        return f.isTrash === true;
      }

      // Normal non-trash views
      if (f.isTrash) return false;

      if (activeFilter === 'recent') return true;
      if (activeFilter === 'favorites') return f.isFavorite === true;
      if (activeFilter === 'doc') return f.type === 'doc';
      if (activeFilter === 'sheet') return f.type === 'sheet';
      if (activeFilter === 'pdf') return f.type === 'pdf';
      return true;
    })
    .sort((a, b) => {
      if (activeFilter === 'recent') {
        return b.modifiedAt - a.modifiedAt;
      }
      return b.modifiedAt - a.modifiedAt;
    });

  const getFileIcon = (type: FileType) => {
    switch (type) {
      case 'doc':
        return <FileText className="w-6 h-6 text-blue-500" />;
      case 'sheet':
        return <TableIcon className="w-6 h-6 text-emerald-500" />;
      case 'pdf':
        return <FileCode className="w-6 h-6 text-rose-500" />;
    }
  };

  const getFileTypeBadge = (type: FileType) => {
    switch (type) {
      case 'doc':
        return <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">Word 文稿</span>;
      case 'sheet':
        return <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">电子表格</span>;
      case 'pdf':
        return <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">PDF 文件</span>;
    }
  };

  const handleStartRename = (file: OfficeFile, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(file.id);
    setRenameInput(file.name);
    setActiveMenuId(null);
  };

  const handleFinishRename = (fileId: string) => {
    if (renameInput.trim()) {
      onRenameFile(fileId, renameInput.trim());
    }
    setRenamingId(null);
  };

  const formatTime = (timestamp: number) => {
    const d = new Date(timestamp);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return `今天 ${d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return `${d.getMonth() + 1}月${d.getDate()}日 ${d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
  };

  // Trash actions
  const handleEmptyAllTrash = () => {
    const trashFiles = files.filter((f) => f.isTrash);
    trashFiles.forEach((f) => onDeletePermanently(f.id));
    setShowEmptyTrashConfirm(false);
  };

  const handleRestoreAllTrash = () => {
    const trashFiles = files.filter((f) => f.isTrash);
    trashFiles.forEach((f) => onTrashFile(f.id, false));
  };

  // Header Title & Subtitle based on activeFilter
  const getPageHeaderInfo = () => {
    switch (activeFilter) {
      case 'recent':
        return {
          title: '最近使用 (Recent Documents)',
          desc: '快速查找并继续编辑最近打开的文件，按修改时间逆序排列',
          icon: <Clock className="w-6 h-6 text-indigo-500" />,
        };
      case 'favorites':
        return {
          title: '已加星标 (Starred Documents)',
          desc: '您收藏的重要文稿、电子表格与 PDF 文件',
          icon: <Star className="w-6 h-6 text-amber-500 fill-amber-500" />,
        };
      case 'trash':
        return {
          title: '废纸篓 (Trash Bin)',
          desc: '已删除的文件暂存在此处，可随时还原或彻底清除',
          icon: <Trash2 className="w-6 h-6 text-rose-500" />,
        };
      default:
        return {
          title: 'Mianay Office 工作空间',
          desc: '100% 本地安全隐私 • 专业级多文档协同 • 历史版本保护',
          icon: <MianayLogo size={24} rounded="md" />,
        };
    }
  };

  const pageInfo = getPageHeaderInfo();

  return (
    <div
      id="lumina-home-workspace"
      onClick={() => setActiveMenuId(null)}
      className="flex-1 h-full min-h-0 overflow-y-auto bg-[#f8f8fa] dark:bg-neutral-900 p-8 md:p-10 select-none text-neutral-900 dark:text-neutral-100"
    >
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Top Header & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-white dark:bg-neutral-800 shadow-2xs border border-neutral-200/80 dark:border-neutral-700/80">
              {pageInfo.icon}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
                {pageInfo.title}
              </h1>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {pageInfo.desc}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Search input */}
            <div className="relative w-64">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="搜索文档名称..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-neutral-800 dark:text-neutral-200"
              />
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-neutral-200/60 dark:bg-neutral-800/60 p-0.5 rounded-xl border border-neutral-200 dark:border-neutral-700">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-neutral-700 text-blue-600 shadow-xs'
                    : 'text-neutral-500'
                }`}
                title="网格视图"
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-neutral-700 text-blue-600 shadow-xs'
                    : 'text-neutral-500'
                }`}
                title="列表视图"
              >
                <ListIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Create Cards: Only on 'all' workspace view */}
        {activeFilter === 'all' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* New Document */}
            <div
              onClick={() => onCreateNew('doc')}
              className="p-5 rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200/70 dark:border-neutral-700 shadow-xs hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all cursor-pointer group relative overflow-hidden"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">新建文稿</h3>
              <p className="text-[11px] text-neutral-500 mt-1">Apple Pages 级富文本与排版</p>
              <div className="mt-3 flex items-center text-[11px] font-medium text-blue-600">
                <Plus className="w-3.5 h-3.5 mr-1" />
                <span>创建 Docx</span>
              </div>
            </div>

            {/* New Spreadsheet */}
            <div
              onClick={() => onCreateNew('sheet')}
              className="p-5 rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200/70 dark:border-neutral-700 shadow-xs hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all cursor-pointer group relative overflow-hidden"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <TableIcon className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">新建电子表格</h3>
              <p className="text-[11px] text-neutral-500 mt-1">无限行列、公式计算、图表分析</p>
              <div className="mt-3 flex items-center text-[11px] font-medium text-emerald-600">
                <Plus className="w-3.5 h-3.5 mr-1" />
                <span>创建 Xlsx</span>
              </div>
            </div>

            {/* New / Edit PDF */}
            <div
              onClick={() => onCreateNew('pdf')}
              className="p-5 rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200/70 dark:border-neutral-700 shadow-xs hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all cursor-pointer group relative overflow-hidden"
            >
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <FileCode className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">PDF 深度编辑</h3>
              <p className="text-[11px] text-neutral-500 mt-1">页面重排、图层擦除与印章</p>
              <div className="mt-3 flex items-center text-[11px] font-medium text-rose-600">
                <Plus className="w-3.5 h-3.5 mr-1" />
                <span>编辑 PDF</span>
              </div>
            </div>

            {/* Universal Watermark Removal Studio - In Development */}
            <div
              id="home-btn-watermark-studio"
              onClick={() => {
                setShowWatermarkDevModal(true);
                onShowToast?.(
                  'info',
                  '智能去水印功能正在开发中',
                  '底层跨格式无损剥离与算法联调进行中，即将上线！'
                );
              }}
              className="p-5 rounded-2xl bg-white dark:bg-neutral-800 border border-amber-200/80 dark:border-amber-900/60 shadow-xs hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all cursor-pointer group relative overflow-hidden"
              title="智能去水印功能正在开发中，点击查看详情"
            >
              {/* Top-Right In-Development Badge */}
              <div className="absolute top-3.5 right-3.5 flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 dark:bg-amber-400/15 text-amber-700 dark:text-amber-300 border border-amber-500/25 shadow-2xs">
                <Sparkles className="w-2.5 h-2.5 text-amber-500 animate-pulse" />
                <span>开发中</span>
              </div>

              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Eraser className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">智能去水印</h3>
              <p className="text-[11px] text-neutral-500 mt-1">PDF / DOCX / XLSX / 图像</p>
              <div className="mt-3 flex items-center text-[11px] font-medium text-amber-600 dark:text-amber-400">
                <Clock className="w-3.5 h-3.5 mr-1 text-amber-500" />
                <span>功能正在开发中 · 敬请期待</span>
              </div>
            </div>

            {/* Import File */}
            <div
              onClick={onImportFile}
              className="p-5 rounded-2xl bg-gradient-to-br from-neutral-100 to-neutral-200/60 dark:from-neutral-850 dark:to-neutral-900 border border-dashed border-neutral-300 dark:border-neutral-700 shadow-xs hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all cursor-pointer group relative flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-neutral-300/40 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">打开文件</h3>
                <p className="text-[11px] text-neutral-500 mt-1">支持拖拽或选取本地文件</p>
              </div>
              <div className="mt-3 text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
                .pdf .docx .xlsx
              </div>
            </div>
          </div>
        )}

        {/* Trash Bin Dedicated Action Bar */}
        {activeFilter === 'trash' && (
          <div className="flex items-center justify-between p-4 bg-rose-50/60 dark:bg-rose-950/20 rounded-2xl border border-rose-200/80 dark:border-rose-900/50">
            <div className="flex items-center space-x-2 text-xs text-rose-800 dark:text-rose-300">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>废纸篓中的文件保留在本地，彻底删除后将无法找回。</span>
            </div>
            {filteredFiles.length > 0 && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleRestoreAllTrash}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 shadow-2xs"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-blue-500" />
                  <span>全部还原</span>
                </button>
                <button
                  onClick={() => setShowEmptyTrashConfirm(true)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-2xs transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>清空废纸篓</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Filter Navigation Bar (All / Doc / Sheet / PDF) */}
        {activeFilter !== 'trash' && (
          <div className="flex items-center space-x-1.5 border-b border-neutral-200 dark:border-neutral-800 pb-3 overflow-x-auto">
            {[
              { key: 'all', label: '全部文档', count: files.filter((f) => !f.isTrash).length },
              { key: 'recent', label: '最近使用', count: files.filter((f) => !f.isTrash).length },
              { key: 'favorites', label: '已加星标', count: files.filter((f) => f.isFavorite && !f.isTrash).length },
              { key: 'doc', label: '文稿 Doc', count: files.filter((f) => f.type === 'doc' && !f.isTrash).length },
              { key: 'sheet', label: '表格 Sheet', count: files.filter((f) => f.type === 'sheet' && !f.isTrash).length },
              { key: 'pdf', label: 'PDF 文件', count: files.filter((f) => f.type === 'pdf' && !f.isTrash).length },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => onChangeFilter(tab.key as HomeViewFilter)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors flex items-center space-x-1.5 whitespace-nowrap ${
                  activeFilter === tab.key
                    ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-800'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    activeFilter === tab.key
                      ? 'bg-white/20 dark:bg-black/20 text-white dark:text-black'
                      : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Files View: Grid or List */}
        {filteredFiles.length === 0 ? (
          <div className="p-16 text-center space-y-3 bg-white dark:bg-[#18181b] rounded-2xl border border-neutral-200/80 dark:border-neutral-800">
            <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 flex items-center justify-center mx-auto">
              {activeFilter === 'trash' ? (
                <Trash2 className="w-6 h-6 text-neutral-400" />
              ) : activeFilter === 'favorites' ? (
                <Star className="w-6 h-6 text-neutral-400" />
              ) : (
                <FolderOpen className="w-6 h-6 text-neutral-400" />
              )}
            </div>
            <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              {activeFilter === 'trash'
                ? '废纸篓为空'
                : activeFilter === 'favorites'
                ? '暂无已加星标的文档'
                : activeFilter === 'recent'
                ? '暂无最近打开的文档'
                : '暂无相关文档'}
            </h3>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto">
              {activeFilter === 'trash'
                ? '删除的文件将显示在这里'
                : activeFilter === 'favorites'
                ? '在文件卡片右上角点击星标即可快速收藏'
                : '点击上方卡片创建新文档或导入本地文件'}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredFiles.map((file) => (
              <div
                key={file.id}
                onClick={() => !file.isTrash && onOpenFile(file)}
                className={`p-4 rounded-2xl bg-white dark:bg-[#1c1c1f] border border-neutral-200/80 dark:border-neutral-800/80 shadow-2xs hover:shadow-md transition-all group relative flex flex-col justify-between h-44 ${
                  file.isTrash ? 'opacity-75' : 'cursor-pointer hover:border-blue-400/80 dark:hover:border-blue-600/80'
                }`}
              >
                  <div>
                    {/* Top Row: Icon + Star/Menu */}
                    <div className="flex items-center justify-between">
                      <div className="p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800 group-hover:scale-105 transition-transform">
                        {getFileIcon(file.type)}
                      </div>

                      <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                        {!file.isTrash && (
                          <button
                            onClick={() => onToggleFavorite(file.id)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              file.isFavorite
                                ? 'text-amber-500'
                                : 'text-neutral-400 hover:text-amber-500 opacity-0 group-hover:opacity-100'
                            }`}
                            title={file.isFavorite ? '取消星标' : '添加星标'}
                          >
                            <Star className={`w-4 h-4 ${file.isFavorite ? 'fill-amber-500' : ''}`} />
                          </button>
                        )}

                        {/* Menu Dropdown */}
                        <div className="relative">
                          <button
                            onClick={() =>
                              setActiveMenuId(activeMenuId === file.id ? null : file.id)
                            }
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {activeMenuId === file.id && (
                            <div className="absolute right-0 top-7 w-36 bg-white dark:bg-neutral-800 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-700 py-1 z-30 select-none">
                              {!file.isTrash ? (
                                <>
                                  <button
                                    onClick={(e) => handleStartRename(file, e)}
                                    className="w-full flex items-center space-x-2 px-3 py-1.5 text-xs text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                    <span>重命名</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      onDuplicateFile(file.id);
                                      setActiveMenuId(null);
                                    }}
                                    className="w-full flex items-center space-x-2 px-3 py-1.5 text-xs text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>创建副本</span>
                                  </button>
                                  <div className="h-[1px] bg-neutral-200 dark:bg-neutral-700 my-1" />
                                  <button
                                    onClick={() => {
                                      onTrashFile(file.id, true);
                                      setActiveMenuId(null);
                                    }}
                                    className="w-full flex items-center space-x-2 px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>移入废纸篓</span>
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => {
                                      onTrashFile(file.id, false);
                                      setActiveMenuId(null);
                                    }}
                                    className="w-full flex items-center space-x-2 px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>还原文件</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      onDeletePermanently(file.id);
                                      setActiveMenuId(null);
                                    }}
                                    className="w-full flex items-center space-x-2 px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>永久删除</span>
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* File Title */}
                    <div className="mt-3" onClick={(e) => renamingId === file.id && e.stopPropagation()}>
                      {renamingId === file.id ? (
                        <input
                          type="text"
                          autoFocus
                          value={renameInput}
                          onChange={(e) => setRenameInput(e.target.value)}
                          onBlur={() => handleFinishRename(file.id)}
                          onKeyDown={(e) => e.key === 'Enter' && handleFinishRename(file.id)}
                          className="w-full text-xs font-semibold px-1.5 py-0.5 border border-blue-500 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                        />
                      ) : (
                        <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate group-hover:text-blue-600 transition-colors">
                          {file.name}
                        </h4>
                      )}
                      <div className="mt-1">{getFileTypeBadge(file.type)}</div>
                    </div>
                  </div>

                  {/* Bottom: Modified date or Restore/Delete actions */}
                  <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800/60 flex items-center justify-between text-[10px] text-neutral-400">
                    <span>{formatTime(file.modifiedAt)}</span>
                    {file.isTrash ? (
                      <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onTrashFile(file.id, false)}
                          className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-600 text-[10px] font-semibold hover:bg-blue-100"
                        >
                          还原
                        </button>
                        <button
                          onClick={() => onDeletePermanently(file.id)}
                          className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/50 text-rose-600 text-[10px] font-semibold hover:bg-rose-100"
                        >
                          删除
                        </button>
                      </div>
                    ) : (
                      <span className="font-mono text-[9px] text-neutral-400">
                        {file.saveStatus === 'saved' ? '已存入沙箱' : '草稿'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        ) : (
          /* List View */
          <div className="bg-white dark:bg-[#1c1c1f] rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 overflow-hidden divide-y divide-neutral-100 dark:divide-neutral-800">
            {filteredFiles.map((file) => (
              <div
                key={file.id}
                onClick={() => !file.isTrash && onOpenFile(file)}
                className={`p-3.5 flex items-center justify-between transition-colors ${
                  file.isTrash ? 'opacity-80' : 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/60'
                }`}
              >
                <div className="flex items-center space-x-3 truncate">
                  <div className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 shrink-0">
                    {getFileIcon(file.type)}
                  </div>
                  <div className="truncate">
                    {renamingId === file.id ? (
                      <input
                        type="text"
                        autoFocus
                        value={renameInput}
                        onChange={(e) => setRenameInput(e.target.value)}
                        onBlur={() => handleFinishRename(file.id)}
                        onKeyDown={(e) => e.key === 'Enter' && handleFinishRename(file.id)}
                        className="text-xs font-semibold px-1.5 py-0.5 border border-blue-500 rounded bg-white dark:bg-neutral-800"
                      />
                    ) : (
                      <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                        {file.name}
                      </div>
                    )}
                    <div className="flex items-center space-x-2 text-[10px] text-neutral-400 mt-0.5">
                      <span>{getFileTypeBadge(file.type)}</span>
                      <span>•</span>
                      <span>修改于 {formatTime(file.modifiedAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                  {!file.isTrash ? (
                    <>
                      <button
                        onClick={() => onToggleFavorite(file.id)}
                        className="p-1.5 text-neutral-400 hover:text-amber-500"
                      >
                        <Star className={`w-4 h-4 ${file.isFavorite ? 'text-amber-500 fill-amber-500' : ''}`} />
                      </button>
                      <button
                        onClick={(e) => handleStartRename(file, e)}
                        className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                        title="重命名"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDuplicateFile(file.id)}
                        className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                        title="副本"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onTrashFile(file.id, true)}
                        className="p-1.5 text-neutral-400 hover:text-rose-600"
                        title="删除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => onTrashFile(file.id, false)}
                        className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 text-xs font-semibold"
                      >
                        还原
                      </button>
                      <button
                        onClick={() => onDeletePermanently(file.id)}
                        className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 text-xs font-semibold"
                      >
                        永久删除
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Empty Trash Confirmation Modal */}
      {showEmptyTrashConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm bg-white dark:bg-neutral-850 rounded-2xl p-5 shadow-2xl border border-neutral-200 dark:border-neutral-700 space-y-4">
            <div className="flex items-center space-x-2.5 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                确认清空废纸篓？
              </h3>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              此操作将永久抹除废纸篓中的所有文档，无法撤销或恢复。请确认是否继续？
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowEmptyTrashConfirm(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200"
              >
                取消
              </button>
              <button
                onClick={handleEmptyAllTrash}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
              >
                确认彻底清空
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Smart Watermark Removal In-Development Dialog Modal */}
      {showWatermarkDevModal && (
        <div
          id="modal-watermark-dev-prompt"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
          onClick={() => setShowWatermarkDevModal(false)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-[#1c1c1e] rounded-3xl p-6 shadow-2xl border border-neutral-200/80 dark:border-neutral-800 space-y-5 animate-in zoom-in-95 duration-200 relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Background subtle glow */}
            <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Top-Right Close Button */}
            <button
              onClick={() => setShowWatermarkDevModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              title="关闭"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header with Icon and Development Tag */}
            <div className="flex items-start space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-xs border border-amber-500/25">
                <Eraser className="w-6 h-6" />
              </div>
              <div className="pr-6">
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                    智能去水印功能正在开发中
                  </h3>
                </div>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300/40">
                    研发版本 v1.1
                  </span>
                  <span className="text-[11px] text-neutral-400 dark:text-neutral-500">
                    纯本地沙箱 · 安全保密
                  </span>
                </div>
              </div>
            </div>

            {/* Detailed Feature Explanations */}
            <div className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed bg-neutral-50 dark:bg-neutral-900/50 p-4 rounded-2xl border border-neutral-200/60 dark:border-neutral-800/60 space-y-2.5">
              <p className="font-medium text-neutral-800 dark:text-neutral-200">
                我们正在打磨面向全格式办公文档的「智能无损去水印引擎」，核心能力规划中：
              </p>
              <ul className="space-y-1.5 text-neutral-500 dark:text-neutral-400 text-[11px]">
                <li className="flex items-start space-x-2">
                  <span className="text-amber-500 mt-0.5 font-bold">•</span>
                  <span><strong className="text-neutral-700 dark:text-neutral-300">PDF 矢量对象剔除：</strong>精准解析并清除底层 Watermark / Stamp 注释与倾斜文字层，杜绝破坏正文。</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-amber-500 mt-0.5 font-bold">•</span>
                  <span><strong className="text-neutral-700 dark:text-neutral-300">Office 结构级擦除：</strong>支持 DOCX 页眉页脚背景图、XLSX 工作表平铺水印对象深度剥离。</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-amber-500 mt-0.5 font-bold">•</span>
                  <span><strong className="text-neutral-700 dark:text-neutral-300">100% 纯本地隐私：</strong>全流程在浏览器本地内存运行，绝不上传文件至任何服务器。</span>
                </li>
              </ul>
            </div>

            {/* Progress Status Indicator */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-neutral-500 font-medium">引擎联调进度</span>
                <span className="text-amber-600 dark:text-amber-400 font-bold font-mono">85% 内部测试中</span>
              </div>
              <div className="w-full h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full w-[85%] transition-all duration-500" />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-2 pt-1">
              {onOpenWatermarkStudio && (
                <button
                  type="button"
                  id="btn-watermark-dev-preview-prototype"
                  onClick={() => {
                    setShowWatermarkDevModal(false);
                    onOpenWatermarkStudio();
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  title="体验当前实验室测试原型"
                >
                  预览实验室原型
                </button>
              )}
              <button
                type="button"
                id="btn-watermark-dev-confirm"
                onClick={() => setShowWatermarkDevModal(false)}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-all shadow-xs"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
