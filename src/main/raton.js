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
// no llega ni un solo evento mientras los clics la atraviesan. Hay dos formas de
// suplirlo, y aquí están las dos, porque ninguna vale en todas partes:
//
//   1. **Preguntar dónde está el cursor** (`getCursorScreenPoint`, 20 veces por
//      segundo). Es lo barato, y funciona en una sesión X11 de verdad. Bajo
//      XWayland —lo que trae Ubuntu— NO: ahí esa llamada sólo sabe la verdad
//      mientras el cursor está sobre una superficie X11, y una ventana que deja
//      pasar los clics no lo es. Devuelve la última posición conocida,
//      congelada, y el pato no se entera nunca de que hay alguien encima.
//   2. **Poner un timbre**: una ventana diminuta encima del pato que no deja
//      pasar los clics, y a la que por tanto el sistema sí le entrega el ratón.
//      Ver `sensor.js`. No hay que preguntar nada: llega solo.
//
// Lo segundo es lo que funciona en Ubuntu; lo primero se queda porque donde
// funciona no estorba y es un camino menos. Cualquiera de los dos abre la
// puerta; a partir de ahí manda el renderer, con su hit-test al píxel.
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
 * @param {ReturnType<typeof import('./sensor').crearSensor> | null} [opciones.sensor]
 * @param {boolean} [opciones.siempre]  Modo de prueba: no soltar nunca el ratón.
 * @param {boolean} [opciones.diagnostico]  Contarlo todo por la terminal.
 */
function crearGuardiaDelRaton({ getWin, getGround, sondear, sensor, siempre, diagnostico }) {
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

  const contar = (...partes) => { if (diagnostico) console.log('[raton]', ...partes); };

  function aplicar(ignorar) {
    const win = getWin();
    if (!win || win.isDestroyed()) return;
    // Modo de prueba: la ventana se queda con el ratón pase lo que pase. Sirve
    // para separar "no se abre la puerta" de "la ventana no recibe nada".
    if (siempre) ignorar = false;
    if (ignorando !== ignorar) {
      ignorando = ignorar;
      contar(ignorar ? 'los clics pasan de largo' : 'la ventana se queda el ratón');
      // `forward` es lo que hace falta en Windows y lo que Linux ignora sin
      // quejarse, así que se pasa en los dos sitios: aquí no cambia nada.
      if (ignorar) win.setIgnoreMouseEvents(true, { forward: true });
      else win.setIgnoreMouseEvents(false);
    }
    sincronizarSensor();
  }

  /** La caja del pato en coordenadas de pantalla, o `null` si no se sabe. */
  function cajaEnPantalla() {
    const win = getWin();
    if (!win || win.isDestroyed() || !zona) return null;
    const b = win.getBounds();
    const suelo = getGround();
    // La franja de la barra de tareas no es de nadie: el timbre tampoco entra.
    const tope = b.height - Math.max(0, suelo);
    const top = Math.max(0, zona.top);
    const bottom = Math.min(tope, zona.bottom);
    if (bottom <= top) return null;
    const left = Math.max(0, zona.left);
    const right = Math.min(b.width, zona.right);
    if (right <= left) return null;
    return { x: b.x + left, y: b.y + top, width: right - left, height: bottom - top };
  }

  /**
   * El timbre está puesto mientras los clics pasen de largo, que es justo
   * cuando el pato no puede enterarse de nada por su cuenta. En cuanto el
   * overlay tiene el ratón, el timbre se quita de en medio para no robarle los
   * eventos a quien de verdad los necesita.
   */
  function sincronizarSensor() {
    if (!sensor) return;
    const win = getWin();
    const visible = !!(win && !win.isDestroyed() && win.isVisible());
    const fresca = zona && Date.now() - zonaDesde <= CADUCIDAD_MS;
    if (ignorando && visible && fresca) {
      const caja = cajaEnPantalla();
      if (caja) {
        sensor.colocar(caja);
        sensor.armar();
        return;
      }
    }
    sensor.desarmar();
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
      if (!caja) { zona = null; sincronizarSensor(); return; }
      if (!zona) {
        // En voz alta, y una sola vez. Este arreglo se escribió sin una Ubuntu
        // delante: quien lo pruebe tiene que poder decir si llegó a encenderse
        // sin abrir un depurador.
        console.log('[raton] el pato ya dice dónde está: sondeo del cursor en marcha'
          + (sensor ? ' (y timbre puesto)' : ''));
      }
      zona = caja;
      zonaDesde = Date.now();
      arrancarSondeo();
      sincronizarSensor();
    },

    /** Lo que se sabe ahora mismo, para `--diagnostico`. */
    estado() {
      const win = getWin();
      let cursor = null;
      try { cursor = screen.getCursorScreenPoint(); } catch { cursor = 'no se puede preguntar'; }
      return {
        ignorando,
        loPideElPato,
        zona,
        edadDeLaZona: zona ? Date.now() - zonaDesde : null,
        cursor,
        ventana: win && !win.isDestroyed() ? win.getBounds() : null,
        visible: !!(win && !win.isDestroyed() && win.isVisible()),
        suelo: getGround(),
        enLaCaja: elCursorLlamaALaPuerta(),
        sensor: sensor ? sensor.estado() : null
      };
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
      if (sensor) sensor.desarmar();
    }
  };
}

module.exports = { crearGuardiaDelRaton, SONDEO_MS, CADUCIDAD_MS };
