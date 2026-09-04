import React, { useState } from 'react';
import { Sparkles, Plus, Trash2, X, Check, Eye } from 'lucide-react';
import type { ConditionalFormattingRule, SheetData } from '../../types';

interface SheetConditionalFormatModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSheet: SheetData;
  onUpdateRules: (rules: ConditionalFormattingRule[]) => void;
  defaultRange?: string;
  onShowToast?: (type: 'success' | 'error' | 'info', title: string, description?: string) => void;
}

const COLOR_PRESETS = [
  { label: '绿底深绿字 (正常/优秀)', bg: '#dcfce7', color: '#166534' },
  { label: '红底深红字 (警告/不达标)', bg: '#fee2e2', color: '#991b1b' },
  { label: '黄底深褐字 (中度预警)', bg: '#fef3c7', color: '#92400e' },
  { label: '蓝底深蓝字 (重点关注)', bg: '#dbeafe', color: '#1e40af' },
  { label: '紫底深紫字 (特别标记)', bg: '#f3e8ff', color: '#6b21a8' },
];

export const SheetConditionalFormatModal: React.FC<SheetConditionalFormatModalProps> = ({
  isOpen,
  onClose,
  activeSheet,
  onUpdateRules,
  defaultRange = 'A1:Z50',
  onShowToast,
}) => {
  const [rules, setRules] = useState<ConditionalFormattingRule[]>(
    activeSheet.conditionalRules || []
  );

  // New rule draft state
  const [newRange, setNewRange] = useState(defaultRange);
  const [newType, setNewType] = useState<ConditionalFormattingRule['type']>('greaterThan');
  const [val1, setVal1] = useState<string>('100000');
  const [val2, setVal2] = useState<string>('500000');
  const [selectedPreset, setSelectedPreset] = useState(0);

  if (!isOpen) return null;

  const handleAddRule = () => {
    if (!newRange.trim()) {
      onShowToast?.('error', '请输入有效的单元格区域', '例如 B2:B20');
      return;
    }

    const preset = COLOR_PRESETS[selectedPreset];
    const newRule: ConditionalFormattingRule = {
      id: `rule-${Date.now()}`,
      range: newRange.toUpperCase().trim(),
      type: newType,
      value1: val1,
      value2: newType === 'between' ? Number(val2) : undefined,
      bg: preset.bg,
      color: preset.color,
    };

    const updated = [...rules, newRule];
    setRules(updated);
    onUpdateRules(updated);
    onShowToast?.('success', '已添加条件格式规则');
  };

  const handleDeleteRule = (id: string) => {
    const updated = rules.filter((r) => r.id !== id);
    setRules(updated);
    onUpdateRules(updated);
    onShowToast?.('info', '已删除规则');
  };

  const getRuleDescription = (rule: ConditionalFormattingRule) => {
    switch (rule.type) {
      case 'greaterThan':
        return `单元格值 > ${rule.value1}`;
      case 'lessThan':
        return `单元格值 < ${rule.value1}`;
      case 'between':
        return `单元格值介于 ${rule.value1} 与 ${rule.value2} 之间`;
      case 'equal':
        return `单元格值等于 "${rule.value1}"`;
      case 'contains':
        return `文本包含 "${rule.value1}"`;
      case 'duplicate':
        return `高亮重复值`;
      default:
        return '自定义格式规则';
    }
  };

  return (
    <div
      id="sheet-conditional-format-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-[#18181b] rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 p-5 space-y-4 text-neutral-800 dark:text-neutral-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800/80 pb-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">条件格式管理器 (Conditional Formatting)</h3>
              <p className="text-[11px] text-neutral-500">根据数据阈值与文本规则自动着色高亮</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Existing Rules List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              当前工作表规则 ({rules.length})
            </span>
          </div>

          <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
            {rules.length === 0 ? (
              <div className="p-4 text-center text-xs text-neutral-400 bg-neutral-50 dark:bg-neutral-900 rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800">
                暂无条件格式规则，请在下方创建新规则
              </div>
            ) : (
              rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 text-xs"
                >
                  <div className="flex items-center space-x-2.5">
                    <div
                      className="w-5 h-5 rounded-md border border-neutral-300 dark:border-neutral-600 flex items-center justify-center font-bold text-[10px]"
                      style={{ backgroundColor: rule.bg, color: rule.color }}
                    >
                      Aa
                    </div>
                    <div>
                      <div className="font-medium text-neutral-800 dark:text-neutral-200">
                        {getRuleDescription(rule)}
                      </div>
                      <div className="text-[10px] text-neutral-400 font-mono">应用区域: {rule.range}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="p-1 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Add New Rule Section */}
        <div className="p-3.5 bg-neutral-50 dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-3">
          <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
            新建条件格式规则
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="text-[10px] font-medium text-neutral-500 block mb-1">应用区域</label>
              <input
                type="text"
                value={newRange}
                onChange={(e) => setNewRange(e.target.value.toUpperCase())}
                placeholder="例如 B2:B20"
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
              />
            </div>

            <div>
              <label className="text-[10px] font-medium text-neutral-500 block mb-1">规则类型</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as any)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
              >
                <option value="greaterThan">大于 (Greater Than)</option>
                <option value="lessThan">小于 (Less Than)</option>
                <option value="between">介于 (Between)</option>
                <option value="equal">等于 (Equal To)</option>
                <option value="contains">包含文本 (Contains)</option>
              </select>
            </div>
          </div>

          {/* Condition inputs */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-medium text-neutral-500 block mb-1">
                {newType === 'between' ? '起始阈值' : '条件数值 / 文本'}
              </label>
              <input
                type="text"
                value={val1}
                onChange={(e) => setVal1(e.target.value)}
                placeholder="输入阈值..."
                className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
              />
            </div>

            {newType === 'between' && (
              <div>
                <label className="text-[10px] font-medium text-neutral-500 block mb-1">结束阈值</label>
                <input
                  type="text"
                  value={val2}
                  onChange={(e) => setVal2(e.target.value)}
                  placeholder="输入上限..."
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
                />
              </div>
            )}
          </div>

          {/* Color preset swatches */}
          <div>
            <label className="text-[10px] font-medium text-neutral-500 block mb-1.5">高亮样式预设</label>
            <div className="grid grid-cols-1 gap-1.5">
              {COLOR_PRESETS.map((preset, idx) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setSelectedPreset(idx)}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs text-left transition-all ${
                    selectedPreset === idx
                      ? 'border-emerald-500 ring-2 ring-emerald-500/20 font-semibold'
                      : 'border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                  style={{ backgroundColor: preset.bg, color: preset.color }}
                >
                  <span>{preset.label}</span>
                  {selectedPreset === idx && <Check className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleAddRule}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>添加此规则</span>
          </button>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-1">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
