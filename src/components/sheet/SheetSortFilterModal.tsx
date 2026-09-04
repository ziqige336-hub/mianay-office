import React, { useState, useMemo } from 'react';
import { ArrowDownAZ, ArrowUpZA, Filter, Check, X, Search, CheckSquare, Square } from 'lucide-react';
import type { SheetData } from '../../types';
import { colIndexToLetter, getCellValue } from '../../utils/sheetUtils';

interface SheetSortModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSheet: SheetData;
  selection: { startR: number; startC: number; endR: number; endC: number };
  onSortRange: (colIndex: number, ascending: boolean, hasHeader: boolean) => void;
}

export const SheetSortModal: React.FC<SheetSortModalProps> = ({
  isOpen,
  onClose,
  activeSheet,
  selection,
  onSortRange,
}) => {
  const minR = Math.min(selection.startR, selection.endR);
  const maxR = Math.max(selection.startR, selection.endR);
  const minC = Math.min(selection.startC, selection.endC);
  const maxC = Math.max(selection.startC, selection.endC);

  const [sortCol, setSortCol] = useState<number>(minC);
  const [ascending, setAscending] = useState<boolean>(true);
  const [hasHeader, setHasHeader] = useState<boolean>(minR === 0);

  if (!isOpen) return null;

  const handleApply = () => {
    onSortRange(sortCol, ascending, hasHeader);
    onClose();
  };

  return (
    <div
      id="sheet-sort-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white dark:bg-[#18181b] rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 p-5 space-y-4 text-neutral-800 dark:text-neutral-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800/80 pb-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <ArrowDownAZ className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">自定义区域排序 (Sort Range)</h3>
              <p className="text-[11px] text-neutral-500">
                选区: {colIndexToLetter(minC)}{minR + 1}:{colIndexToLetter(maxC)}{maxR + 1}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400 block mb-1">
              主排序依据列 (Sort Column)
            </label>
            <select
              value={sortCol}
              onChange={(e) => setSortCol(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700"
            >
              {Array.from({ length: maxC - minC + 1 }).map((_, idx) => {
                const cIdx = minC + idx;
                const colLetter = colIndexToLetter(cIdx);
                const headerVal = getCellValue(minR, cIdx, activeSheet.cells);
                const label = hasHeader && headerVal ? `${colLetter} 列 (${headerVal})` : `${colLetter} 列`;
                return (
                  <option key={cIdx} value={cIdx}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400 block mb-1">
              排序方向 (Order)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAscending(true)}
                className={`flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                  ascending
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                    : 'border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                }`}
              >
                <ArrowDownAZ className="w-3.5 h-3.5" />
                <span>升序 (A → Z, 小到大)</span>
              </button>
              <button
                type="button"
                onClick={() => setAscending(false)}
                className={`flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                  !ascending
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                    : 'border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                }`}
              >
                <ArrowUpZA className="w-3.5 h-3.5" />
                <span>降序 (Z → A, 大到小)</span>
              </button>
            </div>
          </div>

          <label className="flex items-center space-x-2 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={hasHeader}
              onChange={(e) => setHasHeader(e.target.checked)}
              className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-neutral-700 dark:text-neutral-300">
              数据包含标题行 (首行不参与排序)
            </span>
          </label>
        </div>

        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-neutral-100 dark:border-neutral-800/80">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            取消
          </button>
          <button
            onClick={handleApply}
            className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs"
          >
            确认排序
          </button>
        </div>
      </div>
    </div>
  );
};

// Filter Popover for Header Dropdowns
interface SheetColumnFilterPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  colIndex: number;
  activeSheet: SheetData;
  onApplyFilter: (colIndex: number, allowedValues: string[] | null) => void;
  anchorPosition: { x: number; y: number };
}

export const SheetColumnFilterPopover: React.FC<SheetColumnFilterPopoverProps> = ({
  isOpen,
  onClose,
  colIndex,
  activeSheet,
  onApplyFilter,
  anchorPosition,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Extract all unique values from this column
  const allUniqueValues = useMemo(() => {
    const vals = new Set<string>();
    const headerRow = activeSheet.filterState?.headerRow ?? 0;
    for (let r = headerRow + 1; r < activeSheet.rows; r++) {
      const v = String(getCellValue(r, colIndex, activeSheet.cells)).trim();
      if (v) vals.add(v);
    }
    return Array.from(vals).sort();
  }, [activeSheet, colIndex]);

  const currentAllowed = activeSheet.filterState?.activeFilters?.[colIndex];
  const [selectedValues, setSelectedValues] = useState<Set<string>>(
    () => new Set(currentAllowed || allUniqueValues)
  );

  if (!isOpen) return null;

  const filteredList = allUniqueValues.filter((v) =>
    v.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggle = (val: string) => {
    const next = new Set(selectedValues);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    setSelectedValues(next);
  };

  const handleSelectAll = () => {
    setSelectedValues(new Set(allUniqueValues));
  };

  const handleClearAll = () => {
    setSelectedValues(new Set());
  };

  const handleApply = () => {
    if (selectedValues.size === allUniqueValues.length) {
      onApplyFilter(colIndex, null); // No filter
    } else {
      onApplyFilter(colIndex, Array.from(selectedValues));
    }
    onClose();
  };

  return (
    <div
      id="sheet-col-filter-popover"
      className="fixed z-50 w-64 bg-white dark:bg-[#18181b] rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 p-3 space-y-2.5 text-neutral-800 dark:text-neutral-100 text-xs backdrop-blur-2xl"
      style={{
        left: Math.min(anchorPosition.x, window.innerWidth - 270),
        top: Math.min(anchorPosition.y, window.innerHeight - 320),
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800/80 pb-2">
        <span className="font-semibold text-neutral-700 dark:text-neutral-300">
          筛选: {colIndexToLetter(colIndex)} 列
        </span>
        <button
          onClick={onClose}
          className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search Filter items */}
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="搜索筛选项..."
          className="w-full px-2.5 py-1 text-xs rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 pl-7"
        />
        <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2 top-2" />
      </div>

      {/* Select all / Clear */}
      <div className="flex items-center justify-between text-[11px] text-blue-600 dark:text-blue-400">
        <button onClick={handleSelectAll} className="hover:underline">
          全选
        </button>
        <button onClick={handleClearAll} className="hover:underline text-neutral-500">
          清空
        </button>
      </div>

      {/* Checkbox list */}
      <div className="max-h-40 overflow-y-auto space-y-1 pr-1 border border-neutral-100 dark:border-neutral-800/80 rounded-lg p-1.5">
        {filteredList.map((val) => {
          const isChecked = selectedValues.has(val);
          return (
            <label
              key={val}
              className="flex items-center space-x-2 p-1 rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-800/50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => handleToggle(val)}
                className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="truncate">{val}</span>
            </label>
          );
        })}
      </div>

      {/* Apply buttons */}
      <div className="flex items-center justify-end space-x-1.5 pt-1 border-t border-neutral-100 dark:border-neutral-800/80">
        <button
          onClick={() => {
            onApplyFilter(colIndex, null);
            onClose();
          }}
          className="px-2.5 py-1 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs"
        >
          清除此列筛选
        </button>
        <button
          onClick={handleApply}
          className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs"
        >
          应用
        </button>
      </div>
    </div>
  );
};
