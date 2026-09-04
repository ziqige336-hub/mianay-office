// electron/preload.ts
var import_electron = require("electron");
console.log(">>> [Preload] Electron \u9884\u52A0\u8F7D\u811A\u672C\u5DF2\u6210\u529F\u6267\u884C\uFF01");
var electronAPI = {
  isElectron: true,
  platform: process.platform,
  // Windows 原生窗口控制：最小化
  minimize: () => import_electron.ipcRenderer.send("window:minimize"),
  minimizeWindow: () => import_electron.ipcRenderer.invoke("window:minimize"),
  // Windows 原生窗口控制：最大化 / 还原
  toggleMaximize: () => import_electron.ipcRenderer.send("window:toggle-maximize"),
  toggleMaximizeWindow: () => import_electron.ipcRenderer.invoke("window:toggle-maximize"),
  // 查询当前是否处于最大化
  isMaximized: () => import_electron.ipcRenderer.invoke("window:is-maximized"),
  // Windows 原生窗口控制：关闭
  close: () => import_electron.ipcRenderer.send("window:close"),
  closeWindow: () => import_electron.ipcRenderer.invoke("window:close"),
  // 监听原生窗口最大化/还原状态变化
  onWindowStateChange: (callback) => {
    const handler = (_event, isMax) => callback(Boolean(isMax));
    import_electron.ipcRenderer.on("window:state-changed", handler);
    return () => {
      import_electron.ipcRenderer.removeListener("window:state-changed", handler);
    };
  },
  send: (channel, ...args) => import_electron.ipcRenderer.send(channel, ...args),
  invoke: (channel, ...args) => import_electron.ipcRenderer.invoke(channel, ...args),
  on: (channel, listener) => {
    const subscription = (_event, ...args) => listener(...args);
    import_electron.ipcRenderer.on(channel, subscription);
    return () => import_electron.ipcRenderer.removeListener(channel, subscription);
  },
  openFile: (filters) => import_electron.ipcRenderer.invoke("dialog:openFile", filters),
  saveFile: (options) => import_electron.ipcRenderer.invoke("dialog:saveFile", options)
};
import_electron.contextBridge.exposeInMainWorld("electronAPI", electronAPI);
import_electron.contextBridge.exposeInMainWorld("electron", electronAPI);
