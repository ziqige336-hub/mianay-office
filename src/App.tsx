import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { AppModule, SheetCell, OfficeFile, FileType, HomeViewFilter, VersionHistoryItem, DocOutlineItem, DocumentModel } from './types';
import { TitleBar } from './components/layout/TitleBar';
import { TabBar } from './components/layout/TabBar';
import { Sidebar } from './components/layout/Sidebar';
import { Inspector } from './components/layout/Inspector';
import { NotificationToast, type ToastMessage } from './components/layout/NotificationToast';
import { HomeWorkspace } from './components/home/HomeWorkspace';
import { PdfWorkbench } from './components/pdf/PdfWorkbench';
import { OfficeEngineContainer } from './components/container/OfficeEngineContainer';
import { PureDocWorkbench } from './components/doc/PureDocWorkbench';
import { PureSheetWorkbench } from './components/sheet/PureSheetWorkbench';
import { OfflineToolbox } from './components/tools/OfflineToolbox';
import { ExportImageModal } from './components/export/ExportImageModal';
import { ExportPdfModal } from './components/export/ExportPdfModal';
import { ExportDialog, type ExportFormatType } from './components/export/ExportDialog';
import { UniversalWatermarkModal } from './components/watermark/UniversalWatermarkModal';
import { DocumentPropertiesModal } from './components/properties/DocumentPropertiesModal';
import { OcrResultModal } from './components/ocr/OcrResultModal';
import { EngineStatusModal } from './components/engine/EngineStatusModal';
import { UnsavedChangesModal } from './components/common/UnsavedChangesModal';
import { windowManager } from './services/windowManager';
import { unsavedChangesManager } from './core/unsaved/UnsavedChangesManager';
import { commandDispatcher } from './core/commands';
import { featureExecutionEngine } from './core/execution/FeatureExecutionEngine';
import { DocxParser } from './core/document/DocxParser';
import { importXlsxToWorkbook } from './utils/sheetUtils';
import type { OcrResult } from './types';
import {
  loadAllFiles,
  saveAllFiles,
  createNewFile,
  updateFileContent,
  toggleFavoriteFile,
  toggleTrashFile,
  permanentlyDeleteFile,
} from './utils/fileStorage';
import { DocumentSessionManager } from './core/document';
import { useDocumentManager } from './core/document/DocumentManager';

export default function App() {
  const { activeSession: activePdfSession, closeDocument: closePdfSession } = useDocumentManager();

  // Document store state
  const [allFiles, setAllFiles] = useState<OfficeFile[]>(() => loadAllFiles());
  const [openFiles, setOpenFiles] = useState<OfficeFile[]>(() => {
    const loaded = loadAllFiles();
    return loaded.filter((f) => !f.isTrash).slice(0, 3);
  });
  const [activeFileId, setActiveFileId] = useState<string | null>(() => {
    const loaded = loadAllFiles();
    const firstNonTrash = loaded.find((f) => !f.isTrash);
    return firstNonTrash ? firstNonTrash.id : null;
  });

  const [homeFilter, setHomeFilter] = useState<HomeViewFilter>('all');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Export Modal states
  const [isEngineStatusModalOpen, setIsEngineStatusModalOpen] = useState<boolean>(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState<boolean>(false);
  const [exportDialogFormat, setExportDialogFormat] = useState<ExportFormatType>('pdf');
  const [isExportImageModalOpen, setIsExportImageModalOpen] = useState<boolean>(false);
  const [isExportPdfModalOpen, setIsExportPdfModalOpen] = useState<boolean>(false);
  const [isDocPropertiesModalOpen, setIsDocPropertiesModalOpen] = useState<boolean>(false);
  const [isOcrResultModalOpen, setIsOcrResultModalOpen] = useState<boolean>(false);
  const [ocrModalResult, setOcrModalResult] = useState<OcrResult | null>(null);
  const [isOcrLoading, setIsOcrLoading] = useState<boolean>(false);
  const [ocrProgressMsg, setOcrProgressMsg] = useState<string>('');

  // Dropped file state
  const [droppedFile, setDroppedFile] = useState<File | null>(null);

  // Inspector & Editor sync states
  const [docOutline, setDocOutline] = useState<DocOutlineItem[]>([]);
  const [docEditorInstance, setDocEditorInstance] = useState<any>(null);
  const [docStats, setDocStats] = useState<{ characters: number; words: number }>({ characters: 0, words: 0 });

  // Sheet inspector state
  const [selectedSheetCell, setSelectedSheetCell] = useState<{
    r: number;
    c: number;
    cellData?: SheetCell;
    coordLabel: string;
  }>({ r: 0, c: 0, coordLabel: 'A1' });

  // PDF inspector state
  const [selectedPdfAnnotation, setSelectedPdfAnnotation] = useState<any>(null);
  const [currentPdfPageMeta, setCurrentPdfPageMeta] = useState<any>({ pageIndex: 0, rotation: 0 });

  // OCR state
  const [ocrLang, setOcrLang] = useState<string>('chi_sim+eng');
  const [lastOcrText, setLastOcrText] = useState<string>('');

  // Watermark panel state
  const [isWatermarkPanelOpen, setIsWatermarkPanelOpen] = useState(false);
  const [isUniversalWatermarkModalOpen, setIsUniversalWatermarkModalOpen] = useState(false);
  const [pdfWatermarkCount, setPdfWatermarkCount] = useState(0);

  // Unsaved Changes Modal State & Window Control Integration
  const [isUnsavedChangesModalOpen, setIsUnsavedChangesModalOpen] = useState(false);
  const [pendingCloseTarget, setPendingCloseTarget] = useState<'window' | { fileId: string } | null>(null);
  const [isClosingSaving, setIsClosingSaving] = useState(false);
  const [, setUnsavedTick] = useState(0);

  // Subscribe to UnsavedChangesManager updates
  useEffect(() => {
    const unsub = unsavedChangesManager.subscribe(() => {
      setUnsavedTick((t) => t + 1);
    });
    return unsub;
  }, []);

  // Web Browser beforeunload protection: prevent accidental data loss on refresh/close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (unsavedChangesManager.hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = '当前有未保存的文档更改，确定要关闭或离开吗？';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const globalFileInputRef = useRef<HTMLInputElement>(null);

  // Derive active file and active module
  const activeFile = activeFileId ? allFiles.find((f) => f.id === activeFileId) || null : null;
  const activeModule: AppModule = activeFile ? activeFile.type : 'home';

  // Sync activeFileId with DocumentSessionManager
  useEffect(() => {
    DocumentSessionManager.setActiveSession(activeFileId);
  }, [activeFileId]);

  // Ensure default clean light appearance
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
    try {
      localStorage.removeItem('mianay_theme_mode');
    } catch {
      // ignore
    }
  }, []);

  const addToast = useCallback(
    (type: 'success' | 'error' | 'info' | 'vip-free', title: string, description?: string) => {
      const id = `toast-${Date.now()}-${Math.random()}`;
      const newToast: ToastMessage = { id, type, title, description };
      setToasts((prev) => [...prev, newToast]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const isGlobalSavingRef = useRef(false);

  const handleSaveCurrentDocument = useCallback(() => {
    if (!activeFile || isGlobalSavingRef.current) return;
    isGlobalSavingRef.current = true;
    try {
      updateFileContent(activeFile.id, activeFile.content, '手动快捷保存', 'saved');
      unsavedChangesManager.markSaved(activeFile.id);
      setOpenFiles((prev) =>
        prev.map((f) => (f.id === activeFile.id ? { ...f, saveStatus: 'saved' } : f))
      );
      setAllFiles(loadAllFiles());
      addToast('success', '文档已保存', `${activeFile.name} (已创建历史快照)`);
    } finally {
      isGlobalSavingRef.current = false;
    }
  }, [activeFile, addToast]);

  const requestSaveDocument = useCallback(() => {
    if (!activeFile || isGlobalSavingRef.current) return;
    if (commandDispatcher.hasHandler('SAVE_DOCUMENT')) {
      commandDispatcher.dispatch('SAVE_DOCUMENT');
      return;
    }
    handleSaveCurrentDocument();
  }, [activeFile, handleSaveCurrentDocument]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Toggle Sidebar: Cmd+B / Ctrl+B
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        const target = e.target as HTMLElement;
        const isEditing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
        if (!isEditing) {
          e.preventDefault();
          setIsSidebarCollapsed((prev) => !prev);
        }
      }

      // Toggle Inspector: Cmd+Alt+I / Ctrl+Alt+I
      if ((e.metaKey || e.ctrlKey) && e.altKey && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setIsInspectorOpen((prev) => !prev);
      }

      // Save document: Cmd+S / Ctrl+S
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        requestSaveDocument();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeFileId, activeFile, requestSaveDocument]);

  // Document Management Handlers
  const handleOpenFile = useCallback(
    (file: OfficeFile) => {
      if (file.isTrash) {
        addToast('error', '该文档位于废纸篓中', '请先还原后再进行编辑');
        return;
      }
      if (!openFiles.some((f) => f.id === file.id)) {
        setOpenFiles((prev) => [...prev, file]);
      }
      setActiveFileId(file.id);
    },
    [openFiles, addToast]
  );

  const executeCloseTab = useCallback(
    (fileId: string) => {
      const targetFile = openFiles.find((f) => f.id === fileId);
      if (targetFile?.type === 'pdf') {
        closePdfSession(fileId);
      }
      unsavedChangesManager.markSaved(fileId);
      const updatedOpen = openFiles.filter((f) => f.id !== fileId);
      setOpenFiles(updatedOpen);
      if (activeFileId === fileId) {
        if (updatedOpen.length > 0) {
          setActiveFileId(updatedOpen[updatedOpen.length - 1].id);
        } else {
          setActiveFileId(null);
        }
      }
    },
    [openFiles, activeFileId, closePdfSession]
  );

  const handleCloseTab = useCallback(
    (fileId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const isDirty =
        unsavedChangesManager.isFileDirty(fileId) ||
        openFiles.find((f) => f.id === fileId)?.saveStatus === 'unsaved';

      if (isDirty) {
        setPendingCloseTarget({ fileId });
        setIsUnsavedChangesModalOpen(true);
        return;
      }

      executeCloseTab(fileId);
    },
    [openFiles, executeCloseTab]
  );

  const handleCreateNew = useCallback(
    (type: FileType) => {
      const newFile = createNewFile(type);
      setAllFiles(loadAllFiles());
      setOpenFiles((prev) => [...prev, newFile]);
      setActiveFileId(newFile.id);
      addToast('success', '已创建新文档', newFile.name);
    },
    [addToast]
  );

  const handleSelectModuleFromSidebar = useCallback(
    (module: AppModule) => {
      if (module === 'home') {
        setActiveFileId(null);
      } else if (module === 'tools') {
        // Switch to tools or create a tools view
        setActiveFileId(null);
      } else {
        // Find existing open file of this type or open the first matching file
        const matchingOpen = openFiles.find((f) => f.type === module);
        if (matchingOpen) {
          setActiveFileId(matchingOpen.id);
        } else {
          const matchingAll = allFiles.find((f) => f.type === module && !f.isTrash);
          if (matchingAll) {
            handleOpenFile(matchingAll);
          } else {
            handleCreateNew(module as FileType);
          }
        }
      }
    },
    [openFiles, allFiles, handleOpenFile, handleCreateNew]
  );

  const handleDocContentChange = useCallback(
    (html: string, title?: string, model?: DocumentModel, json?: any, status: 'unsaved' | 'saved' = 'unsaved') => {
      if (!activeFileId) return;
      const content = json || model || html;
      updateFileContent(activeFileId, content, undefined, status);
      if (status === 'saved') {
        unsavedChangesManager.markSaved(activeFileId);
      } else {
        unsavedChangesManager.setFileDirty(activeFileId, true);
      }
      setOpenFiles((prev) =>
        prev.map((f) => (f.id === activeFileId ? { ...f, content, saveStatus: status } : f))
      );
      setAllFiles(loadAllFiles());
    },
    [activeFileId]
  );

  const handleSheetWorkbookChange = useCallback(
    (wb: any, status: 'unsaved' | 'saved' = 'unsaved') => {
      if (!activeFileId) return;
      updateFileContent(activeFileId, wb, undefined, status);
      if (status === 'saved') {
        unsavedChangesManager.markSaved(activeFileId);
      } else {
        unsavedChangesManager.setFileDirty(activeFileId, true);
      }
      setOpenFiles((prev) =>
        prev.map((f) => (f.id === activeFileId ? { ...f, content: wb, saveStatus: status } : f))
      );
      setAllFiles(loadAllFiles());
    },
    [activeFileId]
  );

  // Window Controls Handlers (Cross Electron IPC & Web preview fallback)
  const handleMinimizeWindow = useCallback(async () => {
    const res = await windowManager.minimizeWindow();
    if (res.isFallback) {
      addToast('info', '窗口最小化', '当前处于 Web 预览环境，窗口最小化仅在桌面客户端生效');
    }
  }, [addToast]);

  const handleToggleMaximizeWindow = useCallback(async () => {
    const res = await windowManager.toggleMaximizeWindow();
    if (res.isFallback) {
      addToast('info', res.isMaximized ? '窗口最大化' : '窗口还原', '已切换显示模式');
    }
  }, [addToast]);

  const handleRequestCloseWindow = useCallback(() => {
    const dirtyIds = unsavedChangesManager.getUnsavedFileIds();
    const unsavedOpenFiles = openFiles.filter((f) => f.saveStatus === 'unsaved' || dirtyIds.includes(f.id));

    if (unsavedOpenFiles.length > 0 || unsavedChangesManager.hasUnsavedChanges()) {
      setPendingCloseTarget('window');
      setIsUnsavedChangesModalOpen(true);
    } else {
      windowManager.closeWindow().then((res) => {
        if (res.isFallback) {
          addToast('info', '窗口关闭', '当前处于 Web 预览环境；在桌面客户端将直接退出程序');
        }
      });
    }
  }, [openFiles, addToast]);

  // Unsaved Changes Confirmation Modal Handlers
  const handleModalSaveAndExit = useCallback(async () => {
    setIsClosingSaving(true);
    try {
      if (pendingCloseTarget === 'window') {
        const dirtyIds = unsavedChangesManager.getUnsavedFileIds();
        openFiles.forEach((file) => {
          if (dirtyIds.includes(file.id) || file.saveStatus === 'unsaved') {
            updateFileContent(file.id, file.content, '退出前自动保存', 'saved');
          }
        });
        unsavedChangesManager.markAllSaved();
        setAllFiles(loadAllFiles());
        setOpenFiles((prev) => prev.map((f) => ({ ...f, saveStatus: 'saved' })));
        setIsUnsavedChangesModalOpen(false);
        setPendingCloseTarget(null);
        addToast('success', '已保存所有更改并退出');
        const res = await windowManager.closeWindow();
        if (res.isFallback) {
          addToast('info', '应用已退出', '当前处于 Web 预览环境；桌面客户端将关闭程序');
        }
      } else if (pendingCloseTarget && typeof pendingCloseTarget === 'object') {
        const targetId = pendingCloseTarget.fileId;
        const target = openFiles.find((f) => f.id === targetId);
        if (target) {
          updateFileContent(target.id, target.content, '关闭前保存', 'saved');
        }
        unsavedChangesManager.markSaved(targetId);
        setAllFiles(loadAllFiles());
        setIsUnsavedChangesModalOpen(false);
        setPendingCloseTarget(null);
        executeCloseTab(targetId);
        addToast('success', '已保存并关闭文档');
      }
    } finally {
      setIsClosingSaving(false);
    }
  }, [pendingCloseTarget, openFiles, executeCloseTab, addToast]);

  const handleModalDiscardAndExit = useCallback(async () => {
    if (pendingCloseTarget === 'window') {
      unsavedChangesManager.markAllSaved();
      setAllFiles(loadAllFiles());
      setIsUnsavedChangesModalOpen(false);
      setPendingCloseTarget(null);
      addToast('info', '已放弃所有未保存更改并退出');
      const res = await windowManager.closeWindow();
      if (res.isFallback) {
        addToast('info', '应用已退出', '当前处于 Web 预览环境；桌面客户端将关闭程序');
      }
    } else if (pendingCloseTarget && typeof pendingCloseTarget === 'object') {
      const targetId = pendingCloseTarget.fileId;
      unsavedChangesManager.markSaved(targetId);
      setIsUnsavedChangesModalOpen(false);
      setPendingCloseTarget(null);
      executeCloseTab(targetId);
      addToast('info', '已放弃更改并关闭文档');
    }
  }, [pendingCloseTarget, executeCloseTab, addToast]);

  const handleModalCancel = useCallback(() => {
    setIsUnsavedChangesModalOpen(false);
    setPendingCloseTarget(null);
  }, []);

  const handleToggleFavorite = useCallback(
    (fileId: string) => {
      const isFav = toggleFavoriteFile(fileId);
      setAllFiles(loadAllFiles());
      addToast('info', isFav ? '已加入收藏' : '已取消收藏');
    },
    [addToast]
  );

  const handleTrashFile = useCallback(
    (fileId: string, toTrash: boolean) => {
      toggleTrashFile(fileId, toTrash);
      setAllFiles(loadAllFiles());
      if (toTrash) {
        setOpenFiles((prev) => prev.filter((f) => f.id !== fileId));
        if (activeFileId === fileId) {
          setActiveFileId(null);
        }
        addToast('info', '已移入废纸篓');
      } else {
        addToast('success', '已从废纸篓还原文档');
      }
    },
    [activeFileId, addToast]
  );

  const handleDeletePermanently = useCallback(
    (fileId: string) => {
      permanentlyDeleteFile(fileId);
      setAllFiles(loadAllFiles());
      setOpenFiles((prev) => prev.filter((f) => f.id !== fileId));
      if (activeFileId === fileId) {
        setActiveFileId(null);
      }
      addToast('info', '已永久删除文件');
    },
    [activeFileId, addToast]
  );

  const handleDuplicateFile = useCallback(
    (fileId: string) => {
      const source = allFiles.find((f) => f.id === fileId);
      if (!source) return;
      const dupName = `${source.name.replace(/\.[^/.]+$/, '')} (副本).${source.type === 'doc' ? 'docx' : source.type === 'sheet' ? 'xlsx' : 'pdf'}`;
      const dup = createNewFile(source.type, dupName, source.content);
      setAllFiles(loadAllFiles());
      addToast('success', '已创建副本', dup.name);
    },
    [allFiles, addToast]
  );

  const handleRenameFile = useCallback(
    (fileId: string, newName: string) => {
      let trimmed = newName.trim();
      if (!trimmed) return;
      const files = loadAllFiles();
      const target = files.find((f) => f.id === fileId);
      if (target) {
        // If the user did not specify an extension, preserve original extension
        const currentExt = target.name.includes('.') ? target.name.split('.').pop() : '';
        if (currentExt && !trimmed.includes('.')) {
          trimmed = `${trimmed}.${currentExt}`;
        }
        target.name = trimmed;
        target.modifiedAt = Date.now();
        saveAllFiles(files);
        setAllFiles(loadAllFiles());
        setOpenFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, name: trimmed, modifiedAt: target.modifiedAt } : f))
        );
        addToast('success', '文档已重命名', trimmed);
      }
    },
    [addToast]
  );

  const handleRestoreVersion = useCallback(
    (version: VersionHistoryItem) => {
      if (!activeFileId) return;
      updateFileContent(activeFileId, version.content, `恢复至快照: ${version.summary}`);
      setAllFiles(loadAllFiles());
      addToast('success', '已恢复历史版本', version.summary);
    },
    [activeFileId, addToast]
  );

  // Global Drag and Drop (handles external file drops cleanly without obstructing internal tab/sheet sorting)
  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types && e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      e.preventDefault();
      const file = files[0];
      handleProcessImportedFile(file);
    }
  };

  const handleGlobalOpenFile = () => {
    globalFileInputRef.current?.click();
  };

  const handleGlobalFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleProcessImportedFile(file);
  };

  const handleProcessImportedFile = async (file: File) => {
    try {
      const fileNameLower = file.name.toLowerCase();

      if (fileNameLower.endsWith('.docx')) {
        addToast('info', '正在解析 DOCX', file.name);
        const buffer = await file.arrayBuffer();
        const parsed = await DocxParser.parseDocx(buffer, file.name);
        const newFile = createNewFile('doc', file.name, parsed.documentModel);
        setAllFiles(loadAllFiles());
        setOpenFiles((prev) => [...prev, newFile]);
        setActiveFileId(newFile.id);
        addToast('success', '已成功导入 DOCX 文档', `包含 ${parsed.nodes.length} 个结构节点`);
      } else if (fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls') || fileNameLower.endsWith('.csv')) {
        addToast('info', '正在解析电子表格', file.name);
        const workbook = await importXlsxToWorkbook(file);
        const newFile = createNewFile('sheet', file.name, workbook);
        setAllFiles(loadAllFiles());
        setOpenFiles((prev) => [...prev, newFile]);
        setActiveFileId(newFile.id);
        addToast('success', '已成功导入电子表格', `包含 ${workbook.sheets.length} 个工作表`);
      } else if (fileNameLower.endsWith('.pdf')) {
        const arrayBuf = await file.arrayBuffer();
        const pdfBytes = new Uint8Array(arrayBuf);
        const newFile = createNewFile('pdf', file.name, { annotations: [], pages: [], pdfBytes });
        setAllFiles(loadAllFiles());
        setDroppedFile(file);
        setOpenFiles((prev) => [...prev, newFile]);
        setActiveFileId(newFile.id);
        addToast('success', '已打开 PDF 文档', file.name);
      } else if (file.type.startsWith('image/')) {
        setActiveFileId(null);
        addToast('info', '已就绪', '可在工具箱或 PDF 模式中使用此图像');
      } else {
        // Plain text / Markdown / HTML / other doc format
        const text = await file.text();
        const newFile = createNewFile('doc', file.name, text);
        setAllFiles(loadAllFiles());
        setOpenFiles((prev) => [...prev, newFile]);
        setActiveFileId(newFile.id);
        addToast('success', '已导入文本文件', file.name);
      }
    } catch (err: any) {
      console.error('File import error:', err);
      addToast('error', '文件导入失败', err.message || '格式不支持或文件已损坏');
    }
  };

  // Switch to doc mode with OCR text
  const handleExportOcrToDoc = useCallback(
    (text: string) => {
      const newFile = createNewFile('doc', `OCR提取文稿 (${new Date().toLocaleTimeString()}).docx`, text);
      setAllFiles(loadAllFiles());
      setOpenFiles((prev) => [...prev, newFile]);
      setActiveFileId(newFile.id);
      addToast('success', '已将提取文本导入 Pure Doc', '可在新文稿中继续排版与导出');
    },
    [addToast]
  );

  // Global Command Dispatcher Bindings for Lumina Menu & Architecture
  useEffect(() => {
    const unregister = commandDispatcher.registerMany({
      SAVE_DOCUMENT: () => {
        if (!activeFile) return;
        // When an active workbench handles this file type, skip fallback save
        if (activeFile.type === 'doc' || activeFile.type === 'sheet' || activeFile.type === 'pdf') {
          return;
        }
        handleSaveCurrentDocument();
      },
      CREATE_DOCUMENT: (cmd) => {
        const targetType = cmd?.payload?.type || (activeFile?.type === 'pdf' ? 'pdf' : 'doc');
        handleCreateNew(targetType);
      },
      OPEN_DOCUMENT: () => {
        handleGlobalOpenFile();
      },
      IMPORT_DOCUMENT: () => {
        handleGlobalOpenFile();
      },
      EXPORT_PDF_STANDARD: () => {
        if (!activeFile) {
          addToast('error', '未载入文档', '请先打开或创建一个文档');
          return;
        }
        setExportDialogFormat('pdf');
        setIsExportDialogOpen(true);
      },
      EXPORT_PDF_PDFA: () => {
        if (!activeFile) {
          addToast('error', '未载入文档', '请先打开或创建一个文档');
          return;
        }
        setExportDialogFormat('pdf');
        setIsExportDialogOpen(true);
      },
      EXPORT_PDF_SCANNED: () => {
        if (!activeFile) {
          addToast('error', '未载入文档', '请先打开或创建一个文档');
          return;
        }
        setExportDialogFormat('pdf');
        setIsExportDialogOpen(true);
      },
      EXPORT_IMAGE_PNG: () => {
        if (!activeFile) {
          addToast('error', '未载入文档', '请先打开或创建一个文档');
          return;
        }
        setExportDialogFormat('image');
        setIsExportDialogOpen(true);
      },
      EXPORT_IMAGE_JPG: () => {
        if (!activeFile) {
          addToast('error', '未载入文档', '请先打开或创建一个文档');
          return;
        }
        setExportDialogFormat('image');
        setIsExportDialogOpen(true);
      },
      EXPORT_IMAGE_WEBP: () => {
        if (!activeFile) {
          addToast('error', '未载入文档', '请先打开或创建一个文档');
          return;
        }
        setExportDialogFormat('image');
        setIsExportDialogOpen(true);
      },
      EXPORT_LONG_IMAGE: () => {
        if (!activeFile) {
          addToast('error', '未载入文档', '请先打开或创建一个文档');
          return;
        }
        setExportDialogFormat('long-image');
        setIsExportDialogOpen(true);
      },
      EXPORT_SVG: () => {
        if (!activeFile) {
          addToast('error', '未载入文档', '请先打开或创建一个文档');
          return;
        }
        setExportDialogFormat('image');
        setIsExportDialogOpen(true);
      },
      EXPORT_TEXT_TXT: () => {
        if (!activeFile) {
          addToast('error', '未载入文档', '请先打开或创建一个文档');
          return;
        }
        setExportDialogFormat('txt');
        setIsExportDialogOpen(true);
      },
      EXPORT_TEXT_MARKDOWN: () => {
        if (!activeFile) {
          addToast('error', '未载入文档', '请先打开或创建一个文档');
          return;
        }
        setExportDialogFormat('txt');
        setIsExportDialogOpen(true);
      },
      EXPORT_TEXT_HTML: () => {
        if (!activeFile) {
          addToast('error', '未载入文档', '请先打开或创建一个文档');
          return;
        }
        setExportDialogFormat('pdf');
        setIsExportDialogOpen(true);
      },
      CONVERT_TO_WORD: () => {
        if (!activeFile) {
          addToast('error', '未载入文档', '请先打开或创建一个文档');
          return;
        }
        setExportDialogFormat('docx');
        setIsExportDialogOpen(true);
      },
      CONVERT_TO_EXCEL: () => {
        if (!activeFile) {
          addToast('error', '未载入文档', '请先打开或创建一个文档');
          return;
        }
        setExportDialogFormat('xlsx');
        setIsExportDialogOpen(true);
      },
      CONVERT_TO_PPT: async () => {
        if (!activeFile) {
          addToast('error', '未载入文档', '请先打开或创建一个文档');
          return;
        }
        try {
          await featureExecutionEngine.execute('convert-ppt', activeFile);
        } catch (err: any) {
          addToast('info', '功能研发中', err.message);
        }
      },
      PERFORM_OCR: async () => {
        if (!activeFile) {
          addToast('error', '未载入文档', '请先打开或创建一个文档');
          return;
        }
        setIsOcrResultModalOpen(true);
        setIsOcrLoading(true);
        setOcrProgressMsg('正在初始化 Tesseract 离线 WASM 引擎...');
        try {
          const artifact = await featureExecutionEngine.execute(
            'convert-ocr',
            activeFile,
            { autoDownload: false }
          );
          const rawLines = (artifact.text || '').split('\n').filter(Boolean);
          setOcrModalResult({
            text: artifact.text || '',
            confidence: 0.96,
            lines: rawLines.map((l) => ({ text: l, confidence: 0.96 })),
          });
          setIsOcrLoading(false);
          addToast('success', 'OCR 识别已完成', `提取字符数: ${artifact.text?.length || 0}`);
        } catch (err: any) {
          setIsOcrLoading(false);
          addToast('error', 'OCR 识别失败', err.message);
        }
      },
      PRINT_DOCUMENT: async () => {
        if (!activeFile) {
          window.print();
          return;
        }
        try {
          await featureExecutionEngine.execute('print-document', activeFile);
        } catch (err: any) {
          addToast('error', '打印调用失败', err.message);
        }
      },
      DOCUMENT_PROPERTIES: () => {
        if (!activeFile) {
          addToast('info', '未载入文档', '请先打开一个文档以查看属性');
          return;
        }
        setIsDocPropertiesModalOpen(true);
      },
    });

    return () => {
      unregister();
    };
  }, [activeFile, handleSaveCurrentDocument, handleCreateNew, handleGlobalOpenFile, addToast]);

  // Title for TitleBar
  const getDocumentTitle = () => {
    if (!activeFile) return 'Mianay Office';
    return activeFile.name;
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="h-screen w-screen flex flex-col bg-[#f5f5f7] dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 overflow-hidden relative select-none"
    >
      <input
        ref={globalFileInputRef}
        type="file"
        accept=".pdf, .docx, .xlsx, .csv, .png, .jpg, .jpeg"
        onChange={handleGlobalFileInput}
        className="hidden"
      />

      {/* TitleBar (macOS Traffic Lights + Title + Inspector Toggle + Window Controls) */}
      <TitleBar
        activeModule={activeModule}
        documentTitle={getDocumentTitle()}
        activeFile={activeFile}
        onRenameDocument={(newName) => activeFile && handleRenameFile(activeFile.id, newName)}
        saveStatus={
          activeFile?.saveStatus === 'unsaved' || unsavedChangesManager.isFileDirty(activeFileId || '')
            ? 'unsaved'
            : (activeFile?.saveStatus || 'saved')
        }
        isInspectorOpen={isInspectorOpen}
        onToggleInspector={() => setIsInspectorOpen(!isInspectorOpen)}
        onGoHome={() => setActiveFileId(null)}
        isWatermarkPanelOpen={isUniversalWatermarkModalOpen}
        onToggleWatermarkPanel={() => setIsUniversalWatermarkModalOpen(true)}
        watermarkCount={pdfWatermarkCount}
        onOpenEngineStatus={() => setIsEngineStatusModalOpen(true)}
        onMinimize={handleMinimizeWindow}
        onToggleMaximize={handleToggleMaximizeWindow}
        onCloseWindow={handleRequestCloseWindow}
      />

      {/* TabBar (Multi-Document Tabs System) */}
      <TabBar
        openFiles={openFiles}
        activeFileId={activeFileId}
        onSelectTab={setActiveFileId}
        onCloseTab={handleCloseTab}
        onCreateNew={handleCreateNew}
        onImportFile={handleGlobalOpenFile}
        onReorderFiles={setOpenFiles}
      />

      {/* 3-Column Workframe: [Sidebar] + [Main Canvas] + [Right Inspector] */}
      <div className="flex-1 flex overflow-hidden min-h-0 min-w-0">
        {/* Column 1: Left Frosted Sidebar */}
        <Sidebar
          activeModule={activeModule}
          onSelectModule={handleSelectModuleFromSidebar}
          activeHomeFilter={homeFilter}
          onSelectHomeFilter={(filter) => {
            setActiveFileId(null);
            setHomeFilter(filter);
          }}
          onOpenFile={handleGlobalOpenFile}
          onNewDoc={(type) => handleCreateNew(type)}
          onSaveCurrent={handleSaveCurrentDocument}
          onExportImage={() => setIsExportImageModalOpen(true)}
          onExportPdf={() => setIsExportPdfModalOpen(true)}
          currentFileType={activeFile?.type}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          docOutline={docOutline}
          hasActivePdf={activeModule === 'pdf'}
          pdfFileName={activeFile?.name || activePdfSession?.fileName || '文档.pdf'}
          pdfPageCount={activePdfSession?.pageCount || 1}
          openFiles={openFiles}
          activeFileId={activeFileId}
          onSelectFile={setActiveFileId}
          isWatermarkPanelOpen={isWatermarkPanelOpen}
          onToggleWatermarkPanel={() => {
            if (activeModule !== 'pdf') {
              const firstPdf = openFiles.find((f) => f.type === 'pdf');
              if (firstPdf) setActiveFileId(firstPdf.id);
            }
            setIsWatermarkPanelOpen((prev) => !prev);
          }}
          watermarkCount={pdfWatermarkCount}
        />

        {/* Column 2: Center Main Canvas Work Area */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {activeFileId === null && (
            <HomeWorkspace
              files={allFiles}
              activeFilter={homeFilter}
              onChangeFilter={setHomeFilter}
              onOpenFile={handleOpenFile}
              onCreateNew={handleCreateNew}
              onImportFile={handleGlobalOpenFile}
              onToggleFavorite={handleToggleFavorite}
              onTrashFile={handleTrashFile}
              onDeletePermanently={handleDeletePermanently}
              onDuplicateFile={handleDuplicateFile}
              onRenameFile={handleRenameFile}
              onOpenWatermarkStudio={() => setIsUniversalWatermarkModalOpen(true)}
              onShowToast={addToast}
            />
          )}

          {/* Workbenches for All Open Files (Preserves Independent Undo/Redo Stacks and Document State) */}
          {openFiles.map((file) => {
            const isActive = activeFileId === file.id;
            return (
              <div
                key={file.id}
                className="w-full h-full flex-col overflow-hidden"
                style={{ display: isActive ? 'flex' : 'none' }}
              >
                <OfficeEngineContainer
                  currentFile={file}
                  activeModule={file.type}
                  isActive={isActive}
                  initialContent={typeof file.content === 'string' ? file.content : undefined}
                  initialTitle={file.name}
                  initialModel={typeof file.content === 'object' && file.content?.nodes ? file.content : undefined}
                  initialJson={typeof file.content === 'object' && (file.content?.type === 'doc' ? file.content : file.content?.proseMirrorJson ? file.content.proseMirrorJson : undefined)}
                  initialWorkbook={typeof file.content === 'object' && file.content?.sheets ? file.content : undefined}
                  isInspectorOpen={isInspectorOpen}
                  onToggleInspector={() => setIsInspectorOpen(!isInspectorOpen)}
                  onDocStatsChange={isActive ? setDocStats : undefined}
                  onOutlineChange={isActive ? setDocOutline : undefined}
                  onEditorReady={isActive ? setDocEditorInstance : undefined}
                  onChangeContent={handleDocContentChange}
                  onChangeWorkbook={handleSheetWorkbookChange}
                  onSelectedCellChange={isActive ? setSelectedSheetCell : undefined}
                  onShowToast={addToast}
                  onDropFile={setDroppedFile}
                  onRequestExport={() => {
                    setExportDialogFormat(file.type === 'sheet' ? 'xlsx' : file.type === 'pdf' ? 'pdf' : 'docx');
                    setIsExportDialogOpen(true);
                  }}
                />
              </div>
            );
          })}
        </main>

        {/* Column 3: Right Context-Aware Inspector Panel (Only in Doc mode) */}
        {activeModule === 'doc' && (
          <Inspector
            activeModule={activeModule}
            isOpen={isInspectorOpen}
            onToggle={() => setIsInspectorOpen(!isInspectorOpen)}
            activeFile={activeFile}
            onRestoreVersion={handleRestoreVersion}
            docEditor={docEditorInstance}
            docStats={docStats}
            selectedSheetCell={selectedSheetCell}
            onUpdateSheetFormat={(key, val) => {
              // Sheet format updates
            }}
            ocrLanguage={ocrLang}
            onChangeOcrLanguage={setOcrLang}
            onExportOcrToDoc={handleExportOcrToDoc}
            lastOcrText={lastOcrText}
            currentPageMeta={currentPdfPageMeta}
          />
        )}
      </div>

      {/* Floating dynamic HUD toasts */}
      <NotificationToast toasts={toasts} onDismiss={dismissToast} />

      {/* Unified Export Dialog with Path Selection, Format Options and Zero Auto-Download */}
      <ExportDialog
        isOpen={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
        currentFile={activeFile}
        initialFormat={exportDialogFormat}
        onShowToast={addToast}
      />

      {/* Export to Image Modal (WPS Style) */}
      <ExportImageModal
        isOpen={isExportImageModalOpen}
        onClose={() => setIsExportImageModalOpen(false)}
        currentFile={activeFile}
        allFiles={allFiles.filter((f) => !f.isTrash)}
        onShowToast={addToast}
      />

      {/* Export to PDF Modal (Standard / Scanned / High Quality DPI) */}
      <ExportPdfModal
        isOpen={isExportPdfModalOpen}
        onClose={() => setIsExportPdfModalOpen(false)}
        currentFile={activeFile}
        onShowToast={addToast}
      />

      {/* Universal Watermark Removal Engine Studio */}
      <UniversalWatermarkModal
        isOpen={isUniversalWatermarkModalOpen}
        onClose={() => setIsUniversalWatermarkModalOpen(false)}
        activeFile={activeFile}
        onSaveFileContent={(fileId, content, summary) => {
          updateFileContent(fileId, content, summary);
          setAllFiles(loadAllFiles());
        }}
        onShowToast={addToast}
      />
      {/* Document Properties Modal */}
      <DocumentPropertiesModal
        isOpen={isDocPropertiesModalOpen}
        onClose={() => setIsDocPropertiesModalOpen(false)}
        file={activeFile}
      />

      {/* OCR Result and Text Extraction Modal */}
      <OcrResultModal
        isOpen={isOcrResultModalOpen}
        onClose={() => setIsOcrResultModalOpen(false)}
        result={ocrModalResult}
        isLoading={isOcrLoading}
        progressMessage={ocrProgressMsg}
        onDownloadTxt={(text) => {
          const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
          const baseName = (activeFile?.name || 'document').replace(/\.[^/.]+$/, '');
          featureExecutionEngine.triggerDownload(blob, `${baseName}_OCR识别结果.txt`);
          addToast('success', '已下载 OCR 纯文本文件');
        }}
      />

      {/* Desktop Office Engine Status & Diagnostics Modal */}
      <EngineStatusModal
        isOpen={isEngineStatusModalOpen}
        onClose={() => setIsEngineStatusModalOpen(false)}
        onShowToast={addToast}
      />

      {/* Unsaved Changes Confirmation Modal (Intercept window close & tab close) */}
      <UnsavedChangesModal
        isOpen={isUnsavedChangesModalOpen}
        onClose={handleModalCancel}
        onSaveAndExit={handleModalSaveAndExit}
        onDiscardAndExit={handleModalDiscardAndExit}
        activeFile={
          pendingCloseTarget && typeof pendingCloseTarget === 'object'
            ? openFiles.find((f) => f.id === pendingCloseTarget.fileId) || activeFile
            : activeFile
        }
        unsavedFiles={openFiles.filter(
          (f) => f.saveStatus === 'unsaved' || unsavedChangesManager.isFileDirty(f.id)
        )}
        isSaving={isClosingSaving}
      />
    </div>
  );
}
