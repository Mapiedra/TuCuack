'use strict';

// Auto-update vía electron-updater + GitHub Releases.
// Se activa solo en producción (no en `--dev`).
//
// El comportamiento automático es el de siempre y no se toca: comprueba al
// arrancar, descarga en segundo plano e instala al salir. Lo que se añade aquí
// es poder pedirlo A MANO, porque ese automatismo tiene dos huecos que se notan:
//
//   - Comprueba UNA vez, al arrancar. Si el pato lleva abierto desde antes de
//     que se publicara la versión, no se entera por mucho que espere.
//   - Instala al SALIR, y el pato vive en la bandeja: cerrar la ventana no es
//     salir. De ahí lo de "abro y cierro varias veces hasta que se aplica".
//
// Con el botón de Ajustes se puede mirar cuando uno quiera y aplicarla en el
// momento, sin depender de ninguna de las dos cosas.

let autoUpdater = null;
try {
  ({ autoUpdater } = require('electron-updater'));
} catch {
  autoUpdater = null;
}

/** Si `initUpdater` llegó a arrancar. En desarrollo no se llama siquiera. */
let iniciado = false;
let avisar = () => {};

/**
 * Lo último que se sabe.
 *
 * Se guarda porque los eventos vuelan antes de que nadie escuche: la
 * comprobación del arranque termina mucho antes de que el usuario abra Ajustes,
 * y sin esto el panel se abriría en blanco. Es el mismo motivo por el que existe
 * `chat:status`.
 *
 * @type {{tipo:string, version?:string, porcentaje?:number, mensaje?:string}}
 */
let estado = { tipo: 'desconocido' };

function anotar(nuevo) {
  estado = nuevo;
  avisar({ ...nuevo });
}

/**
 * @param {() => import('electron').BrowserWindow | null} getWin
 */
function initUpdater(getWin) {
  if (!autoUpdater) return;
  iniciado = true;

  avisar = (evt) => {
    const win = getWin();
    if (win && !win.isDestroyed()) win.webContents.send('update:event', evt);
  };

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => anotar({ tipo: 'comprobando' }));
  // Con `autoDownload`, que haya una es que ya se está bajando.
  autoUpdater.on('update-available', (info) =>
    anotar({ tipo: 'descargando', version: info && info.version })
  );
  autoUpdater.on('update-not-available', () => anotar({ tipo: 'ninguna' }));
  autoUpdater.on('download-progress', (p) =>
    anotar({ tipo: 'descargando', version: estado.version, porcentaje: Math.round(p.percent) })
  );
  autoUpdater.on('update-downloaded', (info) =>
    anotar({ tipo: 'lista', version: info && info.version })
  );
  autoUpdater.on('error', (err) =>
    anotar({ tipo: 'error', mensaje: String(err && err.message ? err.message : err) })
  );

  // Comprobar al arrancar y notificar. Descarga en segundo plano; instala al salir.
  autoUpdater.checkForUpdatesAndNotify().catch(() => {});
}

/** Qué se sabe ahora mismo. Lo pregunta el panel de Ajustes al abrirse. */
function estadoActualizacion() {
  if (!autoUpdater || !iniciado) {
    // En desarrollo no hay actualizaciones que buscar: la app no viene de un
    // Release. Se dice, en vez de dejar un botón que no haría nada.
    return { tipo: 'no-disponible' };
  }
  return { ...estado };
}

/** Mirar ahora, sin esperar al próximo arranque. */
function buscarActualizacion() {
  if (!autoUpdater || !iniciado) return;
  anotar({ tipo: 'comprobando' });
  // El resultado llega por los eventos de arriba; aquí sólo hay que evitar que
  // un fallo de red tumbe el proceso.
  Promise.resolve(autoUpdater.checkForUpdates()).catch((err) => {
    anotar({ tipo: 'error', mensaje: String(err && err.message ? err.message : err) });
  });
}

/**
 * Aplicarla ahora: cierra el pato y arranca el instalador.
 *
 * Sólo vale con la descarga terminada; si no, no hay nada que instalar y
 * `quitAndInstall` se limitaría a cerrar la app, que es lo peor que podría pasar
 * al pulsar un botón que promete actualizar.
 *
 * @param {() => import('electron').BrowserWindow | null} getWin
 */
function instalarActualizacion(getWin) {
  if (!autoUpdater || !iniciado || estado.tipo !== 'lista') return false;

  // Se le da al pato el mismo aviso que al salir, y un respiro para guardar: su
  // estado se guarda desde el renderer y el mensaje viaja por IPC.
  const win = getWin();
  if (win && !win.isDestroyed()) win.webContents.send('app:before-quit');

  setTimeout(() => {
    try {
      autoUpdater.quitAndInstall();
    } catch (err) {
      anotar({ tipo: 'error', mensaje: String(err && err.message ? err.message : err) });
    }
  }, 250);
  return true;
}

module.exports = {
  initUpdater,
  estadoActualizacion,
  buscarActualizacion,
  instalarActualizacion
};
