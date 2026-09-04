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

/**
 * Segundos de presentación antes de empezar.
 *
 * Un juego de pantalla completa arranca de golpe y sin panel donde leer nada, y
 * el que lo abre por primera vez no sabe ni qué se espera de él. Así que antes
 * de la primera jugada se enseñan el nombre, la misma línea que sale al pasar
 * por encima del botón, y una cuenta atrás.
 *
 * Durante la cuenta el juego NO corre: no se le llama a `actualizar` ni con
 * `dt` a cero. Con cero tampoco es inofensivo —«Pato Hook» dispararía al soltar
 * el ratón y la paleta podría dar un toque— así que sencillamente se espera.
 */
const PRESENTACION_S = 5;

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
    registrarOverlay, soltarOverlay, alDevolver, nombre, descripcion
  } = entorno;

  let devuelto = false;
  /**
   * Lo que queda de presentación, en segundos.
   *
   * Sin descripción no hay presentación, y eso es a propósito: lo que no viene
   * del catálogo —la broma del «No tocar»— ya trae su propio cartel, y meterle
   * una cuenta atrás delante le quitaría toda la gracia.
   */
  let presentacion = descripcion ? PRESENTACION_S : 0;
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

        if (presentacion > 0) {
          presentacion -= dt;
          dibujarPresentacion();
          return;
        }

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

  /**
   * El cartel de antes de empezar: nombre, de qué va, y la cuenta atrás.
   *
   * Se pinta en el lienzo y no con DOM porque es efímero y no se pulsa. El
   * número crece un poco al cambiar de segundo, que es lo que hace que se lea
   * como una cuenta y no como un adorno.
   */
  function dibujarPresentacion() {
    const { ancho, alto } = pista.medidas;
    const cx = ancho / 2;
    const cy = alto * 0.34;
    const quedan = Math.max(1, Math.ceil(presentacion));
    // De 0 a 1 dentro del segundo actual: 1 justo al cambiar.
    const reciente = 1 - (Math.ceil(presentacion) - presentacion);

    pintor.save();
    pintor.textAlign = 'center';

    // Una tarjeta detrás: esto se pinta sobre el escritorio de cualquiera, y
    // sin fondo el texto es ilegible la mitad de las veces.
    const w = Math.min(560, ancho * 0.8);
    const h = 190;
    pintor.beginPath();
    if (pintor.roundRect) pintor.roundRect(cx - w / 2, cy - 64, w, h, 16);
    else pintor.rect(cx - w / 2, cy - 64, w, h);
    pintor.fillStyle = 'rgba(255, 253, 247, 0.94)';
    pintor.fill();
    pintor.lineWidth = 3;
    pintor.strokeStyle = '#2b2b3a';
    pintor.stroke();

    pintor.fillStyle = '#2b2b3a';
    pintor.font = '700 30px system-ui, sans-serif';
    pintor.fillText(nombre || 'Partida', cx, cy - 22);

    pintor.font = '400 16px system-ui, sans-serif';
    recortarEnLineas(descripcion, w - 48, 22, cx, cy + 6);

    pintor.font = `700 ${Math.round(40 + reciente * 10)}px system-ui, sans-serif`;
    pintor.fillStyle = '#fb8500';
    pintor.fillText(String(quedan), cx, cy + 100);
    pintor.restore();
  }

  /** Parte el texto en líneas que quepan. Dos como mucho: es una frase. */
  function recortarEnLineas(texto, ancho, alto, cx, cy) {
    const palabras = String(texto).split(' ');
    const lineas = [];
    let linea = '';
    for (const p of palabras) {
      const prueba = linea ? `${linea} ${p}` : p;
      if (pintor.measureText(prueba).width > ancho && linea) {
        lineas.push(linea);
        linea = p;
      } else {
        linea = prueba;
      }
    }
    if (linea) lineas.push(linea);
    const y0 = cy - ((lineas.length - 1) * alto) / 2;
    lineas.forEach((l, i) => pintor.fillText(l, cx, y0 + i * alto));
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
