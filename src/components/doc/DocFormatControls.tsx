import React, { useState, useRef, useEffect } from 'react';
import { Extension } from '@tiptap/core';
import {
  ChevronDown,
  Type,
  Baseline,
  Highlighter,
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  Strikethrough as StrikethroughIcon,
  Code,
  Superscript as SuperIcon,
  Subscript as SubIcon,
  Check,
  RotateCcw,
  Palette,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Indent,
  Outdent,
  Pilcrow,
  PaintBucket,
  Square,
  Grid,
  Minus,
  Table as TableIcon,
  Plus,
  Trash2,
  Columns,
  Rows,
  Split,
  Merge,
  Search,
  Sparkles,
  Maximize,
  Box,
  FilePlus,
} from 'lucide-react';
import { getSystemFonts, SystemFontOption, COMMON_SYSTEM_FONTS } from '../../utils/fontDetector';
import {
  DocFormattingContextResolver,
  FormattingContext,
  FormattedValue,
  TriState,
} from '../../core/formatting';

// ==================== Tiptap Custom Extensions ====================

/**
 * Custom Tiptap FontSize Extension
 */
export const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return {
      types: ['textStyle'],
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize?.replace(/['"]+/g, ''),
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }) => {
          return chain().setMark('textStyle', { fontSize }).run();
        },
      unsetFontSize:
        () =>
        ({ chain }) => {
          return chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run();
        },
    } as any;
  },
});

/**
 * Custom Tiptap LineHeight Extension
 */
export const LineHeight = Extension.create({
  name: 'lineHeight',
  addOptions() {
    return {
      types: ['paragraph', 'heading'],
      defaultLineHeight: '21px',
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element) => element.style.lineHeight || null,
            renderHTML: (attributes) => {
              if (!attributes.lineHeight) return {};
              return { style: `line-height: ${attributes.lineHeight}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setLineHeight:
        (lineHeight: string) =>
        ({ commands }: any) => {
          return (this.options.types as string[]).every((type: string) =>
            commands.updateAttributes(type, { lineHeight })
          );
        },
      unsetLineHeight:
        () =>
        ({ commands }: any) => {
          return (this.options.types as string[]).every((type: string) =>
            commands.resetAttributes(type, ['lineHeight'])
          );
        },
    } as any;
  },
});

/**
 * Custom Tiptap TextIndent / Shading / Border Extension for Paragraphs
 */
export const ParagraphFormatting = Extension.create({
  name: 'paragraphFormatting',
  addOptions() {
    return {
      types: ['paragraph', 'heading'],
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          textIndent: {
            default: null,
            parseHTML: (element) => element.style.textIndent || null,
            renderHTML: (attributes) => {
              if (!attributes.textIndent) return {};
              return { style: `text-indent: ${attributes.textIndent}` };
            },
          },
          shadingColor: {
            default: null,
            parseHTML: (element) => element.style.backgroundColor || null,
            renderHTML: (attributes) => {
              if (!attributes.shadingColor) return {};
              return {
                style: `background-color: ${attributes.shadingColor}; padding: 4px 8px; border-radius: 4px;`,
              };
            },
          },
          borderStyle: {
            default: null,
            parseHTML: (element) => element.style.border || null,
            renderHTML: (attributes) => {
              if (!attributes.borderStyle) return {};
              return {
                style: `${attributes.borderStyle}; padding: 4px 8px;`,
              };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setTextIndent:
        (textIndent: string) =>
        ({ commands }: any) => {
          return (this.options.types as string[]).every((type: string) =>
            commands.updateAttributes(type, { textIndent })
          );
        },
      setShading:
        (shadingColor: string | null) =>
        ({ commands }: any) => {
          return (this.options.types as string[]).every((type: string) =>
            commands.updateAttributes(type, { shadingColor })
          );
        },
      setParagraphBorder:
        (borderStyle: string | null) =>
        ({ commands }: any) => {
          return (this.options.types as string[]).every((type: string) =>
            commands.updateAttributes(type, { borderStyle })
          );
        },
    } as any;
  },
});

// ==================== Font Size & Color Constants ====================

export interface FontSizeOption {
  label: string;
  pt: number;
}

export const WPS_FONT_SIZES: FontSizeOption[] = [
  { label: '初号 (42pt)', pt: 42 },
  { label: '小初 (36pt)', pt: 36 },
  { label: '一号 (26pt)', pt: 26 },
  { label: '小一 (24pt)', pt: 24 },
  { label: '二号 (22pt)', pt: 22 },
  { label: '小二 (18pt)', pt: 18 },
  { label: '三号 (16pt)', pt: 16 },
  { label: '小三 (15pt)', pt: 15 },
  { label: '四号 (14pt)', pt: 14 },
  { label: '小四 (12pt)', pt: 12 },
  { label: '五号 (10.5pt)', pt: 10.5 },
  { label: '小五 (9pt)', pt: 9 },
  { label: '六号 (7.5pt)', pt: 7.5 },
  { label: '七号 (5.5pt)', pt: 5.5 },
  { label: '八号 (5pt)', pt: 5 },
  { label: '48 pt', pt: 48 },
  { label: '72 pt', pt: 72 },
];

export const PT_STEPS = [5, 5.5, 7.5, 9, 10.5, 12, 14, 15, 16, 18, 22, 24, 26, 36, 42, 48, 72];

export const WPS_THEME_COLORS = [
  ['#ffffff', '#000000', '#eeece1', '#1f497d', '#4f81bd', '#c0504d', '#9bbb59', '#8064a2', '#4bacc6', '#f79646'],
  ['#f2f2f2', '#7f7f7f', '#ddd9c3', '#c6d9f0', '#dce6f1', '#f2dcdb', '#ebf1dd', '#e5e0ec', '#dbeef3', '#fdeada'],
  ['#d8d8d8', '#595959', '#c4bd97', '#8db3e2', '#b8cce4', '#e5b9b7', '#d7e3bc', '#ccc1d9', '#b7dde8', '#fbd5b5'],
  ['#bfbfbf', '#3f3f3f', '#938953', '#548dd4', '#95b3d7', '#d99694', '#c3d69b', '#b2a2c7', '#92cddc', '#fac08f'],
  ['#a5a5a5', '#262626', '#494429', '#17365d', '#366092', '#953734', '#76923c', '#5f497a', '#31859b', '#e36c09'],
];

export const WPS_STANDARD_COLORS = [
  '#c00000',
  '#ff0000',
  '#ffc000',
  '#ffff00',
  '#92d050',
  '#00b050',
  '#00b0f0',
  '#0070c0',
  '#002060',
  '#7030a0',
];

export const WPS_HIGHLIGHT_COLORS = [
  { label: '荧光黄', color: '#ffff00' },
  { label: '亮绿', color: '#00ff00' },
  { label: '天蓝', color: '#00ffff' },
  { label: '粉红', color: '#ff00ff' },
  { label: '亮橙', color: '#ff9900' },
  { label: '浅绿', color: '#b6d7a8' },
  { label: '浅蓝', color: '#9fc5e8' },
  { label: '浅紫', color: '#b4a7d6' },
  { label: '浅红', color: '#ea9999' },
  { label: '浅灰', color: '#d9d9d9' },
];

// ==================== 1. 层级选择下拉菜单 (Heading Dropdown) ====================
export interface HierarchyDropdownProps {
  editor: any;
}

export const HierarchyDropdown: React.FC<HierarchyDropdownProps> = ({ editor }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  if (!editor) return null;

  const getCurrentLabel = () => {
    if (editor.isActive('heading', { level: 1 })) return '标题 (H1)';
    if (editor.isActive('heading', { level: 2 })) return '标题 (H2)';
    if (editor.isActive('heading', { level: 3 })) return '标题 (H3)';
    if (editor.isActive('heading', { level: 4 })) return '标题 (H4)';
    if (editor.isActive('heading', { level: 5 })) return '标题 (H5)';
    if (editor.isActive('heading', { level: 6 })) return '标题 (H6)';
    if (editor.isActive('blockquote')) return '引用段落';
    if (editor.isActive('codeBlock')) return '代码块';
    return '正文 (Normal)';
  };

  const headingOptions = [
    { level: 1, label: '标题 (H1)', className: 'text-base font-bold' },
    { level: 2, label: '标题 (H2)', className: 'text-sm font-bold' },
    { level: 3, label: '标题 (H3)', className: 'text-xs font-bold' },
    { level: 4, label: '标题 (H4)', className: 'text-xs font-semibold' },
    { level: 5, label: '标题 (H5)', className: 'text-xs font-medium' },
    { level: 6, label: '标题 (H6)', className: 'text-[11px] font-medium' },
  ];

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-medium text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-750 transition-colors shadow-2xs min-w-[95px] justify-between"
        title="切换标题与正文样式"
      >
        <span>{getCurrentLabel()}</span>
        <ChevronDown className="w-3 h-3 text-neutral-400 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-48 bg-white dark:bg-[#1c1c1e] rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 py-1.5 z-[99999] animate-in fade-in duration-100 select-none max-h-72 overflow-y-auto">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              editor.chain().focus().setParagraph().run();
              setIsOpen(false);
            }}
            className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between transition-colors ${
              editor.isActive('paragraph') && !editor.isActive('heading')
                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 font-semibold'
                : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
            }`}
          >
            <span>正文 (Normal)</span>
            {editor.isActive('paragraph') && !editor.isActive('heading') && (
              <Check className="w-3.5 h-3.5 text-blue-600" />
            )}
          </button>

          <div className="my-1 border-t border-neutral-100 dark:border-neutral-800" />

          {headingOptions.map((h) => {
            const isActive = editor.isActive('heading', { level: h.level });
            return (
              <button
                key={h.level}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  editor.chain().focus().toggleHeading({ level: h.level as any }).run();
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-1.5 text-left flex items-center justify-between transition-colors ${h.className} ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600'
                    : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200'
                }`}
              >
                <span>{h.label}</span>
                {isActive && <Check className="w-3.5 h-3.5 text-blue-600" />}
              </button>
            );
          })}

          <div className="my-1 border-t border-neutral-100 dark:border-neutral-800" />

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              editor.chain().focus().toggleBlockquote().run();
              setIsOpen(false);
            }}
            className={`w-full px-3 py-1.5 text-left text-xs italic flex items-center justify-between transition-colors ${
              editor.isActive('blockquote')
                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600'
                : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
            }`}
          >
            <span>引用段落 (Quote)</span>
            {editor.isActive('blockquote') && <Check className="w-3.5 h-3.5 text-blue-600" />}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              editor.chain().focus().toggleCodeBlock().run();
              setIsOpen(false);
            }}
            className={`w-full px-3 py-1.5 text-left text-xs font-mono flex items-center justify-between transition-colors ${
              editor.isActive('codeBlock')
                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600'
                : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
            }`}
          >
            <span>代码块 (Code Block)</span>
            {editor.isActive('codeBlock') && <Check className="w-3.5 h-3.5 text-blue-600" />}
          </button>
        </div>
      )}
    </div>
  );
};

// ==================== 2. 字体选择下拉控件 (Font Family Control - 读取系统字体) ====================
export interface FontFamilyControlProps {
  currentFont?: FormattedValue<string>;
  onSetFont: (fontFamily: string) => void;
  compact?: boolean;
}

export const FontFamilyControl: React.FC<FontFamilyControlProps> = ({
  currentFont = 'PingFang SC',
  onSetFont,
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [fonts, setFonts] = useState<SystemFontOption[]>(COMMON_SYSTEM_FONTS);
  const [searchQuery, setSearchQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load local system fonts asynchronously
    let isMounted = true;
    getSystemFonts().then((loaded) => {
      if (isMounted && loaded && loaded.length > 0) {
        setFonts(loaded);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const getCleanFontName = (raw: FormattedValue<string>) => {
    if (raw === 'mixed') return '多重字体 (Mixed)';
    const matched = fonts.find((f) => f.family.toLowerCase() === raw.toLowerCase() || raw.includes(f.family));
    if (matched) return matched.name;
    const first = raw.split(',')[0].replace(/['"]/g, '').trim();
    return first || '默认字体';
  };

  const filteredFonts = fonts.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.family.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-medium transition-colors justify-between ${
          currentFont === 'mixed'
            ? 'border border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300'
            : 'text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-750'
        } ${compact ? 'min-w-[85px] max-w-[120px]' : 'min-w-[105px] max-w-[145px]'}`}
        title={`设置字体 (读取系统字体)${currentFont === 'mixed' ? ' - 选区包含多种字体' : ''}`}
      >
        <span className={`truncate ${currentFont === 'mixed' ? 'italic' : ''}`} style={{ fontFamily: currentFont === 'mixed' ? undefined : currentFont }}>
          {getCleanFontName(currentFont)}
        </span>
        <ChevronDown className="w-3 h-3 text-neutral-400 shrink-0 ml-0.5" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-60 bg-white dark:bg-[#1c1c1e] rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 py-2 z-[99999] animate-in fade-in duration-100 select-none max-h-80 flex flex-col">
          {/* Search bar */}
          <div className="px-2.5 pb-2 border-b border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center space-x-1.5 px-2 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-500 text-xs">
              <Search className="w-3.5 h-3.5 shrink-0 text-neutral-400" />
              <input
                type="text"
                placeholder="搜索已检测系统字体..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="w-full bg-transparent border-none text-xs text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Font List */}
          <div className="flex-1 overflow-y-auto py-1 space-y-0.5 no-scrollbar">
            {filteredFonts.length === 0 ? (
              <div className="p-4 text-center text-xs text-neutral-400">未找到匹配字体</div>
            ) : (
              filteredFonts.map((f) => {
                const isSelected = currentFont !== 'mixed' && currentFont.includes(f.family);
                return (
                  <button
                    key={f.family}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetFont(f.family);
                      setIsOpen(false);
                    }}
                    className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 transition-colors ${
                      isSelected
                        ? 'font-bold text-blue-600 bg-blue-50/50 dark:bg-blue-950/30'
                        : 'text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <span className="truncate pr-2" style={{ fontFamily: f.family }}>
                      {f.name}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== 2. 字号选择器 (FontSizeControl) ====================
export interface FontSizeControlProps {
  currentPt?: FormattedValue<number>;
  onSetSize: (pt: number) => void;
}

export const FontSizeControl: React.FC<FontSizeControlProps> = ({
  currentPt = 10.5,
  onSetSize,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const currentLabel = () => {
    if (currentPt === 'mixed') return '--';
    const found = WPS_FONT_SIZES.find((s) => s.pt === currentPt);
    if (found) return found.label.split(' ')[0];
    return `${currentPt} pt`;
  };

  const handleIncrease = (e: React.MouseEvent) => {
    e.stopPropagation();
    const basePt = typeof currentPt === 'number' ? currentPt : 10.5;
    const currIdx = PT_STEPS.findIndex((p) => p >= basePt);
    if (currIdx !== -1 && currIdx < PT_STEPS.length - 1) {
      onSetSize(PT_STEPS[currIdx + 1]);
    } else {
      onSetSize(Math.min(72, basePt + 2));
    }
  };

  const handleDecrease = (e: React.MouseEvent) => {
    e.stopPropagation();
    const basePt = typeof currentPt === 'number' ? currentPt : 10.5;
    const currIdx = PT_STEPS.findIndex((p) => p >= basePt);
    if (currIdx > 0) {
      onSetSize(PT_STEPS[currIdx - 1]);
    } else {
      onSetSize(Math.max(5, basePt - 2));
    }
  };

  return (
    <div className="flex items-center space-x-1" ref={dropdownRef}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`h-7 px-2.5 flex items-center justify-between space-x-1 rounded-lg border text-xs font-medium transition-colors shadow-2xs min-w-[76px] ${
            currentPt === 'mixed'
              ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300'
              : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-750'
          }`}
          title={`选择字号 (WPS 标准)${currentPt === 'mixed' ? ' - 选区包含多种字号' : ''}`}
        >
          <span className={`truncate ${currentPt === 'mixed' ? 'italic' : ''}`}>{currentLabel()}</span>
          <ChevronDown className="w-3 h-3 text-neutral-400 shrink-0" />
        </button>

        {isOpen && (
          <div className="absolute left-0 top-full mt-1 w-44 max-h-60 overflow-y-auto bg-white dark:bg-[#1c1c1e] rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 py-1 z-[99999] animate-in fade-in select-none no-scrollbar">
            <div className="px-2.5 py-1 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
              常用字号 (WPS)
            </div>
            {WPS_FONT_SIZES.map((size) => {
              const isSelected = size.pt === currentPt;
              return (
                <button
                  key={size.label}
                  type="button"
                  onClick={() => {
                    onSetSize(size.pt);
                    setIsOpen(false);
                  }}
                  className={`w-full px-2.5 py-1 text-left text-xs flex items-center justify-between hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 transition-colors ${
                    isSelected
                      ? 'font-bold text-blue-600 bg-blue-50/50 dark:bg-blue-950/30'
                      : 'text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  <span>{size.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleIncrease}
        className="w-7 h-7 flex items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 text-neutral-700 dark:text-neutral-300 transition-colors shadow-2xs font-bold text-xs"
        title="增大字号"
      >
        <span>A⁺</span>
      </button>

      <button
        type="button"
        onClick={handleDecrease}
        className="w-7 h-7 flex items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 text-neutral-700 dark:text-neutral-300 transition-colors shadow-2xs font-medium text-xs"
        title="缩小字号"
      >
        <span>A⁻</span>
      </button>
    </div>
  );
};

// ==================== 3. 字号选择器 + 字体组合按钮 (字号在左，字体在右，中划分割线) ====================
export interface FontSizeAndFamilyComboProps {
  currentPt?: number;
  onSetSize: (pt: number) => void;
  currentFont?: string;
  onSetFont: (font: string) => void;
}

export const FontSizeAndFamilyCombo: React.FC<FontSizeAndFamilyComboProps> = ({
  currentPt = 10.5,
  onSetSize,
  currentFont = 'PingFang SC',
  onSetFont,
}) => {
  const [isSizeOpen, setIsSizeOpen] = useState(false);
  const sizeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (sizeRef.current && !sizeRef.current.contains(e.target as Node)) {
        setIsSizeOpen(false);
      }
    };
    if (isSizeOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isSizeOpen]);

  const currentSizeLabel = () => {
    const found = WPS_FONT_SIZES.find((s) => s.pt === currentPt);
    if (found) return found.label.split(' ')[0];
    return `${currentPt} pt`;
  };

  const handleIncrease = (e: React.MouseEvent) => {
    e.stopPropagation();
    const currIdx = PT_STEPS.findIndex((p) => p >= currentPt);
    if (currIdx !== -1 && currIdx < PT_STEPS.length - 1) {
      onSetSize(PT_STEPS[currIdx + 1]);
    } else {
      onSetSize(Math.min(72, currentPt + 2));
    }
  };

  const handleDecrease = (e: React.MouseEvent) => {
    e.stopPropagation();
    const currIdx = PT_STEPS.findIndex((p) => p >= currentPt);
    if (currIdx > 0) {
      onSetSize(PT_STEPS[currIdx - 1]);
    } else {
      onSetSize(Math.max(5, currentPt - 2));
    }
  };

  return (
    <div className="flex items-center space-x-1">
      {/* Grouped Box: 字号 (左) | 竖向分割线 | 字体 (右) */}
      <div className="flex items-center rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-0.5 shadow-2xs">
        {/* Left: 字号 Dropdown */}
        <div className="relative" ref={sizeRef}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsSizeOpen(!isSizeOpen);
            }}
            className="flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-medium text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-750 transition-colors min-w-[58px] justify-between"
            title="设置字号 (WPS 标准)"
          >
            <span>{currentSizeLabel()}</span>
            <ChevronDown className="w-3 h-3 text-neutral-400 shrink-0" />
          </button>

          {isSizeOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-40 max-h-60 overflow-y-auto bg-white dark:bg-[#1c1c1e] rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 py-1.5 z-[99999] animate-in fade-in duration-100 select-none">
              {WPS_FONT_SIZES.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetSize(item.pt);
                    setIsSizeOpen(false);
                  }}
                  className={`w-full px-2.5 py-1.5 text-left text-xs flex items-center justify-between hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 transition-colors ${
                    item.pt === currentPt
                      ? 'font-bold text-blue-600 bg-blue-50/50 dark:bg-blue-950/30'
                      : 'text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  <span>{item.label}</span>
                  {item.pt === currentPt && <Check className="w-3 h-3 text-blue-600" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Vertical Divider */}
        <div className="h-3.5 w-[1px] bg-neutral-200 dark:bg-neutral-700 mx-0.5 shrink-0" />

        {/* Right: 字体 Dropdown (读取系统字体) */}
        <FontFamilyControl
          currentFont={currentFont}
          onSetFont={onSetFont}
          compact
        />
      </div>

      {/* A+ Increase Button */}
      <button
        type="button"
        onClick={handleIncrease}
        className="p-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-750 transition-colors shadow-2xs font-bold text-xs flex items-center justify-center w-7 h-7"
        title="增大字号 (A+)"
      >
        <span className="text-[11px]">A<span className="text-[9px] text-blue-600 font-bold">+</span></span>
      </button>

      {/* A- Decrease Button */}
      <button
        type="button"
        onClick={handleDecrease}
        className="p-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-750 transition-colors shadow-2xs font-bold text-xs flex items-center justify-center w-7 h-7"
        title="减小字号 (A-)"
      >
        <span className="text-[11px]">A<span className="text-[9px] text-rose-500 font-bold">-</span></span>
      </button>
    </div>
  );
};

// ==================== 4. 文本颜色调色板 (WPS Text Color) ====================
export interface TextColorPickerProps {
  currentColor?: FormattedValue<string>;
  onSetColor: (color: string) => void;
}

export const TextColorPicker: React.FC<TextColorPickerProps> = ({
  currentColor = '#111827',
  onSetColor,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [customHex, setCustomHex] = useState(typeof currentColor === 'string' ? currentColor : '#111827');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const isMixed = currentColor === 'mixed';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`flex items-center space-x-1 px-1.5 py-1 rounded-lg border transition-colors shadow-2xs ${
          isMixed
            ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/30'
            : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-750'
        }`}
        title={`字体颜色 (WPS 调色盘)${isMixed ? ' - 选区包含多种颜色' : ''}`}
      >
        <div className="flex flex-col items-center justify-center">
          <span className="text-xs font-bold font-serif leading-none">A</span>
          <div
            className="w-4 h-1 rounded-full mt-0.5"
            style={{
              background: isMixed
                ? 'linear-gradient(90deg, #ef4444, #3b82f6, #10b981)'
                : (currentColor as string),
            }}
          />
        </div>
        <ChevronDown className="w-2.5 h-2.5 text-neutral-400" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-56 bg-white dark:bg-[#1c1c1e] rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 p-2.5 z-[99999] animate-in fade-in duration-100 select-none space-y-2">
          {/* Default Auto Color */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSetColor('#111827');
              setIsOpen(false);
            }}
            className="w-full flex items-center justify-between px-2 py-1 rounded-lg text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
          >
            <div className="flex items-center space-x-2">
              <div className="w-3.5 h-3.5 rounded bg-[#111827] border border-neutral-300" />
              <span>自动 / 默认黑色</span>
            </div>
            {currentColor === '#111827' && <Check className="w-3 h-3 text-blue-600" />}
          </button>

          {/* Theme Colors */}
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-neutral-400">主题颜色</div>
            <div className="space-y-0.5">
              {WPS_THEME_COLORS.map((row, rIdx) => (
                <div key={rIdx} className="grid grid-cols-10 gap-0.5">
                  {row.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSetColor(c);
                        setIsOpen(false);
                      }}
                      className="w-4.5 h-4.5 rounded-sm border border-neutral-200/50 hover:scale-125 transition-transform"
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Standard Colors */}
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-neutral-400">标准色</div>
            <div className="grid grid-cols-10 gap-0.5">
              {WPS_STANDARD_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetColor(c);
                    setIsOpen(false);
                  }}
                  className="w-4.5 h-4.5 rounded-sm border border-neutral-200/50 hover:scale-125 transition-transform"
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>

          {/* Custom Color Input */}
          <div className="pt-1.5 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <input
                type="color"
                value={customHex}
                onChange={(e) => setCustomHex(e.target.value)}
                className="w-5 h-5 rounded cursor-pointer border-0 p-0"
              />
              <span className="text-[11px] font-mono text-neutral-500">{customHex}</span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSetColor(customHex);
                setIsOpen(false);
              }}
              className="px-2 py-0.5 rounded bg-blue-600 text-white text-[10px] font-medium"
            >
              应用
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== 5. 荧光笔 / 文字高亮 (Highlight Picker) ====================
export interface HighlightPickerProps {
  currentBg?: FormattedValue<string | null>;
  onSetBg: (color: string | null) => void;
}

export const HighlightPicker: React.FC<HighlightPickerProps> = ({ currentBg, onSetBg }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const isMixed = currentBg === 'mixed';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`flex items-center space-x-1 px-1.5 py-1 rounded-lg border transition-colors shadow-2xs ${
          isMixed
            ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/30'
            : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-750'
        }`}
        title={`文字突出显示色 / 荧光笔${isMixed ? ' - 选区包含多种高亮' : ''}`}
      >
        <div className="flex flex-col items-center justify-center">
          <Highlighter className="w-3.5 h-3.5 text-neutral-700 dark:text-neutral-200" />
          <div
            className="w-4 h-1 rounded-full mt-0.5"
            style={{
              background: isMixed
                ? 'linear-gradient(90deg, #fde047, #86efac, #93c5fd)'
                : ((currentBg as string) || '#ffff00'),
            }}
          />
        </div>
        <ChevronDown className="w-2.5 h-2.5 text-neutral-400" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-48 bg-white dark:bg-[#1c1c1e] rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 p-2 z-[99999] animate-in fade-in duration-100 select-none space-y-2">
          <div className="text-[10px] font-bold text-neutral-400">荧光笔颜色</div>
          <div className="grid grid-cols-5 gap-1.5">
            {WPS_HIGHLIGHT_COLORS.map((item) => (
              <button
                key={item.color}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSetBg(item.color);
                  setIsOpen(false);
                }}
                className="w-7 h-7 rounded-lg border border-neutral-200/70 dark:border-neutral-700 flex items-center justify-center hover:scale-110 transition-transform"
                style={{ backgroundColor: item.color }}
                title={item.label}
              >
                {currentBg === item.color && <Check className="w-3.5 h-3.5 text-neutral-900" />}
              </button>
            ))}
          </div>

          <div className="pt-1 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSetBg(null);
                setIsOpen(false);
              }}
              className="w-full py-1 text-center text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            >
              无颜色 / 清除高亮
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== 6. 行距按钮 (Line Spacing Control - 和 WPS Office 一样) ====================
export interface LineSpacingControlProps {
  editor: any;
}

export const LineSpacingControl: React.FC<LineSpacingControlProps> = ({ editor }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  if (!editor) return null;

  const lineSpacingOptions = [
    { label: '单倍行距 (1.0)', value: '1.0' },
    { label: '1.15 倍行距', value: '1.15' },
    { label: '1.25 倍行距', value: '1.25' },
    { label: '1.5 倍行距 (公文标准)', value: '1.5' },
    { label: '1.75 倍行距', value: '1.75' },
    { label: '2.0 倍双倍行距', value: '2.0' },
    { label: '2.5 倍行距', value: '2.5' },
    { label: '3.0 倍行距', value: '3.0' },
  ];

  const handleApplyLineHeight = (lh: string) => {
    (editor.chain().focus() as any).setLineHeight?.(lh);
    // Direct DOM fallback for reliability
    const sel = window.getSelection();
    if (sel && sel.anchorNode) {
      let el = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : (sel.anchorNode as HTMLElement);
      while (el && !['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI'].includes(el.tagName)) {
        el = el.parentElement;
      }
      if (el) {
        el.style.lineHeight = lh;
      }
    }
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-750 transition-colors shadow-2xs flex items-center space-x-0.5"
        title="行距设置 (WPS 标准)"
      >
        <Pilcrow className="w-3.5 h-3.5" />
        <ChevronDown className="w-2.5 h-2.5 text-neutral-400" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-44 bg-white dark:bg-[#1c1c1e] rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 py-1.5 z-[99999] animate-in fade-in select-none">
          <div className="px-3 py-1 text-[10px] font-bold text-neutral-400 uppercase">行距设置</div>
          {lineSpacingOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleApplyLineHeight(opt.value);
              }}
              className="w-full px-3 py-1.5 text-left text-xs hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 text-neutral-700 dark:text-neutral-300 transition-colors flex items-center justify-between"
            >
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ==================== 7. 中文版式下拉按钮 (Chinese Typography) ====================
export interface ChineseTypographyControlProps {
  editor: any;
}

export const ChineseTypographyControl: React.FC<ChineseTypographyControlProps> = ({ editor }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  if (!editor) return null;

  const handleChineseIndent = () => {
    // Apply 2-character Chinese First Line Indent (2em)
    (editor.chain().focus() as any).setTextIndent?.('2em');
    const sel = window.getSelection();
    if (sel && sel.anchorNode) {
      let el = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : (sel.anchorNode as HTMLElement);
      while (el && !['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(el.tagName)) {
        el = el.parentElement;
      }
      if (el) el.style.textIndent = '2em';
    }
    setIsOpen(false);
  };

  const handleClearIndent = () => {
    (editor.chain().focus() as any).setTextIndent?.('0');
    const sel = window.getSelection();
    if (sel && sel.anchorNode) {
      let el = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : (sel.anchorNode as HTMLElement);
      while (el && !['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(el.tagName)) {
        el = el.parentElement;
      }
      if (el) el.style.textIndent = '0';
    }
    setIsOpen(false);
  };

  const handleLetterSpacing = (spacing: string) => {
    const sel = window.getSelection();
    if (sel && sel.anchorNode) {
      let el = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : (sel.anchorNode as HTMLElement);
      while (el && !['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'DIV'].includes(el.tagName)) {
        el = el.parentElement;
      }
      if (el) el.style.letterSpacing = spacing;
    }
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="flex items-center space-x-1 px-2 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-750 transition-colors shadow-2xs"
        title="中文版式 (首行缩进/字符间距)"
      >
        <span className="font-serif font-bold text-blue-600">文</span>
        <ChevronDown className="w-2.5 h-2.5 text-neutral-400" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-52 bg-white dark:bg-[#1c1c1e] rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 py-1.5 z-[99999] animate-in fade-in select-none space-y-1">
          <div className="px-3 py-1 text-[10px] font-bold text-neutral-400 uppercase">中文段落规范</div>

          <button
            type="button"
            onClick={handleChineseIndent}
            className="w-full px-3 py-1.5 text-left text-xs hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 text-neutral-700 dark:text-neutral-300 transition-colors flex items-center justify-between"
          >
            <span>首行缩进 2 字符 (标准公文)</span>
            <Indent className="w-3.5 h-3.5 text-blue-500" />
          </button>

          <button
            type="button"
            onClick={handleClearIndent}
            className="w-full px-3 py-1.5 text-left text-xs hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 text-neutral-700 dark:text-neutral-300 transition-colors flex items-center justify-between"
          >
            <span>取消首行缩进</span>
            <Outdent className="w-3.5 h-3.5 text-neutral-400" />
          </button>

          <div className="my-1 border-t border-neutral-100 dark:border-neutral-800" />
          <div className="px-3 py-1 text-[10px] font-bold text-neutral-400 uppercase">字符间距 (字距)</div>

          {[
            { label: '紧凑字距 (-0.5px)', val: '-0.5px' },
            { label: '标准字距 (0px)', val: '0px' },
            { label: '加宽字距 (+1.5px)', val: '1.5px' },
            { label: '大标题字距 (+3px)', val: '3px' },
          ].map((item) => (
            <button
              key={item.val}
              type="button"
              onClick={() => handleLetterSpacing(item.val)}
              className="w-full px-3 py-1 text-left text-xs hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 text-neutral-700 dark:text-neutral-300"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ==================== 8. 底纹校色按钮 (Shading / Background Color) ====================
export interface ShadingControlProps {
  editor: any;
}

export const ShadingControl: React.FC<ShadingControlProps> = ({ editor }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  if (!editor) return null;

  const handleApplyShading = (color: string | null) => {
    (editor.chain().focus() as any).setShading?.(color);
    const sel = window.getSelection();
    if (sel && sel.anchorNode) {
      let el = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : (sel.anchorNode as HTMLElement);
      while (el && !['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'DIV', 'TD', 'TH'].includes(el.tagName)) {
        el = el.parentElement;
      }
      if (el) {
        if (color) {
          el.style.backgroundColor = color;
          el.style.padding = '6px 10px';
          el.style.borderRadius = '4px';
        } else {
          el.style.backgroundColor = 'transparent';
          el.style.padding = '';
          el.style.borderRadius = '';
        }
      }
    }
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-750 transition-colors shadow-2xs flex items-center space-x-0.5"
        title="底纹校色 (段落与单元格背景填充)"
      >
        <PaintBucket className="w-3.5 h-3.5 text-amber-600" />
        <ChevronDown className="w-2.5 h-2.5 text-neutral-400" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-56 bg-white dark:bg-[#1c1c1e] rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 p-2.5 z-[99999] animate-in fade-in select-none space-y-2">
          <div className="text-[10px] font-bold text-neutral-400">底纹填充色</div>

          {/* Theme Colors */}
          <div className="space-y-0.5">
            {WPS_THEME_COLORS.map((row, rIdx) => (
              <div key={rIdx} className="grid grid-cols-10 gap-0.5">
                {row.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApplyShading(c);
                    }}
                    className="w-4.5 h-4.5 rounded-sm border border-neutral-200/50 hover:scale-125 transition-transform"
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
            ))}
          </div>

          <div className="pt-1.5 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => handleApplyShading(null)}
              className="w-full py-1 text-center text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            >
              无底纹颜色 / 清除底纹
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== 9. 边框线按钮 (Borders Dropdown - 和 WPS Office 一样) ====================
export interface BorderControlProps {
  editor: any;
}

export const BorderControl: React.FC<BorderControlProps> = ({ editor }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  if (!editor) return null;

  const handleApplyBorder = (borderCss: string | null) => {
    (editor.chain().focus() as any).setParagraphBorder?.(borderCss);
    const sel = window.getSelection();
    if (sel && sel.anchorNode) {
      let el = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : (sel.anchorNode as HTMLElement);
      while (el && !['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'DIV', 'TABLE', 'TD', 'TH'].includes(el.tagName)) {
        el = el.parentElement;
      }
      if (el) {
        if (borderCss) {
          el.style.cssText += `; ${borderCss}; padding: 6px 10px;`;
        } else {
          el.style.border = 'none';
          el.style.borderTop = '';
          el.style.borderBottom = '';
          el.style.borderLeft = '';
          el.style.borderRight = '';
        }
      }
    }
    setIsOpen(false);
  };

  const borderOptions = [
    { label: '下框线', icon: Minus, css: 'border-bottom: 1.5px solid #3b82f6;' },
    { label: '上框线', icon: Minus, css: 'border-top: 1.5px solid #3b82f6;' },
    { label: '左框线', icon: Columns, css: 'border-left: 3px solid #3b82f6;' },
    { label: '右框线', icon: Columns, css: 'border-right: 3px solid #3b82f6;' },
    { label: '所有框线 (全边框)', icon: Grid, css: 'border: 1px solid #94a3b8; border-radius: 4px;' },
    { label: '外侧框线', icon: Square, css: 'border: 1.5px solid #475569; border-radius: 4px;' },
    { label: '粗底框线', icon: Minus, css: 'border-bottom: 3px solid #1e293b;' },
    { label: '无框线', icon: Box, css: null },
  ];

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-750 transition-colors shadow-2xs flex items-center space-x-0.5"
        title="边框线设置 (WPS 标准)"
      >
        <Grid className="w-3.5 h-3.5 text-blue-600" />
        <ChevronDown className="w-2.5 h-2.5 text-neutral-400" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-48 bg-white dark:bg-[#1c1c1e] rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 py-1.5 z-[99999] animate-in fade-in select-none">
          <div className="px-3 py-1 text-[10px] font-bold text-neutral-400 uppercase">边框线选项</div>
          {borderOptions.map((b) => {
            const Icon = b.icon;
            return (
              <button
                key={b.label}
                type="button"
                onClick={() => handleApplyBorder(b.css)}
                className="w-full px-3 py-1.5 text-left text-xs hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 text-neutral-700 dark:text-neutral-300 transition-colors flex items-center space-x-2"
              >
                <Icon className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                <span>{b.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ==================== 10. 表格菜单与 WPS 快捷选项 (Table Dropdown) ====================
export interface TableMenuControlProps {
  editor: any;
}

export const TableMenuControl: React.FC<TableMenuControlProps> = ({ editor }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  if (!editor) return null;

  const isInsideTable = editor.isActive('table');

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-xs font-medium border transition-colors shadow-2xs ${
          isInsideTable
            ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 text-blue-600'
            : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50'
        }`}
        title="表格与常用排版操作"
      >
        <TableIcon className="w-3.5 h-3.5 text-blue-500" />
        <span>表格</span>
        <ChevronDown className="w-2.5 h-2.5 text-neutral-400" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-52 bg-white dark:bg-[#1c1c1e] rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 py-1.5 z-[99999] animate-in fade-in select-none space-y-1">
          {/* Quick Insert Table */}
          <div className="px-3 py-1 text-[10px] font-bold text-neutral-400 uppercase">插入表格 (默认实线边框)</div>

          <button
            type="button"
            onClick={() => {
              editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
              setIsOpen(false);
            }}
            className="w-full px-3 py-1.5 text-left text-xs hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 text-neutral-700 dark:text-neutral-300 flex items-center justify-between"
          >
            <span>标准 3 × 3 表格 (带表头)</span>
            <Plus className="w-3.5 h-3.5 text-blue-600" />
          </button>

          <button
            type="button"
            onClick={() => {
              editor.chain().focus().insertTable({ rows: 5, cols: 4, withHeaderRow: true }).run();
              setIsOpen(false);
            }}
            className="w-full px-3 py-1.5 text-left text-xs hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 text-neutral-700 dark:text-neutral-300 flex items-center justify-between"
          >
            <span>5 × 4 数据统计表</span>
            <Plus className="w-3.5 h-3.5 text-blue-600" />
          </button>

          {/* If inside table, show active operations */}
          {isInsideTable && (
            <>
              <div className="my-1 border-t border-neutral-100 dark:border-neutral-800" />
              <div className="px-3 py-1 text-[10px] font-bold text-neutral-400 uppercase">行与列操作 (WPS 标准)</div>

              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().addRowBefore().run();
                  setIsOpen(false);
                }}
                className="w-full px-3 py-1 text-left text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center space-x-2"
              >
                <Rows className="w-3 h-3 text-emerald-500" />
                <span>上方插入一行</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().addRowAfter().run();
                  setIsOpen(false);
                }}
                className="w-full px-3 py-1 text-left text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center space-x-2"
              >
                <Rows className="w-3 h-3 text-emerald-500" />
                <span>下方插入一行</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().addColumnBefore().run();
                  setIsOpen(false);
                }}
                className="w-full px-3 py-1 text-left text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center space-x-2"
              >
                <Columns className="w-3 h-3 text-blue-500" />
                <span>左侧插入一列</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().addColumnAfter().run();
                  setIsOpen(false);
                }}
                className="w-full px-3 py-1 text-left text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center space-x-2"
              >
                <Columns className="w-3 h-3 text-blue-500" />
                <span>右侧插入一列</span>
              </button>

              <div className="my-1 border-t border-neutral-100 dark:border-neutral-800" />
              <div className="px-3 py-1 text-[10px] font-bold text-neutral-400 uppercase">合并与拆分</div>

              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().mergeCells().run();
                  setIsOpen(false);
                }}
                className="w-full px-3 py-1 text-left text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center space-x-2"
              >
                <Merge className="w-3 h-3 text-amber-500" />
                <span>合并单元格</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().splitCell().run();
                  setIsOpen(false);
                }}
                className="w-full px-3 py-1 text-left text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center space-x-2"
              >
                <Split className="w-3 h-3 text-amber-500" />
                <span>拆分单元格</span>
              </button>

              <div className="my-1 border-t border-neutral-100 dark:border-neutral-800" />

              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().deleteRow().run();
                  setIsOpen(false);
                }}
                className="w-full px-3 py-1 text-left text-xs hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 flex items-center space-x-2"
              >
                <Trash2 className="w-3 h-3" />
                <span>删除当前行</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().deleteColumn().run();
                  setIsOpen(false);
                }}
                className="w-full px-3 py-1 text-left text-xs hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 flex items-center space-x-2"
              >
                <Trash2 className="w-3 h-3" />
                <span>删除当前列</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().deleteTable().run();
                  setIsOpen(false);
                }}
                className="w-full px-3 py-1 text-left text-xs hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 font-semibold flex items-center space-x-2"
              >
                <Trash2 className="w-3 h-3" />
                <span>删除整个表格</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export interface DocFormatControlsProps {
  editor: any;
  onShowToast?: (type: 'success' | 'error' | 'info' | 'vip-free', title: string, description?: string) => void;
}

export const DocFormatControls: React.FC<DocFormatControlsProps> = ({ editor }) => {
  if (!editor) return null;

  // Real-time Context-Aware Resolution: listen to all selection & transaction updates
  const [context, setContext] = useState<FormattingContext>(() => DocFormattingContextResolver.resolve(editor));

  useEffect(() => {
    if (!editor) return;
    const update = () => {
      setContext(DocFormattingContextResolver.resolve(editor));
    };
    editor.on('transaction', update);
    editor.on('selectionUpdate', update);
    editor.on('update', update);
    editor.on('focus', update);
    update();
    return () => {
      editor.off('transaction', update);
      editor.off('selectionUpdate', update);
      editor.off('update', update);
      editor.off('focus', update);
    };
  }, [editor]);

  const isBoldActive = context.bold === true;
  const isBoldMixed = context.bold === 'mixed';
  const isItalicActive = context.italic === true;
  const isItalicMixed = context.italic === 'mixed';
  const isUnderlineActive = context.underline === true;
  const isUnderlineMixed = context.underline === 'mixed';
  const isStrikeActive = context.strike === true;
  const isStrikeMixed = context.strike === 'mixed';
  const isSuperActive = context.superscript === true;
  const isSubActive = context.subscript === true;

  return (
    <div className="flex flex-wrap items-center gap-1 px-3 py-1.5 text-xs select-none relative z-50 overflow-visible">
      {/* 1. 段落/标题层次 */}
      <HierarchyDropdown editor={editor} />

      <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

      {/* 2. 字体与字号 */}
      <FontFamilyControl
        currentFont={context.fontFamily}
        onSetFont={(font) => {
          editor.chain().focus().setFontFamily(font).run();
        }}
      />
      <FontSizeControl
        currentPt={context.fontSize}
        onSetSize={(pt) => {
          editor.chain().focus().setFontSize(`${pt}pt`).run();
        }}
      />

      <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

      {/* 3. 基础文本样式组 (加粗、斜体、下划线、删除线、上下标) */}
      <div className="flex items-center space-x-0.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-0.5 shadow-2xs">
        {/* Bold */}
        <button
          type="button"
          onClick={() => {
            if (isBoldActive) {
              editor.chain().focus().unsetBold().run();
            } else {
              editor.chain().focus().setBold().run();
            }
          }}
          className={`w-7 h-7 flex items-center justify-center rounded-md text-xs font-bold transition-colors ${
            isBoldActive
              ? 'bg-blue-600 text-white shadow-2xs'
              : isBoldMixed
              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 ring-1 ring-amber-400'
              : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-750'
          }`}
          title={`加粗 (Ctrl+B)${isBoldMixed ? ' - 选区包含部分加粗' : ''}`}
        >
          <BoldIcon className="w-3.5 h-3.5" />
        </button>

        {/* Italic */}
        <button
          type="button"
          onClick={() => {
            if (isItalicActive) {
              editor.chain().focus().unsetItalic().run();
            } else {
              editor.chain().focus().setItalic().run();
            }
          }}
          className={`w-7 h-7 flex items-center justify-center rounded-md text-xs transition-colors ${
            isItalicActive
              ? 'bg-blue-600 text-white shadow-2xs'
              : isItalicMixed
              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 ring-1 ring-amber-400'
              : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-750'
          }`}
          title={`斜体 (Ctrl+I)${isItalicMixed ? ' - 选区包含部分斜体' : ''}`}
        >
          <ItalicIcon className="w-3.5 h-3.5" />
        </button>

        {/* Underline */}
        <button
          type="button"
          onClick={() => {
            if (isUnderlineActive) {
              editor.chain().focus().unsetUnderline().run();
            } else {
              editor.chain().focus().setUnderline().run();
            }
          }}
          className={`w-7 h-7 flex items-center justify-center rounded-md text-xs transition-colors ${
            isUnderlineActive
              ? 'bg-blue-600 text-white shadow-2xs'
              : isUnderlineMixed
              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 ring-1 ring-amber-400'
              : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-750'
          }`}
          title={`下划线 (Ctrl+U)${isUnderlineMixed ? ' - 选区包含部分下划线' : ''}`}
        >
          <UnderlineIcon className="w-3.5 h-3.5" />
        </button>

        {/* Strikethrough */}
        <button
          type="button"
          onClick={() => {
            if (isStrikeActive) {
              editor.chain().focus().unsetStrike().run();
            } else {
              editor.chain().focus().setStrike().run();
            }
          }}
          className={`w-7 h-7 flex items-center justify-center rounded-md text-xs transition-colors ${
            isStrikeActive
              ? 'bg-blue-600 text-white shadow-2xs'
              : isStrikeMixed
              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 ring-1 ring-amber-400'
              : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-750'
          }`}
          title={`删除线${isStrikeMixed ? ' - 选区包含部分删除线' : ''}`}
        >
          <StrikethroughIcon className="w-3.5 h-3.5" />
        </button>

        {/* Superscript */}
        <button
          type="button"
          onClick={() => {
            if (isSuperActive) {
              (editor.chain().focus() as any).unsetSuperscript?.()?.run() || (editor.chain().focus() as any).toggleSuperscript?.()?.run();
            } else {
              (editor.chain().focus() as any).setSuperscript?.()?.run() || (editor.chain().focus() as any).toggleSuperscript?.()?.run();
            }
          }}
          className={`w-7 h-7 flex items-center justify-center rounded-md text-xs transition-colors ${
            isSuperActive
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-750'
          }`}
          title="上标 (X²)"
        >
          <SuperIcon className="w-3.5 h-3.5" />
        </button>

        {/* Subscript */}
        <button
          type="button"
          onClick={() => {
            if (isSubActive) {
              (editor.chain().focus() as any).unsetSubscript?.()?.run() || (editor.chain().focus() as any).toggleSubscript?.()?.run();
            } else {
              (editor.chain().focus() as any).setSubscript?.()?.run() || (editor.chain().focus() as any).toggleSubscript?.()?.run();
            }
          }}
          className={`w-7 h-7 flex items-center justify-center rounded-md text-xs transition-colors ${
            isSubActive
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-750'
          }`}
          title="下标 (X₂)"
        >
          <SubIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

      {/* 4. 颜色与高亮 */}
      <TextColorPicker
        currentColor={context.color}
        onSetColor={(color) => {
          if (color) {
            editor.chain().focus().setColor(color).run();
          } else {
            editor.chain().focus().unsetColor().run();
          }
        }}
      />
      <HighlightPicker
        currentBg={context.backgroundColor}
        onSetBg={(color) => {
          if (color) {
            editor.chain().focus().setHighlight({ color }).run();
          } else {
            editor.chain().focus().unsetHighlight().run();
          }
        }}
      />

      <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

      {/* 5. 对齐方式与列表 */}
      <div className="flex items-center space-x-0.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-0.5 shadow-2xs">
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={`w-7 h-7 flex items-center justify-center rounded-md text-xs transition-colors ${
            context.textAlign === 'left'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-750'
          }`}
          title="左对齐"
        >
          <AlignLeft className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={`w-7 h-7 flex items-center justify-center rounded-md text-xs transition-colors ${
            context.textAlign === 'center'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-750'
          }`}
          title="居中对齐"
        >
          <AlignCenter className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={`w-7 h-7 flex items-center justify-center rounded-md text-xs transition-colors ${
            context.textAlign === 'right'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-750'
          }`}
          title="右对齐"
        >
          <AlignRight className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          className={`w-7 h-7 flex items-center justify-center rounded-md text-xs transition-colors ${
            context.textAlign === 'justify'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-750'
          }`}
          title="两端对齐"
        >
          <AlignJustify className="w-3.5 h-3.5" />
        </button>
        <div className="h-3.5 w-px bg-neutral-200 dark:bg-neutral-700 mx-0.5" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`w-7 h-7 flex items-center justify-center rounded-md text-xs transition-colors ${
            context.listType === 'bullet'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-750'
          }`}
          title="项目符号 (无序列表)"
        >
          <List className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`w-7 h-7 flex items-center justify-center rounded-md text-xs transition-colors ${
            context.listType === 'ordered'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-750'
          }`}
          title="编号 (有序列表)"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

      {/* 6. 行距、版式缩进、底纹与边框 */}
      <LineSpacingControl editor={editor} />
      <ChineseTypographyControl editor={editor} />
      <ShadingControl editor={editor} />
      <BorderControl editor={editor} />

      <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

      {/* 7. 表格与高级操作 */}
      <TableMenuControl editor={editor} />

      <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

      {/* 8. 插入分页符 */}
      <button
        type="button"
        id="doc-insert-page-break-btn"
        onClick={() => {
          (editor.chain().focus() as any).setPageBreak?.() || editor.chain().focus().insertContent({ type: 'pageBreak' }).run();
        }}
        className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-sky-50 dark:hover:bg-sky-950/40 hover:text-sky-600 dark:hover:text-sky-400 hover:border-sky-300 transition-colors shadow-2xs text-xs font-medium"
        title="插入分页符 (Page Break - 强制换页)"
      >
        <FilePlus className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
        <span className="hidden sm:inline">插入分页符</span>
      </button>
    </div>
  );
};

