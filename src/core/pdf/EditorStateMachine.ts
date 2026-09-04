// ==================== EDITOR STATE MACHINE & TYPES ====================

export type EditorToolMode =
  | 'SELECT'
  | 'HAND'
  | 'INSERT_TEXT'
  | 'INSERT_IMAGE'
  | 'INSERT_STAMP'
  | 'INSERT_WATERMARK'
  | 'CROP'
  | 'MEASURE'
  | 'DRAW'
  | 'HIGHLIGHT'
  | 'UNDERLINE'
  | 'STRIKETHROUGH'
  | 'REDACT'
  | 'SHAPE'
  | 'COMMENT'
  | 'ERASER_MASK';

export type InteractionPhase =
  | 'IDLE'
  | 'HOVER'
  | 'DRAGGING'
  | 'RESIZING'
  | 'ROTATING'
  | 'TEXT_EDITING'
  | 'DRAWING'
  | 'MEASURING';

export interface EditorTransformContext {
  objectId: string;
  initialX: number;
  initialY: number;
  initialWidth: number;
  initialHeight: number;
  initialRotation: number;
  startX: number;
  startY: number;
  handle?: string; // 'nw', 'ne', 'se', 'sw', 'n', 's', 'e', 'w', 'rot'
}

export interface EditorState {
  toolMode: EditorToolMode;
  phase: InteractionPhase;
  selectedObjectId: string | null;
  hoveredObjectId: string | null;
  activeTransform: EditorTransformContext | null;
}

export interface IEditorStateMachine {
  getState: () => EditorState;
  setToolMode: (mode: EditorToolMode) => void;
  setPhase: (phase: InteractionPhase) => void;
  selectObject: (id: string | null) => void;
  hoverObject: (id: string | null) => void;
  startTransform: (context: EditorTransformContext, phase: InteractionPhase) => void;
  endTransform: () => void;
  canCreateOnCanvas: () => boolean;
  onObjectCreated: (id: string) => void;
  resetToSelect: () => void;
}

export class EditorStateMachine implements IEditorStateMachine {
  private state: EditorState;
  private listeners: Set<(state: EditorState) => void> = new Set();

  constructor(initialToolMode: EditorToolMode = 'SELECT') {
    this.state = {
      toolMode: initialToolMode,
      phase: 'IDLE',
      selectedObjectId: null,
      hoveredObjectId: null,
      activeTransform: null,
    };
  }

  public getState(): EditorState {
    return { ...this.state };
  }

  public subscribe(listener: (state: EditorState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => listener(this.getState()));
  }

  public setToolMode(mode: EditorToolMode) {
    if (this.state.toolMode === mode) return;
    this.state.toolMode = mode;
    this.state.phase = 'IDLE';
    this.state.activeTransform = null;
    this.notify();
  }

  public setPhase(phase: InteractionPhase) {
    if (this.state.phase === phase) return;
    this.state.phase = phase;
    this.notify();
  }

  public selectObject(id: string | null) {
    if (this.state.selectedObjectId === id && this.state.phase !== 'TEXT_EDITING') return;
    this.state.selectedObjectId = id;
    if (!id && this.state.phase === 'TEXT_EDITING') {
      this.state.phase = 'IDLE';
    }
    this.notify();
  }

  public hoverObject(id: string | null) {
    if (this.state.hoveredObjectId === id) return;
    this.state.hoveredObjectId = id;
    this.notify();
  }

  public startTransform(context: EditorTransformContext, phase: InteractionPhase) {
    this.state.activeTransform = context;
    this.state.phase = phase;
    this.state.selectedObjectId = context.objectId;
    this.notify();
  }

  public endTransform() {
    this.state.activeTransform = null;
    this.state.phase = 'IDLE';
    this.notify();
  }

  /**
   * Guards whether clicking on the canvas background should spawn a new object.
   * STRICT GUARD: Only allowed in dedicated insertion tool modes and when IDLE.
   */
  public canCreateOnCanvas(): boolean {
    if (this.state.phase !== 'IDLE') return false;
    const creationModes: EditorToolMode[] = [
      'INSERT_TEXT',
      'INSERT_IMAGE',
      'INSERT_STAMP',
      'INSERT_WATERMARK',
      'CROP',
      'MEASURE',
      'DRAW',
      'HIGHLIGHT',
      'UNDERLINE',
      'STRIKETHROUGH',
      'REDACT',
      'SHAPE',
      'COMMENT',
      'ERASER_MASK',
    ];
    return creationModes.includes(this.state.toolMode);
  }

  /**
   * When an object is created on the canvas, automatically transition
   * to SELECT mode, select the newly created object, and optionally enter editing phase.
   */
  public onObjectCreated(id: string, enterTextEditing: boolean = false) {
    this.state.selectedObjectId = id;
    this.state.toolMode = 'SELECT';
    this.state.phase = enterTextEditing ? 'TEXT_EDITING' : 'IDLE';
    this.notify();
  }

  public resetToSelect() {
    this.state.toolMode = 'SELECT';
    this.state.phase = 'IDLE';
    this.notify();
  }
}
