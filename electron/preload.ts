import { contextBridge, ipcRenderer } from 'electron';

console.log('>>> [Preload] Electron 预加载脚本已成功执行！');

const electronAPI = {
  isElectron: true,
  platform: process.platform,

  // Windows 原生窗口控制：最小化
  minimize: () => ipcRenderer.send('window:minimize'),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),

  // Windows 原生窗口控制：最大化 / 还原
  toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('window:toggle-maximize'),

  // 查询当前是否处于最大化
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),

  // Windows 原生窗口控制：关闭
  close: () => ipcRenderer.send('window:close'),
  closeWindow: () => ipcRenderer.invoke('window:close'),

  // 监听原生窗口最大化/还原状态变化
  onWindowStateChange: (callback: (isMaximized: boolean) => void) => {
    const handler = (_event: any, isMax: boolean) => callback(Boolean(isMax));
    ipcRenderer.on('window:state-changed', handler);
    return () => {
      ipcRenderer.removeListener('window:state-changed', handler);
    };
  },

  send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
  on: (channel: string, listener: (...args: any[]) => void) => {
    const subscription = (_event: any, ...args: any[]) => listener(...args);
    ipcRenderer.on(channel, subscription);
    return () => ipcRenderer.removeListener(channel, subscription);
  },

  openFile: (filters?: any) => ipcRenderer.invoke('dialog:openFile', filters),
  saveFile: (options?: any) => ipcRenderer.invoke('dialog:saveFile', options),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
contextBridge.exposeInMainWorld('electron', electronAPI);
