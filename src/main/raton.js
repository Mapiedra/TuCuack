'use strict';

// El ratón que no vuelve: cómo se acerca uno al pato donde la ventana no sabe
// reenviar el movimiento del cursor.
//
// El overlay cubre el monitor entero y deja pasar los clics; sólo los captura
// mientras el cursor está sobre el pato o sobre un panel. En Windows eso lo
// resuelve la propia ventana: `setIgnoreMouseEvents(true, { forward: true })`
// sigue entregando `mousemove` al renderer aunque los clics vayan de largo, así
// que el pato ve venir al cursor y pide el ratón a tiempo.
//
// `forward` es de Windows y macOS. Sin él —en Linux— la ventana se queda muda:
// no llega ni un solo evento mientras los clics la atraviesan, el pato no se
// entera nunca de que hay alguien encima y jamás pide capturar el ratón. Sería
// un pato de mirar.
//
// Así que lo que la ventana no cuenta se pregunta: el proceso principal sondea
// dónde está el cursor —lo mismo que ya hace para mudar al pato de monitor— y
// captura el ratón en cuanto entra en la caja del pato, que el renderer publica
// (ver `zonas:pato`). A partir de ahí el renderer recibe eventos de verdad y
// manda él, con su hit-test al píxel: esto sólo le abre la puerta.
//
// Dos cosas que este guardia NO hace, a propósito:
//
//   - No suelta nunca el ratón por su cuenta si el pato lo ha pedido. Un panel
//     abierto o una partida mandan por encima de dónde esté el cursor.
//   - No fuerza la captura sobre la barra de tareas. Ahí abajo está el icono de
//     la bandeja, que es la única forma de recuperar un pato escondido, y una
//     ventana transparente por encima lo dejaría sin pulsar (el mismo motivo
//     que `enLaBarraDeTareas` en el núcleo).

const { screen } = require('electron');

/** Cada cuánto se mira dónde está el cursor. */
const SONDEO_MS = 50;

/**
 * Cuánto se da por buena la caja publicada por el renderer.
 *
 * Si el pato deja de publicar —se ha escondido, se ha apagado, se ha quedado a
 * medias— lo que vale es dejar pasar los clics: un escritorio que no responde
 * es mucho peor que un pato al que hay que volver a acercarse.
 */
const CADUCIDAD_MS = 3000;

/**
 * @param {object} opciones
 * @param {() => import('electron').BrowserWindow | null} opciones.getWin
 * @param {() => number} opciones.getGround  Alto de la barra de tareas, en px.
 * @param {boolean} opciones.sondear  `false` donde la ventana reenvía el ratón.
 */
function crearGuardiaDelRaton({ getWin, getGround, sondear }) {
  // Lo último que pidió el pato. Manda siempre que pida capturar.
  let loPideElPato = false;
  // Caja del pato en coordenadas de la ventana, tal como la publica el
  // renderer, y cuándo llegó.
  let zona = null;
  let zonaDesde = 0;
  // Lo que la ventana tiene puesto ahora mismo, para no repetírselo 20 veces
  // por segundo.
  let ignorando = null;
  let temporizador = null;

  function aplicar(ignorar) {
    const win = getWin();
    if (!win || win.isDestroyed()) return;
    if (ignorando === ignorar) return;
    ignorando = ignorar;
    // `forward` es lo que hace falta en Windows y lo que Linux ignora sin
    // quejarse, así que se pasa en los dos sitios: aquí no cambia nada.
    if (ignorar) win.setIgnoreMouseEvents(true, { forward: true });
    else win.setIgnoreMouseEvents(false);
  }

  /** ¿Está el cursor dentro de la caja del pato, y fuera de la barra? */
  function elCursorLlamaALaPuerta() {
    if (!zona || Date.now() - zonaDesde > CADUCIDAD_MS) return false;
    const win = getWin();
    if (!win || win.isDestroyed() || !win.isVisible()) return false;

    const cursor = screen.getCursorScreenPoint();
    const b = win.getBounds();
    const x = cursor.x - b.x;
    const y = cursor.y - b.y;
    if (x < 0 || y < 0 || x > b.width || y > b.height) return false;

    // La franja de la barra de tareas se deja libre pase lo que pase.
    const suelo = getGround();
    if (suelo > 0 && y >= b.height - suelo) return false;

    return x >= zona.left && x <= zona.right && y >= zona.top && y <= zona.bottom;
  }

  function revisar() {
    aplicar(!(loPideElPato || elCursorLlamaALaPuerta()));
  }

  function arrancarSondeo() {
    if (!sondear || temporizador) return;
    temporizador = setInterval(revisar, SONDEO_MS);
  }

  return {
    /** El renderer ha decidido si hace falta el ratón. */
    pedirCaptura(capturar) {
      loPideElPato = !!capturar;
      if (!sondear) return aplicar(!loPideElPato);
      // Soltarlo mientras el cursor sigue sobre el pato sería soltarlo para
      // volver a cogerlo 50 ms después, y entre medias se pierde un clic. El
      // sondeo decide.
      revisar();
    },

    /**
     * Dónde está el pato ahora mismo, en coordenadas de la ventana.
     * @param {{left:number, top:number, right:number, bottom:number} | null} caja
     */
    anotarZona(caja) {
      if (!sondear) return;
      if (!caja) { zona = null; return; }
      if (!zona) {
        // En voz alta, y una sola vez. Este arreglo se escribió sin una Ubuntu
        // delante: quien lo pruebe tiene que poder decir si llegó a encenderse
        // sin abrir un depurador.
        console.log('[raton] el pato ya dice dónde está: sondeo del cursor en marcha');
      }
      zona = caja;
      zonaDesde = Date.now();
      arrancarSondeo();
    },

    /**
     * Ni sondeo ni recuerdos: la ventana de antes ya no vale.
     *
     * Se llama al cerrarla y al abrir una nueva. Lo segundo importa tanto como
     * lo primero: lo que este guardia recuerda es el estado de UNA ventana, y
     * dar por puesto en la nueva lo que se puso en la vieja la dejaría
     * capturando el escritorio entero sin que nadie lo haya pedido.
     */
    reiniciar() {
      if (temporizador) clearInterval(temporizador);
      temporizador = null;
      zona = null;
      ignorando = null;
    }
  };
}

module.exports = { crearGuardiaDelRaton, SONDEO_MS, CADUCIDAD_MS };
