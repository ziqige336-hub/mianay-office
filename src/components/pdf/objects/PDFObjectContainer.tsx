import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Trash2,
  Copy,
  RotateCw,
  Lock,
  Unlock,
  ArrowUp,
  ArrowDown,
  Edit3,
  Crop,
  Image as ImageIcon,
} from 'lucide-react';
import { PDFUnifiedObject, normalizePDFObject, PDFImageCropRect } from '../../../types/pdfObject';
import {
  getDisplayPageDimensions,
  Rect,
} from '../../../core/pdf/CoordinateTransform';
import { selectionManager, transformEngine } from '../../../core/pdf';
import {
  historyManager as defaultGlobalHistory,
  documentHistoryManager,
  HistoryManager,
  MoveObjectCommand,
  ResizeObjectCommand,
  RotateObjectCommand,
  CropImageCommand,
  UpdatePropertyCommand,
} from '../../../core/history';
import { TransformBox, ResizeHandleType } from '../transformer/TransformBox';
import { ObjectViewDispatcher } from './views';
import { ImageCropOverlay } from './ImageCropOverlay';

export interface PDFObjectContainerProps {
  object: any;
  isSelected: boolean;
  zoom: number;
  historyManager?: HistoryManager;
  documentId?: string;
  pageMeta: {
    width: number;
    height: number;
    scale?: number;
    rotation?: number;
    displayWidth?: number;
    displayHeight?: number;
  };
  onSelect: (e?: React.MouseEvent) => void;
  onUpdate: (id: string, updates: Partial<PDFUnifiedObject>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (object: PDFUnifiedObject) => void;
  onBringForward?: (id: string) => void;
  onSendBackward?: (id: string) => void;
  onStartTextEdit?: (id: string) => void;
  children?: React.ReactNode;
}

export const PDFObjectContainer: React.FC<PDFObjectContainerProps> = React.memo(({
  object: rawObject,
  isSelected,
  zoom,
  historyManager: customHistoryManager,
  documentId,
  pageMeta,
  onSelect,
  onUpdate,
  onDelete,
  onDuplicate,
  onBringForward,
  onSendBackward,
  onStartTextEdit,
  children,
}) => {
  const object = normalizePDFObject(rawObject);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resolve isolated Document History Manager
  const history = useMemo(() => {
    if (customHistoryManager) return customHistoryManager;
    if (documentId) {
      const docHistory = documentHistoryManager.getHistory(documentId);
      if (docHistory) return docHistory;
    }
    return documentHistoryManager.getActiveHistory() || defaultGlobalHistory;
  }, [customHistoryManager, documentId]);

  // Interaction States
  const [isDragging, setIsDragging] = useState(false);
  const [activeResizeHandle, setActiveResizeHandle] = useState<ResizeHandleType | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const [currentAngle, setCurrentAngle] = useState<number>(object.rotation || 0);

  // Non-destructive Crop Mode State for Images
  const [isCropping, setIsCropping] = useState(false);

  // Reset cropping if deselected
  useEffect(() => {
    if (!isSelected && isCropping) {
      setIsCropping(false);
    }
  }, [isSelected, isCropping]);

  // Listen to custom event to enter crop mode from inspector/external controls
  useEffect(() => {
    const handleStartCropEvent = (e: any) => {
      if (e.detail?.id === object.id && object.type === 'image' && !object.locked) {
        setIsCropping(true);
      }
    };
    window.addEventListener('pdf:start-crop', handleStartCropEvent);
    return () => window.removeEventListener('pdf:start-crop', handleStartCropEvent);
  }, [object.id, object.type, object.locked]);

  // Keep local angle synchronized with object rotation
  useEffect(() => {
    setCurrentAngle(object.rotation || 0);
  }, [object.rotation]);

  // Dragging start coordinates (in percentages)
  const dragStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    startX: number;
    startY: number;
  }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
  });

  // Resize start coordinates
  const resizeStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    startRect: Rect;
  }>({
    mouseX: 0,
    mouseY: 0,
    startRect: { x: 0, y: 0, width: 0, height: 0 },
  });

  // Rotate start coordinates
  const rotateStartRef = useRef<{
    centerX: number;
    centerY: number;
    initialAngleOffset: number;
    initialRotation: number;
  }>({
    centerX: 0,
    centerY: 0,
    initialAngleOffset: 0,
    initialRotation: 0,
  });

  // Compute effective display page dimensions
  const { displayWidth, displayHeight } =
    pageMeta.displayWidth && pageMeta.displayHeight
      ? { displayWidth: pageMeta.displayWidth, displayHeight: pageMeta.displayHeight }
      : getDisplayPageDimensions(pageMeta.width, pageMeta.height, pageMeta.rotation || 0, zoom);

  // ==================== UNIFIED DRAG / MOVE LOGIC ====================
  const handleMouseDownOnObject = (e: React.MouseEvent) => {
    if (isCropping) return;
    if (object.locked) {
      selectionManager.select(object.id);
      onSelect(e);
      return;
    }

    // Ignore if clicked on controls/handles
    const target = e.target as HTMLElement;
    if (
      target.closest('[data-control-handle="true"]') ||
      target.closest('[data-action-hud="true"]') ||
      target.closest('[data-crop-overlay="true"]') ||
      target.closest('button')
    ) {
      return;
    }

    e.stopPropagation();
    selectionManager.select(object.id);
    onSelect(e);

    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: object.x,
      startY: object.y,
    };
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (object.type === 'image' && !object.locked) {
      e.stopPropagation();
      setIsCropping(true);
    } else if (object.type === 'text' && onStartTextEdit) {
      e.stopPropagation();
      onStartTextEdit(object.id);
    }
  };

  // ==================== UNIFIED RESIZE LOGIC ====================
  const handleMouseDownResizeHandle = (e: React.MouseEvent, handle: ResizeHandleType) => {
    if (object.locked || isCropping) return;
    e.stopPropagation();
    e.preventDefault();

    setActiveResizeHandle(handle);
    resizeStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startRect: {
        x: object.x,
        y: object.y,
        width: object.width,
        height: object.height,
      },
    };
  };

  // ==================== UNIFIED ROTATION LOGIC ====================
  const handleMouseDownRotateHandle = (e: React.MouseEvent) => {
    if (object.locked || isCropping) return;
    e.stopPropagation();
    e.preventDefault();

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const currentRadian = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    const currentDeg = (currentRadian * 180) / Math.PI;
    const initialAngleOffset = currentDeg - (object.rotation || 0);

    setIsRotating(true);
    rotateStartRef.current = {
      centerX,
      centerY,
      initialAngleOffset,
      initialRotation: object.rotation || 0,
    };
  };

  // ==================== GLOBAL MOUSE MOVE / UP HANDLERS ====================
  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      // 1. Handling Drag / Move via TransformEngine
      if (isDragging) {
        if (displayWidth <= 0 || displayHeight <= 0) return;

        const newPos = transformEngine.applyMove({
          startX: dragStartRef.current.startX,
          startY: dragStartRef.current.startY,
          deltaScreenX: e.clientX - dragStartRef.current.mouseX,
          deltaScreenY: e.clientY - dragStartRef.current.mouseY,
          displayWidth,
          displayHeight,
        });

        onUpdate(object.id, newPos);
      }

      // 2. Handling Resize via TransformEngine
      if (activeResizeHandle) {
        if (displayWidth <= 0 || displayHeight <= 0) return;

        const updatedRect = transformEngine.applyResize({
          handle: activeResizeHandle,
          startRect: resizeStartRef.current.startRect,
          deltaScreenX: e.clientX - resizeStartRef.current.mouseX,
          deltaScreenY: e.clientY - resizeStartRef.current.mouseY,
          displayWidth,
          displayHeight,
          lockAspectRatio:
            object.type === 'stamp' ||
            (object.type === 'image' && (object as any).aspectRatioLocked !== false),
        });

        onUpdate(object.id, updatedRect);
      }

      // 3. Handling Rotation via TransformEngine
      if (isRotating) {
        const { centerX, centerY, initialAngleOffset } = rotateStartRef.current;
        const newAngle = transformEngine.applyRotation({
          centerX,
          centerY,
          mouseX: e.clientX,
          mouseY: e.clientY,
          initialOffset: initialAngleOffset,
          shiftKey: e.shiftKey,
        });

        setCurrentAngle(newAngle);
        onUpdate(object.id, { rotation: newAngle });
      }
    };

    const handleWindowMouseUp = () => {
      // Commit final transform state to HistoryManager
      if (isDragging) {
        setIsDragging(false);
        const prev = {
          x: dragStartRef.current.startX,
          y: dragStartRef.current.startY,
        };
        const next = {
          x: object.x,
          y: object.y,
        };
        if (prev.x !== next.x || prev.y !== next.y) {
          history.execute(
            new MoveObjectCommand(object.id, prev, next, onUpdate, '移动对象')
          );
        }
      }

      if (activeResizeHandle) {
        setActiveResizeHandle(null);
        const prev = {
          x: resizeStartRef.current.startRect.x,
          y: resizeStartRef.current.startRect.y,
          width: resizeStartRef.current.startRect.width,
          height: resizeStartRef.current.startRect.height,
        };
        const next = {
          x: object.x,
          y: object.y,
          width: object.width,
          height: object.height,
        };
        if (
          prev.width !== next.width ||
          prev.height !== next.height ||
          prev.x !== next.x ||
          prev.y !== next.y
        ) {
          history.execute(
            new ResizeObjectCommand(object.id, prev, next, onUpdate, '缩放对象')
          );
        }
      }

      if (isRotating) {
        setIsRotating(false);
        const prevRotation = rotateStartRef.current.initialRotation;
        const nextRotation = currentAngle;
        if (prevRotation !== nextRotation) {
          history.execute(
            new RotateObjectCommand(object.id, prevRotation, nextRotation, onUpdate, '旋转对象')
          );
        }
      }
    };

    if (isDragging || activeResizeHandle || isRotating) {
      window.addEventListener('mousemove', handleWindowMouseMove);
      window.addEventListener('mouseup', handleWindowMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [
    isDragging,
    activeResizeHandle,
    isRotating,
    displayWidth,
    displayHeight,
    object.id,
    object.x,
    object.y,
    object.width,
    object.height,
    object.rotation,
    object.type,
    currentAngle,
    onUpdate,
    history,
  ]);

  // Quick 90° rotation step with command recording
  const handleQuickRotateStep = (e: React.MouseEvent) => {
    e.stopPropagation();
    const prevRotation = object.rotation || 0;
    const nextAngle = (prevRotation + 90) % 360;
    setCurrentAngle(nextAngle);

    history.execute(
      new RotateObjectCommand(object.id, prevRotation, nextAngle, onUpdate, '顺时针旋转 90°')
    );
  };

  // Toggle lock with command recording
  const handleToggleLock = (e: React.MouseEvent) => {
    e.stopPropagation();
    const prevLocked = Boolean(object.locked);
    const nextLocked = !prevLocked;

    history.execute(
      new UpdatePropertyCommand(
        object.id,
        { locked: prevLocked },
        { locked: nextLocked },
        onUpdate,
        nextLocked ? '锁定对象' : '解锁对象'
      )
    );
  };

  // Image Replacement Handler
  const handleTriggerReplaceImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const nextDataUrl = reader.result as string;
      const prevDataUrl = (object as any).dataUrl || '';
      const prevCrop = (object as any).cropRect;
      const nextCrop: PDFImageCropRect = { x: 0, y: 0, width: 100, height: 100 };

      history.execute(
        new UpdatePropertyCommand(
          object.id,
          { dataUrl: prevDataUrl, cropRect: prevCrop },
          { dataUrl: nextDataUrl, cropRect: nextCrop },
          onUpdate,
          '替换图片资源'
        )
      );
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Duplicate
  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDuplicate(object);
  };

  // Delete
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(object.id);
  };

  // Render object view: pure views only
  const renderObjectView = () => {
    if (children) return children;
    return (
      <ObjectViewDispatcher
        object={object}
        zoom={zoom}
        onStartTextEdit={onStartTextEdit}
      />
    );
  };

  return (
    <div
      ref={containerRef}
      id={`pdf-obj-${object.id}`}
      data-pdf-object-id={object.id}
      data-pdf-object-type={object.type}
      onMouseDown={handleMouseDownOnObject}
      onDoubleClick={handleDoubleClick}
      className={`absolute group pointer-events-auto transition-shadow select-none ${
        object.locked ? 'cursor-not-allowed' : isCropping ? 'cursor-default' : 'cursor-move'
      } ${
        isSelected && !isCropping
          ? 'ring-2 ring-blue-500 shadow-md z-30'
          : isCropping
          ? 'ring-2 ring-blue-600 shadow-xl z-40'
          : 'hover:ring-1 hover:ring-blue-400/80 z-10'
      }`}
      style={{
        left: `${object.x}%`,
        top: `${object.y}%`,
        width: `${object.width}%`,
        height: `${object.height}%`,
        transform: `rotate(${object.rotation || 0}deg) scale(${object.scaleX || 1}, ${object.scaleY || 1})`,
        transformOrigin: 'center center',
        opacity: object.opacity ?? 1,
        zIndex: object.zIndex || (isSelected ? 30 : 10),
        display: object.visible === false ? 'none' : 'block',
      }}
    >
      {/* 1. Object Core Rendered Content Layer */}
      <div className="w-full h-full relative overflow-visible pointer-events-none">
        {renderObjectView()}
      </div>

      {/* Hidden File Input for Instant Image Replacement */}
      {object.type === 'image' && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={handleImageFileChange}
        />
      )}

      {/* 2. Interactive Non-Destructive Crop Overlay (When isCropping is active) */}
      {isCropping && object.type === 'image' && (
        <ImageCropOverlay
          dataUrl={(object as any).dataUrl || ''}
          initialCropRect={(object as any).cropRect}
          containerWidthPx={(object.width / 100) * displayWidth}
          containerHeightPx={(object.height / 100) * displayHeight}
          onApplyCrop={(newCropRect) => {
            const prevCrop =
              (object as any).cropRect || { x: 0, y: 0, width: 100, height: 100 };
            history.execute(
              new CropImageCommand(object.id, prevCrop, newCropRect, onUpdate)
            );
            setIsCropping(false);
          }}
          onResetCrop={() => {
            const prevCrop =
              (object as any).cropRect || { x: 0, y: 0, width: 100, height: 100 };
            const defaultCrop: PDFImageCropRect = { x: 0, y: 0, width: 100, height: 100 };
            history.execute(
              new CropImageCommand(object.id, prevCrop, defaultCrop, onUpdate)
            );
            setIsCropping(false);
          }}
          onCancelCrop={() => setIsCropping(false)}
        />
      )}

      {/* ==================== UNIFIED SELECTION OVERLAY & CONTROLS ==================== */}
      {isSelected && !isCropping && (
        <>
          {/* 8-Point Resize Handles and Rotation Stem via TransformBox */}
          <TransformBox
            isLocked={object.locked}
            isRotating={isRotating}
            rotationAngle={currentAngle}
            onStartResize={handleMouseDownResizeHandle}
            onStartRotate={handleMouseDownRotateHandle}
          />

          {/* ==================== UNIFIED QUICK ACTION FLOATING HUD ==================== */}
          <div
            data-action-hud="true"
            className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-white/95 dark:bg-[#1e1e20]/95 backdrop-blur-md rounded-xl shadow-xl border border-black/[0.08] dark:border-white/[0.1] px-1.5 py-1 flex items-center space-x-1 z-40 animate-in fade-in slide-in-from-top-1 duration-150 select-none whitespace-nowrap"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Quick Edit (for text) */}
            {object.type === 'text' && onStartTextEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStartTextEdit(object.id);
                }}
                title="编辑文字内容"
                className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Quick Crop (for image) */}
            {object.type === 'image' && !object.locked && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCropping(true);
                }}
                title="非破坏性裁剪图片 (双击亦可进入)"
                className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors"
              >
                <Crop className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Quick Replace Image (for image) */}
            {object.type === 'image' && !object.locked && (
              <button
                onClick={handleTriggerReplaceImage}
                title="替换图片资源 (保持位置与格式属性)"
                className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors"
              >
                <ImageIcon className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Quick 90° Rotate */}
            <button
              onClick={handleQuickRotateStep}
              title="顺时针旋转 90°"
              className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>

            {/* Duplicate */}
            <button
              onClick={handleDuplicate}
              title="复制对象 (Duplicate)"
              className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>

            {/* Bring Forward */}
            {onBringForward && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onBringForward(object.id);
                }}
                title="图层上移一层"
                className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Send Backward */}
            {onSendBackward && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSendBackward(object.id);
                }}
                title="图层下移一层"
                className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Lock / Unlock */}
            <button
              onClick={handleToggleLock}
              title={object.locked ? '已锁定 (点击解锁)' : '锁定位置'}
              className={`p-1 rounded-lg transition-colors ${
                object.locked
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                  : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
              }`}
            >
              {object.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            </button>

            <div className="w-px h-3.5 bg-neutral-200 dark:bg-neutral-700 mx-0.5" />

            {/* Delete */}
            <button
              onClick={handleDelete}
              title="删除对象 (Delete)"
              className="p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </>
      )}
    </div>
  );
});
