import React, { useState } from 'react';
import {
  Eraser,
  Sparkles,
  ShieldCheck,
  CheckSquare,
  Square,
  X,
  RefreshCw,
  Info,
  Check,
} from 'lucide-react';
import type { DetectedWatermarkItem } from '../../types';

interface PdfWatermarkEraserProps {
  isOpen: boolean;
  onClose: () => void;
  watermarks: DetectedWatermarkItem[];
  onToggleWatermark: (id: string) => void;
  onSelectAllWatermarks?: (select: boolean) => void;
  onRescanWatermarks?: () => void;
  onExecuteElectronicClean: (selectedItems: DetectedWatermarkItem[]) => void;
  isProcessing: boolean;
  isScanning?: boolean;
}

export const PdfWatermarkEraser: React.FC<PdfWatermarkEraserProps> = ({
  isOpen,
  onClose,
  watermarks,
  onToggleWatermark,
  onSelectAllWatermarks,
  onRescanWatermarks,
  onExecuteElectronicClean,
  isProcessing,
  isScanning = false,
}) => {
  if (!isOpen) return null;

  const selectedCount = watermarks.filter((w) => w.selected).length;
  const isAllSelected = watermarks.length > 0 && selectedCount === watermarks.length;

  const handleToggleSelectAll = () => {
    if (onSelectAllWatermarks) {
      onSelectAllWatermarks(!isAllSelected);
    } else {
      watermarks.forEach((w) => {
        if (isAllSelected ? w.selected : !w.selected) {
          onToggleWatermark(w.id);
        }
      });
    }
  };

  return (
    <div
      id="pdf-watermark-floating-panel"
      data-no-canvas-click="true"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="absolute right-4 top-3 w-88 max-h-[calc(100%-1.5rem)] bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-neutral-200/90 dark:border-neutral-700/80 flex flex-col justify-between select-none z-30 animate-in fade-in slide-in-from-right-4 duration-200"
    >
      {/* Top Header */}
      <div className="p-3.5 border-b border-neutral-200/70 dark:border-neutral-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-xl bg-amber-500/15 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Eraser className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <h3 className="text-xs font-bold text-neutral-900 dark:text-white">去水印面板</h3>
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold">
                无损模式
              </span>
            </div>
            <p className="text-[10px] text-neutral-400">智能对象层剔除，不损坏正文清晰度</p>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          {onRescanWatermarks && (
            <button
              type="button"
              onClick={onRescanWatermarks}
              disabled={isScanning}
              className="p-1 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              title="重新扫描水印"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-blue-500' : ''}`} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="关闭面板"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content: Watermark Items List */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 max-h-[380px] no-scrollbar">
        {isScanning ? (
          <div className="p-8 text-center flex flex-col items-center justify-center space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
            <span className="text-xs text-neutral-600 dark:text-neutral-300 font-medium">
              正在全文档扫描水印...
            </span>
            <span className="text-[10px] text-neutral-400">正在分析 PDF 矢量流与印章对象</span>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                已识别水印 ({watermarks.length})
              </span>
              {watermarks.length > 0 && (
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  {isAllSelected ? '取消全选' : '全选'}
                </button>
              )}
            </div>

            {watermarks.length === 0 ? (
              <div className="p-6 rounded-xl bg-neutral-50 dark:bg-neutral-850/50 border border-dashed border-neutral-200 dark:border-neutral-800 text-center flex flex-col items-center justify-center space-y-1.5">
                <ShieldCheck className="w-6 h-6 text-emerald-500" />
                <span className="text-xs text-neutral-700 dark:text-neutral-300 font-semibold">
                  未检测到明显的电子文字水印
                </span>
                <span className="text-[10px] text-neutral-400 max-w-[200px]">
                  该 PDF 文档可能未嵌入常规水印，或水印已清除完毕
                </span>
              </div>
            ) : (
              <div className="space-y-1.5">
                {watermarks.map((wm) => (
                  <div
                    key={wm.id}
                    onClick={() => onToggleWatermark(wm.id)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-start space-x-2.5 ${
                      wm.selected
                        ? 'border-amber-400/80 bg-amber-50/60 dark:bg-amber-950/30'
                        : 'border-neutral-200/80 dark:border-neutral-800 hover:border-neutral-300 opacity-70'
                    }`}
                  >
                    <div className="mt-0.5 text-amber-600 dark:text-amber-400 shrink-0">
                      {wm.selected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                          {wm.content}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 font-mono shrink-0 ml-1">
                          {Math.round(wm.confidence * 100)}% 置信
                        </span>
                      </div>
                      <p className="text-[10px] text-neutral-400 mt-0.5">{wm.locationDescription}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Hint Notice */}
            <div className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-800/40 text-[11px] text-blue-800 dark:text-blue-300 flex items-start space-x-1.5">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
              <p className="text-[10px] leading-relaxed">
                去水印操作在浏览器本地内存即时完成，不会上传您的文档至任何服务器，安全保密。
              </p>
            </div>
          </>
        )}
      </div>

      {/* Bottom Clean Action */}
      <div className="p-3 border-t border-neutral-200/70 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-850/40 rounded-b-2xl">
        <button
          type="button"
          onClick={() => onExecuteElectronicClean(watermarks.filter((w) => w.selected))}
          disabled={isProcessing || isScanning || selectedCount === 0}
          className={`w-full flex items-center justify-center space-x-2 py-2 rounded-xl text-xs font-semibold text-white shadow-xs transition-all ${
            selectedCount > 0 && !isProcessing && !isScanning
              ? 'bg-amber-500 hover:bg-amber-600 active:scale-[0.98]'
              : 'bg-neutral-300 dark:bg-neutral-700 cursor-not-allowed opacity-50'
          }`}
        >
          {isProcessing ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>正在纯本地剔除水印...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>一键清除所选水印 ({selectedCount})</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
