import React from 'react';
import {
  RotateCw,
  RotateCcw,
  Trash2,
  Copy,
  Plus,
  ArrowUp,
  ArrowDown,
  Layers,
} from 'lucide-react';
import type { PageMeta } from '../../types';

interface PdfThumbnailGridProps {
  pages: PageMeta[];
  currentPageIndex: number;
  onSelectPage: (index: number) => void;
  onRotatePage: (index: number, degrees: number) => void;
  onDeletePage: (index: number) => void;
  onDuplicatePage: (index: number) => void;
  onMovePage: (fromIndex: number, toIndex: number) => void;
  onInsertBlankPage: (afterIndex: number) => void;
}

export const PdfThumbnailGrid: React.FC<PdfThumbnailGridProps> = ({
  pages,
  currentPageIndex,
  onSelectPage,
  onRotatePage,
  onDeletePage,
  onDuplicatePage,
  onMovePage,
  onInsertBlankPage,
}) => {
  return (
    <div
      data-no-canvas-click="true"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="w-56 shrink-0 h-full bg-neutral-100/70 dark:bg-[#141416]/80 backdrop-blur-xl border-r border-neutral-200/60 dark:border-neutral-800 flex flex-col justify-between select-none"
    >
      {/* Top Header */}
      <div className="p-3 border-b border-neutral-200/50 dark:border-neutral-800 flex items-center justify-between">
        <div className="flex items-center space-x-1.5 text-xs font-semibold text-neutral-800 dark:text-neutral-200">
          <Layers className="w-3.5 h-3.5 text-blue-500" />
          <span>页面导航 ({pages.length} 页)</span>
        </div>
        <button
          onClick={() => onInsertBlankPage(pages.length - 1)}
          title="在末尾插入空白页"
          className="p-1 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Pages Thumbnail List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {pages.map((page, idx) => {
          const isCurrent = idx === currentPageIndex;
          return (
            <div
              key={`page-thumb-${idx}-${page.originalIndex}`}
              className={`group relative rounded-xl border-2 transition-all p-2 bg-white dark:bg-[#1c1c1e] ${
                isCurrent
                  ? 'border-blue-500 shadow-md ring-2 ring-blue-400/20'
                  : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300'
              }`}
            >
              {/* Thumbnail Header: Page number & Move */}
              <div className="flex items-center justify-between mb-1.5">
                <span
                  onClick={() => onSelectPage(idx)}
                  className={`text-[11px] font-bold cursor-pointer ${
                    isCurrent ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-500'
                  }`}
                >
                  第 {idx + 1} 页
                </span>

                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    disabled={idx === 0}
                    onClick={() => onMovePage(idx, idx - 1)}
                    title="上移"
                    className="p-0.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-white disabled:opacity-30"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    disabled={idx === pages.length - 1}
                    onClick={() => onMovePage(idx, idx + 1)}
                    title="下移"
                    className="p-0.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-white disabled:opacity-30"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Thumbnail Canvas Preview Box */}
              <div
                onClick={() => onSelectPage(idx)}
                className="w-full aspect-[1/1.35] bg-neutral-100 dark:bg-neutral-900 rounded-lg flex items-center justify-center cursor-pointer overflow-hidden border border-neutral-200/50 dark:border-neutral-800 relative"
              >
                <div
                  className="w-full h-full flex flex-col items-center justify-center p-2 text-center transition-transform"
                  style={{ transform: `rotate(${page.rotation}deg)` }}
                >
                  <span className="text-[10px] text-neutral-400 font-mono">
                    {page.width.toFixed(0)} × {page.height.toFixed(0)}
                  </span>
                  {page.rotation !== 0 && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 mt-1">
                      {page.rotation}°
                    </span>
                  )}
                </div>
              </div>

              {/* Action Toolbar on Hover */}
              <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-neutral-100 dark:border-neutral-800 text-neutral-400">
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => onRotatePage(idx, 90)}
                    title="顺时针旋转90°"
                    className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-blue-600"
                  >
                    <RotateCw className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => onDuplicatePage(idx)}
                    title="复制本页"
                    className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-blue-600"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>

                <button
                  disabled={pages.length <= 1}
                  onClick={() => onDeletePage(idx)}
                  title={pages.length <= 1 ? '至少保留一页' : '删除本页'}
                  className="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-600 disabled:opacity-30"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
