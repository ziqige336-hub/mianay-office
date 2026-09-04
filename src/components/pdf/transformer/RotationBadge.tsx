import React from 'react';

export interface RotationBadgeProps {
  angle: number;
  className?: string;
}

export const RotationBadge: React.FC<RotationBadgeProps> = ({ angle, className = '' }) => {
  const normalized = ((angle % 360) + 360) % 360;

  return (
    <div
      data-action-hud="true"
      className={`absolute -top-12 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-neutral-900/90 dark:bg-neutral-100/90 text-white dark:text-neutral-900 text-xs font-mono font-medium tracking-tight shadow-xl backdrop-blur-md z-50 pointer-events-none select-none flex items-center space-x-1 border border-white/20 dark:border-black/10 transition-all ${className}`}
    >
      <span>{normalized}°</span>
    </div>
  );
};
