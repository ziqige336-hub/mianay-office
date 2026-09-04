import React from 'react';
import { PDFImageCropRect } from '../../../../types/pdfObject';

export interface ImageObjectViewProps {
  object: {
    id: string;
    dataUrl?: string;
    cropRect?: PDFImageCropRect;
    crop?: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
    aspectRatioLocked?: boolean;
    filter?: string;
  };
  zoom?: number;
}

/**
 * ImageObjectView
 * 纯展示组件：负责高保真渲染图像位图与基于 cropRect 的非破坏性视口遮罩。
 * 严禁包含任何拖动、缩放、旋转或删除等交互逻辑。
 */
export const ImageObjectView: React.FC<ImageObjectViewProps> = ({ object }) => {
  const dataUrl = object.dataUrl || '';

  if (!dataUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 text-neutral-400 text-xs select-none rounded-sm">
        <span>无图像数据</span>
      </div>
    );
  }

  // 1. 标准非破坏性 cropRect（百分比 0-100%）
  const cropRect = object.cropRect;
  const hasCrop =
    cropRect &&
    (cropRect.x > 0 ||
      cropRect.y > 0 ||
      cropRect.width < 100 ||
      cropRect.height < 100);

  if (hasCrop && cropRect) {
    const safeW = Math.max(1, cropRect.width);
    const safeH = Math.max(1, cropRect.height);

    const innerLeft = `${-(cropRect.x / safeW) * 100}%`;
    const innerTop = `${-(cropRect.y / safeH) * 100}%`;
    const innerWidth = `${(100 / safeW) * 100}%`;
    const innerHeight = `${(100 / safeH) * 100}%`;

    return (
      <div className="w-full h-full relative overflow-hidden pointer-events-none select-none">
        <img
          src={dataUrl}
          alt="PDF Object"
          className="absolute block pointer-events-none select-none"
          draggable={false}
          style={{
            left: innerLeft,
            top: innerTop,
            width: innerWidth,
            height: innerHeight,
            maxWidth: 'none',
            maxHeight: 'none',
            filter: object.filter || 'none',
          }}
        />
      </div>
    );
  }

  // 2. 传统 inset crop 兜底兼容
  if (object.crop) {
    return (
      <div
        className="w-full h-full relative overflow-hidden pointer-events-none select-none"
        style={{
          clipPath: `inset(${object.crop.top}% ${object.crop.right}% ${object.crop.bottom}% ${object.crop.left}%)`,
        }}
      >
        <img
          src={dataUrl}
          alt="PDF Object"
          className="w-full h-full object-contain pointer-events-none select-none"
          draggable={false}
          style={{ filter: object.filter || 'none' }}
        />
      </div>
    );
  }

  // 3. 无裁剪完整图像渲染
  return (
    <div className="w-full h-full relative overflow-hidden pointer-events-none select-none">
      <img
        src={dataUrl}
        alt="PDF Object"
        className="w-full h-full object-contain pointer-events-none select-none block"
        draggable={false}
        style={{
          filter: object.filter || 'none',
        }}
      />
    </div>
  );
};
