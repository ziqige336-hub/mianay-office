import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { PageLayoutEngine, ComputedPageGeometry, PageBreakDescriptor } from './PageLayoutEngine';
import type { DocPageLayoutSettings } from '../../types';

export interface PagedLayoutPluginOptions {
  getViewMode: () => 'paged' | 'continuous';
  getMargin: () => 'normal' | 'narrow' | 'wide' | Partial<DocPageLayoutSettings>;
  onPageCountChange?: (count: number) => void;
}

export interface PagedLayoutPluginState {
  decorations: DecorationSet;
  pageCount: number;
  breakPositions: number[];
  lastBreaks: { pos: number; spacerHeight: number }[];
}

export const pagedLayoutPluginKey = new PluginKey<PagedLayoutPluginState>('pagedLayoutPlugin');

export type { PageBreakDescriptor };

/**
 * Calculate deterministic page breaks for a document and return Widget Decorations.
 * Compares against lastBreaks and lastPageCount for strict idempotency to prevent loops.
 */
export function createPageBreakDecorations(
  doc: any,
  dom: HTMLElement,
  marginOrSettings: 'normal' | 'narrow' | 'wide' | Partial<DocPageLayoutSettings> = 'normal',
  lastBreaks: { pos: number; spacerHeight: number }[] = [],
  lastPageCount: number = 1
): {
  decorations: DecorationSet;
  pageCount: number;
  breakPositions: number[];
  lastBreaks: { pos: number; spacerHeight: number }[];
  changed: boolean;
} {
  if (!dom || !doc) {
    return {
      decorations: DecorationSet.empty,
      pageCount: 1,
      breakPositions: [],
      lastBreaks: [],
      changed: lastPageCount !== 1 || lastBreaks.length !== 0,
    };
  }

  const geometry = PageLayoutEngine.computeGeometry(marginOrSettings);
  const res = PageLayoutEngine.calculatePageBreaks(
    doc,
    dom,
    geometry,
    lastBreaks,
    lastPageCount
  );

  if (!res.changed) {
    return {
      decorations: DecorationSet.empty,
      pageCount: lastPageCount,
      breakPositions: lastBreaks.map((b) => b.pos),
      lastBreaks,
      changed: false,
    };
  }

  const decorations = DecorationSet.create(
    doc,
    res.breaks.map((b) => {
      return Decoration.widget(
        b.pos,
        () => {
          const widget = document.createElement('div');
          widget.className = 'pm-page-break-widget';
          widget.setAttribute('data-page-break-index', `${b.pageIndex}`);
          widget.setAttribute('contenteditable', 'false');
          widget.setAttribute('aria-hidden', 'true');
          widget.style.height = `${b.spacerHeight}px`;
          widget.style.width = '100%';
          widget.style.display = 'block';
          widget.style.margin = '0';
          widget.style.padding = '0';
          widget.style.userSelect = 'none';
          widget.style.pointerEvents = 'none';
          widget.style.visibility = 'hidden';
          return widget;
        },
        { side: -1, stopEvent: () => true }
      );
    })
  );

  return {
    decorations,
    pageCount: res.pageCount,
    breakPositions: res.breaks.map((b) => b.pos),
    lastBreaks: res.breaks.map((b) => ({ pos: b.pos, spacerHeight: b.spacerHeight })),
    changed: true,
  };
}

/**
 * PagedLayoutExtension:
 * Generates purely visual, non-document-altering Widget Decorations for Paged Mode.
 * Returns empty decorations in Continuous Mode.
 * Uses 100ms debounced requestAnimationFrame and strict idempotent guard against cycles.
 */
export const PagedLayoutExtension = Extension.create<PagedLayoutPluginOptions>({
  name: 'pagedLayout',

  addOptions() {
    return {
      getViewMode: () => 'continuous',
      getMargin: () => 'normal',
    };
  },

  addCommands() {
    return {
      recomputePagedLayout:
        (forceStateSync: boolean = true) =>
        ({ editor }: any) => {
          if (editor?.view?.composing) {
            return false;
          }
          editor.view.dispatch(
            editor.view.state.tr
              .setMeta('pagedLayoutForceRefresh', true)
              .setMeta('forcePagedLayoutSync', forceStateSync)
          );
          return true;
        },
      resetPagedLayout:
        () =>
        ({ editor }: any) => {
          if (editor?.view?.composing) {
            return false;
          }
          const tr = editor.view.state.tr
            .setMeta('resetPagedLayoutState', true)
            .setMeta(pagedLayoutPluginKey, {
              decorations: DecorationSet.empty,
              pageCount: 1,
              breakPositions: [],
              lastBreaks: [],
            })
            .setMeta('addToHistory', false);
          editor.view.dispatch(tr);
          return true;
        },
    } as any;
  },

  addProseMirrorPlugins() {
    const options = this.options;
    let isComposing = false;

    return [
      new Plugin<PagedLayoutPluginState>({
        key: pagedLayoutPluginKey,
        state: {
          init() {
            return {
              decorations: DecorationSet.empty,
              pageCount: 1,
              breakPositions: [],
              lastBreaks: [],
            };
          },
          apply(tr, current) {
            if (tr.getMeta('resetPagedLayoutState')) {
              return {
                decorations: DecorationSet.empty,
                pageCount: 1,
                breakPositions: [],
                lastBreaks: [],
              };
            }
            const meta = tr.getMeta(pagedLayoutPluginKey);
            if (meta) {
              return {
                decorations: meta.decorations ?? current.decorations,
                pageCount: meta.pageCount ?? current.pageCount,
                breakPositions: meta.breakPositions ?? current.breakPositions,
                lastBreaks: meta.lastBreaks ?? current.lastBreaks,
              };
            }
            if (tr.docChanged) {
              return {
                decorations: current.decorations.map(tr.mapping, tr.doc),
                pageCount: current.pageCount,
                breakPositions: current.breakPositions.map((p) => tr.mapping.map(p)),
                lastBreaks: current.lastBreaks.map((b) => ({
                  pos: tr.mapping.map(b.pos),
                  spacerHeight: b.spacerHeight,
                })),
              };
            }
            return current;
          },
        },
        props: {
          handleDOMEvents: {
            compositionstart(view) {
              isComposing = true;
              return false;
            },
            compositionend(view) {
              isComposing = false;
              return false;
            },
          },
          decorations(state) {
            return pagedLayoutPluginKey.getState(state)?.decorations || DecorationSet.empty;
          },
        },
        view(editorView) {
          let debounceTimer: any = null;
          let rafId: any = null;
          let isUpdating = false;
          let forceSyncNeeded = false;

          const runLayout = () => {
            if (isUpdating) return;
            // IME Composition Guard: Strictly forbid recalculating or dispatching during active composition
            if (editorView.composing || isComposing) {
              return;
            }

            const wasForceSync = forceSyncNeeded;
            forceSyncNeeded = false;

            const viewMode = options.getViewMode();
            const currentState = pagedLayoutPluginKey.getState(editorView.state);

            if (viewMode !== 'paged') {
              if (currentState && (currentState.pageCount !== 1 || currentState.breakPositions.length > 0 || currentState.decorations !== DecorationSet.empty)) {
                isUpdating = true;
                try {
                  const tr = editorView.state.tr.setMeta(pagedLayoutPluginKey, {
                    decorations: DecorationSet.empty,
                    pageCount: 1,
                    breakPositions: [],
                    lastBreaks: [],
                  });
                  tr.setMeta('addToHistory', false);
                  editorView.dispatch(tr);
                  options.onPageCountChange?.(1);
                } finally {
                  isUpdating = false;
                }
              } else if (wasForceSync) {
                options.onPageCountChange?.(1);
              }
              return;
            }

            const { doc } = editorView.state;
            const dom = editorView.dom;
            if (!dom || !dom.isConnected) return;

            const lastBreaks = currentState?.lastBreaks || [];
            const lastPageCount = currentState?.pageCount || 1;

            const res = createPageBreakDecorations(
              doc,
              dom,
              options.getMargin(),
              lastBreaks,
              lastPageCount
            );

            // Secondary check before dispatching
            if (editorView.composing || isComposing) {
              return;
            }

            if (res.changed) {
              isUpdating = true;
              try {
                const tr = editorView.state.tr.setMeta(pagedLayoutPluginKey, {
                  decorations: res.decorations,
                  pageCount: res.pageCount,
                  breakPositions: res.breakPositions,
                  lastBreaks: res.lastBreaks,
                });
                tr.setMeta('addToHistory', false);
                editorView.dispatch(tr);
                options.onPageCountChange?.(res.pageCount);
              } catch (err) {
                console.warn('PagedLayoutPlugin dispatch caught:', err);
              } finally {
                isUpdating = false;
              }
            } else {
              // Not changed: Decorations and plugin state are already up-to-date.
              // BUT if this was a forced synchronization (mode restoration, recomputePagedLayout, etc.),
              // we MUST guarantee that React UI receives the genuine pageCount!
              if (wasForceSync) {
                options.onPageCountChange?.(res.pageCount);
              }
            }
          };

          const scheduleLayout = (delay = 250) => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
              if (editorView.composing || isComposing) {
                return;
              }
              if (rafId) cancelAnimationFrame(rafId);
              rafId = requestAnimationFrame(runLayout);
            }, delay);
          };

          // Native DOM composition event listeners for foolproof IME state tracking
          const handleDomCompositionStart = () => {
            isComposing = true;
            if (debounceTimer) clearTimeout(debounceTimer);
            if (rafId) cancelAnimationFrame(rafId);
          };

          const handleDomCompositionEnd = () => {
            isComposing = false;
            // Debounce at least 250ms after composition finishes to let character commit stabilize
            scheduleLayout(250);
          };

          editorView.dom.addEventListener('compositionstart', handleDomCompositionStart);
          editorView.dom.addEventListener('compositionend', handleDomCompositionEnd);

          // Schedule initial layout after DOM mounting
          forceSyncNeeded = true;
          scheduleLayout(150);

          return {
            update(view, prevState) {
              // Critical IME Guard: Never trigger layout schedule while composing
              if (view.composing || isComposing) {
                return;
              }
              if (view.state.tr.getMeta('resetPagedLayoutState')) {
                return;
              }
              const isForceRefresh = !!view.state.tr.getMeta('pagedLayoutForceRefresh');
              const isForceSync = !!view.state.tr.getMeta('forcePagedLayoutSync');
              if (isForceSync || isForceRefresh) {
                forceSyncNeeded = true;
              }
              if (view.state.doc !== prevState.doc || isForceRefresh || isForceSync) {
                scheduleLayout(isForceRefresh ? 20 : 250);
              }
            },
            destroy() {
              editorView.dom.removeEventListener('compositionstart', handleDomCompositionStart);
              editorView.dom.removeEventListener('compositionend', handleDomCompositionEnd);
              if (debounceTimer) clearTimeout(debounceTimer);
              if (rafId) cancelAnimationFrame(rafId);
            },
          };
        },
      }),
    ];
  },
});
