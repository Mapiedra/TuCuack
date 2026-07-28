'use strict';

const { app, BrowserWindow, screen, ipcMain, shell } = require('electron');
const path = require('path');
const store = require('./store');
const { createTray } = require('./tray');
const { initUpdater } = require('./updater');
const { initChat } = require('./chat');

const isDev = process.argv.includes('--dev');

/** @type {BrowserWindow | null} */
let win = null;
/** @type {import('electron').Tray | null} */
let tray = null;
/** @type {{ send: Function, isReady: Function } | null} */
let chat = null;

// El overlay ocupa la pantalla completa para poder arrastrar el pato a
// cualquier punto. Se usa `bounds` (no `workArea`) para cubrir también la barra
// de tareas, sobre la que el pato camina.
function computeBounds() {
  const b = screen.getPrimaryDisplay().bounds;
  return { x: b.x, y: b.y, width: b.width, height: b.height };
}

// Línea de "suelo" del pato, medida desde el borde inferior de la pantalla.
// 0 = el pato camina SOBRE la barra de tareas (la pisa), que es el efecto
// buscado. Para que caminase por encima de la barra en vez de sobre ella,
// bastaría devolver su altura:
//   const d = screen.getPrimaryDisplay();
//   return (d.bounds.y + d.bounds.height) - (d.workArea.y + d.workArea.height);
const GROUND_FROM_BOTTOM = 0;

function groundFromBottom() {
  return GROUND_FROM_BOTTOM;
}

function createWindow() {
  const bounds = computeBounds();

  win = new BrowserWindow({
    ...bounds,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    hasShadow: false,
    focusable: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  // Sobre la barra de tareas.
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Por defecto los clics atraviesan el overlay hacia las apps de debajo.
  // El renderer lo desactiva al pasar el ratón por el pato/paneles.
  win.setIgnoreMouseEvents(true, { forward: true });

  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  win.once('ready-to-show', () => {
    win.show();
    if (isDev) win.webContents.openDevTools({ mode: 'detach' });
    if (process.argv.includes('--capture') || process.argv.includes('--probe')) {
      require('./capture').run(win, app, path);
    }
  });

  win.on('closed', () => {
    win = null;
  });

  // Recolocar si cambia la resolución o la configuración de pantallas.
  const reposition = () => {
    if (!win || win.isDestroyed()) return;
    win.setBounds(computeBounds());
    win.webContents.send('layout:changed', { ground: groundFromBottom() });
  };
  screen.on('display-metrics-changed', reposition);
  screen.on('display-added', reposition);
  screen.on('display-removed', reposition);
}

// ---- IPC ----------------------------------------------------------------

// El renderer decide, según el hover, si el overlay debe capturar el ratón.
ipcMain.on('set-ignore-mouse', (_evt, ignore) => {
  if (!win || win.isDestroyed()) return;
  if (ignore) {
    win.setIgnoreMouseEvents(true, { forward: true });
  } else {
    win.setIgnoreMouseEvents(false);
  }
});

// Persistencia expuesta al renderer.
ipcMain.handle('state:load', () => store.load());
ipcMain.on('state:save', (_evt, data) => store.save(data));

ipcMain.handle('settings:load', () => store.loadSettings());
ipcMain.on('settings:save', (_evt, data) => {
  store.saveSettings(data);
  applyAutoLaunch(data);
});

ipcMain.handle('config:get', () => ({
  version: app.getVersion(),
  isDev,
  ground: groundFromBottom()
}));

// Chat entre patos.
ipcMain.on('chat:send', (_evt, msg) => {
  if (chat && msg) chat.send(msg.from, msg.text);
});

// Nombre anunciado en la presencia del canal (para la comprobación de unicidad).
ipcMain.on('chat:set-name', (_evt, name) => {
  if (chat) chat.setName(name);
});

ipcMain.handle('chat:names', () => (chat ? chat.names() : []));

ipcMain.on('app:quit', () => app.quit());
ipcMain.on('open-external', (_evt, url) => {
  if (typeof url === 'string' && /^https?:\/\//.test(url)) shell.openExternal(url);
});

function applyAutoLaunch(settings) {
  if (isDev) return;
  app.setLoginItemSettings({ openAtLogin: !!(settings && settings.autoLaunch) });
}

// ---- Ciclo de vida ------------------------------------------------------

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (!win.isVisible()) win.show();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    tray = createTray(() => win, { isDev });
    applyAutoLaunch(store.loadSettings());
    chat = initChat(() => win, store.loadSettings().displayName);
    if (!isDev) initUpdater(() => win);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

// El pato vive en la bandeja; no cerramos la app al cerrar la ventana.
app.on('window-all-closed', () => {
  // No-op en Windows: se sale desde la bandeja o el menú del pato.
});

app.on('before-quit', () => {
  if (win && !win.isDestroyed()) {
    win.webContents.send('app:before-quit');
  }
});
