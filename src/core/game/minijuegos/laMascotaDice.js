// «{mascota} dice»: el Simón de toda la vida.
//
// La mascota canta una serie de colores y tú la repites. Si aciertas, la serie
// crece en uno y vuelve a empezar. No se gana: se aguanta.
//
// Es el juego más pequeño del catálogo y el que estrena `sonido.nota()` como
// instrumento. Cada botón tiene SIEMPRE la misma nota —esa es la mitad del
// juego: se acaba recordando la melodía antes que los colores.

import { sembrar } from './azar.js';

/**
 * Los cuatro, con su nota. Sol, do, mi, sol: un acorde de do mayor, así que
 * cualquier serie suena a algo en vez de a alarma.
 */
const BOTONES = [
  { clase: 'verde', hz: 392 },
  { clase: 'rojo', hz: 523 },
  { clase: 'amarillo', hz: 659 },
  { clase: 'azul', hz: 784 }
];

// Lo que dura cada paso al cantarlo. Se acorta con la ronda, pero con suelo: por
// debajo de ahí no es que sea difícil, es que no se distingue una nota de otra.
const PASO_MS = 640;
const PASO_RESTA = 26;
const PASO_MIN = 300;

// Lo que se espera entre que acaba de cantar y te toca, y entre que aciertas la
// serie y canta la siguiente. Sin esa respiración, el turno cambia sin avisar.
const RESPIRO_MS = 520;

// Lo que se espera a cada pulsación tuya. Un Simón sin reloj es un Simón que se
// puede resolver apuntando la serie en un papel.
const TU_PLAZO_MS = 5000;

/**
 * @param {import('./index.js').ContextoPartida} ctx
 * @returns {import('./index.js').Partida}
 */
export function crearPartida(ctx) {
  const azar = sembrar(ctx.semilla);
  const mejorPrevio = ctx.marcas && typeof ctx.marcas.mejor === 'number' ? ctx.marcas.mejor : null;

  /** @type {number[]} */
  const serie = [];
  let ronda = 0;
  let esperado = 0;
  let cantando = false;
  let terminada = false;

  /** Relojes de una sola vez: se paran solos, pero hay que poder cortarlos. */
  let pararCanto = null;
  let pararPlazo = null;

  const el = document.createElement('div');
  el.className = 'jmd';

  const marcador = document.createElement('p');
  marcador.className = 'jppt-marcador';
  el.appendChild(marcador);

  const aviso = document.createElement('p');
  aviso.className = 'jt-aviso';
  el.appendChild(aviso);

  const rejilla = document.createElement('div');
  rejilla.className = 'jmd-botones';
  el.appendChild(rejilla);

  /** @type {HTMLButtonElement[]} */
  const botones = BOTONES.map((b, i) => {
    const el2 = document.createElement('button');
    el2.className = `jmd-boton ${b.clase}`;
    el2.type = 'button';
    el2.addEventListener('click', () => pulsar(i));
    rejilla.appendChild(el2);
    return el2;
  });

  siguienteRonda();

  return {
    el,
    destroy() {
      terminada = true;
      if (pararCanto) { pararCanto(); pararCanto = null; }
      if (pararPlazo) { pararPlazo(); pararPlazo = null; }
    }
  };

  // ---- La serie ----------------------------------------------------------

  function siguienteRonda() {
    if (terminada) return;
    ronda++;
    serie.push(Math.floor(azar() * BOTONES.length));
    esperado = 0;
    pintar();
    esperar(RESPIRO_MS, cantar);
  }

  /**
   * Canta la serie entera.
   *
   * Va con UN solo reloj a medio paso que alterna encender y apagar, en vez de
   * un temporizador por nota: con una serie de veinte habría veinte relojes
   * sueltos, y al cerrar el panel a mitad seguirían sonando.
   */
  function cantar() {
    if (terminada) return;
    cantando = true;
    ctx.pato.animar('play', 1.2);
    pintar();

    let i = 0;
    let encendido = false;
    const medio = Math.max(PASO_MIN, PASO_MS - (ronda - 1) * PASO_RESTA) / 2;

    pararCanto = ctx.cadaCierto(() => {
      if (terminada) { cortarCanto(); return; }
      if (encendido) {
        apagarTodos();
        encendido = false;
        i++;
        return;
      }
      if (i >= serie.length) {
        cortarCanto();
        cantando = false;
        pintar();
        armarPlazo();
        return;
      }
      encender(serie[i]);
      encendido = true;
    }, medio);
  }

  function cortarCanto() {
    if (pararCanto) { pararCanto(); pararCanto = null; }
    apagarTodos();
  }

  function encender(i) {
    botones[i].classList.add('sonando');
    ctx.sonido.nota(BOTONES[i].hz, 0.22);
  }

  function apagarTodos() {
    for (const b of botones) b.classList.remove('sonando');
  }

  // ---- Tu turno ----------------------------------------------------------

  function pulsar(i) {
    if (terminada || cantando) return;
    // Se enciende siempre, aunque sea el fallo: hay que ver qué se ha pulsado.
    encender(i);
    esperar(180, apagarTodos);

    if (i !== serie[esperado]) { fallar(); return; }

    esperado++;
    if (esperado < serie.length) { armarPlazo(); return; }

    // Serie completa. La mascota se alegra y canta una más.
    //
    // Se pasa de ronda al momento, sin esperar: el respiro lo pone
    // `siguienteRonda` antes de cantar, y encadenar los dos dejaba un segundo
    // largo de pantalla muerta entre una ronda y otra. Así el contador sube en
    // cuanto aciertas, que es cuando quiere verse.
    if (pararPlazo) { pararPlazo(); pararPlazo = null; }
    ctx.pato.animar('happy', 1.1);
    siguienteRonda();
  }

  /** El plazo para la siguiente pulsación. Se rearma con cada acierto. */
  function armarPlazo() {
    if (pararPlazo) { pararPlazo(); pararPlazo = null; }
    pararPlazo = ctx.cadaCierto(() => {
      if (pararPlazo) { pararPlazo(); pararPlazo = null; }
      if (terminada || cantando) return;
      fallar(true);
    }, TU_PLAZO_MS);
  }

  // ---- Final -------------------------------------------------------------

  function fallar(porTiempo) {
    if (terminada) return;
    terminada = true;
    cortarCanto();
    if (pararPlazo) { pararPlazo(); pararPlazo = null; }

    // Las rondas que se aguantaron son las anteriores a ésta: la que se estaba
    // repitiendo cuando se falló no cuenta.
    const aguantadas = ronda - 1;
    const esRecord = aguantadas > 0 && (mejorPrevio === null || aguantadas > mejorPrevio);

    ctx.pato.animar('sad', 1.4);
    ctx.sonido[esRecord ? 'victoria' : 'derrota']();
    pintar();
    ctx.alTerminar({
      resultado: esRecord ? 'victoria' : 'derrota',
      puntos: aguantadas,
      detalle: detalleFinal(aguantadas, esRecord, porTiempo)
    });
  }

  function detalleFinal(aguantadas, esRecord, porTiempo) {
    if (aguantadas === 0) {
      return porTiempo ? 'Se acabó el tiempo en la primera.' : 'Falló la primera.';
    }
    const cuenta = aguantadas === 1 ? '1 ronda' : `${aguantadas} rondas`;
    const como = porTiempo ? ' Se acabó el tiempo.' : '';
    if (esRecord) {
      return mejorPrevio === null
        ? `${cuenta}.${como} A ver quién lo mejora.`
        : `${cuenta}.${como} Récord nuevo: antes eran ${mejorPrevio}.`;
    }
    return `${cuenta}.${como} Tu récord sigue en ${mejorPrevio}.`;
  }

  // ---- Pintado -----------------------------------------------------------

  function pintar() {
    marcador.textContent = mejorPrevio === null
      ? `Ronda ${ronda}`
      : `Ronda ${ronda}  ·  récord ${mejorPrevio}`;

    for (const b of botones) b.disabled = terminada || cantando;

    if (terminada) { aviso.textContent = ''; return; }
    aviso.textContent = cantando ? `${ctx.yo} dice…` : 'Repite la serie';
  }

  /** Un reloj de una sola vez, que es lo único que no da el contrato. */
  function esperar(ms, fn) {
    const parar = ctx.cadaCierto(() => {
      parar();
      if (!terminada) fn();
    }, ms);
    return parar;
  }
}
