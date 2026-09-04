import React from 'react';

export interface SignatureObjectViewProps {
  object: {
    id: string;
    dataUrl?: string;
  };
}

export const SignatureObjectView: React.FC<SignatureObjectViewProps> = ({ object }) => {
  return (
    <img
      src={object.dataUrl || ''}
      alt="Signature"
      className="w-full h-full object-contain pointer-events-none select-none"
      draggable={false}
    />
  );
};
