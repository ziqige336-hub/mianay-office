import React, { useState, useEffect, useMemo } from 'react';
import { Search, ArrowDown, ArrowUp, RefreshCw, X, Check, Target } from 'lucide-react';
import type { SheetData } from '../../types';
import { colIndexToLetter, parseCellCoord } from '../../utils/sheetUtils';

interface SheetFindReplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSheet: SheetData;
  onSelectCell: (r: number, c: number) => void;
  onUpdateCells: (updates: { r: number; c: number; value: string }[]) => void;
  onShowToast?: (type: 'success' | 'error' | 'info', title: string, description?: string) => void;
}

export const SheetFindReplaceModal: React.FC<SheetFindReplaceModalProps> = ({
  isOpen,
  onClose,
  activeSheet,
  onSelectCell,
  onUpdateCells,
  onShowToast,
}) => {
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [matchEntireCell, setMatchEntireCell] = useState(false);
  const [searchInFormulas, setSearchInFormulas] = useState(false);
  const [activeResultIndex, setActiveResultIndex] = useState<number>(-1);
  const [jumpCoord, setJumpCoord] = useState('');

  // Find matches
  const matches = useMemo(() => {
    if (!findText.trim()) return [];
    const results: { r: number; c: number; value: string }[] = [];

    const query = matchCase ? findText : findText.toLowerCase();

    for (let r = 0; r < activeSheet.rows; r++) {
      for (let c = 0; c < activeSheet.cols; c++) {
        const cell = activeSheet.cells[`${r},${c}`];
        if (!cell || cell.value === undefined || cell.value === '') continue;

        const targetStr = searchInFormulas ? cell.value : String(cell.computed ?? cell.value);
        const comp = matchCase ? targetStr : targetStr.toLowerCase();

        let isMatch = false;
        if (matchEntireCell) {
          isMatch = comp === query;
        } else {
          isMatch = comp.includes(query);
        }

        if (isMatch) {
          results.push({ r, c, value: cell.value });
        }
      }
    }

    return results;
  }, [findText, matchCase, matchEntireCell, searchInFormulas, activeSheet]);

  useEffect(() => {
    if (matches.length > 0) {
      setActiveResultIndex(0);
      onSelectCell(matches[0].r, matches[0].c);
    } else {
      setActiveResultIndex(-1);
    }
  }, [matches, onSelectCell]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (matches.length === 0) return;
    const nextIdx = (activeResultIndex + 1) % matches.length;
    setActiveResultIndex(nextIdx);
    onSelectCell(matches[nextIdx].r, matches[nextIdx].c);
  };

  const handlePrev = () => {
    if (matches.length === 0) return;
    const prevIdx = (activeResultIndex - 1 + matches.length) % matches.length;
    setActiveResultIndex(prevIdx);
    onSelectCell(matches[prevIdx].r, matches[prevIdx].c);
  };

  const handleReplaceCurrent = () => {
    if (activeResultIndex < 0 || activeResultIndex >= matches.length) return;
    const cur = matches[activeResultIndex];
    let newVal: string;

    if (matchEntireCell) {
      newVal = replaceText;
    } else {
      const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matchCase ? 'g' : 'gi');
      newVal = cur.value.replace(regex, replaceText);
    }

    onUpdateCells([{ r: cur.r, c: cur.c, value: newVal }]);
    onShowToast?.('success', '已替换当前单元格', `${colIndexToLetter(cur.c)}${cur.r + 1}`);
  };

  const handleReplaceAll = () => {
    if (matches.length === 0) {
      onShowToast?.('info', '未找到匹配项');
      return;
    }

    const updates = matches.map((m) => {
      let newVal: string;
      if (matchEntireCell) {
        newVal = replaceText;
      } else {
        const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matchCase ? 'g' : 'gi');
        newVal = m.value.replace(regex, replaceText);
      }
      return { r: m.r, c: m.c, value: newVal };
    });

    onUpdateCells(updates);
    onShowToast?.('success', `全部替换完成`, `共替换 ${updates.length} 处匹配内容`);
  };

  const handleJumpToCell = (e: React.FormEvent) => {
    e.preventDefault();
    const coord = parseCellCoord(jumpCoord);
    if (!coord || coord.r >= activeSheet.rows || coord.c >= activeSheet.cols) {
      onShowToast?.('error', '无效的坐标', `请输入例如 A1 或 C10 的格式`);
      return;
    }
    onSelectCell(coord.r, coord.c);
    onShowToast?.('info', `已定位跳转`, `${colIndexToLetter(coord.c)}${coord.r + 1}`);
  };

  return (
    <div
      id="sheet-find-replace-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-[#18181b] rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 p-5 space-y-4 text-neutral-800 dark:text-neutral-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800/80 pb-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Search className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">查找与替换 (Find & Replace)</h3>
              <p className="text-[11px] text-neutral-500">支持全工作表匹配、公式检索与精确坐标定位</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Inputs */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300 block mb-1">
              查找内容 (Find)
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                value={findText}
                onChange={(e) => setFindText(e.target.value)}
                placeholder="输入要搜索的文本、数字或公式..."
                autoFocus
                className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all pr-20"
              />
              <span className="absolute right-3 text-[11px] text-neutral-400 font-mono">
                {matches.length > 0 ? `${activeResultIndex + 1} / ${matches.length}` : findText ? '0 结果' : ''}
              </span>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300 block mb-1">
              替换为 (Replace With)
            </label>
            <input
              type="text"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              placeholder="输入替换内容..."
              className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          {/* Checkboxes */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <label className="flex items-center space-x-1.5 text-[11px] text-neutral-600 dark:text-neutral-400 cursor-pointer">
              <input
                type="checkbox"
                checked={matchCase}
                onChange={(e) => setMatchCase(e.target.checked)}
                className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
              />
              <span>区分大小写</span>
            </label>
            <label className="flex items-center space-x-1.5 text-[11px] text-neutral-600 dark:text-neutral-400 cursor-pointer">
              <input
                type="checkbox"
                checked={matchEntireCell}
                onChange={(e) => setMatchEntireCell(e.target.checked)}
                className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
              />
              <span>全字匹配</span>
            </label>
            <label className="flex items-center space-x-1.5 text-[11px] text-neutral-600 dark:text-neutral-400 cursor-pointer">
              <input
                type="checkbox"
                checked={searchInFormulas}
                onChange={(e) => setSearchInFormulas(e.target.checked)}
                className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
              />
              <span>搜索公式</span>
            </label>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800/80">
          <div className="flex items-center space-x-1.5">
            <button
              onClick={handlePrev}
              disabled={matches.length === 0}
              className="px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40 flex items-center space-x-1"
            >
              <ArrowUp className="w-3.5 h-3.5" />
              <span>上一个</span>
            </button>
            <button
              onClick={handleNext}
              disabled={matches.length === 0}
              className="px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40 flex items-center space-x-1"
            >
              <ArrowDown className="w-3.5 h-3.5" />
              <span>下一个</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleReplaceCurrent}
              disabled={matches.length === 0}
              className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40"
            >
              替换
            </button>
            <button
              onClick={handleReplaceAll}
              disabled={matches.length === 0}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-xs disabled:opacity-40"
            >
              全部替换
            </button>
          </div>
        </div>

        {/* Quick Go to Cell */}
        <form
          onSubmit={handleJumpToCell}
          className="pt-2 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between text-xs"
        >
          <div className="flex items-center space-x-1.5 text-neutral-500">
            <Target className="w-3.5 h-3.5 text-neutral-400" />
            <span>快速定位:</span>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={jumpCoord}
              onChange={(e) => setJumpCoord(e.target.value.toUpperCase())}
              placeholder="例如 B5 / E12"
              className="w-28 px-2.5 py-1 text-xs uppercase font-mono rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 focus:outline-hidden focus:border-blue-500"
            />
            <button
              type="submit"
              className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-medium"
            >
              跳转
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
