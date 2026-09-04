import React, { useState } from 'react';
import {
  Type,
  Image as ImageIcon,
  Square,
  Circle,
  Move,
  RotateCw,
  Palette,
  Layers,
  Lock,
  Unlock,
  Trash2,
  Copy,
  Sliders,
  Sparkles,
  ShieldCheck,
  Ruler,
  Check,
  Eye,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  ChevronDown,
  FileCode,
  Droplet,
  Crop,
  RotateCcw,
  Upload,
  ChevronsUp,
  ChevronsDown,
  ArrowUp,
  ArrowDown,
  Maximize2,
  RefreshCw,
} from 'lucide-react';
import type {
  PdfAnnotation,
  PdfToolMode,
  PageMeta,
  WatermarkConfig,
  SecurityConfig,
} from '../../types';
import { PdfFormattingContextResolver } from '../../core/formatting/PdfFormattingContextResolver';

// WPS Style Standard & Theme Color Palette
const THEME_COLORS = [
  ['#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff'],
  ['#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff'],
  ['#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc'],
  ['#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd'],
  ['#cc4125', '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6d9eeb', '#6fa8dc', '#8e7cc3', '#c27ba0'],
  ['#a61c00', '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3c78d8', '#3d85c6', '#674ea7', '#a64d79'],
  ['#5b0f00', '#660000', '#783f04', '#7f6000', '#274e13', '#0c343d', '#1155cc', '#0b5394', '#351c75', '#4c1130'],
];

const STANDARD_COLORS = ['#c00000', '#ff0000', '#ffc000', '#ffff00', '#92d050', '#00b050', '#00b0f0', '#0070c0', '#002060', '#7030a0'];

interface PdfRightInspectorProps {
  selectedAnnotation: PdfAnnotation | null;
  onUpdateAnnotation: (id: string, updates: Partial<PdfAnnotation>) => void;
  onDeleteAnnotation: (id: string) => void;
  onBringForward?: (id: string) => void;
  onSendBackward?: (id: string) => void;
  onBringToFront?: (id: string) => void;
  onSendToBack?: (id: string) => void;
  currentPageMeta?: PageMeta;
  onRotatePage?: (deg: number) => void;
  onAutoTrimPage?: () => void;
  toolMode: PdfToolMode;
  watermarkConfig: WatermarkConfig;
  onChangeWatermarkConfig: (cfg: Partial<WatermarkConfig>) => void;
  onApplyWatermark: () => void;
  securityConfig: SecurityConfig;
  onChangeSecurityConfig: (cfg: Partial<SecurityConfig>) => void;
  measureScale: number;
  onChangeMeasureScale: (scale: number) => void;
}

export const PdfRightInspector: React.FC<PdfRightInspectorProps> = ({
  selectedAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onBringForward,
  onSendBackward,
  onBringToFront,
  onSendToBack,
  currentPageMeta,
  onRotatePage,
  onAutoTrimPage,
  toolMode,
  watermarkConfig,
  onChangeWatermarkConfig,
  onApplyWatermark,
  securityConfig,
  onChangeSecurityConfig,
  measureScale,
  onChangeMeasureScale,
}) => {
  const [activeColorTarget, setActiveColorTarget] = useState<'text' | 'bg' | 'stroke' | 'fill'>('text');
  const [customHexInput, setCustomHexInput] = useState('');

  // 1. Text Annotation Inspector
  const renderTextInspector = (annot: any) => {
    const context = PdfFormattingContextResolver.resolve(annot);
    const isBoldActive = context.bold === true;
    const isItalicActive = context.italic === true;
    const isUnderlineActive = context.underline === true;
    const isStrikeActive = context.strike === true;
    const fontVal = typeof context.fontFamily === 'string' ? context.fontFamily : 'Helvetica';
    const sizeVal = typeof context.fontSize === 'number' ? context.fontSize : 14;
    const colorVal = typeof context.color === 'string' ? context.color : '#000000';
    const alignVal = typeof context.textAlign === 'string' ? context.textAlign : 'left';

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-black/[0.06] dark:border-white/[0.08]">
          <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">文本属性 (Context-Aware)</span>
          <button
            onClick={() => onDeleteAnnotation(annot.id)}
            className="p-1 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
            title="删除文本对象"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Font Family & Size */}
        <div className="space-y-2">
          <label className="text-[11px] text-neutral-600 dark:text-neutral-400 font-medium">字体与字号</label>
          <div className="grid grid-cols-3 gap-2">
            <select
              value={fontVal}
              onChange={(e) => onUpdateAnnotation(annot.id, { fontFamily: e.target.value })}
              className="col-span-2 px-2 py-1.5 rounded-lg text-xs bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] text-neutral-900 dark:text-neutral-100 focus:outline-none"
            >
              <option value="Helvetica">Helvetica (标准黑体)</option>
              <option value="Times-Roman">Times New Roman (宋体/衬线)</option>
              <option value="Courier">Courier (等宽代码体)</option>
              <option value="Arial">Arial (无衬线)</option>
              <option value="Microsoft YaHei">微软雅黑</option>
              <option value="SimSun">中易宋体</option>
            </select>

            <select
              value={sizeVal}
              onChange={(e) => onUpdateAnnotation(annot.id, { fontSize: Number(e.target.value) })}
              className="px-2 py-1.5 rounded-lg text-xs bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] text-neutral-900 dark:text-neutral-100 focus:outline-none font-mono"
            >
              {[9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72].map((sz) => (
                <option key={sz} value={sz}>{sz} pt</option>
              ))}
            </select>
          </div>
        </div>

        {/* Text Style formatting */}
        <div className="flex items-center space-x-1 bg-black/[0.03] dark:bg-white/[0.06] p-1 rounded-lg border border-black/[0.06] dark:border-white/[0.08]">
          <button
            onClick={() => onUpdateAnnotation(annot.id, { isBold: !isBoldActive })}
            className={`flex-1 py-1 rounded flex items-center justify-center transition-all ${
              isBoldActive ? 'bg-white dark:bg-[#2c2c2e] text-blue-600 shadow-xs font-bold' : 'text-neutral-600 dark:text-neutral-400'
            }`}
            title="粗体"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onUpdateAnnotation(annot.id, { isItalic: !isItalicActive })}
            className={`flex-1 py-1 rounded flex items-center justify-center transition-all ${
              isItalicActive ? 'bg-white dark:bg-[#2c2c2e] text-blue-600 shadow-xs' : 'text-neutral-600 dark:text-neutral-400'
            }`}
            title="斜体"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onUpdateAnnotation(annot.id, { isUnderline: !isUnderlineActive })}
            className={`flex-1 py-1 rounded flex items-center justify-center transition-all ${
              isUnderlineActive ? 'bg-white dark:bg-[#2c2c2e] text-blue-600 shadow-xs' : 'text-neutral-600 dark:text-neutral-400'
            }`}
            title="下划线"
          >
            <Underline className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onUpdateAnnotation(annot.id, { isStrikethrough: !isStrikeActive })}
            className={`flex-1 py-1 rounded flex items-center justify-center transition-all ${
              isStrikeActive ? 'bg-white dark:bg-[#2c2c2e] text-blue-600 shadow-xs' : 'text-neutral-600 dark:text-neutral-400'
            }`}
            title="删除线"
          >
            <Strikethrough className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Alignment */}
        <div className="flex items-center space-x-1 bg-black/[0.03] dark:bg-white/[0.06] p-1 rounded-lg border border-black/[0.06] dark:border-white/[0.08]">
          {(['left', 'center', 'right'] as const).map((align) => (
            <button
              key={align}
              onClick={() => onUpdateAnnotation(annot.id, { textAlign: align })}
              className={`flex-1 py-1 rounded flex items-center justify-center transition-all ${
                alignVal === align
                  ? 'bg-white dark:bg-[#2c2c2e] text-blue-600 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400'
              }`}
            >
              {align === 'left' && <AlignLeft className="w-3.5 h-3.5" />}
              {align === 'center' && <AlignCenter className="w-3.5 h-3.5" />}
              {align === 'right' && <AlignRight className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>

        {/* Colors (WPS Palette) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
            <span>文字颜色</span>
            <div className="flex items-center space-x-1.5">
              <span className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ backgroundColor: colorVal }} />
              <span className="font-mono text-[10px] uppercase">{colorVal}</span>
            </div>
          </div>
          <div className="space-y-1">
            {THEME_COLORS.slice(0, 4).map((row, rIdx) => (
              <div key={rIdx} className="flex items-center justify-between gap-1">
                {row.map((c) => (
                  <button
                    key={c}
                    onClick={() => onUpdateAnnotation(annot.id, { color: c })}
                    className="w-4 h-4 rounded-sm border border-black/10 hover:scale-125 transition-transform"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Background color */}
        <div className="space-y-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.08]">
          <div className="flex items-center justify-between text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
            <span>底色遮罩</span>
            <button
              onClick={() => onUpdateAnnotation(annot.id, { backgroundColor: annot.backgroundColor ? undefined : '#ffffff' })}
              className="text-[10px] text-blue-600 hover:underline"
            >
              {annot.backgroundColor ? '清除底色' : '添加底色'}
            </button>
          </div>
          {annot.backgroundColor && (
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={annot.backgroundColor || '#ffffff'}
                onChange={(e) => onUpdateAnnotation(annot.id, { backgroundColor: e.target.value })}
                className="w-6 h-6 rounded border cursor-pointer"
              />
              <span className="text-xs font-mono text-neutral-600 dark:text-neutral-400">{annot.backgroundColor}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // 2. Shape Annotation Inspector
  const renderShapeInspector = (annot: any) => {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-black/[0.06] dark:border-white/[0.08]">
          <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">几何图形属性</span>
          <button
            onClick={() => onDeleteAnnotation(annot.id)}
            className="p-1 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Stroke width */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-neutral-600 dark:text-neutral-400 font-medium">
            <span>线条粗细</span>
            <span className="font-mono">{annot.strokeWidth || 2} px</span>
          </div>
          <input
            type="range"
            min={1}
            max={20}
            value={annot.strokeWidth || 2}
            onChange={(e) => onUpdateAnnotation(annot.id, { strokeWidth: Number(e.target.value) })}
            className="w-full h-1 bg-black/[0.08] dark:bg-white/[0.1] rounded-lg accent-blue-600 cursor-pointer"
          />
        </div>

        {/* Stroke Color */}
        <div className="space-y-2">
          <span className="text-[11px] text-neutral-600 dark:text-neutral-400 font-medium">边框颜色</span>
          <div className="grid grid-cols-5 gap-1.5">
            {STANDARD_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => onUpdateAnnotation(annot.id, { strokeColor: c })}
                className={`h-5 rounded border ${annot.strokeColor === c ? 'ring-2 ring-blue-500' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Fill Color */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-neutral-600 dark:text-neutral-400 font-medium">
            <span>填充颜色</span>
            <button
              onClick={() => onUpdateAnnotation(annot.id, { fillColor: annot.fillColor ? undefined : '#f0f9ff' })}
              className="text-[10px] text-blue-600 hover:underline"
            >
              {annot.fillColor ? '无填充' : '开启填充'}
            </button>
          </div>
          {annot.fillColor && (
            <div className="grid grid-cols-5 gap-1.5">
              {THEME_COLORS[2].map((c) => (
                <button
                  key={c}
                  onClick={() => onUpdateAnnotation(annot.id, { fillColor: c })}
                  className={`h-5 rounded border ${annot.fillColor === c ? 'ring-2 ring-blue-500' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // 3. Image Annotation Inspector
  const renderImageInspector = (annot: any) => {
    const hasCrop =
      annot.cropRect &&
      (annot.cropRect.x > 0 ||
        annot.cropRect.y > 0 ||
        annot.cropRect.width < 100 ||
        annot.cropRect.height < 100);

    const handleReplaceFile = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        onUpdateAnnotation(annot.id, {
          dataUrl: reader.result as string,
          cropRect: { x: 0, y: 0, width: 100, height: 100 },
        });
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    };

    const triggerStartCrop = () => {
      window.dispatchEvent(new CustomEvent('pdf:start-crop', { detail: { id: annot.id } }));
    };

    const handleResetCrop = () => {
      onUpdateAnnotation(annot.id, {
        cropRect: { x: 0, y: 0, width: 100, height: 100 },
      });
    };

    return (
      <div className="space-y-4">
        {/* Header with Title & Quick Actions */}
        <div className="flex items-center justify-between pb-2 border-b border-black/[0.06] dark:border-white/[0.08]">
          <div className="flex items-center space-x-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
              图像属性
            </span>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => onUpdateAnnotation(annot.id, { locked: !annot.locked })}
              title={annot.locked ? '点击解锁' : '锁定对象'}
              className={`p-1 rounded-md transition-colors ${
                annot.locked
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                  : 'text-neutral-500 hover:bg-black/[0.05] dark:hover:bg-white/[0.05]'
              }`}
            >
              {annot.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => onDeleteAnnotation(annot.id)}
              className="p-1 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
              title="删除图片"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Image Thumbnail & Replace Resource */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-neutral-600 dark:text-neutral-400 font-medium">图像资源</span>
            {hasCrop && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-medium">
                已裁剪
              </span>
            )}
          </div>
          <div className="flex items-center space-x-3 p-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.04]">
            <div className="w-14 h-14 rounded-lg bg-black/[0.05] dark:bg-white/[0.08] overflow-hidden flex items-center justify-center shrink-0 border border-black/[0.06] dark:border-white/[0.06]">
              {annot.dataUrl ? (
                <img
                  src={annot.dataUrl}
                  alt="Thumbnail"
                  className="w-full h-full object-contain"
                />
              ) : (
                <ImageIcon className="w-6 h-6 text-neutral-400" />
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <label className="block">
                <span className="sr-only">替换图片</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleReplaceFile}
                  className="hidden"
                />
                <span className="inline-flex items-center justify-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition-colors shadow-xs w-full text-center">
                  <Upload className="w-3 h-3" />
                  <span>替换图片...</span>
                </span>
              </label>
              <div className="text-[10px] text-neutral-400 font-mono truncate">
                保持坐标、大小与旋转
              </div>
            </div>
          </div>
        </div>

        {/* Non-Destructive Crop Controls */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-neutral-600 dark:text-neutral-400 font-medium">
            <span>图像裁剪 (非破坏性)</span>
            {hasCrop && (
              <button
                onClick={handleResetCrop}
                className="text-[10px] text-blue-600 hover:underline flex items-center space-x-0.5 cursor-pointer"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>复原全图</span>
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={triggerStartCrop}
              disabled={annot.locked}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] text-neutral-800 dark:text-neutral-200 flex items-center justify-center space-x-1.5 transition-colors disabled:opacity-40"
            >
              <Crop className="w-3.5 h-3.5 text-blue-600" />
              <span>进入裁剪模式</span>
            </button>
            <button
              onClick={handleResetCrop}
              disabled={annot.locked || !hasCrop}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] text-neutral-800 dark:text-neutral-200 flex items-center justify-center space-x-1.5 transition-colors disabled:opacity-40"
            >
              <RefreshCw className="w-3.5 h-3.5 text-neutral-500" />
              <span>重置裁剪</span>
            </button>
          </div>
        </div>

        {/* Aspect Ratio Lock */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-neutral-600 dark:text-neutral-400 font-medium">锁定等比缩放</span>
          <button
            onClick={() =>
              onUpdateAnnotation(annot.id, {
                aspectRatioLocked: annot.aspectRatioLocked === false ? true : false,
              })
            }
            className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
              annot.aspectRatioLocked !== false
                ? 'bg-blue-600 text-white'
                : 'bg-black/[0.05] dark:bg-white/[0.08] text-neutral-600 dark:text-neutral-400'
            }`}
          >
            {annot.aspectRatioLocked !== false ? '已锁定' : '自由比例'}
          </button>
        </div>

        {/* Transparency / Opacity */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-neutral-600 dark:text-neutral-400 font-medium">
            <span>不透明度</span>
            <span className="font-mono text-neutral-900 dark:text-neutral-100 font-semibold">
              {Math.round((annot.opacity ?? 1) * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={10}
            max={100}
            value={Math.round((annot.opacity ?? 1) * 100)}
            onChange={(e) =>
              onUpdateAnnotation(annot.id, { opacity: Number(e.target.value) / 100 })
            }
            className="w-full h-1.5 bg-black/[0.08] dark:bg-white/[0.1] rounded-lg accent-blue-600 cursor-pointer"
          />
        </div>

        {/* Rotate Controls */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-neutral-600 dark:text-neutral-400 font-medium">
            <span>旋转与方向</span>
            <span className="font-mono">{annot.rotation || 0}°</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={() =>
                onUpdateAnnotation(annot.id, { rotation: ((annot.rotation || 0) + 90) % 360 })
              }
              className="px-2 py-1.5 rounded-lg text-xs font-medium bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] text-neutral-800 dark:text-neutral-200 flex items-center justify-center space-x-1"
              title="顺时针 90°"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>+90°</span>
            </button>
            <button
              onClick={() =>
                onUpdateAnnotation(annot.id, {
                  rotation: (((annot.rotation || 0) - 90) % 360 + 360) % 360,
                })
              }
              className="px-2 py-1.5 rounded-lg text-xs font-medium bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] text-neutral-800 dark:text-neutral-200 flex items-center justify-center space-x-1"
              title="逆时针 90°"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>-90°</span>
            </button>
            <button
              onClick={() => onUpdateAnnotation(annot.id, { rotation: 0 })}
              className="px-2 py-1.5 rounded-lg text-xs font-medium bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] text-neutral-800 dark:text-neutral-200 flex items-center justify-center space-x-1"
              title="复位角度"
            >
              <span>0° 复位</span>
            </button>
          </div>
        </div>

        {/* Layer Arrangement */}
        <div className="space-y-1.5">
          <span className="text-[11px] text-neutral-600 dark:text-neutral-400 font-medium">
            图层层级
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => onBringToFront ? onBringToFront(annot.id) : onBringForward?.(annot.id)}
              className="px-2 py-1.5 rounded-lg text-xs font-medium bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] text-neutral-800 dark:text-neutral-200 flex items-center justify-center space-x-1"
            >
              <ChevronsUp className="w-3.5 h-3.5" />
              <span>置于顶层</span>
            </button>
            <button
              onClick={() => onBringForward && onBringForward(annot.id)}
              className="px-2 py-1.5 rounded-lg text-xs font-medium bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] text-neutral-800 dark:text-neutral-200 flex items-center justify-center space-x-1"
            >
              <ArrowUp className="w-3.5 h-3.5" />
              <span>上移一层</span>
            </button>
            <button
              onClick={() => onSendBackward && onSendBackward(annot.id)}
              className="px-2 py-1.5 rounded-lg text-xs font-medium bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] text-neutral-800 dark:text-neutral-200 flex items-center justify-center space-x-1"
            >
              <ArrowDown className="w-3.5 h-3.5" />
              <span>下移一层</span>
            </button>
            <button
              onClick={() => onSendToBack ? onSendToBack(annot.id) : onSendBackward?.(annot.id)}
              className="px-2 py-1.5 rounded-lg text-xs font-medium bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] text-neutral-800 dark:text-neutral-200 flex items-center justify-center space-x-1"
            >
              <ChevronsDown className="w-3.5 h-3.5" />
              <span>置于底层</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 4. Default / Tab Specific Inspector
  const renderTabContextInspector = () => {
    if (toolMode === 'measure-distance' || toolMode === 'measure-area') {
      return (
        <div className="space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b border-black/[0.06] dark:border-white/[0.08]">
            <Ruler className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">工程图纸测量</span>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] text-neutral-600 dark:text-neutral-400 font-medium">图纸比例尺设定</label>
            <div className="grid grid-cols-3 gap-1.5">
              {[1, 20, 50, 100, 200, 500].map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => onChangeMeasureScale(ratio)}
                  className={`py-1 rounded-lg text-xs font-mono font-medium transition-all ${
                    measureScale === ratio
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-black/[0.03] dark:bg-white/[0.06] text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  1:{ratio}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-neutral-500 leading-relaxed">
            在页面上点击两点以测量距离，或点击多点闭合测量多边形/建筑面积。
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="pb-2 border-b border-black/[0.06] dark:border-white/[0.08]">
          <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">当前页面属性</span>
        </div>

        {currentPageMeta && (
          <div className="space-y-3">
            <div className="bg-black/[0.03] dark:bg-white/[0.05] p-3 rounded-xl space-y-1.5 text-xs">
              <div className="flex justify-between text-neutral-500">
                <span>页面编号</span>
                <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                  第 {currentPageMeta.pageIndex + 1} 页
                </span>
              </div>
              <div className="flex justify-between text-neutral-500">
                <span>页面尺寸</span>
                <span className="font-mono text-neutral-800 dark:text-neutral-200">
                  {Math.round(currentPageMeta.width)} × {Math.round(currentPageMeta.height)} pt
                </span>
              </div>
              <div className="flex justify-between text-neutral-500">
                <span>当前旋转</span>
                <span className="font-semibold text-blue-600">{currentPageMeta.rotation}°</span>
              </div>
            </div>

            {/* Quick Page Rotations */}
            <div className="space-y-1.5">
              <span className="text-[11px] text-neutral-600 dark:text-neutral-400 font-medium">真实页面矩阵旋转</span>
              <div className="grid grid-cols-3 gap-1.5">
                {[90, 180, 270].map((deg) => (
                  <button
                    key={deg}
                    onClick={() => onRotatePage?.(deg)}
                    className="py-1.5 rounded-lg text-xs font-medium bg-black/[0.04] hover:bg-black/[0.08] dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-neutral-800 dark:text-neutral-200 transition-colors"
                  >
                    +{deg}°
                  </button>
                ))}
              </div>
            </div>

            {/* Auto Trim White Margin */}
            <div className="pt-2">
              <button
                onClick={onAutoTrimPage}
                className="w-full py-2 rounded-xl text-xs font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-colors flex items-center justify-center space-x-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>自动智能去白边</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      data-no-canvas-click="true"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="w-64 h-full bg-[#fbfbfd]/95 dark:bg-[#1c1c1e]/95 backdrop-blur-xl border-l border-black/[0.06] dark:border-white/[0.08] p-4 flex flex-col overflow-y-auto shrink-0 select-none"
    >
      {selectedAnnotation ? (
        selectedAnnotation.type === 'text' ? (
          renderTextInspector(selectedAnnotation)
        ) : selectedAnnotation.type === 'shape' ? (
          renderShapeInspector(selectedAnnotation)
        ) : selectedAnnotation.type === 'image' ? (
          renderImageInspector(selectedAnnotation)
        ) : (
          renderTabContextInspector()
        )
      ) : (
        renderTabContextInspector()
      )}
    </aside>
  );
};
