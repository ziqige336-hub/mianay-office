import React from 'react';
import { MessageSquare } from 'lucide-react';

export interface CommentObjectViewProps {
  object: {
    id: string;
    author?: string;
    text?: string;
  };
}

export const CommentObjectView: React.FC<CommentObjectViewProps> = ({ object }) => {
  return (
    <div className="w-full h-full flex items-start space-x-1.5 p-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-lg shadow-xs overflow-hidden select-none pointer-events-none">
      <MessageSquare className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
      <div className="text-xs text-amber-900 dark:text-amber-100 font-sans line-clamp-2 leading-tight">
        <span className="font-semibold">{object.author || '用户'}: </span>
        {object.text || '评论便签'}
      </div>
    </div>
  );
};
