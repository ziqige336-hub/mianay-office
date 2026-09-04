import React from 'react';

export interface StampObjectViewProps {
  object: {
    id: string;
    stampType?: string;
    customText?: string;
    color?: string;
    dataUrl?: string;
  };
  zoom: number;
}

/**
 * StampObjectView
 * 纯展示组件：负责印章（图片印章或经典矢量办公印章）的视觉呈现。
 * 严禁包含任何拖动、缩放、旋转或删除等交互逻辑。
 */
export const StampObjectView: React.FC<StampObjectViewProps> = ({ object, zoom }) => {
  // 1. 如果包含位图印章数据
  if (object.dataUrl) {
    return (
      <img
        src={object.dataUrl}
        alt="Stamp"
        className="w-full h-full object-contain pointer-events-none select-none"
        draggable={false}
      />
    );
  }

  // 2. 经典办公文字印章矢量渲染
  const primaryColor = object.color || '#ef4444';
  const text = object.customText || object.stampType || 'APPROVED';
  const fontSize = Math.max(10, 13 * zoom);

  return (
    <div
      className="w-full h-full flex items-center justify-center font-black tracking-widest uppercase border-2 rounded-lg backdrop-blur-xs select-none pointer-events-none p-1"
      style={{
        borderColor: primaryColor,
        color: primaryColor,
        fontSize: `${fontSize}px`,
        backgroundColor: `${primaryColor}15`,
      }}
    >
      <div
        className="w-full h-full border border-dashed rounded-md flex items-center justify-center text-center px-1"
        style={{ borderColor: `${primaryColor}80` }}
      >
        <span className="truncate">{text}</span>
      </div>
    </div>
  );
};
