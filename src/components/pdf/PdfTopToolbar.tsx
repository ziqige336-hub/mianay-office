import React, { useRef } from 'react';
import {
  MousePointer,
  Hand,
  Type,
  Highlighter,
  Search,
  Replace,
  Image as ImageIcon,
  Square,
  Circle,
  ArrowRight,
  Minus,
  Table,
  Plus,
  Copy,
  RotateCw,
  Trash2,
  Crop,
  Layers,
  Scissors,
  Underline,
  Strikethrough,
  PenTool,
  MessageSquare,
  PenLine,
  Stamp,
  CheckSquare,
  FormInput,
  Radio,
  FileCheck,
  EyeOff,
  Lock,
  FileText,
  FileSpreadsheet,
  Sparkles,
  Archive,
  Ruler,
  FileDown,
  FolderInput,
  ZoomIn,
  ZoomOut,
  Undo2,
  Redo2,
  Scan,
  Save,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import type {
  PdfToolbarCategory,
  PdfToolMode,
  PdfViewMode,
} from '../../types';
import { CommandInput, commandDispatcher } from '../../core/commands';

interface PdfTopToolbarProps {
  activeCategory: PdfToolbarCategory;
  onChangeCategory: (cat: PdfToolbarCategory) => void;
  toolMode: PdfToolMode;
  viewMode?: PdfViewMode;
  zoom?: number;
  canUndo: boolean;
  canRedo: boolean;
  saveStatus?: 'saved' | 'saving' | 'unsaved';
  onSave?: () => void;
  /** Primary command dispatching function */
  dispatch?: (command: CommandInput) => void;

  // Optional legacy props maintained for compatibility
  onSelectToolMode?: (mode: PdfToolMode) => void;
  onChangeViewMode?: (mode: PdfViewMode) => void;
  onChangeZoom?: (zoom: number) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onOpenSearch?: () => void;
  onOpenReplace?: () => void;
  onInsertImageFile?: (file: File) => void;
  onInsertBlankPage?: () => void;
  onRotateCurrentPage?: (deg: number) => void;
  onDeleteCurrentPage?: () => void;
  onDuplicateCurrentPage?: () => void;
  onAutoTrimPage?: () => void;
  onOpenMergeSplit?: (mode: 'merge' | 'split') => void;
  onOpenSignatureModal?: () => void;
  onOpenStampModal?: () => void;
  onOpenWatermarkModal?: () => void;
  onOpenSecurityModal?: () => void;
  onToggleWatermarkPanel?: () => void;
  onOpenConvertModal?: (targetType?: string) => void;
  onOpenOcrModal?: () => void;
  onOpenCompressModal?: () => void;
  onOpenMeasureModal?: () => void;
  onOpenBatchExtractModal?: () => void;
}

export const PdfTopToolbar: React.FC<PdfTopToolbarProps> = ({
  activeCategory,
  onChangeCategory,
  toolMode,
  viewMode,
  zoom,
  canUndo,
  canRedo,
  saveStatus = 'saved',
  onSave,
  dispatch,
}) => {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const openFileInputRef = useRef<HTMLInputElement>(null);

  const internalDispatch = (input: CommandInput) => {
    if (dispatch) {
      dispatch(input);
    } else {
      commandDispatcher.dispatch(input);
    }
  };

  const categories: { id: PdfToolbarCategory; label: string }[] = [
    { id: 'home', label: '开始' },
    { id: 'edit', label: '编辑' },
    { id: 'page', label: '页面' },
    { id: 'merge-split', label: '合并/拆分' },
    { id: 'comment', label: '批注' },
    { id: 'sign', label: '签名/填表' },
    { id: 'security', label: '保护' },
    { id: 'convert', label: '转换' },
    { id: 'tools', label: '工具' },
  ];

  return (
    <div className="flex flex-col border-b border-black/[0.08] dark:border-neutral-700 bg-white/95 dark:bg-neutral-800 backdrop-blur-md select-none shrink-0 relative z-50 overflow-visible">
      {/* Hidden file input for opening local PDF files */}
      <input
        type="file"
        ref={openFileInputRef}
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            internalDispatch({
              type: 'OPEN_DOCUMENT',
              payload: { file },
              metadata: { source: 'toolbar' },
            });
            e.target.value = '';
          }
        }}
      />

      {/* Hidden file input for inserting images */}
      <input
        type="file"
        ref={imageInputRef}
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            internalDispatch({
              type: 'PDF_INSERT_IMAGE',
              payload: { file },
              metadata: { source: 'toolbar' },
            });
            e.target.value = '';
          }
        }}
      />

      {/* Row 1: Category Tabs + Top Quick Actions */}
      <div className="flex items-center justify-between px-3 pt-1 pb-0.5 border-b border-black/[0.04] dark:border-white/[0.04]">
        {/* Category Tabs */}
        <div className="flex items-center space-x-1">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onChangeCategory(cat.id)}
              className={`px-3 py-1 text-xs font-medium rounded-t-lg transition-all relative ${
                activeCategory === cat.id
                  ? 'text-blue-600 dark:text-blue-400 font-semibold bg-black/[0.03] dark:bg-white/[0.05]'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              {cat.label}
              {activeCategory === cat.id && (
                <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Global Quick Actions: Undo, Redo */}
        <div className="flex items-center space-x-1.5 pb-0.5">
          <button
            onClick={() => internalDispatch('PDF_UNDO')}
            disabled={!canUndo}
            className="p-1 rounded text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black/[0.05] transition-colors"
            title="撤销 (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => internalDispatch('PDF_REDO')}
            disabled={!canRedo}
            className="p-1 rounded text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black/[0.05] transition-colors"
            title="重做 (Ctrl+Y)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Row 2: Secondary Tool Controls for Active Category */}
      <div className="flex items-center justify-between px-3 py-1.5 min-h-[38px] bg-neutral-50/60 dark:bg-[#1a1a1c]/60">
        <div className="flex items-center flex-wrap gap-1">
          {/* 1. HOME CATEGORY */}
          {activeCategory === 'home' && (
            <div className="flex items-center flex-wrap gap-1">
              <button
                onClick={() => internalDispatch({ type: 'PDF_SET_TOOL_MODE', payload: { mode: 'select' } })}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all ${
                  toolMode === 'select'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-black/[0.04] dark:bg-white/[0.06] text-neutral-800 dark:text-neutral-200 hover:bg-black/[0.08]'
                }`}
              >
                <MousePointer className="w-3.5 h-3.5" />
                <span>选择</span>
              </button>

              <button
                onClick={() => internalDispatch({ type: 'PDF_SET_TOOL_MODE', payload: { mode: 'hand' } })}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all ${
                  toolMode === 'hand'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-black/[0.04] dark:bg-white/[0.06] text-neutral-800 dark:text-neutral-200 hover:bg-black/[0.08]'
                }`}
              >
                <Hand className="w-3.5 h-3.5" />
                <span>抓手浏览</span>
              </button>

              <div className="w-[1px] h-4 bg-neutral-300 dark:bg-neutral-700 mx-1" />

              <button
                onClick={() => internalDispatch({ type: 'PDF_EDIT_TEXT' })}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all ${
                  toolMode === 'text'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-black/[0.04] dark:bg-white/[0.06] text-neutral-800 dark:text-neutral-200 hover:bg-black/[0.08]'
                }`}
              >
                <Type className="w-3.5 h-3.5" />
                <span>编辑/添加文字</span>
              </button>

              <button
                onClick={() => internalDispatch({ type: 'PDF_SET_TOOL_MODE', payload: { mode: 'highlight' } })}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all ${
                  toolMode === 'highlight'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-black/[0.04] dark:bg-white/[0.06] text-neutral-800 dark:text-neutral-200 hover:bg-black/[0.08]'
                }`}
              >
                <Highlighter className="w-3.5 h-3.5 text-amber-500 group-hover:text-amber-600" />
                <span>高亮标记</span>
              </button>

              <div className="w-[1px] h-4 bg-neutral-300 dark:bg-neutral-700 mx-1" />

              <button
                onClick={() => internalDispatch({ type: 'PDF_SEARCH' })}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] text-neutral-800 dark:text-neutral-200 flex items-center space-x-1.5"
                title="页面文字查找 (Ctrl+F)"
              >
                <Search className="w-3.5 h-3.5 text-neutral-500" />
                <span>页面查找</span>
              </button>

              <button
                onClick={() => internalDispatch({ type: 'PDF_SEARCH', payload: { replace: true } })}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] text-neutral-800 dark:text-neutral-200 flex items-center space-x-1.5"
                title="批量搜索与替换 (Ctrl+H)"
              >
                <Replace className="w-3.5 h-3.5 text-blue-500" />
                <span>批量替换</span>
              </button>
            </div>
          )}

          {/* 2. EDIT CATEGORY */}
          {activeCategory === 'edit' && (
            <div className="flex items-center flex-wrap gap-1">
              <button
                onClick={() => internalDispatch({ type: 'PDF_EDIT_TEXT' })}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all ${
                  toolMode === 'text'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-black/[0.04] text-neutral-800 dark:text-neutral-200 hover:bg-black/[0.08]'
                }`}
              >
                <Type className="w-3.5 h-3.5" />
                <span>添加/编辑文本</span>
              </button>

              <button
                onClick={() => imageInputRef.current?.click()}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-black/[0.04] hover:bg-black/[0.08] text-neutral-800 dark:text-neutral-200 flex items-center space-x-1.5"
              >
                <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
                <span>插入图片</span>
              </button>

              <div className="w-[1px] h-4 bg-neutral-300 dark:bg-neutral-700 mx-1" />

              {/* Shape Tools */}
              <button
                onClick={() => internalDispatch({ type: 'PDF_INSERT_SHAPE', payload: { shapeType: 'rect' } })}
                className={`p-1.5 rounded-lg text-xs ${
                  toolMode === 'rect' ? 'bg-blue-600 text-white' : 'bg-black/[0.04] text-neutral-700 hover:bg-black/[0.08]'
                }`}
                title="插入矩形"
              >
                <Square className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => internalDispatch({ type: 'PDF_INSERT_SHAPE', payload: { shapeType: 'circle' } })}
                className={`p-1.5 rounded-lg text-xs ${
                  toolMode === 'circle' ? 'bg-blue-600 text-white' : 'bg-black/[0.04] text-neutral-700 hover:bg-black/[0.08]'
                }`}
                title="插入圆形/椭圆"
              >
                <Circle className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => internalDispatch({ type: 'PDF_INSERT_SHAPE', payload: { shapeType: 'arrow' } })}
                className={`p-1.5 rounded-lg text-xs ${
                  toolMode === 'arrow' ? 'bg-blue-600 text-white' : 'bg-black/[0.04] text-neutral-700 hover:bg-black/[0.08]'
                }`}
                title="插入指示箭头"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => internalDispatch({ type: 'PDF_INSERT_SHAPE', payload: { shapeType: 'line' } })}
                className={`p-1.5 rounded-lg text-xs ${
                  toolMode === 'line' ? 'bg-blue-600 text-white' : 'bg-black/[0.04] text-neutral-700 hover:bg-black/[0.08]'
                }`}
                title="插入直线"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => internalDispatch({ type: 'PDF_INSERT_SHAPE', payload: { shapeType: 'table' } })}
                className="px-2 py-1 rounded-lg text-xs font-medium bg-black/[0.04] hover:bg-black/[0.08] text-neutral-800 dark:text-neutral-200 flex items-center space-x-1"
                title="插入表格"
              >
                <Table className="w-3.5 h-3.5 text-blue-500" />
                <span>插入表格</span>
              </button>
            </div>
          )}

          {/* 3. PAGE CATEGORY */}
          {activeCategory === 'page' && (
            <div className="flex items-center flex-wrap gap-1">
              <button
                onClick={() => internalDispatch('PDF_INSERT_BLANK_PAGE')}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-black/[0.04] hover:bg-black/[0.08] text-neutral-800 dark:text-neutral-200 flex items-center space-x-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-blue-500" />
                <span>插入空白页</span>
              </button>

              <button
                onClick={() => internalDispatch('PDF_DUPLICATE_PAGE')}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-black/[0.04] hover:bg-black/[0.08] text-neutral-800 dark:text-neutral-200 flex items-center space-x-1.5"
              >
                <Copy className="w-3.5 h-3.5 text-neutral-500" />
                <span>复制当前页</span>
              </button>

              <button
                onClick={() => internalDispatch({ type: 'PDF_ROTATE_PAGE', payload: { angle: 90 } })}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-black/[0.04] hover:bg-black/[0.08] text-neutral-800 dark:text-neutral-200 flex items-center space-x-1.5"
              >
                <RotateCw className="w-3.5 h-3.5 text-emerald-500" />
                <span>向右旋转 90°</span>
              </button>

              <button
                onClick={() => internalDispatch('PDF_DELETE_PAGE')}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 flex items-center space-x-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>删除当前页</span>
              </button>

              <div className="w-[1px] h-4 bg-neutral-300 dark:bg-neutral-700 mx-1" />

              <button
                onClick={() => internalDispatch('PDF_AUTO_TRIM_PAGE')}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-black/[0.04] hover:bg-black/[0.08] text-neutral-800 dark:text-neutral-200 flex items-center space-x-1.5"
                title="智能侦测内容边界并裁剪冗余白边"
              >
                <Crop className="w-3.5 h-3.5 text-indigo-500" />
                <span>智能去白边 (Auto Trim)</span>
              </button>
            </div>
          )}

          {/* 4. MERGE & SPLIT CATEGORY */}
          {activeCategory === 'merge-split' && (
            <div className="flex items-center flex-wrap gap-1.5">
              <button
                onClick={() => internalDispatch('PDF_MERGE')}
                className="px-3 py-1 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 flex items-center space-x-1.5"
              >
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>合并多份 PDF</span>
              </button>

              <button
                onClick={() => internalDispatch('PDF_SPLIT')}
                className="px-3 py-1 rounded-lg text-xs font-medium bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 flex items-center space-x-1.5"
              >
                <Scissors className="w-3.5 h-3.5 text-indigo-600" />
                <span>按页拆分 PDF</span>
              </button>
            </div>
          )}

          {/* 5. COMMENT CATEGORY */}
          {activeCategory === 'comment' && (
            <div className="flex items-center flex-wrap gap-1">
              <button
                onClick={() => internalDispatch({ type: 'PDF_SET_TOOL_MODE', payload: { mode: 'highlight' } })}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all ${
                  toolMode === 'highlight'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-black/[0.04] text-neutral-800 dark:text-neutral-200'
                }`}
              >
                <Highlighter className="w-3.5 h-3.5 text-amber-500" />
                <span>高亮</span>
              </button>

              <button
                onClick={() => internalDispatch({ type: 'PDF_SET_TOOL_MODE', payload: { mode: 'underline' } })}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all ${
                  toolMode === 'underline'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-black/[0.04] text-neutral-800 dark:text-neutral-200'
                }`}
              >
                <Underline className="w-3.5 h-3.5 text-blue-500" />
                <span>下划线</span>
              </button>

              <button
                onClick={() => internalDispatch({ type: 'PDF_SET_TOOL_MODE', payload: { mode: 'strikethrough' } })}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all ${
                  toolMode === 'strikethrough'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-black/[0.04] text-neutral-800 dark:text-neutral-200'
                }`}
              >
                <Strikethrough className="w-3.5 h-3.5 text-rose-500" />
                <span>删除线</span>
              </button>

              <div className="w-[1px] h-4 bg-neutral-300 dark:bg-neutral-700 mx-1" />

              <button
                onClick={() => internalDispatch({ type: 'PDF_SET_TOOL_MODE', payload: { mode: 'draw' } })}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all ${
                  toolMode === 'draw'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-black/[0.04] text-neutral-800 dark:text-neutral-200'
                }`}
              >
                <PenTool className="w-3.5 h-3.5 text-purple-500" />
                <span>手绘笔</span>
              </button>

              <button
                onClick={() => internalDispatch({ type: 'PDF_SET_TOOL_MODE', payload: { mode: 'comment' } })}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all ${
                  toolMode === 'comment'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-black/[0.04] text-neutral-800 dark:text-neutral-200'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                <span>便签评论</span>
              </button>
            </div>
          )}

          {/* 6. SIGN & FORM CATEGORY */}
          {activeCategory === 'sign' && (
            <div className="flex items-center flex-wrap gap-1">
              <button
                onClick={() => internalDispatch('PDF_INSERT_SIGNATURE')}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-black/[0.04] hover:bg-black/[0.08] text-neutral-800 dark:text-neutral-200 flex items-center space-x-1.5"
              >
                <PenLine className="w-3.5 h-3.5 text-blue-500" />
                <span>手写签名</span>
              </button>

              <button
                onClick={() => internalDispatch('PDF_INSERT_STAMP')}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-black/[0.04] hover:bg-black/[0.08] text-neutral-800 dark:text-neutral-200 flex items-center space-x-1.5"
              >
                <Stamp className="w-3.5 h-3.5 text-rose-500" />
                <span>印章图章</span>
              </button>

              <div className="w-[1px] h-4 bg-neutral-300 dark:bg-neutral-700 mx-1" />

              <span className="text-[11px] text-neutral-400 font-medium px-1">表单域:</span>

              <button
                onClick={() => internalDispatch({ type: 'PDF_INSERT_FORM', payload: { formType: 'form-text' } })}
                className="px-2 py-1 rounded-lg text-xs font-medium bg-black/[0.04] hover:bg-black/[0.08] text-neutral-800 dark:text-neutral-200 flex items-center space-x-1"
              >
                <FormInput className="w-3 h-3 text-blue-500" />
                <span>文本框</span>
              </button>

              <button
                onClick={() => internalDispatch({ type: 'PDF_INSERT_FORM', payload: { formType: 'form-checkbox' } })}
                className="px-2 py-1 rounded-lg text-xs font-medium bg-black/[0.04] hover:bg-black/[0.08] text-neutral-800 dark:text-neutral-200 flex items-center space-x-1"
              >
                <CheckSquare className="w-3 h-3 text-emerald-500" />
                <span>复选框</span>
              </button>

              <button
                onClick={() => internalDispatch({ type: 'PDF_INSERT_FORM', payload: { formType: 'form-radio' } })}
                className="px-2 py-1 rounded-lg text-xs font-medium bg-black/[0.04] hover:bg-black/[0.08] text-neutral-800 dark:text-neutral-200 flex items-center space-x-1"
              >
                <Radio className="w-3 h-3 text-purple-500" />
                <span>单选按钮</span>
              </button>
            </div>
          )}

          {/* 7. SECURITY CATEGORY */}
          {activeCategory === 'security' && (
            <div className="flex items-center flex-wrap gap-1.5">
              <button
                onClick={() => internalDispatch('PDF_WATERMARK')}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-black/[0.04] hover:bg-black/[0.08] text-neutral-800 dark:text-neutral-200 flex items-center space-x-1.5"
              >
                <FileCheck className="w-3.5 h-3.5 text-blue-500" />
                <span>添加水印</span>
              </button>

              <button
                onClick={() => internalDispatch('PDF_WATERMARK_PANEL')}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 flex items-center space-x-1.5"
                title="展开水印深度扫描与一键抹除面板"
              >
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>水印侦测与抹除</span>
              </button>

              <button
                onClick={() => internalDispatch({ type: 'PDF_SET_TOOL_MODE', payload: { mode: 'redact' } })}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all ${
                  toolMode === 'redact'
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs font-semibold'
                    : 'bg-black/[0.04] text-neutral-800 dark:text-neutral-200'
                }`}
                title="永久密文遮盖 (清除底层数据)"
              >
                <EyeOff className="w-3.5 h-3.5" />
                <span>密文抹除 (Redact)</span>
              </button>

              <button
                onClick={() => internalDispatch('PDF_SECURITY')}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-black/[0.04] hover:bg-black/[0.08] text-neutral-800 dark:text-neutral-200 flex items-center space-x-1.5"
              >
                <Lock className="w-3.5 h-3.5 text-rose-500" />
                <span>加密与权限控制</span>
              </button>
            </div>
          )}

          {/* 8. CONVERT CATEGORY */}
          {activeCategory === 'convert' && (
            <div className="flex items-center flex-wrap gap-1.5">
              <button
                onClick={() => internalDispatch('PDF_CONVERT_WORD')}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 flex items-center space-x-1"
              >
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>转 Word (.docx)</span>
              </button>

              <button
                onClick={() => internalDispatch('PDF_CONVERT_EXCEL')}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 flex items-center space-x-1"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>转 Excel (.xlsx)</span>
              </button>

              <button
                onClick={() => internalDispatch('PDF_EXPORT_IMAGE')}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 flex items-center space-x-1"
              >
                <ImageIcon className="w-3.5 h-3.5 text-amber-600" />
                <span>转图片 (72~600 DPI)</span>
              </button>

              <button
                onClick={() => internalDispatch('PDF_CONVERT_SCANNED')}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 flex items-center space-x-1"
              >
                <Scan className="w-3.5 h-3.5 text-purple-600" />
                <span>转扫描型 PDF (防篡改)</span>
              </button>

              <button
                onClick={() => internalDispatch('PDF_OCR')}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 flex items-center space-x-1"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>OCR 文字识别</span>
              </button>
            </div>
          )}

          {/* 9. TOOLS CATEGORY */}
          {activeCategory === 'tools' && (
            <div className="flex items-center flex-wrap gap-1.5">
              <button
                onClick={() => internalDispatch('PDF_COMPRESS')}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-black/[0.04] hover:bg-black/[0.08] text-neutral-800 dark:text-neutral-200 flex items-center space-x-1.5"
              >
                <Archive className="w-3.5 h-3.5 text-blue-600" />
                <span>PDF 极致压缩</span>
              </button>

              <button
                onClick={() => internalDispatch('PDF_MEASURE')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all ${
                  toolMode === 'measure-distance' || toolMode === 'measure-area'
                    ? 'bg-blue-600 text-white'
                    : 'bg-black/[0.04] text-neutral-800 dark:text-neutral-200'
                }`}
              >
                <Ruler className="w-3.5 h-3.5 text-amber-500" />
                <span>图纸测量 (距离/面积)</span>
              </button>

              {/* Distinct Separate Command Buttons for Extract Text and Extract Image */}
              <button
                onClick={() => internalDispatch('PDF_EXTRACT_TEXT')}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-black/[0.04] hover:bg-black/[0.08] text-neutral-800 dark:text-neutral-200 flex items-center space-x-1"
                title="提取文档全部文字并导出 TXT / MD / JSON"
              >
                <FileText className="w-3.5 h-3.5 text-indigo-500" />
                <span>提取文字</span>
              </button>

              <button
                onClick={() => internalDispatch('PDF_EXTRACT_IMAGE')}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-black/[0.04] hover:bg-black/[0.08] text-neutral-800 dark:text-neutral-200 flex items-center space-x-1"
                title="提取文档所有内嵌图像资源为 ZIP"
              >
                <ImageIcon className="w-3.5 h-3.5 text-amber-500" />
                <span>提取图片</span>
              </button>
            </div>
          )}
        </div>

        {/* Right: Save status and Save button */}
        <div className="flex items-center space-x-2 shrink-0 pl-2">
          {/* Save Status Indicator */}
          <div
            id="pdf-toolbar-save-status"
            className="flex items-center space-x-1.5 text-[11px] px-2 py-1 rounded-md select-none text-neutral-500 dark:text-neutral-400 transition-colors"
            title={
              saveStatus === 'saved'
                ? '所有更改已实时存入本地沙箱'
                : saveStatus === 'saving'
                ? '正在保存文档...'
                : '有未保存的修改'
            }
          >
            {saveStatus === 'saved' ? (
              <span className="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">已保存</span>
              </span>
            ) : saveStatus === 'saving' ? (
              <span className="flex items-center space-x-1 text-blue-600 dark:text-blue-400 font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="hidden sm:inline">保存中...</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1 text-amber-600 dark:text-amber-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="hidden sm:inline">未保存</span>
              </span>
            )}
          </div>

          {/* Save Button */}
          <button
            id="pdf-quick-save-btn"
            onClick={onSave || (() => internalDispatch('SAVE_DOCUMENT'))}
            disabled={saveStatus === 'saving'}
            className="flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-all shadow-xs cursor-pointer select-none"
            title="保存文档 (Ctrl/Cmd + S)"
          >
            {saveStatus === 'saving' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>保存</span>
          </button>
        </div>
      </div>
    </div>
  );
};
