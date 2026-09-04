import React from 'react';

interface MianayLogoProps {
  className?: string;
  size?: number | string;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

export const MianayLogo: React.FC<MianayLogoProps> = ({
  className = '',
  size = 24,
  rounded = 'md',
}) => {
  const roundedClass = {
    none: 'rounded-none',
    sm: 'rounded-[5px]',
    md: 'rounded-[6px]',
    lg: 'rounded-[8px]',
    xl: 'rounded-xl',
    '2xl': 'rounded-2xl',
    full: 'rounded-full',
  }[rounded] || 'rounded-[6px]';

  const dimensionStyle =
    typeof size === 'number'
      ? { width: `${size}px`, height: `${size}px` }
      : { width: size, height: size };

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 overflow-hidden bg-[#0076FE] shadow-2xs select-none ${roundedClass} ${className}`}
      style={dimensionStyle}
      aria-label="Mianay Office Logo"
      role="img"
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full rounded-[inherit] overflow-hidden"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Left horizontal stroke with precision diagonal slit */}
        <polygon points="14,19 47.2,19 45.0,23.4 14,23.4" fill="#FFFFFF" />
        {/* Right horizontal stroke and vertical stem with parallel diagonal slit */}
        <polygon
          points="50.8,19 86,19 86,23.4 53.0,23.4 53.0,84.8 48.6,84.8 48.6,23.4"
          fill="#FFFFFF"
        />
      </svg>
    </div>
  );
};
