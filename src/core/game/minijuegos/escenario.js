// El préstamo del escenario.
//
// Un minijuego "de escenario" no vive en un panel: toma prestado el pato, el
// suelo y la pantalla entera, los pilota un rato y los devuelve como estaban.
//
// Lo delicado no es prestarlos, es DEVOLVERLOS. Si un juego revienta a mitad, el
// pato se quedaría bloqueado para siempre y —en el escritorio— la ventana
// transparente seguiría capturando el ratón: el usuario no podría pulsar nada en
// su propio escritorio, ni siquiera para cerrar el pato. Es el peor fallo que
// puede tener este proyecto, así que la devolución va protegida por cuatro
// capas independientes:
//
//   1. Toda llamada al juego va envuelta: si lanza, se devuelve el escenario.
//   2. `terminar` es idempotente y restaura dentro de un `finally`.
//   3. `alApagar` lo cubre aunque el pato se mude de pestaña sin avisar.
//   4. Un tope de tiempo, por si un juego se cuelga en bucle sin lanzar nada.
//
// Y si todo eso fallara, la ventana sigue reenviando los `mousemove`, así que el
// siguiente movimiento del ratón vuelve a pasar por `updateMouseCapture`.
//
// El préstamo va en dos tiempos a propósito: primero se toma el escenario y se
// prepara la `Pista`, y sólo después se le entrega al juego (que la necesita ya
// hecha para construirse). Así un fallo al crear el juego encuentra el escenario
// tomado y con su devolución puesta, en vez de a medio montar.

import { montar, montarAlFondo } from '../../stage.js';
import * as fisica from '../../pet/fisica.js';
import { crearLienzo, crearMarcador } from './lienzo.js';
import { crearEntrada } from './entrada.js';

/** Red de seguridad, no regla de juego: ninguna partida dura diez minutos. */
const TOPE_PARTIDA_MS = 10 * 60 * 1000;

/** @typedef {'usuario'|'fin'|'apagado'|'error'} MotivoFin */

/**
 * Lo que un juego de escenario recibe en `ctx.escenario`.
 *
 * @typedef {Object} Pista
 * @property {any} pato
 * @property {typeof fisica} fisica
 * @property {import('../../pet/fisica.js').Vuelo} vuelo
 *   El MISMO objeto que usa el pato normal. Se pilota con `fisica.paso` y se
 *   pinta con `fisica.aplicar`; al devolverlo se detiene solo.
 * @property {typeof fisica.AJUSTES} ajustes
 *   Reasignable: `pista.ajustes = pista.fisica.conAjustes({ GRAVEDAD: 1100 })`.
 * @property {() => import('../../pet/fisica.js').Limites} limites
 * @property {{ancho:number, alto:number, suelo:number, patoAncho:number, patoAlto:number}} medidas
 * @property {CanvasRenderingContext2D} pintor
 *   Lienzo a pantalla completa, POR DETRÁS del pato, en píxeles CSS. Se limpia
 *   solo antes de cada `actualizar`.
 * @property {(y:number) => number} aPantalla
 * @property {Object} entrada   ratón y teclado (ver entrada.js)
 * @property {(texto:string) => void} marcador
 * @property {(css:string) => void} cursor
 *   El puntero mientras dure la partida: `'crosshair'`, o una imagen. Se va con
 *   el lienzo, así que no hay que acordarse de deshacerlo.
 * @property {(el:HTMLElement|null) => void} panel
 *   Monta un trozo de interfaz POR ENCIMA del lienzo —con `null` lo quita—, para
 *   lo que no se puede pintar en un canvas: un campo de texto, un botón. Se
 *   desmonta solo al devolver el escenario.
 * @property {(fn:(() => void)|null) => void} alPedirSalir
 *   Se queda con el Esc y con el botón de salir. Sin esto los dos terminan la
 *   partida, que es lo que quiere cualquier juego; con esto el juego decide qué
 *   hacer cuando se los pulsan, y sale llamando a `salir()` él mismo.
 *
 *   **Ojo con esto.** Es la única forma de que un juego se quede sin salida
 *   voluntaria, y en el escritorio eso es una ventana transparente a pantalla
 *   completa capturando el ratón. Lo usa la broma del «No tocar», que a
 *   propósito pone un peaje delante de la puerta. Lo que NO se puede tocar por
 *   aquí son las salidas involuntarias: el tope de diez minutos, el apagado y
 *   el fallo del propio juego siguen terminando la partida pase lo que pase.
 * @property {(si:boolean) => void} esconderMascota
 *   La quita de la vista sin quitarla del sitio. Para los juegos donde la
 *   mascota no es un personaje sino un mando —el agujero—, y verla plantada en
 *   medio de lo que maneja estorba. Se deshace sola al devolver el escenario.
 * @property {(motivo?:MotivoFin) => void} salir
 *   Deja la partida sin resultado. Para terminarla con resultado, el juego usa
 *   `ctx.alTerminar` como cualquier otro.
 */

/**
 * Toma el escenario. Devuelve la pista ya montada y cómo entregársela al juego.
 *
 * @param {Object} entorno
 * @returns {{pista: Pista, ejecutar: (partida:Object) => Object|null, terminar: (m?:MotivoFin)=>void}}
 */
export function prestarEscenario(entorno) {
  const {
    pato, behavior, vuelo, alApagar, toast,
    registrarOverlay, soltarOverlay, alDevolver, nombre
  } = entorno;

  let devuelto = false;
  /** El trozo de interfaz que haya montado el juego, si ha montado alguno. */
  let panelDelJuego = null;
  /** Si el juego se ha quedado con el Esc y el botón de salir. */
  let pedirSalir = null;
  /** @type {{actualizar?:Function, destroy?:Function}|null} */
  let juego = null;
  let idJuego = nombre || 'escenario';

  // ---- Congelar ---------------------------------------------------------
  // El orden importa: primero se le quita al pato cualquier animación pendiente
  // (`refresh` borra el override) y sólo después se bloquea. Al revés, un
  // `playOnce` en curso seguiría mandando sobre el sprite durante la partida.
  behavior.refresh();
  behavior.lock();
  fisica.detenerVuelo(vuelo);
  vuelo.x = pato.x;
  vuelo.y = pato.y;
  pato.setDragTransition(false);
  pato.setTilt(0);

  // ---- Prestar ----------------------------------------------------------
  const { lienzo, pintor, ajustar, medir } = crearLienzo();
  montarAlFondo(lienzo);
  // El lienzo es un overlay más. Con esto, en el escritorio se captura el ratón
  // en TODA la pantalla mientras dure la partida, y al soltarlo se vuelve solo a
  // dejar pasar los clics. No hace falta ningún mecanismo nuevo.
  registrarOverlay(lienzo);

  const marcador = crearMarcador(nombre || 'Partida', () => salidaPedida());
  montar(marcador.el);
  registrarOverlay(marcador.el);

  const entrada = crearEntrada();
  const quitarTeclas = escucharTeclas();
  const quitarResize = escucharResize();
  const relojTope = setTimeout(() => terminar('fin'), TOPE_PARTIDA_MS);
  alApagar(() => terminar('apagado'));

  /** @type {Pista} */
  const pista = {
    pato,
    fisica,
    vuelo,
    ajustes: fisica.AJUSTES,
    limites: () => fisica.limitesDeVentana(pato),
    medidas: medir(pato),
    pintor,
    // La Y del pato crece hacia arriba desde abajo; la del lienzo, hacia abajo
    // desde arriba. Es la única conversión que hace falta: en X, y en
    // coordenadas de ratón, lienzo y pantalla ya coinciden.
    aPantalla: (y) => window.innerHeight - y,
    entrada,
    marcador: (t) => marcador.poner(t),
    cursor: (css) => { lienzo.style.cursor = css || ''; },
    panel: montarPanel,
    alPedirSalir: (fn) => { pedirSalir = typeof fn === 'function' ? fn : null; },
    esconderMascota,
    salir: terminar
  };

  /**
   * Un trozo de interfaz por encima del lienzo.
   *
   * Va por `registrarOverlay` como todo lo demás: con eso el escritorio sabe que
   * ahí hay algo que se puede pulsar. Sólo cabe uno; montar otro quita el
   * anterior, que es lo que hace falta y no obliga a llevar la cuenta.
   */
  function montarPanel(el) {
    if (panelDelJuego) {
      soltarOverlay(panelDelJuego);
      panelDelJuego = null;
    }
    if (!el) return;
    panelDelJuego = el;
    montar(el);
    registrarOverlay(el);
  }

  /**
   * `visibility` y no `display`: el pato sigue midiendo y ocupando su sitio, así
   * que `cuerpo()` y las medidas siguen valiendo mientras está escondido.
   */
  function esconderMascota(si) {
    pato.el.style.visibility = si ? 'hidden' : '';
  }

  return { pista, ejecutar, terminar };

  /**
   * Ata el juego ya creado al escenario. A partir de aquí, app.js llama a
   * `actualizar` en cada fotograma.
   */
  function ejecutar(partida) {
    if (devuelto) return null;
    juego = partida || null;
    return {
      id: idJuego,
      entrada,
      actualizar(dt) {
        if (devuelto || !juego || typeof juego.actualizar !== 'function') return;
        entrada.tic();
        pintor.clearRect(0, 0, pista.medidas.ancho, pista.medidas.alto);
        try {
          juego.actualizar(dt, pista);
        } catch (err) {
          console.error(`[juego:${idJuego}] fallo en actualizar`, err);
          terminar('error');
        }
      },
      terminar
    };
  }

  // ---- Devolución --------------------------------------------------------

  /** Idempotente y a prueba de fallos: el pato SIEMPRE vuelve. */
  function terminar(motivo = 'fin') {
    if (devuelto) return;
    devuelto = true;
    try {
      if (juego && typeof juego.destroy === 'function') juego.destroy(motivo);
    } catch (err) {
      console.warn(`[juego:${idJuego}] fallo al destruir`, err);
    } finally {
      clearTimeout(relojTope);
      // Antes que nada de lo demás: un juego que la escondió y reventó no puede
      // dejar al usuario sin mascota.
      esconderMascota(false);
      quitarTeclas();
      quitarResize();
      soltarOverlay(lienzo);      // lo saca del DOM y recalcula la captura
      soltarOverlay(marcador.el);
      if (panelDelJuego) { soltarOverlay(panelDelJuego); panelDelJuego = null; }
      alDevolver(motivo);         // app.js suelta el pato y guarda
      if (motivo === 'error') toast('El juego se ha estropeado. Aquí tienes tu mascota.');
    }
  }

  /**
   * Alguien quiere irse: Esc o el botón.
   *
   * Normalmente eso termina la partida. Si el juego se ha quedado con la salida
   * —`alPedirSalir`—, le toca a él decidir; y si al llamarle revienta, se sale
   * igualmente, que es lo único que no se puede negociar.
   */
  function salidaPedida() {
    if (!pedirSalir) { terminar('usuario'); return; }
    try {
      pedirSalir();
    } catch (err) {
      console.error(`[juego:${idJuego}] fallo al pedir salir`, err);
      terminar('error');
    }
  }

  function escucharTeclas() {
    // Sólo mientras dura la partida, y sólo Esc se consume: sobre una página
    // ajena, tragarse las teclas sería robarle al usuario lo que está
    // escribiendo. Va en `document` —y no en un elemento— porque el escenario no
    // tiene foco propio. Es la excepción que confirma la regla del contrato, y
    // por eso vive aquí, una sola vez, y no en cada juego.
    const alPulsar = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); salidaPedida(); return; }
      // El espacio también se consume, y no sólo se apunta: sin esto desplaza la
      // página de debajo mientras juegas. Va aquí, una vez, porque le hace falta
      // a todo el que salte o dispare con él, y porque el contrato prohíbe a los
      // juegos escuchar en `document`.
      if (e.key === ' ' || e.code === 'Space') e.preventDefault();
      entrada.tecla(e, true);
    };
    const alSoltar = (e) => entrada.tecla(e, false);
    document.addEventListener('keydown', alPulsar);
    document.addEventListener('keyup', alSoltar);
    return () => {
      document.removeEventListener('keydown', alPulsar);
      document.removeEventListener('keyup', alSoltar);
      entrada.limpiar();
    };
  }

  function escucharResize() {
    const alCambiar = () => { ajustar(); pista.medidas = medir(pato); };
    window.addEventListener('resize', alCambiar);
    return () => window.removeEventListener('resize', alCambiar);
  }
}
