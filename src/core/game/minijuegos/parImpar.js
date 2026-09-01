// Par o impar. Como se ha jugado siempre: uno canta par, el otro se queda con
// impar, y los dos sacan un número a la vez. La suma decide.
//
// Dos decisiones distintas, y por eso el juego tiene dos fases:
//
//   1. Cantar. Es una sola vez por partida, y la canta el anfitrión —igual que
//      en la vida real canta uno y el otro se queda con lo que sobra—. Contra la
//      mascota cantas tú, que para eso es tu mascota.
//   2. Sacar número, de 0 a 5, a la vez y en secreto. Tres rondas, al mejor de
//      dos. Lo de "a la vez" lo resuelve rondaSimultanea.js.

import { crearRondaSimultanea } from './rondaSimultanea.js';
import { sembrar } from './azar.js';

const NUMEROS = [0, 1, 2, 3, 4, 5];
const RONDAS_PARA_GANAR = 2;   // al mejor de tres

// El mismo respiro que en piedra, papel o tijera: aquí encima hay una cuenta
// que leer, así que menos todavía valdría.
const PAUSA_MS = 2600;

/**
 * @param {import('./index.js').ContextoPartida} ctx
 * @returns {import('./index.js').Partida}
 */
export function crearPartida(ctx) {
  // Quien canta es el anfitrión. En solo, siempre tú.
  const cantoYo = ctx.modo === 'solo' ? true : !!ctx.anfitrion;

  /** 'par' | 'impar' | null mientras no se haya cantado. */
  let miApuesta = null;
  let misRondas = 0;
  let susRondas = 0;
  let numeroDeRonda = 1;
  let terminada = false;
  let ronda = null;
  let elegido = null;
  let enPausa = false;         // enseñando el resultado antes de la siguiente
  const azar = sembrar(ctx.semilla);

  const el = document.createElement('div');
  el.className = 'jpi';

  const marcador = document.createElement('p');
  marcador.className = 'jppt-marcador';
  el.appendChild(marcador);

  const aviso = document.createElement('p');
  aviso.className = 'jt-aviso';
  el.appendChild(aviso);

  // Fase 1: cantar.
  const canto = document.createElement('div');
  canto.className = 'btn-row';
  for (const cual of ['par', 'impar']) {
    const b = document.createElement('button');
    b.className = 'btn';
    b.type = 'button';
    b.textContent = cual === 'par' ? 'Pido par' : 'Pido impar';
    b.addEventListener('click', () => cantar(cual));
    canto.appendChild(b);
  }
  el.appendChild(canto);

  // Fase 2: los números.
  const fila = document.createElement('div');
  fila.className = 'jpi-numeros';
  el.appendChild(fila);

  /** @type {Map<number, HTMLButtonElement>} */
  const botones = new Map();
  for (const n of NUMEROS) {
    const b = document.createElement('button');
    b.className = 'jpi-numero';
    b.type = 'button';
    b.textContent = String(n);
    b.addEventListener('click', () => jugar(n));
    fila.appendChild(b);
    botones.set(n, b);
  }

  // La cuenta de la ronda, en grande y con su sitio reservado (ver el mismo
  // bloque en piedraPapelTijera.js).
  const revelado = document.createElement('div');
  revelado.className = 'jr-revelado';
  const cuenta = document.createElement('div');
  cuenta.className = 'jr-manos';
  const sumaEl = document.createElement('span');
  sumaEl.className = 'jr-suma';
  cuenta.appendChild(sumaEl);
  const veredictoEl = document.createElement('p');
  veredictoEl.className = 'jr-veredicto';
  revelado.append(cuenta, veredictoEl);
  el.appendChild(revelado);

  // Si canta el rival, hay que esperar a que lo diga.
  if (!cantoYo) escucharSuCanto();
  pintar();

  return {
    el,
    destroy() {
      terminada = true;
      if (ronda) ronda.destroy();
    }
  };

  // ---- Fase 1: cantar ----------------------------------------------------

  function cantar(cual) {
    if (miApuesta || terminada || !cantoYo) return;
    miApuesta = cual;
    if (ctx.sala) ctx.sala.enviar({ t: 'canto', apuesta: cual });
    empezarRonda();
  }

  /**
   * El canto del rival llega por la sala como una jugada más. Se escucha aparte
   * de las rondas: la ronda simultánea sólo entiende de compromisos y
   * revelaciones, y esto es anterior a todo eso.
   */
  function escucharSuCanto() {
    ctx.alDestruir(ctx.sala.alRecibir((jugada) => {
      if (terminada || miApuesta || !jugada || jugada.t !== 'canto') return;
      // Él canta, yo me quedo con lo que sobra.
      miApuesta = jugada.apuesta === 'par' ? 'impar' : 'par';
      empezarRonda();
    }));
  }

  // ---- Fase 2: los números -----------------------------------------------

  function empezarRonda() {
    if (terminada) return;
    if (ronda) ronda.destroy();
    ronda = crearRondaSimultanea(ctx, {
      eligeLaMascota: () => NUMEROS[Math.floor(azar() * NUMEROS.length)],
      alResolver: resolverRonda
    });
    pintar();
  }

  function jugar(n) {
    if (terminada || !miApuesta || !ronda || ronda.esperando()) return;
    elegido = n;
    ronda.elegir(n);
    pintar();
  }

  function resolverRonda(r) {
    if (terminada) return;

    if (r.tramposo) {
      acabar('victoria', `${nombreDelRival()} cambió su número. Partida anulada.`);
      return;
    }
    if (r.plantado) {
      acabar('victoria', `${nombreDelRival()} no llegó a enseñar su número.`);
      return;
    }

    const suma = r.mio + r.suyo;
    const salio = suma % 2 === 0 ? 'par' : 'impar';
    const gano = salio === miApuesta;
    if (gano) misRondas++; else susRondas++;

    sumaEl.textContent = `${r.mio} + ${r.suyo} = ${suma}`;
    veredictoEl.textContent = `Salió ${salio} · ${gano ? 'tu ronda' : 'la suya'}`;
    veredictoEl.className = 'jr-veredicto ' + (gano ? 'gana' : 'pierde');
    revelado.classList.add('visible');
    ctx.pato.animar(gano ? 'happy' : 'sad', 1.1);

    pintar();

    if (misRondas >= RONDAS_PARA_GANAR) return acabar('victoria');
    if (susRondas >= RONDAS_PARA_GANAR) return acabar('derrota');

    // Igual que en piedra-papel-tijera: la ronda siguiente se abre ya, para no
    // perder el compromiso de un rival que vaya por delante.
    numeroDeRonda++;
    elegido = null;
    enPausa = true;
    empezarRonda();

    const parar = ctx.cadaCierto(() => {
      parar();
      if (terminada) return;
      enPausa = false;
      revelado.classList.remove('visible');
      pintar();
    }, PAUSA_MS);
  }

  function acabar(resultado, detalle) {
    terminada = true;
    if (ronda) ronda.destroy();
    pintar();
    ctx.pato.animar(resultado === 'victoria' ? 'happy' : 'sad', 1.4);
    ctx.alTerminar(detalle
      ? { resultado, detalle }
      : { resultado, detalle: `${misRondas} a ${susRondas} llevando ${miApuesta}` });
  }

  // ---- Pintado -----------------------------------------------------------

  function pintar() {
    const hayCanto = !!miApuesta;
    canto.hidden = hayCanto;
    fila.hidden = !hayCanto;

    marcador.textContent = hayCanto
      ? `Llevas ${miApuesta} · ${misRondas} a ${susRondas}`
      : '';

    const esperando = !!ronda && ronda.esperando();
    for (const [n, b] of botones) {
      b.disabled = terminada || !hayCanto || esperando || enPausa;
      b.classList.toggle('elegida', esperando && n === elegido);
    }

    if (terminada) { aviso.textContent = ''; return; }
    if (!hayCanto) {
      aviso.textContent = cantoYo
        ? '¿Qué pides? El otro se queda con lo que sobra.'
        : `Esperando a que ${nombreDelRival()} pida…`;
      return;
    }
    aviso.textContent = enPausa ? ''
      : esperando ? `Esperando a ${nombreDelRival()}…`
        : `Ronda ${numeroDeRonda} · saca un número`;
  }

  function nombreDelRival() {
    if (ctx.modo === 'solo') return 'tu mascota';
    return ctx.jugadores.find((n) => n !== ctx.yo) || 'tu rival';
  }
}
