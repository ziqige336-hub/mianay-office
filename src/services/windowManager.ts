/**
 * WindowManager.ts
 * Unified Desktop IPC and Web Browser window control interface.
 * Provides cross-environment compatibility for Minimize, Maximize/Restore, and Close actions.
 * Standard Windows behavior: maximize() respects the taskbar; minimize() enters the taskbar.
 */

export interface WindowControlService {
  isElectron: boolean;
  minimizeWindow: () => Promise<{ success: boolean; isFallback?: boolean }>;
  toggleMaximizeWindow: () => Promise<{ isMaximized: boolean; isFallback?: boolean }>;
  isMaximized: () => Promise<boolean>;
  closeWindow: () => Promise<{ success: boolean; isFallback?: boolean }>;
  subscribeWindowState: (callback: (isMaximized: boolean) => void) => () => void;
}

class WindowManagerClass implements WindowControlService {
  /**
   * Robust detection for Electron environment across preload styles and Node integration
   */
  public get isElectron(): boolean {
    if (typeof window === 'undefined') return false;
    const win = window as any;
    return Boolean(
      win.electronAPI?.isElectron ||
      win.electron?.isElectron ||
      win.electronAPI ||
      win.electron ||
      win.process?.type === 'renderer' ||
      typeof win.require === 'function'
    );
  }

  /**
   * Helper to resolve Electron IPC bridge safely across all preload and injection styles
   */
  private getElectronAPI(): any {
    if (typeof window === 'undefined') return null;
    const win = window as any;
    if (win.electronAPI) return win.electronAPI;
    if (win.electron) return win.electron;

    if (typeof win.require === 'function') {
      try {
        const { ipcRenderer } = win.require('electron');
        return {
          isElectron: true,
          minimize: () => ipcRenderer.send('window:minimize'),
          minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
          toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
          toggleMaximizeWindow: () => ipcRenderer.invoke('window:toggle-maximize'),
          isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
          close: () => ipcRenderer.send('window:close'),
          closeWindow: () => ipcRenderer.invoke('window:close'),
          onWindowStateChange: (callback: (isMax: boolean) => void) => {
            const handler = (_event: any, isMax: boolean) => callback(Boolean(isMax));
            ipcRenderer.on('window:state-changed', handler);
            return () => {
              ipcRenderer.removeListener('window:state-changed', handler);
            };
          },
        };
      } catch {
        // Not in electron Node environment
      }
    }
    return null;
  }

  /**
   * Minimize window: calls BrowserWindow.minimize() in Electron
   */
  public async minimizeWindow(): Promise<{ success: boolean; isFallback?: boolean }> {
    const api = this.getElectronAPI();
    if (api) {
      try {
        if (typeof api.minimizeWindow === 'function') {
          await api.minimizeWindow();
          return { success: true, isFallback: false };
        }
        if (typeof api.minimize === 'function') {
          api.minimize();
          return { success: true, isFallback: false };
        }
        if (typeof api.send === 'function') {
          api.send('window:minimize');
          return { success: true, isFallback: false };
        }
      } catch (err) {
        console.warn('[WindowManager] Electron minimizeWindow failed:', err);
      }
    }

    // Web Fallback: Browsers do not permit script-driven window minimization
    return { success: true, isFallback: true };
  }

  /**
   * Toggle Maximize / Restore: calls BrowserWindow.maximize() / BrowserWindow.unmaximize()
   * NEVER triggers fullscreen mode to ensure taskbar remains visible.
   */
  public async toggleMaximizeWindow(): Promise<{ isMaximized: boolean; isFallback?: boolean }> {
    const api = this.getElectronAPI();
    if (api) {
      try {
        if (typeof api.toggleMaximizeWindow === 'function') {
          const isMax = await api.toggleMaximizeWindow();
          return { isMaximized: Boolean(isMax), isFallback: false };
        }
        if (typeof api.toggleMaximize === 'function') {
          api.toggleMaximize();
          // Check actual state after sending toggle
          const isMax = typeof api.isMaximized === 'function' ? await api.isMaximized() : false;
          return { isMaximized: Boolean(isMax), isFallback: false };
        }
        if (typeof api.send === 'function') {
          api.send('window:toggle-maximize');
          const isMax = typeof api.isMaximized === 'function' ? await api.isMaximized() : false;
          return { isMaximized: Boolean(isMax), isFallback: false };
        }
      } catch (err) {
        console.warn('[WindowManager] Electron toggleMaximizeWindow failed:', err);
      }
    }

    // Web Fallback: Pure web preview does not trigger HTML5 Fullscreen to respect desktop window semantics
    return { isMaximized: false, isFallback: true };
  }

  /**
   * Check whether the window is currently maximized
   */
  public async isMaximized(): Promise<boolean> {
    const api = this.getElectronAPI();
    if (api) {
      try {
        if (typeof api.isMaximized === 'function') {
          return Boolean(await api.isMaximized());
        }
      } catch (err) {
        console.warn('[WindowManager] Electron isMaximized check failed:', err);
      }
    }

    return false;
  }

  /**
   * Close the application window: calls BrowserWindow.close() in Electron
   */
  public async closeWindow(): Promise<{ success: boolean; isFallback?: boolean }> {
    const api = this.getElectronAPI();
    if (api) {
      try {
        if (typeof api.closeWindow === 'function') {
          await api.closeWindow();
          return { success: true, isFallback: false };
        }
        if (typeof api.close === 'function') {
          api.close();
          return { success: true, isFallback: false };
        }
        if (typeof api.send === 'function') {
          api.send('window:close');
          return { success: true, isFallback: false };
        }
      } catch (err) {
        console.warn('[WindowManager] Electron closeWindow failed:', err);
      }
    }

    // Web Fallback
    if (typeof window !== 'undefined') {
      try {
        window.close();
      } catch (err) {
        console.warn('[WindowManager] window.close() blocked by browser:', err);
      }
      return { success: true, isFallback: true };
    }

    return { success: false, isFallback: true };
  }

  /**
   * Subscribe to window state changes (maximized vs restored)
   * Dispatches automatically when Electron native window is maximized, unmaximized, or restored.
   */
  public subscribeWindowState(callback: (isMaximized: boolean) => void): () => void {
    const unsubscribes: (() => void)[] = [];
    const api = this.getElectronAPI();

    if (api) {
      if (typeof api.onWindowStateChange === 'function') {
        try {
          const unsub = api.onWindowStateChange((isMax: boolean) => callback(Boolean(isMax)));
          if (typeof unsub === 'function') {
            unsubscribes.push(unsub);
          }
        } catch (err) {
          console.warn('[WindowManager] Failed to bind onWindowStateChange:', err);
        }
      } else if (typeof api.on === 'function') {
        try {
          const unsub = api.on('window:state-changed', (isMax: boolean) => {
            callback(Boolean(isMax));
          });
          if (typeof unsub === 'function') {
            unsubscribes.push(unsub);
          }
        } catch (err) {
          console.warn('[WindowManager] Failed to bind window:state-changed on api.on:', err);
        }
      }
    }

    return () => {
      unsubscribes.forEach((fn) => fn());
    };
  }
}

export const windowManager = new WindowManagerClass();

