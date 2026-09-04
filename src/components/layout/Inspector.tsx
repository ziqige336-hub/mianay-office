import React, { useState } from 'react';
import {
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Table as TableIcon,
  Plus,
  Trash2,
  List,
  ListOrdered,
  Quote,
  Palette,
  Layers,
  Sliders,
  DollarSign,
  Percent,
  Calendar,
  Hash,
  Sparkles,
  RotateCw,
  Copy,
  FileText,
  FileCode,
  Check,
  ChevronRight,
  History,
  RotateCcw,
  Clock,
  Superscript as SuperIcon,
  Subscript as SubIcon,
} from 'lucide-react';
import type { AppModule, VersionHistoryItem, OfficeFile } from '../../types';
import {
  FontSizeControl,
  FontFamilyControl,
  TextColorPicker,
  HighlightPicker,
  HierarchyDropdown,
  LineSpacingControl,
  ChineseTypographyControl,
  ShadingControl,
  BorderControl,
  TableMenuControl,
  WPS_FONT_SIZES,
} from '../doc/DocFormatControls';
import { Indent as IndentIcon, Outdent as OutdentIcon } from 'lucide-react';

interface InspectorProps {
  activeModule: AppModule;
  isOpen: boolean;
  onToggle: () => void;
  activeFile?: OfficeFile | null;
  onRestoreVersion?: (version: VersionHistoryItem) => void;
  // Doc props
  docEditor?: any;
  docStats?: { characters: number; words: number };
  // Sheet props
  selectedSheetCell?: { r: number; c: number; cellData?: any; coordLabel: string };
  onUpdateSheetFormat?: (key: string, value: any) => void;
  onInsertSheetFormula?: (formulaName: string) => void;
  // PDF props
  selectedPdfAnnotation?: any;
  onUpdatePdfAnnotation?: (id: string, updates: any) => void;
  onDeletePdfAnnotation?: (id: string) => void;
  currentPageMeta?: any;
  onRotateCurrentPdfPage?: (deg: number) => void;
  onDeleteCurrentPdfPage?: () => void;
  // Tools props
  ocrLanguage?: string;
  onChangeOcrLanguage?: (lang: string) => void;
  onExportOcrToDoc?: (text: string) => void;
  lastOcrText?: string;
}

export const Inspector: React.FC<InspectorProps> = ({
  activeModule,
  isOpen,
  onToggle,
  activeFile,
  onRestoreVersion,
  docEditor,
  docStats,
  selectedSheetCell,
  onUpdateSheetFormat,
  onInsertSheetFormula,
  selectedPdfAnnotation,
  onUpdatePdfAnnotation,
  onDeletePdfAnnotation,
  currentPageMeta,
  onRotateCurrentPdfPage,
  onDeleteCurrentPdfPage,
  ocrLanguage = 'chi_sim+eng',
  onChangeOcrLanguage,
  onExportOcrToDoc,
  lastOcrText,
}) => {
  const [inspectorTab, setInspectorTab] = useState<'properties' | 'history'>('properties');
  const [docFontSizePt, setDocFontSizePt] = useState<number>(12);

  if (!isOpen) return null;

  const formatVersionTime = (timestamp: number) => {
    const d = new Date(timestamp);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  };

  const handleDocFontSize = (pt: number) => {
    setDocFontSizePt(pt);
    if (!docEditor) return;
    const px = Math.round(pt * 1.333);
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      document.execCommand('fontSize', false, '3');
      const fontElements = document.getElementsByTagName('font');
      for (let i = 0; i < fontElements.length; i++) {
        if (fontElements[i].getAttribute('size') === '3') {
          fontElements[i].removeAttribute('size');
          fontElements[i].style.fontSize = `${px}px`;
        }
      }
    }
  };

  return (
    <aside
      id="lumina-inspector"
      className="w-72 shrink-0 h-full min-h-0 bg-white/95 dark:bg-neutral-800/95 backdrop-blur-2xl border-l border-neutral-200/80 dark:border-neutral-700 flex flex-col justify-between select-none z-20 text-xs text-neutral-800 dark:text-neutral-200 transition-all"
    >
      {/* Header & Tabs */}
      <div className="border-b border-neutral-200/70 dark:border-neutral-700">
        <div className="h-10 px-4 flex items-center justify-between">
          <div className="flex items-center space-x-2 font-semibold text-neutral-700 dark:text-neutral-300">
            <Sliders className="w-3.5 h-3.5 text-blue-500" />
            <span>检查器 (Inspector)</span>
          </div>
          <button
            onClick={onToggle}
            title="收起检查器 (Cmd+Alt+I)"
            className="p-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switch: Properties vs Version History */}
        <div className="px-3 pb-2 flex items-center space-x-1">
          <button
            onClick={() => setInspectorTab('properties')}
            className={`flex-1 py-1 rounded-lg text-center font-medium transition-colors ${
              inspectorTab === 'properties'
                ? 'bg-neutral-100 dark:bg-neutral-800 text-blue-600 dark:text-blue-400 font-semibold'
                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            属性与格式
          </button>
          <button
            onClick={() => setInspectorTab('history')}
            className={`flex-1 py-1 rounded-lg text-center font-medium transition-colors flex items-center justify-center space-x-1 ${
              inspectorTab === 'history'
                ? 'bg-neutral-100 dark:bg-neutral-800 text-blue-600 dark:text-blue-400 font-semibold'
                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <History className="w-3 h-3" />
            <span>历史版本</span>
          </button>
        </div>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {inspectorTab === 'history' ? (
          /* ==================== VERSION HISTORY TAB ==================== */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                保存检查点记录
              </span>
              <span className="text-[10px] text-neutral-400 font-mono">
                {activeFile?.versionHistory?.length || 1} 个存档
              </span>
            </div>

            {(!activeFile?.versionHistory || activeFile.versionHistory.length === 0) ? (
              <div className="p-6 text-center text-neutral-400">
                <Clock className="w-6 h-6 mx-auto mb-2 opacity-50" />
                <p className="text-xs">暂无历史版本存档</p>
                <p className="text-[10px] text-neutral-400 mt-1">编辑时自动生成沙箱检查点</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activeFile.versionHistory.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200/70 dark:border-neutral-700/60 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-neutral-800 dark:text-neutral-200">
                        {idx === 0 ? '最新版本 (当前)' : `历史存档 #${activeFile.versionHistory!.length - idx}`}
                      </span>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        {formatVersionTime(item.timestamp)}
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-500 line-clamp-1">
                      {item.summary || '文档内容修订'}
                    </div>
                    {idx > 0 && onRestoreVersion && (
                      <div className="pt-1 flex justify-end">
                        <button
                          onClick={() => onRestoreVersion(item)}
                          className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 text-[10px] font-semibold hover:bg-blue-100"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>回滚到此版本</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ==================== PROPERTIES TAB ==================== */
          <>
            {/* DOC PROPERTIES */}
            {activeModule === 'doc' && docEditor && (
              <div className="space-y-4">
                {/* 1. Hierarchy */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                    段落层级
                  </div>
                  <HierarchyDropdown editor={docEditor} />
                </div>

                {/* 2. Font & WPS Size */}
                <div className="space-y-2.5 pt-3 border-t border-neutral-200/60 dark:border-neutral-800">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                    字体与字号 (WPS 标准)
                  </div>

                  {/* 字体 (移除“族”) + 系统字体动态读取 */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-medium text-neutral-600 dark:text-neutral-300">字体</label>
                    <div className="w-full">
                      <FontFamilyControl
                        currentFont={docEditor.getAttributes('textStyle').fontFamily || 'PingFang SC'}
                        onSetFont={(font) => docEditor.chain().focus().setFontFamily(font).run()}
                      />
                    </div>
                  </div>

                  {/* WPS Font Size and A+/A- */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-medium text-neutral-600 dark:text-neutral-300">字号大小</label>
                    <div className="flex items-center justify-between">
                      <FontSizeControl
                        currentPt={
                          parseFloat(docEditor.getAttributes('textStyle').fontSize) || docFontSizePt
                        }
                        onSetSize={(pt) => {
                          setDocFontSizePt(pt);
                          (docEditor.chain().focus() as any).setFontSize(`${pt}pt`).run();
                        }}
                      />
                    </div>
                  </div>

                  {/* Colors: Text, Highlight, Shading */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-medium text-neutral-600 dark:text-neutral-300">颜色与底纹</label>
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-1">
                        <span className="text-[10px] text-neutral-400">文字:</span>
                        <TextColorPicker
                          currentColor={docEditor.getAttributes('textStyle').color || '#111827'}
                          onSetColor={(c) => docEditor.chain().focus().setColor(c).run()}
                        />
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className="text-[10px] text-neutral-400">荧光笔:</span>
                        <HighlightPicker
                          currentBg={docEditor.getAttributes('highlight')?.color}
                          onSetBg={(c) => {
                            if (c) docEditor.chain().focus().setHighlight({ color: c }).run();
                            else docEditor.chain().focus().unsetHighlight().run();
                          }}
                        />
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className="text-[10px] text-neutral-400">底纹:</span>
                        <ShadingControl editor={docEditor} />
                      </div>
                    </div>
                  </div>

                  {/* Text styles */}
                  <div className="space-y-1 pt-1">
                    <label className="text-[10px] font-medium text-neutral-600 dark:text-neutral-300">文字修饰</label>
                    <div className="flex items-center space-x-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg border border-neutral-200 dark:border-neutral-700">
                      <button
                        onClick={() => docEditor.chain().focus().toggleBold().run()}
                        className={`p-1.5 rounded flex-1 flex justify-center transition-colors ${
                          docEditor.isActive('bold')
                            ? 'bg-white dark:bg-neutral-700 text-blue-600 shadow-xs'
                            : 'text-neutral-600 dark:text-neutral-400'
                        }`}
                        title="加粗 (Ctrl+B)"
                      >
                        <Bold className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => docEditor.chain().focus().toggleItalic().run()}
                        className={`p-1.5 rounded flex-1 flex justify-center transition-colors ${
                          docEditor.isActive('italic')
                            ? 'bg-white dark:bg-neutral-700 text-blue-600 shadow-xs'
                            : 'text-neutral-600 dark:text-neutral-400'
                        }`}
                        title="倾斜 (Ctrl+I)"
                      >
                        <Italic className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => docEditor.chain().focus().toggleUnderline().run()}
                        className={`p-1.5 rounded flex-1 flex justify-center transition-colors ${
                          docEditor.isActive('underline')
                            ? 'bg-white dark:bg-neutral-700 text-blue-600 shadow-xs'
                            : 'text-neutral-600 dark:text-neutral-400'
                        }`}
                        title="下划线 (Ctrl+U)"
                      >
                        <Underline className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => docEditor.chain().focus().toggleStrike().run()}
                        className={`p-1.5 rounded flex-1 flex justify-center transition-colors ${
                          docEditor.isActive('strike')
                            ? 'bg-white dark:bg-neutral-700 text-blue-600 shadow-xs'
                            : 'text-neutral-600 dark:text-neutral-400'
                        }`}
                        title="删除线"
                      >
                        <Strikethrough className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => docEditor.chain().focus().toggleCode().run()}
                        className={`p-1.5 rounded flex-1 flex justify-center transition-colors ${
                          docEditor.isActive('code')
                            ? 'bg-white dark:bg-neutral-700 text-blue-600 shadow-xs'
                            : 'text-neutral-600 dark:text-neutral-400'
                        }`}
                        title="行内代码"
                      >
                        <Code className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => docEditor.chain().focus().toggleSuperscript().run()}
                        className={`p-1.5 rounded flex-1 flex justify-center transition-colors ${
                          docEditor.isActive('superscript')
                            ? 'bg-white dark:bg-neutral-700 text-blue-600 shadow-xs'
                            : 'text-neutral-600 dark:text-neutral-400'
                        }`}
                        title="上标 (X²)"
                      >
                        <SuperIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => docEditor.chain().focus().toggleSubscript().run()}
                        className={`p-1.5 rounded flex-1 flex justify-center transition-colors ${
                          docEditor.isActive('subscript')
                            ? 'bg-white dark:bg-neutral-700 text-blue-600 shadow-xs'
                            : 'text-neutral-600 dark:text-neutral-400'
                        }`}
                        title="下标 (X₂)"
                      >
                        <SubIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3. 段落对齐与分散对齐 */}
                <div className="space-y-2.5 pt-3 border-t border-neutral-200/60 dark:border-neutral-800">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                    对齐与排版
                  </div>

                  <div className="flex items-center space-x-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg border border-neutral-200 dark:border-neutral-700">
                    <button
                      onClick={() => docEditor.chain().focus().setTextAlign('left').run()}
                      className={`p-1.5 rounded flex-1 flex justify-center ${
                        docEditor.isActive({ textAlign: 'left' })
                          ? 'bg-white dark:bg-neutral-700 text-blue-600 shadow-xs'
                          : 'text-neutral-600 dark:text-neutral-400'
                      }`}
                      title="左对齐"
                    >
                      <AlignLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => docEditor.chain().focus().setTextAlign('center').run()}
                      className={`p-1.5 rounded flex-1 flex justify-center ${
                        docEditor.isActive({ textAlign: 'center' })
                          ? 'bg-white dark:bg-neutral-700 text-blue-600 shadow-xs'
                          : 'text-neutral-600 dark:text-neutral-400'
                      }`}
                      title="居中对齐"
                    >
                      <AlignCenter className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => docEditor.chain().focus().setTextAlign('right').run()}
                      className={`p-1.5 rounded flex-1 flex justify-center ${
                        docEditor.isActive({ textAlign: 'right' })
                          ? 'bg-white dark:bg-neutral-700 text-blue-600 shadow-xs'
                          : 'text-neutral-600 dark:text-neutral-400'
                      }`}
                      title="右对齐"
                    >
                      <AlignRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => docEditor.chain().focus().setTextAlign('justify').run()}
                      className={`p-1.5 rounded flex-1 flex justify-center ${
                        docEditor.isActive({ textAlign: 'justify' })
                          ? 'bg-white dark:bg-neutral-700 text-blue-600 shadow-xs'
                          : 'text-neutral-600 dark:text-neutral-400'
                      }`}
                      title="两端对齐"
                    >
                      <AlignJustify className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        docEditor.chain().focus().setTextAlign('justify').run();
                        const sel = window.getSelection();
                        if (sel && sel.anchorNode) {
                          let el = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : (sel.anchorNode as HTMLElement);
                          while (el && !['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(el.tagName)) {
                            el = el.parentElement;
                          }
                          if (el) {
                            el.style.textAlign = 'justify';
                            (el.style as any).textAlignLast = 'justify';
                          }
                        }
                      }}
                      className="px-1.5 py-1 rounded text-neutral-600 dark:text-neutral-400 hover:text-blue-600 text-[10px] font-medium"
                      title="分散对齐"
                    >
                      分散
                    </button>
                  </div>

                  {/* 缩进、行距与中文版式 */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="space-y-1">
                      <label className="text-[10px] text-neutral-500">缩进调整</label>
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => {
                            const sel = window.getSelection();
                            if (sel && sel.anchorNode) {
                              let el = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : (sel.anchorNode as HTMLElement);
                              while (el && !['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI'].includes(el.tagName)) {
                                el = el.parentElement;
                              }
                              if (el) {
                                const currentMargin = parseFloat(el.style.marginLeft || '0');
                                const next = Math.max(0, currentMargin - 2);
                                el.style.marginLeft = next > 0 ? `${next}em` : '';
                              }
                            }
                          }}
                          className="flex-1 py-1 flex items-center justify-center rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50"
                          title="减少缩进"
                        >
                          <OutdentIcon className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const sel = window.getSelection();
                            if (sel && sel.anchorNode) {
                              let el = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : (sel.anchorNode as HTMLElement);
                              while (el && !['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI'].includes(el.tagName)) {
                                el = el.parentElement;
                              }
                              if (el) {
                                const currentMargin = parseFloat(el.style.marginLeft || '0');
                                el.style.marginLeft = `${currentMargin + 2}em`;
                              }
                            }
                          }}
                          className="flex-1 py-1 flex items-center justify-center rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50"
                          title="增加缩进"
                        >
                          <IndentIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-neutral-500">行距倍数</label>
                      <LineSpacingControl editor={docEditor} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="space-y-1">
                      <label className="text-[10px] text-neutral-500">中文版式</label>
                      <ChineseTypographyControl editor={docEditor} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-neutral-500">边框线</label>
                      <BorderControl editor={docEditor} />
                    </div>
                  </div>
                </div>

                {/* 4. 表格工具 (WPS 风格) */}
                <div className="space-y-2 pt-3 border-t border-neutral-200/60 dark:border-neutral-800">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                    表格管理 (WPS 标准)
                  </div>
                  <TableMenuControl editor={docEditor} />
                </div>

                {/* 5. Doc Statistics */}
                {docStats && (
                  <div className="p-3 bg-neutral-50 dark:bg-neutral-800/60 rounded-xl border border-neutral-200/60 dark:border-neutral-700 space-y-1">
                    <div className="text-[10px] font-bold text-neutral-400 uppercase">文稿统计</div>
                    <div className="flex items-center justify-between text-xs">
                      <span>字数总计</span>
                      <span className="font-mono font-bold text-blue-600">{docStats.characters} 字</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span>词数总计</span>
                      <span className="font-mono font-semibold">{docStats.words} 词</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SHEET PROPERTIES */}
            {activeModule === 'sheet' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                    当前单元格: {selectedSheetCell?.coordLabel || 'A1'}
                  </div>

                  {/* Format Category */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-neutral-400">数字与数据格式</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { label: '常规文本', format: 'general' },
                        { label: '货币 (¥)', format: 'currency' },
                        { label: '百分比 (%)', format: 'percent' },
                        { label: '短日期', format: 'date' },
                      ].map((item) => (
                        <button
                          key={item.format}
                          onClick={() => onUpdateSheetFormat?.('format', item.format)}
                          className={`px-2 py-1.5 rounded-lg border text-xs font-medium text-left transition-colors ${
                            selectedSheetCell?.cellData?.format === item.format
                              ? 'border-emerald-500 bg-emerald-50/50 text-emerald-600 dark:bg-emerald-950/40'
                              : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sheet Cell Styling */}
                <div className="space-y-2 pt-3 border-t border-neutral-200/60 dark:border-neutral-800">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                    单元格样式
                  </div>

                  <div className="flex items-center space-x-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg border border-neutral-200 dark:border-neutral-700">
                    <button
                      onClick={() =>
                        onUpdateSheetFormat?.(
                          'bold',
                          !selectedSheetCell?.cellData?.bold
                        )
                      }
                      className={`p-1.5 rounded flex-1 flex justify-center ${
                        selectedSheetCell?.cellData?.bold
                          ? 'bg-white dark:bg-neutral-700 text-emerald-600 shadow-xs'
                          : 'text-neutral-600 dark:text-neutral-400'
                      }`}
                      title="加粗"
                    >
                      <Bold className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() =>
                        onUpdateSheetFormat?.(
                          'italic',
                          !selectedSheetCell?.cellData?.italic
                        )
                      }
                      className={`p-1.5 rounded flex-1 flex justify-center ${
                        selectedSheetCell?.cellData?.italic
                          ? 'bg-white dark:bg-neutral-700 text-emerald-600 shadow-xs'
                          : 'text-neutral-600 dark:text-neutral-400'
                      }`}
                      title="倾斜"
                    >
                      <Italic className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() =>
                        onUpdateSheetFormat?.(
                          'align',
                          selectedSheetCell?.cellData?.align === 'center' ? 'left' : 'center'
                        )
                      }
                      className={`p-1.5 rounded flex-1 flex justify-center ${
                        selectedSheetCell?.cellData?.align === 'center'
                          ? 'bg-white dark:bg-neutral-700 text-emerald-600 shadow-xs'
                          : 'text-neutral-600 dark:text-neutral-400'
                      }`}
                      title="居中"
                    >
                      <AlignCenter className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Quick Formula Inserts */}
                <div className="space-y-2 pt-3 border-t border-neutral-200/60 dark:border-neutral-800">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                    常用公式快捷插入
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {['SUM', 'AVERAGE', 'COUNT', 'MAX', 'MIN', 'IF', 'VLOOKUP', 'CONCAT'].map(
                      (formula) => (
                        <button
                          key={formula}
                          onClick={() => onInsertSheetFormula?.(formula)}
                          className="px-2 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-emerald-500 hover:bg-emerald-50/30 text-xs font-mono font-semibold text-neutral-700 dark:text-neutral-300 text-left transition-colors"
                        >
                          ={formula}()
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* PDF PROPERTIES */}
            {activeModule === 'pdf' && (
              <div className="space-y-4">
                {/* Page Level Controls */}
                <div className="space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                    页面操作 (Page #{currentPageMeta?.pageNumber || 1})
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => onRotateCurrentPdfPage?.(90)}
                      className="px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center space-x-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300"
                    >
                      <RotateCw className="w-3.5 h-3.5 text-blue-500" />
                      <span>顺时针 90°</span>
                    </button>
                    <button
                      onClick={() => onDeleteCurrentPdfPage?.()}
                      className="px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center space-x-1.5 text-xs font-medium text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>删除当前页</span>
                    </button>
                  </div>
                </div>

                {/* Selected Annotation Control */}
                {selectedPdfAnnotation ? (
                  <div className="space-y-2 pt-3 border-t border-neutral-200/60 dark:border-neutral-800">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                        图层属性 ({selectedPdfAnnotation.type})
                      </span>
                      <button
                        onClick={() => onDeletePdfAnnotation?.(selectedPdfAnnotation.id)}
                        className="text-rose-600 hover:text-rose-700 p-1"
                        title="删除该标注"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Color selection for annotation */}
                    <div className="space-y-1">
                      <label className="text-[10px] text-neutral-400">颜色</label>
                      <div className="flex items-center space-x-1.5">
                        {['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#111827'].map(
                          (c) => (
                            <button
                              key={c}
                              onClick={() =>
                                onUpdatePdfAnnotation?.(selectedPdfAnnotation.id, { color: c })
                              }
                              className={`w-5 h-5 rounded-full border transition-transform ${
                                selectedPdfAnnotation.color === c
                                  ? 'ring-2 ring-blue-500 ring-offset-1 scale-110'
                                  : 'border-neutral-300 dark:border-neutral-600'
                              }`}
                              style={{ backgroundColor: c }}
                            />
                          )
                        )}
                      </div>
                    </div>

                    {/* Opacity */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-neutral-400">
                        <span>不透明度</span>
                        <span>{Math.round((selectedPdfAnnotation.opacity || 1) * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.05"
                        value={selectedPdfAnnotation.opacity || 1}
                        onChange={(e) =>
                          onUpdatePdfAnnotation?.(selectedPdfAnnotation.id, {
                            opacity: parseFloat(e.target.value),
                          })
                        }
                        className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-neutral-50 dark:bg-neutral-800/60 rounded-xl border border-neutral-200/60 dark:border-neutral-700 text-center text-neutral-400">
                    <p className="text-xs">未选中标注图层</p>
                    <p className="text-[10px] mt-1">在页面上点击印章、高亮或文字可在此调整属性</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-neutral-200/70 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex items-center justify-between text-[11px] text-neutral-400 font-mono">
        <span>Mianay Office v3.0</span>
        <span className="flex items-center space-x-1 text-emerald-500">
          <Check className="w-3 h-3" />
          <span>本地引擎就绪</span>
        </span>
      </div>
    </aside>
  );
};
