import React from 'react';
import { X, Ruler, Check } from 'lucide-react';

interface PdfMeasureModalProps {
  isOpen: boolean;
  onClose: () => void;
  scaleRatio: number;
  onChangeScaleRatio: (scale: number) => void;
  unit: 'mm' | 'cm' | 'm';
  onChangeUnit: (unit: 'mm' | 'cm' | 'm') => void;
  onSelectMeasureMode: (mode: 'measure-distance' | 'measure-area') => void;
}

export const PdfMeasureModal: React.FC<PdfMeasureModalProps> = ({
  isOpen,
  onClose,
  scaleRatio,
  onChangeScaleRatio,
  unit,
  onChangeUnit,
  onSelectMeasureMode,
}) => {
  if (!isOpen) return null;

  return (
    <div
      data-no-canvas-click="true"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in"
    >
      <div className="w-full max-w-md bg-white dark:bg-[#1e1e20] rounded-2xl shadow-2xl border border-black/[0.08] dark:border-white/[0.1] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Ruler className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              工程图纸精准测量设置
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-2 block">
              图纸比例尺预设 (Scale Ratio)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[1, 10, 20, 50, 100, 200, 500, 1000].map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => onChangeScaleRatio(ratio)}
                  className={`py-2 rounded-xl border text-xs font-mono font-medium transition-all ${
                    scaleRatio === ratio
                      ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/30 text-blue-600 ring-1 ring-blue-600'
                      : 'border-black/[0.08] dark:border-white/[0.1] text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  1:{ratio}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-2 block">
              测量单位
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['mm', 'cm', 'm'] as const).map((u) => (
                <button
                  key={u}
                  onClick={() => onChangeUnit(u)}
                  className={`py-1.5 rounded-xl border text-xs font-medium uppercase transition-all ${
                    unit === u
                      ? 'border-blue-600 bg-blue-50 text-blue-600'
                      : 'border-black/[0.08] text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.08] grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                onSelectMeasureMode('measure-distance');
                onClose();
              }}
              className="py-2.5 rounded-xl text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center space-x-1.5"
            >
              <Ruler className="w-3.5 h-3.5" />
              <span>测量线段距离</span>
            </button>
            <button
              onClick={() => {
                onSelectMeasureMode('measure-area');
                onClose();
              }}
              className="py-2.5 rounded-xl text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center space-x-1.5"
            >
              <Ruler className="w-3.5 h-3.5" />
              <span>测量多边形面积</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
