import React, { useState, useRef, useEffect } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { PDFImageCropRect } from '../../../types/pdfObject';
import { transformEngine } from '../../../core/pdf/TransformEngine';
import { ResizeHandleType } from '../transformer/TransformBox';

export interface ImageCropOverlayProps {
  dataUrl: string;
  initialCropRect?: PDFImageCropRect;
  containerWidthPx: number;
  containerHeightPx: number;
  onApplyCrop: (cropRect: PDFImageCropRect) => void;
  onCancelCrop: () => void;
  onResetCrop: () => void;
}

export const ImageCropOverlay: React.FC<ImageCropOverlayProps> = ({
  dataUrl,
  initialCropRect,
  containerWidthPx,
  containerHeightPx,
  onApplyCrop,
  onCancelCrop,
  onResetCrop,
}) => {
  const [cropRect, setCropRect] = useState<PDFImageCropRect>(
    transformEngine.normalizeCropRect(initialCropRect)
  );

  const [activeHandle, setActiveHandle] = useState<ResizeHandleType | null>(null);
  const [isPanningCrop, setIsPanningCrop] = useState(false);

  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    startCrop: PDFImageCropRect;
  }>({
    clientX: 0,
    clientY: 0,
    startCrop: cropRect,
  });

  const overlayRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut listener (Enter to apply, Esc to cancel)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        onApplyCrop(cropRect);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancelCrop();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cropRect, onApplyCrop, onCancelCrop]);

  // Handle pointer down on handles
  const handleMouseDownHandle = (e: React.MouseEvent, handle: ResizeHandleType) => {
    e.stopPropagation();
    e.preventDefault();
    setActiveHandle(handle);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startCrop: { ...cropRect },
    };
  };

  // Handle pointer down to pan the crop window
  const handleMouseDownPan = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsPanningCrop(true);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startCrop: { ...cropRect },
    };
  };

  // Global mouse move & up
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!activeHandle && !isPanningCrop) return;
      if (containerWidthPx <= 0 || containerHeightPx <= 0) return;

      const deltaXScreen = e.clientX - dragStartRef.current.clientX;
      const deltaYScreen = e.clientY - dragStartRef.current.clientY;

      // Convert delta to percentage of image dimensions
      const deltaPctX = (deltaXScreen / containerWidthPx) * 100;
      const deltaPctY = (deltaYScreen / containerHeightPx) * 100;

      if (activeHandle) {
        const nextCrop = transformEngine.applyCrop({
          handle: activeHandle,
          startCropRect: dragStartRef.current.startCrop,
          deltaPctX,
          deltaPctY,
          minCropPct: 5,
        });
        setCropRect(nextCrop);
      } else if (isPanningCrop) {
        const start = dragStartRef.current.startCrop;
        const maxX = 100 - start.width;
        const maxY = 100 - start.height;
        const newX = Math.max(0, Math.min(maxX, start.x + deltaPctX));
        const newY = Math.max(0, Math.min(maxY, start.y + deltaPctY));

        setCropRect({
          x: Math.round(newX * 10) / 10,
          y: Math.round(newY * 10) / 10,
          width: start.width,
          height: start.height,
        });
      }
    };

    const handleMouseUp = () => {
      setActiveHandle(null);
      setIsPanningCrop(false);
    };

    if (activeHandle || isPanningCrop) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeHandle, isPanningCrop, containerWidthPx, containerHeightPx]);

  // Crop Box coordinates in percentage
  const leftPct = cropRect.x;
  const topPct = cropRect.y;
  const widthPct = cropRect.width;
  const heightPct = cropRect.height;

  return (
    <div
      ref={overlayRef}
      data-crop-overlay="true"
      className="absolute inset-0 z-50 select-none overflow-visible"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Dimmed Background of Uncropped Area */}
      <div className="absolute inset-0 bg-black/60 pointer-events-none rounded-xs" />

      {/* 2. Clear / Visible Crop Window */}
      <div
        className="absolute overflow-hidden shadow-2xl ring-1 ring-white/90 cursor-move"
        style={{
          left: `${leftPct}%`,
          top: `${topPct}%`,
          width: `${widthPct}%`,
          height: `${heightPct}%`,
        }}
        onMouseDown={handleMouseDownPan}
      >
        {/* Full-brightness image projected under crop window */}
        <img
          src={dataUrl}
          alt="Crop Preview"
          className="absolute block pointer-events-none select-none max-w-none max-h-none"
          draggable={false}
          style={{
            left: `${-(leftPct / widthPct) * 100}%`,
            top: `${-(topPct / heightPct) * 100}%`,
            width: `${(100 / widthPct) * 100}%`,
            height: `${(100 / heightPct) * 100}%`,
          }}
        />

        {/* 3x3 Rule of Thirds Grid Guidelines */}
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
          <div className="border-r border-b border-white/30" />
          <div className="border-r border-b border-white/30" />
          <div className="border-b border-white/30" />
          <div className="border-r border-b border-white/30" />
          <div className="border-r border-b border-white/30" />
          <div className="border-b border-white/30" />
          <div className="border-r border-white/30" />
          <div className="border-r border-white/30" />
          <div />
        </div>
      </div>

      {/* 3. Professional Heavy L-Shaped Crop Handles (WPS / Apple Standard) */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: `${leftPct}%`,
          top: `${topPct}%`,
          width: `${widthPct}%`,
          height: `${heightPct}%`,
        }}
      >
        {/* Top-Left Corner Bracket */}
        <div
          onMouseDown={(e) => handleMouseDownHandle(e, 'nw')}
          className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-3 border-l-3 border-white pointer-events-auto cursor-nwse-resize drop-shadow-md"
        />
        {/* Top-Right Corner Bracket */}
        <div
          onMouseDown={(e) => handleMouseDownHandle(e, 'ne')}
          className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-3 border-r-3 border-white pointer-events-auto cursor-nesw-resize drop-shadow-md"
        />
        {/* Bottom-Left Corner Bracket */}
        <div
          onMouseDown={(e) => handleMouseDownHandle(e, 'sw')}
          className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-3 border-l-3 border-white pointer-events-auto cursor-nesw-resize drop-shadow-md"
        />
        {/* Bottom-Right Corner Bracket */}
        <div
          onMouseDown={(e) => handleMouseDownHandle(e, 'se')}
          className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-3 border-r-3 border-white pointer-events-auto cursor-nwse-resize drop-shadow-md"
        />

        {/* Edge Midpoint Ticks */}
        {/* Top */}
        <div
          onMouseDown={(e) => handleMouseDownHandle(e, 'n')}
          className="absolute -top-1 left-1/2 -translate-x-1/2 w-5 h-2 bg-white rounded-xs pointer-events-auto cursor-ns-resize drop-shadow-md"
        />
        {/* Bottom */}
        <div
          onMouseDown={(e) => handleMouseDownHandle(e, 's')}
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-2 bg-white rounded-xs pointer-events-auto cursor-ns-resize drop-shadow-md"
        />
        {/* Left */}
        <div
          onMouseDown={(e) => handleMouseDownHandle(e, 'w')}
          className="absolute top-1/2 -translate-y-1/2 -left-1 w-2 h-5 bg-white rounded-xs pointer-events-auto cursor-ew-resize drop-shadow-md"
        />
        {/* Right */}
        <div
          onMouseDown={(e) => handleMouseDownHandle(e, 'e')}
          className="absolute top-1/2 -translate-y-1/2 -right-1 w-2 h-5 bg-white rounded-xs pointer-events-auto cursor-ew-resize drop-shadow-md"
        />
      </div>

      {/* 4. Apple HIG Floating Crop Controller HUD */}
      <div
        className="absolute -top-12 left-1/2 -translate-x-1/2 bg-neutral-900/90 dark:bg-neutral-950/90 text-white backdrop-blur-md rounded-full px-2.5 py-1 shadow-2xl flex items-center space-x-1.5 z-60 border border-white/20 animate-in fade-in zoom-in-95 duration-150 select-none whitespace-nowrap text-xs"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-[11px] font-medium text-neutral-300 px-1">裁剪模式</span>

        <button
          onClick={() => onApplyCrop(cropRect)}
          className="px-2.5 py-1 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center space-x-1 font-medium transition-colors cursor-pointer shadow-xs"
          title="完成裁剪 (Enter)"
        >
          <Check className="w-3.5 h-3.5" />
          <span>完成</span>
        </button>

        <button
          onClick={onResetCrop}
          className="p-1 rounded-full hover:bg-white/15 text-neutral-300 hover:text-white transition-colors cursor-pointer"
          title="重置为完整原始图像"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onCancelCrop}
          className="p-1 rounded-full hover:bg-white/15 text-neutral-300 hover:text-white transition-colors cursor-pointer"
          title="取消裁剪 (Esc)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
