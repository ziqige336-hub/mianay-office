import React from 'react';

export interface TextObjectViewProps {
  object: {
    id: string;
    text?: string;
    fontSize?: number;
    fontFamily?: string;
    color?: string;
    backgroundColor?: string;
    isBold?: boolean;
    isItalic?: boolean;
    isUnderline?: boolean;
    isStrikethrough?: boolean;
    textAlign?: 'left' | 'center' | 'right';
    isOriginalReplacement?: boolean;
  };
  zoom: number;
  onDoubleClick?: () => void;
}

/**
 * TextObjectView
 * 纯展示组件：只负责文字对象的排版渲染与样式计算。
 * 严禁包含任何拖动、缩放、旋转或删除等交互逻辑。
 */
export const TextObjectView: React.FC<TextObjectViewProps> = ({
  object,
  zoom,
  onDoubleClick,
}) => {
  const text = object.text ?? '';
  const fontSize = (object.fontSize || 14) * zoom;
  const fontFamily = object.fontFamily || 'Helvetica, Arial, sans-serif';
  const color = object.color || '#000000';
  const backgroundColor =
    object.backgroundColor && object.backgroundColor !== 'transparent'
      ? object.backgroundColor
      : object.isOriginalReplacement
      ? '#ffffff'
      : 'transparent';

  const textDecorations: string[] = [];
  if (object.isUnderline) textDecorations.push('underline');
  if (object.isStrikethrough) textDecorations.push('line-through');

  const justifyContent =
    object.textAlign === 'center'
      ? 'center'
      : object.textAlign === 'right'
      ? 'flex-end'
      : 'flex-start';

  return (
    <div
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick?.();
      }}
      className="w-full h-full flex items-center select-none cursor-text px-1 py-0.5 overflow-hidden"
      style={{
        fontSize: `${fontSize}px`,
        fontFamily,
        color,
        fontWeight: object.isBold ? 'bold' : 'normal',
        fontStyle: object.isItalic ? 'italic' : 'normal',
        textDecoration: textDecorations.length > 0 ? textDecorations.join(' ') : 'none',
        backgroundColor,
        justifyContent,
        lineHeight: 1.3,
        wordBreak: 'break-word',
        whiteSpace: 'pre-wrap',
      }}
      title="双击进入文本编辑"
    >
      {text}
    </div>
  );
};
