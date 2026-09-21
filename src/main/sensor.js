'use strict';

// El timbre del pato: una ventana diminuta que sí recibe el ratón.
//
// ---- Por qué existe -------------------------------------------------------
//
// El overlay cubre la pantalla entera y deja pasar los clics. Para saber cuándo
// el cursor llega al pato, en Windows basta con la propia ventana (sigue
// entregando el movimiento aunque los clics la atraviesen) y en Linux se optó
// por preguntarle al sistema dónde está el cursor, 20 veces por segundo.
//
// Eso segundo no funciona en Ubuntu, y no por un descuido: bajo **XWayland**,
// `getCursorScreenPoint` sólo devuelve la posición de verdad mientras el cursor
// está sobre una superficie X11. Una ventana que deja pasar los clics no lo es a
// efectos del compositor —el puntero está sobre lo que haya debajo, que en GNOME
// suele ser Wayland puro—, así que lo que se lee es la última posición conocida,
// congelada. El pato se ve, camina y saluda, pero no se entera nunca de que hay
// alguien encima: ni clic, ni arrastre.
//
// ---- Qué hace esto --------------------------------------------------------
//
// Poner, justo encima del pato, una ventana del tamaño del pato que NO deja
// pasar los clics. Entonces el cursor sí está sobre una superficie nuestra y el
// sistema nos entrega el ratón sin que haya que preguntar nada: ni sondeo, ni
// XQueryPointer, ni suposiciones. Lo que llega se reenvía al overlay como un
// evento de ratón normal y corriente, y a partir de ahí manda el pato de
// siempre, con su hit-test al píxel.
//
// Es transparente, no sale en la barra de tareas y no coge el foco: no se ve ni
// se nota. Se mueve con el pato (ocho veces por segundo, que es lo que tarda el
// pato en decir dónde está) y se quita de en medio en cuanto el overlay tiene el
// ratón, para no robarle los eventos a quien de verdad los necesita.
//
// ---- Y el arrastre --------------------------------------------------------
//
// Al pulsar, X11 le entrega TODO al que recibió la pulsación hasta que se
// suelte, aunque el cursor se vaya a la otra punta de la pantalla. O sea: un
// arrastre que empieza en el timbre, termina en el timbre. Por eso aquí no se
// filtra nada mientras hay un botón pulsado y se sigue reenviando hasta el
// `mouseup`, en vez de dar por hecho que el overlay recoge el testigo.

const { BrowserWindow } = require('electron');
const path = require('path');

/**
 * @param {object} opciones
 * @param {(evento: {tipo:string, x:number, y:number, botones:number, boton:number}) => void} opciones.alPuntero
 *   Lo que el timbre oye, ya en coordenadas del overlay.
 * @param {boolean} [opciones.prueba]  Que el timbre se toque solo una vez.
 */
function crearSensor({ alPuntero, prueba }) {
  /** @type {BrowserWindow | null} */
  let win = null;
  let armado = false;
  /** Dónde debería estar, en coordenadas de pantalla. */
  let sitio = null;
  /** Si hay un botón pulsado: mientras dure, el timbre no se mueve ni se calla. */
  let pulsado = false;
  let listo = false;
  // Lo que la ventana tiene puesto de verdad. El guardia sincroniza veinte
  // veces por segundo y casi siempre no ha cambiado nada: recolocar y reapilar
  // una ventana a ese ritmo es trabajo del compositor para nada, y en X11 se
  // nota.
  let puesto = { x: null, y: null, width: null, height: null };
  let puestoArmado = null;

  function nacer() {
    if (win && !win.isDestroyed()) return win;
    win = new BrowserWindow({
      width: 1,
      height: 1,
      x: -10000,          // fuera de la vista hasta que se sepa dónde va
      y: -10000,
      show: false,
      transparent: true,
      backgroundColor: '#00000000',
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: false,   // el foco del teclado no es suyo, y robarlo se nota
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      hasShadow: false,
      acceptFirstMouse: true,
      webPreferences: {
        preload: path.join(__dirname, 'sensor-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        // Una ventana escondida deja de pintar y de atender: aquí no se pinta
        // nada, pero los eventos tienen que llegar siempre.
        backgroundThrottling: false
      }
    });
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.loadFile(path.join(__dirname, '..', 'desktop', 'sensor.html'),
      prueba ? { query: { prueba: '1' } } : undefined);
    win.once('ready-to-show', () => { listo = true; if (armado && sitio) aplicar(); });
    win.on('closed', () => { win = null; listo = false; });
    return win;
  }

  function aplicar() {
    if (!win || win.isDestroyed() || !sitio) return;
    const movido = sitio.x !== puesto.x || sitio.y !== puesto.y
      || sitio.width !== puesto.width || sitio.height !== puesto.height;
    if (movido) {
      win.setBounds(sitio);
      puesto = { ...sitio };
    }
    if (puestoArmado === armado) return;
    puestoArmado = armado;
    if (armado) {
      if (!win.isVisible()) win.showInactive();   // sin robar el foco
      win.setIgnoreMouseEvents(false);
      win.moveTop();                              // por encima del overlay
    } else {
      // No se esconde: una ventana escondida no recibe nada y volver a
      // enseñarla parpadea. Se queda donde está, transparente y sorda.
      win.setIgnoreMouseEvents(true, { forward: false });
    }
  }

  return {
    /**
     * Dónde está el pato, en coordenadas de pantalla.
     * @param {{x:number, y:number, width:number, height:number} | null} caja
     */
    colocar(caja) {
      if (!caja || caja.width < 1 || caja.height < 1) return;
      // Durante un arrastre el pato va pegado al cursor: mover el timbre detrás
      // de él no sirve de nada (los eventos ya son suyos hasta que se suelte) y
      // sí puede despistar al sistema en mitad de la pulsación.
      if (pulsado) return;
      sitio = {
        x: Math.round(caja.x),
        y: Math.round(caja.y),
        width: Math.max(1, Math.round(caja.width)),
        height: Math.max(1, Math.round(caja.height))
      };
      nacer();
      if (listo) aplicar();
    },

    armar() {
      if (armado) return;
      armado = true;
      // Al volver a armarlo puede haberse quedado apilado por debajo del
      // overlay (una mudanza de monitor lo levanta), así que se vuelve a subir.
      puestoArmado = null;
      nacer();
      if (listo) aplicar();
    },

    desarmar() {
      // Soltar el timbre a mitad de un arrastre sería soltar el arrastre: lo que
      // queda de gesto sigue siendo suyo, lo quiera o no (ver la cabecera).
      if (!armado || pulsado) return;
      armado = false;
      if (listo) aplicar();
    },

    /** Lo que ha oído el timbre, en coordenadas de su propia ventana. */
    oir(evento) {
      if (!win || win.isDestroyed() || !sitio) return;
      if (evento.tipo === 'mousedown') pulsado = true;
      if (evento.tipo === 'mouseup') pulsado = false;
      // A coordenadas de pantalla; el overlay las convertirá a las suyas.
      alPuntero({
        ...evento,
        x: sitio.x + evento.x,
        y: sitio.y + evento.y
      });
      // Un desarme pedido a mitad del gesto se quedó sin hacer (ver `desarmar`).
      if (evento.tipo === 'mouseup') aplicar();
    },

    estado() {
      return {
        existe: !!(win && !win.isDestroyed()),
        armado,
        pulsado,
        sitio
      };
    },

    cerrar() {
      pulsado = false;
      armado = false;
      sitio = null;
      if (win && !win.isDestroyed()) win.destroy();
      win = null;
      listo = false;
    }
  };
}

module.exports = { crearSensor };
