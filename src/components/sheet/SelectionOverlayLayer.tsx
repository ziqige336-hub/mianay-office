import React from 'react';
import type { GridLayoutEngine } from '../../core/sheet/GridLayoutEngine';
import type { SelectionRange } from '../../core/sheet/SpreadsheetSelectionManager';
import { normalizeSelectionRange } from '../../core/sheet/SpreadsheetSelectionManager';

export interface SelectionOverlayLayerProps {
  ranges: SelectionRange[];
  activeCell: { r: number; c: number };
  layoutEngine: GridLayoutEngine;
  sheetZoom: number;
  isEditing: boolean;
  headerWidth: number;
  headerHeight: number;
  onFillHandleMouseDown?: (e: React.MouseEvent) => void;
  clipboardRange?: SelectionRange | null;
  fillPreviewRange?: SelectionRange | null;
}

export const SelectionOverlayLayer: React.FC<SelectionOverlayLayerProps> = ({
  ranges,
  activeCell,
  layoutEngine,
  sheetZoom,
  isEditing,
  headerWidth,
  headerHeight,
  onFillHandleMouseDown,
  clipboardRange,
  fillPreviewRange,
}) => {
  if (!ranges || ranges.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: headerHeight,
        left: headerWidth,
        width: layoutEngine.getTotalWidth() * sheetZoom,
        height: layoutEngine.getTotalHeight() * sheetZoom,
        pointerEvents: 'none',
        zIndex: 25,
      }}
      className="selection-overlay-root"
    >
      {/* 1. Selection Ranges (Supports single cells, rectangular regions, columns, rows, multi-ranges) */}
      {ranges.map((range, index) => {
        const bounds = layoutEngine.calculateRangeBounds(range);
        const isPrimary = index === ranges.length - 1;
        const norm = normalizeSelectionRange(range);
        const isMultiCell = norm.rowCount > 1 || norm.colCount > 1;

        const left = bounds.left * sheetZoom;
        const top = bounds.top * sheetZoom;
        const width = bounds.width * sheetZoom;
        const height = bounds.height * sheetZoom;

        // If bounds have 0 width or height (e.g. hidden), skip
        if (width <= 0 || height <= 0) return null;

        return (
          <div
            key={`range-${index}-${range.startRow}-${range.startCol}-${range.endRow}-${range.endCol}`}
            style={{
              position: 'absolute',
              left,
              top,
              width,
              height,
              backgroundColor: 'transparent',
              border: '2px solid #0071e3',
              boxSizing: 'border-box',
              pointerEvents: 'none',
            }}
            className="selection-box rounded-[1px]"
          >

            {/* Smart AutoFill Grip Handle (Bottom-Right corner of primary range) */}
            {isPrimary && !isEditing && onFillHandleMouseDown && (
              <div
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onFillHandleMouseDown(e);
                }}
                title="拖拽填充序列 / 相对公式引用"
                style={{
                  position: 'absolute',
                  right: -4.5,
                  bottom: -4.5,
                  width: 8,
                  height: 8,
                  backgroundColor: '#0071e3',
                  border: '1.5px solid #ffffff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  borderRadius: '1px',
                  cursor: 'crosshair',
                  pointerEvents: 'auto',
                  zIndex: 30,
                }}
                className="fill-handle hover:scale-125 transition-transform"
              />
            )}
          </div>
        );
      })}

      {/* 2. Drag AutoFill Preview Outline */}
      {fillPreviewRange && (
        (() => {
          const previewBounds = layoutEngine.calculateRangeBounds(fillPreviewRange);
          return (
            <div
              style={{
                position: 'absolute',
                left: previewBounds.left * sheetZoom,
                top: previewBounds.top * sheetZoom,
                width: previewBounds.width * sheetZoom,
                height: previewBounds.height * sheetZoom,
                border: '2px dashed #0071e3',
                backgroundColor: 'rgba(0, 113, 227, 0.05)',
                boxSizing: 'border-box',
                pointerEvents: 'none',
                zIndex: 26,
              }}
              className="fill-preview-box"
            />
          );
        })()
      )}

      {/* 3. Clipboard Copied Range Animated Box (Marching Ants) */}
      {clipboardRange && (
        (() => {
          const clipBounds = layoutEngine.calculateRangeBounds(clipboardRange);
          return (
            <div
              style={{
                position: 'absolute',
                left: clipBounds.left * sheetZoom,
                top: clipBounds.top * sheetZoom,
                width: clipBounds.width * sheetZoom,
                height: clipBounds.height * sheetZoom,
                border: '2px dashed #0071e3',
                boxSizing: 'border-box',
                pointerEvents: 'none',
                zIndex: 27,
              }}
              className="clipboard-marching-ants animate-pulse"
            />
          );
        })()
      )}
    </div>
  );
};
