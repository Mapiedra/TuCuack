'use strict';

// Lo que cambia de un sistema a otro, en un solo sitio.
//
// El pato es de Windows desde el primer día y ahí no se toca nada. Linux entra
// por la puerta de al lado: el núcleo ya es de todos (ver `src/core/`), y lo
// que no viaja es esto —tres o cuatro cosas del proceso principal que Electron
// no resuelve igual en los dos sitios—. Están aquí juntas para que se vean de
// un vistazo y para que el día que llegue un tercer sistema se sepa qué hay
// que contestar.

const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * `--zonas`: hacer aquí lo que se haría en Linux.
 *
 * El sondeo del cursor sólo se enciende donde la ventana no reenvía el ratón,
 * y eso deja el camino entero —el pato publicando su caja, el puente, el
 * guardia— sin poder probarse desde Windows. Con este interruptor se enciende
 * igual, y se ve funcionar en la máquina que uno tenga delante.
 */
const fingirQueNoReenvia = process.argv.includes('--zonas');

const esWindows = process.platform === 'win32';
const esMac = process.platform === 'darwin';
const esLinux = process.platform === 'linux';

/**
 * ¿Sabe la ventana reenviar el movimiento del ratón mientras los clics la
 * atraviesan?
 *
 * `setIgnoreMouseEvents(true, { forward: true })` es de Windows y macOS. Donde
 * no está, el renderer deja de recibir `mousemove` en cuanto el overlay se
 * vuelve transparente al ratón: nunca se entera de que el cursor ha llegado al
 * pato, nunca pide capturarlo y el pato se queda en un dibujo al que no se
 * puede ni acercar uno. Quien lo suple es `raton.js`.
 */
const reenviaElRaton = (esWindows || esMac) && !fingirQueNoReenvia;

// ---- Arranque con el sistema --------------------------------------------
//
// `app.setLoginItemSettings` es de Windows y macOS. En Linux el arranque de
// sesión es un fichero .desktop en ~/.config/autostart, que es lo que miran
// GNOME, KDE y compañía. Se escribe y se borra a mano.

const NOMBRE_ENTRADA = 'tucuack.desktop';

function carpetaDeAutoarranque() {
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(base, 'autostart');
}

/**
 * Con qué línea se arranca el pato.
 *
 * Dentro de un AppImage, `process.execPath` apunta al binario desempaquetado en
 * un directorio temporal que no existirá en el siguiente arranque: hay que
 * apuntar al .AppImage, que es lo que el propio formato deja en `APPIMAGE`.
 */
function ordenDeArranque() {
  const exe = process.env.APPIMAGE || process.execPath;
  return /[\s"']/.test(exe) ? `"${exe}"` : exe;
}

function escribirEntradaDeSesion() {
  const dir = carpetaDeAutoarranque();
  fs.mkdirSync(dir, { recursive: true });
  const entrada = [
    '[Desktop Entry]',
    'Type=Application',
    'Name=TuCuack',
    'Comment=La mascota de escritorio',
    `Exec=${ordenDeArranque()}`,
    'Icon=tucuack',
    'Terminal=false',
    'X-GNOME-Autostart-enabled=true',
    ''
  ].join('\n');
  fs.writeFileSync(path.join(dir, NOMBRE_ENTRADA), entrada, 'utf8');
}

function borrarEntradaDeSesion() {
  try {
    fs.unlinkSync(path.join(carpetaDeAutoarranque(), NOMBRE_ENTRADA));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

/**
 * Arrancar (o no) con la sesión.
 *
 * Nunca revienta: el ajuste es una comodidad y no merece tumbar el arranque del
 * pato si el home es de sólo lectura o la carpeta no se deja escribir.
 *
 * @param {import('electron').App} app
 * @param {boolean} activar
 */
function aplicarArranqueAutomatico(app, activar) {
  try {
    if (!esLinux) {
      app.setLoginItemSettings({ openAtLogin: !!activar });
      return;
    }
    if (activar) escribirEntradaDeSesion();
    else borrarEntradaDeSesion();
  } catch (err) {
    console.warn('[sistema] no se pudo cambiar el arranque automático:', err.message);
  }
}

/**
 * Lo que hay que decirle a Electron antes de que arranque.
 *
 * En Wayland no hay «siempre encima», no se puede colocar una ventana donde uno
 * quiera y no se puede preguntar dónde está el cursor: los tres cimientos del
 * overlay. Bajo XWayland —que es lo que Ubuntu trae y lo que Electron elige por
 * su cuenta— sí están las tres, así que se pide X11 en voz alta en vez de
 * confiar en que el valor por defecto no cambie.
 *
 * Se respeta que alguien lo pida a mano (`--ozone-platform=wayland`): si quiere
 * ver cómo se porta, que lo vea; el pato no se lo va a impedir.
 *
 * @param {import('electron').App} app
 */
function prepararLinea(app) {
  if (!esLinux) return;
  const aMano = process.argv.some((a) => a.startsWith('--ozone-platform'));
  if (!aMano) app.commandLine.appendSwitch('ozone-platform', 'x11');
}

module.exports = {
  esWindows,
  esMac,
  esLinux,
  reenviaElRaton,
  aplicarArranqueAutomatico,
  prepararLinea
};
