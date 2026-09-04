import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  extractPdfPageTextItems,
  ExtractedPdfTextItem,
} from '../../core/pdf/pdfTextExtractor';
import { emitTextDiagnostic } from '../../core/pdf/textDiagnostics';
import type { PdfAnnotation, PdfToolMode, TextAnnotation } from '../../types';

export interface PdfTextLayerProps {
  pdfJsDoc: pdfjsLib.PDFDocumentProxy | null;
  pageIndex: number;
  rotation?: number;
  zoom: number;
  displayWidth: number;
  displayHeight: number;
  toolMode: PdfToolMode;
  annotations: PdfAnnotation[];
  selectedAnnotationId?: string | null;
  activeEditingId: string | null;
  onStartEditing: (id: string, initialText?: string, isNew?: boolean) => void;
  onCommitEditing: (id: string, text: string, isNew?: boolean) => void;
  onCancelEditing: (id: string, isNew?: boolean) => void;
  onSelectAnnotation?: (annot: PdfAnnotation | null) => void;
  onCreateTextAtPos: (x: number, y: number) => void;
}

export const PdfTextLayer: React.FC<PdfTextLayerProps> = ({
  pdfJsDoc,
  pageIndex,
  rotation = 0,
  zoom,
  displayWidth,
  displayHeight,
  toolMode,
  annotations,
  selectedAnnotationId,
  activeEditingId,
  onStartEditing,
  onCommitEditing,
  onCancelEditing,
  onSelectAnnotation,
  onCreateTextAtPos,
}) => {
  const [extractedItems, setExtractedItems] = useState<ExtractedPdfTextItem[]>([]);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  // Active editing state
  const [editingValue, setEditingValue] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeEditingItemRef = useRef<{
    id: string;
    isOriginal: boolean;
    originalText: string;
    isNew?: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
    fontFamily: string;
    color: string;
    backgroundColor?: string;
  } | null>(null);

  // Extract raw text items when PDF document or page/rotation changes
  useEffect(() => {
    let isCancelled = false;
    if (!pdfJsDoc) {
      setExtractedItems([]);
      return;
    }

    extractPdfPageTextItems(pdfJsDoc, pageIndex, rotation)
      .then((items) => {
        if (!isCancelled) {
          setExtractedItems(items);
        }
      })
      .catch((err) => {
        console.warn('Text layer extraction error:', err);
      });

    return () => {
      isCancelled = true;
    };
  }, [pdfJsDoc, pageIndex, rotation]);

  // Current page text annotations
  const pageTextAnnotations = useMemo(() => {
    return annotations.filter(
      (a): a is TextAnnotation =>
        a.type === 'text' && (a.pageIndex === pageIndex || (a as any).pageIndex === undefined)
    );
  }, [annotations, pageIndex]);

  // Find active editing object data (either from existing text item or from annotations)
  const currentEditingData = useMemo(() => {
    if (!activeEditingId) return null;

    // Check if it matches an annotation
    const annot = pageTextAnnotations.find((a) => a.id === activeEditingId);
    if (annot) {
      const isOriginal = Boolean(annot.isOriginalReplacement);
      return {
        id: annot.id,
        isOriginal,
        originalText: annot.originalText || annot.text || '',
        isNew: false,
        x: annot.x,
        y: annot.y,
        width: Math.max(annot.width, 15),
        height: Math.max(annot.height, 4),
        fontSize: annot.fontSize || 14,
        fontFamily: annot.fontFamily || 'Helvetica, Arial, sans-serif',
        color: annot.color || '#000000',
        backgroundColor:
          annot.backgroundColor && annot.backgroundColor !== 'transparent'
            ? annot.backgroundColor
            : isOriginal
            ? '#ffffff'
            : 'transparent',
        isBold: annot.isBold,
        isItalic: annot.isItalic,
      };
    }

    // Check if it matches an extracted raw item
    const raw = extractedItems.find((it) => it.id === activeEditingId);
    if (raw) {
      return {
        id: raw.id,
        isOriginal: true,
        originalText: raw.text,
        isNew: false,
        x: raw.x,
        y: raw.y,
        width: Math.max(raw.width, 15),
        height: Math.max(raw.height, 4),
        fontSize: raw.fontSize || 14,
        fontFamily: raw.fontFamily || 'Helvetica, Arial, sans-serif',
        color: raw.color || '#000000',
        backgroundColor: '#ffffff',
        isBold: false,
        isItalic: false,
      };
    }

    // If it's a freshly created temporary id
    if (activeEditingItemRef.current && activeEditingItemRef.current.id === activeEditingId) {
      return activeEditingItemRef.current;
    }

    return null;
  }, [activeEditingId, pageTextAnnotations, extractedItems]);

  // Focus textarea when editing starts
  useEffect(() => {
    if (activeEditingId && currentEditingData) {
      setEditingValue(currentEditingData.originalText);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.select();
        }
      });
    }
  }, [activeEditingId]);

  // Handle clicking on an existing extracted text block
  const handleOriginalTextClick = (e: React.MouseEvent, item: ExtractedPdfTextItem) => {
    e.stopPropagation();
    e.preventDefault();

    // Commit any currently active editing session before switching
    if (activeEditingId && activeEditingId !== item.id) {
      commitActiveEdit();
    }

    activeEditingItemRef.current = {
      id: item.id,
      isOriginal: true,
      originalText: item.text,
      x: item.x,
      y: item.y,
      width: Math.max(item.width, 15),
      height: Math.max(item.height, 4),
      fontSize: item.fontSize,
      fontFamily: item.fontFamily,
      color: item.color,
    };

    emitTextDiagnostic('text-edit-start', {
      pageIndex,
      objectId: item.id,
      originalText: item.text,
      currentText: item.text,
      source: 'existing',
      coordinates: { x: item.x, y: item.y, width: item.width, height: item.height },
    });

    onStartEditing(item.id, item.text, false);
  };

  // Commit active edit
  const commitActiveEdit = () => {
    if (!activeEditingId) return;

    const trimmed = editingValue.trim();
    const isNew = activeEditingItemRef.current?.isNew || activeEditingId.startsWith('txt-');
    const original = activeEditingItemRef.current?.originalText || '';

    if (trimmed.length === 0) {
      // Empty text (e.g. "", "   ", "\n\n") -> strictly discard and delete
      emitTextDiagnostic('text-edit-cancel', {
        pageIndex,
        objectId: activeEditingId,
      });
      onCancelEditing(activeEditingId, true);
    } else {
      emitTextDiagnostic('text-edit-commit', {
        pageIndex,
        objectId: activeEditingId,
        text: editingValue,
        changed: editingValue !== original,
      });
      onCommitEditing(activeEditingId, editingValue, isNew);
    }

    activeEditingItemRef.current = null;
  };

  // Cancel active edit
  const cancelActiveEdit = () => {
    if (!activeEditingId) return;
    const isNew = activeEditingItemRef.current?.isNew || activeEditingId.startsWith('txt-');
    const trimmed = editingValue.trim();

    if (trimmed.length === 0 || isNew) {
      emitTextDiagnostic('text-edit-cancel', {
        pageIndex,
        objectId: activeEditingId,
      });
      onCancelEditing(activeEditingId, true);
    } else {
      // For existing text when user pressed Esc, keep original text
      emitTextDiagnostic('text-edit-commit', {
        pageIndex,
        objectId: activeEditingId,
        text: activeEditingItemRef.current?.originalText || editingValue,
        changed: false,
      });
      onCommitEditing(activeEditingId, activeEditingItemRef.current?.originalText || editingValue, false);
    }
    activeEditingItemRef.current = null;
  };

  // Handle layer container click for blank area text creation
  const handleLayerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeEditingId) {
      commitActiveEdit();
      // If in text mode, immediately create next text box
      if (toolMode === 'text') {
        const rect = e.currentTarget.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const clickX = Math.max(0, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));
          const clickY = Math.max(0, Math.min(95, ((e.clientY - rect.top) / rect.height) * 100));
          onCreateTextAtPos(clickX, clickY);
        }
      }
      return;
    }

    if (toolMode === 'text') {
      const rect = e.currentTarget.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const clickX = Math.max(0, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));
        const clickY = Math.max(0, Math.min(95, ((e.clientY - rect.top) / rect.height) * 100));
        onCreateTextAtPos(clickX, clickY);
      }
    }
  };

  return (
    <div
      data-pdf-text-layer="true"
      onClick={handleLayerClick}
      className={`absolute inset-0 z-20 ${
        toolMode === 'text'
          ? 'cursor-text pointer-events-auto'
          : 'pointer-events-none'
      }`}
      style={{
        width: `${displayWidth}px`,
        height: `${displayHeight}px`,
      }}
    >
      {/* 1. Extracted Original PDF Text Items (Interactive in select or text mode) */}
      {extractedItems.map((item) => {
        // Check if already replaced by an active annotation
        const isReplaced = pageTextAnnotations.some(
          (annot) =>
            annot.isOriginalReplacement &&
            Math.abs(annot.x - item.x) < 1.0 &&
            Math.abs(annot.y - item.y) < 1.0
        );

        if (isReplaced) return null;

        const isBeingEdited = activeEditingId === item.id;
        if (isBeingEdited) return null; // Rendered in active inline editor below

        const isHovered = hoveredItemId === item.id;
        const isInteractive = toolMode === 'select' || toolMode === 'text';

        return (
          <div
            key={item.id}
            data-raw-text-id={item.id}
            onMouseEnter={() => isInteractive && setHoveredItemId(item.id)}
            onMouseLeave={() => isInteractive && setHoveredItemId(null)}
            onClick={(e) => isInteractive && handleOriginalTextClick(e, item)}
            onDoubleClick={(e) => handleOriginalTextClick(e, item)}
            className={`absolute transition-all select-none rounded-[2px] ${
              isInteractive ? 'pointer-events-auto cursor-text' : 'pointer-events-none'
            } ${
              isHovered && isInteractive
                ? 'outline-1 outline-dashed outline-blue-500/80 bg-blue-500/10'
                : 'hover:outline-1 hover:outline-dashed hover:outline-blue-400/50'
            }`}
            style={{
              left: `${item.x}%`,
              top: `${item.y}%`,
              width: `${item.width}%`,
              height: `${item.height}%`,
              fontSize: `${(item.fontSize || 14) * zoom}px`,
              fontFamily: item.fontFamily || 'Helvetica, Arial, sans-serif',
              lineHeight: 1.2,
              color: 'transparent', // Transparent because the canvas underneath renders the visual pixels
            }}
            title={isInteractive ? `点击编辑文字: "${item.text}"` : undefined}
          >
            {/* Visual representation kept invisible to align with canvas */}
            <span className="opacity-0 select-text whitespace-pre-wrap">{item.text}</span>
          </div>
        );
      })}

      {/* 2. Active Inline Direct Text Editor (Overlaid at exact coordinates with transparent BG) */}
      {activeEditingId && currentEditingData && (
        <div
          data-active-inline-editor="true"
          className="absolute z-40 pointer-events-auto border border-dashed border-blue-500/80 rounded-sm"
          style={{
            left: `${currentEditingData.x}%`,
            top: `${currentEditingData.y}%`,
            width: `${Math.max(currentEditingData.width, 18)}%`,
            minHeight: `${Math.max(currentEditingData.height, 4.5)}%`,
            backgroundColor:
              currentEditingData.backgroundColor && currentEditingData.backgroundColor !== 'transparent'
                ? currentEditingData.backgroundColor
                : 'transparent',
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <textarea
            ref={textareaRef}
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            onBlur={() => {
              // Delay slightly to handle clicking other text items smoothly
              setTimeout(() => {
                if (activeEditingId) {
                  commitActiveEdit();
                }
              }, 120);
            }}
            onKeyDown={(e) => {
              if (isComposing) return;

              if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                if (editingValue.trim().length === 0) {
                  cancelActiveEdit();
                } else {
                  commitActiveEdit();
                }
              }
              // Enter creates newline naturally (no preventDefault)
            }}
            className="w-full h-full p-0.5 resize-none bg-transparent text-neutral-900 dark:text-neutral-100 border-none outline-none leading-snug whitespace-pre-wrap focus:ring-0 focus:outline-none"
            style={{
              fontSize: `${Math.max(12, (currentEditingData.fontSize || 14) * zoom)}px`,
              fontFamily: currentEditingData.fontFamily || 'Helvetica, Arial, sans-serif',
              color: currentEditingData.color || '#000000',
              fontWeight: (currentEditingData as any).isBold ? 'bold' : 'normal',
              fontStyle: (currentEditingData as any).isItalic ? 'italic' : 'normal',
              minHeight: '28px',
              backgroundColor: 'transparent',
            }}
            placeholder="输入文字..."
          />
        </div>
      )}
    </div>
  );
};
