import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { renderPdfPageToCanvas } from '../../utils/pdfLibWrapper';
import type {
  PdfAnnotation,
  PdfToolMode,
  PageMeta,
  TextAnnotation,
  ShapeAnnotation,
  EraserMaskAnnotation,
  MeasureAnnotation,
} from '../../types';
import { Check, X } from 'lucide-react';
import {
  EditorStateMachine,
  mapToolModeToEditorMode,
  getDisplayPageDimensions,
} from '../../core/pdf';
import { PDFObjectContainer } from './objects/PDFObjectContainer';
import { PdfTextLayer } from './PdfTextLayer';
import { normalizePDFObject } from '../../types/pdfObject';
import { HistoryManager } from '../../core/history';
import { emitTextDiagnostic } from '../../core/pdf/textDiagnostics';

interface PdfCanvasStageProps {
  pdfJsDoc: pdfjsLib.PDFDocumentProxy | null;
  pageMeta: PageMeta;
  currentPageIndex: number;
  zoom: number;
  toolMode: PdfToolMode;
  onSelectToolMode?: (mode: PdfToolMode) => void;
  annotations: PdfAnnotation[];
  selectedAnnotationId?: string | null;
  onSelectAnnotation?: (annot: PdfAnnotation | null) => void;
  onAddAnnotation: (annot: PdfAnnotation) => void;
  onUpdateAnnotation: (id: string, updates: Partial<PdfAnnotation>, recordHistory?: boolean) => void;
  onDeleteAnnotation: (id: string) => void;
  onDuplicateAnnotation?: (object: any) => void;
  onBringForward?: (id: string) => void;
  onSendBackward?: (id: string) => void;
  isScannedEraserActive?: boolean;
  maskColor?: string;
  onFinishScannedEraser?: () => void;
  measureScale?: number;
  measureUnit?: 'mm' | 'cm' | 'm';
  historyManager?: HistoryManager;
  documentId?: string;
}

export const PdfCanvasStage: React.FC<PdfCanvasStageProps> = ({
  pdfJsDoc,
  pageMeta,
  currentPageIndex,
  zoom,
  toolMode,
  onSelectToolMode,
  annotations,
  selectedAnnotationId,
  onSelectAnnotation,
  onAddAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onDuplicateAnnotation,
  onBringForward,
  onSendBackward,
  isScannedEraserActive = false,
  maskColor = '#ffffff',
  onFinishScannedEraser,
  measureScale = 100,
  measureUnit = 'mm',
  historyManager,
  documentId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRenderTaskRef = useRef<any>(null);
  const [isRendering, setIsRendering] = useState(false);

  // Inline text editing state
  const [activeEditingTextId, setActiveEditingTextId] = useState<string | null>(null);

  // Editor State Machine instance
  const stateMachineRef = useRef<EditorStateMachine>(
    new EditorStateMachine(mapToolModeToEditorMode(toolMode))
  );

  // Keep state machine synced with toolMode prop
  useEffect(() => {
    stateMachineRef.current.setToolMode(mapToolModeToEditorMode(toolMode));
  }, [toolMode]);

  // Keep state machine synced with selectedAnnotationId
  useEffect(() => {
    stateMachineRef.current.selectObject(selectedAnnotationId || null);
  }, [selectedAnnotationId]);

  // Marquee selection for scanned eraser, highlight, redaction, shapes, form fields
  const [isMarqueeDragging, setIsMarqueeDragging] = useState(false);
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null);
  const [marqueeCurrent, setMarqueeCurrent] = useState<{ x: number; y: number } | null>(null);

  // Free drawing state
  const [currentDrawPoints, setCurrentDrawPoints] = useState<{ x: number; y: number }[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  // Measurement points
  const [measurePoints, setMeasurePoints] = useState<{ x: number; y: number }[]>([]);

  // Calculate rotation-aware display page dimensions
  const { displayWidth, displayHeight, isSideways } = getDisplayPageDimensions(
    pageMeta.width,
    pageMeta.height,
    pageMeta.rotation || 0,
    zoom
  );

  const effectivePageMeta = {
    ...pageMeta,
    displayWidth,
    displayHeight,
    isSideways,
  };

  // Render the PDF page whenever pdfJsDoc, pageMeta, zoom or rotation changes
  useEffect(() => {
    if (!pdfJsDoc || !canvasRef.current) return;
    let isCancelled = false;

    if (activeRenderTaskRef.current) {
      try {
        activeRenderTaskRef.current.cancel();
      } catch {}
      activeRenderTaskRef.current = null;
    }

    const render = async () => {
      setIsRendering(true);
      try {
        const totalPdfPages = pdfJsDoc.numPages || 0;
        let targetIdx = -1;
        if (typeof pageMeta.originalIndex === 'number' && pageMeta.originalIndex >= 0 && pageMeta.originalIndex < totalPdfPages) {
          targetIdx = pageMeta.originalIndex;
        } else if (typeof pageMeta.pageIndex === 'number' && pageMeta.pageIndex >= 0 && pageMeta.pageIndex < totalPdfPages) {
          targetIdx = pageMeta.pageIndex;
        } else if (currentPageIndex >= 0 && currentPageIndex < totalPdfPages) {
          targetIdx = currentPageIndex;
        }
        await renderPdfPageToCanvas(
          pdfJsDoc,
          targetIdx,
          canvasRef.current!,
          zoom * 1.5,
          pageMeta.rotation,
          (task) => {
            activeRenderTaskRef.current = task;
          }
        );
      } catch (err: any) {
        if (err?.name === 'RenderingCancelledException' || err?.message?.includes('cancelled')) {
          return;
        }
        console.warn('Canvas render notice:', err?.message || err);
      } finally {
        if (!isCancelled) {
          setIsRendering(false);
          activeRenderTaskRef.current = null;
        }
      }
    };

    render();

    return () => {
      isCancelled = true;
      if (activeRenderTaskRef.current) {
        try {
          activeRenderTaskRef.current.cancel();
        } catch {}
        activeRenderTaskRef.current = null;
      }
    };
  }, [pdfJsDoc, pageMeta.originalIndex, pageMeta.rotation, pageMeta.width, pageMeta.height, currentPageIndex, zoom]);

  // Handle stage mouse down with State Machine verification
  const handleStageMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Guard 1: Verify target is canvas background, NOT an interactive control or child popup
    const target = e.target as HTMLElement;
    if (
      target.closest('[data-pdf-object-id]') ||
      target.closest('[data-control-handle="true"]') ||
      target.closest('[data-action-hud="true"]') ||
      target.closest('button') ||
      target.closest('input') ||
      target.closest('[data-no-canvas-click]')
    ) {
      return;
    }

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    const sm = stateMachineRef.current;

    // Deselect if in select mode and clicking blank canvas
    if (toolMode === 'select') {
      onSelectAnnotation?.(null);
      sm.selectObject(null);
      return;
    }

    if (
      isScannedEraserActive ||
      toolMode === 'scanned-eraser' ||
      toolMode === 'highlight' ||
      toolMode === 'underline' ||
      toolMode === 'strikethrough' ||
      toolMode === 'squiggly' ||
      toolMode === 'redact' ||
      toolMode === 'rect' ||
      toolMode === 'circle' ||
      toolMode === 'arrow' ||
      toolMode === 'line' ||
      toolMode === 'table' ||
      toolMode === 'form-text' ||
      toolMode === 'form-checkbox' ||
      toolMode === 'form-radio'
    ) {
      setIsMarqueeDragging(true);
      setMarqueeStart({ x: xPct, y: yPct });
      setMarqueeCurrent({ x: xPct, y: yPct });
      sm.setPhase('DRAGGING');
    } else if (toolMode === 'text' || toolMode === 'textbox') {
      handleCreateTextAtPos(xPct, yPct);
    } else if (toolMode === 'draw') {
      setIsDrawing(true);
      setCurrentDrawPoints([{ x: xPct, y: yPct }]);
      sm.setPhase('DRAWING');
    } else if (toolMode === 'comment') {
      const newCommentId = `cmt-${Date.now()}`;
      const newComment: PdfAnnotation = {
        id: newCommentId,
        pageIndex: currentPageIndex,
        type: 'comment',
        x: xPct,
        y: yPct,
        width: 26,
        height: 8,
        text: '添加便签评论...',
        author: '用户',
        color: '#f59e0b',
        createdAt: Date.now(),
      } as any;
      onAddAnnotation(newComment);
      onSelectAnnotation?.(newComment);
      sm.onObjectCreated(newCommentId);
      onSelectToolMode?.('select');
    } else if (toolMode === 'measure-distance' || toolMode === 'measure-area') {
      sm.setPhase('MEASURING');
      const nextPoints = [...measurePoints, { x: xPct, y: yPct }];
      if (toolMode === 'measure-distance' && nextPoints.length === 2) {
        // Calculate physical distance in selected units
        const dx = ((nextPoints[1].x - nextPoints[0].x) / 100) * displayWidth * (25.4 / (72 * zoom));
        const dy = ((nextPoints[1].y - nextPoints[0].y) / 100) * displayHeight * (25.4 / (72 * zoom));
        const distMm = Math.sqrt(dx * dx + dy * dy) * (measureScale / 100);

        const minX = Math.min(nextPoints[0].x, nextPoints[1].x);
        const minY = Math.min(nextPoints[0].y, nextPoints[1].y);
        const width = Math.max(4, Math.abs(nextPoints[1].x - nextPoints[0].x));
        const height = Math.max(3, Math.abs(nextPoints[1].y - nextPoints[0].y));

        const newMeasureId = `meas-${Date.now()}`;
        const newMeasure: MeasureAnnotation = {
          id: newMeasureId,
          pageIndex: currentPageIndex,
          type: 'measure',
          measureType: 'distance',
          x: minX,
          y: minY,
          width,
          height,
          points: nextPoints,
          valueText: `${distMm.toFixed(1)} ${measureUnit}`,
          unit: measureUnit,
          scaleRatio: measureScale,
          createdAt: Date.now(),
        };
        onAddAnnotation(newMeasure);
        setMeasurePoints([]);
        sm.onObjectCreated(newMeasureId);
        onSelectToolMode?.('select');
      } else {
        setMeasurePoints(nextPoints);
      }
    }
  };

  const handleStageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    if (isMarqueeDragging) {
      setMarqueeCurrent({ x: xPct, y: yPct });
    } else if (isDrawing) {
      setCurrentDrawPoints((prev) => [...prev, { x: xPct, y: yPct }]);
    }
  };

  const handleStageMouseUp = () => {
    const sm = stateMachineRef.current;

    // Handle completed marquee creation
    if (isMarqueeDragging && marqueeStart && marqueeCurrent) {
      const minX = Math.min(marqueeStart.x, marqueeCurrent.x);
      const minY = Math.min(marqueeStart.y, marqueeCurrent.y);
      const width = Math.max(1, Math.abs(marqueeCurrent.x - marqueeStart.x));
      const height = Math.max(1, Math.abs(marqueeCurrent.y - marqueeStart.y));

      if (width > 0.8 && height > 0.5) {
        if (isScannedEraserActive || toolMode === 'scanned-eraser') {
          const newEraserMask: EraserMaskAnnotation = {
            id: `mask-${Date.now()}`,
            pageIndex: currentPageIndex,
            type: 'eraser-mask',
            x: minX,
            y: minY,
            width,
            height,
            fillColor: maskColor,
            createdAt: Date.now(),
          };
          onAddAnnotation(newEraserMask);
          onFinishScannedEraser?.();
          sm.resetToSelect();
          onSelectToolMode?.('select');
        } else if (toolMode === 'highlight') {
          const id = `hl-${Date.now()}`;
          const newHl: PdfAnnotation = {
            id,
            pageIndex: currentPageIndex,
            type: 'highlight',
            x: minX,
            y: minY,
            width,
            height,
            color: '#fef08a',
            opacity: 0.45,
            createdAt: Date.now(),
          } as any;
          onAddAnnotation(newHl);
          sm.onObjectCreated(id);
          onSelectToolMode?.('select');
        } else if (toolMode === 'underline') {
          const id = `un-${Date.now()}`;
          const newUn: PdfAnnotation = {
            id,
            pageIndex: currentPageIndex,
            type: 'underline',
            x: minX,
            y: minY + height - 1,
            width,
            height: 2,
            color: '#2563eb',
            createdAt: Date.now(),
          } as any;
          onAddAnnotation(newUn);
          sm.onObjectCreated(id);
          onSelectToolMode?.('select');
        } else if (toolMode === 'strikethrough') {
          const id = `st-${Date.now()}`;
          const newSt: PdfAnnotation = {
            id,
            pageIndex: currentPageIndex,
            type: 'strikethrough',
            x: minX,
            y: minY + height / 2,
            width,
            height: 2,
            color: '#ef4444',
            createdAt: Date.now(),
          } as any;
          onAddAnnotation(newSt);
          sm.onObjectCreated(id);
          onSelectToolMode?.('select');
        } else if (toolMode === 'squiggly') {
          const id = `sq-${Date.now()}`;
          const newSq: PdfAnnotation = {
            id,
            pageIndex: currentPageIndex,
            type: 'squiggly',
            x: minX,
            y: minY + height - 1,
            width,
            height: 2,
            color: '#f59e0b',
            createdAt: Date.now(),
          } as any;
          onAddAnnotation(newSq);
          sm.onObjectCreated(id);
          onSelectToolMode?.('select');
        } else if (toolMode === 'redact') {
          const id = `red-${Date.now()}`;
          const newRed: PdfAnnotation = {
            id,
            pageIndex: currentPageIndex,
            type: 'redact',
            x: minX,
            y: minY,
            width,
            height,
            fillColor: '#000000',
            isApplied: false,
            createdAt: Date.now(),
          } as any;
          onAddAnnotation(newRed);
          sm.onObjectCreated(id);
          onSelectToolMode?.('select');
        } else if (['rect', 'circle', 'arrow', 'line', 'table'].includes(toolMode)) {
          const id = `shp-${Date.now()}`;
          const newShape: ShapeAnnotation = {
            id,
            pageIndex: currentPageIndex,
            type: 'shape',
            shapeType: toolMode as any,
            x: minX,
            y: minY,
            width,
            height,
            strokeColor: '#2563eb',
            strokeWidth: 2,
            opacity: 1.0,
            rows: 3,
            cols: 3,
            createdAt: Date.now(),
          };
          onAddAnnotation(newShape);
          onSelectAnnotation?.(newShape);
          sm.onObjectCreated(id);
          onSelectToolMode?.('select');
        } else if (toolMode === 'form-text') {
          const id = `form-${Date.now()}`;
          const newForm: PdfAnnotation = {
            id,
            pageIndex: currentPageIndex,
            type: 'form-field',
            fieldType: 'text',
            x: minX,
            y: minY,
            width,
            height: Math.max(height, 4),
            fieldName: `Field_${Date.now().toString().slice(-4)}`,
            value: '',
            createdAt: Date.now(),
          } as any;
          onAddAnnotation(newForm);
          sm.onObjectCreated(id);
          onSelectToolMode?.('select');
        } else if (toolMode === 'form-checkbox') {
          const id = `chk-${Date.now()}`;
          const newChk: PdfAnnotation = {
            id,
            pageIndex: currentPageIndex,
            type: 'form-field',
            fieldType: 'checkbox',
            x: minX,
            y: minY,
            width: 3.5,
            height: 3.5,
            fieldName: `Check_${Date.now().toString().slice(-4)}`,
            value: 'true',
            checked: false,
            createdAt: Date.now(),
          } as any;
          onAddAnnotation(newChk);
          sm.onObjectCreated(id);
          onSelectToolMode?.('select');
        }
      }

      setIsMarqueeDragging(false);
      setMarqueeStart(null);
      setMarqueeCurrent(null);
      sm.setPhase('IDLE');
    }

    // Handle completed freehand drawing
    if (isDrawing && currentDrawPoints.length > 1) {
      const xs = currentDrawPoints.map((p) => p.x);
      const ys = currentDrawPoints.map((p) => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const width = Math.max(2, maxX - minX);
      const height = Math.max(2, maxY - minY);

      // Normalize points relative to bounding box (0-100%)
      const normalizedPoints = currentDrawPoints.map((p) => ({
        x: Math.round((((p.x - minX) / width) * 100) * 10) / 10,
        y: Math.round((((p.y - minY) / height) * 100) * 10) / 10,
      }));

      const id = `draw-${Date.now()}`;
      const newDrawAnnot: PdfAnnotation = {
        id,
        pageIndex: currentPageIndex,
        type: 'draw',
        x: Math.round(minX * 10) / 10,
        y: Math.round(minY * 10) / 10,
        width: Math.round(width * 10) / 10,
        height: Math.round(height * 10) / 10,
        points: normalizedPoints,
        color: '#dc2626',
        strokeWidth: 2.5,
        opacity: 0.9,
        createdAt: Date.now(),
      } as any;

      onAddAnnotation(newDrawAnnot);
      setIsDrawing(false);
      setCurrentDrawPoints([]);
      sm.onObjectCreated(id);
      onSelectToolMode?.('select');
    }
  };

  const handleStartTextEdit = (id: string, initialText?: string, isNew?: boolean) => {
    setActiveEditingTextId(id);
    stateMachineRef.current.setPhase('TEXT_EDITING');
  };

  const handleCommitTextEdit = (id: string, text: string, isNew?: boolean) => {
    const sm = stateMachineRef.current;
    const finalVal = text.trim();

    if (!finalVal) {
      onDeleteAnnotation(id);
      setActiveEditingTextId(null);
      sm.setPhase('IDLE');
      return;
    }

    // Check if it exists in annotations
    const existing = annotations.find((a) => a.id === id);
    if (existing) {
      onUpdateAnnotation(id, { text }, true);
      sm.onObjectCreated(id, false);
    }

    setActiveEditingTextId(null);
    sm.setPhase('IDLE');
  };

  const handleCancelTextEdit = (id: string, isNew?: boolean) => {
    const target = annotations.find((a) => a.id === id);
    if (isNew || (target && 'text' in target && (!target.text || !target.text.trim()))) {
      onDeleteAnnotation(id);
    }
    setActiveEditingTextId(null);
    stateMachineRef.current.setPhase('IDLE');
  };

  const handleCreateTextAtPos = (x: number, y: number) => {
    // Clean up any lingering empty text before creating next
    if (activeEditingTextId) {
      const activeAnnot = annotations.find((a) => a.id === activeEditingTextId);
      if (activeAnnot && 'text' in activeAnnot && (!activeAnnot.text || !activeAnnot.text.trim())) {
        onDeleteAnnotation(activeEditingTextId);
      }
    }

    const newTextId = `txt-${Date.now()}`;
    const newText: TextAnnotation = {
      id: newTextId,
      pageIndex: currentPageIndex,
      type: 'text',
      x,
      y,
      width: 25,
      height: 6,
      text: '',
      fontSize: 16,
      color: '#1d1d1f',
      backgroundColor: 'transparent',
      fontFamily: 'Helvetica',
      createdAt: Date.now(),
    };
    onAddAnnotation(newText);
    onSelectAnnotation?.(newText);
    setActiveEditingTextId(newTextId);
    stateMachineRef.current.setPhase('TEXT_EDITING');
    emitTextDiagnostic('text-edit-start', {
      pageIndex: currentPageIndex,
      objectId: newTextId,
      originalText: '',
      currentText: '',
      source: 'inserted',
      coordinates: { x, y, width: 25, height: 6 },
    });
  };

  // Filter annotations for this page
  const pageAnnotations = annotations.filter(
    (a) => a.pageIndex === currentPageIndex || a.pageIndex === pageMeta.originalIndex
  );

  return (
    <div className="relative block">
      {/* 
        Page container element (PageViewport):
        - Editor View Bounds: explicitly set to 'overflow-visible' so objects, 8-point resize
        handles, rotation stem, and floating HUDs can freely extend outside page bounds.
        - PDF Export Bounds: will be strictly cropped according to PDF MediaBox/CropBox on export.
      */}
      <div
        id={`pdf-page-container-${currentPageIndex}`}
        ref={containerRef}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        className={`relative paper-shadow bg-white rounded-lg transition-shadow select-none overflow-visible ${
          isScannedEraserActive || toolMode === 'scanned-eraser'
            ? 'cursor-crosshair ring-2 ring-amber-400'
            : toolMode === 'text' || toolMode === 'textbox'
            ? 'cursor-text'
            : toolMode === 'draw' || toolMode.startsWith('measure')
            ? 'cursor-crosshair'
            : 'cursor-default'
        }`}
        style={{
          position: 'relative',
          display: 'block',
          width: `${displayWidth}px`,
          height: `${displayHeight}px`,
        }}
      >
        {/* Layer 1: Underlying PDF Render Canvas (Background Layer, pointer-events-none, strict relative flow) */}
        <canvas
          ref={canvasRef}
          id={`pdf-canvas-${currentPageIndex}`}
          data-page-index={currentPageIndex}
          className="w-full h-full block rounded-lg pointer-events-none"
          style={{
            position: 'relative',
            display: 'block',
            width: `${displayWidth}px`,
            height: `${displayHeight}px`,
            margin: '0 auto',
            transform: 'none',
            top: 'auto',
            left: 'auto',
          }}
        />

        {/* Layer 2: Dedicated DOM Text Layer (Overlay for native and inserted text editing) */}
        <PdfTextLayer
          pdfJsDoc={pdfJsDoc}
          pageIndex={pageMeta.originalIndex ?? currentPageIndex}
          rotation={pageMeta.rotation || 0}
          zoom={zoom}
          displayWidth={displayWidth}
          displayHeight={displayHeight}
          toolMode={toolMode}
          annotations={annotations}
          selectedAnnotationId={selectedAnnotationId}
          activeEditingId={activeEditingTextId}
          onStartEditing={handleStartTextEdit}
          onCommitEditing={handleCommitTextEdit}
          onCancelEditing={handleCancelTextEdit}
          onSelectAnnotation={onSelectAnnotation}
          onCreateTextAtPos={handleCreateTextAtPos}
        />

        {/* Layer 3: Dynamic Objects Layer (overflow-visible, contains all PDFObjectContainers) */}
        <div className="absolute inset-0 pointer-events-none overflow-visible">
          {pageAnnotations.map((annot) => {
            const isSelected = selectedAnnotationId === annot.id;
            const unifiedObj = normalizePDFObject(annot);

            return (
              <PDFObjectContainer
                key={annot.id}
                object={unifiedObj}
                isSelected={isSelected}
                zoom={zoom}
                historyManager={historyManager}
                documentId={documentId}
                pageMeta={effectivePageMeta}
                onSelect={(e) => {
                  e?.stopPropagation?.();
                  onSelectAnnotation?.(annot);
                }}
                onUpdate={(id, updates) =>
                  onUpdateAnnotation(id, updates as Partial<PdfAnnotation>)
                }
                onDelete={(id) => onDeleteAnnotation(id)}
                onDuplicate={(obj) => {
                  if (onDuplicateAnnotation) {
                    onDuplicateAnnotation(obj);
                  } else {
                    onAddAnnotation({
                      ...obj,
                      id: `${obj.type || 'obj'}-${Date.now()}`,
                      x: Math.min(90, (obj.x || 10) + 3),
                      y: Math.min(90, (obj.y || 10) + 3),
                      createdAt: Date.now(),
                    } as PdfAnnotation);
                  }
                }}
                onBringForward={(id) => onBringForward?.(id)}
                onSendBackward={(id) => onSendBackward?.(id)}
                onStartTextEdit={(id) => {
                  handleStartTextEdit(id);
                }}
              />
            );
          })}
        </div>

        {/* Marquee Bounding Box Indicator */}
        {isMarqueeDragging && marqueeStart && marqueeCurrent && (
          <div
            className="absolute border-2 border-dashed border-blue-500 bg-blue-500/15 pointer-events-none"
            style={{
              left: `${Math.min(marqueeStart.x, marqueeCurrent.x)}%`,
              top: `${Math.min(marqueeStart.y, marqueeCurrent.y)}%`,
              width: `${Math.abs(marqueeCurrent.x - marqueeStart.x)}%`,
              height: `${Math.abs(marqueeCurrent.y - marqueeStart.y)}%`,
            }}
          />
        )}

        {/* Active Freehand Drawing Preview */}
        {isDrawing && currentDrawPoints.length > 1 && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
            <polyline
              fill="none"
              stroke="#dc2626"
              strokeWidth={Math.max(1.5, 2.5 * zoom)}
              strokeLinecap="round"
              strokeLinejoin="round"
              points={currentDrawPoints
                .map(
                  (p) =>
                    `${(p.x / 100) * displayWidth},${(p.y / 100) * displayHeight}`
                )
                .join(' ')}
            />
          </svg>
        )}
      </div>
    </div>
  );
};
