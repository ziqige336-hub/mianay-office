import React, { useState, useEffect } from 'react';
import {
  Cpu,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Zap,
  FileText,
  Table,
  Layers,
  Terminal,
  X,
  Play,
  ShieldCheck,
  Check,
  Server,
  Monitor,
} from 'lucide-react';
import { officeEngine } from '../../core/office';
import type { OfficeEngineStatus, EngineVerifyResult } from '../../core/engine/types';

interface EngineStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (type: 'success' | 'error' | 'info' | 'vip-free', title: string, description?: string) => void;
}

export const EngineStatusModal: React.FC<EngineStatusModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
}) => {
  const [status, setStatus] = useState<OfficeEngineStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<EngineVerifyResult | null>(null);

  const fetchStatus = async () => {
    setIsLoading(true);
    try {
      const data = await officeEngine.getEngineStatus(true);
      setStatus(data);
    } catch (err: any) {
      onShowToast('error', '获取引擎状态失败', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunVerification = async () => {
    setIsVerifying(true);
    try {
      const result = await officeEngine.verifyEngine();
      setVerifyResult(result);
      onShowToast('success', '引擎诊断完成', result.message);
    } catch (err: any) {
      onShowToast('error', '诊断失败', err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isElectron = officeEngine.isElectron();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#1c1c1e] text-neutral-900 dark:text-neutral-100 rounded-2xl shadow-2xl border border-neutral-200/80 dark:border-neutral-800 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight">Office 桌面原生排版引擎</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Electron + LibreOffice Writer / Calc Core + Native PDF Pipeline
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Status Badge Group */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/60 dark:border-neutral-700/50 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500 font-medium">引擎架构</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" />
                  已就绪
                </span>
              </div>
              <div className="text-sm font-semibold mt-1">
                {status?.engine || 'LibreOffice Desktop Engine'}
              </div>
              <div className="text-xs text-neutral-400 font-mono">
                {status?.version || '7.4.7'} ({status?.platform || 'linux'})
              </div>
            </div>

            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/60 dark:border-neutral-700/50 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500 font-medium">执行模式</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  {isElectron ? <Monitor className="w-3 h-3" /> : <Server className="w-3 h-3" />}
                  {isElectron ? 'Electron Native' : 'Container Engine'}
                </span>
              </div>
              <div className="text-sm font-semibold mt-1">
                {isElectron ? '桌面原生 IPC 桥接' : 'Linux 原生二进制守护'}
              </div>
              <div className="text-xs text-neutral-400">
                100% 本地高保真渲染
              </div>
            </div>
          </div>

          {/* Engine Capability List */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-neutral-600 dark:text-neutral-300 uppercase tracking-wider">
              桌面级模块与排版滤镜
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50/70 dark:bg-neutral-800/30 border border-neutral-200/50 dark:border-neutral-800 text-xs">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-blue-500" />
                  <div>
                    <div className="font-medium text-neutral-800 dark:text-neutral-200">Pure Doc (Writer 核心)</div>
                    <div className="text-[11px] text-neutral-400">Office Open XML Text &bull; writer_pdf_Export</div>
                  </div>
                </div>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> 微软/WPS 一致
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50/70 dark:bg-neutral-800/30 border border-neutral-200/50 dark:border-neutral-800 text-xs">
                <div className="flex items-center gap-2.5">
                  <Table className="w-4 h-4 text-emerald-500" />
                  <div>
                    <div className="font-medium text-neutral-800 dark:text-neutral-200">Pure Sheet (Calc 核心)</div>
                    <div className="text-[11px] text-neutral-400">Calc Office Open XML &bull; calc_pdf_Export</div>
                  </div>
                </div>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> 官方标准 XLSX
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50/70 dark:bg-neutral-800/30 border border-neutral-200/50 dark:border-neutral-800 text-xs">
                <div className="flex items-center gap-2.5">
                  <Layers className="w-4 h-4 text-purple-500" />
                  <div>
                    <div className="font-medium text-neutral-800 dark:text-neutral-200">PDF 高保真统一导出</div>
                    <div className="text-[11px] text-neutral-400">完整嵌入 CJK / DejaVu / Liberation 字体库</div>
                  </div>
                </div>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> 原生排版
                </span>
              </div>
            </div>
          </div>

          {/* Verification Results Panel */}
          {verifyResult && (
            <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 text-xs space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between font-semibold text-emerald-800 dark:text-emerald-300">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  诊断测试结果 ({verifyResult.durationMs}ms)
                </span>
                <span className="text-[11px] bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded-md">
                  全部通过
                </span>
              </div>
              <p className="text-emerald-700 dark:text-emerald-400/90 leading-relaxed">
                {verifyResult.message}
              </p>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-200/60 dark:border-emerald-800/40 text-[11px] text-emerald-700 dark:text-emerald-400">
                <div>Writer DOCX: {(verifyResult.writer.docxSize / 1024).toFixed(1)} KB</div>
                <div>Writer PDF: {(verifyResult.writer.pdfSize / 1024).toFixed(1)} KB</div>
                <div>Calc XLSX: {(verifyResult.calc.xlsxSize / 1024).toFixed(1)} KB</div>
                <div>Calc PDF: {(verifyResult.calc.pdfSize / 1024).toFixed(1)} KB</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 bg-neutral-50/80 dark:bg-neutral-900/60 border-t border-neutral-100 dark:border-neutral-800">
          <button
            onClick={fetchStatus}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            刷新状态
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 rounded-xl transition-colors"
            >
              关闭
            </button>
            <button
              onClick={handleRunVerification}
              disabled={isVerifying}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-xl transition-colors shadow-sm disabled:opacity-50"
            >
              {isVerifying ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              {isVerifying ? '正在执行双向验证...' : '运行双向引擎诊断'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
