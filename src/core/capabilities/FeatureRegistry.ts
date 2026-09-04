export type FeatureStatus = 'implemented' | 'in_development' | 'not_implemented';

export type FeatureCategory = 'file' | 'export' | 'convert' | 'tools' | 'edit';

export interface FeatureCapability {
  id: string;
  name: string;
  category: FeatureCategory;
  status: FeatureStatus;
  enginePath: string;
  isRealUsable: boolean;
  supportedFormats: string[];
  description: string;
  validationCriteria: string;
}

export const FEATURE_CAPABILITY_REGISTRY: Record<string, FeatureCapability> = {
  // === File Base Commands ===
  'save-document': {
    id: 'save-document',
    name: '文档保存',
    category: 'file',
    status: 'implemented',
    enginePath: 'src/core/document/DocumentManager.ts',
    isRealUsable: true,
    supportedFormats: ['.pdf', '.docx', '.xlsx', '.txt'],
    description: '对当前文档进行本地 IndexedDB / LocalStorage 持久化保存，并记录历史快照与版本哈希',
    validationCriteria: '持久化成功写入存储，更新时间戳并生成有效数据快照',
  },
  'new-document': {
    id: 'new-document',
    name: '新建文档',
    category: 'file',
    status: 'implemented',
    enginePath: 'src/utils/docUtils.ts, src/utils/sheetUtils.ts',
    isRealUsable: true,
    supportedFormats: ['.docx', '.xlsx', '.pdf'],
    description: '初始化标准 Doc 结构、Sheet 矩阵或空白 PDF 文档结构',
    validationCriteria: '生成有效的数据模型并载入活跃工作区',
  },
  'open-document': {
    id: 'open-document',
    name: '打开文档',
    category: 'file',
    status: 'implemented',
    enginePath: 'src/core/document/DocumentManager.ts',
    isRealUsable: true,
    supportedFormats: ['.pdf', '.docx', '.xlsx', '.txt', '.md', '.jpg', '.png'],
    description: '调用浏览器标准文件选择器或本地历史，完整解析文档数据流',
    validationCriteria: '成功读取文件 ArrayBuffer，校验文件签名并载入解析器',
  },
  'import-document': {
    id: 'import-document',
    name: '导入文档',
    category: 'file',
    status: 'implemented',
    enginePath: 'src/utils/sheetUtils.ts, src/utils/pdfLibWrapper.ts',
    isRealUsable: true,
    supportedFormats: ['.xlsx', '.docx', '.pdf', '.png', '.jpg'],
    description: '将外部 Excel 工作簿、Word 文档或图片批量导入并转换为当前应用原生格式',
    validationCriteria: '校验导入文件大小 > 0，数据解析无结构损坏',
  },
  'print-document': {
    id: 'print-document',
    name: '打印文档',
    category: 'file',
    status: 'implemented',
    enginePath: 'src/core/execution/FeatureExecutionEngine.ts',
    isRealUsable: true,
    supportedFormats: ['system-print'],
    description: '调起浏览器底层原生高质量打印服务，高保真排版渲染',
    validationCriteria: '成功生成打印流并唤起系统打印预览窗口',
  },
  'document-properties': {
    id: 'document-properties',
    name: '文档属性',
    category: 'file',
    status: 'implemented',
    enginePath: 'src/core/execution/FeatureExecutionEngine.ts',
    isRealUsable: true,
    supportedFormats: ['metadata'],
    description: '实时提取并计算文档体积、页数、字符数、段落数、修改时间及加密状态等元数据',
    validationCriteria: '准确计算并展示当前文档真实属性',
  },

  // === Export Outputs ===
  'export-pdf-standard': {
    id: 'export-pdf-standard',
    name: '导出标准PDF',
    category: 'export',
    status: 'implemented',
    enginePath: 'src/utils/pdfLibWrapper.ts',
    isRealUsable: true,
    supportedFormats: ['.pdf'],
    description: '基于 pdf-lib 纯端侧矢量排版重构，保留所有矢量图形、批注图层与字形嵌入',
    validationCriteria: '生成标准 PDF 二进制流 (Uint8Array/Blob)，文件大小 > 0，页数一致，PDF头校验通过',
  },
  'export-pdf-pdfa': {
    id: 'export-pdf-pdfa',
    name: '导出PDF/A归档PDF',
    category: 'export',
    status: 'implemented',
    enginePath: 'src/utils/pdfExportEngines.ts',
    isRealUsable: true,
    supportedFormats: ['.pdf'],
    description: '符合 ISO 19005 标准的长期电子文档归档格式，嵌入标准化颜色特征与元数据',
    validationCriteria: '生成的 PDF 文件包含合规的 XMP 元数据与色彩配置，文件体积 > 0',
  },
  'export-pdf-scanned': {
    id: 'export-pdf-scanned',
    name: '导出扫描型PDF',
    category: 'export',
    status: 'implemented',
    enginePath: 'src/utils/pdfExportEngines.ts',
    isRealUsable: true,
    supportedFormats: ['.pdf'],
    description: '将文档所有页面渲染为指定 DPI (72-600) 的高精度栅格图像并重新封装，具备防篡改特性并支持可选 OCR 文本层',
    validationCriteria: '生成全栅格化图片型 PDF，文件大小 > 0，每页均包含嵌入图像',
  },
  'export-image-png': {
    id: 'export-image-png',
    name: '导出PNG图片',
    category: 'export',
    status: 'implemented',
    enginePath: 'src/utils/pdfExportEngines.ts, src/components/export/ExportImageModal.tsx',
    isRealUsable: true,
    supportedFormats: ['.png', '.zip'],
    description: '按选定分辨率和 DPI 渲染多页或单页为无损透明通道 PNG 图片，多页时自动打包为 ZIP',
    validationCriteria: 'Blob 类型为 image/png 或 application/zip，字节大小 > 1024 字节',
  },
  'export-image-jpg': {
    id: 'export-image-jpg',
    name: '导出JPG图片',
    category: 'export',
    status: 'implemented',
    enginePath: 'src/utils/pdfExportEngines.ts, src/components/export/ExportImageModal.tsx',
    isRealUsable: true,
    supportedFormats: ['.jpg', '.zip'],
    description: '按指定压缩率将页面渲染为标准 JPEG 相片格式',
    validationCriteria: 'Blob 类型为 image/jpeg 或 application/zip，字节大小 > 1024 字节',
  },
  'export-image-webp': {
    id: 'export-image-webp',
    name: '导出WEBP图片',
    category: 'export',
    status: 'implemented',
    enginePath: 'src/utils/pdfExportEngines.ts, src/components/export/ExportImageModal.tsx',
    isRealUsable: true,
    supportedFormats: ['.webp', '.zip'],
    description: '新一代高效 WebP 格式导出，兼顾极致压缩率与高质量呈现',
    validationCriteria: 'Blob 类型为 image/webp 或 application/zip，字节大小 > 1024 字节',
  },
  'export-long-image': {
    id: 'export-long-image',
    name: '导出长图',
    category: 'export',
    status: 'implemented',
    enginePath: 'src/core/execution/FeatureExecutionEngine.ts',
    isRealUsable: true,
    supportedFormats: ['.png'],
    description: '将文档所有选定页面无缝垂直拼接为一个超高分辨率 Canvas 并导出为单张长图',
    validationCriteria: '生成的 Long Image Blob 尺寸高度等于各页总和，字节大小 > 2048 字节',
  },
  'export-svg': {
    id: 'export-svg',
    name: '导出SVG矢量图',
    category: 'export',
    status: 'implemented',
    enginePath: 'src/core/execution/FeatureExecutionEngine.ts',
    isRealUsable: true,
    supportedFormats: ['.svg'],
    description: '将当前文档或排版图层转换为高保真可缩放矢量 XML (SVG) 文件',
    validationCriteria: '生成包含标准 <svg> 与 <text>/<path> 节点的有效 XML Blob，文件大小 > 0',
  },
  'export-text-txt': {
    id: 'export-text-txt',
    name: '导出TXT纯文本',
    category: 'export',
    status: 'implemented',
    enginePath: 'src/core/execution/FeatureExecutionEngine.ts',
    isRealUsable: true,
    supportedFormats: ['.txt'],
    description: '逐段或逐页提取文档的纯文本字符流并保存为 UTF-8 编码文本文件',
    validationCriteria: 'Blob 编码为 text/plain;charset=utf-8，且内容长度与文档字符一致',
  },
  'export-text-markdown': {
    id: 'export-text-markdown',
    name: '导出Markdown',
    category: 'export',
    status: 'implemented',
    enginePath: 'src/utils/docUtils.ts, src/core/execution/FeatureExecutionEngine.ts',
    isRealUsable: true,
    supportedFormats: ['.md'],
    description: '结构化提取文档标题层级、引用块、列表与表格，输出符合 CommonMark 标准的 Markdown',
    validationCriteria: '生成的 Markdown 文本包含有效的 Heading 与 Block 语法，体积 > 0',
  },
  'export-text-html': {
    id: 'export-text-html',
    name: '导出HTML超文本',
    category: 'export',
    status: 'implemented',
    enginePath: 'src/core/execution/FeatureExecutionEngine.ts',
    isRealUsable: true,
    supportedFormats: ['.html'],
    description: '将文档转换为结构清晰、包含内联样式与现代 CSS 排版的独立 HTML 网页文件',
    validationCriteria: '包含完整 <!DOCTYPE html> 结构且排版样式闭合，体积 > 0',
  },

  // === Conversions ===
  'convert-word': {
    id: 'convert-word',
    name: '转换为 Word (.docx)',
    category: 'convert',
    status: 'implemented',
    enginePath: 'src/utils/pdfExportEngines.ts, src/utils/docUtils.ts',
    isRealUsable: true,
    supportedFormats: ['.docx'],
    description: '深度解析 PDF / Doc 文本坐标与字体字号，使用 docx.js 重建原生段落、标题与排版结构',
    validationCriteria: '生成合法 Office OpenXML DOCX Blob，支持 Microsoft Word / WPS / Pages 完美打开',
  },
  'convert-excel': {
    id: 'convert-excel',
    name: '转换为 Excel (.xlsx)',
    category: 'convert',
    status: 'implemented',
    enginePath: 'src/utils/pdfExportEngines.ts, src/utils/sheetUtils.ts',
    isRealUsable: true,
    supportedFormats: ['.xlsx'],
    description: '结构化抽取 PDF 页面表格数据或导出当前 Pure Sheet 工作簿为标准 XLSX 文件',
    validationCriteria: '生成合法的 OpenXML XLSX Blob，包含所有工作表与有效单元格矩阵',
  },
  'convert-ppt': {
    id: 'convert-ppt',
    name: '转换为 PPT (.pptx)',
    category: 'convert',
    status: 'in_development',
    enginePath: 'src/core/execution/FeatureExecutionEngine.ts',
    isRealUsable: false,
    supportedFormats: ['.pptx'],
    description: '多页版式幻灯片矢量转换引擎（目前处于内核研发阶段，UI 提供状态感知提示）',
    validationCriteria: 'PPTX 矢量版式引擎开发中，UI 明确标注开发中状态',
  },
  'convert-ocr': {
    id: 'convert-ocr',
    name: 'OCR 离线文字识别',
    category: 'convert',
    status: 'implemented',
    enginePath: 'src/utils/ocrEngine.ts',
    isRealUsable: true,
    supportedFormats: ['.txt', '.json'],
    description: '基于 Tesseract.js WebAssembly 纯端侧引擎，提供高精度中英文离线 OCR 文本识别与坐标提取',
    validationCriteria: '返回识别置信度、文本行及包围框坐标，提取文本真实有效',
  },

  // === Tools ===
  'pdf-watermark': {
    id: 'pdf-watermark',
    name: 'PDF 水印引擎',
    category: 'tools',
    status: 'implemented',
    enginePath: 'src/utils/pdfExportEngines.ts, src/utils/watermarkEngine.ts',
    isRealUsable: true,
    supportedFormats: ['.pdf'],
    description: '支持单/平铺中文全字符文本水印或图片水印烙印，以及电子水印智能识别与精准擦除',
    validationCriteria: '生成新的 PDF 二进制流，水印图层已烘焙或移除',
  },
  'pdf-compress': {
    id: 'pdf-compress',
    name: 'PDF 智能压缩',
    category: 'tools',
    status: 'implemented',
    enginePath: 'src/core/execution/FeatureExecutionEngine.ts',
    isRealUsable: true,
    supportedFormats: ['.pdf'],
    description: '对 PDF 中的内嵌高分辨率图片进行重新编码降采样与流压缩，真实减少文件体积',
    validationCriteria: '压缩后文件体积严格低于原文件（或体积已最优时明确提示无冗余）',
  },
  'pdf-merge': {
    id: 'pdf-merge',
    name: 'PDF 多文档合并',
    category: 'tools',
    status: 'implemented',
    enginePath: 'src/utils/pdfLibWrapper.ts',
    isRealUsable: true,
    supportedFormats: ['.pdf'],
    description: '将多个独立 PDF 文档按顺序组合为单一连续 PDF 文件',
    validationCriteria: '总页数精确等于各输入文档页数之和',
  },
  'pdf-split': {
    id: 'pdf-split',
    name: 'PDF 页面拆分',
    category: 'tools',
    status: 'implemented',
    enginePath: 'src/utils/pdfLibWrapper.ts',
    isRealUsable: true,
    supportedFormats: ['.zip', '.pdf'],
    description: '按指定页码范围（如 1-3, 5）精确拆分并打包为独立 PDF 或 ZIP 压缩包',
    validationCriteria: '生成的拆分文件页码与指定规则严格对应',
  },
};

/**
 * Helper to query capability by ID
 */
export function getFeatureCapability(id: string): FeatureCapability | undefined {
  return FEATURE_CAPABILITY_REGISTRY[id];
}

/**
 * Check if a feature is fully implemented and genuinely executable
 */
export function isFeatureExecutable(id: string): boolean {
  const cap = FEATURE_CAPABILITY_REGISTRY[id];
  return Boolean(cap && cap.status === 'implemented' && cap.isRealUsable);
}

/**
 * Get all capabilities by category
 */
export function getCapabilitiesByCategory(category: FeatureCategory): FeatureCapability[] {
  return Object.values(FEATURE_CAPABILITY_REGISTRY).filter((c) => c.category === category);
}
