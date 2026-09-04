var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// electron/main.ts
var import_electron = require("electron");
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var mainWindow = null;
function createWindow() {
  mainWindow = new import_electron.BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "Lumina Office",
    frame: false,
    // 隐藏 Windows 系统原生白边与标题栏，采用标准 frameless 窗口
    resizable: true,
    maximizable: true,
    minimizable: true,
    closable: true,
    fullscreen: false,
    fullscreenable: false,
    // 严禁把最大化实现为全屏，禁止全屏覆盖 Windows 任务栏
    kiosk: false,
    alwaysOnTop: false,
    skipTaskbar: false,
    webPreferences: {
      preload: import_path.default.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    },
    autoHideMenuBar: true
  });
  const isDev = process.env.NODE_ENV === "development" || !!process.env.VITE_DEV_SERVER_URL;
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(import_path.default.join(__dirname, "../dist/index.html"));
  }
  mainWindow.on("maximize", () => {
    mainWindow?.webContents.send("window:state-changed", true);
  });
  mainWindow.on("unmaximize", () => {
    mainWindow?.webContents.send("window:state-changed", false);
  });
  mainWindow.on("restore", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("window:state-changed", mainWindow.isMaximized());
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
var executeMinimize = () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.minimize();
    return true;
  }
  return false;
};
import_electron.ipcMain.on("window:minimize", executeMinimize);
import_electron.ipcMain.handle("window:minimize", executeMinimize);
var executeToggleMaximize = () => {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
    return false;
  } else {
    mainWindow.maximize();
    return true;
  }
};
import_electron.ipcMain.on("window:toggle-maximize", executeToggleMaximize);
import_electron.ipcMain.handle("window:toggle-maximize", executeToggleMaximize);
var executeIsMaximized = () => {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow.isMaximized() : false;
};
import_electron.ipcMain.handle("window:is-maximized", executeIsMaximized);
var executeClose = () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
    return true;
  }
  return false;
};
import_electron.ipcMain.on("window:close", executeClose);
import_electron.ipcMain.handle("window:close", executeClose);
import_electron.ipcMain.handle("dialog:openFile", async (_, filters) => {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  const result = await import_electron.dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: filters || [{ name: "All Files", extensions: ["*"] }]
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  const content = await import_fs.default.promises.readFile(filePath);
  return {
    filePath,
    data: content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength)
  };
});
import_electron.ipcMain.handle("dialog:saveFile", async (_, { defaultPath, data, filters }) => {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  const result = await import_electron.dialog.showSaveDialog(mainWindow, {
    defaultPath,
    filters: filters || [{ name: "All Files", extensions: ["*"] }]
  });
  if (result.canceled || !result.filePath) return false;
  await import_fs.default.promises.writeFile(result.filePath, Buffer.from(data));
  return true;
});
import_electron.app.whenReady().then(createWindow);
import_electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") import_electron.app.quit();
});
