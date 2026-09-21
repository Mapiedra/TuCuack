'use strict';

const { app, BrowserWindow, screen, ipcMain, shell } = require('electron');
const path = require('path');
const store = require('./store');
const marcador = require('./marcador');
const historial = require('./historial');
const partidas = require('./partidas');
const cuacks = require('./cuacks');
const mensajes = require('./mensajes');
const { createTray } = require('./tray');
const { initUpdater, configurarAvisos, estadoActualizacion, buscarActualizacion, instalarActualizacion }
  = require('./updater');
const { initChat } = require('./chat');
const sistema = require('./sistema');
const { crearGuardiaDelRaton } = require('./raton');
const { crearSensor } = require('./sensor');

// Antes de que Electron arranque: en Linux, X11 (ver `prepararLinea`).
sistema.prepararLinea(app);

const isDev = process.argv.includes('--dev');

/** @type {BrowserWindow | null} */
let win = null;
/** @type {import('electron').Tray | null} */
let tray = null;
/** @type {{ send: Function, isReady: Function } | null} */
let chat = null;

// El timbre del pato: sólo donde la ventana no avisa de nada (ver `sensor.js`).
// En Windows no se crea, así que no hay ni ventana de más ni un canal abierto.
const sensor = sistema.reenviaElRaton ? null : crearSensor({
  alPuntero: (evento) => repartirPuntero(evento),
  prueba: sistema.timbreDePrueba
});

// Quien decide si el overlay captura el ratón. En Windows es un pasamanos
// —la ventana se apaña sola—; en Linux sondea el cursor y pone el timbre,
// porque la ventana no avisa. Ver `raton.js`.
const guardiaDelRaton = crearGuardiaDelRaton({
  getWin: () => win,
  getGround: () => groundFromBottom(),
  sondear: !sistema.reenviaElRaton,
  sensor,
  siempre: sistema.noSoltarElRaton,
  diagnostico: sistema.diagnostico
});

/**
 * Lo que oye el timbre, al pato.
 *
 * Llega en coordenadas de pantalla y se le pasa al overlay en las suyas, que
 * son las del documento: el pato las recibe como un evento de ratón normal y
 * no tiene por qué enterarse de que ha venido por otra puerta.
 */
function repartirPuntero(evento) {
  if (!win || win.isDestroyed()) return;
  const b = win.getBounds();
  win.webContents.send('puntero:sensor', {
    tipo: evento.tipo,
    x: evento.x - b.x,
    y: evento.y - b.y,
    botones: evento.botones,
    boton: evento.boton
  });
}

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
  guardiaDelRaton.reiniciar();

  win = new BrowserWindow({
    ...bounds,
    transparent: true,
    // Windows se da por enterado con `transparent`; algunos compositores de
    // Linux pintan negro si no se les dice además de qué color es la nada.
    ...(sistema.esLinux ? { backgroundColor: '#00000000' } : {}),
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
  // El renderer lo desactiva al pasar el ratón por el pato/paneles —y donde no
  // llega a enterarse de que hay alguien encima, el guardia se lo dice.
  guardiaDelRaton.pedirCaptura(false);

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
    guardiaDelRaton.reiniciar();
    if (sensor) sensor.cerrar();
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
  guardiaDelRaton.pedirCaptura(!ignore);
});

// Dónde está el pato ahora mismo, para poder verlo venir donde la ventana no
// reenvía el movimiento del cursor. Sólo lo publica quien hace falta: en
// Windows este canal no lo usa nadie (ver `necesitaZonas` en `config:get`).
ipcMain.on('zonas:pato', (_evt, caja) => {
  guardiaDelRaton.anotarZona(caja || null);
});

// Y lo que oye el timbre. Sólo existe donde hay timbre.
let ultimoAviso = 0;
ipcMain.on('sensor:puntero', (_evt, evento) => {
  if (!sensor || !evento) return;
  // Con `--diagnostico`, que se vea que el timbre suena: es LA pregunta cuando
  // el pato no responde. Sin aturdir: dos avisos por segundo bastan.
  if (sistema.diagnostico && (evento.tipo !== 'mousemove' || Date.now() - ultimoAviso > 500)) {
    ultimoAviso = Date.now();
    console.log('[diag] el timbre oye', JSON.stringify(evento));
  }
  sensor.oir(evento);
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
  // Si la ventana no reenvía el ratón, el pato tiene que ir diciendo dónde
  // está: es la única pista que le queda al proceso principal.
  necesitaZonas: !sistema.reenviaElRaton,
  sprites: leerSprites()
}));

// Chat entre patos.
ipcMain.on('chat:send', (_evt, msg) => {
  if (chat && msg) chat.send(msg.from, msg.text, msg.mid);
});

// Mandar el pato a la pantalla de otro.
ipcMain.on('chat:visit', (_evt, visita) => {
  if (chat && visita) chat.sendVisit(visita);
});

// Partidas entre patos. No hace falta canal de vuelta: lo que llega viaja por
// `chat:event`, como el resto de lo que pasa en el canal.
ipcMain.on('juego:send', (_evt, mensaje, porSala) => {
  if (chat && mensaje) chat.sendGame(mensaje, porSala);
});

// El canal privado de una partida. Lo abre y lo cierra el gestor de salas del
// pato; aquí sólo se le pasa el recado a quien tiene la conexión.
ipcMain.on('juego:sala-entrar', (_evt, salaId) => {
  if (chat) chat.entrarEnSala(salaId);
});
ipcMain.on('juego:sala-salir', () => {
  if (chat) chat.salirDeSala();
});

// Tirar el canal a propósito, para poder ver la reconexión a mitad de partida.
// Sólo en desarrollo: fuera de `--dev` este canal IPC no existe, así que desde
// una app instalada no hay forma de llamarlo.
if (isDev) {
  ipcMain.on('chat:caer', () => {
    if (chat && chat.caerAdrede) chat.caerAdrede();
  });
}

// Nombre anunciado en la presencia del canal (para la comprobación de unicidad).
ipcMain.on('chat:set-name', (_evt, name) => {
  if (chat) chat.setName(name);
});

ipcMain.handle('chat:names', () => (chat ? chat.names() : []));

// Histórico del chat. Vive en su propio fichero y lo escribe este proceso,
// que es el único que sigue aquí cuando la ventana se va (ver historial.js).
ipcMain.handle('historial:cargar', () => historial.cargar());
ipcMain.on('historial:anotar', (_evt, mensaje) => historial.anotar(mensaje));
ipcMain.on('historial:leido', (_evt, ts) => historial.marcarLeido(ts));

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

// Marcador global. La firma con la que se escribe se queda aquí: el renderer
// pide «guarda esta marca» y no sabe con qué se firma. Ver main/marcador.js.
ipcMain.handle('marcador:mejores', (_evt, juego, mejorEs) => marcador.mejores(juego, mejorEs));
ipcMain.handle('marcador:todos', () => marcador.todos());

// Historial de partidas por red. Como el marcador, la firma se queda a este
// lado del puente; a diferencia de él, leer también la exige.
ipcMain.handle('partidas:guardar', (_evt, p) => partidas.guardar(p));
ipcMain.handle('partidas:mias', () => partidas.mias());

// El monedero. Igual que el marcador: el pato pide y este lado firma. Y aquí
// hay un motivo más para que sea así —el de fondo, en realidad—: el importe de
// cada partida lo calcula el servidor, no el pato. Ver supabase/cuacks.sql.
ipcMain.handle('cuacks:mios', () => cuacks.mios());
ipcMain.handle('cuacks:estrenar', (_evt, local) => cuacks.estrenar(local || {}));
ipcMain.handle('cuacks:partida', (_evt, p) => cuacks.apuntarPartida(p || {}));
ipcMain.handle('cuacks:comprar', (_evt, id) => cuacks.comprar(id));
ipcMain.handle('cuacks:broma', (_evt, nivel) => cuacks.cobrarBroma(nivel));
ipcMain.handle('cuacks:borrar', () => cuacks.borrar());

// Mensajes privados. Ni el secreto ni la lista de bloqueados cruzan el puente:
// el pato pide y este lado firma (ver mensajes.js y supabase/mensajes.sql).
ipcMain.handle('privados:enviar', (_evt, m) => mensajes.enviar(m || {}));
ipcMain.handle('privados:leer', (_evt, con, tope) => mensajes.leer(con, tope));
ipcMain.handle('privados:conversaciones', () => mensajes.conversaciones());
ipcMain.handle('privados:bloquear', (_evt, a, si) => mensajes.bloquear(a, si));
ipcMain.handle('privados:bloqueados', () => mensajes.bloqueados());
ipcMain.handle('privados:borrar-todo', () => mensajes.borrarTodo());
ipcMain.handle('marcador:guardar', (_evt, record) => marcador.guardar(record));
ipcMain.on('update:check', () => buscarActualizacion());
ipcMain.on('update:install', () => instalarActualizacion(() => win));

// El pato se esconde solo desde su menú. No se cierra: sigue vivo en la bandeja,
// que es de donde se le vuelve a sacar.
ipcMain.on('app:hide', () => {
  if (win && !win.isDestroyed()) win.hide();
});

// Y al revés: el modo concentración se saca solo al llegar el descanso, sin
// esperar a que alguien pase por la bandeja.
ipcMain.on('app:show', () => {
  if (win && !win.isDestroyed()) win.show();
});

// Cuánto queda del modo concentración, para el tooltip de la bandeja: es el
// único sitio donde se puede consultar mientras el pato está escondido.
ipcMain.on('focus:tick', (_evt, estado) => {
  if (tray && tray.actualizarFoco) tray.actualizarFoco(estado);
});

ipcMain.on('app:quit', () => app.quit());
ipcMain.on('open-external', (_evt, url) => {
  if (typeof url === 'string' && /^https?:\/\//.test(url)) shell.openExternal(url);
});

function applyAutoLaunch(settings) {
  if (isDev) return;
  sistema.aplicarArranqueAutomatico(app, !!(settings && settings.autoLaunch));
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
    // Lo que hace falta saber cuando el pato se porta raro en un sistema que
    // aquí no hay forma de mirar: qué plataforma, y si el overlay se va a
    // enterar solo de que el cursor se acerca o va a hacer falta sondearlo.
    console.log(`[app] ${process.platform}`
      + ` · ratón ${sistema.reenviaElRaton ? 'reenviado por la ventana' : 'sondeado (ver raton.js)'}`);
    createWindow();
    if (sistema.diagnostico) arrancarDiagnostico();
    // El canal de avisos de actualización se abre SIEMPRE, aunque no haya
    // actualizador: si no, en desarrollo el pato preguntaría y la respuesta
    // —"aquí no hay nada que buscar"— no llegaría a ninguna parte.
    configurarAvisos(() => win);
    tray = createTray(() => win, { isDev });
    const ajustes = store.loadSettings();
    applyAutoLaunch(ajustes);
    chat = initChat(() => win, ajustes.displayName, ajustes.patoId, store.direccion());
    if (!isDev) initUpdater(() => win);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

// ---- Diagnóstico (`--diagnostico`) --------------------------------------
//
// El soporte de Linux se escribió sin una máquina donde ejecutarlo, así que
// cuando algo no va, lo que hace falta no es una teoría: es ver lo que el pato
// ve. Esto lo dice todo por la terminal, una vez por segundo, para poder
// pegarlo tal cual.
//
// Lo importante es la línea del cursor: si no cambia mientras se mueve el ratón
// por la pantalla, el sistema NO nos está diciendo dónde está (es lo que pasa
// bajo XWayland con una ventana que deja pasar los clics), y entonces lo que
// tiene que salvar la situación es el timbre. Ver `sensor.js`.
function arrancarDiagnostico() {
  const d = screen.getPrimaryDisplay();
  console.log('[diag] sesión:', process.env.XDG_SESSION_TYPE || '?',
    '· escritorio:', process.env.XDG_CURRENT_DESKTOP || process.env.DESKTOP_SESSION || '?',
    '· ozone:', app.commandLine.getSwitchValue('ozone-platform') || '(por defecto)');
  console.log('[diag] pantalla:', JSON.stringify({
    bounds: d.bounds, workArea: d.workArea, escala: d.scaleFactor
  }));

  // Lo que diga el pato por su consola, aquí: un error del renderer en un
  // sistema que no se puede mirar es, si no, un silencio.
  const enganchar = () => {
    if (!win || win.isDestroyed()) return;
    win.webContents.on('console-message', (...args) => {
      // La firma cambió de posicional a objeto entre versiones de Electron.
      const d0 = args[1];
      const texto = d0 && typeof d0 === 'object' ? d0.message : args[2];
      const nivel = d0 && typeof d0 === 'object' ? d0.level : args[1];
      console.log(`[pato:${nivel}]`, texto);
    });
    win.webContents.on('render-process-gone', (_e, detalles) =>
      console.log('[diag] el pato se ha caído:', JSON.stringify(detalles)));
  };
  enganchar();

  setInterval(() => {
    const e = guardiaDelRaton.estado();
    console.log('[diag]', JSON.stringify({
      cursor: e.cursor,
      ventana: e.ventana,
      visible: e.visible,
      suelo: e.suelo,
      zona: e.zona,
      edadZona: e.edadDeLaZona,
      enLaCaja: e.enLaCaja,
      ignorando: e.ignorando,
      loPide: e.loPideElPato,
      sensor: e.sensor
    }));
  }, 1000);
}

// El pato vive en la bandeja; no cerramos la app al cerrar la ventana.
app.on('window-all-closed', () => {
  // No-op: se sale desde la bandeja o el menú del pato.
});

app.on('before-quit', () => {
  // El timbre es una ventana más: si se queda abierta, la app no termina de
  // cerrarse y el pato se queda de fantasma en la lista de procesos.
  if (sensor) sensor.cerrar();
  // Lo que quedara sin volcar del histórico: las escrituras van con retardo
  // para no reescribir el fichero en cada mensaje, y al salir ya no hay más
  // ocasiones.
  historial.guardarYa();
  if (win && !win.isDestroyed()) {
    win.webContents.send('app:before-quit');
  }
});
