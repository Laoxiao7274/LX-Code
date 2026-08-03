import { app, BrowserWindow, shell } from "electron";
import path from "node:path";

// 是否开发模式(由 vite dev server 提供页面)。
const DEV_SERVER_URL = process.env.LX_DEV_SERVER_URL;
const isDev = !!DEV_SERVER_URL;

// 某些 Windows 环境 GPU 驱动不可用,禁用硬件加速避免 GPU 进程崩溃。
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("no-sandbox");
app.disableHardwareAcceleration();

let mainWindow: BrowserWindow | null = null;

/** 创建主窗口。 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#0e0e14",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // 准备好再显示,避免白闪
  mainWindow.once("ready-to-show", () => mainWindow?.show());

  // 外部链接用系统浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    void mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  // macOS 上应用应保持活动,除非用户显式退出
  if (process.platform !== "darwin") app.quit();
});
