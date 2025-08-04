import { app, BrowserWindow, ipcMain, systemPreferences } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { ElectronServer } from './server/server';

declare global {
  interface Window {
    electronAPI: {
      getServerPort: () => number;
      getServerUrl: () => string;
    };
  }
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let electronServer: ElectronServer;
let serverPort: number;

const createWindow = async (): Promise<void> => { 
  // Start server
  electronServer = new ElectronServer();
  try {
    serverPort = await electronServer.start();
    (global as any).serverPort = serverPort;
    (global as any).serverUrl = `http://localhost:${serverPort}`;
    console.log(`Server running on port ${(global as any).serverPort }`);

  } catch (error) {
    console.error('Failed to start server:', error);
    app.quit();
    return;
  }

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
  });
  console.log(`Server running on port ${(global as any).serverPort }`);

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// Handle IPC requests
ipcMain.handle('get-server-port', () => {
  return serverPort;
});

ipcMain.handle('get-server-url', () => {
  const url = `http://localhost:${serverPort}`;
  return url;
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', async () => {
if (electronServer) {
    await electronServer.stop();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
async function checkMediaPermissions() {
  if (process.platform === 'darwin') {
    const micGranted = await systemPreferences.askForMediaAccess('microphone');
    return { microphone: micGranted };
  }
  return { microphone: true }; // For non-macOS platforms
}

app.whenReady().then(async () => {
  const permissions = await checkMediaPermissions();
  console.log('Media permissions:', permissions);
});