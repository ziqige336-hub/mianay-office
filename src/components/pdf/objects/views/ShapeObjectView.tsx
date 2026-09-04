import React from 'react';

export interface ShapeObjectViewProps {
  object: {
    id: string;
    shapeType: 'rect' | 'circle' | 'line' | 'arrow' | 'table';
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
    strokeDash?: 'solid' | 'dashed';
    opacity?: number;
    rows?: number;
    cols?: number;
  };
  zoom?: number;
}

/**
 * ShapeObjectView
 * 纯展示组件：负责矢量几何图形（矩形、椭圆、直线、箭头、表格）的 SVG 呈现。
 * 严禁包含任何拖动、缩放、旋转或删除等交互逻辑。
 */
export const ShapeObjectView: React.FC<ShapeObjectViewProps> = ({ object }) => {
  const {
    id,
    shapeType,
    fillColor = 'transparent',
    strokeColor = '#2563eb',
    strokeWidth = 2,
    strokeDash = 'solid',
    opacity = 1.0,
    rows = 3,
    cols = 3,
  } = object;

  const dashArray = strokeDash === 'dashed' ? '5,5' : undefined;

  return (
    <div
      className="w-full h-full pointer-events-none select-none relative overflow-visible"
      style={{ opacity }}
    >
      <svg className="w-full h-full overflow-visible pointer-events-none">
        {shapeType === 'rect' && (
          <rect
            x="2"
            y="2"
            width="96%"
            height="96%"
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={dashArray}
            rx="4"
          />
        )}

        {shapeType === 'circle' && (
          <ellipse
            cx="50%"
            cy="50%"
            rx="48%"
            ry="48%"
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={dashArray}
          />
        )}

        {shapeType === 'line' && (
          <line
            x1="2%"
            y1="50%"
            x2="98%"
            y2="50%"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={dashArray}
          />
        )}

        {shapeType === 'arrow' && (
          <>
            <defs>
              <marker
                id={`arrow-${id}`}
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill={strokeColor} />
              </marker>
            </defs>
            <line
              x1="3%"
              y1="50%"
              x2="95%"
              y2="50%"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeDasharray={dashArray}
              markerEnd={`url(#arrow-${id})`}
            />
          </>
        )}

        {shapeType === 'table' && (
          <g>
            <rect
              x="1"
              y="1"
              width="98%"
              height="98%"
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
            />
            {/* 内部分隔水平线 */}
            {Array.from({ length: rows - 1 }).map((_, rIdx) => {
              const yPct = ((rIdx + 1) / rows) * 100;
              return (
                <line
                  key={`h-${rIdx}`}
                  x1="1%"
                  y1={`${yPct}%`}
                  x2="99%"
                  y2={`${yPct}%`}
                  stroke={strokeColor}
                  strokeWidth={1}
                />
              );
            })}
            {/* 内部分隔垂直线 */}
            {Array.from({ length: cols - 1 }).map((_, cIdx) => {
              const xPct = ((cIdx + 1) / cols) * 100;
              return (
                <line
                  key={`v-${cIdx}`}
                  x1={`${xPct}%`}
                  y1="1%"
                  x2={`${xPct}%`}
                  y2="99%"
                  stroke={strokeColor}
                  strokeWidth={1}
                />
              );
            })}
          </g>
        )}
      </svg>
    </div>
  );
};
