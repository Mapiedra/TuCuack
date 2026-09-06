// Ahorcado: uno piensa la palabra y el otro la adivina, letra a letra.
//
// ---- A dos, y no a más ------------------------------------------------------
//
// La tabla de pendientes decía «red (2+)». No se hace, y conviene dejar escrito
// por qué: `game/salas.js` está cableado a DOS jugadores. Hay un único
// `sala.rival` y los doce envíos van a `sala.rival.clave`; `sala.jugadores` es
// sólo una lista de nombres para enseñar. Pasar de ahí no es añadir un bucle:
// son secuencias, confirmaciones, reenvíos y plazos de ausencia POR JUGADOR, un
// vestíbulo en vez de un reto, y que irse a mitad deje de ser el final de la
// partida. Es reescribir el módulo más delicado del proyecto —el que tiene la
// máquina de reconexión que costó afinar— por un solo juego.
//
// ---- Los dos proponen a la vez ---------------------------------------------
//
// Por turnos de verdad —uno propone, el otro adivina, y luego al revés— la mitad
// de la partida es mirar. Así que las dos palabras se ponen a la vez y cada uno
// adivina la del otro por su cuenta: no hay tiempos muertos, y contestar a las
// letras del rival se puede hacer siempre, porque tu palabra la tienes tú.
//
// Gana quien la saque con menos fallos. Sacarla gana a no sacarla.
//
// ---- Nadie tiene la palabra del otro ---------------------------------------
//
// El que propone NO manda la palabra. Manda su LARGO y un **compromiso**: el
// hash de `sal:palabra` (ver `protocolo.js`). Después contesta a cada letra con
// las posiciones donde está, y sólo al final revela palabra y sal, que el otro
// comprueba contra el compromiso.
//
// Sin eso, la palabra viajaría al empezar y estaría en la memoria de quien tiene
// que adivinarla —una pestaña de herramientas y se acabó el juego—. Y con eso,
// además, tampoco se puede ir cambiando sobre la marcha para que no se acierte
// nunca: mentir sigue siendo posible, pero queda en evidencia.

import { sembrar } from './azar.js';
import { compromiso, cumpleCompromiso } from '../protocolo.js';

/**
 * Fallos que se permiten por palabra. Seis, como toda la vida.
 *
 * Y son seis por una razón que no es la tradición: son exactamente los trazos
 * del muñeco —cabeza, cuerpo, dos brazos y dos piernas—. El dibujo ES el
 * contador, así que cambiar este número es cambiar `TRAZOS`.
 */
const FALLOS = 6;

const SVG = 'http://www.w3.org/2000/svg';

/**
 * La horca, en dos partes.
 *
 * Las cuatro maderas —base, poste, viga y cuerda— están desde el principio: son
 * el escenario, no la cuenta. Lo que aparece de uno en uno con cada fallo son
 * los seis trazos del muñeco, y en el orden de siempre.
 */
const MADERAS = [
  ['line', { x1: 4, y1: 88, x2: 46, y2: 88 }],   // base
  ['line', { x1: 14, y1: 88, x2: 14, y2: 4 }],   // poste
  ['line', { x1: 14, y1: 4, x2: 46, y2: 4 }],    // viga
  ['line', { x1: 46, y1: 4, x2: 46, y2: 13 }]    // cuerda
];

const TRAZOS = [
  ['circle', { cx: 46, cy: 20, r: 7 }],                 // cabeza
  ['line', { x1: 46, y1: 27, x2: 46, y2: 52 }],         // cuerpo
  ['line', { x1: 46, y1: 33, x2: 36, y2: 44 }],         // brazo izquierdo
  ['line', { x1: 46, y1: 33, x2: 56, y2: 44 }],         // brazo derecho
  ['line', { x1: 46, y1: 52, x2: 36, y2: 66 }],         // pierna izquierda
  ['line', { x1: 46, y1: 52, x2: 56, y2: 66 }]          // pierna derecha
];

/** @returns {{el:SVGElement, mostrar:(fallos:number)=>void}} */
function crearHorca() {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 70 92');
  svg.setAttribute('class', 'ah-horca');
  // Decorativo: lo que hay que saber —cuántos fallos llevas— lo dice el aviso,
  // y un lector de pantalla leyendo «línea, línea, círculo» no ayuda a nadie.
  svg.setAttribute('aria-hidden', 'true');

  const pinta = (clase) => ([tipo, atributos]) => {
    const nodo = document.createElementNS(SVG, tipo);
    for (const [k, v] of Object.entries(atributos)) nodo.setAttribute(k, String(v));
    nodo.setAttribute('class', clase);
    svg.appendChild(nodo);
    return nodo;
  };

  MADERAS.map(pinta('ah-madera'));
  const partes = TRAZOS.map(pinta('ah-trazo'));

  return {
    el: svg,
    mostrar(fallos) {
      partes.forEach((nodo, i) => {
        // `visibility` y no `hidden`: en SVG el atributo `hidden` de HTML no
        // pinta nada, y esconder con `display` reflowía el dibujo entero.
        nodo.setAttribute('visibility', i < fallos ? 'visible' : 'hidden');
      });
    }
  };
}

const ALFABETO = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';

/** Lo que se espera entre una palabra acertada y la siguiente, en solo. */
const RESPIRO_MS = 1100;

/**
 * Las palabras de la mascota, por tamaño.
 *
 * Van sin acentos a propósito: el teclado del panel tiene veintisiete botones y
 * meter las vocales acentuadas lo llevaría a treinta y dos sin que el juego
 * ganara nada. La Ñ sí está, que sin ella esto no sería un ahorcado en español.
 */
const PALABRAS = [
  ['PATO', 'NIDO', 'LAGO', 'PICO', 'PLUMA', 'AGUA', 'BARCA', 'JUNCO', 'RANA', 'ALGA',
    'CAÑA', 'SAPO', 'NUBE', 'BOTE', 'REMO', 'ORILLA', 'VIENTO', 'ISLA'],
  ['ESTANQUE', 'GRAZNIDO', 'PANTANO', 'RIBERA', 'CHARCA', 'JUNCAL', 'CIENAGA',
    'ANADE', 'CISNE', 'GAVIOTA', 'GARZA', 'MARISMA', 'ACUATICO', 'ALETEO',
    'CORRIENTE', 'PECERA', 'ANZUELO', 'CANAVERAL'],
  ['MIGRATORIO', 'IMPERMEABLE', 'ZAMBULLIRSE', 'CHAPOTEANDO', 'EMPLUMADO',
    'DESPLUMADO', 'ENCHARCADO', 'REVOLOTEANDO', 'ANFIBIO', 'CRUSTACEO',
    'PLUMIFERO', 'PALUSTRE', 'ESTUARIO', 'DESEMBOCADURA']
];

/** A partir de cuántas acertadas se pasa de banda, en solo. */
const SUBE_BANDA = [3, 8];

/**
 * @param {import('./index.js').ContextoPartida} ctx
 * @returns {import('./index.js').Partida}
 */
export function crearPartida(ctx) {
  // ---- TODO el estado, antes del `return`. Cuarta regla del contrato. ------

  const contraLaMascota = ctx.modo === 'solo' || !ctx.sala;
  const mejorPrevio = typeof ctx.marcas.mejor === 'number' ? ctx.marcas.mejor : null;
  const azar = sembrar(ctx.semilla);
  const nombreRival = (ctx.jugadores || []).find((n) => n !== ctx.yo) || 'tu rival';

  /** 'proponiendo' | 'adivinando' | 'esperando' | 'fin' */
  let fase = 'proponiendo';
  let terminada = false;

  /** La que YO pongo para que la adivine el otro. Vacía en solo. */
  const propuesta = { palabra: '', sal: '', prometido: '' };

  /**
   * La que YO adivino. En solo la sabe este lado; por red sólo se conoce el
   * largo y el compromiso hasta que la revelan.
   */
  /**
   * `descubiertas` guarda LA LETRA de cada hueco, no un sí/no.
   *
   * Con booleanos no basta: por red este lado no tiene la palabra —de eso va el
   * compromiso— y al acertar una letra no sabría cuál pintar en el hueco. Con
   * booleanos salía «_ ? _ _ ?».
   */
  const enigma = { palabra: '', prometido: '', descubiertas: [], pedidas: new Set(), fallos: 0 };

  /** Solo: cuántas llevo encadenadas. Es la marca. */
  let acertadas = 0;

  /** Red: cómo acabó cada uno. `null` mientras no se sepa. */
  let misFallos = null;
  let susFallos = null;
  let acerteYo = false;
  let acertoEl = false;
  /** Su palabra llegó antes de que yo pusiera la mía: se guarda. */
  let suyaPendiente = null;

  // ---- Interfaz ----------------------------------------------------------
  const el = document.createElement('div');
  el.className = 'ah';

  const aviso = document.createElement('p');
  aviso.className = 'jt-aviso';
  el.appendChild(aviso);

  const huecos = document.createElement('p');
  huecos.className = 'ah-palabra';
  el.appendChild(huecos);

  const horca = crearHorca();
  el.appendChild(horca.el);

  const caja = document.createElement('div');
  caja.className = 'ah-proponer';
  const campo = document.createElement('input');
  campo.type = 'text';
  campo.className = 'ah-campo';
  campo.autocomplete = 'off';
  campo.maxLength = 16;
  campo.placeholder = 'Una palabra…';
  const enviar = document.createElement('button');
  enviar.className = 'btn';
  enviar.type = 'button';
  enviar.textContent = 'Que la adivine';
  caja.append(campo, enviar);
  el.appendChild(caja);

  const teclado = document.createElement('div');
  teclado.className = 'ah-teclado';
  el.appendChild(teclado);

  /** @type {Map<string, HTMLButtonElement>} */
  const teclas = new Map();
  for (const letra of ALFABETO) {
    const b = document.createElement('button');
    b.className = 'ah-tecla';
    b.type = 'button';
    b.textContent = letra;
    b.addEventListener('click', () => pedir(letra));
    teclado.appendChild(b);
    teclas.set(letra, b);
  }

  enviar.addEventListener('click', () => { proponer(campo.value); });
  // El teclado se engancha al CAMPO, no al documento: primera regla del
  // contrato, y aquí sólo interesan las teclas de quien está escribiendo.
  campo.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    proponer(campo.value);
  });

  if (ctx.sala) {
    ctx.alDestruir(ctx.sala.alRecibir((msg) => { recibir(msg); }));
    ctx.alDestruir(ctx.sala.alIrseUnJugador((quien) => {
      if (terminada) return;
      acabar('victoria', `${quien} ha dejado la partida.`);
    }));
  }

  arrancar();

  return {
    el,
    destroy() { terminada = true; }
  };

  // ---- Arranque ----------------------------------------------------------

  function arrancar() {
    if (contraLaMascota) { nuevaDeLaMascota(); return; }
    fase = 'proponiendo';
    pintar();
    // En un microtask y no en un `setTimeout`: al campo hay que darle el foco
    // DESPUÉS de que el marco lo monte, y un temporizador suelto es justo lo que
    // prohíbe la segunda regla del contrato.
    queueMicrotask(() => { try { campo.focus(); } catch { /* da igual */ } });
  }

  function nuevaDeLaMascota() {
    const banda = acertadas >= SUBE_BANDA[1] ? 2 : acertadas >= SUBE_BANDA[0] ? 1 : 0;
    const lista = PALABRAS[banda];
    ponerEnigma(lista[Math.floor(azar() * lista.length)], '');
    fase = 'adivinando';
    pintar();
  }

  /** @param {string} palabra la de verdad, o '' si sólo se sabe el largo */
  function ponerEnigma(palabra, prometido, largo) {
    enigma.palabra = palabra;
    enigma.prometido = prometido;
    enigma.pedidas.clear();
    enigma.fallos = 0;
    enigma.descubiertas = new Array(palabra ? palabra.length : largo).fill('');
  }

  // ---- Proponer ----------------------------------------------------------

  function proponer(texto) {
    if (fase !== 'proponiendo' || terminada) return;
    const limpia = normalizar(texto);
    if (limpia.length < 3) { avisar('Al menos tres letras.'); return; }

    propuesta.palabra = limpia;
    propuesta.sal = Math.random().toString(36).slice(2, 10);
    campo.value = '';

    compromiso(`${propuesta.sal}:${propuesta.palabra}`).then((hash) => {
      if (terminada) return;
      propuesta.prometido = hash;
      // Va el LARGO y el compromiso, nunca la palabra. Ver la cabecera.
      ctx.sala.enviar({ t: 'palabra', largo: propuesta.palabra.length, prometido: hash });
      if (suyaPendiente) { empezarAAdivinar(suyaPendiente); suyaPendiente = null; return; }
      fase = 'esperando';
      pintar();
    });
  }

  /**
   * Mayúsculas, sin acentos, y sólo letras.
   *
   * La Ñ se aparta ANTES de normalizar: en NFD se descompone en N + virgulilla,
   * y quitar los diacríticos convertiría «AÑO» en «ANO». Se cambia por un
   * carácter que no puede teclear nadie y se devuelve al final.
   */
  function normalizar(texto) {
    return String(texto || '')
      .toUpperCase()
      .replace(/Ñ/g, '\u0001')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\u0001/g, 'Ñ')
      .replace(/[^A-ZÑ]/g, '');
  }

  // ---- Adivinar ----------------------------------------------------------

  function pedir(letra) {
    if (fase !== 'adivinando' || terminada) return;
    if (enigma.pedidas.has(letra)) return;
    enigma.pedidas.add(letra);

    // En solo la respuesta la tiene este lado; por red la da el otro.
    if (enigma.palabra) { resolverLetra(letra, donde(enigma.palabra, letra)); return; }
    ctx.sala.enviar({ t: 'letra', letra });
    pintar();
  }

  function donde(palabra, letra) {
    const sitios = [];
    for (let i = 0; i < palabra.length; i++) if (palabra[i] === letra) sitios.push(i);
    return sitios;
  }

  function resolverLetra(letra, sitios) {
    if (sitios.length) {
      for (const i of sitios) enigma.descubiertas[i] = letra;
      ctx.sonido.nota(760, 0.05);
    } else {
      enigma.fallos++;
      ctx.sonido.nota(220, 0.1);
    }
    pintar();

    if (enigma.descubiertas.every((c) => c)) { sacada(); return; }
    if (enigma.fallos >= FALLOS) { fallada(); return; }
  }

  function sacada() {
    ctx.pato.animar('happy');
    ctx.sonido.nota(880, 0.1);
    ctx.sonido.nota(1174, 0.14);

    if (contraLaMascota) {
      acertadas++;
      avisar(`¡${enigma.palabra}! Van ${acertadas}.`);
      // Por `cadaCierto` y no por `setTimeout`: segunda regla del contrato. Se
      // para a sí mismo en cuanto salta, que es como se hace uno de un solo tiro
      // con la herramienta que hay.
      const parar = ctx.cadaCierto(() => {
        parar();
        if (!terminada) nuevaDeLaMascota();
      }, RESPIRO_MS);
      return;
    }
    cerrarLoMio(true);
  }

  function fallada() {
    ctx.sonido.derrota();
    if (contraLaMascota) {
      // Victoria es récord, como en el resto de los juegos de marca. Darla por
      // acertar una sola palabra pagaría el triple por hacer lo mínimo.
      const esRecord = acertadas > 0
        && (mejorPrevio === null || acertadas > mejorPrevio);
      acabar(esRecord ? 'victoria' : 'derrota',
        `Era ${enigma.palabra}. ${acertadas} ${acertadas === 1 ? 'acertada' : 'acertadas'}.`
        + (esRecord && mejorPrevio !== null ? ` Récord: antes eran ${mejorPrevio}.` : ''));
      return;
    }
    cerrarLoMio(false);
  }

  // ---- Red ---------------------------------------------------------------

  function cerrarLoMio(acerte) {
    misFallos = enigma.fallos;
    acerteYo = acerte;
    fase = 'esperando';
    // Se le dice cómo me ha ido, y se revela mi palabra para que pueda
    // comprobar que era la prometida.
    ctx.sala.enviar({ t: 'resultado', fallos: misFallos, acerte });
    ctx.sala.enviar({ t: 'revelo', palabra: propuesta.palabra, sal: propuesta.sal });
    pintar();
    siHayDosResultados();
  }

  function siHayDosResultados() {
    if (misFallos === null || susFallos === null || terminada) return;
    const gano = acerteYo && !acertoEl ? true
      : !acerteYo && acertoEl ? false
        : misFallos < susFallos ? true
          : misFallos > susFallos ? false : null;

    const mio = acerteYo ? `${misFallos} ${misFallos === 1 ? 'fallo' : 'fallos'}` : 'no la sacaste';
    const suyo = acertoEl ? `${susFallos} ${susFallos === 1 ? 'fallo' : 'fallos'}` : 'no la sacó';
    acabar(gano === true ? 'victoria' : gano === false ? 'derrota' : 'empate',
      `Tú: ${mio}. ${nombreRival}: ${suyo}.`);
  }

  function empezarAAdivinar(msg) {
    const largo = Math.max(3, Math.min(16, Number(msg.largo) || 3));
    ponerEnigma('', String(msg.prometido || ''), largo);
    fase = 'adivinando';
    pintar();
  }

  function recibir(msg) {
    if (!msg || terminada) return;

    if (msg.t === 'palabra') {
      // Si aún no he puesto la mía, se guarda: adivinar antes de proponer
      // dejaría al otro esperando una palabra que no llega.
      if (!propuesta.prometido) { suyaPendiente = msg; return; }
      if (fase === 'esperando') empezarAAdivinar(msg);
      return;
    }

    if (msg.t === 'letra') {
      // Soy quien propuso: contesto dónde está, sin decir la palabra.
      if (!propuesta.palabra) return;
      const letra = String(msg.letra || '').slice(0, 1);
      ctx.sala.enviar({ t: 'donde', letra, donde: donde(propuesta.palabra, letra) });
      return;
    }

    if (msg.t === 'donde') {
      if (fase !== 'adivinando') return;
      const sitios = Array.isArray(msg.donde)
        ? msg.donde.filter((i) => Number.isInteger(i) && i >= 0 && i < enigma.descubiertas.length)
        : [];
      resolverLetra(String(msg.letra || '').slice(0, 1), sitios);
      return;
    }

    if (msg.t === 'resultado') {
      susFallos = Math.max(0, Number(msg.fallos) || 0);
      acertoEl = !!msg.acerte;
      siHayDosResultados();
      return;
    }

    if (msg.t === 'revelo') comprobarRevelacion(msg);
  }

  /**
   * ¿La palabra que revela es la que prometió al empezar?
   *
   * Es el único momento en que se puede saber. No cambia el resultado —sería
   * peor: quien pierde acusaría al otro de tramposo por un fallo de red— pero se
   * dice, que entre amigos con eso basta.
   */
  function comprobarRevelacion(msg) {
    const suya = String(msg.palabra || '');
    if (!enigma.prometido || !suya) return;
    // La suya, ya revelada, sirve para enseñarla en el hueco al terminar.
    enigma.palabra = suya;
    cumpleCompromiso(suya, String(msg.sal || ''), enigma.prometido).then((cuadra) => {
      if (terminada || cuadra) return;
      ctx.decir(`Ojo: la palabra de ${nombreRival} no cuadra con lo que prometió.`);
    });
  }

  // ---- Final -------------------------------------------------------------

  function acabar(resultado, detalle) {
    if (terminada) return;
    terminada = true;
    fase = 'fin';
    pintar();
    ctx.alTerminar({ resultado, puntos: acertadas, detalle });
  }

  // ---- Pintado -----------------------------------------------------------

  function avisar(texto) { aviso.textContent = texto; }

  function pintar() {
    caja.hidden = fase !== 'proponiendo';
    teclado.hidden = fase === 'proponiendo';

    // Al acabar se enseña entera —por red llega con la revelación—; mientras se
    // juega, sólo lo que se ha ido sacando.
    huecos.textContent = enigma.descubiertas.length
      ? enigma.descubiertas
        .map((c, i) => c || (fase === 'fin' && enigma.palabra[i]) || '_')
        .join(' ')
      : '';

    horca.mostrar(enigma.descubiertas.length ? enigma.fallos : 0);

    for (const [letra, b] of teclas) {
      b.disabled = fase !== 'adivinando' || enigma.pedidas.has(letra);
      b.classList.toggle('usada', enigma.pedidas.has(letra));
    }

    if (fase === 'fin') return;
    if (fase === 'proponiendo') { avisar(`Pon una palabra para ${nombreRival}.`); return; }
    if (fase === 'esperando') {
      avisar(misFallos !== null
        ? `Esperando a que ${nombreRival} termine…`
        : `${nombreRival} está pensando una palabra…`);
      return;
    }
    if (contraLaMascota) {
      // La pista del tema no es un regalo: con veintisiete letras y seis fallos,
      // adivinar a ciegas es una lotería. Sabiendo que van de patos y de agua,
      // se puede razonar, que es de lo que va el juego.
      avisar(acertadas
        ? `Van ${acertadas}. A por la siguiente.`
        : 'Adivina la palabra. Van de patos y de agua.');
      return;
    }
    avisar(`La palabra de ${nombreRival}.`);
  }
}
