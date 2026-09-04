import React, { useState } from 'react';
import {
  X,
  Lock,
  Key,
  Printer,
  Copy,
  Edit,
  ShieldCheck,
  Check,
} from 'lucide-react';
import type { SecurityConfig } from '../../../types';

interface PdfSecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: SecurityConfig;
  onChangeConfig: (cfg: Partial<SecurityConfig>) => void;
  onApplySecurity: () => void;
}

export const PdfSecurityModal: React.FC<PdfSecurityModalProps> = ({
  isOpen,
  onClose,
  config,
  onChangeConfig,
  onApplySecurity,
}) => {
  if (!isOpen) return null;

  return (
    <div
      data-no-canvas-click="true"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in"
    >
      <div className="w-full max-w-md bg-white dark:bg-[#1e1e20] rounded-2xl shadow-2xl border border-black/[0.08] dark:border-white/[0.1] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Lock className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              PDF 文档加密与权限保护
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Password toggle */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                设置打开文档口令
              </span>
              <input
                type="checkbox"
                checked={config.hasPassword}
                onChange={(e) => onChangeConfig({ hasPassword: e.target.checked })}
                className="w-4 h-4 accent-rose-600 rounded cursor-pointer"
              />
            </div>

            {config.hasPassword && (
              <div className="space-y-2">
                <input
                  type="password"
                  value={config.userPassword || ''}
                  onChange={(e) => onChangeConfig({ userPassword: e.target.value })}
                  placeholder="请输入文档打开密码"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.1] text-neutral-900 dark:text-neutral-100"
                />
              </div>
            )}
          </div>

          {/* Permissions */}
          <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.08] space-y-2.5">
            <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 block">
              权限限制选项
            </span>

            <label className="flex items-center justify-between p-2.5 bg-black/[0.02] dark:bg-white/[0.04] rounded-xl cursor-pointer">
              <div className="flex items-center space-x-2">
                <Printer className="w-3.5 h-3.5 text-neutral-500" />
                <span className="text-xs text-neutral-700 dark:text-neutral-300">允许高清晰度打印</span>
              </div>
              <input
                type="checkbox"
                checked={config.allowPrinting}
                onChange={(e) => onChangeConfig({ allowPrinting: e.target.checked })}
                className="w-4 h-4 accent-rose-600 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-2.5 bg-black/[0.02] dark:bg-white/[0.04] rounded-xl cursor-pointer">
              <div className="flex items-center space-x-2">
                <Copy className="w-3.5 h-3.5 text-neutral-500" />
                <span className="text-xs text-neutral-700 dark:text-neutral-300">允许复制文本与图片内容</span>
              </div>
              <input
                type="checkbox"
                checked={config.allowCopying}
                onChange={(e) => onChangeConfig({ allowCopying: e.target.checked })}
                className="w-4 h-4 accent-rose-600 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-2.5 bg-black/[0.02] dark:bg-white/[0.04] rounded-xl cursor-pointer">
              <div className="flex items-center space-x-2">
                <Edit className="w-3.5 h-3.5 text-neutral-500" />
                <span className="text-xs text-neutral-700 dark:text-neutral-300">允许修改或注释文档</span>
              </div>
              <input
                type="checkbox"
                checked={config.allowModifying}
                onChange={(e) => onChangeConfig({ allowModifying: e.target.checked })}
                className="w-4 h-4 accent-rose-600 rounded"
              />
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-black/[0.02] dark:bg-white/[0.02] border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-black/[0.04]"
          >
            取消
          </button>
          <button
            onClick={() => {
              onApplySecurity();
              onClose();
            }}
            className="px-4 py-1.5 rounded-lg text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white shadow-xs flex items-center space-x-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>应用安全策略</span>
          </button>
        </div>
      </div>
    </div>
  );
};
