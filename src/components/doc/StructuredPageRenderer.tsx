import React from 'react';
import type { StructuredDocNode, FormattedRun, DocTableCell } from '../../types';

interface StructuredPageRendererProps {
  blocks: StructuredDocNode[];
  margin?: 'normal' | 'narrow' | 'wide';
  onBlockClick?: (block: StructuredDocNode, index: number) => void;
}

export const StructuredPageRenderer: React.FC<StructuredPageRendererProps> = ({
  blocks,
  onBlockClick,
}) => {
  if (!blocks || blocks.length === 0) {
    return <div className="text-slate-400 dark:text-slate-500 italic py-2">（空白页面）</div>;
  }

  const renderRun = (run: FormattedRun, rIdx: number) => {
    let style: React.CSSProperties = {};
    if (run.color) style.color = run.color.startsWith('#') ? run.color : `#${run.color}`;
    if (run.fontFamily) style.fontFamily = run.fontFamily;
    if (run.size) style.fontSize = `${run.size}pt`;
    if (run.highlight) style.backgroundColor = run.highlight.startsWith('#') ? run.highlight : `#${run.highlight}`;

    let content: React.ReactNode = run.text;
    if (run.bold) content = <strong>{content}</strong>;
    if (run.italic) content = <em>{content}</em>;
    if (run.underline) content = <u>{content}</u>;
    if (run.strike) content = <s>{content}</s>;
    if (run.subscript) content = <sub>{content}</sub>;
    if (run.superscript) content = <sup>{content}</sup>;

    return (
      <span key={rIdx} style={style}>
        {content}
      </span>
    );
  };

  const renderTableCell = (cell: DocTableCell, cIdx: number, isHeaderRow: boolean) => {
    const Tag = isHeaderRow || cell.bold ? 'th' : 'td';
    const bg = cell.bg ? (cell.bg.startsWith('#') ? cell.bg : `#${cell.bg}`) : isHeaderRow ? '#f8fafc' : undefined;

    return (
      <Tag
        key={cIdx}
        colSpan={cell.colSpan}
        rowSpan={cell.rowSpan}
        style={{ backgroundColor: bg }}
        className={`border border-slate-300 dark:border-slate-700 px-3 py-2 text-left text-sm ${
          isHeaderRow || cell.bold ? 'font-semibold text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-200'
        }`}
      >
        {cell.runs && cell.runs.length > 0 ? (
          cell.runs.map((r, idx) => renderRun(r, idx))
        ) : (
          <span>{cell.text}</span>
        )}
      </Tag>
    );
  };

  return (
    <div className="space-y-3.5 text-[15px] leading-relaxed text-slate-800 dark:text-slate-100 font-normal">
      {blocks.map((block, bIdx) => {
        const alignClass =
          block.align === 'center'
            ? 'text-center'
            : block.align === 'right'
            ? 'text-right'
            : block.align === 'justify'
            ? 'text-justify'
            : 'text-left';

        switch (block.type) {
          case 'heading': {
            const level = block.level || 1;
            const headingClasses: Record<number, string> = {
              1: 'text-2xl font-bold text-slate-900 dark:text-slate-50 mt-6 mb-3 tracking-tight',
              2: 'text-xl font-bold text-slate-900 dark:text-slate-100 mt-5 mb-2.5 tracking-tight',
              3: 'text-lg font-semibold text-slate-800 dark:text-slate-200 mt-4 mb-2',
              4: 'text-base font-semibold text-slate-800 dark:text-slate-200 mt-3 mb-1.5',
              5: 'text-sm font-semibold text-slate-800 dark:text-slate-200 mt-2 mb-1',
              6: 'text-xs font-semibold text-slate-700 dark:text-slate-300 mt-2 mb-1',
            };
            const Tag = (level === 1 ? 'h1' : level === 2 ? 'h2' : level === 3 ? 'h3' : level === 4 ? 'h4' : level === 5 ? 'h5' : 'h6') as React.ElementType;
            return (
              <Tag
                key={bIdx}
                className={`${headingClasses[level] || headingClasses[1]} ${alignClass}`}
                onClick={() => onBlockClick?.(block, bIdx)}
              >
                {block.runs && block.runs.map((r, rIdx) => renderRun(r, rIdx))}
              </Tag>
            );
          }

          case 'paragraph': {
            const isEmpty = !block.runs || block.runs.length === 0 || block.runs.every((r) => !r.text || r.text.trim().length === 0);
            if (isEmpty) {
              return <div key={bIdx} className="h-4" />;
            }
            return (
              <p
                key={bIdx}
                className={`my-2 ${alignClass}`}
                onClick={() => onBlockClick?.(block, bIdx)}
              >
                {block.runs.map((r, rIdx) => renderRun(r, rIdx))}
              </p>
            );
          }

          case 'bullet': {
            return (
              <div
                key={bIdx}
                className="flex items-start gap-2.5 my-1.5 ml-4"
                onClick={() => onBlockClick?.(block, bIdx)}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600 dark:bg-slate-300 mt-2 shrink-0" />
                <div className="flex-1">{block.runs.map((r, rIdx) => renderRun(r, rIdx))}</div>
              </div>
            );
          }

          case 'ordered': {
            return (
              <div
                key={bIdx}
                className="flex items-start gap-2.5 my-1.5 ml-4"
                onClick={() => onBlockClick?.(block, bIdx)}
              >
                <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 mt-0.5 shrink-0 select-none">
                  {bIdx + 1}.
                </span>
                <div className="flex-1">{block.runs.map((r, rIdx) => renderRun(r, rIdx))}</div>
              </div>
            );
          }

          case 'quote': {
            return (
              <blockquote
                key={bIdx}
                className="border-l-4 border-blue-500 pl-4 py-1.5 my-3 italic text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 rounded-r-md"
                onClick={() => onBlockClick?.(block, bIdx)}
              >
                {block.runs.map((r, rIdx) => renderRun(r, rIdx))}
              </blockquote>
            );
          }

          case 'code': {
            const codeText = block.runs.map((r) => r.text).join('');
            return (
              <pre
                key={bIdx}
                className="p-3.5 my-3 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto border border-slate-800"
                onClick={() => onBlockClick?.(block, bIdx)}
              >
                <code>{codeText}</code>
              </pre>
            );
          }

          case 'divider': {
            return <hr key={bIdx} className="my-5 border-t border-slate-200 dark:border-slate-700" />;
          }

          case 'image': {
            if (!block.imageData?.src) return null;
            return (
              <div key={bIdx} className="my-4 flex justify-center">
                <img
                  src={block.imageData.src}
                  alt={block.imageData.alt || 'Document Image'}
                  style={{
                    maxWidth: block.imageData.width ? `${block.imageData.width}px` : '100%',
                    maxHeight: block.imageData.height ? `${block.imageData.height}px` : '400px',
                  }}
                  className="rounded-lg shadow-md object-contain border border-slate-200 dark:border-slate-700"
                />
              </div>
            );
          }

          case 'table': {
            if (!block.tableData || !Array.isArray(block.tableData.rows) || block.tableData.rows.length === 0) {
              return null;
            }
            return (
              <div key={bIdx} className="my-4 overflow-x-auto">
                <table className="w-full border-collapse border border-slate-300 dark:border-slate-700 text-sm shadow-2xs rounded-sm">
                  <tbody>
                    {block.tableData.rows.map((row, rIdx) => (
                      <tr key={rIdx} className={rIdx === 0 ? 'bg-slate-50 dark:bg-slate-800/80 font-medium' : ''}>
                        {row.map((cell, cIdx) => renderTableCell(cell, cIdx, rIdx === 0))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }

          default:
            return null;
        }
      })}
    </div>
  );
};
