import React from 'react';

export interface HighlightObjectViewProps {
  object: {
    id: string;
    color?: string;
    opacity?: number;
  };
}

export const HighlightObjectView: React.FC<HighlightObjectViewProps> = ({ object }) => {
  return (
    <div
      className="w-full h-full rounded-xs pointer-events-none select-none"
      style={{
        backgroundColor: object.color || '#fef08a',
        opacity: object.opacity ?? 0.45,
      }}
    />
  );
};
