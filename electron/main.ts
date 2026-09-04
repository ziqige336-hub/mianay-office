import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';

// 允许 file:// 协议访问本地资源与加载离线 Worker / WASM
app.commandLine.appendSwitch('allow-file-access-from-files');

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Lumina Office',
    frame: false, // 隐藏 Windows 系统原生白边与标题栏，采用标准 frameless 窗口
    resizable: true,
    maximizable: true,
    minimizable: true,
    closable: true,
    fullscreen: false,
    fullscreenable: false, // 严禁把最大化实现为全屏，禁止全屏覆盖 Windows 任务栏
    kiosk: false,
    alwaysOnTop: false,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
    },
    autoHideMenuBar: true,
  });

  const isDev = process.env.NODE_ENV === 'development' || !!process.env.VITE_DEV_SERVER_URL;

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // 监听真实 Windows 窗口状态，通过 IPC 通知前端 Renderer，保证最大化/还原图标完全同步
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:state-changed', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:state-changed', false);
  });

  mainWindow.on('restore', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:state-changed', mainWindow.isMaximized());
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 真正的系统级窗口控制：最小化 (BrowserWindow.minimize)
const executeMinimize = () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.minimize();
    return true;
  }
  return false;
};
ipcMain.on('window:minimize', executeMinimize);
ipcMain.handle('window:minimize', executeMinimize);

// 真正的系统级窗口控制：最大化 / 还原 (BrowserWindow.maximize / unmaximize)
// 让 Windows 操作系统窗口管理器负责工作区最大化，自动停留在任务栏上方，绝不覆盖任务栏
const executeToggleMaximize = () => {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
    return false;
  } else {
    mainWindow.maximize();
    return true;
  }
};
ipcMain.on('window:toggle-maximize', executeToggleMaximize);
ipcMain.handle('window:toggle-maximize', executeToggleMaximize);

// 检查是否最大化
const executeIsMaximized = () => {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow.isMaximized() : false;
};
ipcMain.handle('window:is-maximized', executeIsMaximized);

// 真正的系统级窗口控制：关闭 (BrowserWindow.close)
const executeClose = () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
    return true;
  }
  return false;
};
ipcMain.on('window:close', executeClose);
ipcMain.handle('window:close', executeClose);

// 文件对话框
ipcMain.handle('dialog:openFile', async (_, filters) => {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: filters || [{ name: 'All Files', extensions: ['*'] }],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  const content = await fs.promises.readFile(filePath);
  return {
    filePath,
    data: content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength),
  };
});

ipcMain.handle('dialog:saveFile', async (_, { defaultPath, data, filters }) => {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath,
    filters: filters || [{ name: 'All Files', extensions: ['*'] }],
  });
  if (result.canceled || !result.filePath) return false;
  await fs.promises.writeFile(result.filePath, Buffer.from(data));
  return true;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
