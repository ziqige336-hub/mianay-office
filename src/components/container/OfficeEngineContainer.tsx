import React from 'react';
import type {
  OfficeFile,
  FileType,
  ThemeMode,
  DocOutlineItem,
  DocumentModel,
  WorkbookData,
  SheetCell,
} from '../../types';
import { PureDocWorkbench } from '../doc/PureDocWorkbench';
import { PureSheetWorkbench } from '../sheet/PureSheetWorkbench';
import { PdfWorkbench } from '../pdf/PdfWorkbench';

export interface OfficeEngineContainerProps {
  currentFile?: OfficeFile | null;
  activeModule: FileType;
  isActive?: boolean;
  themeMode?: ThemeMode;
  initialContent?: any;
  initialTitle?: string;
  initialModel?: DocumentModel;
  initialJson?: any;
  initialWorkbook?: WorkbookData;
  onDocStatsChange?: (stats: { characters: number; words: number }) => void;
  onOutlineChange?: (outline: DocOutlineItem[]) => void;
  onEditorReady?: (editor: any) => void;
  onChangeContent?: (content: any, title?: string, model?: DocumentModel, json?: any, status?: 'unsaved' | 'saved') => void;
  onChangeWorkbook?: (wb: WorkbookData, status?: 'unsaved' | 'saved') => void;
  onSelectedCellChange?: (info: { r: number; c: number; cellData?: SheetCell; coordLabel: string }) => void;
  onShowToast: (type: 'success' | 'error' | 'info' | 'vip-free', title: string, description?: string) => void;
  onRequestExport?: () => void;
  onDropFile?: (file: File) => void;
  isInspectorOpen?: boolean;
  onToggleInspector?: () => void;
}

export const OfficeEngineContainer: React.FC<OfficeEngineContainerProps> = ({
  currentFile,
  activeModule,
  isActive = true,
  themeMode = 'light',
  initialContent,
  initialTitle,
  initialModel,
  initialJson,
  initialWorkbook,
  isInspectorOpen,
  onToggleInspector,
  onDocStatsChange,
  onOutlineChange,
  onEditorReady,
  onChangeContent,
  onChangeWorkbook,
  onSelectedCellChange,
  onShowToast,
  onRequestExport,
}) => {
  return (
    <div id="office-engine-container" className="flex-1 flex flex-col h-full overflow-hidden bg-[#fbfbfd] dark:bg-[#121214]">
      {/* Main Core Workbench Viewport */}
      <div id="office-engine-viewport" className="flex-1 relative overflow-hidden flex flex-col min-h-0 min-w-0 w-full h-full">
        {activeModule === 'doc' && (
          <PureDocWorkbench
            currentFile={currentFile || undefined}
            initialContent={initialContent}
            initialTitle={initialTitle || currentFile?.name}
            initialModel={initialModel || (currentFile?.content && typeof currentFile.content === 'object' && 'nodes' in currentFile.content ? (currentFile.content as DocumentModel) : undefined)}
            initialJson={initialJson || (currentFile?.content && typeof currentFile.content === 'object' && 'type' in currentFile.content && (currentFile.content as any).type === 'doc' ? currentFile.content : undefined)}
            isActive={isActive}
            themeMode={themeMode}
            isInspectorOpen={isInspectorOpen}
            onToggleInspector={onToggleInspector}
            onDocStatsChange={onDocStatsChange}
            onOutlineChange={onOutlineChange}
            onEditorReady={onEditorReady}
            onChangeContent={onChangeContent}
            onShowToast={onShowToast}
            onRequestExport={onRequestExport}
          />
        )}

        {activeModule === 'sheet' && (
          <PureSheetWorkbench
            currentFile={currentFile || undefined}
            initialWorkbook={initialWorkbook || (currentFile?.content as WorkbookData)}
            isActive={isActive}
            themeMode={themeMode}
            onSelectedCellChange={onSelectedCellChange}
            onChangeWorkbook={onChangeWorkbook}
            onShowToast={onShowToast}
            onRequestExport={onRequestExport}
          />
        )}

        {activeModule === 'pdf' && (
          <PdfWorkbench
            fileId={currentFile?.id}
            fileName={currentFile?.name}
            currentFile={currentFile}
            isActive={isActive}
            onShowToast={onShowToast}
          />
        )}
      </div>
    </div>
  );
};

export default OfficeEngineContainer;
