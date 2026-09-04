import type { OfficeFile, FileType, VersionHistoryItem, WorkbookData, SheetData } from '../types';
import { createInitialSheet } from './sheetUtils';

const STORAGE_KEY = 'lumina_office_files_v3';

/**
 * Sanitize document content to eliminate corrupted duplicates and clamp page counts
 */
function sanitizeOfficeFile(file: OfficeFile): OfficeFile {
  let content = file.content;
  if (file.id === 'doc-default-1') {
    // If doc-default-1 has duplicate H1s or is corrupted, reset to standard clean content
    if (typeof content === 'string') {
      const h1Count = (content.match(/<h1[^>]*>/gi) || []).length;
      if (h1Count > 1) {
        content = DEFAULT_DOC_HTML;
      }
    } else if (typeof content === 'object' && content?.type === 'doc' && Array.isArray(content.content)) {
      const h1Nodes = content.content.filter((n: any) => n.type === 'heading' && (!n.attrs || n.attrs.level === 1));
      if (h1Nodes.length > 1) {
        content = DEFAULT_DOC_HTML;
      }
    }
  }

  // Ensure no runaway page count or inflated page arrays remain in file payload
  if (typeof content === 'object' && content !== null) {
    if ('pageCount' in content && typeof content.pageCount === 'number' && content.pageCount > 1) {
      content.pageCount = 1;
    }
    if ('pages' in content && Array.isArray(content.pages) && content.pages.length > 1) {
      content.pages = content.pages.slice(0, 1);
    }
  }

  return {
    ...file,
    content,
  };
}

const DEFAULT_DOC_HTML = `
<h1>商业合作战略框架协议</h1>
<p>本协议由双方在平等自愿、互惠互利的基础上友好协商制定，旨在确立长期稳定的战略协同伙伴关系。</p>
<h2>一、 合作宗旨与原则</h2>
<p>双方本着<strong>“专业严谨、数据自主、本地运算”</strong>的原则，共同推进无纸化数字办公标准的落地与实践。所有文档及数据交换遵循完全离线与最高隐私保护标准。</p>
<h2>二、 交付标准与关键指标</h2>
<table>
  <thead>
    <tr>
      <th>阶段里程碑</th>
      <th>交付物类型</th>
      <th>验收标准</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Phase 1</td>
      <td>PDF 深度图层编辑器</td>
      <td>无损矢量擦除、图层级 Redaction 标记、多页调度</td>
    </tr>
    <tr>
      <td>Phase 2</td>
      <td>Pure Doc / Pure Sheet</td>
      <td>Apple Pages 级富文本排版与 Canvas 表格、公式计算</td>
    </tr>
    <tr>
      <td>Phase 3</td>
      <td>本地离线 OCR</td>
      <td>Tesseract.js WebAssembly 纯端侧引擎</td>
    </tr>
  </tbody>
</table>
<blockquote>“大道至简，实干为要。以极致的工匠精神打造安静专注的生产力工具。”</blockquote>
<p>双方授权代表已于文末完成电子签名确认。</p>
`;

function createDefaultWorkbook(): WorkbookData {
  const initialSheet = createInitialSheet();
  const sheet1: SheetData = {
    id: 'sheet-1',
    title: 'Q1-Q3 运营预测',
    rows: initialSheet.rows,
    cols: initialSheet.cols,
    cells: initialSheet.cells,
    colWidths: { 0: 160, 1: 130, 2: 130, 3: 130, 4: 130, 5: 130 },
    rowHeights: {},
  };

  const sheet2: SheetData = {
    id: 'sheet-2',
    title: '部门预算分解',
    rows: 15,
    cols: 6,
    cells: {
      '0,0': { value: '部门名称', bold: true, bg: '#f1f5f9', align: 'left' },
      '0,1': { value: '年度预算', bold: true, bg: '#f1f5f9', align: 'right' },
      '0,2': { value: '已发生费用', bold: true, bg: '#f1f5f9', align: 'right' },
      '0,3': { value: '剩余额度', bold: true, bg: '#f1f5f9', align: 'right' },
      '0,4': { value: '使用进度', bold: true, bg: '#f1f5f9', align: 'right' },
      '1,0': { value: '技术研发中心', align: 'left' },
      '1,1': { value: '4500000', format: 'currency', align: 'right' },
      '1,2': { value: '2890000', format: 'currency', align: 'right' },
      '1,3': { value: '=B2-C2', format: 'currency', align: 'right' },
      '1,4': { value: '=C2/B2', format: 'percent', align: 'right' },
      '2,0': { value: '市场营销部', align: 'left' },
      '2,1': { value: '1800000', format: 'currency', align: 'right' },
      '2,2': { value: '1120000', format: 'currency', align: 'right' },
      '2,3': { value: '=B3-C3', format: 'currency', align: 'right' },
      '2,4': { value: '=C3/B3', format: 'percent', align: 'right' },
      '3,0': { value: '人力资源与行政', align: 'left' },
      '3,1': { value: '800000', format: 'currency', align: 'right' },
      '3,2': { value: '540000', format: 'currency', align: 'right' },
      '3,3': { value: '=B4-C4', format: 'currency', align: 'right' },
      '3,4': { value: '=C4/B4', format: 'percent', align: 'right' },
      '4,0': { value: '合计总额', bold: true, bg: '#e2e8f0', align: 'left' },
      '4,1': { value: '=SUM(B2:B4)', bold: true, format: 'currency', bg: '#e2e8f0', align: 'right' },
      '4,2': { value: '=SUM(C2:C4)', bold: true, format: 'currency', bg: '#e2e8f0', align: 'right' },
      '4,3': { value: '=B5-C5', bold: true, format: 'currency', bg: '#e2e8f0', align: 'right' },
      '4,4': { value: '=C5/B5', bold: true, format: 'percent', bg: '#e2e8f0', align: 'right' },
    },
    colWidths: { 0: 160, 1: 130, 2: 130, 3: 130, 4: 130 },
    rowHeights: {},
  };

  return {
    activeSheetId: 'sheet-1',
    sheets: [sheet1, sheet2],
  };
}

export function getInitialDefaultFiles(): OfficeFile[] {
  const now = Date.now();
  return [
    {
      id: 'doc-default-1',
      name: '商业合作战略框架协议.docx',
      type: 'doc',
      createdAt: now - 3600000 * 24 * 2,
      modifiedAt: now - 3600000 * 4,
      isFavorite: true,
      isTrash: false,
      saveStatus: 'saved',
      content: DEFAULT_DOC_HTML,
      versionHistory: [
        {
          id: 'v-1',
          timestamp: now - 3600000 * 24 * 2,
          summary: '创建文档并编写合作条款',
          content: DEFAULT_DOC_HTML,
        },
        {
          id: 'v-2',
          timestamp: now - 3600000 * 4,
          summary: '插入交付指标阶段里程碑表格',
          content: DEFAULT_DOC_HTML,
        },
      ],
    },
    {
      id: 'sheet-default-1',
      name: '2026年业务季度运营分析与预测模型.xlsx',
      type: 'sheet',
      createdAt: now - 3600000 * 24 * 5,
      modifiedAt: now - 3600000 * 12,
      isFavorite: true,
      isTrash: false,
      saveStatus: 'saved',
      content: createDefaultWorkbook(),
      versionHistory: [
        {
          id: 'v-sheet-1',
          timestamp: now - 3600000 * 24 * 5,
          summary: '初始化 Q1-Q3 运营预测数据表',
          content: createDefaultWorkbook(),
        },
      ],
    },
    {
      id: 'pdf-default-1',
      name: '商业技术合作与知识产权协议.pdf',
      type: 'pdf',
      createdAt: now - 3600000 * 24 * 10,
      modifiedAt: now - 3600000 * 48,
      isFavorite: false,
      isTrash: false,
      saveStatus: 'saved',
      content: {
        annotations: [],
        pages: [],
      },
      versionHistory: [
        {
          id: 'v-pdf-1',
          timestamp: now - 3600000 * 24 * 10,
          summary: '导入源 PDF 文件并生成图层索引',
          content: {},
        },
      ],
    },
  ];
}

/**
 * Load all files from localStorage or initial defaults
 */
export function loadAllFiles(): OfficeFile[] {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Check if legacy v2 exists and migrate
      const legacyV2 = localStorage.getItem('lumina_office_files_v2');
      if (legacyV2) {
        try {
          const parsedV2 = JSON.parse(legacyV2);
          if (Array.isArray(parsedV2) && parsedV2.length > 0) {
            const sanitized = parsedV2.map(sanitizeOfficeFile);
            saveAllFiles(sanitized);
            localStorage.removeItem('lumina_office_files_v2');
            return sanitized;
          }
        } catch (e) {
          console.warn('Failed to parse legacy v2 files:', e);
        }
      }
      const defaults = getInitialDefaultFiles();
      saveAllFiles(defaults);
      return defaults;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const defaults = getInitialDefaultFiles();
      saveAllFiles(defaults);
      return defaults;
    }
    const sanitized = parsed.map(sanitizeOfficeFile);
    return sanitized;
  } catch (err) {
    console.error('Failed to load files from storage:', err);
    return getInitialDefaultFiles();
  }
}

/**
 * Save all files to localStorage
 */
export function saveAllFiles(files: OfficeFile[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
  } catch (err) {
    console.error('Failed to save files to storage:', err);
  }
}

/**
 * Generate a unique file name by appending sequential index when duplicates exist.
 * e.g., "未命名文稿（8/27）.docx" -> "未命名文稿（8/27）（1）.docx" -> "未命名文稿（8/27）（2）.docx"
 */
export function generateUniqueFileName(desiredName: string, existingFiles: OfficeFile[]): string {
  const trimmedDesired = desiredName.trim();
  const existingNames = new Set(existingFiles.map((f) => f.name.trim()));

  if (!existingNames.has(trimmedDesired)) {
    return trimmedDesired;
  }

  // Extract base name and extension
  let base = trimmedDesired;
  let ext = '';
  const lastDotIndex = base.lastIndexOf('.');
  if (lastDotIndex > 0) {
    ext = base.substring(lastDotIndex);
    base = base.substring(0, lastDotIndex);
  }

  // Check sequential indices starting from 1
  let index = 1;
  while (true) {
    const candidate = `${base}（${index}）${ext}`;
    if (!existingNames.has(candidate)) {
      return candidate;
    }
    index++;
  }
}

/**
 * Create a new file (Never overwrite existing documents, auto-increment name on collision)
 */
export function createNewFile(
  type: FileType,
  customName?: string,
  initialContent?: any
): OfficeFile {
  const now = Date.now();
  const id = `${type}-${now}-${Math.random().toString(36).substring(2, 7)}`;
  const files = loadAllFiles();
  
  let baseName = customName;
  if (!baseName) {
    const d = new Date();
    const timeStr = `${d.getMonth() + 1}/${d.getDate()}`;
    if (type === 'doc') baseName = `未命名文稿（${timeStr}）.docx`;
    else if (type === 'sheet') baseName = `未命名电子表格（${timeStr}）.xlsx`;
    else baseName = `未命名PDF文档（${timeStr}）.pdf`;
  }

  // Ensure unique name against existing files in workspace
  const name = generateUniqueFileName(baseName, files);

  let content = initialContent;
  if (!content) {
    if (type === 'doc') {
      content = '';
    } else if (type === 'sheet') {
      const initialSheet = createInitialSheet();
      content = {
        activeSheetId: 'sheet-1',
        sheets: [
          {
            id: 'sheet-1',
            title: '工作表 1',
            rows: 20,
            cols: 10,
            cells: {
              '0,0': { value: '项目名称', bold: true, bg: '#f1f5f9' },
              '0,1': { value: '数量', bold: true, bg: '#f1f5f9' },
              '0,2': { value: '单价', bold: true, bg: '#f1f5f9' },
              '0,3': { value: '总金额', bold: true, bg: '#f1f5f9' },
            },
            colWidths: {},
            rowHeights: {},
          },
        ],
      };
    } else {
      content = { annotations: [], pages: [] };
    }
  }

  const newFile: OfficeFile = {
    id,
    name,
    type,
    createdAt: now,
    modifiedAt: now,
    isFavorite: false,
    isTrash: false,
    saveStatus: 'saved',
    content,
    versionHistory: [
      {
        id: `v-${now}`,
        timestamp: now,
        summary: '创建新文档',
        content,
      },
    ],
  };

  const updated = [newFile, ...files];
  saveAllFiles(updated);
  return newFile;
}

/**
 * Update document content and optionally record a version checkpoint
 */
export function updateFileContent(
  fileId: string,
  newContent: any,
  versionSummary?: string,
  status: 'saved' | 'saving' | 'unsaved' = 'saved'
): OfficeFile | null {
  const files = loadAllFiles();
  const index = files.findIndex((f) => f.id === fileId);
  if (index === -1) return null;

  const current = files[index];
  const now = Date.now();
  let updatedHistory = [...(current.versionHistory || [])];

  if (versionSummary) {
    const newVersion: VersionHistoryItem = {
      id: `v-${now}-${Math.random().toString(36).substring(2, 5)}`,
      timestamp: now,
      summary: versionSummary,
      content: newContent,
    };
    updatedHistory = [newVersion, ...updatedHistory].slice(0, 30); // Keep last 30 versions
  }

  const updatedFile: OfficeFile = {
    ...current,
    content: newContent,
    modifiedAt: now,
    saveStatus: status,
    versionHistory: updatedHistory,
  };

  files[index] = updatedFile;
  saveAllFiles(files);
  return updatedFile;
}

/**
 * Toggle favorite status
 */
export function toggleFavoriteFile(fileId: string): boolean {
  const files = loadAllFiles();
  const file = files.find((f) => f.id === fileId);
  if (!file) return false;
  file.isFavorite = !file.isFavorite;
  saveAllFiles(files);
  return file.isFavorite;
}

/**
 * Move file to trash / Restore from trash
 */
export function toggleTrashFile(fileId: string, toTrash: boolean = true): boolean {
  const files = loadAllFiles();
  const file = files.find((f) => f.id === fileId);
  if (!file) return false;
  file.isTrash = toTrash;
  saveAllFiles(files);
  return true;
}

/**
 * Permanently delete file
 */
export function permanentlyDeleteFile(fileId: string): boolean {
  const files = loadAllFiles();
  const filtered = files.filter((f) => f.id !== fileId);
  saveAllFiles(filtered);
  return true;
}

/**
 * Duplicate a file
 */
export function duplicateFile(fileId: string): OfficeFile | null {
  const files = loadAllFiles();
  const file = files.find((f) => f.id === fileId);
  if (!file) return null;

  const now = Date.now();
  const copyName = generateUniqueFileName(file.name, files);
  const duplicated: OfficeFile = {
    ...file,
    id: `${file.type}-${now}-${Math.random().toString(36).substring(2, 7)}`,
    name: copyName,
    createdAt: now,
    modifiedAt: now,
    isTrash: false,
    saveStatus: 'saved',
    versionHistory: [
      {
        id: `v-${now}`,
        timestamp: now,
        summary: `复制自 ${file.name}`,
        content: file.content,
      },
    ],
  };

  const updated = [duplicated, ...files];
  saveAllFiles(updated);
  return duplicated;
}

/**
 * Rename file
 */
export function renameFile(fileId: string, newName: string): boolean {
  const files = loadAllFiles();
  const file = files.find((f) => f.id === fileId);
  if (!file) return false;
  file.name = newName.trim();
  file.modifiedAt = Date.now();
  saveAllFiles(files);
  return true;
}
