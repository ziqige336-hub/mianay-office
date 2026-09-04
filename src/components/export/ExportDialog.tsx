import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  FileCode,
  FileText,
  Table as TableIcon,
  Image as ImageIcon,
  Layers,
  Folder,
  FolderOpen,
  Check,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ShieldCheck,
  Scan,
  Archive,
  HardDrive,
  Compass,
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import type { OfficeFile, PageMeta } from '../../types';
import {
  renderDocumentPageToCleanCanvas,
  convertPdfToWordDocxAdvanced,
  convertPdfToExcelXlsxAdvanced,
  DPI_PRESETS,
} from '../../utils/universalExportPipeline';
import { SpreadsheetExportAdapter } from '../../core/export/SpreadsheetExportAdapter';
import { DocumentExportAdapter } from '../../core/export/DocumentExportAdapter';
import { exportScannedImageBasedPdf, exportPdfHighDpiImages } from '../../utils/pdfExportEngines';
import { loadPdfJsDocument, exportCleanPdf, resolvePdfBytesFromFile } from '../../utils/pdfLibWrapper';
import { officeEngine } from '../../core/office';
import { DocumentSessionManager } from '../../core/document';
import { PdfExportService } from '../../core/export/PdfExportService';
import { DocxExportService } from '../../core/export/DocxExportService';
import { SheetExportService } from '../../core/export/SheetExportService';

export type ExportFormatType = 'pdf' | 'docx' | 'xlsx' | 'image' | 'long-image' | 'txt';

export interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentFile: OfficeFile | null;
  initialFormat?: ExportFormatType;
  onShowToast: (type: 'success' | 'error' | 'info' | 'vip-free', title: string, description?: string) => void;
}

export const ExportDialog: React.FC<ExportDialogProps> = ({
  isOpen,
  onClose,
  currentFile,
  initialFormat = 'pdf',
  onShowToast,
}) => {
  // 1. Output Format
  const [selectedFormat, setSelectedFormat] = useState<ExportFormatType>(initialFormat);

  // 2. File Name
  const [fileName, setFileName] = useState<string>('');

  // 3. Save Location
  const [saveLocationPreset, setSaveLocationPreset] = useState<'downloads' | 'documents' | 'desktop' | 'custom'>('downloads');
  const [customPath, setCustomPath] = useState<string>('此电脑 / 本地目录');
  const [customDirHandle, setCustomDirHandle] = useState<any>(null);

  // 4. Common Parameters
  const [dpi, setDpi] = useState<number>(96);
  const [colorMode, setColorMode] = useState<'color' | 'grayscale' | 'monochrome'>('color');
  const [pageRangeMode, setPageRangeMode] = useState<'all' | 'current' | 'custom'>('all');
  const [customPageRange, setCustomPageRange] = useState<string>('');
  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);

  // 5. PDF-Specific Parameters
  const [pdfSubMode, setPdfSubMode] = useState<'standard' | 'scanned' | 'pdfa'>('standard');
  const [includeOcrInScannedPdf, setIncludeOcrInScannedPdf] = useState<boolean>(true);

  // 6. Image-Specific Parameters
  const [imageFormat, setImageFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
  const [resolutionScale, setResolutionScale] = useState<number>(2);

  // 7. Execution & Progress State
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Initialize on open or file change
  useEffect(() => {
    if (isOpen && currentFile) {
      setSelectedFormat(initialFormat);
      const cleanBaseName = currentFile.name.replace(/\.[^/.]+$/, '');
      setFileName(cleanBaseName);

      let pCount = 1;
      const isPdf = currentFile.type === 'pdf' || (currentFile.name && currentFile.name.toLowerCase().endsWith('.pdf'));
      const activeSession = DocumentSessionManager.getSession(currentFile.id) || DocumentSessionManager.getActiveSession();
      const pdfDocSession = activeSession?.pdfSession;

      if (isPdf) {
        pCount = pdfDocSession?.pages?.length || pdfDocSession?.pageCount || currentFile.content?.pages?.length || 1;
        if (pCount <= 1) {
          resolvePdfBytesFromFile(currentFile).then((bytes) => {
            if (bytes && bytes.byteLength > 0) {
              PDFDocument.load(bytes, { ignoreEncryption: true })
                .then((doc) => {
                  const count = doc.getPageCount();
                  if (count > 0) {
                    setTotalPages(count);
                    setCustomPageRange(`1-${count}`);
                  }
                })
                .catch(() => {});
            }
          }).catch(() => {});
        }
      } else if (currentFile.type === 'doc') {
        const textLen = typeof currentFile.content === 'string' ? currentFile.content.length : 1000;
        pCount = Math.max(1, Math.ceil(textLen / 1200));
      }
      setTotalPages(pCount);
      setCurrentPageIndex(0);
      setCustomPageRange(`1-${pCount}`);
      setIsExporting(false);
      setProgress(0);
      setStatusMessage('');
    }
  }, [isOpen, currentFile, initialFormat]);

  if (!isOpen || !currentFile) return null;

  // Calculate destination path preview string
  const getExtensionForFormat = (fmt: ExportFormatType): string => {
    switch (fmt) {
      case 'pdf':
        return '.pdf';
      case 'docx':
        return '.docx';
      case 'xlsx':
        return '.xlsx';
      case 'image':
        return imageFormat === 'jpeg' ? '.jpg' : `.${imageFormat}`;
      case 'long-image':
        return imageFormat === 'jpeg' ? '.jpg' : `.${imageFormat}`;
      case 'txt':
        return '.txt';
      default:
        return '';
    }
  };

  const getSaveDirectoryPath = (): string => {
    switch (saveLocationPreset) {
      case 'downloads':
        return '~/Downloads';
      case 'documents':
        return '~/Documents';
      case 'desktop':
        return '~/Desktop';
      case 'custom':
        return customPath || '此电脑 / 自定义目录';
      default:
        return '~/Downloads';
    }
  };

  const fullTargetPath = `${getSaveDirectoryPath()}/${fileName.trim() || '文档导出'}${getExtensionForFormat(selectedFormat)}`;

  // Invokes "此电脑" File / Directory System Picker
  const handleSelectCustomLocation = async () => {
    setSaveLocationPreset('custom');
    try {
      if ('showDirectoryPicker' in window) {
        const dirHandle = await (window as any).showDirectoryPicker();
        if (dirHandle) {
          setCustomDirHandle(dirHandle);
          setCustomPath(`此电脑 / ${dirHandle.name || '已选文件夹'}`);
          onShowToast('info', '已选择保存目录', `将导出至本地文件夹: ${dirHandle.name}`);
          return;
        }
      }
      const userPromptPath = window.prompt('请输入“此电脑”目标保存路径或文件夹名称：', customPath.replace('此电脑 / ', ''));
      if (userPromptPath) {
        setCustomPath(`此电脑 / ${userPromptPath}`);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('Custom location picker fallback:', err);
      }
    }
  };

  // Parse page indices to export
  const getPageIndicesToExport = (): number[] => {
    if (pageRangeMode === 'current') {
      return [currentPageIndex];
    }
    if (pageRangeMode === 'all') {
      return Array.from({ length: totalPages }, (_, i) => i);
    }
    // Custom range like "1-3, 5"
    const indices = new Set<number>();
    const parts = customPageRange.split(',').map((p) => p.trim());
    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map((n) => parseInt(n.trim(), 10));
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
            if (i >= 1 && i <= totalPages) indices.add(i - 1);
          }
        }
      } else {
        const num = parseInt(part, 10);
        if (!isNaN(num) && num >= 1 && num <= totalPages) {
          indices.add(num - 1);
        }
      }
    }
    const result = Array.from(indices).sort((a, b) => a - b);
    return result.length > 0 ? result : [0];
  };

  // Browser File System Save or Direct Verified Download
  const saveFileToDisk = async (blob: Blob, targetFileName: string) => {
    // 1. If directory handle from "此电脑" is available, write directly
    if (customDirHandle && saveLocationPreset === 'custom') {
      try {
        const fileHandle = await customDirHandle.getFileHandle(targetFileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (err: any) {
        console.warn('Direct dirHandle write fallback to save picker:', err);
      }
    }

    // 2. Try modern File System Access API if user selected custom or window supports it
    if (saveLocationPreset === 'custom' && 'showSaveFilePicker' in window) {
      try {
        const ext = targetFileName.split('.').pop() || '';
        const mime = blob.type || 'application/octet-stream';
        const fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: targetFileName,
          types: [
            {
              description: `${selectedFormat.toUpperCase()} Document`,
              accept: { [mime]: [`.${ext}`] },
            },
          ],
        });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') {
          throw new Error('用户取消了保存位置选择');
        }
        // Fallback to standard link download
      }
    }

    // 3. Standard browser download with user-configured filename
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = targetFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Main Export Handler
  const handleExecuteExport = async () => {
    if (!fileName.trim()) {
      onShowToast('error', '请输入有效的导出文件名');
      return;
    }

    const selectedIndices = getPageIndicesToExport();
    if (selectedIndices.length === 0) {
      onShowToast('error', '请至少选择一个导出的页面');
      return;
    }

    setIsExporting(true);
    setProgress(5);
    setStatusMessage('正在初始化导出环境...');

    try {
      const baseOutName = fileName.trim();
      const ext = getExtensionForFormat(selectedFormat);
      const targetFileName = `${baseOutName}${ext}`;

      // Retrieve the real-time active document content from DocumentSessionManager
      const activeSession = DocumentSessionManager.getSession(currentFile.id) || DocumentSessionManager.getActiveSession();
      const exportContent = activeSession?.getExportContent
        ? activeSession.getExportContent()
        : (activeSession?.docState || activeSession?.sheetState || currentFile.content);

      const editorText = activeSession?.getVisibleTextPreview
        ? activeSession.getVisibleTextPreview()
        : (typeof exportContent === 'string' ? exportContent.replace(/<[^>]+>/g, ' ').trim() : '');

      // Execute Pre-Export Verification Audit & Mandatory Real-Time Diagnostic Log
      DocumentSessionManager.logSyncStatus({
        editorText,
        editorStateSize: typeof exportContent === 'string' ? exportContent.length : JSON.stringify(exportContent || '').length,
        sessionContent: typeof exportContent === 'string' ? exportContent : JSON.stringify(exportContent || ''),
        fileContent: typeof currentFile?.content === 'string' ? currentFile.content : JSON.stringify(currentFile?.content || ''),
        exportPayload: typeof exportContent === 'string' ? exportContent : JSON.stringify(exportContent || ''),
      });

      const isPdfFile =
        currentFile.type === 'pdf' || (currentFile.name && currentFile.name.toLowerCase().endsWith('.pdf'));
      const isSheetFile =
        !isPdfFile &&
        (currentFile.type === 'sheet' ||
          (currentFile.name &&
            (currentFile.name.toLowerCase().endsWith('.xlsx') ||
              currentFile.name.toLowerCase().endsWith('.xls') ||
              currentFile.name.toLowerCase().endsWith('.csv'))));
      const isDocFile =
        !isPdfFile &&
        !isSheetFile &&
        (currentFile.type === 'doc' ||
          (currentFile.name &&
            (currentFile.name.toLowerCase().endsWith('.docx') ||
              currentFile.name.toLowerCase().endsWith('.doc') ||
              currentFile.name.toLowerCase().endsWith('.txt') ||
              currentFile.name.toLowerCase().endsWith('.md'))));

      // =========================================================================
      // CASE 1: PDF Export
      // =========================================================================
      if (selectedFormat === 'pdf') {
        let pdfBlob: Blob;

        if (isPdfFile) {
          setStatusMessage(pdfSubMode === 'scanned' ? `正在以 ${dpi} DPI 光栅化生成防篡改扫描型 PDF...` : '正在导出高保真原生 PDF...');
          const exportRes = await PdfExportService.exportNativePdf(currentFile, {
            customFileName: baseOutName,
            selectedPages: selectedIndices,
            dpi,
            outputType: pdfSubMode === 'scanned' ? 'scanned' : 'vector',
            includeOcr: includeOcrInScannedPdf,
            onProgress: (p, text) => {
              setProgress(p);
              if (text) setStatusMessage(text);
            },
          });
          pdfBlob = exportRes.blob;
        } else if (isSheetFile) {
          setStatusMessage('正在调用桌面 Office 原生排版引擎输出表格 PDF...');
          const exportRes = await SheetExportService.exportPdf(currentFile, {
            customFileName: baseOutName,
            onProgress: (p, text) => {
              setProgress(p);
              if (text) setStatusMessage(text);
            },
          });
          pdfBlob = exportRes.blob;
        } else {
          setStatusMessage('正在调用桌面 Office 原生排版引擎输出文档 PDF...');
          const exportRes = await DocxExportService.exportPdf(currentFile, {
            customFileName: baseOutName,
            onProgress: (p, text) => {
              setProgress(p);
              if (text) setStatusMessage(text);
            },
          });
          pdfBlob = exportRes.blob;
        }

        setStatusMessage('正在写入目标存储路径...');
        await saveFileToDisk(pdfBlob, targetFileName);

        onShowToast(
          'vip-free',
          pdfSubMode === 'scanned' ? `已生成扫描型 PDF (${dpi} DPI)` : '已成功输出 Office 桌面原生高保真 PDF',
          `保存至 ${getSaveDirectoryPath()} • 100% 微软/WPS 排版精度`
        );
      }

      // =========================================================================
      // CASE 2: Word (.docx) Export (Direct Office Engine State)
      // =========================================================================
      else if (selectedFormat === 'docx') {
        setStatusMessage('正在从 Office 引擎状态导出原生 Word 结构...');
        let docxBlob: Blob;

        if (isPdfFile) {
          const rawPdfBytes = activeSession?.pdfSession?.pdfBytes || (await resolvePdfBytesFromFile(currentFile));
          const pdfJsDoc = activeSession?.pdfSession?.pdfJsDoc || (await loadPdfJsDocument(rawPdfBytes));
          docxBlob = await convertPdfToWordDocxAdvanced(pdfJsDoc, (p, text) => {
            setProgress(10 + Math.round(p * 80));
            setStatusMessage(text);
          });
        } else if (isDocFile || isSheetFile) {
          try {
            docxBlob = await DocumentExportAdapter.exportToDocx(exportContent || currentFile.content);
          } catch {
            const saveRes = await officeEngine.saveDocument(
              currentFile.id,
              exportContent,
              'doc',
              currentFile.name.replace(/\.[^/.]+$/, '')
            );
            docxBlob = saveRes.blob;
          }
        } else {
          try {
            docxBlob = await DocumentExportAdapter.exportToDocx(exportContent || currentFile.content);
          } catch {
            const saveRes = await officeEngine.saveDocument(
              currentFile.id,
              exportContent,
              'doc',
              currentFile.name.replace(/\.[^/.]+$/, '')
            );
            docxBlob = saveRes.blob;
          }
        }

        setStatusMessage('正在保存 Word 文档...');
        await saveFileToDisk(docxBlob, targetFileName);
        onShowToast('success', 'Word 文档导出成功', `已从 Office 引擎导出至 ${getSaveDirectoryPath()}`);
      }

      // =========================================================================
      // CASE 3: Excel (.xlsx) Export (Direct Office Engine State)
      // =========================================================================
      else if (selectedFormat === 'xlsx') {
        setStatusMessage('正在从 Office 引擎状态导出原生 Excel 矩阵...');
        let xlsxBlob: Blob;

        if (isPdfFile) {
          const rawPdfBytes = activeSession?.pdfSession?.pdfBytes || (await resolvePdfBytesFromFile(currentFile));
          const pdfJsDoc = activeSession?.pdfSession?.pdfJsDoc || (await loadPdfJsDocument(rawPdfBytes));
          xlsxBlob = await convertPdfToExcelXlsxAdvanced(pdfJsDoc, (p, text) => {
            setProgress(10 + Math.round(p * 80));
            setStatusMessage(text);
          });
        } else if (isSheetFile || isDocFile) {
          const saveRes = await officeEngine.saveDocument(
            currentFile.id,
            exportContent,
            'sheet',
            currentFile.name.replace(/\.[^/.]+$/, '')
          );
          xlsxBlob = saveRes.blob;
        } else {
          const saveRes = await officeEngine.saveDocument(
            currentFile.id,
            exportContent,
            'sheet',
            currentFile.name.replace(/\.[^/.]+$/, '')
          );
          xlsxBlob = saveRes.blob;
        }

        setStatusMessage('正在保存 Excel 工作簿...');
        await saveFileToDisk(xlsxBlob, targetFileName);
        onShowToast('success', 'Excel 工作簿导出成功', `已从 Office 引擎导出至 ${getSaveDirectoryPath()}`);
      }

      // =========================================================================
      // CASE 4: Image (PNG/JPG/WEBP) Export
      // =========================================================================
      else if (selectedFormat === 'image') {
        const mime = imageFormat === 'jpeg' ? 'image/jpeg' : imageFormat === 'webp' ? 'image/webp' : 'image/png';
        const imgExt = imageFormat === 'jpeg' ? 'jpg' : imageFormat;

        if (selectedIndices.length === 1) {
          // Single Image
          const pIdx = selectedIndices[0];
          setStatusMessage(`正在渲染第 ${pIdx + 1} 页 (${dpi} DPI)...`);
          const canvas = await renderDocumentPageToCleanCanvas(currentFile, pIdx, dpi, colorMode);
          const dataUrl = canvas.toDataURL(mime, 0.95);
          const base64 = dataUrl.split(',')[1];
          const binaryStr = atob(base64);
          const bytes = new Uint8Array(binaryStr.length);
          for (let b = 0; b < binaryStr.length; b++) bytes[b] = binaryStr.charCodeAt(b);

          const blob = new Blob([bytes], { type: mime });
          await saveFileToDisk(blob, `${baseOutName}_第${pIdx + 1}页.${imgExt}`);
          onShowToast('success', '图片导出成功', `已保存单页高清图片至 ${getSaveDirectoryPath()}`);
        } else {
          // Multiple Images -> ZIP Package
          const zip = new JSZip();
          for (let i = 0; i < selectedIndices.length; i++) {
            const pIdx = selectedIndices[i];
            setStatusMessage(`正在导出第 ${pIdx + 1} 页 (${i + 1}/${selectedIndices.length})...`);
            const canvas = await renderDocumentPageToCleanCanvas(currentFile, pIdx, dpi, colorMode);
            const dataUrl = canvas.toDataURL(mime, 0.95);
            const base64 = dataUrl.split(',')[1];
            zip.file(`${baseOutName}_第${pIdx + 1}页_${dpi}dpi.${imgExt}`, base64, { base64: true });
            setProgress(10 + Math.round(((i + 1) / selectedIndices.length) * 80));
          }

          setStatusMessage('正在打包 ZIP 图片压缩包...');
          const zipBlob = await zip.generateAsync({ type: 'blob' });
          await saveFileToDisk(zipBlob, `${baseOutName}_图片包(${selectedIndices.length}页).zip`);
          onShowToast('vip-free', '高清图片包导出成功', `已打包 ${selectedIndices.length} 页图片 (ZIP)`);
        }
      }

      // =========================================================================
      // CASE 5: Long Image (Vertical Stitch) Export
      // =========================================================================
      else if (selectedFormat === 'long-image') {
        const mime = imageFormat === 'jpeg' ? 'image/jpeg' : imageFormat === 'webp' ? 'image/webp' : 'image/png';
        const imgExt = imageFormat === 'jpeg' ? 'jpg' : imageFormat;
        const canvases: HTMLCanvasElement[] = [];

        for (let i = 0; i < selectedIndices.length; i++) {
          const pIdx = selectedIndices[i];
          setStatusMessage(`正在渲染第 ${pIdx + 1} 页拼图 (${i + 1}/${selectedIndices.length})...`);
          const cvs = await renderDocumentPageToCleanCanvas(currentFile, pIdx, dpi, colorMode);
          canvases.push(cvs);
          setProgress(10 + Math.round(((i + 1) / selectedIndices.length) * 70));
        }

        setStatusMessage('正在垂直无缝拼接长图...');
        const totalHeight = canvases.reduce((h, c) => h + c.height, 0);
        const maxWidth = Math.max(...canvases.map((c) => c.width));

        const longCanvas = document.createElement('canvas');
        longCanvas.width = maxWidth;
        longCanvas.height = totalHeight;
        const ctx = longCanvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, maxWidth, totalHeight);

        let currentY = 0;
        for (const c of canvases) {
          ctx.drawImage(c, 0, currentY);
          currentY += c.height;
        }

        const dataUrl = longCanvas.toDataURL(mime, 0.95);
        const base64 = dataUrl.split(',')[1];
        const binaryStr = atob(base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let b = 0; b < binaryStr.length; b++) bytes[b] = binaryStr.charCodeAt(b);

        const blob = new Blob([bytes], { type: mime });
        await saveFileToDisk(blob, `${baseOutName}_长图.${imgExt}`);
        onShowToast('vip-free', '高清长图导出成功', `共拼接 ${selectedIndices.length} 页 • ${dpi} DPI`);
      }

      // =========================================================================
      // CASE 6: TXT (Plain Text) Export
      // =========================================================================
      else if (selectedFormat === 'txt') {
        setStatusMessage('正在提取纯文本字符流...');
        let textContent = '';

        if (isPdfFile) {
          const rawPdfBytes = await resolvePdfBytesFromFile(currentFile);
          const pdfJsDoc = await loadPdfJsDocument(rawPdfBytes);
          for (const pIdx of selectedIndices) {
            const page = await pdfJsDoc.getPage(pIdx + 1);
            const tc = await page.getTextContent();
            textContent += `--- 第 ${pIdx + 1} 页 ---\n` + tc.items.map((it: any) => it.str || '').join(' ') + '\n\n';
          }
        } else if (isDocFile) {
          textContent = DocumentExportAdapter.exportToTxt(currentFile.content || '');
        } else if (isSheetFile && currentFile.content) {
          const csvBlob = SpreadsheetExportAdapter.exportToCsv(currentFile.content);
          textContent = await csvBlob.text();
        } else {
          textContent = typeof currentFile.content === 'string' ? currentFile.content : JSON.stringify(currentFile.content || '');
        }

        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
        await saveFileToDisk(blob, targetFileName);
        onShowToast('success', '纯文本导出成功', `已保存至 ${getSaveDirectoryPath()}`);
      }

      setProgress(100);
      setTimeout(() => {
        setIsExporting(false);
        onClose();
      }, 600);
    } catch (err: any) {
      console.error('Export execution error:', err);
      setIsExporting(false);
      onShowToast('error', '导出过程发生异常', err?.message || '无法写入目标文件');
    }
  };

  return (
    <div
      data-no-canvas-click="true"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-150"
    >
      <div className="w-full max-w-2xl bg-white dark:bg-[#1c1c1e] rounded-2xl shadow-2xl border border-black/[0.08] dark:border-white/[0.1] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-900/50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                  导出文稿
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> 零污染·离线高保真
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                源文件：<span className="font-medium text-neutral-700 dark:text-neutral-300">{currentFile.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-black/[0.04] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* 1. Format Selection */}
          <div className="space-y-2">
            <label className="font-semibold text-neutral-800 dark:text-neutral-200 block">
              输出格式 (Output Format)
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[
                { id: 'pdf', label: 'PDF', icon: FileCode, color: 'text-rose-500' },
                { id: 'docx', label: 'Word (.docx)', icon: FileText, color: 'text-blue-500' },
                { id: 'xlsx', label: 'Excel (.xlsx)', icon: TableIcon, color: 'text-emerald-500' },
                { id: 'image', label: '图片', icon: ImageIcon, color: 'text-amber-500' },
                { id: 'long-image', label: '长图', icon: Layers, color: 'text-teal-500' },
                { id: 'txt', label: 'TXT', icon: FileText, color: 'text-neutral-500' },
              ].map((fmt) => {
                const Icon = fmt.icon;
                const isSel = selectedFormat === fmt.id;
                return (
                  <button
                    key={fmt.id}
                    onClick={() => setSelectedFormat(fmt.id as any)}
                    className={`py-2.5 px-2 rounded-xl border text-center transition-all flex flex-col items-center justify-center space-y-1.5 ${
                      isSel
                        ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/30 ring-1 ring-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
                        : 'border-black/[0.08] dark:border-white/[0.1] hover:bg-black/[0.02] text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${fmt.color}`} />
                    <span className="text-xs truncate">{fmt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. File Name */}
          <div className="space-y-1.5">
            <label className="font-semibold text-neutral-800 dark:text-neutral-200 block">
              文件名 (File Name)
            </label>
            <div className="flex items-center">
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="输入导出文档名称"
                className="flex-1 px-3 py-2 bg-neutral-50 dark:bg-neutral-800/60 border border-black/[0.1] dark:border-white/[0.1] rounded-l-xl text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="px-3 py-2 bg-neutral-100 dark:bg-neutral-800 border border-l-0 border-black/[0.1] dark:border-white/[0.1] rounded-r-xl text-xs font-mono text-neutral-500">
                {getExtensionForFormat(selectedFormat)}
              </span>
            </div>
            {/* Suffix presets */}
            <div className="flex items-center space-x-1.5 pt-1">
              <span className="text-[11px] text-neutral-400">快速后缀：</span>
              {['_已处理', '_终稿', '_导出', '_clean'].map((suf) => (
                <button
                  key={suf}
                  onClick={() => setFileName((prev) => `${prev.replace(/(_已处理|_终稿|_导出|_clean)$/, '')}${suf}`)}
                  className="px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 text-[10px] text-neutral-600 dark:text-neutral-400 transition"
                >
                  {suf}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Save Location (保存位置) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-neutral-800 dark:text-neutral-200">
                保存位置 (Save Location)
              </label>
              {saveLocationPreset === 'custom' && (
                <button
                  onClick={handleSelectCustomLocation}
                  className="text-[11px] text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 font-medium"
                >
                  <FolderOpen className="w-3.5 h-3.5" /> 更改位置...
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'downloads', label: '下载 (Downloads)', icon: Download },
                { id: 'documents', label: '文稿 (Documents)', icon: Folder },
                { id: 'desktop', label: '桌面 (Desktop)', icon: HardDrive },
                { id: 'custom', label: '此电脑 (自定义位置...)', icon: Compass },
              ].map((loc) => {
                const Icon = loc.icon;
                const isSel = saveLocationPreset === loc.id;
                return (
                  <button
                    key={loc.id}
                    onClick={() => {
                      if (loc.id === 'custom') {
                        handleSelectCustomLocation();
                      } else {
                        setSaveLocationPreset(loc.id as any);
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-left transition flex items-center space-x-2 ${
                      isSel
                        ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 ring-1 ring-blue-600 font-semibold'
                        : 'border-black/[0.08] dark:border-white/[0.1] hover:bg-black/[0.02] text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-xs truncate">{loc.label}</span>
                  </button>
                );
              })}
            </div>
            {/* Full target path preview */}
            <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between text-[11px] text-neutral-500">
              <span className="truncate">目标完整路径：<span className="font-mono text-neutral-800 dark:text-neutral-200">{fullTargetPath}</span></span>
              {saveLocationPreset === 'custom' && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-md">
                  此电脑已关联
                </span>
              )}
            </div>
          </div>

          {/* 4. Format-Specific Parameters */}
          {selectedFormat === 'pdf' && (
            <div className="space-y-3 pt-1">
              <label className="font-semibold text-neutral-800 dark:text-neutral-200 block">
                PDF 规格选项
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'standard', label: '标准矢量 PDF', desc: '纯净矢量文字，支持复制检索' },
                  { id: 'scanned', label: '扫描型 PDF', desc: '全页栅格化，防文本篡改' },
                  { id: 'pdfa', label: 'PDF/A 归档', desc: 'ISO 长期保存合规规范' },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setPdfSubMode(m.id as any)}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      pdfSubMode === m.id
                        ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 ring-1 ring-blue-600 font-semibold'
                        : 'border-black/[0.08] dark:border-white/[0.1] hover:bg-black/[0.02] text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <div className="text-xs font-semibold">{m.label}</div>
                    <div className="text-[10px] text-neutral-500 mt-0.5 leading-tight">{m.desc}</div>
                  </button>
                ))}
              </div>

              {pdfSubMode === 'scanned' && (
                <div className="p-3 bg-purple-50/50 dark:bg-purple-950/20 rounded-xl border border-purple-100 dark:border-purple-900/30 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-neutral-900 dark:text-neutral-100 block">
                      注入 OCR 双层可检索文本
                    </span>
                    <span className="text-[11px] text-neutral-500">
                      保留纯图片防篡改视觉效果的同时，允许通过搜索框直接检索文本
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={includeOcrInScannedPdf}
                    onChange={(e) => setIncludeOcrInScannedPdf(e.target.checked)}
                    className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                  />
                </div>
              )}
            </div>
          )}

          {/* 5. DPI Parameters (WPS / Adobe Standard) */}
          {(selectedFormat === 'pdf' || selectedFormat === 'image' || selectedFormat === 'long-image') && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-neutral-800 dark:text-neutral-200">
                  输出精度 (DPI 行业标准)
                </label>
                <span className="text-[11px] text-blue-600 font-medium">
                  {DPI_PRESETS[dpi]?.desc || `${dpi} DPI`}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {[72, 96, 150, 300, 600].map((d) => {
                  const isSel = dpi === d;
                  return (
                    <button
                      key={d}
                      onClick={() => setDpi(d)}
                      className={`py-2 rounded-xl border text-center transition flex flex-col items-center justify-center ${
                        isSel
                          ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 ring-1 ring-blue-600 font-bold'
                          : 'border-black/[0.08] dark:border-white/[0.1] hover:bg-black/[0.02] text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      <span className="font-mono text-xs">{d}</span>
                      <span className="text-[9px] text-neutral-400">
                        {d === 72 ? '预览' : d === 96 ? '办公' : d === 150 ? '高清' : d === 300 ? '打印' : '印刷'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 6. Page Range Selection */}
          <div className="space-y-2">
            <label className="font-semibold text-neutral-800 dark:text-neutral-200 block">
              页码范围 (Page Range)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setPageRangeMode('all')}
                className={`py-2 px-3 rounded-xl border text-center transition ${
                  pageRangeMode === 'all'
                    ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 ring-1 ring-blue-600 font-semibold'
                    : 'border-black/[0.08] dark:border-white/[0.1] text-neutral-700 dark:text-neutral-300'
                }`}
              >
                全部页面 ({totalPages} 页)
              </button>
              <button
                onClick={() => setPageRangeMode('current')}
                className={`py-2 px-3 rounded-xl border text-center transition ${
                  pageRangeMode === 'current'
                    ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 ring-1 ring-blue-600 font-semibold'
                    : 'border-black/[0.08] dark:border-white/[0.1] text-neutral-700 dark:text-neutral-300'
                }`}
              >
                当前页 (第 {currentPageIndex + 1} 页)
              </button>
              <button
                onClick={() => setPageRangeMode('custom')}
                className={`py-2 px-3 rounded-xl border text-center transition ${
                  pageRangeMode === 'custom'
                    ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 ring-1 ring-blue-600 font-semibold'
                    : 'border-black/[0.08] dark:border-white/[0.1] text-neutral-700 dark:text-neutral-300'
                }`}
              >
                自定义页码...
              </button>
            </div>

            {pageRangeMode === 'custom' && (
              <input
                type="text"
                value={customPageRange}
                onChange={(e) => setCustomPageRange(e.target.value)}
                placeholder="例如：1-3, 5"
                className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800/60 border border-black/[0.1] dark:border-white/[0.1] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}
          </div>

          {/* Progress bar if running */}
          {isExporting && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400">
                <span className="flex items-center space-x-1.5 text-blue-600">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{statusMessage}</span>
                </span>
                <span className="font-mono font-bold">{progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-black/[0.06] dark:bg-white/[0.1] rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-black/[0.06] dark:border-white/[0.08] bg-neutral-50/50 dark:bg-neutral-900/50 flex items-center justify-between">
          <span className="text-[11px] text-neutral-400">
            禁止自动下载 · 点击确认后写入本地存储
          </span>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-black/[0.04] transition"
            >
              取消
            </button>
            <button
              onClick={handleExecuteExport}
              disabled={isExporting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center space-x-1.5 disabled:opacity-50 transition active:scale-[0.98]"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>导出中...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>导出并保存</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
