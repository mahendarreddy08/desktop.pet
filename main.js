const { app, BrowserWindow, ipcMain, screen, Menu } = require('electron');
const path = require('path');

let mainWindow = null;

const WINDOW_HEIGHT = 320;

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { x, y, width, height } = primaryDisplay.workArea;

  mainWindow = new BrowserWindow({
    width,
    height: WINDOW_HEIGHT,
    x,
    y: y + height - WINDOW_HEIGHT,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.loadFile('index.html');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function buildContextMenu() {
  return Menu.buildFromTemplate([
    {
      label: 'Start 25m Focus Session',
      click: () => mainWindow?.webContents.send('pet-action', 'focus-start'),
    },
    {
      label: 'Start 5m Break',
      click: () => mainWindow?.webContents.send('pet-action', 'break-start'),
    },
    { type: 'separator' },
    {
      label: 'End Session',
      click: () => mainWindow?.webContents.send('pet-action', 'session-end'),
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit(),
    },
  ]);
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.on('show-context-menu', () => {
    if (mainWindow) {
      buildContextMenu().popup({ window: mainWindow });
    }
  });

  ipcMain.on('set-ignore-mouse-events', (_event, ignore, options) => {
    if (mainWindow) {
      mainWindow.setIgnoreMouseEvents(ignore, options);
    }
  });

  ipcMain.on('move-window', (_event, deltaX, deltaY) => {
    if (mainWindow) {
      const [wx, wy] = mainWindow.getPosition();
      mainWindow.setPosition(Math.round(wx + deltaX), Math.round(wy + deltaY));
    }
  });

  ipcMain.on('set-window-position', (_event, x, y) => {
    if (mainWindow) {
      mainWindow.setPosition(Math.round(x), Math.round(y));
    }
  });

  ipcMain.handle('get-screen-bounds', () => {
    const display = screen.getPrimaryDisplay();
    return {
      workArea: display.workArea,
      bounds: display.bounds,
    };
  });

  ipcMain.handle('get-window-position', () => {
    if (!mainWindow) return { x: 0, y: 0 };
    const [x, y] = mainWindow.getPosition();
    return { x, y };
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
