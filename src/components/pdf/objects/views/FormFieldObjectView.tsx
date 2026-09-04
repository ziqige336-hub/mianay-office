import React from 'react';

export interface FormFieldObjectViewProps {
  object: {
    id: string;
    fieldType?: 'text' | 'checkbox' | 'radio' | 'dropdown';
    fieldName?: string;
    fieldValue?: any;
    options?: string[];
  };
}

export const FormFieldObjectView: React.FC<FormFieldObjectViewProps> = ({ object }) => {
  const { fieldType = 'text', fieldName = 'field', fieldValue = '', options = [] } = object;

  if (fieldType === 'checkbox') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-blue-50/60 dark:bg-blue-950/40 border border-blue-400 rounded-sm pointer-events-none select-none">
        {fieldValue ? <span className="text-blue-600 font-bold text-xs">✓</span> : null}
      </div>
    );
  }

  if (fieldType === 'radio') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-blue-50/60 dark:bg-blue-950/40 border border-blue-400 rounded-full pointer-events-none select-none">
        {fieldValue ? <div className="w-2 h-2 rounded-full bg-blue-600" /> : null}
      </div>
    );
  }

  if (fieldType === 'dropdown') {
    return (
      <div className="w-full h-full flex items-center justify-between px-2 bg-blue-50/40 dark:bg-blue-950/30 border border-blue-400/80 rounded-sm pointer-events-none select-none text-[11px] text-neutral-700 dark:text-neutral-200">
        <span className="truncate">{fieldValue || options[0] || fieldName}</span>
        <span className="text-[9px] text-neutral-400">▼</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center px-1.5 bg-blue-50/40 dark:bg-blue-950/30 border border-blue-400/80 rounded-sm pointer-events-none select-none text-xs text-neutral-700 dark:text-neutral-200">
      <span className="truncate">{fieldValue || fieldName || '输入框'}</span>
    </div>
  );
};
