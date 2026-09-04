import React from 'react';

export interface WatermarkObjectViewProps {
  object: {
    id: string;
    watermarkType?: 'text' | 'image';
    text?: string;
    imageUrl?: string;
    fontSize?: number;
    fontFamily?: string;
    color?: string;
    opacity?: number;
  };
  zoom: number;
}

/**
 * WatermarkObjectView
 * 纯展示组件：负责防伪防泄密水印（文本水印或图片水印）的半透明呈现。
 * 严禁包含任何拖动、缩放、旋转或删除等交互逻辑。
 */
export const WatermarkObjectView: React.FC<WatermarkObjectViewProps> = ({ object, zoom }) => {
  // 1. 图片类型水印
  if (object.watermarkType === 'image' && object.imageUrl) {
    return (
      <img
        src={object.imageUrl}
        alt="Watermark"
        className="w-full h-full object-contain pointer-events-none select-none"
        draggable={false}
        style={{
          opacity: object.opacity ?? 0.25,
        }}
      />
    );
  }

  // 2. 文本类型水印
  const text = object.text || 'CONFIDENTIAL';
  const fontSize = (object.fontSize || 24) * zoom;
  const fontFamily = object.fontFamily || 'Helvetica, Arial, sans-serif';
  const color = object.color || 'rgba(0, 0, 0, 0.15)';
  const opacity = object.opacity ?? 0.25;

  return (
    <div
      className="w-full h-full flex items-center justify-center font-bold tracking-wider select-none pointer-events-none text-center"
      style={{
        fontSize: `${fontSize}px`,
        fontFamily,
        color,
        opacity,
        lineHeight: 1.2,
      }}
    >
      <span className="truncate">{text}</span>
    </div>
  );
};
