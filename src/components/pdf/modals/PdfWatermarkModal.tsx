import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Type,
  Image as ImageIcon,
  RotateCw,
  Grid,
  Check,
  Download,
} from 'lucide-react';
import type { WatermarkConfig } from '../../../types';

interface PdfWatermarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: WatermarkConfig;
  onChangeConfig: (cfg: Partial<WatermarkConfig>) => void;
  onApplyWatermark: () => void;
}

export const PdfWatermarkModal: React.FC<PdfWatermarkModalProps> = ({
  isOpen,
  onClose,
  config,
  onChangeConfig,
  onApplyWatermark,
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
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              添加防伪 / 版权水印
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
        <div className="p-5 space-y-4 max-h-[420px] overflow-y-auto">
          {/* Watermark Type */}
          <div className="flex items-center space-x-2 bg-black/[0.03] dark:bg-white/[0.05] p-1 rounded-xl">
            <button
              onClick={() => onChangeConfig({ type: 'text' })}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center space-x-1.5 transition-all ${
                config.type === 'text'
                  ? 'bg-white dark:bg-[#2c2c2e] text-blue-600 shadow-xs font-semibold'
                  : 'text-neutral-600'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              <span>文字水印</span>
            </button>
            <button
              onClick={() => onChangeConfig({ type: 'image' })}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center space-x-1.5 transition-all ${
                config.type === 'image'
                  ? 'bg-white dark:bg-[#2c2c2e] text-blue-600 shadow-xs font-semibold'
                  : 'text-neutral-600'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>图片水印</span>
            </button>
          </div>

          {config.type === 'text' ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1 block">
                  水印文字内容
                </label>
                <input
                  type="text"
                  value={config.text}
                  onChange={(e) => onChangeConfig({ text: e.target.value })}
                  placeholder="例：内部绝密 · 仅供审阅"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.1] text-neutral-900 dark:text-neutral-100 font-medium"
                />
              </div>

              {/* Presets */}
              <div className="flex flex-wrap gap-1.5">
                {['绝密文件', '内部资料', '严禁外传', '样本文档', '已审核', 'CONFIDENTIAL'].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => onChangeConfig({ text: preset })}
                    className="px-2 py-1 text-[11px] rounded-lg bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] text-neutral-700 dark:text-neutral-300"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              {/* Font Size & Color */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1 block">
                    字体大小 ({config.fontSize} pt)
                  </label>
                  <input
                    type="range"
                    min={16}
                    max={72}
                    value={config.fontSize}
                    onChange={(e) => onChangeConfig({ fontSize: Number(e.target.value) })}
                    className="w-full h-1 bg-black/[0.08] dark:bg-white/[0.1] rounded-lg accent-blue-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1 block">
                    水印颜色
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={config.color}
                      onChange={(e) => onChangeConfig({ color: e.target.value })}
                      className="w-8 h-8 rounded border cursor-pointer"
                    />
                    <span className="text-xs font-mono text-neutral-600">{config.color}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1 block">
                选择图片水印
              </label>
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    const reader = new FileReader();
                    reader.onload = () => {
                      onChangeConfig({ imageUrl: reader.result as string });
                    };
                    reader.readAsDataURL(e.target.files[0]);
                  }
                }}
                className="w-full text-xs file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-950/40 dark:file:text-blue-300"
              />
            </div>
          )}

          {/* Opacity & Rotation */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-black/[0.06] dark:border-white/[0.08]">
            <div>
              <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1 block">
                透明度 ({Math.round(config.opacity * 100)}%)
              </label>
              <input
                type="range"
                min={5}
                max={90}
                value={Math.round(config.opacity * 100)}
                onChange={(e) => onChangeConfig({ opacity: Number(e.target.value) / 100 })}
                className="w-full h-1 bg-black/[0.08] dark:bg-white/[0.1] rounded-lg accent-blue-600"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1 block">
                旋转角度 ({config.rotation}°)
              </label>
              <input
                type="range"
                min={-90}
                max={90}
                value={config.rotation}
                onChange={(e) => onChangeConfig({ rotation: Number(e.target.value) })}
                className="w-full h-1 bg-black/[0.08] dark:bg-white/[0.1] rounded-lg accent-blue-600"
              />
            </div>
          </div>

          {/* Tile grid toggle */}
          <div className="bg-black/[0.02] dark:bg-white/[0.04] p-3 rounded-xl flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Grid className="w-4 h-4 text-neutral-500" />
              <div>
                <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200 block">
                  平铺全页水印矩阵
                </span>
                <span className="text-[11px] text-neutral-400">
                  开启后多行多列覆盖整页，防拍照窃取
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={config.isTiled}
              onChange={(e) => onChangeConfig({ isTiled: e.target.checked })}
              className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-black/[0.02] dark:bg-white/[0.02] border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-black/[0.04]"
          >
            取消
          </button>
          <button
            onClick={() => {
              onApplyWatermark();
              onClose();
            }}
            className="px-4 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-xs flex items-center space-x-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>应用并烧录到文档</span>
          </button>
        </div>
      </div>
    </div>
  );
};
