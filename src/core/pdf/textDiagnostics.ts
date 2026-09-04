/**
 * Text Editing Diagnostic Registry & Event Logger for Lumina Office
 * Tracks text-edit-start, text-edit-commit, text-edit-cancel events and exposes
 * diagnostic telemetry via window.__LUMINA_TEXT_DIAGNOSTIC__
 */

export interface TextDiagnosticEvent {
  event: 'text-edit-start' | 'text-edit-commit' | 'text-edit-cancel';
  timestamp: number;
  pageIndex: number;
  objectId: string;
  originalText?: string;
  currentText?: string;
  text?: string;
  source?: 'existing' | 'inserted';
  changed?: boolean;
  coordinates?: { x: number; y: number; width: number; height: number };
}

export interface LuminaTextDiagnosticState {
  activeEditSession: {
    objectId: string;
    pageIndex: number;
    source: 'existing' | 'inserted';
    originalText: string;
    startTime: number;
  } | null;
  history: TextDiagnosticEvent[];
  lastEvent: TextDiagnosticEvent | null;
  totalCommittedEdits: number;
  totalCancelledEdits: number;
}

const diagnosticState: LuminaTextDiagnosticState = {
  activeEditSession: null,
  history: [],
  lastEvent: null,
  totalCommittedEdits: 0,
  totalCancelledEdits: 0,
};

const globalScope: any = typeof window !== 'undefined' ? window : globalThis;
globalScope.__LUMINA_TEXT_DIAGNOSTIC__ = diagnosticState;

export function emitTextDiagnostic(
  event: 'text-edit-start' | 'text-edit-commit' | 'text-edit-cancel',
  payload: {
    pageIndex: number;
    objectId: string;
    originalText?: string;
    currentText?: string;
    text?: string;
    source?: 'existing' | 'inserted';
    changed?: boolean;
    coordinates?: { x: number; y: number; width: number; height: number };
  }
) {
  const diagEvent: TextDiagnosticEvent = {
    event,
    timestamp: Date.now(),
    ...payload,
  };

  diagnosticState.history.push(diagEvent);
  if (diagnosticState.history.length > 200) {
    diagnosticState.history.shift();
  }
  diagnosticState.lastEvent = diagEvent;

  if (event === 'text-edit-start') {
    diagnosticState.activeEditSession = {
      objectId: payload.objectId,
      pageIndex: payload.pageIndex,
      source: payload.source || 'inserted',
      originalText: payload.originalText || '',
      startTime: Date.now(),
    };
    console.log(
      `%c[Lumina PDF Text] Edit Start: %c${payload.source === 'existing' ? '原文字修改' : '新增文字'} (${payload.objectId}) on Page ${payload.pageIndex + 1}`,
      'color: #2563eb; font-weight: bold;',
      'color: #059669;',
      payload
    );
  } else if (event === 'text-edit-commit') {
    diagnosticState.activeEditSession = null;
    if (payload.changed) {
      diagnosticState.totalCommittedEdits++;
    }
    console.log(
      `%c[Lumina PDF Text] Edit Commit: %c${payload.objectId} -> "${payload.text}" (changed: ${payload.changed})`,
      'color: #059669; font-weight: bold;',
      'color: #1d1d1f;',
      payload
    );
  } else if (event === 'text-edit-cancel') {
    diagnosticState.activeEditSession = null;
    diagnosticState.totalCancelledEdits++;
    console.log(
      `%c[Lumina PDF Text] Edit Cancel: %c${payload.objectId}`,
      'color: #dc2626; font-weight: bold;',
      'color: #6b7280;',
      payload
    );
  }

  // Dispatch standard CustomEvent for automated E2E tests or test harnesses
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('lumina:pdf:text-edit-event', {
        detail: diagEvent,
      })
    );
  }
}
