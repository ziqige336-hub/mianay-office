import React from 'react';

export interface EraserMaskObjectViewProps {
  object: {
    id: string;
    fillColor?: string;
  };
}

export const EraserMaskObjectView: React.FC<EraserMaskObjectViewProps> = ({ object }) => {
  return (
    <div
      className="w-full h-full rounded-xs shadow-xs pointer-events-none select-none"
      style={{
        backgroundColor: object.fillColor || '#ffffff',
      }}
    />
  );
};
