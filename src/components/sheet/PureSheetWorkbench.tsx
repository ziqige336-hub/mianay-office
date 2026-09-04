import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  Table as TableIcon,
  Save,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Cpu,
  Plus,
  Trash2,
  Layers,
  Search,
  Filter,
  BarChart2,
  Grid,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type {
  OfficeFile,
  SheetCell,
  SheetData,
  WorkbookData,
  ThemeMode,
  CellBorderConfig,
} from '../../types';
import { formatCellValue } from '../../utils/sheetUtils';
import { officeEngine } from '../../core/office';
import { spreadsheetService } from '../../services/SpreadsheetService';
import { DocumentSessionManager } from '../../core/document/DocumentSessionManager';
import { SheetToolbarControls } from './SheetToolbarControls';
import { SheetChartModal } from './SheetChartModal';
import { SheetSortModal } from './SheetSortFilterModal';
import { SheetFindReplaceModal } from './SheetFindReplaceModal';
import { SheetConditionalFormatModal } from './SheetConditionalFormatModal';
import { SheetStylePresetsPopover } from './SheetStylePresetsPopover';
import { EngineStatusModal } from '../engine/EngineStatusModal';
import { SheetFormattingContextResolver } from '../../core/formatting/SheetFormattingContextResolver';
import { commandDispatcher } from '../../core/commands';

interface PureSheetWorkbenchProps {
  currentFile?: OfficeFile;
  initialWorkbook?: WorkbookData;
  isActive?: boolean;
  themeMode?: ThemeMode;
  onSelectedCellChange?: (info: { r: number; c: number; cellData?: SheetCell; coordLabel: string }) => void;
  onChangeWorkbook?: (wb: WorkbookData, status?: 'unsaved' | 'saved') => void;
  onShowToast: (type: 'success' | 'error' | 'info' | 'vip-free', title: string, description?: string) => void;
  onRequestExport?: () => void;
}

// Convert column index (0-indexed) to Excel letters (0 -> A, 25 -> Z, 26 -> AA)
function colToLetter(col: number): string {
  let temp = col;
  let letter = '';
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

// Simple safe formula evaluator
function evaluateCellValue(val: string, cells: Record<string, SheetCell>): string | number {
  if (!val || typeof val !== 'string') return val;
  if (!val.startsWith('=')) return val;

  const formula = val.substring(1).trim().toUpperCase();

  // Handle SUM, AVERAGE, COUNT, MAX, MIN
  const funcMatch = formula.match(/^(SUM|AVERAGE|COUNT|MAX|MIN)\(([A-Z]+[0-9]+):([A-Z]+[0-9]+)\)$/);
  if (funcMatch) {
    const [, func, startRef, endRef] = funcMatch;
    const parseCoord = (ref: string) => {
      const colStr = ref.replace(/[0-9]/g, '');
      const rowStr = ref.replace(/[^0-9]/g, '');
      let c = 0;
      for (let i = 0; i < colStr.length; i++) {
        c = c * 26 + (colStr.charCodeAt(i) - 64);
      }
      return { r: parseInt(rowStr, 10) - 1, c: c - 1 };
    };

    const start = parseCoord(startRef);
    const end = parseCoord(endRef);

    const minR = Math.min(start.r, end.r);
    const maxR = Math.max(start.r, end.r);
    const minC = Math.min(start.c, end.c);
    const maxC = Math.max(start.c, end.c);

    const nums: number[] = [];
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const cell = cells[`${r},${c}`] || cells[`${r}:${c}`];
        if (cell) {
          const raw = cell.value;
          const num = Number(raw);
          if (!isNaN(num) && raw !== '') {
            nums.push(num);
          }
        }
      }
    }

    if (nums.length === 0) return 0;
    if (func === 'SUM') return nums.reduce((a, b) => a + b, 0);
    if (func === 'AVERAGE') return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
    if (func === 'COUNT') return nums.length;
    if (func === 'MAX') return Math.max(...nums);
    if (func === 'MIN') return Math.min(...nums);
  }

  return val;
}

const DEFAULT_SAMPLE_WORKBOOK: WorkbookData = {
  activeSheetId: 'sheet-1',
  sheets: [
    {
      id: 'sheet-1',
      title: '财务收支与预算汇总表',
      rows: 40,
      cols: 20,
      cells: {
        '0,0': { value: '季度财务与经营指标汇总', bold: true, fontSize: 14, bg: '#e0f2fe', color: '#0369a1', align: 'center' },
        '1,0': { value: '业务板块', bold: true, bg: '#f1f5f9', align: 'center' },
        '1,1': { value: 'Q1 实际营收 (万元)', bold: true, bg: '#f1f5f9', align: 'right' },
        '1,2': { value: 'Q2 实际营收 (万元)', bold: true, bg: '#f1f5f9', align: 'right' },
        '1,3': { value: 'Q3 预算目标 (万元)', bold: true, bg: '#f1f5f9', align: 'right' },
        '1,4': { value: '总计', bold: true, bg: '#f1f5f9', align: 'right' },
        '2,0': { value: '企业软件与云服务' },
        '2,1': { value: '1280.5', align: 'right' },
        '2,2': { value: '1450.0', align: 'right' },
        '2,3': { value: '1600.0', align: 'right' },
        '2,4': { value: '=SUM(B3:D3)', bold: true, align: 'right', color: '#2563eb' },
        '3,0': { value: '智能硬件与终端' },
        '3,1': { value: '860.0', align: 'right' },
        '3,2': { value: '920.8', align: 'right' },
        '3,3': { value: '1050.0', align: 'right' },
        '3,4': { value: '=SUM(B4:D4)', bold: true, align: 'right', color: '#2563eb' },
        '4,0': { value: '专业咨询与服务' },
        '4,1': { value: '420.0', align: 'right' },
        '4,2': { value: '480.5', align: 'right' },
        '4,3': { value: '550.0', align: 'right' },
        '4,4': { value: '=SUM(B5:D5)', bold: true, align: 'right', color: '#2563eb' },
        '5,0': { value: '合计总额', bold: true, bg: '#f8fafc' },
        '5,1': { value: '=SUM(B3:B5)', bold: true, align: 'right', color: '#059669' },
        '5,2': { value: '=SUM(C3:C5)', bold: true, align: 'right', color: '#059669' },
        '5,3': { value: '=SUM(D3:D5)', bold: true, align: 'right', color: '#059669' },
        '5,4': { value: '=SUM(E3:E5)', bold: true, align: 'right', color: '#dc2626' },
      },
    },
  ],
};

export const PureSheetWorkbench: React.FC<PureSheetWorkbenchProps> = ({
  currentFile,
  initialWorkbook,
  isActive = true,
  themeMode = 'light',
  onSelectedCellChange,
  onChangeWorkbook,
  onShowToast,
  onRequestExport,
}) => {
  const [isEngineStatusOpen, setIsEngineStatusOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const gridContainerRef = useRef<HTMLDivElement>(null);

  // Modal dialog states
  const [isChartModalOpen, setIsChartModalOpen] = useState(false);
  const [isSortFilterModalOpen, setIsSortFilterModalOpen] = useState(false);
  const [isFindReplaceModalOpen, setIsFindReplaceModalOpen] = useState(false);
  const [isConditionalFormatModalOpen, setIsConditionalFormatModalOpen] = useState(false);
  const [isStylePresetsOpen, setIsStylePresetsOpen] = useState(false);

  // Active selection & editing
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const [editingCell, setEditingCell] = useState<{ r: number; c: number } | null>(null);
  const [editFormulaValue, setEditFormulaValue] = useState<string>('');

  // Format painter state
  const [isFormatPainterActive, setIsFormatPainterActive] = useState(false);
  const [formatPainterMode, setFormatPainterMode] = useState<'single' | 'continuous' | null>(null);
  const [copiedFormat, setCopiedFormat] = useState<Partial<SheetCell> | null>(null);

  // Initialize workbook data
  const [workbook, setWorkbook] = useState<WorkbookData>(() => {
    if (currentFile?.content && typeof currentFile.content === 'object' && currentFile.content.sheets) {
      return currentFile.content;
    }
    if (initialWorkbook && initialWorkbook.sheets) {
      return initialWorkbook;
    }
    return DEFAULT_SAMPLE_WORKBOOK;
  });

  const activeSheet = useMemo(() => {
    return workbook.sheets.find((s) => s.id === workbook.activeSheetId) || workbook.sheets[0];
  }, [workbook]);

  // Current active cell data
  const currentCellData = useMemo(() => {
    const key = `${selectedCell.r},${selectedCell.c}`;
    const altKey = `${selectedCell.r}:${selectedCell.c}`;
    return activeSheet.cells[key] || activeSheet.cells[altKey] || { value: '' };
  }, [activeSheet, selectedCell]);

  // Sync to parent on workbook update
  const updateWorkbook = useCallback(
    (newWb: WorkbookData) => {
      setWorkbook(newWb);
      setSaveStatus('unsaved');
      onChangeWorkbook?.(newWb);

      const fileId = currentFile?.id || 'sheet-default-1';
      DocumentSessionManager.updateSessionContent(fileId, {
        sheetState: newWb,
        getVisibleTextPreview: () => {
          const s = newWb.sheets.find((item) => item.id === newWb.activeSheetId) || newWb.sheets[0];
          return Object.values(s?.cells || {}).map((c: any) => c.value).filter(Boolean).slice(0, 50).join(' ');
        },
        getExportContent: () => newWb,
      });
    },
    [onChangeWorkbook, currentFile?.id]
  );

  // Register to DocumentSessionManager and SpreadsheetService
  useEffect(() => {
    const fileId = currentFile?.id || 'sheet-default-1';
    const effectiveFileName = currentFile?.name || '工作簿.xlsx';

    DocumentSessionManager.registerSession({
      fileId,
      fileName: effectiveFileName,
      type: 'sheet',
      sheetState: workbook,
      getVisibleTextPreview: () => {
        const s = workbook.sheets.find((item) => item.id === workbook.activeSheetId) || workbook.sheets[0];
        return Object.values(s?.cells || {}).map((c: any) => c.value).filter(Boolean).slice(0, 50).join(' ');
      },
      getExportContent: () => workbook,
    });

    const fileToSync: OfficeFile = {
      id: fileId,
      name: effectiveFileName,
      type: 'sheet',
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      content: workbook,
      versionHistory: [],
    };
    spreadsheetService.registerWorkbook(workbook, updateWorkbook, fileToSync);
  }, [workbook, currentFile?.id, currentFile?.name, updateWorkbook]);

  // Sync state if currentFile changes (e.g. switching files)
  useEffect(() => {
    if (currentFile?.content && typeof currentFile.content === 'object' && currentFile.content.sheets) {
      setWorkbook(currentFile.content);
    }
  }, [currentFile?.id]);

  // Sync with engine store
  useEffect(() => {
    const fileId = currentFile?.id || 'sheet-default-1';
    const effectiveFileName = currentFile?.name || '工作簿.xlsx';
    const fileToSync: OfficeFile = {
      id: fileId,
      name: effectiveFileName,
      type: 'sheet',
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      content: workbook,
      versionHistory: [],
    };
    officeEngine.openDocument(fileToSync).catch(console.warn);
  }, [workbook, currentFile?.id, currentFile?.name]);

  // Handle cell click
  const handleCellClick = (r: number, c: number) => {
    const key = `${r},${c}`;
    const altKey = `${r}:${c}`;
    const cell = activeSheet.cells[key] || activeSheet.cells[altKey] || { value: '' };

    setSelectedCell({ r, c });
    setEditFormulaValue(cell.value || '');
    onSelectedCellChange?.({
      r,
      c,
      cellData: cell,
      coordLabel: `${colToLetter(c)}${r + 1}`,
    });

    // Format painter apply
    if (isFormatPainterActive && copiedFormat) {
      const updatedCells = { ...activeSheet.cells, [key]: { ...cell, ...copiedFormat } };
      const updatedSheets = workbook.sheets.map((s) => (s.id === activeSheet.id ? { ...s, cells: updatedCells } : s));
      updateWorkbook({ ...workbook, sheets: updatedSheets });

      if (formatPainterMode === 'single') {
        setIsFormatPainterActive(false);
        setFormatPainterMode(null);
        setCopiedFormat(null);
      }
    }
  };

  // Handle cell double click -> start editing
  const handleCellDoubleClick = (r: number, c: number) => {
    setEditingCell({ r, c });
    const key = `${r},${c}`;
    const altKey = `${r}:${c}`;
    const cell = activeSheet.cells[key] || activeSheet.cells[altKey] || { value: '' };
    setEditFormulaValue(cell.value || '');
  };

  // Commit editing cell
  const handleCommitCell = (r: number, c: number, newVal: string) => {
    spreadsheetService.setCellValue(r, c, newVal);
    setEditingCell(null);
  };

  // Update cell format property (e.g. bold, color, align, etc.)
  const handleUpdateFormat = (prop: string, val: any) => {
    const key = `${selectedCell.r},${selectedCell.c}`;
    const cell = activeSheet.cells[key] || activeSheet.cells[`${selectedCell.r}:${selectedCell.c}`] || { value: '' };
    const updatedCell: SheetCell = { ...cell, [prop]: val };

    const updatedCells = { ...activeSheet.cells, [key]: updatedCell };
    const updatedSheets = workbook.sheets.map((s) => (s.id === activeSheet.id ? { ...s, cells: updatedCells } : s));
    updateWorkbook({ ...workbook, sheets: updatedSheets });
  };

  // Apply cell borders
  const handleApplyBorders = (borderType: 'all' | 'outer' | 'thick' | 'top' | 'bottom' | 'doubleBottom' | 'clear', color?: string) => {
    const key = `${selectedCell.r},${selectedCell.c}`;
    const cell = activeSheet.cells[key] || activeSheet.cells[`${selectedCell.r}:${selectedCell.c}`] || { value: '' };

    let borders: CellBorderConfig = {};
    if (borderType === 'all' || borderType === 'outer') {
      borders = { top: true, bottom: true, left: true, right: true, color: color || '#94a3b8' };
    } else if (borderType === 'top') {
      borders = { top: true, color: color || '#94a3b8' };
    } else if (borderType === 'bottom') {
      borders = { bottom: true, color: color || '#94a3b8' };
    } else if (borderType === 'clear') {
      borders = {};
    }

    handleUpdateFormat('borders', borders);
  };

  const isSavingRef = useRef(false);

  // Save workbook via Native LibreOffice Calc Engine
  const handleSave = useCallback(async () => {
    if (isSavingRef.current || saveStatus === 'saving') return;
    isSavingRef.current = true;
    setSaveStatus('saving');
    try {
      const saveRes = await spreadsheetService.saveWorkbook();
      setSaveStatus('saved');
      onChangeWorkbook?.(workbook, 'saved');
      onShowToast('success', '工作簿已成功保存', `LibreOffice 原生 XLSX 格式 (${Math.round(saveRes.size / 1024)} KB)`);
    } catch (err: any) {
      setSaveStatus('unsaved');
      onShowToast('error', '保存工作簿失败', err?.message || '无法写入引擎');
    } finally {
      isSavingRef.current = false;
    }
  }, [workbook, onChangeWorkbook, onShowToast, saveStatus]);

  // Unified Command Dispatcher Subscription for Pure Sheet
  useEffect(() => {
    if (!isActive) return;

    const unregister = commandDispatcher.registerMany({
      SAVE_DOCUMENT: () => {
        handleSave();
      },
    });

    return () => unregister();
  }, [isActive, handleSave]);

  // Wheel zoom with Ctrl / Cmd key (Excel/WPS standard)
  useEffect(() => {
    const el = gridContainerRef.current;
    if (!el || !isActive) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 10 : -10;
        setZoomLevel((prev) => Math.min(200, Math.max(50, prev + delta)));
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [isActive]);

  // Keyboard shortcut Ctrl/Cmd +/-, Ctrl/Cmd 0
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.metaKey || e.ctrlKey;
      if (isCtrlOrCmd) {
        if (e.key === '=' || e.key === '+' || e.code === 'NumpadAdd') {
          e.preventDefault();
          setZoomLevel((prev) => Math.min(200, prev + 10));
        } else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') {
          e.preventDefault();
          setZoomLevel((prev) => Math.max(50, prev - 10));
        } else if (e.key === '0' || e.code === 'Numpad0') {
          e.preventDefault();
          setZoomLevel(100);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive]);

  // Add new sheet tab
  const handleAddSheet = () => {
    const newIndex = workbook.sheets.length + 1;
    const newSheet: SheetData = {
      id: `sheet-${Date.now()}`,
      title: `工作表${newIndex}`,
      rows: 40,
      cols: 20,
      cells: {},
    };
    updateWorkbook({
      ...workbook,
      activeSheetId: newSheet.id,
      sheets: [...workbook.sheets, newSheet],
    });
  };

  const formattingContext = useMemo(() => {
    return SheetFormattingContextResolver.resolve(workbook, selectedCell);
  }, [workbook, selectedCell]);

  return (
    <div className="flex flex-col h-full w-full bg-[#f8fafc] dark:bg-neutral-950 select-none">
      {/* Spreadsheet Formula & Format Ribbon */}
      <div className="border-b border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 relative z-50 overflow-visible">
        <SheetToolbarControls
          currentCell={currentCellData}
          formattingContext={formattingContext}
          isFormatPainterActive={isFormatPainterActive}
          formatPainterMode={formatPainterMode}
          onToggleFormatPainter={(isDouble) => {
            if (isFormatPainterActive) {
              setIsFormatPainterActive(false);
              setFormatPainterMode(null);
              setCopiedFormat(null);
            } else {
              setIsFormatPainterActive(true);
              setFormatPainterMode(isDouble ? 'continuous' : 'single');
              setCopiedFormat({ ...currentCellData });
            }
          }}
          onUpdateFormat={handleUpdateFormat}
          onApplyBorders={handleApplyBorders}
          onMergeSelection={() => {}}
          onApplyAutoSum={(funcName) => {
            const label = `${colToLetter(selectedCell.c)}${selectedCell.r + 1}`;
            const targetVal = `=${funcName}(A1:${label})`;
            handleCommitCell(selectedCell.r, selectedCell.c, targetVal);
          }}
          onOpenSortModal={() => setIsSortFilterModalOpen(true)}
          onQuickSort={() => {}}
          onToggleFilter={() => {}}
          isFilterEnabled={false}
          onOpenFindReplace={() => setIsFindReplaceModalOpen(true)}
          onOpenConditionalFormat={() => setIsConditionalFormatModalOpen(true)}
          onOpenStylePresets={() => setIsStylePresetsOpen(true)}
          onClearFormats={() => {
            const key = `${selectedCell.r},${selectedCell.c}`;
            const cell = activeSheet.cells[key] || { value: '' };
            handleCommitCell(selectedCell.r, selectedCell.c, cell.value);
          }}
          onClearAll={() => {
            handleCommitCell(selectedCell.r, selectedCell.c, '');
          }}
        />

        {/* Formula Bar */}
        <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-50 dark:bg-neutral-800/90 border-t border-slate-200/80 dark:border-neutral-700 text-xs">
          <div className="w-14 text-center font-mono font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-neutral-700 px-2 py-1 rounded border border-slate-200 dark:border-neutral-600">
            {colToLetter(selectedCell.c)}
            {selectedCell.r + 1}
          </div>
          <span className="font-serif italic font-bold text-slate-400">fx</span>
          <input
            type="text"
            value={editFormulaValue}
            onChange={(e) => {
              setEditFormulaValue(e.target.value);
              handleCommitCell(selectedCell.r, selectedCell.c, e.target.value);
            }}
            placeholder="输入数值或公式（如 =SUM(A1:A5)）"
            className="flex-1 bg-white dark:bg-neutral-700 border border-slate-200 dark:border-neutral-600 rounded px-2.5 py-1 text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-500 font-mono text-xs"
          />
        </div>
      </div>

      {/* Main Grid Viewport */}
      <div
        ref={gridContainerRef}
        className="flex-1 overflow-auto bg-[#eaecf0] dark:bg-neutral-950 p-2"
      >
        <div
          style={{
            transform: `scale(${zoomLevel / 100})`,
            transformOrigin: 'top left',
          }}
          className="inline-block bg-white dark:bg-slate-900 shadow-md border border-slate-300 dark:border-slate-800 transition-transform duration-100 ease-out"
        >
          <table className="border-collapse text-xs select-none">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-medium">
                <th className="w-10 h-7 border border-slate-300 dark:border-slate-700/80 bg-slate-200/60 dark:bg-slate-800 text-center font-mono text-[10px]" />
                {Array.from({ length: activeSheet.cols || 20 }).map((_, cIdx) => (
                  <th
                    key={cIdx}
                    className="min-w-[90px] h-7 px-2 border border-slate-300 dark:border-slate-700/80 text-center font-mono font-semibold"
                  >
                    {colToLetter(cIdx)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: activeSheet.rows || 40 }).map((_, rIdx) => (
                <tr key={rIdx}>
                  {/* Row Number Header */}
                  <td className="w-10 h-7 px-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700/80 text-center font-mono text-[11px] text-slate-500 dark:text-slate-400 font-semibold select-none">
                    {rIdx + 1}
                  </td>

                  {/* Row Data Cells */}
                  {Array.from({ length: activeSheet.cols || 20 }).map((_, cIdx) => {
                    const key = `${rIdx},${cIdx}`;
                    const altKey = `${rIdx}:${cIdx}`;
                    const cell = activeSheet.cells[key] || activeSheet.cells[altKey] || { value: '' };
                    const isSelected = selectedCell.r === rIdx && selectedCell.c === cIdx;
                    const isEditing = editingCell?.r === rIdx && editingCell?.c === cIdx;
                    const rawEvaluated = evaluateCellValue(cell.value || '', activeSheet.cells);
                    const evaluated = formatCellValue(cell, rawEvaluated);

                    return (
                      <td
                        key={cIdx}
                        onClick={() => handleCellClick(rIdx, cIdx)}
                        onDoubleClick={() => handleCellDoubleClick(rIdx, cIdx)}
                        style={{
                          backgroundColor: cell.bg || undefined,
                          color: cell.color || undefined,
                          fontWeight: cell.bold ? 'bold' : 'normal',
                          fontStyle: cell.italic ? 'italic' : 'normal',
                          textDecoration: cell.underline ? 'underline' : cell.strike ? 'line-through' : undefined,
                          textAlign: cell.align || 'left',
                          verticalAlign: cell.verticalAlign || 'middle',
                          fontSize: cell.fontSize ? `${cell.fontSize}px` : undefined,
                          fontFamily: cell.fontFamily || undefined,
                          whiteSpace: cell.wrapText ? 'normal' : 'nowrap',
                          borderTop: cell.borders?.top ? `${cell.borders.style === 'double' ? '3px double' : cell.borders.style === 'thick' ? '2px solid' : '1px solid'} ${cell.borders.color || '#94a3b8'}` : undefined,
                          borderBottom: cell.borders?.bottom ? `${cell.borders.style === 'double' ? '3px double' : cell.borders.style === 'thick' ? '2px solid' : '1px solid'} ${cell.borders.color || '#94a3b8'}` : undefined,
                          borderLeft: cell.borders?.left ? `${cell.borders.style === 'double' ? '3px double' : cell.borders.style === 'thick' ? '2px solid' : '1px solid'} ${cell.borders.color || '#94a3b8'}` : undefined,
                          borderRight: cell.borders?.right ? `${cell.borders.style === 'double' ? '3px double' : cell.borders.style === 'thick' ? '2px solid' : '1px solid'} ${cell.borders.color || '#94a3b8'}` : undefined,
                        }}
                        className={`h-7 px-2 border border-slate-300 dark:border-slate-700/80 relative text-slate-800 dark:text-slate-100 ${
                          isSelected
                            ? 'ring-2 ring-emerald-500 ring-inset z-10 bg-emerald-50/20 dark:bg-emerald-950/30'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        {isEditing ? (
                          <input
                            autoFocus
                            type="text"
                            defaultValue={cell.value || ''}
                            onBlur={(e) => handleCommitCell(rIdx, cIdx, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCommitCell(rIdx, cIdx, (e.target as HTMLInputElement).value);
                              if (e.key === 'Escape') setEditingCell(null);
                            }}
                            className="w-full h-full bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none font-mono text-xs px-1"
                          />
                        ) : (
                          <span className="block truncate font-mono text-[12px]">{evaluated}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Sheet Tabs Bar */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-slate-100 dark:bg-neutral-800 border-t border-slate-200 dark:border-neutral-700 text-xs">
        <div className="flex items-center gap-1 overflow-x-auto">
          {workbook.sheets.map((sheet) => {
            const isActiveSheet = sheet.id === activeSheet.id;
            return (
              <button
                key={sheet.id}
                onClick={() => updateWorkbook({ ...workbook, activeSheetId: sheet.id })}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-t border-b-2 font-medium transition-all ${
                  isActiveSheet
                    ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border-emerald-500 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 border-transparent hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                }`}
              >
                <TableIcon className="w-3 h-3" />
                <span>{sheet.title}</span>
              </button>
            );
          })}
          <button
            onClick={handleAddSheet}
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors ml-1"
            title="添加工作表"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Zoom controls, Save status & Save button */}
        <div id="sheet-bottom-actions" className="flex items-center gap-2.5 shrink-0">
          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-black/[0.03] dark:bg-white/[0.05] p-0.5 rounded px-1">
            <button
              onClick={() => setZoomLevel((prev) => Math.max(50, prev - 10))}
              disabled={zoomLevel <= 50}
              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="缩小 (Ctrl/Cmd - 或 Ctrl+滚轮)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setZoomLevel(100)}
              className="px-1.5 py-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 font-mono text-[11px] font-medium text-slate-700 dark:text-slate-200 min-w-[38px] text-center transition-colors"
              title="点击恢复 100% (Ctrl/Cmd 0)"
            >
              {zoomLevel}%
            </button>

            <button
              onClick={() => setZoomLevel((prev) => Math.min(200, prev + 10))}
              disabled={zoomLevel >= 200}
              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="放大 (Ctrl/Cmd + 或 Ctrl+滚轮)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-3.5 w-px bg-slate-200 dark:bg-slate-700"></div>

          {/* Save status badge (图四位置) */}
          <div
            id="sheet-bottom-save-status"
            className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 select-none px-1.5 py-0.5 rounded"
            title="工作簿保存状态"
          >
            {saveStatus === 'saved' ? (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5" /> 已同步
              </span>
            ) : saveStatus === 'saving' ? (
              <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium text-[11px]">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> 保存中...
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> 未保存
              </span>
            )}
          </div>

          {/* Quick Save button (图三位置) */}
          <button
            id="sheet-quick-save-btn"
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
            title="保存工作簿 (Ctrl/Cmd + S)"
          >
            {saveStatus === 'saving' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>保存</span>
          </button>
        </div>
      </div>

      {/* Engine Status Diagnostic Modal */}
      <EngineStatusModal
        isOpen={isEngineStatusOpen}
        onClose={() => setIsEngineStatusOpen(false)}
        onShowToast={onShowToast}
      />

      {/* Sort Range Modal */}
      <SheetSortModal
        isOpen={isSortFilterModalOpen}
        onClose={() => setIsSortFilterModalOpen(false)}
        activeSheet={activeSheet}
        selection={{ startR: selectedCell.r, startC: selectedCell.c, endR: selectedCell.r, endC: selectedCell.c }}
        onSortRange={() => {
          onShowToast('info', '区域排序已执行');
        }}
      />
    </div>
  );
};
