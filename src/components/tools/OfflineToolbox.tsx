import React, { useState, useRef } from 'react';
import {
  Wrench,
  ScanText,
  Image as ImageIcon,
  FileCode,
  UploadCloud,
  Copy,
  Check,
  Download,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Sliders,
  FileText,
} from 'lucide-react';
import { runRealTesseractOcr, compressImageClientSide } from '../../utils/ocrEngine';
import { convertImagesToPdf } from '../../utils/pdfLibWrapper';
import { formatBytes } from '../../utils/pdfLibWrapper';
import type { ImageCompressItem } from '../../types';

interface OfflineToolboxProps {
  onExportToDoc?: (text: string) => void;
  onShowToast: (type: 'success' | 'error' | 'info' | 'vip-free', title: string, description?: string) => void;
}

export const OfflineToolbox: React.FC<OfflineToolboxProps> = ({
  onExportToDoc,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'ocr' | 'compress' | 'images-to-pdf'>('ocr');

  // OCR state
  const [ocrImage, setOcrImage] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState<string>('');
  const [ocrLanguage, setOcrLanguage] = useState<string>('chi_sim+eng');
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrProgressText, setOcrProgressText] = useState('');
  const [copied, setCopied] = useState(false);

  // Image compressor state
  const [compressItems, setCompressItems] = useState<ImageCompressItem[]>([]);
  const [quality, setQuality] = useState<number>(0.8);
  const [targetFormat, setTargetFormat] = useState<'image/jpeg' | 'image/png' | 'image/webp'>('image/jpeg');
  const [isCompressingAll, setIsCompressingAll] = useState(false);

  // Images to PDF state
  const [imageFilesToMerge, setImageFilesToMerge] = useState<File[]>([]);
  const [isMergingPdf, setIsMergingPdf] = useState(false);

  const ocrInputRef = useRef<HTMLInputElement>(null);
  const compressInputRef = useRef<HTMLInputElement>(null);
  const imagesToPdfInputRef = useRef<HTMLInputElement>(null);

  // Real Tesseract OCR Handler
  const handleOcrFile = async (file: File) => {
    const previewUrl = URL.createObjectURL(file);
    setOcrImage(previewUrl);
    setIsOcrProcessing(true);
    setOcrText('');
    setOcrProgress(0.05);
    setOcrProgressText('正在启动 Tesseract WebAssembly 引擎...');

    try {
      const result = await runRealTesseractOcr(file, ocrLanguage, (progress, status) => {
        setOcrProgress(progress);
        setOcrProgressText(status);
      });

      setOcrText(result.text || '（未识别到明显文字，请尝试提高对比度或更换清晰图像）');
      onShowToast('success', 'OCR 识别完成', `置信度: ${(result.confidence * 100).toFixed(0)}%`);
    } catch (err: any) {
      console.error(err);
      onShowToast('error', 'OCR 识别失败', err?.message || '引擎初始化异常');
    } finally {
      setIsOcrProcessing(false);
    }
  };

  const handleCopyText = () => {
    if (!ocrText) return;
    navigator.clipboard.writeText(ocrText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onShowToast('success', '已复制文字至剪贴板');
  };

  const handleImportToDoc = () => {
    if (!ocrText) return;
    const htmlFormatted = ocrText
      .split('\n\n')
      .map((para) => `<p>${para.replace(/\n/g, '<br/>')}</p>`)
      .join('');
    onExportToDoc?.(htmlFormatted);
    onShowToast('success', '已导入到 Pure Doc 文稿', '切换至文稿编辑器继续排版');
  };

  // Image compressor handlers
  const handleAddCompressFiles = (files: FileList | null) => {
    if (!files) return;
    const newItems: ImageCompressItem[] = Array.from(files).map((f) => ({
      id: `img-${Date.now()}-${Math.random()}`,
      file: f,
      name: f.name,
      originalSize: f.size,
      previewUrl: URL.createObjectURL(f),
      status: 'pending',
      quality,
      format: targetFormat,
    }));
    setCompressItems((prev) => [...prev, ...newItems]);
  };

  const handleRunBatchCompress = async () => {
    setIsCompressingAll(true);
    const updated = [...compressItems];

    for (let i = 0; i < updated.length; i++) {
      const item = updated[i];
      try {
        const res = await compressImageClientSide(item.file, quality, targetFormat);
        item.compressedSize = res.blob.size;
        item.compressedUrl = res.dataUrl;
        item.status = 'done';
      } catch (err) {
        item.status = 'error';
      }
    }

    setCompressItems([...updated]);
    setIsCompressingAll(false);
    onShowToast('success', '批量压缩完成', '体积已大幅缩减');
  };

  // Merge images to PDF handler
  const handleMergeToPdf = async () => {
    if (imageFilesToMerge.length === 0) return;
    setIsMergingPdf(true);
    try {
      const pdfBytes = await convertImagesToPdf(imageFilesToMerge);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `合并图像文档.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      onShowToast('success', '图片已成功合成为高分辨率 PDF');
    } catch (e) {
      console.error(e);
      onShowToast('error', '图片合成 PDF 失败');
    } finally {
      setIsMergingPdf(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-[#f5f5f7] dark:bg-[#121214] select-none min-h-0 min-w-0">
      {/* Top Segment Controller */}
      <div className="h-11 w-full bg-white/90 dark:bg-[#1c1c1e]/90 backdrop-blur-xl border-b border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between px-6 z-10">
        <div className="flex items-center space-x-2">
          <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-lg border border-neutral-200/70 dark:border-neutral-700/60 text-xs">
            <button
              onClick={() => setActiveTab('ocr')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-md font-medium transition-all ${
                activeTab === 'ocr'
                  ? 'bg-white dark:bg-neutral-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400'
              }`}
            >
              <ScanText className="w-3.5 h-3.5" />
              <span>本地离线 OCR</span>
            </button>

            <button
              onClick={() => setActiveTab('compress')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-md font-medium transition-all ${
                activeTab === 'compress'
                  ? 'bg-white dark:bg-neutral-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>图片批量压缩</span>
            </button>

            <button
              onClick={() => setActiveTab('images-to-pdf')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-md font-medium transition-all ${
                activeTab === 'images-to-pdf'
                  ? 'bg-white dark:bg-neutral-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>多图合成 PDF</span>
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 text-xs text-neutral-500 font-mono">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Tesseract v5 WebAssembly · 本地运行</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-8 flex justify-center">
        {/* Tab 1: OCR */}
        {activeTab === 'ocr' && (
          <div className="w-full max-w-5xl grid grid-cols-2 gap-6 items-start">
            <input
              ref={ocrInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && handleOcrFile(e.target.files[0])}
              className="hidden"
            />

            {/* Left: Upload / Image preview */}
            <div className="bg-white dark:bg-[#1a1a1c] p-6 rounded-2xl paper-shadow border border-neutral-200/70 dark:border-neutral-800 flex flex-col space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  输入图像源
                </span>
                <div className="flex items-center space-x-2">
                  <select
                    value={ocrLanguage}
                    onChange={(e) => setOcrLanguage(e.target.value)}
                    className="text-xs px-2 py-1 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800"
                  >
                    <option value="chi_sim+eng">中文 + 英文</option>
                    <option value="chi_sim">仅简体中文</option>
                    <option value="eng">仅英文</option>
                  </select>
                  {ocrImage && (
                    <button
                      onClick={() => ocrInputRef.current?.click()}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      更换
                    </button>
                  )}
                </div>
              </div>

              {ocrImage ? (
                <div className="w-full h-96 bg-neutral-100 dark:bg-neutral-900 rounded-xl overflow-hidden flex items-center justify-center p-3 border border-neutral-200 dark:border-neutral-800">
                  <img src={ocrImage} alt="OCR Source" className="max-h-full max-w-full object-contain" />
                </div>
              ) : (
                <div
                  onClick={() => ocrInputRef.current?.click()}
                  className="w-full h-96 bg-neutral-50 dark:bg-neutral-900/60 rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 flex flex-col items-center justify-center space-y-3 cursor-pointer hover:border-blue-400 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    点击或拖拽上传图片进行 OCR 提取
                  </span>
                  <span className="text-[10px] text-neutral-400">支持 PNG, JPG, WebP 扫描图</span>
                </div>
              )}
            </div>

            {/* Right: OCR Result Output */}
            <div className="bg-white dark:bg-[#1a1a1c] p-6 rounded-2xl paper-shadow border border-neutral-200/70 dark:border-neutral-800 flex flex-col space-y-4 h-full">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  识别结果
                </span>
                {ocrText && (
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={handleCopyText}
                      className="flex items-center space-x-1 text-xs text-neutral-600 dark:text-neutral-300 hover:text-blue-600"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? '已复制' : '复制'}</span>
                    </button>
                    <button
                      onClick={handleImportToDoc}
                      className="flex items-center space-x-1 text-xs px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-xs"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>导入到 Pure Doc 排版</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="relative flex-1 min-h-[380px]">
                {isOcrProcessing ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 bg-white/90 dark:bg-[#1a1a1c]/90 rounded-xl p-6">
                    <RefreshCw className="w-7 h-7 text-blue-600 animate-spin" />
                    <div className="w-full max-w-xs space-y-2">
                      <div className="h-2 w-full bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 transition-all duration-300"
                          style={{ width: `${Math.round(ocrProgress * 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-neutral-500 font-mono">
                        <span>{ocrProgressText}</span>
                        <span>{Math.round(ocrProgress * 100)}%</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <textarea
                    rows={15}
                    value={ocrText}
                    onChange={(e) => setOcrText(e.target.value)}
                    placeholder="识别完成后的文本将直接在此显示，可进行修改编辑或一键导入 Pure Doc 文稿..."
                    className="w-full h-full p-4 bg-neutral-50 dark:bg-neutral-900/60 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs leading-relaxed text-neutral-900 dark:text-neutral-100 font-sans focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Compress */}
        {activeTab === 'compress' && (
          <div className="w-full max-w-4xl bg-white dark:bg-[#1a1a1c] p-6 rounded-2xl paper-shadow border border-neutral-200/70 dark:border-neutral-800 flex flex-col space-y-6">
            <input
              ref={compressInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => handleAddCompressFiles(e.target.files)}
              className="hidden"
            />

            <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-900/60 rounded-xl border border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    压缩质量:
                  </span>
                  <input
                    type="range"
                    min="0.2"
                    max="0.95"
                    step="0.05"
                    value={quality}
                    onChange={(e) => setQuality(parseFloat(e.target.value))}
                    className="w-28 accent-blue-600 cursor-pointer"
                  />
                  <span className="text-xs font-mono font-bold text-blue-600">
                    {Math.round(quality * 100)}%
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    输出格式:
                  </span>
                  <select
                    value={targetFormat}
                    onChange={(e: any) => setTargetFormat(e.target.value)}
                    className="text-xs px-2.5 py-1 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
                  >
                    <option value="image/jpeg">JPEG (体积最小)</option>
                    <option value="image/webp">WebP (高压缩比)</option>
                    <option value="image/png">PNG (保留透明)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => compressInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-medium hover:bg-neutral-300 transition-colors"
                >
                  添加图片
                </button>
                <button
                  onClick={handleRunBatchCompress}
                  disabled={compressItems.length === 0 || isCompressingAll}
                  className="flex items-center space-x-1.5 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
                >
                  {isCompressingAll ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>批量压缩 ({compressItems.length})</span>
                </button>
              </div>
            </div>

            <div className="space-y-2.5 max-h-[420px] overflow-y-auto">
              {compressItems.length === 0 ? (
                <div
                  onClick={() => compressInputRef.current?.click()}
                  className="p-12 rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-800 flex flex-col items-center justify-center space-y-2 cursor-pointer hover:border-blue-400 transition-colors text-center"
                >
                  <ImageIcon className="w-8 h-8 text-neutral-400" />
                  <span className="text-xs text-neutral-600 dark:text-neutral-400 font-medium">
                    点击选择需要批量压缩的图片
                  </span>
                </div>
              ) : (
                compressItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40"
                  >
                    <div className="flex items-center space-x-3">
                      <img src={item.previewUrl} alt="" className="w-10 h-10 object-cover rounded-lg" />
                      <div>
                        <span className="text-xs font-medium text-neutral-900 dark:text-neutral-100 block max-w-xs truncate">
                          {item.name}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-mono">
                          原大小: {formatBytes(item.originalSize)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      {item.compressedSize && (
                        <div className="text-right">
                          <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {formatBytes(item.compressedSize)}
                          </span>
                          <span className="text-[10px] text-neutral-400 block font-mono">
                            节省 {(100 - (item.compressedSize / item.originalSize) * 100).toFixed(0)}%
                          </span>
                        </div>
                      )}

                      {item.compressedUrl && (
                        <a
                          href={item.compressedUrl}
                          download={`compressed_${item.name}`}
                          className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-400 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Images to PDF */}
        {activeTab === 'images-to-pdf' && (
          <div className="w-full max-w-3xl bg-white dark:bg-[#1a1a1c] p-6 rounded-2xl paper-shadow border border-neutral-200/70 dark:border-neutral-800 flex flex-col space-y-6">
            <input
              ref={imagesToPdfInputRef}
              type="file"
              multiple
              accept="image/png, image/jpeg, image/jpg"
              onChange={(e) => e.target.files && setImageFilesToMerge(Array.from(e.target.files))}
              className="hidden"
            />

            <div className="text-center space-y-1">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                多张图片一键合成为 PDF
              </h3>
              <p className="text-xs text-neutral-500">按原有分辨率无损嵌入，不产生多余白边</p>
            </div>

            <div
              onClick={() => imagesToPdfInputRef.current?.click()}
              className="p-8 rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-800 flex flex-col items-center justify-center space-y-2 cursor-pointer hover:border-blue-400 transition-colors text-center"
            >
              <UploadCloud className="w-8 h-8 text-blue-500" />
              <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                {imageFilesToMerge.length > 0
                  ? `已选取 ${imageFilesToMerge.length} 张图片，点击可重新选择`
                  : '点击或拖拽多张图片至此处'}
              </span>
            </div>

            {imageFilesToMerge.length > 0 && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-neutral-500 font-mono">
                  已就绪 {imageFilesToMerge.length} 张图片
                </span>
                <button
                  onClick={handleMergeToPdf}
                  disabled={isMergingPdf}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all"
                >
                  {isMergingPdf ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  <span>立即生成并下载 PDF</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
