// Tres en raya.
//
// Contra el pato o contra otro pato por turnos. Es el juego de referencia del
// sistema: el más pequeño que ejercita las dos cosas que hay que probar —una
// partida de un jugador y una por red— sin traer nada propio.
//
// El módulo no guarda nada fuera de `crearPartida`: el marco la vuelve a llamar
// en cada "¿Otra?", y una variable de módulo se filtraría de una partida a la
// siguiente.

import { sembrar } from './azar.js';

const LINEAS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],   // filas
  [0, 3, 6], [1, 4, 7], [2, 5, 8],   // columnas
  [0, 4, 8], [2, 4, 6]               // diagonales
];

const MARCAS = ['❌', '⭕'];

/**
 * Con qué frecuencia el pato juega a lo tonto, según el nivel.
 *
 * Sin esto, el tres en raya de un jugador es invencible desde el primer día
 * —con nueve casillas, jugar perfecto es trivial— y empatar siempre aburre en
 * dos partidas. Así el pato empieza siendo un rival plausible y se va poniendo
 * serio a la vez que su dueño.
 *
 * Es un número y no una opción del menú a propósito: elegir dificultad convierte
 * un juego de treinta segundos en un formulario.
 */
function torpeza(nivel) {
  if (nivel >= 10) return 0;
  return Math.max(0, 0.34 - (nivel - 1) * 0.034);
}

/**
 * @param {import('./index.js').ContextoPartida} ctx
 * @returns {import('./index.js').Partida}
 */
export function crearPartida(ctx) {
  const contraElPato = ctx.modo === 'solo';

  // Quién juega y en qué orden. En solo el rival lo pone el juego; por red, el
  // orden ya viene decidido por quien montó la sala, y es el mismo en los dos
  // lados (de ahí que no se negocie aquí).
  const empiezoYo = ctx.semilla % 2 === 0;
  const miIndice = contraElPato
    ? (empiezoYo ? 0 : 1)
    : Math.max(0, ctx.jugadores.indexOf(ctx.yo));
  const indiceDelPato = contraElPato ? 1 - miIndice : -1;

  const jugadores = contraElPato
    ? (empiezoYo ? [ctx.yo, 'Tu mascota'] : ['Tu mascota', ctx.yo])
    : ctx.jugadores.slice();

  const tablero = new Array(9).fill(-1);   // -1 vacío, si no el índice del jugador
  let turno = 0;
  let terminada = false;
  let azar = sembrar(ctx.semilla);

  // ---- Interfaz ----------------------------------------------------------
  const el = document.createElement('div');
  el.className = 'jt';

  const aviso = document.createElement('p');
  aviso.className = 'jt-aviso';
  el.appendChild(aviso);

  const grid = document.createElement('div');
  grid.className = 'jt-tablero';
  el.appendChild(grid);

  /** @type {HTMLButtonElement[]} */
  const casillas = [];
  for (let i = 0; i < 9; i++) {
    const b = document.createElement('button');
    b.className = 'jt-casilla';
    b.type = 'button';
    b.addEventListener('click', () => intentar(i));
    grid.appendChild(b);
    casillas.push(b);
  }

  // ---- Red ---------------------------------------------------------------
  if (ctx.sala) {
    ctx.alDestruir(ctx.sala.alRecibir((msg) => {
      if (!msg || msg.t !== 'mover') return;
      // Sólo se acepta si cuadra: el rival puede ir con retraso, venir mal o
      // sencillamente mentir. La sala ya filtra por turno; esto es el cinturón.
      if (terminada || turno === miIndice) return;
      if (!poner(msg.i, turno)) return;
      avanzar();
    }));
    ctx.alDestruir(ctx.sala.alIrseUnJugador((quien) => {
      if (terminada) return;
      acabar('victoria', `${quien} ha dejado la partida.`);
    }));
  }

  if (ctx.previas && ctx.previas.length) rehacer(ctx.previas);
  pintar();
  if (contraElPato) pensarElPato();

  return {
    el,
    destroy() { terminada = true; }
  };

  // ---- Reglas ------------------------------------------------------------

  function intentar(i) {
    if (terminada || turno !== miIndice) return;
    if (!poner(i, miIndice)) return;
    if (ctx.sala) ctx.sala.enviar({ t: 'mover', i });
    avanzar();
  }

  /** Coloca si la jugada es legal. @returns {boolean} si se aceptó */
  function poner(i, quien) {
    if (!Number.isInteger(i) || i < 0 || i > 8) return false;
    if (tablero[i] !== -1) return false;
    tablero[i] = quien;
    return true;
  }

  /** Cierra la jugada: mira si hay final y, si no, pasa el turno. */
  function avanzar() {
    if (revisarFinal()) return;
    turno = 1 - turno;
    pintar();
    if (turno === miIndice) ctx.sonido.turno();
  }

  /** ¿Se acabó con lo que hay en el tablero? @returns {boolean} */
  function revisarFinal() {
    const linea = lineaGanadora(tablero);
    if (linea) {
      resaltar(linea);
      const ganador = tablero[linea[0]];
      pintar();
      if (contraElPato) {
        acabar(ganador === miIndice ? 'victoria' : 'derrota');
      } else {
        acabar(ganador === miIndice ? 'victoria' : 'derrota',
          `Ganó ${jugadores[ganador]}.`);
      }
      return true;
    }
    if (tablero.every((c) => c !== -1)) {
      pintar();
      acabar('empate');
      return true;
    }
    return false;
  }

  /**
   * Rehace el tablero de una partida que se quedó en otra pestaña.
   *
   * Aquí sí se recupera todo: una casilla puesta es una casilla puesta, no hay
   * nada secreto de por medio. Se reaplica en orden y comprobando el turno, que
   * lo guardado viene de otro ordenador y podría venir descolocado.
   */
  function rehacer(previas) {
    let alguna = false;
    for (const p of previas) {
      const j = p && p.jugada;
      if (!j || j.t !== 'mover') continue;
      const quien = p.mia ? miIndice : 1 - miIndice;
      if (turno !== quien || !poner(j.i, quien)) continue;
      turno = 1 - turno;
      alguna = true;
    }
    // Se pudo acabar justo al mudarse de pestaña. Se mira DESPUÉS de montar el
    // tablero, que `acabar` avisa al marco y el marco todavía no tiene panel.
    if (alguna && lineaGanadora(tablero)) {
      const parar = ctx.cadaCierto(() => { parar(); revisarFinal(); }, 0);
    }
  }

  function acabar(resultado, detalle) {
    terminada = true;
    pintar();
    // Contra el pato, el pato es el rival y se alegra de ganar. Por red es de
    // los tuyos, así que se alegra cuando ganas tú.
    const contento = contraElPato ? resultado === 'derrota' : resultado === 'victoria';
    ctx.pato.animar(resultado === 'empate' ? 'play' : (contento ? 'happy' : 'sad'));
    ctx.alTerminar(detalle ? { resultado, detalle } : { resultado });
  }

  // ---- El pato -----------------------------------------------------------

  function leTocaAlPato() { return contraElPato && !terminada && turno === indiceDelPato; }

  /**
   * UN solo reloj para todas las jugadas del pato, no uno por jugada: crear un
   * intervalo cada vez dejaría media docena corriendo a la vez en una partida
   * normal, todos mirando el mismo tablero.
   *
   * El compás también hace de pausa. Si el pato contestara al instante no
   * parecería que piensa, parecería que estaba esperando.
   */
  function pensarElPato() {
    ctx.cadaCierto(() => {
      if (!leTocaAlPato()) return;
      const i = eligeElPato();
      if (i >= 0 && poner(i, indiceDelPato)) avanzar();
    }, 520);
  }

  function eligeElPato() {
    const libres = tablero.map((v, i) => (v === -1 ? i : -1)).filter((i) => i >= 0);
    if (!libres.length) return -1;
    if (azar() < torpeza(ctx.nivel)) return libres[Math.floor(azar() * libres.length)];
    return mejorJugada(tablero, indiceDelPato);
  }

  // ---- Pintado -----------------------------------------------------------

  function pintar() {
    for (let i = 0; i < 9; i++) {
      const v = tablero[i];
      casillas[i].textContent = v === -1 ? '' : MARCAS[v];
      casillas[i].disabled = terminada || v !== -1 || turno !== miIndice;
    }
    if (terminada) { aviso.textContent = ''; return; }
    aviso.textContent = turno === miIndice
      ? `Te toca · ${MARCAS[miIndice]}`
      : `Le toca a ${jugadores[turno]}`;
  }

  function resaltar(linea) {
    for (const i of linea) casillas[i].classList.add('jt-gana');
  }
}

// ---- Lógica pura ---------------------------------------------------------

function lineaGanadora(t) {
  for (const l of LINEAS) {
    if (t[l[0]] !== -1 && t[l[0]] === t[l[1]] && t[l[1]] === t[l[2]]) return l;
  }
  return null;
}

/**
 * Minimax sin podas ni tablas. Con nueve casillas el árbol completo son menos de
 * medio millón de nudos en el peor caso y se resuelve en un parpadeo; optimizarlo
 * sería añadir código que nadie va a leer para ganar un tiempo que nadie nota.
 */
function mejorJugada(tablero, yo) {
  let mejor = -1;
  let mejorValor = -Infinity;
  for (let i = 0; i < 9; i++) {
    if (tablero[i] !== -1) continue;
    tablero[i] = yo;
    const v = minimax(tablero, 1 - yo, yo, 1);
    tablero[i] = -1;
    if (v > mejorValor) { mejorValor = v; mejor = i; }
  }
  return mejor;
}

function minimax(t, turno, yo, profundidad) {
  const linea = lineaGanadora(t);
  // Se resta la profundidad al ganar y se suma al perder: entre dos victorias
  // seguras prefiere la más corta, y entre dos derrotas la más lejana. Sin esto
  // el pato alarga partidas ganadas y parece que no sabe rematar.
  if (linea) return t[linea[0]] === yo ? 10 - profundidad : profundidad - 10;
  if (t.every((c) => c !== -1)) return 0;

  let mejor = turno === yo ? -Infinity : Infinity;
  for (let i = 0; i < 9; i++) {
    if (t[i] !== -1) continue;
    t[i] = turno;
    const v = minimax(t, 1 - turno, yo, profundidad + 1);
    t[i] = -1;
    mejor = turno === yo ? Math.max(mejor, v) : Math.min(mejor, v);
  }
  return mejor;
}
