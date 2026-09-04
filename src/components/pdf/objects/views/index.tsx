import React from 'react';
import { TextObjectView } from './TextObjectView';
import { ImageObjectView } from './ImageObjectView';
import { StampObjectView } from './StampObjectView';
import { WatermarkObjectView } from './WatermarkObjectView';
import { ShapeObjectView } from './ShapeObjectView';
import { SignatureObjectView } from './SignatureObjectView';
import { MeasureObjectView } from './MeasureObjectView';
import { DrawObjectView } from './DrawObjectView';
import { CommentObjectView } from './CommentObjectView';
import { RedactObjectView } from './RedactObjectView';
import { EraserMaskObjectView } from './EraserMaskObjectView';
import { FormFieldObjectView } from './FormFieldObjectView';
import { HighlightObjectView } from './HighlightObjectView';
import { PDFUnifiedObject } from '../../../../types/pdfObject';

export * from './TextObjectView';
export * from './ImageObjectView';
export * from './StampObjectView';
export * from './WatermarkObjectView';
export * from './ShapeObjectView';
export * from './SignatureObjectView';
export * from './MeasureObjectView';
export * from './DrawObjectView';
export * from './CommentObjectView';
export * from './RedactObjectView';
export * from './EraserMaskObjectView';
export * from './FormFieldObjectView';
export * from './HighlightObjectView';

export interface ObjectViewDispatcherProps {
  object: PDFUnifiedObject;
  zoom: number;
  onStartTextEdit?: (id: string) => void;
}

/**
 * ObjectViewDispatcher
 * 纯分发渲染器：根据 object.type 映射至对应的纯展示 View。
 * 遵循 Phase 3 架构设计：所有 View 组件仅负责自身视觉外观与样式，
 * 绝不承载拖拽、拉伸、旋转、删除或图层等通用交互。
 */
export const ObjectViewDispatcher: React.FC<ObjectViewDispatcherProps> = React.memo(
  ({ object, zoom, onStartTextEdit }) => {
    switch (object.type) {
      case 'text':
        return (
          <TextObjectView
            object={object}
            zoom={zoom}
            onDoubleClick={() => onStartTextEdit?.(object.id)}
          />
        );

      case 'image':
        return <ImageObjectView object={object} zoom={zoom} />;

      case 'stamp':
        return <StampObjectView object={object} zoom={zoom} />;

      case 'watermark':
        return <WatermarkObjectView object={object} zoom={zoom} />;

      case 'shape':
        return <ShapeObjectView object={object} zoom={zoom} />;

      case 'signature':
        return <SignatureObjectView object={object} />;

      case 'measurement':
        return <MeasureObjectView object={object} />;

      case 'draw':
        return <DrawObjectView object={object} zoom={zoom} />;

      case 'comment':
        return <CommentObjectView object={object} />;

      case 'redact':
        return <RedactObjectView object={object} />;

      case 'eraser-mask':
        return <EraserMaskObjectView object={object} />;

      case 'form-field':
        return <FormFieldObjectView object={object} />;

      case 'highlight':
        return <HighlightObjectView object={object} />;

      default:
        // 兜底容错
        return (
          <div className="w-full h-full flex items-center justify-center border border-dashed border-neutral-300 text-[10px] text-neutral-400">
            <span>{(object as any).type}</span>
          </div>
        );
    }
  }
);
