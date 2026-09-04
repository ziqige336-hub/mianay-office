import React, { useState, useRef, useEffect } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import {
  X,
  BarChart3,
  TrendingUp,
  PieChart as PieIcon,
  Activity,
  Layers,
  Check,
  ChevronDown,
  Palette,
  Sliders,
  Sparkles,
  AreaChart as AreaIcon,
} from 'lucide-react';
import type { SheetData } from '../../types';
import { colIndexToLetter, getCellValue, getCellValueNumber } from '../../utils/sheetUtils';

interface SheetChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  sheetData: SheetData;
  onInsertChart?: (chartConfig: any) => void;
}

const PALETTES: Record<string, string[]> = {
  apple: ['#0071e3', '#34c759', '#ff9500', '#ff2d55', '#af52de', '#5856d6'],
  business: ['#1e40af', '#0d9488', '#d97706', '#dc2626', '#7c3aed', '#db2777'],
  morandi: ['#78716c', '#64748b', '#a8a29e', '#94a3b8', '#57534e', '#475569'],
  emerald: ['#059669', '#10b981', '#34d399', '#6ee7b7', '#047857', '#065f46'],
};

export const SheetChartModal: React.FC<SheetChartModalProps> = ({
  isOpen,
  onClose,
  sheetData,
}) => {
  // Tabs
  const [activeTab, setActiveTab] = useState<'data' | 'theme' | 'axis'>('data');

  // Chart configuration
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie' | 'radar' | 'area'>('bar');
  const [labelCol, setLabelCol] = useState(0);
  const [valueCols, setValueCols] = useState<number[]>([1, 2]);
  const [selectedPalette, setSelectedPalette] = useState<keyof typeof PALETTES>('apple');
  const [showGrid, setShowGrid] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [isCurvedLine, setIsCurvedLine] = useState(true);

  // Label Column Popover
  const [isLabelPopoverOpen, setIsLabelPopoverOpen] = useState(false);
  const labelButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (labelButtonRef.current && !labelButtonRef.current.contains(e.target as Node)) {
        setIsLabelPopoverOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (!isOpen) return null;

  const currentColors = PALETTES[selectedPalette] || PALETTES.apple;

  // Extract chart data points from sheet
  const chartData: any[] = [];
  const startRow = 1;
  const endRow = Math.min(sheetData.rows - 1, 15);

  for (let r = startRow; r <= endRow; r++) {
    const label = String(getCellValue(r, labelCol, sheetData.cells) || `行 ${r + 1}`);
    const item: any = { name: label };

    valueCols.forEach((colIdx) => {
      const colHeader = String(getCellValue(0, colIdx, sheetData.cells) || `列 ${colIndexToLetter(colIdx)}`);
      item[colHeader] = getCellValueNumber(r, colIdx, sheetData.cells);
    });

    chartData.push(item);
  }

  const seriesKeys = valueCols.map((c) =>
    String(getCellValue(0, c, sheetData.cells) || `列 ${colIndexToLetter(c)}`)
  );

  const colList = Array.from({ length: Math.min(sheetData.cols, 10) }).map((_, idx) => ({
    index: idx,
    letter: colIndexToLetter(idx),
    name: String(getCellValue(0, idx, sheetData.cells) || `列 ${colIndexToLetter(idx)}`),
  }));

  const getLabelColName = () => colList.find((c) => c.index === labelCol)?.name || `列 ${colIndexToLetter(labelCol)}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        className="bg-white dark:bg-[#18181a] border border-neutral-200/80 dark:border-neutral-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Apple Style Header */}
        <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-900/50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20 shadow-xs">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
                  智能数据可视化分析
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 rounded-full">
                  Smart Chart
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                基于实时工作表的多维动态图形化呈现引擎
              </p>
            </div>
          </div>

          {/* Segmented Tab Control */}
          <div className="flex items-center bg-neutral-200/70 dark:bg-neutral-800 p-1 rounded-xl text-xs font-medium space-x-1">
            <button
              type="button"
              onClick={() => setActiveTab('data')}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeTab === 'data'
                  ? 'bg-white dark:bg-[#242426] text-blue-600 dark:text-blue-300 shadow-xs font-semibold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              类型与数据
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('theme')}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeTab === 'theme'
                  ? 'bg-white dark:bg-[#242426] text-blue-600 dark:text-blue-300 shadow-xs font-semibold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              配色与主题
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('axis')}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeTab === 'axis'
                  ? 'bg-white dark:bg-[#242426] text-blue-600 dark:text-blue-300 shadow-xs font-semibold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              显示与网格
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 flex-1 overflow-hidden">
          {/* Left: Options depending on active tab (5 cols) */}
          <div className="md:col-span-5 flex flex-col space-y-4 overflow-y-auto pr-1">
            {activeTab === 'data' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* 1. Chart Types */}
                <div>
                  <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1.5">
                    图表表现形态 (Chart Category)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { type: 'bar', label: '柱状对比图', icon: BarChart3 },
                      { type: 'line', label: '折线走势图', icon: TrendingUp },
                      { type: 'area', label: '面积堆叠图', icon: AreaIcon },
                      { type: 'pie', label: '饼状占比图', icon: PieIcon },
                      { type: 'radar', label: '多维雷达图', icon: Activity },
                    ].map((item) => {
                      const Icon = item.icon;
                      const isSelected = chartType === item.type;
                      return (
                        <button
                          key={item.type}
                          type="button"
                          onClick={() => setChartType(item.type as any)}
                          className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                            isSelected
                              ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-500 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                              : 'border-neutral-200 dark:border-neutral-750 bg-neutral-50/70 dark:bg-neutral-800/70 text-neutral-700 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-800'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Interactive X-Axis / Label Column Popover Button */}
                <div className="relative" ref={labelButtonRef}>
                  <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1.5">
                    横轴 / 维度类别列 (X-Axis)
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsLabelPopoverOpen(!isLabelPopoverOpen)}
                    className={`w-full p-2.5 rounded-2xl border text-left transition-all flex items-center justify-between shadow-2xs ${
                      isLabelPopoverOpen
                        ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/50 dark:bg-blue-950/30'
                        : 'border-neutral-200 dark:border-neutral-750 bg-neutral-50/80 dark:bg-neutral-800/80 hover:bg-white dark:hover:bg-neutral-800'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold text-xs">
                        {colIndexToLetter(labelCol)}
                      </div>
                      <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                        {getLabelColName()}
                      </span>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 ${isLabelPopoverOpen ? 'rotate-180 text-blue-500' : ''}`} />
                  </button>

                  {/* Popover */}
                  {isLabelPopoverOpen && (
                    <div className="absolute left-0 top-full mt-2 w-full bg-white dark:bg-[#1f1f22] border border-neutral-200 dark:border-neutral-700 rounded-2xl shadow-xl p-2 z-50 animate-in fade-in select-none">
                      <div className="px-2 py-1 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                        选择作为横坐标维度的列
                      </div>
                      <div className="max-h-52 overflow-y-auto space-y-1 mt-1">
                        {colList.map((col) => {
                          const isSelected = col.index === labelCol;
                          return (
                            <button
                              key={col.index}
                              type="button"
                              onClick={() => {
                                setLabelCol(col.index);
                                setIsLabelPopoverOpen(false);
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

                {/* 3. Value Series (Y-Axis) */}
                <div>
                  <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1.5">
                    数据系列度量列 (Y-Axis Series)
                  </label>
                  <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
                    {colList.map((col) => {
                      if (col.index === labelCol) return null;
                      const isChecked = valueCols.includes(col.index);
                      return (
                        <label
                          key={col.index}
                          className="flex items-center justify-between text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer p-2 rounded-xl border border-neutral-200/60 dark:border-neutral-800/80 hover:bg-neutral-100/70 dark:hover:bg-neutral-800/50 transition-colors"
                        >
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setValueCols([...valueCols, col.index]);
                                } else {
                                  setValueCols(valueCols.filter((c) => c !== col.index));
                                }
                              }}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                            <span className="w-5 h-5 rounded bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 flex items-center justify-center text-[10px] font-mono font-bold">
                              {col.letter}
                            </span>
                            <span className="truncate font-medium">{col.name}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'theme' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div>
                  <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-2">
                    配色方案 (Color Palettes)
                  </label>
                  <div className="space-y-2">
                    {[
                      { key: 'apple', label: 'Apple Numbers 经典', desc: '明朗清澈的 macOS 经典调色' },
                      { key: 'business', label: '商务专业蓝 (Corporate)', desc: '沉稳大气的企业报表色' },
                      { key: 'morandi', label: '莫兰迪冷灰 (Modern)', desc: '极简低饱和现代质感' },
                      { key: 'emerald', label: '翡翠生机绿 (Emerald)', desc: '清新自然的财务分析配色' },
                    ].map((p) => {
                      const isSelected = selectedPalette === p.key;
                      const colors = PALETTES[p.key];
                      return (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => setSelectedPalette(p.key as any)}
                          className={`w-full p-3 rounded-2xl border text-left transition-all ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-2 ring-blue-500/20'
                              : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                              {p.label}
                            </span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                          </div>
                          <div className="flex items-center space-x-1.5">
                            {colors.map((c, i) => (
                              <div
                                key={i}
                                className="w-5 h-5 rounded-full border border-black/10 shadow-2xs"
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'axis' && (
              <div className="space-y-3 animate-in fade-in duration-150">
                <label className="flex items-center justify-between p-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/60 hover:bg-white dark:hover:bg-neutral-800 cursor-pointer transition-colors">
                  <div>
                    <div className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                      显示背景辅助网格线
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      渲染水平与垂直虚线网格
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={showGrid}
                    onChange={(e) => setShowGrid(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/60 hover:bg-white dark:hover:bg-neutral-800 cursor-pointer transition-colors">
                  <div>
                    <div className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                      显示图表图例 (Legend)
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      在图表下方展示各数据系列说明
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={showLegend}
                    onChange={(e) => setShowLegend(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/60 hover:bg-white dark:hover:bg-neutral-800 cursor-pointer transition-colors">
                  <div>
                    <div className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                      平滑曲线渲染 (Smooth Curve)
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      折线图与面积图应用样条贝塞尔插值
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isCurvedLine}
                    onChange={(e) => setIsCurvedLine(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Right: Chart Canvas (7 cols) */}
          <div className="md:col-span-7 bg-neutral-50/90 dark:bg-[#141416] rounded-3xl p-4 border border-neutral-200/80 dark:border-neutral-800 flex flex-col justify-center min-h-[340px] overflow-hidden">
            {chartType === 'bar' && (
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  {showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.2} />}
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 16, border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }} />
                  {showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
                  {seriesKeys.map((key, i) => (
                    <Bar key={key} dataKey={key} fill={currentColors[i % currentColors.length]} radius={[6, 6, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}

            {chartType === 'line' && (
              <ResponsiveContainer width="100%" height={340}>
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  {showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.2} />}
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 16, border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }} />
                  {showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
                  {seriesKeys.map((key, i) => (
                    <Line
                      key={key}
                      type={isCurvedLine ? 'monotone' : 'linear'}
                      dataKey={key}
                      stroke={currentColors[i % currentColors.length]}
                      strokeWidth={2.5}
                      dot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}

            {chartType === 'area' && (
              <ResponsiveContainer width="100%" height={340}>
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  {showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.2} />}
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 16, border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }} />
                  {showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
                  {seriesKeys.map((key, i) => (
                    <Area
                      key={key}
                      type={isCurvedLine ? 'monotone' : 'linear'}
                      dataKey={key}
                      stroke={currentColors[i % currentColors.length]}
                      fill={currentColors[i % currentColors.length]}
                      fillOpacity={0.25}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}

            {chartType === 'pie' && (
              <ResponsiveContainer width="100%" height={340}>
                <PieChart>
                  <Tooltip contentStyle={{ borderRadius: 16, border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }} />
                  {showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
                  <Pie
                    data={chartData}
                    dataKey={seriesKeys[0] || 'name'}
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={105}
                    innerRadius={45}
                    paddingAngle={3}
                  >
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={currentColors[index % currentColors.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}

            {chartType === 'radar' && (
              <ResponsiveContainer width="100%" height={340}>
                <RadarChart cx="50%" cy="50%" outerRadius={105} data={chartData}>
                  {showGrid && <PolarGrid opacity={0.3} />}
                  <PolarAngleAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis tick={{ fontSize: 10 }} />
                  {seriesKeys.map((key, i) => (
                    <Radar
                      key={key}
                      name={key}
                      dataKey={key}
                      stroke={currentColors[i % currentColors.length]}
                      fill={currentColors[i % currentColors.length]}
                      fillOpacity={0.35}
                    />
                  ))}
                  {showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
                  <Tooltip contentStyle={{ borderRadius: 16, border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-900/50">
          <div className="text-[11px] text-neutral-400">
            图表渲染随表格单元格数值变更自适应动态刷新
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white shadow-md transition-all"
          >
            完成并保留
          </button>
        </div>
      </div>
    </div>
  );
};
