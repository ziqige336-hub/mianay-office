import React, { useState, useRef, useEffect } from 'react';
import {
  Paintbrush,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyCenter as AlignMiddle,
  AlignVerticalJustifyStart as AlignTop,
  AlignVerticalJustifyEnd as AlignBottom,
  WrapText,
  Merge,
  Split,
  DollarSign,
  Percent,
  Hash,
  Sigma,
  ArrowDownAZ,
  ArrowUpZA,
  Filter,
  Search,
  Sparkles,
  Palette,
  ChevronDown,
  Grid,
  Square,
  Minus,
  Check,
} from 'lucide-react';
import type { SheetCell, CellBorderConfig } from '../../types';
import type { FormattingContext } from '../../core/formatting/types';

interface SheetToolbarControlsProps {
  currentCell?: SheetCell;
  formattingContext?: FormattingContext;
  isFormatPainterActive: boolean;
  formatPainterMode: 'single' | 'continuous' | null;
  onToggleFormatPainter: (isDoubleClick: boolean) => void;
  onUpdateFormat: (key: string, value: any) => void;
  onApplyBorders: (borderType: 'all' | 'outer' | 'thick' | 'top' | 'bottom' | 'doubleBottom' | 'clear', color?: string) => void;
  onMergeSelection: (type: 'mergeCenter' | 'merge' | 'unmerge') => void;
  onApplyAutoSum: (funcName: 'SUM' | 'AVERAGE' | 'COUNT' | 'MAX' | 'MIN') => void;
  onOpenSortModal: () => void;
  onQuickSort: (ascending: boolean) => void;
  onToggleFilter: () => void;
  isFilterEnabled: boolean;
  onOpenFindReplace: () => void;
  onOpenConditionalFormat: () => void;
  onOpenStylePresets: () => void;
  onClearFormats: () => void;
  onClearAll: () => void;
}

const FONT_FAMILIES = [
  { name: '默认字体 (System)', value: 'inherit' },
  { name: '苹方 (PingFang SC)', value: 'PingFang SC, sans-serif' },
  { name: '微软雅黑 (Microsoft YaHei)', value: '"Microsoft YaHei", sans-serif' },
  { name: '宋体 (Songti SC / SimSun)', value: 'Songti SC, SimSun, serif' },
  { name: '楷体 (Kaiti SC)', value: 'Kaiti SC, KaiTi, serif' },
  { name: '黑体 (SimHei)', value: 'SimHei, sans-serif' },
  { name: 'Arial', value: 'Arial, sans-serif' },
  { name: 'Helvetica Neue', value: '"Helvetica Neue", Helvetica, sans-serif' },
  { name: 'Menlo 等宽代码', value: 'Menlo, Monaco, monospace' },
];

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36];

const THEME_COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#cccccc', '#ef4444',
  '#f97316', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#6366f1',
  '#8b5cf6', '#ec4899', '#ffffff',
];

export const SheetToolbarControls: React.FC<SheetToolbarControlsProps> = ({
  currentCell,
  formattingContext,
  isFormatPainterActive,
  formatPainterMode,
  onToggleFormatPainter,
  onUpdateFormat,
  onApplyBorders,
  onMergeSelection,
  onApplyAutoSum,
  onOpenSortModal,
  onQuickSort,
  onToggleFilter,
  isFilterEnabled,
  onOpenFindReplace,
  onOpenConditionalFormat,
  onOpenStylePresets,
  onClearFormats,
  onClearAll,
}) => {
  // Dropdown open states
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const toggleDropdown = (name: string) => {
    setOpenDropdown((prev) => (prev === name ? null : name));
  };

  // Resolve active values from FormattingContext (with fallback to currentCell)
  const fontVal = formattingContext?.fontFamily !== undefined ? formattingContext.fontFamily : currentCell?.fontFamily;
  const isFontMixed = fontVal === 'mixed';
  const currentFontFamily = typeof fontVal === 'string' ? fontVal : 'inherit';

  const sizeVal = formattingContext?.fontSize !== undefined ? formattingContext.fontSize : currentCell?.fontSize;
  const isSizeMixed = sizeVal === 'mixed';
  const currentFontSize = typeof sizeVal === 'number' ? sizeVal : 11;

  const boldVal = formattingContext?.bold !== undefined ? formattingContext.bold : currentCell?.bold;
  const isBoldActive = boldVal === true;
  const isBoldMixed = boldVal === 'mixed';

  const italicVal = formattingContext?.italic !== undefined ? formattingContext.italic : currentCell?.italic;
  const isItalicActive = italicVal === true;
  const isItalicMixed = italicVal === 'mixed';

  const underlineVal = formattingContext?.underline !== undefined ? formattingContext.underline : currentCell?.underline;
  const isUnderlineActive = underlineVal === true;
  const isUnderlineMixed = underlineVal === 'mixed';

  const strikeVal = formattingContext?.strike !== undefined ? formattingContext.strike : currentCell?.strikethrough;
  const isStrikeActive = strikeVal === true;
  const isStrikeMixed = strikeVal === 'mixed';

  const colorVal = formattingContext?.color !== undefined ? formattingContext.color : currentCell?.color;
  const isColorMixed = colorVal === 'mixed';
  const currentColor = typeof colorVal === 'string' ? colorVal : '#000000';

  const bgVal = formattingContext?.backgroundColor !== undefined ? formattingContext.backgroundColor : currentCell?.bg;
  const isBgMixed = bgVal === 'mixed';
  const currentBg = typeof bgVal === 'string' ? bgVal : undefined;

  const alignVal = formattingContext?.textAlign !== undefined ? formattingContext.textAlign : currentCell?.align;

  const handleStepFontSize = (delta: number) => {
    const newSize = Math.max(8, Math.min(72, currentFontSize + delta));
    onUpdateFormat('fontSize', newSize);
  };

  return (
    <div
      ref={containerRef}
      id="sheet-rich-toolbar-controls"
      className="flex items-center flex-wrap gap-1.5 py-0.5 text-xs text-neutral-700 dark:text-neutral-200 select-none relative z-50 overflow-visible"
    >
      {/* 1. Format Painter */}
      <button
        onClick={(e) => {
          onToggleFormatPainter(false);
        }}
        onDoubleClick={() => {
          onToggleFormatPainter(true);
        }}
        title={`格式刷 (单击应用一次，双击持续应用)\n${
          isFormatPainterActive ? `当前已激活 [${formatPainterMode === 'continuous' ? '连续模式' : '单次模式'}]` : ''
        }`}
        className={`p-1.5 rounded-lg flex items-center space-x-1 transition-all ${
          isFormatPainterActive
            ? 'bg-amber-500 text-white shadow-xs ring-2 ring-amber-400/40'
            : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
        }`}
      >
        <Paintbrush className="w-3.5 h-3.5" />
      </button>

      <div className="w-[1px] h-4 bg-neutral-200 dark:border-neutral-800 mx-0.5" />

      {/* 2. Font Family Picker */}
      <div className="relative">
        <button
          onClick={() => toggleDropdown('fontFamily')}
          className={`h-7 px-2 rounded-lg border flex items-center justify-between space-x-1 min-w-[105px] max-w-[120px] text-xs transition-colors ${
            isFontMixed
              ? 'border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/30'
              : 'border-neutral-200 dark:border-neutral-700/80 bg-white dark:bg-neutral-800'
          }`}
          title={isFontMixed ? '选区包含多种字体' : undefined}
        >
          <span className="truncate">
            {isFontMixed
              ? '多重字体'
              : FONT_FAMILIES.find((f) => f.value === currentFontFamily)?.name.split(' ')[0] || '默认字体'}
          </span>
          <ChevronDown className="w-3 h-3 text-neutral-400 shrink-0" />
        </button>

        {openDropdown === 'fontFamily' && (
          <div className="absolute left-0 top-8 z-[99999] w-48 bg-white dark:bg-[#18181b] rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-800 py-1 text-xs">
            {FONT_FAMILIES.map((font) => (
              <button
                key={font.value}
                onClick={() => {
                  onUpdateFormat('fontFamily', font.value);
                  setOpenDropdown(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-between"
                style={{ fontFamily: font.value }}
              >
                <span>{font.name}</span>
                {currentFontFamily === font.value && !isFontMixed && <Check className="w-3 h-3 text-blue-500" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3. Font Size Picker & Stepper */}
      <div className="flex items-center space-x-0.5">
        <div className="relative">
          <button
            onClick={() => toggleDropdown('fontSize')}
            className={`h-7 px-2 rounded-lg border flex items-center justify-between space-x-1 w-14 text-xs transition-colors ${
              isSizeMixed
                ? 'border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/30'
                : 'border-neutral-200 dark:border-neutral-700/80 bg-white dark:bg-neutral-800'
            }`}
            title={isSizeMixed ? '选区包含多种字号' : undefined}
          >
            <span>{isSizeMixed ? '--' : currentFontSize}</span>
            <ChevronDown className="w-3 h-3 text-neutral-400" />
          </button>

          {openDropdown === 'fontSize' && (
            <div className="absolute left-0 top-8 z-[99999] w-20 max-h-48 overflow-y-auto bg-white dark:bg-[#18181b] rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-800 py-1 text-xs">
              {FONT_SIZES.map((sz) => (
                <button
                  key={sz}
                  onClick={() => {
                    onUpdateFormat('fontSize', sz);
                    setOpenDropdown(null);
                  }}
                  className="w-full px-3 py-1 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-between"
                >
                  <span>{sz}</span>
                  {currentFontSize === sz && !isSizeMixed && <Check className="w-3 h-3 text-blue-500" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => handleStepFontSize(1)}
          title="增大字号"
          className="h-7 px-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[11px] font-bold text-neutral-600 dark:text-neutral-400"
        >
          A<span className="text-[9px]">+</span>
        </button>
        <button
          onClick={() => handleStepFontSize(-1)}
          title="减小字号"
          className="h-7 px-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[11px] font-bold text-neutral-600 dark:text-neutral-400"
        >
          A<span className="text-[9px]">-</span>
        </button>
      </div>

      <div className="w-[1px] h-4 bg-neutral-200 dark:border-neutral-800 mx-0.5" />

      {/* 4. Text Styles: Bold, Italic, Underline, Strike */}
      <div className="flex items-center space-x-0.5 bg-neutral-100 dark:bg-neutral-800/80 p-0.5 rounded-lg border border-neutral-200/80 dark:border-neutral-700/60">
        <button
          onClick={() => onUpdateFormat('bold', !isBoldActive)}
          title={`加粗 (Ctrl+B)${isBoldMixed ? ' - 选区包含部分加粗' : ''}`}
          className={`p-1 rounded-md transition-colors ${
            isBoldActive
              ? 'bg-blue-600 text-white shadow-xs'
              : isBoldMixed
              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 ring-1 ring-amber-400'
              : 'text-neutral-600 dark:text-neutral-400'
          }`}
        >
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onUpdateFormat('italic', !isItalicActive)}
          title={`斜体 (Ctrl+I)${isItalicMixed ? ' - 选区包含部分斜体' : ''}`}
          className={`p-1 rounded-md transition-colors ${
            isItalicActive
              ? 'bg-blue-600 text-white shadow-xs'
              : isItalicMixed
              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 ring-1 ring-amber-400'
              : 'text-neutral-600 dark:text-neutral-400'
          }`}
        >
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onUpdateFormat('underline', !isUnderlineActive)}
          title={`下划线 (Ctrl+U)${isUnderlineMixed ? ' - 选区包含部分下划线' : ''}`}
          className={`p-1 rounded-md transition-colors ${
            isUnderlineActive
              ? 'bg-blue-600 text-white shadow-xs'
              : isUnderlineMixed
              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 ring-1 ring-amber-400'
              : 'text-neutral-600 dark:text-neutral-400'
          }`}
        >
          <Underline className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onUpdateFormat('strikethrough', !isStrikeActive)}
          title={`删除线${isStrikeMixed ? ' - 选区包含部分删除线' : ''}`}
          className={`p-1 rounded-md transition-colors ${
            isStrikeActive
              ? 'bg-blue-600 text-white shadow-xs'
              : isStrikeMixed
              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 ring-1 ring-amber-400'
              : 'text-neutral-600 dark:text-neutral-400'
          }`}
        >
          <Strikethrough className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 5. Fill Color & Text Color */}
      <div className="flex items-center space-x-1">
        {/* Fill Color */}
        <div className="relative">
          <button
            onClick={() => toggleDropdown('fillColor')}
            title={`单元格填充背景色${isBgMixed ? ' - 选区包含多种背景色' : ''}`}
            className={`p-1.5 rounded-lg border flex items-center space-x-1 transition-colors ${
              isBgMixed
                ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/30'
                : 'border-neutral-200 dark:border-neutral-700/80 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <div
              className="w-3.5 h-3.5 rounded-sm border border-neutral-300 dark:border-neutral-600"
              style={{
                background: isBgMixed
                  ? 'linear-gradient(90deg, #fde047, #86efac, #93c5fd)'
                  : (currentBg || 'transparent'),
              }}
            />
            <ChevronDown className="w-2.5 h-2.5 text-neutral-400" />
          </button>

          {openDropdown === 'fillColor' && (
            <div className="absolute left-0 top-8 z-[99999] w-44 bg-white dark:bg-[#18181b] rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-800 p-2.5 space-y-2 text-xs">
              <div className="font-medium text-[11px] text-neutral-500">背景填充颜色</div>
              <div className="grid grid-cols-5 gap-1">
                {THEME_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      onUpdateFormat('bg', c);
                      setOpenDropdown(null);
                    }}
                    className="w-6 h-6 rounded-md border border-neutral-200 dark:border-neutral-700 hover:scale-110 transition-transform shadow-xs"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <button
                onClick={() => {
                  onUpdateFormat('bg', undefined);
                  setOpenDropdown(null);
                }}
                className="w-full py-1 text-center text-[11px] rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-dashed border-neutral-300 dark:border-neutral-700"
              >
                无填充颜色
              </button>
            </div>
          )}
        </div>

        {/* Text Color */}
        <div className="relative">
          <button
            onClick={() => toggleDropdown('textColor')}
            title={`字体文字颜色${isColorMixed ? ' - 选区包含多种颜色' : ''}`}
            className={`p-1.5 rounded-lg border flex items-center space-x-1 transition-colors ${
              isColorMixed
                ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/30'
                : 'border-neutral-200 dark:border-neutral-700/80 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <span
              className="font-bold text-xs"
              style={{
                color: isColorMixed ? undefined : currentColor,
                background: isColorMixed ? 'linear-gradient(90deg, #ef4444, #3b82f6, #10b981)' : undefined,
                WebkitBackgroundClip: isColorMixed ? 'text' : undefined,
                WebkitTextFillColor: isColorMixed ? 'transparent' : undefined,
              }}
            >
              A
            </span>
            <ChevronDown className="w-2.5 h-2.5 text-neutral-400" />
          </button>

          {openDropdown === 'textColor' && (
            <div className="absolute left-0 top-8 z-[99999] w-44 bg-white dark:bg-[#18181b] rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-800 p-2.5 space-y-2 text-xs">
              <div className="font-medium text-[11px] text-neutral-500">字体文字颜色</div>
              <div className="grid grid-cols-5 gap-1">
                {THEME_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      onUpdateFormat('color', c);
                      setOpenDropdown(null);
                    }}
                    className="w-6 h-6 rounded-md border border-neutral-200 dark:border-neutral-700 hover:scale-110 transition-transform shadow-xs"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <button
                onClick={() => {
                  onUpdateFormat('color', undefined);
                  setOpenDropdown(null);
                }}
                className="w-full py-1 text-center text-[11px] rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-dashed border-neutral-300 dark:border-neutral-700"
              >
                恢复默认黑色
              </button>
            </div>
          )}
        </div>

        {/* Borders Dropdown */}
        <div className="relative">
          <button
            onClick={() => toggleDropdown('borders')}
            title="单元格边框设置"
            className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700/80 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center space-x-0.5"
          >
            <Grid className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-300" />
            <ChevronDown className="w-2.5 h-2.5 text-neutral-400" />
          </button>

          {openDropdown === 'borders' && (
            <div className="absolute left-0 top-8 z-[99999] w-44 bg-white dark:bg-[#18181b] rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-800 py-1 text-xs">
              <button
                onClick={() => {
                  onApplyBorders('all');
                  setOpenDropdown(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center space-x-2"
              >
                <Grid className="w-3.5 h-3.5 text-blue-500" />
                <span>所有边框 (All Borders)</span>
              </button>
              <button
                onClick={() => {
                  onApplyBorders('outer');
                  setOpenDropdown(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center space-x-2"
              >
                <Square className="w-3.5 h-3.5" />
                <span>外侧框线 (Box Border)</span>
              </button>
              <button
                onClick={() => {
                  onApplyBorders('thick');
                  setOpenDropdown(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center space-x-2 font-semibold"
              >
                <Square className="w-3.5 h-3.5 text-neutral-800 dark:text-neutral-100" />
                <span>粗外侧框 (Thick Border)</span>
              </button>
              <button
                onClick={() => {
                  onApplyBorders('bottom');
                  setOpenDropdown(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center space-x-2"
              >
                <Minus className="w-3.5 h-3.5" />
                <span>下框线 (Bottom Border)</span>
              </button>
              <button
                onClick={() => {
                  onApplyBorders('doubleBottom');
                  setOpenDropdown(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center space-x-2"
              >
                <span className="text-[10px] font-bold underline decoration-double">==</span>
                <span>双下框线 (Double Bottom)</span>
              </button>
              <div className="border-t border-neutral-100 dark:border-neutral-800 my-1" />
              <button
                onClick={() => {
                  onApplyBorders('clear');
                  setOpenDropdown(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 text-rose-600 flex items-center space-x-2"
              >
                <span>无边框 / 清除边框</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="w-[1px] h-4 bg-neutral-200 dark:border-neutral-800 mx-0.5" />

      {/* 6. Alignment & Wrap & Merge */}
      <div className="flex items-center space-x-0.5 bg-neutral-100 dark:bg-neutral-800/80 p-0.5 rounded-lg border border-neutral-200/80 dark:border-neutral-700/60">
        <button
          onClick={() => onUpdateFormat('align', 'left')}
          title="左对齐"
          className={`p-1 rounded-md ${currentCell?.align === 'left' || !currentCell?.align ? 'bg-white dark:bg-neutral-700 text-blue-600 shadow-xs' : 'text-neutral-600 dark:text-neutral-400'}`}
        >
          <AlignLeft className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onUpdateFormat('align', 'center')}
          title="居中对齐"
          className={`p-1 rounded-md ${currentCell?.align === 'center' ? 'bg-white dark:bg-neutral-700 text-blue-600 shadow-xs' : 'text-neutral-600 dark:text-neutral-400'}`}
        >
          <AlignCenter className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onUpdateFormat('align', 'right')}
          title="右对齐"
          className={`p-1 rounded-md ${currentCell?.align === 'right' ? 'bg-white dark:bg-neutral-700 text-blue-600 shadow-xs' : 'text-neutral-600 dark:text-neutral-400'}`}
        >
          <AlignRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Vertical Alignment */}
      <div className="flex items-center space-x-0.5 bg-neutral-100 dark:bg-neutral-800/80 p-0.5 rounded-lg border border-neutral-200/80 dark:border-neutral-700/60">
        <button
          onClick={() => onUpdateFormat('verticalAlign', 'top')}
          title="顶端对齐"
          className={`p-1 rounded-md ${currentCell?.verticalAlign === 'top' ? 'bg-white dark:bg-neutral-700 text-blue-600 shadow-xs' : 'text-neutral-600 dark:text-neutral-400'}`}
        >
          <AlignTop className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onUpdateFormat('verticalAlign', 'middle')}
          title="垂直居中"
          className={`p-1 rounded-md ${currentCell?.verticalAlign === 'middle' || !currentCell?.verticalAlign ? 'bg-white dark:bg-neutral-700 text-blue-600 shadow-xs' : 'text-neutral-600 dark:text-neutral-400'}`}
        >
          <AlignMiddle className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onUpdateFormat('verticalAlign', 'bottom')}
          title="底端对齐"
          className={`p-1 rounded-md ${currentCell?.verticalAlign === 'bottom' ? 'bg-white dark:bg-neutral-700 text-blue-600 shadow-xs' : 'text-neutral-600 dark:text-neutral-400'}`}
        >
          <AlignBottom className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Wrap text toggle */}
      <button
        onClick={() => onUpdateFormat('wrapText', !currentCell?.wrapText)}
        title="自动换行 (Wrap Text)"
        className={`p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700/80 ${
          currentCell?.wrapText ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 border-blue-500' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
        }`}
      >
        <WrapText className="w-3.5 h-3.5" />
      </button>

      {/* Merge Cells Dropdown */}
      <div className="relative">
        <button
          onClick={() => toggleDropdown('merge')}
          title="合并与取消合并单元格"
          className="h-7 px-2 rounded-lg border border-neutral-200 dark:border-neutral-700/80 bg-white dark:bg-neutral-800 flex items-center space-x-1 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800"
        >
          <Merge className="w-3.5 h-3.5 text-blue-500" />
          <span className="hidden sm:inline">合并</span>
          <ChevronDown className="w-2.5 h-2.5 text-neutral-400" />
        </button>

        {openDropdown === 'merge' && (
          <div className="absolute left-0 top-8 z-[99999] w-44 bg-white dark:bg-[#18181b] rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-800 py-1 text-xs">
            <button
              onClick={() => {
                onMergeSelection('mergeCenter');
                setOpenDropdown(null);
              }}
              className="w-full px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center space-x-2"
            >
              <Merge className="w-3.5 h-3.5 text-blue-500" />
              <span>合并后居中</span>
            </button>
            <button
              onClick={() => {
                onMergeSelection('merge');
                setOpenDropdown(null);
              }}
              className="w-full px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center space-x-2"
            >
              <Merge className="w-3.5 h-3.5" />
              <span>合并单元格</span>
            </button>
            <button
              onClick={() => {
                onMergeSelection('unmerge');
                setOpenDropdown(null);
              }}
              className="w-full px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center space-x-2 text-rose-600"
            >
              <Split className="w-3.5 h-3.5" />
              <span>取消合并单元格</span>
            </button>
          </div>
        )}
      </div>

      <div className="w-[1px] h-4 bg-neutral-200 dark:border-neutral-800 mx-0.5" />

      {/* 7. Number Format Controls */}
      <div className="relative">
        <button
          onClick={() => toggleDropdown('numberFormat')}
          title="数字与数据格式"
          className="h-7 px-2 rounded-lg border border-neutral-200 dark:border-neutral-700/80 bg-white dark:bg-neutral-800 flex items-center space-x-1 min-w-[85px] justify-between text-xs"
        >
          <span className="truncate">
            {currentCell?.format === 'currency'
              ? '¥ 货币'
              : currentCell?.format === 'percent'
              ? '% 百分比'
              : currentCell?.format === 'date'
              ? '日期'
              : currentCell?.format === 'time'
              ? '时间'
              : currentCell?.format === 'number'
              ? '数值'
              : currentCell?.format === 'text'
              ? '文本'
              : currentCell?.format === 'scientific'
              ? '科学计数'
              : '常规 (General)'}
          </span>
          <ChevronDown className="w-3 h-3 text-neutral-400" />
        </button>

        {openDropdown === 'numberFormat' && (
          <div className="absolute left-0 top-8 z-[99999] w-44 bg-white dark:bg-[#18181b] rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-800 py-1 text-xs">
            {[
              { id: 'general', label: '常规 (General)' },
              { id: 'number', label: '数字 (1,234.56)' },
              { id: 'currency', label: '货币 (¥1,234.56)' },
              { id: 'percent', label: '百分比 (12.34%)' },
              { id: 'date', label: '日期 (2026-08-27)' },
              { id: 'time', label: '时间 (15:30:00)' },
              { id: 'text', label: '纯文本 (@Text)' },
              { id: 'scientific', label: '科学计数 (1.23E+04)' },
            ].map((fmt) => (
              <button
                key={fmt.id}
                onClick={() => {
                  onUpdateFormat('format', fmt.id);
                  setOpenDropdown(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-between"
              >
                <span>{fmt.label}</span>
                {currentCell?.format === fmt.id && <Check className="w-3 h-3 text-blue-500" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quick Format Shortcuts */}
      <div className="flex items-center space-x-0.5">
        <button
          onClick={() => onUpdateFormat('format', currentCell?.format === 'currency' ? 'general' : 'currency')}
          title="货币格式 (¥)"
          className={`p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700/80 ${
            currentCell?.format === 'currency' ? 'bg-blue-50 text-blue-600 border-blue-500' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onUpdateFormat('format', currentCell?.format === 'percent' ? 'general' : 'percent')}
          title="百分比格式 (%)"
          className={`p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700/80 ${
            currentCell?.format === 'percent' ? 'bg-blue-50 text-blue-600 border-blue-500' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          <Percent className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onUpdateFormat('thousandSeparator', !currentCell?.thousandSeparator)}
          title="千位分隔符 (,)"
          className={`p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700/80 font-bold text-xs ${
            currentCell?.thousandSeparator ? 'bg-blue-50 text-blue-600 border-blue-500' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          ,
        </button>
        <button
          onClick={() => onUpdateFormat('decimalPlaces', (currentCell?.decimalPlaces ?? 2) + 1)}
          title="增加小数位数 (.00 → .000)"
          className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700/80 hover:bg-neutral-100 dark:hover:bg-neutral-800 font-mono text-[10px]"
        >
          .00+
        </button>
        <button
          onClick={() => onUpdateFormat('decimalPlaces', Math.max(0, (currentCell?.decimalPlaces ?? 2) - 1))}
          title="减少小数位数 (.00 → .0)"
          className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700/80 hover:bg-neutral-100 dark:hover:bg-neutral-800 font-mono text-[10px]"
        >
          .00-
        </button>
      </div>

      <div className="w-[1px] h-4 bg-neutral-200 dark:border-neutral-800 mx-0.5" />

      {/* 8. AutoSum Dropdown */}
      <div className="relative">
        <button
          onClick={() => toggleDropdown('autosum')}
          title="自动求和与聚合公式"
          className="h-7 px-2 rounded-lg border border-neutral-200 dark:border-neutral-700/80 bg-white dark:bg-neutral-800 flex items-center space-x-1 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800"
        >
          <Sigma className="w-3.5 h-3.5 text-blue-600" />
          <span className="hidden sm:inline font-semibold">求和</span>
          <ChevronDown className="w-2.5 h-2.5 text-neutral-400" />
        </button>

        {openDropdown === 'autosum' && (
          <div className="absolute left-0 top-8 z-[99999] w-40 bg-white dark:bg-[#18181b] rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-800 py-1 text-xs">
            {[
              { name: '求和 (SUM)', func: 'SUM' as const },
              { name: '平均值 (AVERAGE)', func: 'AVERAGE' as const },
              { name: '计数 (COUNT)', func: 'COUNT' as const },
              { name: '最大值 (MAX)', func: 'MAX' as const },
              { name: '最小值 (MIN)', func: 'MIN' as const },
            ].map((item) => (
              <button
                key={item.func}
                onClick={() => {
                  onApplyAutoSum(item.func);
                  setOpenDropdown(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                {item.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 9. Sort & Filter */}
      <div className="relative">
        <button
          onClick={() => toggleDropdown('sortFilter')}
          title="排序与筛选"
          className="h-7 px-2 rounded-lg border border-neutral-200 dark:border-neutral-700/80 bg-white dark:bg-neutral-800 flex items-center space-x-1 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800"
        >
          <Filter className={`w-3.5 h-3.5 ${isFilterEnabled ? 'text-blue-500' : 'text-neutral-500'}`} />
          <span className="hidden sm:inline">排序与筛选</span>
          <ChevronDown className="w-2.5 h-2.5 text-neutral-400" />
        </button>

        {openDropdown === 'sortFilter' && (
          <div className="absolute left-0 top-8 z-[99999] w-44 bg-white dark:bg-[#18181b] rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-800 py-1 text-xs">
            <button
              onClick={() => {
                onQuickSort(true);
                setOpenDropdown(null);
              }}
              className="w-full px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center space-x-2"
            >
              <ArrowDownAZ className="w-3.5 h-3.5 text-blue-500" />
              <span>升序排序 (A → Z)</span>
            </button>
            <button
              onClick={() => {
                onQuickSort(false);
                setOpenDropdown(null);
              }}
              className="w-full px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center space-x-2"
            >
              <ArrowUpZA className="w-3.5 h-3.5 text-blue-500" />
              <span>降序排序 (Z → A)</span>
            </button>
            <button
              onClick={() => {
                onOpenSortModal();
                setOpenDropdown(null);
              }}
              className="w-full px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              自定义选区排序...
            </button>
            <div className="border-t border-neutral-100 dark:border-neutral-800 my-1" />
            <button
              onClick={() => {
                onToggleFilter();
                setOpenDropdown(null);
              }}
              className="w-full px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center space-x-2"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{isFilterEnabled ? '关闭表头筛选' : '开启表头筛选'}</span>
            </button>
          </div>
        )}
      </div>

      <div className="w-[1px] h-4 bg-neutral-200 dark:border-neutral-800 mx-0.5" />

      {/* 10. Styles & Conditional & Find/Replace Studio */}
      <button
        onClick={onOpenStylePresets}
        title="表格与单元格预设样式"
        className="h-7 px-2 rounded-lg border border-neutral-200 dark:border-neutral-700/80 bg-white dark:bg-neutral-800 flex items-center space-x-1 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800"
      >
        <Palette className="w-3.5 h-3.5 text-indigo-500" />
        <span className="hidden md:inline">预设样式</span>
      </button>

      <button
        onClick={onOpenConditionalFormat}
        title="条件格式规则管理器"
        className="h-7 px-2 rounded-lg border border-neutral-200 dark:border-neutral-700/80 bg-white dark:bg-neutral-800 flex items-center space-x-1 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800"
      >
        <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
        <span className="hidden md:inline">条件格式</span>
      </button>

      <button
        onClick={onOpenFindReplace}
        title="查找与替换 (Ctrl+F / Ctrl+H)"
        className="h-7 px-2 rounded-lg border border-neutral-200 dark:border-neutral-700/80 bg-white dark:bg-neutral-800 flex items-center space-x-1 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800"
      >
        <Search className="w-3.5 h-3.5 text-neutral-500" />
        <span className="hidden md:inline">查找</span>
      </button>
    </div>
  );
};
