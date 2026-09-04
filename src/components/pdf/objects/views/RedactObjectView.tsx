import React from 'react';

export interface RedactObjectViewProps {
  object: {
    id: string;
    fillColor?: string;
    overlayText?: string;
  };
}

export const RedactObjectView: React.FC<RedactObjectViewProps> = ({ object }) => {
  return (
    <div
      className="w-full h-full flex items-center justify-center text-[10px] text-white font-mono rounded-xs pointer-events-none select-none"
      style={{
        backgroundColor: object.fillColor || '#000000',
      }}
    >
      <span>{object.overlayText || ''}</span>
    </div>
  );
};
