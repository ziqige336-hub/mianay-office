import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'vip-free';
  title: string;
  description?: string;
}

interface NotificationToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-2 max-w-sm pointer-events-none select-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 15, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.15 } }}
            className="pointer-events-auto flex items-start space-x-3 p-3.5 rounded-2xl shadow-2xl border backdrop-blur-2xl bg-neutral-900/92 dark:bg-[#1f1f23]/95 text-white border-neutral-700/50"
          >
            <div className="mt-0.5 shrink-0">
              {t.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-400" />
              ) : t.type === 'success' || t.type === 'vip-free' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <Info className="w-4 h-4 text-blue-400" />
              )}
            </div>

            <div className="flex-1 pr-2">
              <h4 className="text-xs font-semibold tracking-tight">{t.title}</h4>
              {t.description && (
                <p className="text-[11px] text-neutral-300 mt-0.5 leading-relaxed font-normal">
                  {t.description}
                </p>
              )}
            </div>

            <button
              onClick={() => onDismiss(t.id)}
              className="text-neutral-400 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
