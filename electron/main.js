const { app, BrowserWindow, shell, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

// ====== Register custom 'app://' scheme BEFORE app.ready ======
// This scheme serves the static Next.js export files in production.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

// ====== Prevent multiple instances ======
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let mainWindow;
const isDev = process.env.NODE_ENV === 'development';

function getResourcePath(...segments) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, ...segments);
  }
  return path.join(__dirname, '..', ...segments);
}

function registerAppProtocol() {
  const staticDir = getResourcePath('app-out');

  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);

    // Decode and normalize the path, prevent directory traversal
    let decoded;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      return new Response('Bad Request', { status: 400 });
    }

    const normalized = path.normalize(decoded);
    // Strip leading separator
    const relative = normalized.startsWith(path.sep) ? normalized.slice(1) : normalized;

    // Block traversal attempts
    if (relative.includes('..')) {
      return new Response('Forbidden', { status: 403 });
    }

    let filePath = path.join(staticDir, relative);

    // Ensure resolved path stays inside staticDir
    if (!filePath.startsWith(staticDir + path.sep) && filePath !== staticDir) {
      return new Response('Forbidden', { status: 403 });
    }

    // Fallback to index.html for SPA style routing
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(staticDir, 'index.html');
    }

    return net.fetch(pathToFileURL(filePath).toString());
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'MITI - ROS2 Dashboard',
    icon: path.join(__dirname, '..', 'public', 'icon.png'),
    backgroundColor: '#030712', // Match app background — prevents white flash
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL('app://localhost/index.html');
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Toggle DevTools with F12 or Ctrl+Shift+I / Cmd+Option+I
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    const isDevToolsKey =
      input.key === 'F12' ||
      (input.control && input.shift && input.key === 'I') ||
      (input.meta && input.alt && input.key === 'I');
    if (isDevToolsKey) {
      mainWindow.webContents.toggleDevTools();
    }
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Focus existing window when a second instance is launched
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  if (!isDev) {
    registerAppProtocol();
  }
  createWindow();

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
