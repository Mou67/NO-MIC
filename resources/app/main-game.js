const { app, BrowserWindow, ipcMain, globalShortcut, screen } = require('electron');
const path = require('path');

// GPU-Cache Optimierungen (vor app.whenReady)
app.commandLine.appendSwitch('--disable-gpu-cache');
app.commandLine.appendSwitch('--disable-software-rasterizer');
app.commandLine.appendSwitch('--no-sandbox');

let mainWindow;
let overlayWindow;
let isOverlayMode = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#1a1a2e',
    show: false,
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Entwicklertools nur im Dev-Modus öffnen
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

function createOverlayWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  overlayWindow = new BrowserWindow({
    width: 400,
    height: 200,
    x: width - 420,
    y: 20,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    transparent: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  overlayWindow.loadFile('overlay.html');
  overlayWindow.setIgnoreMouseEvents(false);
  
  // Auto-hide nach 5 Sekunden Inaktivität
  let hideTimer;
  const resetHideTimer = () => {
    clearTimeout(hideTimer);
    overlayWindow.setOpacity(1);
    hideTimer = setTimeout(() => {
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.setOpacity(0.3);
      }
    }, 5000);
  };

  overlayWindow.on('mouse-enter', resetHideTimer);
  overlayWindow.on('mouse-leave', resetHideTimer);
  
  // Cleanup when overlay is closed
  overlayWindow.on('closed', () => {
    overlayWindow = null;
    isOverlayMode = false;
    clearTimeout(hideTimer);
  });
  
  resetHideTimer();
}

app.whenReady().then(() => {
  createWindow();
  
  // Globale Hotkeys registrieren
  globalShortcut.register('F9', () => {
    toggleOverlayMode();
  });
  
  globalShortcut.register('F10', () => {
    if (overlayWindow) {
      overlayWindow.webContents.send('quick-speak');
    }
  });
  
  globalShortcut.register('F11', () => {
    if (overlayWindow) {
      overlayWindow.webContents.send('stop-speech');
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

function toggleOverlayMode() {
  if (!isOverlayMode) {
    createOverlayWindow();
    if (mainWindow) {
      mainWindow.hide();
    }
    isOverlayMode = true;
  } else {
    if (overlayWindow) {
      overlayWindow.close();
      overlayWindow = null;
    }
    if (mainWindow) {
      mainWindow.show();
    }
    isOverlayMode = false;
  }
}

// IPC Handlers
ipcMain.handle('minimize-window', async () => {
  if (mainWindow) mainWindow.minimize();
  return true;
});

ipcMain.handle('maximize-window', async () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
  return true;
});

ipcMain.handle('close-window', async () => {
  if (mainWindow) mainWindow.close();
  return true;
});

ipcMain.handle('toggle-overlay', async () => {
  try {
    toggleOverlayMode();
    return { success: true, isOverlayMode };
  } catch (error) {
    console.error('Error toggling overlay:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('close-overlay', async () => {
  try {
    if (overlayWindow) {
      overlayWindow.close();
      overlayWindow = null;
    }
    isOverlayMode = false;
    if (mainWindow) {
      mainWindow.show();
    }
    return { success: true };
  } catch (error) {
    console.error('Error closing overlay:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-overlay-mode', async () => {
  return { isOverlayMode };
});

// Game Integration API
ipcMain.handle('game-speak', (event, text, voiceSettings) => {
  if (overlayWindow) {
    overlayWindow.webContents.send('speak-text', text, voiceSettings);
  }
});

ipcMain.handle('game-get-voices', () => {
  return new Promise((resolve) => {
    if (mainWindow) {
      mainWindow.webContents.send('get-voices-request');
      ipcMain.once('voices-response', (event, voices) => {
        resolve(voices);
      });
    }
  });
});
