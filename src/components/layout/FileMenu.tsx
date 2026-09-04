import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Save,
  Plus,
  FolderOpen,
  Upload,
  FileText,
  Table as TableIcon,
  FileCode,
  Download,
  Image as ImageIcon,
  Layers,
  Code2,
  FileDown,
  Archive,
  Scan,
  Globe,
  Printer,
  Info,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { commandDispatcher, CommandType } from '../../core/commands';
import { getFeatureCapability, FeatureCapability } from '../../core/capabilities/FeatureRegistry';

export interface MenuItemDef {
  id: string;
  label: string;
  sublabel?: string;
  icon?: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  shortcut?: string;
  command?: CommandType;
  payload?: any;
  featureId?: string; // Links to FeatureCapabilityRegistry
  disabled?: boolean;
  badge?: string;
  children?: MenuItemDef[];
}

export const FILE_MENU_STRUCTURE: MenuItemDef[] = [
  {
    id: 'save',
    label: '保存',
    shortcut: '⌘S',
    icon: Save,
    iconColor: 'text-blue-500',
    command: 'SAVE_DOCUMENT',
    featureId: 'save-document',
  },
  {
    id: 'new-doc',
    label: '新建',
    icon: Plus,
    iconColor: 'text-emerald-500',
    featureId: 'new-document',
    children: [
      {
        id: 'new-word',
        label: 'Word 文档',
        sublabel: 'DOCX 排版文稿',
        icon: FileText,
        iconColor: 'text-blue-500',
        command: 'CREATE_DOCUMENT',
        payload: { type: 'doc' },
        featureId: 'new-document',
      },
      {
        id: 'new-sheet',
        label: 'Excel 表格',
        sublabel: 'XLSX 智能工作簿',
        icon: TableIcon,
        iconColor: 'text-emerald-500',
        command: 'CREATE_DOCUMENT',
        payload: { type: 'sheet' },
        featureId: 'new-document',
      },
      {
        id: 'new-pdf',
        label: 'PDF 文档',
        sublabel: '便携版式文档',
        icon: FileCode,
        iconColor: 'text-rose-500',
        command: 'CREATE_DOCUMENT',
        payload: { type: 'pdf' },
        featureId: 'new-document',
      },
    ],
  },
  {
    id: 'open',
    label: '打开',
    shortcut: '⌘O',
    icon: FolderOpen,
    iconColor: 'text-amber-500',
    command: 'OPEN_DOCUMENT',
    featureId: 'open-document',
  },
  {
    id: 'import',
    label: '导入',
    icon: Upload,
    iconColor: 'text-indigo-500',
    command: 'IMPORT_DOCUMENT',
    featureId: 'import-document',
  },
  {
    id: 'export',
    label: '导出',
    icon: Download,
    iconColor: 'text-indigo-500',
    children: [
      {
        id: 'export-pdf',
        label: 'PDF',
        sublabel: '矢量排版 / 归档 / 扫描件',
        icon: FileCode,
        iconColor: 'text-rose-500',
        children: [
          {
            id: 'export-pdf-standard',
            label: '标准PDF',
            sublabel: '矢量排版与字体嵌入',
            icon: FileCode,
            iconColor: 'text-rose-500',
            command: 'EXPORT_PDF_STANDARD',
            featureId: 'export-pdf-standard',
          },
          {
            id: 'export-pdf-pdfa',
            label: 'PDF/A归档PDF',
            sublabel: 'ISO 19005 长期归档标准',
            icon: Archive,
            iconColor: 'text-amber-500',
            command: 'EXPORT_PDF_PDFA',
            featureId: 'export-pdf-pdfa',
          },
          {
            id: 'export-pdf-scanned',
            label: '扫描型PDF',
            sublabel: '全页栅格化防篡改图像',
            icon: Scan,
            iconColor: 'text-indigo-500',
            command: 'EXPORT_PDF_SCANNED',
            featureId: 'export-pdf-scanned',
          },
        ],
      },
      {
        id: 'export-word',
        label: 'Word (.docx)',
        sublabel: '重构为可编辑 Word 文档',
        icon: FileText,
        iconColor: 'text-blue-500',
        command: 'CONVERT_TO_WORD',
        featureId: 'convert-word',
      },
      {
        id: 'export-excel',
        label: 'Excel (.xlsx)',
        sublabel: '结构化工作簿表格导出',
        icon: TableIcon,
        iconColor: 'text-emerald-500',
        command: 'CONVERT_TO_EXCEL',
        featureId: 'convert-excel',
      },
      {
        id: 'export-image',
        label: '图片',
        sublabel: '高精度位图输出',
        icon: ImageIcon,
        iconColor: 'text-amber-500',
        children: [
          {
            id: 'export-image-png',
            label: 'PNG',
            sublabel: '无损透明通道图片 (.png)',
            icon: ImageIcon,
            iconColor: 'text-blue-500',
            command: 'EXPORT_IMAGE_PNG',
            featureId: 'export-image-png',
          },
          {
            id: 'export-image-jpg',
            label: 'JPG',
            sublabel: '高效相片压缩格式 (.jpg)',
            icon: ImageIcon,
            iconColor: 'text-amber-500',
            command: 'EXPORT_IMAGE_JPG',
            featureId: 'export-image-jpg',
          },
          {
            id: 'export-image-webp',
            label: 'WEBP',
            sublabel: '轻量网络图片格式 (.webp)',
            icon: Globe,
            iconColor: 'text-emerald-500',
            command: 'EXPORT_IMAGE_WEBP',
            featureId: 'export-image-webp',
          },
        ],
      },
      {
        id: 'export-long-image',
        label: '长图',
        sublabel: '多页垂直无缝拼接长图',
        icon: Layers,
        iconColor: 'text-teal-500',
        command: 'EXPORT_LONG_IMAGE',
        featureId: 'export-long-image',
      },
      {
        id: 'export-text',
        label: 'TXT',
        sublabel: '纯文本文件 (.txt)',
        icon: FileText,
        iconColor: 'text-neutral-500',
        command: 'EXPORT_TEXT_TXT',
        featureId: 'export-text-txt',
      },
    ],
  },
  {
    id: 'print',
    label: '打印',
    shortcut: '⌘P',
    icon: Printer,
    iconColor: 'text-neutral-500',
    command: 'PRINT_DOCUMENT',
    featureId: 'print-document',
  },
  {
    id: 'properties',
    label: '属性',
    shortcut: '⌘I',
    icon: Info,
    iconColor: 'text-blue-500',
    command: 'DOCUMENT_PROPERTIES',
    featureId: 'document-properties',
  },
];

interface FileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed?: boolean;
}

export const FileMenu: React.FC<FileMenuProps> = ({
  isOpen,
  onClose,
  isCollapsed = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Active path for hover / expansion: [level0_id, level1_id, level2_id]
  const [activePath, setActivePath] = useState<string[]>([]);
  // Keyboard focus index per level
  const [focusedIndexByLevel, setFocusedIndexByLevel] = useState<number[]>([0, -1, -1]);

  // Reset states when closed
  useEffect(() => {
    if (!isOpen) {
      setActivePath([]);
      setFocusedIndexByLevel([0, -1, -1]);
    }
  }, [isOpen]);

  // Execute a command item strictly through Command Dispatcher
  const handleExecuteCommand = useCallback(
    (item: MenuItemDef) => {
      if (item.disabled) return;
      if (item.command) {
        commandDispatcher.dispatch({
          type: item.command,
          payload: item.payload,
          metadata: {
            source: 'sidebar',
            description: item.label,
            featureId: item.featureId,
          },
        });
      }
      onClose();
    },
    [onClose]
  );

  // Hover handlers
  const handleItemMouseEnter = (item: MenuItemDef, level: number) => {
    const newPath = activePath.slice(0, level);
    if (item.children && item.children.length > 0) {
      newPath[level] = item.id;
    }
    setActivePath(newPath);

    const newIndices = [...focusedIndexByLevel];
    newIndices[level] = getLevelItems(level).findIndex((i) => i.id === item.id);
    // clear child focus
    for (let l = level + 1; l < newIndices.length; l++) {
      newIndices[l] = -1;
    }
    setFocusedIndexByLevel(newIndices);
  };

  // Helper to get items at a specific level
  const getLevelItems = (level: number): MenuItemDef[] => {
    if (level === 0) return FILE_MENU_STRUCTURE;
    if (level === 1) {
      const parent0 = FILE_MENU_STRUCTURE.find((i) => i.id === activePath[0]);
      return parent0?.children || [];
    }
    if (level === 2) {
      const parent0 = FILE_MENU_STRUCTURE.find((i) => i.id === activePath[0]);
      const parent1 = parent0?.children?.find((i) => i.id === activePath[1]);
      return parent1?.children || [];
    }
    return [];
  };

  // Current active level for keyboard navigation
  const currentNavLevel = activePath.length;

  // Keyboard navigation handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const items = getLevelItems(currentNavLevel);
      const currentIndex = focusedIndexByLevel[currentNavLevel] ?? 0;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        const nextIndex = items.length === 0 ? 0 : (currentIndex + 1) % items.length;
        setFocusedIndexByLevel((prev) => {
          const updated = [...prev];
          updated[currentNavLevel] = nextIndex;
          return updated;
        });
        const focusedItem = items[nextIndex];
        if (focusedItem?.children && focusedItem.children.length > 0) {
          setActivePath((prev) => {
            const nextP = prev.slice(0, currentNavLevel);
            nextP[currentNavLevel] = focusedItem.id;
            return nextP;
          });
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        const prevIndex = items.length === 0 ? 0 : (currentIndex - 1 + items.length) % items.length;
        setFocusedIndexByLevel((prev) => {
          const updated = [...prev];
          updated[currentNavLevel] = prevIndex;
          return updated;
        });
        const focusedItem = items[prevIndex];
        if (focusedItem?.children && focusedItem.children.length > 0) {
          setActivePath((prev) => {
            const nextP = prev.slice(0, currentNavLevel);
            nextP[currentNavLevel] = focusedItem.id;
            return nextP;
          });
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        const focusedItem = items[currentIndex];
        if (focusedItem?.children && focusedItem.children.length > 0) {
          setActivePath((prev) => {
            const nextP = prev.slice(0, currentNavLevel);
            nextP[currentNavLevel] = focusedItem.id;
            return nextP;
          });
          setFocusedIndexByLevel((prev) => {
            const updated = [...prev];
            updated[currentNavLevel + 1] = 0;
            return updated;
          });
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        if (currentNavLevel > 0) {
          setActivePath((prev) => prev.slice(0, currentNavLevel - 1));
          setFocusedIndexByLevel((prev) => {
            const updated = [...prev];
            updated[currentNavLevel] = -1;
            return updated;
          });
        }
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        const focusedItem = items[currentIndex];
        if (focusedItem) {
          if (focusedItem.children && focusedItem.children.length > 0) {
            setActivePath((prev) => {
              const nextP = prev.slice(0, currentNavLevel);
              nextP[currentNavLevel] = focusedItem.id;
              return nextP;
            });
            setFocusedIndexByLevel((prev) => {
              const updated = [...prev];
              updated[currentNavLevel + 1] = 0;
              return updated;
            });
          } else {
            handleExecuteCommand(focusedItem);
          }
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (currentNavLevel > 0) {
          setActivePath((prev) => prev.slice(0, currentNavLevel - 1));
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activePath, focusedIndexByLevel, currentNavLevel, handleExecuteCommand, onClose]);

  if (!isOpen) return null;

  // Render a menu panel for a specific level
  const renderPanel = (items: MenuItemDef[], level: number, parentId?: string) => {
    if (!items || items.length === 0) return null;

    const isRoot = level === 0;
    const activeSubId = activePath[level];
    const focusedIdx = focusedIndexByLevel[level];

    return (
      <div
        key={`level-${level}-${parentId || 'root'}`}
        role="menu"
        aria-orientation="vertical"
        className={`w-64 rounded-xl bg-white/95 dark:bg-[#1e1e22]/95 backdrop-blur-2xl shadow-[0_16px_40px_rgba(0,0,0,0.18)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.6)] border border-neutral-200/90 dark:border-neutral-750/90 p-1.5 z-[99999] animate-in fade-in zoom-in-95 duration-100 select-none ${
          isRoot
            ? isCollapsed
              ? 'absolute left-14 top-0'
              : 'absolute left-0 right-0 top-full -mt-[1px] w-full min-w-[240px]'
            : 'absolute left-[calc(100%+4px)] top-0'
        }`}
      >
        <div className="space-y-0.5">
          {items.map((item, idx) => {
            const hasChildren = Boolean(item.children && item.children.length > 0);
            const isSubOpen = activeSubId === item.id;
            const isKeyboardFocused = focusedIdx === idx;
            const Icon = item.icon;

            // Get capability status from FeatureRegistry if bound
            const capability: FeatureCapability | undefined = item.featureId
              ? getFeatureCapability(item.featureId)
              : undefined;

            const isDev = capability?.status === 'in_development';
            const isNotImplemented = capability?.status === 'not_implemented';
            const isEffectiveDisabled = item.disabled || isNotImplemented;

            return (
              <div
                key={item.id}
                className="relative group"
                onMouseEnter={() => handleItemMouseEnter(item, level)}
              >
                <button
                  type="button"
                  role="menuitem"
                  id={`file-menu-item-${item.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (hasChildren) {
                      setActivePath((prev) => {
                        const nextP = prev.slice(0, level);
                        if (prev[level] === item.id) {
                          return nextP; // toggle close
                        }
                        nextP[level] = item.id;
                        return nextP;
                      });
                    } else {
                      handleExecuteCommand(item);
                    }
                  }}
                  disabled={isEffectiveDisabled}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                    isSubOpen || isKeyboardFocused
                      ? 'bg-blue-600 text-white font-medium shadow-2xs'
                      : 'text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 font-normal'
                  } ${isEffectiveDisabled ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0 pr-1">
                    {Icon && (
                      <Icon
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isSubOpen || isKeyboardFocused
                            ? 'text-white'
                            : item.iconColor || 'text-neutral-500 dark:text-neutral-400'
                        }`}
                      />
                    )}
                    <div className="flex flex-col items-start min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate leading-tight">{item.label}</span>
                        {isDev && (
                          <span
                            className={`text-[9px] px-1 py-0.2 rounded font-medium ${
                              isSubOpen || isKeyboardFocused
                                ? 'bg-amber-400/30 text-amber-100'
                                : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            开发中
                          </span>
                        )}
                        {isNotImplemented && (
                          <span
                            className={`text-[9px] px-1 py-0.2 rounded font-medium ${
                              isSubOpen || isKeyboardFocused
                                ? 'bg-neutral-500/30 text-neutral-200'
                                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'
                            }`}
                          >
                            不可用
                          </span>
                        )}
                      </div>
                      {item.sublabel && (
                        <span
                          className={`text-[10px] truncate leading-none mt-0.5 ${
                            isSubOpen || isKeyboardFocused
                              ? 'text-blue-100'
                              : 'text-neutral-400 dark:text-neutral-500'
                          }`}
                        >
                          {item.sublabel}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0 pl-1">
                    {item.shortcut && (
                      <kbd
                        className={`text-[10px] font-mono px-1 py-0.2 rounded ${
                          isSubOpen || isKeyboardFocused
                            ? 'text-blue-100 bg-blue-700/60'
                            : 'text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-800'
                        }`}
                      >
                        {item.shortcut}
                      </kbd>
                    )}
                    {hasChildren && (
                      <ChevronRight
                        className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                          isSubOpen || isKeyboardFocused
                            ? 'text-white translate-x-0.5'
                            : 'text-neutral-400 dark:text-neutral-500'
                        }`}
                      />
                    )}
                  </div>
                </button>

                {/* Render Child Submenu */}
                {hasChildren && isSubOpen && renderPanel(item.children!, level + 1, item.id)}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div ref={containerRef} className="relative select-none">
      {renderPanel(FILE_MENU_STRUCTURE, 0)}
    </div>
  );
};
