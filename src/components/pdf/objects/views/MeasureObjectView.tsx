import React from 'react';
import { Ruler } from 'lucide-react';

export interface MeasureObjectViewProps {
  object: {
    id: string;
    valueText?: string;
    unit?: string;
  };
}

export const MeasureObjectView: React.FC<MeasureObjectViewProps> = ({ object }) => {
  return (
    <div className="w-full h-full relative pointer-events-none select-none">
      <svg className="w-full h-full overflow-visible pointer-events-none">
        <line
          x1="4%"
          y1="50%"
          x2="96%"
          y2="50%"
          stroke="#0284c7"
          strokeWidth={2}
          strokeDasharray="4 2"
        />
        <circle cx="4%" cy="50%" r="3" fill="#0284c7" />
        <circle cx="96%" cy="50%" r="3" fill="#0284c7" />
      </svg>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/95 dark:bg-neutral-800/95 border border-sky-500/40 rounded-full px-2 py-0.5 text-[11px] font-mono text-sky-700 dark:text-sky-300 shadow-xs whitespace-nowrap flex items-center space-x-1">
        <Ruler className="w-3 h-3 text-sky-600" />
        <span>{object.valueText || '0.0 mm'}</span>
      </div>
    </div>
  );
};
