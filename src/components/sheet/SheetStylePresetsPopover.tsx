import React from 'react';
import { Palette, Check, Sparkles, Sliders } from 'lucide-react';
import type { SheetCell } from '../../types';

interface SheetStylePresetsPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyCellStyle: (style: Partial<SheetCell>) => void;
  onApplyTableTheme: (theme: {
    name: string;
    headerBg: string;
    headerColor: string;
    headerBorder: string;
    alternateBg?: string;
    totalBg: string;
    totalBorder: string;
  }) => void;
}

const CELL_PRESETS: {
  name: string;
  category: string;
  style: Partial<SheetCell>;
  previewBg: string;
  previewColor: string;
}[] = [
  // Typography Hierarchy
  {
    name: '大标题 (Title)',
    category: '排版',
    style: { bold: true, fontSize: 16, color: '#0f172a', bg: undefined },
    previewBg: '#ffffff',
    previewColor: '#0f172a',
  },
  {
    name: '强调表头 (Header 1)',
    category: '排版',
    style: { bold: true, fontSize: 11, color: '#ffffff', bg: '#1e293b', align: 'center', borders: { bottom: true, color: '#0f172a', style: 'medium' } },
    previewBg: '#1e293b',
    previewColor: '#ffffff',
  },
  {
    name: '柔和表头 (Header 2)',
    category: '排版',
    style: { bold: true, fontSize: 11, color: '#334155', bg: '#f1f5f9', align: 'center', borders: { bottom: true, color: '#cbd5e1', style: 'medium' } },
    previewBg: '#f1f5f9',
    previewColor: '#334155',
  },
  {
    name: '合计总计 (Total)',
    category: '计算',
    style: { bold: true, fontSize: 11, color: '#0f172a', bg: '#f8fafc', borders: { top: true, bottom: true, color: '#475569', style: 'double' } },
    previewBg: '#f8fafc',
    previewColor: '#0f172a',
  },
  {
    name: '计算单元格 (Formula Cell)',
    category: '计算',
    style: { italic: true, fontSize: 11, color: '#2563eb', bg: '#eff6ff', borders: { bottom: true, color: '#93c5fd', style: 'dashed' } },
    previewBg: '#eff6ff',
    previewColor: '#2563eb',
  },
  // Status Colors
  {
    name: '优秀 / 达标 (Good)',
    category: '状态',
    style: { bold: true, color: '#15803d', bg: '#dcfce7' },
    previewBg: '#dcfce7',
    previewColor: '#15803d',
  },
  {
    name: '预警 / 关注 (Warning)',
    category: '状态',
    style: { bold: true, color: '#a16207', bg: '#fef9c3' },
    previewBg: '#fef9c3',
    previewColor: '#a16207',
  },
  {
    name: '危险 / 未达标 (Bad)',
    category: '状态',
    style: { bold: true, color: '#b91c1c', bg: '#fee2e2' },
    previewBg: '#fee2e2',
    previewColor: '#b91c1c',
  },
  {
    name: '中性说明 (Neutral)',
    category: '状态',
    style: { color: '#475569', bg: '#f1f5f9' },
    previewBg: '#f1f5f9',
    previewColor: '#475569',
  },
  {
    name: '重点强调 (Accent)',
    category: '强调',
    style: { bold: true, color: '#4338ca', bg: '#e0e7ff', borders: { left: true, color: '#4f46e5', style: 'thick' } },
    previewBg: '#e0e7ff',
    previewColor: '#4338ca',
  },
];

const TABLE_THEMES = [
  {
    name: '极简商务蓝 (Corporate Blue)',
    headerBg: '#1e40af',
    headerColor: '#ffffff',
    headerBorder: '#1d4ed8',
    alternateBg: '#f8fafc',
    totalBg: '#dbeafe',
    totalBorder: '#1e40af',
  },
  {
    name: '清新薄荷绿 (Mint Emerald)',
    headerBg: '#065f46',
    headerColor: '#ffffff',
    headerBorder: '#047857',
    alternateBg: '#f0fdf4',
    totalBg: '#d1fae5',
    totalBorder: '#065f46',
  },
  {
    name: '现代极简黑灰 (Modern Slate)',
    headerBg: '#18181b',
    headerColor: '#ffffff',
    headerBorder: '#27272a',
    alternateBg: '#f4f4f5',
    totalBg: '#e4e4e7',
    totalBorder: '#18181b',
  },
  {
    name: '优雅典雅紫 (Royal Violet)',
    headerBg: '#581c87',
    headerColor: '#ffffff',
    headerBorder: '#6b21a8',
    alternateBg: '#faf5ff',
    totalBg: '#f3e8ff',
    totalBorder: '#581c87',
  },
  {
    name: '暖阳活力橙 (Warm Amber)',
    headerBg: '#c2410c',
    headerColor: '#ffffff',
    headerBorder: '#ea580c',
    alternateBg: '#fff7ed',
    totalBg: '#ffedd5',
    totalBorder: '#c2410c',
  },
];

export const SheetStylePresetsPopover: React.FC<SheetStylePresetsPopoverProps> = ({
  isOpen,
  onClose,
  onApplyCellStyle,
  onApplyTableTheme,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="sheet-style-presets-popover"
      className="absolute top-12 left-64 z-50 w-80 bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-700 p-4 space-y-4 text-neutral-800 dark:text-neutral-100 backdrop-blur-2xl"
    >
      {/* Title */}
      <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-700 pb-2">
        <div className="flex items-center space-x-1.5 font-semibold text-xs text-neutral-700 dark:text-neutral-300">
          <Palette className="w-3.5 h-3.5 text-blue-500" />
          <span>单元格与表格预设样式</span>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
        >
          关闭
        </button>
      </div>

      {/* 1. Cell Presets */}
      <div className="space-y-2">
        <div className="text-[11px] font-medium text-neutral-500">单元格样式预设</div>
        <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
          {CELL_PRESETS.map((preset) => (
            <button
              key={preset.name}
              onClick={() => {
                onApplyCellStyle(preset.style);
                onClose();
              }}
              className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-700/80 text-left transition-all hover:scale-[1.02] flex flex-col justify-between"
              style={{ backgroundColor: preset.previewBg }}
            >
              <span
                className="text-[11px] font-medium truncate w-full"
                style={{ color: preset.previewColor }}
              >
                {preset.name}
              </span>
              <span className="text-[9px] opacity-60 mt-1" style={{ color: preset.previewColor }}>
                {preset.category}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Full Table Themes */}
      <div className="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-800/80">
        <div className="flex items-center space-x-1 text-[11px] font-medium text-neutral-500">
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span>一键应用专业表格配色</span>
        </div>
        <div className="space-y-1.5">
          {TABLE_THEMES.map((theme) => (
            <button
              key={theme.name}
              onClick={() => {
                onApplyTableTheme(theme);
                onClose();
              }}
              className="w-full p-2 rounded-xl border border-neutral-200 dark:border-neutral-700/80 hover:border-blue-500 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 flex items-center justify-between text-xs transition-colors"
            >
              <div className="flex items-center space-x-2">
                <div
                  className="w-4 h-4 rounded-full border border-neutral-300 dark:border-neutral-600 shadow-xs"
                  style={{ backgroundColor: theme.headerBg }}
                />
                <span className="text-neutral-700 dark:text-neutral-300 font-medium">
                  {theme.name}
                </span>
              </div>
              <span className="text-[10px] text-neutral-400">应用</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
