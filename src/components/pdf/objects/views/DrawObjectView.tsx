import React from 'react';

export interface DrawObjectViewProps {
  object: {
    id: string;
    points?: { x: number; y: number }[];
    color?: string;
    strokeWidth?: number;
  };
  zoom?: number;
}

export const DrawObjectView: React.FC<DrawObjectViewProps> = ({ object, zoom = 1.0 }) => {
  const points = object.points || [];
  const color = object.color || '#dc2626';
  const strokeWidth = Math.max(1.5, (object.strokeWidth || 2.5) * zoom);

  return (
    <svg className="w-full h-full pointer-events-none select-none overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points.map((p) => `${p.x}%,${p.y}%`).join(' ')}
      />
    </svg>
  );
};
