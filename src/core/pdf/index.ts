import type { EditorToolMode, InteractionPhase, EditorTransformContext, EditorState } from './EditorStateMachine';

export type { EditorToolMode, InteractionPhase, EditorTransformContext, EditorState };
export { EditorStateMachine } from './EditorStateMachine';
export * from './CoordinateTransform';
export * from './SelectionManager';
export * from './TransformEngine';
export * from './CommandSystem';
export * from './pdfTextExtractor';
export * from './textDiagnostics';

/**
 * Maps legacy UI tool mode string to standard EditorToolMode
 */
export function mapToolModeToEditorMode(legacyMode: string): EditorToolMode {
  switch (legacyMode) {
    case 'select':
      return 'SELECT';
    case 'hand':
      return 'HAND';
    case 'text':
    case 'textbox':
      return 'INSERT_TEXT';
    case 'image':
      return 'INSERT_IMAGE';
    case 'stamp':
      return 'INSERT_STAMP';
    case 'watermark':
      return 'INSERT_WATERMARK';
    case 'crop':
      return 'CROP';
    case 'measure-distance':
    case 'measure-area':
      return 'MEASURE';
    case 'draw':
      return 'DRAW';
    case 'highlight':
      return 'HIGHLIGHT';
    case 'underline':
      return 'UNDERLINE';
    case 'strikethrough':
    case 'squiggly':
      return 'STRIKETHROUGH';
    case 'redact':
      return 'REDACT';
    case 'rect':
    case 'circle':
    case 'arrow':
    case 'line':
    case 'table':
      return 'SHAPE';
    case 'comment':
      return 'COMMENT';
    case 'scanned-eraser':
      return 'ERASER_MASK';
    default:
      return 'SELECT';
  }
}
