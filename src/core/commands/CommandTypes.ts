export type CommandType =
  // Document Session & File Commands
  | 'CREATE_DOCUMENT'
  | 'OPEN_DOCUMENT'
  | 'IMPORT_DOCUMENT'
  | 'CLOSE_DOCUMENT'
  | 'SWITCH_DOCUMENT'
  | 'SAVE_DOCUMENT'
  | 'RENAME_DOCUMENT'
  | 'PRINT_DOCUMENT'
  | 'DOCUMENT_PROPERTIES'

  // Standard File Menu Output & Export Commands
  | 'EXPORT_PDF'
  | 'EXPORT_PDF_STANDARD'
  | 'EXPORT_PDF_PDFA'
  | 'EXPORT_PDF_SCANNED'
  | 'EXPORT_IMAGE'
  | 'EXPORT_IMAGE_PNG'
  | 'EXPORT_IMAGE_JPG'
  | 'EXPORT_IMAGE_WEBP'
  | 'EXPORT_LONG_IMAGE'
  | 'EXPORT_SVG'
  | 'EXPORT_TEXT'
  | 'EXPORT_TEXT_TXT'
  | 'EXPORT_TEXT_MARKDOWN'
  | 'EXPORT_TEXT_HTML'

  // Standard File Menu Convert Commands
  | 'CONVERT_TO_WORD'
  | 'CONVERT_TO_EXCEL'
  | 'CONVERT_TO_PPT'
  | 'PERFORM_OCR'

  // View & Mode Commands
  | 'PDF_SET_TOOL_MODE'
  | 'PDF_SET_VIEW_MODE'
  | 'PDF_SET_ZOOM'
  | 'PDF_UNDO'
  | 'PDF_REDO'
  | 'PDF_SEARCH'
  | 'PDF_BATCH_REPLACE'

  // Object & Content Commands
  | 'PDF_EDIT_TEXT'
  | 'PDF_INSERT_IMAGE'
  | 'PDF_INSERT_SHAPE'
  | 'PDF_INSERT_SIGNATURE'
  | 'PDF_INSERT_STAMP'
  | 'PDF_INSERT_FORM'

  // Page Operations
  | 'PDF_ROTATE_PAGE'
  | 'PDF_DELETE_PAGE'
  | 'PDF_DUPLICATE_PAGE'
  | 'PDF_INSERT_BLANK_PAGE'
  | 'PDF_AUTO_TRIM_PAGE'
  | 'PDF_SELECT_PAGE'
  | 'PDF_MOVE_PAGE'

  // Conversion & Export Commands
  | 'PDF_CONVERT_WORD'
  | 'PDF_CONVERT_EXCEL'
  | 'PDF_EXPORT_IMAGE'
  | 'PDF_CONVERT_SCANNED'
  | 'PDF_EXPORT_CLEAN'
  | 'PDF_EXPORT_DOCX'
  | 'PDF_EXPORT_XLSX'
  | 'PDF_EXPORT_ZIP'
  | 'PDF_EXPORT_TEXT'
  | 'PDF_EXPORT_MODAL'

  // Tools & Modals
  | 'PDF_MERGE'
  | 'PDF_SPLIT'
  | 'PDF_COMPRESS'
  | 'PDF_EXTRACT_IMAGE'
  | 'PDF_EXTRACT_TEXT'
  | 'PDF_EXTRACT_MODAL'
  | 'PDF_MEASURE'
  | 'PDF_SECURITY'
  | 'PDF_WATERMARK'
  | 'PDF_WATERMARK_PANEL'
  | 'PDF_OCR'
  | 'PDF_CLOSE_MODAL';

export interface CommandMetadata {
  source?: 'toolbar' | 'sidebar' | 'shortcut' | 'canvas' | 'modal' | 'inspector' | 'session' | 'system';
  timestamp?: number;
  description?: string;
  [key: string]: any;
}

export interface EditorCommand<T = any> {
  type: CommandType;
  payload?: T;
  metadata?: CommandMetadata;
}

export type CommandInput<T = any> = CommandType | EditorCommand<T>;
