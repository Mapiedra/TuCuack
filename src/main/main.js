'use strict';

const { app, BrowserWindow, screen, ipcMain, shell } = require('electron');
const path = require('path');
const store = require('./store');
const { createTray } = require('./tray');
const { initUpdater, configurarAvisos, estadoActualizacion, buscarActualizacion, instalarActualizacion }
  = require('./updater');
const { initChat } = require('./chat');

const isDev = process.argv.includes('--dev');

/** @type {BrowserWindow | null} */
let win = null;
/** @type {import('electron').Tray | null} */
let tray = null;
/** @type {{ send: Function, isReady: Function } | null} */
let chat = null;

// Monitor en el que vive el pato ahora mismo. El overlay cubre ese monitor
// entero (se usa `bounds` y no `workArea` para tapar también la barra de
// tareas, sobre la que el pato camina). Al arrastrarlo a otro monitor, la
// ventana se muda allí en lugar de abarcar todo el escritorio: así no hay una
// ventana gigante que penalice el rendimiento ni problemas con monitores de
// distinta escala, porque cada uno se dibuja en el suyo.
let currentDisplayId = null;

function computeBounds() {
  const d = currentDisplay();
  return { x: d.bounds.x, y: d.bounds.y, width: d.bounds.width, height: d.bounds.height };
}

function currentDisplay() {
  if (currentDisplayId != null) {
    const found = screen.getAllDisplays().find((d) => d.id === currentDisplayId);
    if (found) return found;
  }
  const d = screen.getPrimaryDisplay();
  currentDisplayId = d.id;
  return d;
}

// Línea de "suelo" del pato, medida desde el borde inferior de la pantalla: la
// altura de la barra de tareas, para que camine sobre ella y no por el borde.
//
// La ventana sigue cubriendo el monitor entero (así se le puede lanzar hasta
// arriba); lo que cambia es dónde está el suelo, que es independiente. Si la
// barra está oculta o en un lateral, el hueco es 0 y el pato camina por el
// borde inferior, que es lo razonable.
function groundFromBottom() {
  const d = currentDisplay();
  const gap = (d.bounds.y + d.bounds.height) - (d.workArea.y + d.workArea.height);
  return Math.max(0, Math.round(gap));
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

  win.loadFile(path.join(__dirname, '..', 'desktop', 'index.html'));

  win.once('ready-to-show', () => {
    win.show();
    // Windows recorta al área de trabajo el tamaño pedido en el constructor, de
    // modo que la ventana no llegaría a cubrir la barra de tareas. Repetir los
    // bounds con la ventana ya visible sí surte efecto.
    win.setBounds(computeBounds());
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

// ---- Arrastrar el pato entre monitores ----------------------------------
//
// Mientras se arrastra, se sigue el cursor a nivel de escritorio: los eventos
// del renderer sólo llegan mientras el puntero está sobre la ventana, así que
// no bastarían para detectar que ha salido hacia otro monitor. Cuando el cursor
// entra en otro, la ventana se muda allí y el pato reaparece bajo el puntero.

let dragTimer = null;
const DRAG_POLL_MS = 40;

function displayAt(point) {
  return screen.getDisplayNearestPoint(point);
}

function moveToDisplay(display, cursor) {
  if (!win || win.isDestroyed()) return;
  currentDisplayId = display.id;
  win.setBounds({
    x: display.bounds.x, y: display.bounds.y,
    width: display.bounds.width, height: display.bounds.height
  });
  // Sigue por encima de todo tras la mudanza.
  win.setAlwaysOnTop(true, 'screen-saver');
  win.webContents.send('display:changed', {
    ground: groundFromBottom(),
    width: display.bounds.width,
    height: display.bounds.height,
    // Posición del cursor dentro de la nueva ventana, para recolocar el pato.
    cursor: { x: cursor.x - display.bounds.x, y: cursor.y - display.bounds.y }
  });
}

function startDragTracking() {
  stopDragTracking();
  dragTimer = setInterval(() => {
    if (!win || win.isDestroyed()) return stopDragTracking();
    const cursor = screen.getCursorScreenPoint();
    const target = displayAt(cursor);
    if (target && target.id !== currentDisplayId) moveToDisplay(target, cursor);
  }, DRAG_POLL_MS);
}

function stopDragTracking() {
  if (dragTimer) clearInterval(dragTimer);
  dragTimer = null;
}

ipcMain.on('drag:start', startDragTracking);
ipcMain.on('drag:end', stopDragTracking);

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

// Metadatos de los sprites: cada diseño tiene sus propias filas y frames, así
// que el renderer los lee de aquí en vez de llevarlos escritos.
function leerSprites() {
  try {
    const ruta = path.join(__dirname, '..', '..', 'assets', 'sprites', 'index.json');
    return JSON.parse(require('fs').readFileSync(ruta, 'utf8'));
  } catch (err) {
    console.error('[sprites] no se pudo leer el índice:', err.message);
    return {};
  }
}

ipcMain.handle('config:get', () => ({
  version: app.getVersion(),
  isDev,
  ground: groundFromBottom(),
  sprites: leerSprites()
}));

// Chat entre patos.
ipcMain.on('chat:send', (_evt, msg) => {
  if (chat && msg) chat.send(msg.from, msg.text);
});

// Mandar el pato a la pantalla de otro.
ipcMain.on('chat:visit', (_evt, visita) => {
  if (chat && visita) chat.sendVisit(visita);
});

// Partidas entre patos. No hace falta canal de vuelta: lo que llega viaja por
// `chat:event`, como el resto de lo que pasa en el canal.
ipcMain.on('juego:send', (_evt, mensaje) => {
  if (chat && mensaje) chat.sendGame(mensaje);
});

// Nombre anunciado en la presencia del canal (para la comprobación de unicidad).
ipcMain.on('chat:set-name', (_evt, name) => {
  if (chat) chat.setName(name);
});

ipcMain.handle('chat:names', () => (chat ? chat.names() : []));

// El canal suele conectarse antes de que el renderer registre sus listeners,
// así que éste consulta el estado al arrancar en vez de esperar al evento.
ipcMain.handle('chat:status', () => ({
  connected: chat ? chat.isReady() : false,
  names: chat ? chat.names() : [],
  presentes: chat ? chat.presentes() : [],
  clave: chat ? chat.clave() : '',
  id: chat ? chat.id() : ''
}));

// Actualizaciones a mano. Lo automático sigue igual: esto es para poder mirar
// cuando uno quiera y aplicarla sin esperar a salir de la app.
ipcMain.handle('update:status', () => estadoActualizacion());
ipcMain.on('update:check', () => buscarActualizacion());
ipcMain.on('update:install', () => instalarActualizacion(() => win));

// El pato se esconde solo desde su menú. No se cierra: sigue vivo en la bandeja,
// que es de donde se le vuelve a sacar.
ipcMain.on('app:hide', () => {
  if (win && !win.isDestroyed()) win.hide();
});

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
  // Ya había un pato en marcha, así que esta instancia se retira y le pasa el
  // aviso a la primera para que se deje ver.
  //
  // Se dice en voz alta a propósito: sin el mensaje, `npm start` se limitaba a
  // terminar con éxito y sin ventana, que es exactamente lo que parece un
  // arranque roto. Suele pasar con un pato escondido en la bandeja, o con uno
  // lanzado desde otra terminal y olvidado.
  console.log('[app] ya hay un TuCuack en marcha: se muestra ese y esta instancia se cierra. '
    + 'Para arrancar de cero, ciérralo desde la bandeja o el menú de la mascota.');
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (!win.isVisible()) win.show();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    // El canal de avisos de actualización se abre SIEMPRE, aunque no haya
    // actualizador: si no, en desarrollo el pato preguntaría y la respuesta
    // —"aquí no hay nada que buscar"— no llegaría a ninguna parte.
    configurarAvisos(() => win);
    tray = createTray(() => win, { isDev });
    const ajustes = store.loadSettings();
    applyAutoLaunch(ajustes);
    chat = initChat(() => win, ajustes.displayName, ajustes.patoId);
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
