// Memoria: parejas con tu mascota.
//
// Doce cartas boca abajo, seis parejas. Destapas dos: si son iguales se quedan
// y repites; si no, se vuelven a tapar y le toca al otro.
//
// Lo que estrena es el material: las caras son la MASCOTA haciendo cosas
// —durmiendo, comiendo, con un regalo— recortadas de las mismas hojas de
// sprites con las que se dibuja el pato. Cada pareja es una pose distinta, y
// nunca hay dos poses repetidas en la mesa: si dos caras se parecieran, el juego
// dejaría de ser de memoria y pasaría a ser de vista.
//
// Los diseños desbloqueados se reparten entre las poses, así que la baraja va
// creciendo en variedad a la vez que la colección.

import { sembrar, unoDe } from './azar.js';
import { SKINS, estaDesbloqueada, SKIN_POR_DEFECTO } from '../skins.js';
import { cargarSheet } from '../../assets.js';

/**
 * Las poses que se pueden usar de cara.
 *
 * Están elegidas por SILUETA, no por gracia: a sesenta píxeles no se distingue
 * un pato hablando de uno quieto, pero sí uno tumbado durmiendo de uno con un
 * regalo en las manos. Se cogen seis de éstas en cada partida, así que la
 * baraja no es la misma dos veces seguidas.
 */
const POSES = [
  { anim: 'sleep', emoji: '😴' },
  { anim: 'eat', emoji: '🍞' },
  { anim: 'happy', emoji: '😄' },
  { anim: 'sad', emoji: '😢' },
  { anim: 'cool', emoji: '😎' },
  { anim: 'regalo', emoji: '🎁' },
  { anim: 'flap', emoji: '🪽' },
  { anim: 'play', emoji: '🎾' }
];

const PAREJAS = 6;

// Lo que se queda viendo una pareja fallada antes de taparse. Con menos no da
// tiempo a memorizar dónde estaba, que es justo lo que se juega aquí.
const PAUSA_MS = 1300;

// El compás de la mascota en el modo de un jugador: uno solo para todas sus
// jugadas, y hace de pausa. Contestar al instante no parece pensar, parece
// estar esperando.
const PASO_MASCOTA_MS = 900;

/**
 * Cuánto se acuerda la mascota de una carta que ya ha visto, según el nivel.
 *
 * Empieza despistada y acaba siendo implacable, igual que la torpeza del tres en
 * raya. Con memoria perfecta desde el principio no se le gana nunca, porque en
 * este juego acordarse ES jugar bien.
 */
function memoriaDeLaMascota(nivel) {
  return Math.min(0.95, 0.3 + Math.max(0, nivel - 4) * 0.055);
}

/**
 * @param {import('./index.js').ContextoPartida} ctx
 * @returns {import('./index.js').Partida}
 */
export function crearPartida(ctx) {
  const contraLaMascota = ctx.modo === 'solo';
  const azar = sembrar(ctx.semilla);

  const empiezoYo = ctx.semilla % 2 === 0;
  const miIndice = contraLaMascota
    ? (empiezoYo ? 0 : 1)
    : Math.max(0, ctx.jugadores.indexOf(ctx.yo));
  const indiceDeLaMascota = contraLaMascota ? 1 - miIndice : -1;

  const jugadores = contraLaMascota
    ? (empiezoYo ? [ctx.yo, 'Tu mascota'] : ['Tu mascota', ctx.yo])
    : ctx.jugadores.slice();

  // La baraja sale de la semilla, así que los dos lados la tienen igual sin
  // mandársela. Ojo con tocar el orden de estas llamadas al azar: cambiarlo
  // rompería la baraja entre dos patos con versiones distintas.
  const caras = repartirCaras(azar, ctx.nivel);
  const tablero = barajar(caras.flatMap((c, i) => [i, i]), azar);

  /** Índices ya emparejados: se quedan boca arriba para siempre. */
  const hechas = new Set();
  /**
   * Lo que la mascota ha llegado a ver: índice → cara. Se apunta lo que se
   * destapa, lo suyo y lo tuyo, porque estaba delante mirando.
   *
   * Va aquí arriba y no en su sección: lo escribe `pintar`, y `pintar` corre
   * desde el primer momento. Declararlo entre las funciones de abajo lo dejaba
   * detrás del `return`, o sea sin ejecutar nunca.
   */
  const vistas = new Map();
  /** Lo destapado en este turno: 0, 1 o 2 índices. */
  let abiertas = [];
  let turno = 0;
  let esperando = false;      // enseñando un fallo antes de taparlo
  let pararPausa = null;
  const parejas = [0, 0];
  let terminada = false;

  // ---- Interfaz ----------------------------------------------------------
  const el = document.createElement('div');
  el.className = 'jmm';

  const marcador = document.createElement('p');
  marcador.className = 'jppt-marcador';
  el.appendChild(marcador);

  const aviso = document.createElement('p');
  aviso.className = 'jt-aviso';
  el.appendChild(aviso);

  const mesa = document.createElement('div');
  mesa.className = 'jmm-mesa';
  el.appendChild(mesa);

  /** @type {{boton:HTMLButtonElement, lienzo:HTMLCanvasElement, emoji:HTMLElement}[]} */
  const cartas = tablero.map((_, i) => {
    const boton = document.createElement('button');
    boton.className = 'jmm-carta';
    boton.type = 'button';

    const lienzo = document.createElement('canvas');
    lienzo.className = 'jmm-cara';
    lienzo.width = 96;
    lienzo.height = 96;

    // Debajo del dibujo, por si la hoja no llega: un juego de memoria con las
    // caras en blanco no es difícil, es imposible.
    const emoji = document.createElement('span');
    emoji.className = 'jmm-emoji';
    emoji.textContent = caras[tablero[i]].pose.emoji;

    boton.append(emoji, lienzo);
    boton.addEventListener('click', () => intentar(i));
    mesa.appendChild(boton);
    return { boton, lienzo, emoji };
  });

  pintarCaras();

  // ---- Red ---------------------------------------------------------------
  if (ctx.sala) {
    ctx.alDestruir(ctx.sala.alRecibir((msg) => {
      if (!msg || msg.t !== 'destapar') return;
      // El rival puede llegar mientras aquí todavía se está viendo su fallo
      // anterior: se cierra la pausa y se atiende, en vez de descartarla. La
      // sala ya se la ha dado por confirmada y no la volvería a mandar.
      if (esperando) cerrarPausa();
      if (terminada || turno === miIndice) return;
      destapar(msg.i, turno);
    }));
    ctx.alDestruir(ctx.sala.alIrseUnJugador((quien) => {
      if (terminada) return;
      acabar('victoria', `${quien} ha dejado la partida.`);
    }));
  }

  pintar();
  if (contraLaMascota) pensarLaMascota();

  return {
    el,
    destroy() {
      terminada = true;
      if (pararPausa) { pararPausa(); pararPausa = null; }
    }
  };

  // ---- Reglas ------------------------------------------------------------

  function intentar(i) {
    if (terminada || esperando || turno !== miIndice) return;
    if (!destapar(i, miIndice)) return;
    if (ctx.sala) ctx.sala.enviar({ t: 'destapar', i });
  }

  /** Da la vuelta a una carta si se puede. @returns {boolean} si se aceptó */
  function destapar(i, quien) {
    if (terminada || esperando) return false;
    if (!Number.isInteger(i) || i < 0 || i >= tablero.length) return false;
    if (hechas.has(i) || abiertas.includes(i)) return false;
    if (abiertas.length >= 2) return false;

    abiertas.push(i);
    ctx.sonido.nota(520 + abiertas.length * 90, 0.08);
    pintar();
    if (abiertas.length === 2) resolverPareja(quien);
    return true;
  }

  function resolverPareja(quien) {
    const [a, b] = abiertas;
    if (tablero[a] === tablero[b]) {
      hechas.add(a);
      hechas.add(b);
      abiertas = [];
      parejas[quien]++;
      ctx.pato.animar(quien === miIndice ? 'happy' : 'play', 1.1);
      pintar();
      // Quien acierta repite: el turno no cambia. Y si eso ha vaciado la mesa,
      // se acabó.
      if (hechas.size === tablero.length) rematar();
      return;
    }

    // Fallo: se quedan viéndose un momento y luego se tapan.
    esperando = true;
    pintar();
    pararPausa = ctx.cadaCierto(cerrarPausa, PAUSA_MS);
  }

  /**
   * Cierra la mano fallada: tapa las dos y pasa el turno.
   *
   * La llaman el reloj y también una jugada del rival que llegue antes de que
   * salte, así que tiene que valer las dos veces y no hacer nada de más.
   */
  function cerrarPausa() {
    if (pararPausa) { pararPausa(); pararPausa = null; }
    if (!esperando) return;
    esperando = false;
    abiertas = [];
    turno = 1 - turno;
    pintar();
    if (!terminada && turno === miIndice) ctx.sonido.turno();
  }

  function rematar() {
    const mias = parejas[miIndice];
    const suyas = parejas[1 - miIndice];
    const resultado = mias > suyas ? 'victoria' : mias < suyas ? 'derrota' : 'empate';
    acabar(resultado, `${mias} a ${suyas}.`);
  }

  function acabar(resultado, detalle) {
    if (terminada) return;
    terminada = true;
    if (pararPausa) { pararPausa(); pararPausa = null; }
    pintar();
    // Contra la mascota, ella es el rival y se alegra de ganar. Por red es de
    // los tuyos y se alegra cuando ganas tú.
    const contenta = contraLaMascota ? resultado === 'derrota' : resultado === 'victoria';
    ctx.sonido[resultado === 'derrota' ? 'derrota' : 'victoria']();
    ctx.pato.animar(resultado === 'empate' ? 'play' : (contenta ? 'happy' : 'sad'), 1.4);
    ctx.alTerminar({ resultado, detalle });
  }

  // ---- La mascota --------------------------------------------------------

  function leToca() { return contraLaMascota && !terminada && !esperando && turno === indiceDeLaMascota; }

  /** UN reloj para todas sus jugadas, no uno por jugada. */
  function pensarLaMascota() {
    ctx.cadaCierto(() => {
      if (!leToca() || abiertas.length >= 2) return;
      const i = eligeLaMascota();
      if (i >= 0) destapar(i, indiceDeLaMascota);
    }, PASO_MASCOTA_MS);
  }

  function eligeLaMascota() {
    const libres = tablero
      .map((_, i) => i)
      .filter((i) => !hechas.has(i) && !abiertas.includes(i));
    if (!libres.length) return -1;

    const acordarse = azar() < memoriaDeLaMascota(ctx.nivel);

    if (abiertas.length === 1) {
      // Ya tiene una abierta: busca su pareja entre las que recuerda.
      const busca = tablero[abiertas[0]];
      const pareja = libres.find((i) => vistas.get(i) === busca);
      if (pareja !== undefined && acordarse) return pareja;
      return unoDe(libres, azar);
    }

    // Mano nueva: si recuerda dos iguales, va a por ellas.
    if (acordarse) {
      const porCara = new Map();
      for (const i of libres) {
        const cara = vistas.get(i);
        if (cara === undefined) continue;
        if (porCara.has(cara)) return porCara.get(cara);
        porCara.set(cara, i);
      }
    }
    // Y si no, prueba una que no haya visto nunca; si ya las ha visto todas,
    // cualquiera.
    const nuevas = libres.filter((i) => !vistas.has(i));
    return unoDe(nuevas.length ? nuevas : libres, azar);
  }

  // ---- Pintado -----------------------------------------------------------

  function pintar() {
    marcador.textContent = contraLaMascota
      ? `Tú ${parejas[miIndice]} · ${parejas[1 - miIndice]} tu mascota`
      : `Tú ${parejas[miIndice]} · ${parejas[1 - miIndice]} ${jugadores[1 - miIndice]}`;

    for (let i = 0; i < cartas.length; i++) {
      const arriba = hechas.has(i) || abiertas.includes(i);
      cartas[i].boton.classList.toggle('vuelta', arriba);
      cartas[i].boton.classList.toggle('hecha', hechas.has(i));
      cartas[i].boton.disabled = terminada || esperando || arriba || turno !== miIndice;
      if (arriba) vistas.set(i, tablero[i]);
    }

    if (terminada) { aviso.textContent = ''; return; }
    aviso.textContent = esperando ? 'No eran pareja…'
      : turno === miIndice ? 'Te toca' : `Le toca a ${jugadores[turno]}`;
  }

  /**
   * Recorta cada cara de su hoja de sprites.
   *
   * La imagen se pide con `cargarSheet` y no se pone de fondo con CSS: sobre una
   * página con CSP estricto un `background-image` se lo come el `img-src` de esa
   * página y las cartas saldrían en blanco. Mientras llega —y si no llega— se ve
   * el emoji, que ya está puesto debajo.
   */
  function pintarCaras() {
    const hojas = new Map();
    for (const cara of caras) {
      if (hojas.has(cara.skin)) continue;
      hojas.set(cara.skin, cargarSheet(cara.skin).catch(() => null));
    }

    for (const [skin, promesa] of hojas) {
      promesa.then((imagen) => {
        if (!imagen || terminada) return;
        for (let i = 0; i < tablero.length; i++) {
          const cara = caras[tablero[i]];
          if (cara.skin !== skin) continue;
          recortar(cartas[i].lienzo, imagen, cara);
          cartas[i].emoji.hidden = true;
        }
      }).catch(() => { /* se queda el emoji */ });
    }
  }

  function recortar(lienzo, imagen, cara) {
    const meta = ctx.sprites[cara.skin];
    if (!meta) return;
    const anim = meta.animations && meta.animations[cara.pose.anim];
    if (!anim) return;

    // Un cuadro de en medio de la animación: el primero suele ser la postura de
    // reposo, y entre dos poses en reposo no hay quien distinga.
    const cuadro = Math.floor((anim.frames || 1) / 2);
    const fw = meta.frameW;
    const fh = meta.frameH;
    // Se deja un margen: el arte no llena el cuadro y sin recortarlo la mascota
    // sale diminuta en el centro de la carta.
    const m = 0.1;
    const g = lienzo.getContext('2d');
    if (!g) return;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, lienzo.width, lienzo.height);
    g.drawImage(imagen,
      cuadro * fw + fw * m, anim.row * fh + fh * m, fw * (1 - 2 * m), fh * (1 - 2 * m),
      0, 0, lienzo.width, lienzo.height);
  }
}

// ---- Baraja --------------------------------------------------------------

/**
 * Seis caras distintas: una pose cada una, y un diseño desbloqueado repartido
 * entre ellas.
 *
 * Nunca se repite pose. Dos caras con la misma pose y distinto diseño se
 * parecerían demasiado a este tamaño, y una pareja que no se puede distinguir de
 * otra convierte el juego en una lotería.
 */
export function repartirCaras(azar, nivel) {
  const libres = SKINS.filter((s) => estaDesbloqueada(s, nivel));
  const diseños = libres.length ? libres.map((s) => s.id) : [SKIN_POR_DEFECTO];
  const poses = barajar(POSES.slice(), azar).slice(0, PAREJAS);
  return poses.map((pose, i) => ({ pose, skin: diseños[i % diseños.length] }));
}

/** Fisher-Yates con el azar que le den, para que los dos lados barajen igual. */
export function barajar(lista, azar) {
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista;
}
