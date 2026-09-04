import { DocumentExportAdapter } from '../core/export/DocumentExportAdapter';
import type { PureDocument, DocBlock } from '../types';

export function createInitialPureDoc(): PureDocument {
  return {
    id: `doc-${Date.now()}`,
    title: '商业合作框架协议',
    updatedAt: Date.now(),
    blocks: [
      {
        id: 'b-1',
        type: 'heading-1',
        content: '商业合作框架协议',
      },
      {
        id: 'b-2',
        type: 'callout',
        content: '双方在平等自愿、互惠互利的基础上友好协商制定，遵循完全离线与最高隐私保护标准。',
      },
      {
        id: 'b-3',
        type: 'heading-2',
        content: '一、 合作宗旨与原则',
      },
      {
        id: 'b-4',
        type: 'paragraph',
        content: '双方本着“专业严谨、数据自主、本地运算”的原则，共同推进无纸化数字办公标准的落地与实践。',
      },
      {
        id: 'b-5',
        type: 'heading-2',
        content: '二、 交付标准与关键指标',
      },
      {
        id: 'b-6',
        type: 'bullet',
        content: 'PDF 深度图层编辑器：无损矢量擦除、图层级 Redaction 标记',
      },
      {
        id: 'b-7',
        type: 'bullet',
        content: 'Pure Doc & Pure Sheet：Apple Pages 级富文本排版与 Canvas 级表格',
      },
      {
        id: 'b-8',
        type: 'bullet',
        content: '本地离线 OCR：Tesseract.js WebAssembly 纯端侧引擎',
      },
    ],
  };
}

/**
 * Export PureDoc to Markdown string
 */
export function exportDocToMarkdown(doc: PureDocument | any): string {
  return DocumentExportAdapter.exportToMarkdown(doc);
}

/**
 * Export PureDoc to standard Microsoft Word .docx
 */
export async function exportDocToDocx(doc: PureDocument | any): Promise<Blob> {
  return await DocumentExportAdapter.exportToDocx(doc);
}

