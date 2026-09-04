import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  TableProperties,
  Plus,
  Check,
  ChevronDown,
  ArrowUpDown,
  Calculator,
  Sliders,
  Sparkles,
  Layers,
  Percent,
  Hash,
  Sigma,
  PieChart,
  BarChart2,
  Settings2,
} from 'lucide-react';
import type { SheetData, PivotTableConfig } from '../../types';
import {
  colIndexToLetter,
  getCellValue,
  generatePivotTableData,
} from '../../utils/sheetUtils';

interface SheetPivotModalProps {
  isOpen: boolean;
  onClose: () => void;
  sheetData: SheetData;
  onAddPivotSheet: (title: string, data: { headers: string[]; rows: (string | number)[][] }) => void;
}

export const SheetPivotModal: React.FC<SheetPivotModalProps> = ({
  isOpen,
  onClose,
  sheetData,
  onAddPivotSheet,
}) => {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'layout' | 'calc' | 'style'>('layout');

  // Pivot Configurations
  const [rowField, setRowField] = useState<number>(0);
  const [valueField, setValueField] = useState<number>(1);
  const [aggregation, setAggregation] = useState<'SUM' | 'COUNT' | 'AVERAGE' | 'MAX' | 'MIN'>('SUM');
  const [sortOrder, setSortOrder] = useState<'none' | 'asc' | 'desc'>('none');
  const [showGrandTotal, setShowGrandTotal] = useState(true);
  const [formatAsCurrency, setFormatAsCurrency] = useState(true);
  const [highlightMax, setHighlightMax] = useState(false);

  // Popover State for Field Buttons
  const [isRowPopoverOpen, setIsRowPopoverOpen] = useState(false);
  const [isValuePopoverOpen, setIsValuePopoverOpen] = useState(false);
  const [isAggPopoverOpen, setIsAggPopoverOpen] = useState(false);

  const rowButtonRef = useRef<HTMLDivElement>(null);
  const valueButtonRef = useRef<HTMLDivElement>(null);
  const aggButtonRef = useRef<HTMLDivElement>(null);

  // Close popovers on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (rowButtonRef.current && !rowButtonRef.current.contains(e.target as Node)) {
        setIsRowPopoverOpen(false);
      }
      if (valueButtonRef.current && !valueButtonRef.current.contains(e.target as Node)) {
        setIsValuePopoverOpen(false);
      }
      if (aggButtonRef.current && !aggButtonRef.current.contains(e.target as Node)) {
        setIsAggPopoverOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (!isOpen) return null;

  const config: PivotTableConfig = {
    sourceRange: `A1:${colIndexToLetter(sheetData.cols - 1)}${sheetData.rows}`,
    rowField,
    valueField,
    aggregation,
  };

  const rawPivotResult = generatePivotTableData(sheetData, config);

  // Apply sorting if requested
  let processedRows = [...rawPivotResult.rows];
  if (sortOrder === 'asc') {
    processedRows.sort((a, b) => Number(a[1]) - Number(b[1]));
  } else if (sortOrder === 'desc') {
    processedRows.sort((a, b) => Number(b[1]) - Number(a[1]));
  }

  // Calculate Grand Total
  const totalValue = processedRows.reduce((acc, row) => {
    const num = Number(row[1]);
    return acc + (isNaN(num) ? 0 : num);
  }, 0);

  const averageValue = processedRows.length > 0 ? totalValue / processedRows.length : 0;
  const maxValue = processedRows.reduce((max, row) => Math.max(max, Number(row[1]) || 0), -Infinity);

  const handleExportToNewSheet = () => {
    const finalHeaders = [...rawPivotResult.headers];
    const finalRows = [...processedRows];
    if (showGrandTotal) {
      finalRows.push(['总计 (Grand Total)', aggregation === 'AVERAGE' ? averageValue : totalValue]);
    }
    onAddPivotSheet(`透视分析_${Date.now().toString().slice(-4)}`, {
      headers: finalHeaders,
      rows: finalRows,
    });
    onClose();
  };

  const colList = Array.from({ length: Math.min(sheetData.cols, 10) }).map((_, idx) => ({
    index: idx,
    letter: colIndexToLetter(idx),
    name: String(getCellValue(0, idx, sheetData.cells) || `列 ${colIndexToLetter(idx)}`),
  }));

  const getRowFieldName = () => colList.find((c) => c.index === rowField)?.name || `列 ${colIndexToLetter(rowField)}`;
  const getValueFieldName = () => colList.find((c) => c.index === valueField)?.name || `列 ${colIndexToLetter(valueField)}`;

  const aggLabels: Record<string, { name: string; desc: string; icon: any }> = {
    SUM: { name: '求和 (SUM)', desc: '累计数值总和', icon: Sigma },
    AVERAGE: { name: '平均值 (AVERAGE)', desc: '求算术平均值', icon: Calculator },
    COUNT: { name: '计数 (COUNT)', desc: '统计非空记录个数', icon: Hash },
    MAX: { name: '最大值 (MAX)', desc: '查找峰值最大数', icon: BarChart2 },
    MIN: { name: '最小值 (MIN)', desc: '查找最低最小数', icon: BarChart2 },
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        className="bg-white dark:bg-[#18181a] border border-neutral-200/80 dark:border-neutral-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Apple Style Header with Tab Switcher */}
        <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-900/50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20 shadow-xs">
              <TableProperties className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
                  数据透视分析工作台
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 rounded-full">
                  Pivot Table
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                基于 Apple Numbers 交互架构的多维数据交叉汇总与洞察
              </p>
            </div>
          </div>

          {/* Segmented Tab Control */}
          <div className="flex items-center bg-neutral-200/70 dark:bg-neutral-800 p-1 rounded-xl text-xs font-medium space-x-1">
            <button
              type="button"
              onClick={() => setActiveTab('layout')}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeTab === 'layout'
                  ? 'bg-white dark:bg-[#242426] text-purple-600 dark:text-purple-300 shadow-xs font-semibold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              维度与指标
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('calc')}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeTab === 'calc'
                  ? 'bg-white dark:bg-[#242426] text-purple-600 dark:text-purple-300 shadow-xs font-semibold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              计算与排序
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('style')}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeTab === 'style'
                  ? 'bg-white dark:bg-[#242426] text-purple-600 dark:text-purple-300 shadow-xs font-semibold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              视图与汇总
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Main Body */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 flex-1 overflow-hidden">
          {/* Left Column: Interactive Options based on Active Tab (5 cols) */}
          <div className="md:col-span-5 flex flex-col space-y-4 overflow-y-auto pr-1">
            {activeTab === 'layout' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* 1. Row Dimension Field Interactive Button with Popover */}
                <div className="relative" ref={rowButtonRef}>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center space-x-1.5">
                      <Layers className="w-3.5 h-3.5 text-purple-500" />
                      <span>行维度字段 (Row Dimension)</span>
                    </label>
                    <span className="text-[10px] text-neutral-400 font-mono">GROUP BY</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsRowPopoverOpen(!isRowPopoverOpen);
                      setIsValuePopoverOpen(false);
                      setIsAggPopoverOpen(false);
                    }}
                    className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between shadow-2xs ${
                      isRowPopoverOpen
                        ? 'border-purple-500 ring-2 ring-purple-500/20 bg-purple-50/50 dark:bg-purple-950/30'
                        : 'border-neutral-200 dark:border-neutral-750 bg-neutral-50/80 dark:bg-neutral-800/80 hover:bg-white dark:hover:bg-neutral-800 hover:border-purple-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className="w-7 h-7 rounded-xl bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 flex items-center justify-center font-bold text-xs">
                        {colIndexToLetter(rowField)}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                          {getRowFieldName()}
                        </div>
                        <div className="text-[10px] text-neutral-500">
                          点击切换或展开维度字段列表
                        </div>
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-neutral-400 transition-transform ${
                        isRowPopoverOpen ? 'rotate-180 text-purple-500' : ''
                      }`}
                    />
                  </button>

                  {/* Popover Menu for Row Field */}
                  {isRowPopoverOpen && (
                    <div className="absolute left-0 top-full mt-2 w-full bg-white dark:bg-[#1f1f22] border border-neutral-200 dark:border-neutral-700 rounded-2xl shadow-xl p-2 z-50 animate-in fade-in select-none">
                      <div className="px-2 py-1 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                        选择作为行分组的表头列
                      </div>
                      <div className="max-h-56 overflow-y-auto space-y-1 mt-1">
                        {colList.map((col) => {
                          const isSelected = col.index === rowField;
                          return (
                            <button
                              key={col.index}
                              type="button"
                              onClick={() => {
                                setRowField(col.index);
                                setIsRowPopoverOpen(false);
                              }}
                              className={`w-full px-3 py-2 rounded-xl text-left text-xs flex items-center justify-between transition-colors ${
                                isSelected
                                  ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-300 font-bold'
                                  : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                              }`}
                            >
                              <div className="flex items-center space-x-2">
                                <span className="w-5 h-5 rounded-lg bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 flex items-center justify-center text-[10px] font-mono font-bold">
                                  {col.letter}
                                </span>
                                <span className="truncate">{col.name}</span>
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-purple-600 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Value Measure Field Interactive Button with Popover */}
                <div className="relative" ref={valueButtonRef}>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center space-x-1.5">
                      <Calculator className="w-3.5 h-3.5 text-blue-500" />
                      <span>数值度量字段 (Values Column)</span>
                    </label>
                    <span className="text-[10px] text-neutral-400 font-mono">AGGREGATE</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsValuePopoverOpen(!isValuePopoverOpen);
                      setIsRowPopoverOpen(false);
                      setIsAggPopoverOpen(false);
                    }}
                    className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between shadow-2xs ${
                      isValuePopoverOpen
                        ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/50 dark:bg-blue-950/30'
                        : 'border-neutral-200 dark:border-neutral-750 bg-neutral-50/80 dark:bg-neutral-800/80 hover:bg-white dark:hover:bg-neutral-800 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className="w-7 h-7 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold text-xs">
                        {colIndexToLetter(valueField)}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                          {getValueFieldName()}
                        </div>
                        <div className="text-[10px] text-neutral-500">
                          用于计算求和、均值等度量指标
                        </div>
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-neutral-400 transition-transform ${
                        isValuePopoverOpen ? 'rotate-180 text-blue-500' : ''
                      }`}
                    />
                  </button>

                  {/* Popover Menu for Value Field */}
                  {isValuePopoverOpen && (
                    <div className="absolute left-0 top-full mt-2 w-full bg-white dark:bg-[#1f1f22] border border-neutral-200 dark:border-neutral-700 rounded-2xl shadow-xl p-2 z-50 animate-in fade-in select-none">
                      <div className="px-2 py-1 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                        选择用于统计聚合的数值列
                      </div>
                      <div className="max-h-56 overflow-y-auto space-y-1 mt-1">
                        {colList.map((col) => {
                          const isSelected = col.index === valueField;
                          return (
                            <button
                              key={col.index}
                              type="button"
                              onClick={() => {
                                setValueField(col.index);
                                setIsValuePopoverOpen(false);
                              }}
                              className={`w-full px-3 py-2 rounded-xl text-left text-xs flex items-center justify-between transition-colors ${
                                isSelected
                                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-300 font-bold'
                                  : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                              }`}
                            >
                              <div className="flex items-center space-x-2">
                                <span className="w-5 h-5 rounded-lg bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 flex items-center justify-center text-[10px] font-mono font-bold">
                                  {col.letter}
                                </span>
                                <span className="truncate">{col.name}</span>
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Aggregation Function Quick Chips */}
                <div>
                  <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-2">
                    聚合汇总方式 (Aggregation)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['SUM', 'AVERAGE', 'COUNT', 'MAX', 'MIN'] as const).map((mode) => {
                      const isSelected = aggregation === mode;
                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setAggregation(mode)}
                          className={`p-2 rounded-xl text-xs font-medium border transition-all text-center flex flex-col items-center justify-center space-y-1 ${
                            isSelected
                              ? 'bg-purple-600 text-white border-purple-600 shadow-xs font-semibold'
                              : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100'
                          }`}
                        >
                          <span className="text-xs">{aggLabels[mode].name.split(' ')[0]}</span>
                          <span className="text-[9px] opacity-80">{mode}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'calc' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Sorting Options */}
                <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 space-y-3">
                  <div className="flex items-center space-x-2">
                    <ArrowUpDown className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                      结果排序规则
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'none', label: '默认顺序' },
                      { key: 'desc', label: '降序 (高到低)' },
                      { key: 'asc', label: '升序 (低到高)' },
                    ].map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => setSortOrder(s.key as any)}
                        className={`py-2 px-2.5 rounded-xl text-xs font-medium border transition-all ${
                          sortOrder === s.key
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs font-semibold'
                            : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Calculation Summary Preview */}
                <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 space-y-2">
                  <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                    度量统计指标概览
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-750">
                      <div className="text-[10px] text-neutral-400">分类组数</div>
                      <div className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mt-0.5">
                        {processedRows.length} 项
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-750">
                      <div className="text-[10px] text-neutral-400">汇总总值</div>
                      <div className="text-sm font-bold text-purple-600 dark:text-purple-400 mt-0.5">
                        {totalValue.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'style' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="space-y-2">
                  <label className="flex items-center justify-between p-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/60 hover:bg-white dark:hover:bg-neutral-800 cursor-pointer transition-colors">
                    <div>
                      <div className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                        包含总计行 (Grand Total)
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        在透视表底部自动添加合计汇总行
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={showGrandTotal}
                      onChange={(e) => setShowGrandTotal(e.target.checked)}
                      className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/60 hover:bg-white dark:hover:bg-neutral-800 cursor-pointer transition-colors">
                    <div>
                      <div className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                        突出显示最高值 (Peak Highlight)
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        使用浅紫高亮标记各分类中的峰值数据
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={highlightMax}
                      onChange={(e) => setHighlightMax(e.target.checked)}
                      className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/60 hover:bg-white dark:hover:bg-neutral-800 cursor-pointer transition-colors">
                    <div>
                      <div className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                        格式化千分位数值
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        添加千位分隔符增强数字可读性
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={formatAsCurrency}
                      onChange={(e) => setFormatAsCurrency(e.target.checked)}
                      className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Live Interactive Pivot Preview Grid (7 cols) */}
          <div className="md:col-span-7 bg-neutral-50/90 dark:bg-[#141416] rounded-3xl p-4 border border-neutral-200/80 dark:border-neutral-800 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                  动态透视报表实时预览
                </h4>
              </div>
              <span className="text-[11px] font-mono text-neutral-400">
                {processedRows.length} 组分类 • {aggregation}
              </span>
            </div>

            {/* Pivot Table Display */}
            <div className="flex-1 overflow-auto rounded-2xl border border-neutral-200/90 dark:border-neutral-800 bg-white dark:bg-[#18181a] shadow-inner">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-100/90 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-10 backdrop-blur-xs">
                    <th className="px-4 py-2.5 font-bold text-neutral-700 dark:text-neutral-200">
                      {getRowFieldName()}
                    </th>
                    <th className="px-4 py-2.5 font-bold text-right text-purple-600 dark:text-purple-300">
                      {getValueFieldName()} ({aggregation})
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60 font-sans">
                  {processedRows.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-4 py-8 text-center text-neutral-400 text-xs">
                        当前配置下未生成有效的透视分类数据
                      </td>
                    </tr>
                  ) : (
                    processedRows.map((row, rIdx) => {
                      const numVal = Number(row[1]);
                      const isPeak = highlightMax && numVal === maxValue;
                      return (
                        <tr
                          key={rIdx}
                          className={`transition-colors ${
                            isPeak
                              ? 'bg-purple-50/80 dark:bg-purple-950/40 font-bold'
                              : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
                          }`}
                        >
                          <td className="px-4 py-2.5 font-medium text-neutral-800 dark:text-neutral-200">
                            {row[0]}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-semibold text-purple-600 dark:text-purple-400">
                            {formatAsCurrency && typeof numVal === 'number' && !isNaN(numVal)
                              ? numVal.toLocaleString()
                              : String(row[1])}
                          </td>
                        </tr>
                      );
                    })
                  )}

                  {/* Grand Total Row */}
                  {showGrandTotal && processedRows.length > 0 && (
                    <tr className="bg-purple-50/60 dark:bg-purple-950/30 border-t-2 border-purple-200 dark:border-purple-800 font-bold sticky bottom-0">
                      <td className="px-4 py-2.5 text-purple-900 dark:text-purple-200">
                        总计 (Grand Total)
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-purple-700 dark:text-purple-300">
                        {aggregation === 'AVERAGE'
                          ? averageValue.toFixed(2)
                          : totalValue.toLocaleString()}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-900/50">
          <div className="text-[11px] text-neutral-400">
            透视表将自动生成独立工作表，并保留公式结构与格式
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-200/80 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleExportToNewSheet}
              className="flex items-center space-x-2 px-5 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 active:scale-[0.98] text-white shadow-md transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>作为新工作表插入 (Insert Sheet)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
