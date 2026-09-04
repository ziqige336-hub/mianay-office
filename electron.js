const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    frame: false, // 移除系统原生标题栏，使用自定义标题栏
    resizable: true,
    maximizable: true,
    minimizable: true,
    closable: true,
    fullscreen: false,
    fullscreenable: false, // 严禁把最大化实现为全屏，禁止覆盖 Windows 任务栏
    kiosk: false,
    alwaysOnTop: false,
    skipTaskbar: false,
    webPreferences: {
      nodeIntegration: true,   // 启用 Node 能力
      contextIsolation: false, // 允许直接将 API 挂载至前端 window
    },
  });

  // 监听真实 Windows 窗口状态，通知前端 Renderer，同步更新最大化/还原按钮
  win.on('maximize', () => {
    win?.webContents.send('window:state-changed', true);
  });

  win.on('unmaximize', () => {
    win?.webContents.send('window:state-changed', false);
  });

  win.on('restore', () => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('window:state-changed', win.isMaximized());
    }
  });

  // 页面加载完成后，直接向前端注入通信接口，避免任何路径丢失
  win.webContents.on('did-finish-load', () => {
    win.webContents.executeJavaScript(`
      (() => {
        const { ipcRenderer } = require('electron');
        const api = {
          isElectron: true,
          platform: process.platform,
          minimize: () => ipcRenderer.send('window:minimize'),
          minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
          toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
          toggleMaximizeWindow: () => ipcRenderer.invoke('window:toggle-maximize'),
          isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
          close: () => ipcRenderer.send('window:close'),
          closeWindow: () => ipcRenderer.invoke('window:close'),
          onWindowStateChange: (callback) => {
            const handler = (_event, isMax) => callback(Boolean(isMax));
            ipcRenderer.on('window:state-changed', handler);
            return () => {
              ipcRenderer.removeListener('window:state-changed', handler);
            };
          },
        };
        window.electronAPI = api;
        window.electron = api;
      })();
    `);
  });

  // 加载打包后的前端静态文件
  win.loadFile(path.join(__dirname, 'dist/index.html'));

  win.on('closed', () => {
    win = null;
  });
}

// 操作系统级窗口事件监听：最小化 (BrowserWindow.minimize)
const executeMinimize = () => {
  if (win && !win.isDestroyed()) {
    win.minimize();
    return true;
  }
  return false;
};
ipcMain.on('window:minimize', executeMinimize);
ipcMain.handle('window:minimize', executeMinimize);

// 操作系统级窗口事件监听：最大化 / 还原 (BrowserWindow.maximize / unmaximize)
// Windows 操作系统负责原生工作区最大化，避开任务栏
const executeToggleMaximize = () => {
  if (!win || win.isDestroyed()) return false;
  if (win.isMaximized()) {
    win.unmaximize();
    return false;
  } else {
    win.maximize();
    return true;
  }
};
ipcMain.on('window:toggle-maximize', executeToggleMaximize);
ipcMain.handle('window:toggle-maximize', executeToggleMaximize);

// 操作系统级窗口状态查询
const executeIsMaximized = () => {
  return win && !win.isDestroyed() ? win.isMaximized() : false;
};
ipcMain.handle('window:is-maximized', executeIsMaximized);

// 操作系统级窗口事件监听：关闭 (BrowserWindow.close)
const executeClose = () => {
  if (win && !win.isDestroyed()) {
    win.close();
    return true;
  }
  return false;
};
ipcMain.on('window:close', executeClose);
ipcMain.handle('window:close', executeClose);

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
