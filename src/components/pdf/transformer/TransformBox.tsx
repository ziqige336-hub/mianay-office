import React from 'react';
import { RotateCw } from 'lucide-react';
import { RotationBadge } from './RotationBadge';

export type ResizeHandleType = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export interface TransformBoxProps {
  isLocked?: boolean;
  isRotating?: boolean;
  rotationAngle: number;
  onStartResize: (e: React.MouseEvent, handle: ResizeHandleType) => void;
  onStartRotate: (e: React.MouseEvent) => void;
}

const RESIZE_HANDLES: { type: ResizeHandleType; className: string; cursor: string }[] = [
  { type: 'nw', className: '-top-1.5 -left-1.5', cursor: 'cursor-nwse-resize' },
  { type: 'n', className: '-top-1.5 left-1/2 -translate-x-1/2', cursor: 'cursor-ns-resize' },
  { type: 'ne', className: '-top-1.5 -right-1.5', cursor: 'cursor-nesw-resize' },
  { type: 'e', className: 'top-1/2 -right-1.5 -translate-y-1/2', cursor: 'cursor-ew-resize' },
  { type: 'se', className: '-bottom-1.5 -right-1.5', cursor: 'cursor-nwse-resize' },
  { type: 's', className: '-bottom-1.5 left-1/2 -translate-x-1/2', cursor: 'cursor-ns-resize' },
  { type: 'sw', className: '-bottom-1.5 -left-1.5', cursor: 'cursor-nesw-resize' },
  { type: 'w', className: 'top-1/2 -left-1.5 -translate-y-1/2', cursor: 'cursor-ew-resize' },
];

export const TransformBox: React.FC<TransformBoxProps> = ({
  isLocked = false,
  isRotating = false,
  rotationAngle,
  onStartResize,
  onStartRotate,
}) => {
  if (isLocked) return null;

  return (
    <>
      {/* Top Rotation Pivot Stem & Handle */}
      <div
        data-control-handle="true"
        className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center z-40"
      >
        <div
          onMouseDown={onStartRotate}
          title="按住旋转 (按住 Shift 锁定 15°)"
          className="w-5 h-5 rounded-full bg-white dark:bg-neutral-800 border-2 border-blue-500 shadow-md hover:scale-125 cursor-grab active:cursor-grabbing flex items-center justify-center text-blue-600 transition-transform"
        >
          <RotateCw className="w-2.5 h-2.5" />
        </div>
        <div className="w-0.5 h-2 bg-blue-500" />
      </div>

      {/* Realtime Degree Angle Tooltip HUD */}
      {isRotating && <RotationBadge angle={rotationAngle} />}

      {/* 8-Point Resize Handles */}
      {RESIZE_HANDLES.map((handle) => (
        <div
          key={handle.type}
          data-control-handle="true"
          onMouseDown={(e) => onStartResize(e, handle.type)}
          className={`absolute ${handle.className} w-3 h-3 rounded-full bg-white border-2 border-blue-600 shadow-xs ${handle.cursor} z-40 hover:scale-125 transition-transform`}
        />
      ))}
    </>
  );
};
