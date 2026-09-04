import React, { useState, useEffect, useRef } from 'react';
import {
  Eraser,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  X,
  RefreshCw,
  Download,
  FileText,
  Table as TableIcon,
  FileCode,
  Image as ImageIcon,
  Layers,
  Search,
  CheckSquare,
  Square,
  ArrowRight,
  Sliders,
  Eye,
  Save,
  UploadCloud,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  inspectDocxWatermark,
  removeDocxWatermarks,
  inspectXlsxWatermark,
  removeXlsxWatermarks,
  inspectPdfWatermark,
  removePdfWatermarks,
  processImageWatermarkInpainting,
  type WatermarkFormat,
  type WatermarkItem,
  type WatermarkAnalysisResult,
  type WatermarkProcessResult,
  type VerificationReport,
} from '../../utils/watermarkEngine';
import { autoDetectImageWatermarkBoxes } from '../../utils/imageInpainter';
import type { OfficeFile } from '../../types';

interface UniversalWatermarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeFile?: OfficeFile | null;
  onSaveFileContent?: (fileId: string, updatedContent: any, summary: string) => void;
  onShowToast: (type: 'success' | 'error' | 'info' | 'vip-free', title: string, description?: string) => void;
}

export const UniversalWatermarkModal: React.FC<UniversalWatermarkModalProps> = ({
  isOpen,
  onClose,
  activeFile,
  onSaveFileContent,
  onShowToast,
}) => {
  const [currentFormat, setCurrentFormat] = useState<WatermarkFormat>('pdf');
  const [loadedFileName, setLoadedFileName] = useState<string>('');
  const [rawBuffer, setRawBuffer] = useState<Uint8Array | null>(null);
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<WatermarkAnalysisResult | null>(null);
  const [watermarks, setWatermarks] = useState<WatermarkItem[]>([]);

  // Processing & Verification state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processStep, setProcessStep] = useState<string>('');
  const [processResult, setProcessResult] = useState<WatermarkProcessResult | null>(null);

  // Image Inpainting Brush & Box state
  const [imageBoxes, setImageBoxes] = useState<{ x: number; y: number; width: number; height: number; label?: string }[]>([]);
  const [brushSize, setBrushSize] = useState<number>(24);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'scan' | 'verify' | 'preview'>('scan');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize from activeFile if available
  useEffect(() => {
    if (isOpen) {
      setProcessResult(null);
      setActiveTab('scan');
      if (activeFile) {
        setLoadedFileName(activeFile.name);
        if (activeFile.type === 'pdf') {
          setCurrentFormat('pdf');
          if (activeFile.content?.pdfBytes) {
            const bytes = activeFile.content.pdfBytes instanceof Uint8Array
              ? activeFile.content.pdfBytes
              : new Uint8Array(activeFile.content.pdfBytes);
            setRawBuffer(bytes);
            runAnalysis(bytes, 'pdf', activeFile.name);
          }
        } else if (activeFile.type === 'doc') {
          setCurrentFormat('docx');
          // For docx files in memory or default sample
          setLoadedFileName(activeFile.name.endsWith('.docx') ? activeFile.name : `${activeFile.name}.docx`);
        } else if (activeFile.type === 'sheet') {
          setCurrentFormat('xlsx');
          setLoadedFileName(activeFile.name.endsWith('.xlsx') ? activeFile.name : `${activeFile.name}.xlsx`);
        }
      }
    }
  }, [isOpen, activeFile]);

  // Run deep analysis based on format
  const runAnalysis = async (bytes: Uint8Array, format: WatermarkFormat, fileName: string) => {
    setIsAnalyzing(true);
    setProcessResult(null);
    try {
      let result: WatermarkAnalysisResult;
      if (format === 'docx') {
        result = await inspectDocxWatermark(bytes, fileName);
      } else if (format === 'xlsx') {
        result = await inspectXlsxWatermark(bytes, fileName);
      } else if (format === 'pdf') {
        result = await inspectPdfWatermark(bytes, fileName);
      } else {
        result = {
          format: 'image',
          fileName,
          fileSize: bytes.byteLength,
          items: [],
          summary: '图像文件已加载，请使用画笔或智能检测标记水印区域',
          hasWatermarks: false,
        };
      }

      setAnalysisResult(result);
      setWatermarks(result.items);
    } catch (err: any) {
      console.error('Analysis failed:', err);
      onShowToast('error', '文档结构解析失败', err?.message || '文件格式不兼容或损坏');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoadedFileName(file.name);
    setProcessResult(null);
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    setRawBuffer(bytes);

    if (file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
      setCurrentFormat('docx');
      await runAnalysis(bytes, 'docx', file.name);
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      setCurrentFormat('xlsx');
      await runAnalysis(bytes, 'xlsx', file.name);
    } else if (file.name.endsWith('.pdf')) {
      setCurrentFormat('pdf');
      await runAnalysis(bytes, 'pdf', file.name);
    } else if (file.type.startsWith('image/')) {
      setCurrentFormat('image');
      const url = URL.createObjectURL(file);
      setImageUrl(url);
      const img = new Image();
      img.src = url;
      img.onload = () => {
        setImageElement(img);
        initImageCanvas(img);
      };
      await runAnalysis(bytes, 'image', file.name);
    }
  };

  const initImageCanvas = (img: HTMLImageElement) => {
    const canvas = imageCanvasRef.current;
    const mask = maskCanvasRef.current;
    if (!canvas || !mask) return;

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    mask.width = img.naturalWidth;
    mask.height = img.naturalHeight;

    const ctx = canvas.getContext('2d');
    ctx?.drawImage(img, 0, 0);

    const mCtx = mask.getContext('2d');
    mCtx?.clearRect(0, 0, mask.width, mask.height);

    // Auto-detect common watermark positions
    const autoBoxes = autoDetectImageWatermarkBoxes(canvas);
    setImageBoxes(autoBoxes);
  };

  const handleToggleItem = (id: string) => {
    setWatermarks((prev) =>
      prev.map((w) => (w.id === id ? { ...w, selected: !w.selected } : w))
    );
  };

  const handleToggleSelectAll = (select: boolean) => {
    setWatermarks((prev) => prev.map((w) => ({ ...w, selected: select })));
  };

  // Real Watermark Removal Action
  const handleExecuteRealRemoval = async () => {
    if (!rawBuffer && currentFormat !== 'image') {
      onShowToast('error', '缺少原始文件二进制流', '请先上传或载入有效文档');
      return;
    }

    const selectedIds = watermarks.filter((w) => w.selected).map((w) => w.id);
    if (currentFormat !== 'image' && selectedIds.length === 0) {
      onShowToast('info', '请至少勾选一项水印对象');
      return;
    }

    setIsProcessing(true);
    setProcessStep('正在进行结构抽象语法树 (AST) 遍历...');

    try {
      let result: WatermarkProcessResult;

      if (currentFormat === 'docx') {
        setProcessStep('正在修剪 WordArt 与 Header XML 节点，清理 Relationships 引用...');
        result = await removeDocxWatermarks(rawBuffer!, selectedIds);
      } else if (currentFormat === 'xlsx') {
        setProcessStep('正在清除 Worksheet <picture> 标签与 VML 宏水印...');
        result = await removeXlsxWatermarks(rawBuffer!, selectedIds);
      } else if (currentFormat === 'pdf') {
        setProcessStep('正在剔除 PDF Annotations 字典与 Content Stream 操作符指令...');
        result = await removePdfWatermarks(rawBuffer!, selectedIds);
      } else {
        setProcessStep('正在应用 Telea 快速推进图像修复算法重建背景...');
        if (!imageElement) throw new Error('未加载有效图像元素');
        result = await processImageWatermarkInpainting(imageElement, imageBoxes, loadedFileName);
      }

      setProcessStep('正在重新读取生成文件并执行真实验证检验...');
      setProcessResult(result);

      if (result.verificationReport.isClean) {
        setActiveTab('verify');
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
        });
        onShowToast('vip-free', '去水印完成并通过真实验证！', `已彻底清除目标对象，无损保留正文`);
      } else {
        onShowToast('error', '验证未通过', '文档内仍检测到残留水印对象，已阻止虚假成功提示');
      }
    } catch (err: any) {
      console.error('Removal failed:', err);
      onShowToast('error', '去水印处理异常', err?.message || '处理过程中发生错误');
    } finally {
      setIsProcessing(false);
      setProcessStep('');
    }
  };

  const handleDownloadCleanFile = () => {
    if (!processResult) return;
    const blob = processResult.cleanedBlob || new Blob([processResult.cleanedBytes]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ext = currentFormat === 'docx' ? '.docx' : currentFormat === 'xlsx' ? '.xlsx' : currentFormat === 'pdf' ? '.pdf' : '.png';
    const baseName = loadedFileName.replace(/\.[^/.]+$/, '');
    a.download = `${baseName}_纯净无水印${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onShowToast('success', '已开始下载纯净无水印文件');
  };

  const handleSaveToWorkspace = () => {
    if (!processResult || !activeFile || !onSaveFileContent) return;
    if (activeFile.type === 'pdf') {
      onSaveFileContent(activeFile.id, { ...activeFile.content, pdfBytes: processResult.cleanedBytes }, '去水印引擎已剔除图层对象');
    } else {
      onSaveFileContent(activeFile.id, processResult.cleanedBytes, '去水印引擎真实结构清理');
    }
    onShowToast('success', '已将纯净版本保存至当前工作区文档');
    onClose();
  };

  if (!isOpen) return null;

  const selectedCount = watermarks.filter((w) => w.selected).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div
        id="universal-watermark-studio-modal"
        className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-[#1c1c1e] rounded-3xl shadow-2xl border border-neutral-200/90 dark:border-neutral-700/80 flex flex-col overflow-hidden text-neutral-900 dark:text-neutral-100"
      >
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-850/40">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 dark:bg-amber-500/25 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-2xs">
              <Eraser className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold">Mianay 智能去水印引擎</h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold flex items-center space-x-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>真实结构解析 · 杜绝模拟</span>
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                支持 DOCX / XLSX / PDF / 图像格式对象级物理剥离与无损像素修复
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-750 text-neutral-700 dark:text-neutral-200 transition-colors"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>载入其他文件</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx, .xlsx, .pdf, .png, .jpg, .jpeg, .webp"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Format Selector & Navigation Tabs */}
        <div className="px-6 py-2.5 border-b border-neutral-200/60 dark:border-neutral-800/80 bg-white dark:bg-[#1c1c1e] flex items-center justify-between text-xs">
          <div className="flex items-center space-x-1 bg-neutral-100 dark:bg-neutral-800/80 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('scan')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === 'scan'
                  ? 'bg-white dark:bg-[#2c2c2e] text-blue-600 dark:text-blue-400 shadow-2xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              <span className="flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5" />
                <span>结构分析 ({watermarks.length})</span>
              </span>
            </button>

            {processResult && (
              <button
                onClick={() => setActiveTab('verify')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  activeTab === 'verify'
                    ? 'bg-white dark:bg-[#2c2c2e] text-emerald-600 dark:text-emerald-400 shadow-2xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                }`}
              >
                <span className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>真实验证报告</span>
                </span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2 text-neutral-500 font-mono text-[11px]">
            <span className="px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 uppercase font-semibold text-neutral-700 dark:text-neutral-300">
              {currentFormat}
            </span>
            <span className="truncate max-w-[200px]">{loadedFileName || '未载入文件'}</span>
          </div>
        </div>

        {/* Modal Body Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[550px] no-scrollbar">
          {isAnalyzing ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3">
              <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
              <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">
                正在深度反编译解析文档结构...
              </span>
              <span className="text-xs text-neutral-400">
                正在分析 OpenXML 节点、PDF 运算符流及图形矩阵
              </span>
            </div>
          ) : activeTab === 'verify' && processResult ? (
            /* Verification Report Card */
            <div className="space-y-4 animate-in fade-in duration-200">
              <div
                className={`p-5 rounded-2xl border ${
                  processResult.verificationReport.isClean
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-800/60'
                    : 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200/80 dark:border-rose-800/60'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      processResult.verificationReport.isClean
                        ? 'bg-emerald-500 text-white'
                        : 'bg-rose-500 text-white'
                    }`}
                  >
                    {processResult.verificationReport.isClean ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                      {processResult.verificationReport.isClean
                        ? '真实结构验证全部通过'
                        : '警告：检测到残留水印'}
                    </h3>
                    <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1">
                      {processResult.verificationReport.message}
                    </p>
                  </div>
                </div>
              </div>

              {/* Detailed Verification Checks */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide">
                  逐项安全检验明细
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  {processResult.verificationReport.checks.map((chk) => (
                    <div
                      key={chk.id}
                      className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200/70 dark:border-neutral-800 flex items-start space-x-2.5"
                    >
                      <div className="mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                          {chk.title}
                        </span>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                          {chk.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : currentFormat === 'image' ? (
            /* Image Inpainting Canvas Mode */
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 flex items-center justify-between text-xs text-blue-800 dark:text-blue-300">
                <div className="flex items-center space-x-2">
                  <Sliders className="w-4 h-4 text-blue-600" />
                  <span>已载入图像，可自动识别或按需涂抹水印区域进行背景重建</span>
                </div>
                <div className="flex items-center space-x-3 font-mono text-[11px]">
                  <span>已选区域: {imageBoxes.length} 个</span>
                </div>
              </div>

              <div className="relative max-h-[360px] overflow-auto border border-neutral-200 dark:border-neutral-800 rounded-2xl bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center p-4">
                <canvas ref={imageCanvasRef} className="max-h-[320px] object-contain rounded-lg shadow-md" />
                <canvas ref={maskCanvasRef} className="hidden" />
              </div>
            </div>
          ) : (
            /* Document XML / PDF Objects List Mode */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                    检测到的结构水印对象 ({watermarks.length})
                  </span>
                  <span className="text-[11px] text-neutral-400">
                    勾选后将进行底层 XML/流重写剥离
                  </span>
                </div>

                {watermarks.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleToggleSelectAll(selectedCount !== watermarks.length)}
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {selectedCount === watermarks.length ? '取消全选' : '全选所有对象'}
                    </button>
                  </div>
                )}
              </div>

              {watermarks.length === 0 ? (
                <div className="p-10 rounded-2xl bg-neutral-50 dark:bg-neutral-850/50 border border-dashed border-neutral-200 dark:border-neutral-800 text-center flex flex-col items-center justify-center space-y-2">
                  <ShieldCheck className="w-8 h-8 text-emerald-500" />
                  <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                    未检测到明显的电子文字水印或背景图层
                  </span>
                  <p className="text-xs text-neutral-400 max-w-sm">
                    文档内部结构清晰无水印，或该文档采用非常规加密方式。
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {watermarks.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleToggleItem(item.id)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start space-x-3 ${
                        item.selected
                          ? 'border-amber-400/80 bg-amber-50/60 dark:bg-amber-950/25 shadow-2xs'
                          : 'border-neutral-200/80 dark:border-neutral-800 hover:border-neutral-300 opacity-60'
                      }`}
                    >
                      <div className="mt-0.5 text-amber-600 dark:text-amber-400 shrink-0">
                        {item.selected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">
                              {item.content}
                            </span>
                            <span className="px-1.5 py-0.2 rounded-md bg-neutral-200/70 dark:bg-neutral-800 text-[10px] font-mono text-neutral-600 dark:text-neutral-300 uppercase">
                              {item.type}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 font-semibold">
                            {Math.round(item.confidence * 100)}% 置信
                          </span>
                        </div>

                        <div className="flex items-center space-x-3 text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                          <span className="font-mono truncate">{item.location}</span>
                          {item.meta.rotation ? <span>旋转: {item.meta.rotation}°</span> : null}
                          {item.meta.relationshipId ? <span>Rel: {item.meta.relationshipId}</span> : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Actions Footer */}
        <div className="px-6 py-4 border-t border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-850/60 flex items-center justify-between">
          <div className="text-xs text-neutral-500">
            {isProcessing ? (
              <div className="flex items-center space-x-2 text-amber-600 dark:text-amber-400 font-medium">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{processStep}</span>
              </div>
            ) : processResult?.verificationReport.isClean ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>已验证处理成功，可保存或直接下载</span>
              </span>
            ) : (
              <span>已选 {selectedCount} 个水印图层待清除</span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {processResult?.verificationReport.isClean ? (
              <>
                {activeFile && (
                  <button
                    onClick={handleSaveToWorkspace}
                    className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-750 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-100 transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>更新至当前文档</span>
                  </button>
                )}
                <button
                  onClick={handleDownloadCleanFile}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all active:scale-[0.98]"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>下载纯净无水印文件</span>
                </button>
              </>
            ) : (
              <button
                onClick={handleExecuteRealRemoval}
                disabled={isProcessing || isAnalyzing || (currentFormat !== 'image' && selectedCount === 0)}
                className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white shadow-xs transition-all ${
                  !isProcessing && !isAnalyzing && (currentFormat === 'image' || selectedCount > 0)
                    ? 'bg-amber-500 hover:bg-amber-600 active:scale-[0.98]'
                    : 'bg-neutral-300 dark:bg-neutral-700 cursor-not-allowed opacity-50'
                }`}
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>正在进行底层物理剔除...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>执行真实结构剔除 ({selectedCount})</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
