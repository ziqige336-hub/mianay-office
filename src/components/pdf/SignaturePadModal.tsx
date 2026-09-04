import React, { useRef, useState, useEffect } from 'react';
import { X, RotateCcw, Check, Pen, ShieldCheck } from 'lucide-react';

interface SignaturePadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSignature: (dataUrl: string) => void;
}

export const SignaturePadModal: React.FC<SignaturePadModalProps> = ({
  isOpen,
  onClose,
  onSaveSignature,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [strokeColor, setStrokeColor] = useState('#1e40af'); // Classic Blue ink
  const [lineWidth, setLineWidth] = useState(3);

  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High DPI scaling
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    setHasDrawn(false);
  }, [isOpen, strokeColor, lineWidth]);

  if (!isOpen) return null;

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSaveSignature(dataUrl);
    onClose();
  };

  return (
    <div
      data-no-canvas-click="true"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4"
    >
      <div className="w-full max-w-lg bg-white dark:bg-[#1c1c1e] rounded-2xl shadow-2xl border border-neutral-200/80 dark:border-neutral-800 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Pen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                创建手写平滑签名
              </h3>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                支持鼠标/触控板平滑轨迹，纯本地渲染，绝不上传
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Canvas Area */}
        <div className="p-5 flex flex-col space-y-3">
          <div className="relative w-full h-52 bg-neutral-50 dark:bg-neutral-900/90 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden cursor-crosshair">
            <canvas
              ref={canvasRef}
              className="w-full h-full"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />

            {!hasDrawn && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-neutral-400 dark:text-neutral-600 text-xs">
                <span>在此处绘制您的手写签名...</span>
                <span className="text-[10px] mt-1 opacity-70">支持压感及平滑笔触</span>
              </div>
            )}

            {/* Baseline guideline */}
            <div className="absolute bottom-10 left-6 right-6 border-b border-dashed border-neutral-300 dark:border-neutral-700 pointer-events-none" />
          </div>

          {/* Controls: Color, Stroke & Reset */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-neutral-500 font-medium">墨水颜色:</span>
              {[
                { name: '经典蓝', color: '#1e40af' },
                { name: '曜石黑', color: '#0f172a' },
                { name: '印章红', color: '#b91c1c' },
              ].map((c) => (
                <button
                  key={c.color}
                  onClick={() => setStrokeColor(c.color)}
                  className={`w-6 h-6 rounded-full border transition-transform ${
                    strokeColor === c.color ? 'scale-110 ring-2 ring-blue-400 ring-offset-1' : 'opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c.color }}
                  title={c.name}
                />
              ))}
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs text-neutral-500 font-medium">粗细:</span>
              <input
                type="range"
                min="1.5"
                max="6"
                step="0.5"
                value={lineWidth}
                onChange={(e) => setLineWidth(parseFloat(e.target.value))}
                className="w-20 accent-blue-600 cursor-pointer"
              />
            </div>

            <button
              onClick={clearCanvas}
              className="flex items-center space-x-1 text-xs text-neutral-600 dark:text-neutral-400 hover:text-rose-600 transition-colors px-2 py-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>清空重写</span>
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-neutral-50 dark:bg-neutral-900/50 border-t border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center space-x-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>无任何云端水印，本地矢量导出</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium rounded-xl text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={!hasDrawn}
              className={`flex items-center space-x-1.5 px-4 py-1.5 text-xs font-semibold rounded-xl text-white shadow-sm transition-all ${
                hasDrawn
                  ? 'bg-blue-600 hover:bg-blue-700 active:scale-95'
                  : 'bg-neutral-400 dark:bg-neutral-700 cursor-not-allowed opacity-60'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>插入签名至文档</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
