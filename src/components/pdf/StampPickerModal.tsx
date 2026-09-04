import React, { useState } from 'react';
import { X, Stamp, Check } from 'lucide-react';
import type { StampType } from '../../types';

interface StampPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStamp: (stampType: StampType, customText?: string, color?: string) => void;
}

const PRESET_STAMPS: { type: StampType; label: string; text: string; color: string }[] = [
  { type: 'APPROVED', label: '已审核 / APPROVED', text: 'APPROVED 已核准', color: '#16a34a' },
  { type: 'CONFIDENTIAL', label: '商业机密 / CONFIDENTIAL', text: 'CONFIDENTIAL 绝密', color: '#dc2626' },
  { type: 'URGENT', label: '加急处理 / URGENT', text: 'URGENT 特急', color: '#ea580c' },
  { type: 'PAID', label: '款项已付 / PAID', text: 'PAID 已付讫', color: '#2563eb' },
  { type: 'COMPLETED', label: '业务办结 / COMPLETED', text: 'COMPLETED 办结', color: '#0d9488' },
  { type: 'DRAFT', label: '内部草案 / DRAFT', text: 'DRAFT 工作草案', color: '#7c3aed' },
  { type: 'REJECTED', label: '予以驳回 / REJECTED', text: 'REJECTED 驳回', color: '#991b1b' },
];

export const StampPickerModal: React.FC<StampPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectStamp,
}) => {
  const [selectedType, setSelectedType] = useState<StampType>('APPROVED');
  const [customText, setCustomText] = useState('');
  const [customColor, setCustomColor] = useState('#dc2626');

  if (!isOpen) return null;

  const handleApply = () => {
    if (selectedType === 'CUSTOM') {
      onSelectStamp('CUSTOM', customText.trim() || '自定义印章', customColor);
    } else {
      const preset = PRESET_STAMPS.find((s) => s.type === selectedType);
      onSelectStamp(selectedType, preset?.text, preset?.color);
    }
    onClose();
  };

  return (
    <div
      data-no-canvas-click="true"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4"
    >
      <div className="w-full max-w-md bg-white dark:bg-[#1c1c1e] rounded-2xl shadow-2xl border border-neutral-200/80 dark:border-neutral-800 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Stamp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                选择审批印章与标记
              </h3>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                支持标准商务预设印章与自定义文字图章
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-1 gap-2.5">
            {PRESET_STAMPS.map((s) => {
              const isSelected = selectedType === s.type;
              return (
                <div
                  key={s.type}
                  onClick={() => setSelectedType(s.type)}
                  className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                      : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className="px-3 py-1 rounded-md border-2 font-bold text-xs tracking-wider uppercase"
                      style={{ borderColor: s.color, color: s.color }}
                    >
                      {s.text}
                    </div>
                    <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      {s.label}
                    </span>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                </div>
              );
            })}

            {/* Custom Stamp Option */}
            <div
              onClick={() => setSelectedType('CUSTOM')}
              className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                selectedType === 'CUSTOM'
                  ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                  : 'border-neutral-200 dark:border-neutral-800'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200">
                  自定义文字印章
                </span>
                {selectedType === 'CUSTOM' && <Check className="w-4 h-4 text-blue-600" />}
              </div>

              {selectedType === 'CUSTOM' && (
                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="text"
                    placeholder="输入印章文本 (例: 合同专用章)"
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="color"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-neutral-300 dark:border-neutral-700"
                    title="选择印章颜色"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-2 px-5 py-3.5 bg-neutral-50 dark:bg-neutral-900/50 border-t border-neutral-100 dark:border-neutral-800">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium rounded-xl text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleApply}
            className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all active:scale-95"
          >
            确认放置印章
          </button>
        </div>
      </div>
    </div>
  );
};
