// Piedra, papel o tijera. Al mejor de tres.
//
// Los dos eligen a la vez y en secreto, que es lo que hace justo el juego. Cómo
// se consigue eso por un canal que sólo sabe alternar está en rondaSimultanea.js;
// aquí sólo se pide una ronda y se pinta el resultado.

import { crearRondaSimultanea } from './rondaSimultanea.js';
import { sembrar, unoDe } from './azar.js';

const OPCIONES = [
  { id: 'piedra', icono: '🪨', nombre: 'Piedra' },
  { id: 'papel', icono: '✋', nombre: 'Papel' },
  { id: 'tijera', icono: '✌️', nombre: 'Tijera' }
];

/** A quién gana cada una. Lo demás es empate. */
const GANA_A = { piedra: 'tijera', papel: 'piedra', tijera: 'papel' };

const RONDAS_PARA_GANAR = 2;   // al mejor de tres

/**
 * @param {import('./index.js').ContextoPartida} ctx
 * @returns {import('./index.js').Partida}
 */
export function crearPartida(ctx) {
  let misRondas = 0;
  let susRondas = 0;
  let numeroDeRonda = 1;
  let terminada = false;
  let ronda = null;
  let elegida = null;          // la de esta ronda, para resaltarla al esperar
  let enPausa = false;         // enseñando el resultado antes de la siguiente
  const azar = sembrar(ctx.semilla);

  const el = document.createElement('div');
  el.className = 'jppt';

  const marcador = document.createElement('p');
  marcador.className = 'jppt-marcador';
  el.appendChild(marcador);

  const aviso = document.createElement('p');
  aviso.className = 'jt-aviso';
  el.appendChild(aviso);

  const fila = document.createElement('div');
  fila.className = 'jppt-opciones';
  el.appendChild(fila);

  /** @type {Map<string, HTMLButtonElement>} */
  const botones = new Map();
  for (const op of OPCIONES) {
    const b = document.createElement('button');
    b.className = 'jppt-opcion';
    b.type = 'button';
    b.title = op.nombre;
    b.textContent = op.icono;
    b.addEventListener('click', () => jugar(op.id));
    fila.appendChild(b);
    botones.set(op.id, b);
  }

  const revelado = document.createElement('p');
  revelado.className = 'jppt-revelado';
  el.appendChild(revelado);

  empezarRonda();

  return {
    el,
    destroy() {
      terminada = true;
      if (ronda) ronda.destroy();
    }
  };

  // ---- Ronda -------------------------------------------------------------

  function empezarRonda() {
    if (terminada) return;
    if (ronda) ronda.destroy();
    ronda = crearRondaSimultanea(ctx, {
      eligeLaMascota: () => unoDe(OPCIONES, azar).id,
      alResolver: resolverRonda
    });
    pintar();
  }

  function jugar(id) {
    if (terminada || !ronda || ronda.esperando()) return;
    elegida = id;
    ronda.elegir(id);
    pintar();
  }

  function resolverRonda(r) {
    if (terminada) return;

    if (r.tramposo) {
      // No se disimula: es la única forma de que sirva de algo comprometerse.
      acabar('victoria', `${nombreDelRival()} cambió su jugada. Partida anulada.`);
      return;
    }
    if (r.plantado) {
      acabar('victoria', `${nombreDelRival()} no llegó a enseñar su jugada.`);
      return;
    }

    const veredicto = compara(r.mio, r.suyo);
    if (veredicto > 0) misRondas++;
    else if (veredicto < 0) susRondas++;

    revelado.textContent = `${iconoDe(r.mio)}  contra  ${iconoDe(r.suyo)}`
      + (veredicto > 0 ? '  · ganas la ronda'
        : veredicto < 0 ? '  · la pierdes'
          : '  · empate');
    ctx.pato.animar(veredicto > 0 ? 'happy' : veredicto < 0 ? 'sad' : 'play', 1.1);

    pintar();

    if (misRondas >= RONDAS_PARA_GANAR) return acabar('victoria');
    if (susRondas >= RONDAS_PARA_GANAR) return acabar('derrota');

    // La ronda siguiente se abre YA, aunque aquí se esté leyendo el resultado.
    // Si se esperara a la pausa, el compromiso de un rival más rápido llegaría
    // sin nadie escuchando y se perdería: la sala ya lo habría confirmado.
    numeroDeRonda++;
    elegida = null;
    enPausa = true;
    empezarRonda();

    const parar = ctx.cadaCierto(() => {
      parar();
      if (terminada) return;
      enPausa = false;
      revelado.textContent = '';
      pintar();
    }, 1400);
  }

  function acabar(resultado, detalle) {
    terminada = true;
    if (ronda) ronda.destroy();
    pintar();
    ctx.pato.animar(resultado === 'victoria' ? 'happy' : 'sad', 1.4);
    ctx.alTerminar(detalle
      ? { resultado, detalle }
      : { resultado, detalle: `${misRondas} a ${susRondas}` });
  }

  // ---- Pintado -----------------------------------------------------------

  function pintar() {
    marcador.textContent = `Tú ${misRondas} · ${susRondas} ${nombreDelRival()}`;

    const esperando = !!ronda && ronda.esperando();
    for (const [id, b] of botones) {
      b.disabled = terminada || esperando || enPausa;
      b.classList.toggle('elegida', esperando && id === elegida);
    }

    if (terminada) { aviso.textContent = ''; return; }
    aviso.textContent = enPausa ? ''
      : esperando ? `Esperando a ${nombreDelRival()}…`
        : `Ronda ${numeroDeRonda} · elige`;
  }

  function nombreDelRival() {
    if (ctx.modo === 'solo') return 'tu mascota';
    return ctx.jugadores.find((n) => n !== ctx.yo) || 'tu rival';
  }
}

// ---- Lógica pura ---------------------------------------------------------

/** @returns {number} 1 si gana `a`, -1 si gana `b`, 0 si empatan */
export function compara(a, b) {
  if (a === b) return 0;
  return GANA_A[a] === b ? 1 : -1;
}

function iconoDe(id) {
  const op = OPCIONES.find((o) => o.id === id);
  return op ? op.icono : '?';
}
