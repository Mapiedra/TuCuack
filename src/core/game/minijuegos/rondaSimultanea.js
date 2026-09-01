// Rondas en las que los dos eligen a la vez y en secreto.
//
// Piedra-papel-tijera y par o impar tienen el mismo problema: si mando mi
// jugada antes que el otro, el otro la ve y gana siempre. Y por el canal no
// se puede "enviar a la vez": la sala lleva UN contador de secuencia, así que
// dos envíos simultáneos se pisan —los dos suben a la misma `n` y cada lado
// descarta la del otro por "ya aplicada", encima confirmándola—.
//
// La solución es la de siempre para esto: compromiso y revelación. Primero cada
// uno manda el HASH de su jugada (que no dice nada), y sólo cuando los dos están
// comprometidos se revelan los valores. Quien cambie su jugada al revelar no
// cuadra con el hash que prometió, y se le ve.
//
// Y como el canal alterna, el intercambio también:
//
//   1. anfitrión → compromiso        3. anfitrión → revelación
//   2. invitado  → compromiso        4. invitado  → revelación
//
// Queda una rendija, y conviene decirla en voz alta: el invitado ve la
// revelación del anfitrión antes de mandar la suya. No puede CAMBIARLA —está
// comprometido— pero sí puede callarse y dejar la ronda colgada si ve que
// pierde. Por eso hay un plazo: quien no revela a tiempo, pierde la ronda. Es
// la respuesta estándar, y entre amigos sobra.
//
// En modo solo no hay nada de esto: la mascota elige y se resuelve al momento.

import { compromiso, sal, cumpleCompromiso } from '../protocolo.js';

/** Lo que se espera a que el otro revele antes de darlo por rendido. */
export const PLAZO_REVELACION_MS = 25000;

/**
 * @typedef {Object} Resultado
 * @property {*} mio            lo que elegí
 * @property {*} suyo           lo que eligió el rival
 * @property {boolean} tramposo  el rival reveló algo que no cuadra con su hash
 * @property {boolean} plantado  el rival no llegó a revelar
 */

/**
 * @param {import('./index.js').ContextoPartida} ctx
 * @param {Object} opciones
 * @param {() => *} opciones.eligeLaMascota  qué juega la mascota en modo solo
 * @param {(r: Resultado) => void} opciones.alResolver
 * @returns {{elegir:(valor:*)=>void, esperando:()=>boolean, destroy:Function}}
 */
export function crearRondaSimultanea(ctx, { eligeLaMascota, alResolver }) {
  const enRed = ctx.modo === 'turnos' && !!ctx.sala;
  const primero = !!ctx.anfitrion;   // quién abre cada fase

  let miValor = null;
  let miSal = '';
  let miHash = '';
  let mandeCompromiso = false;
  let mandeRevelacion = false;

  let suCompromiso = null;
  let suValor = null;
  let suSal = '';

  let resuelta = false;
  let vivo = true;
  let pararPlazo = null;

  let bajaDelOyente = null;
  if (enRed) {
    bajaDelOyente = ctx.sala.alRecibir((jugada) => {
      if (!vivo || resuelta || !jugada) return;
      if (jugada.t === 'compromiso') {
        suCompromiso = String(jugada.hash || '');
        avanzar();
      } else if (jugada.t === 'revelacion') {
        suValor = jugada.valor;
        suSal = String(jugada.sal || '');
        avanzar();
      }
    });
    ctx.alDestruir(() => { if (bajaDelOyente) bajaDelOyente(); });
  }

  ctx.alDestruir(() => { vivo = false; });

  return {
    elegir,
    esperando: () => miValor !== null && !resuelta,
    destroy() {
      vivo = false;
      if (pararPlazo) { pararPlazo(); pararPlazo = null; }
      // Se da de baja del canal: si no, cada ronda dejaría su oyente puesto y
      // al final de una partida habría tantos como rondas se hayan jugado.
      if (bajaDelOyente) { bajaDelOyente(); bajaDelOyente = null; }
    }
  };

  /** El usuario ha elegido. A partir de aquí ya no puede cambiar. */
  function elegir(valor) {
    if (miValor !== null || resuelta) return;
    miValor = valor;

    if (!enRed) {
      // Contra la mascota no hace falta ceremonia: elige y se resuelve.
      resolver({ mio: miValor, suyo: eligeLaMascota(), tramposo: false, plantado: false });
      return;
    }

    miSal = sal();
    compromiso(`${miSal}:${JSON.stringify(miValor)}`).then((h) => {
      if (!vivo || resuelta) return;
      miHash = h;
      avanzar();
    });
  }

  /**
   * Manda lo que toque, si toca. Se llama en cada cambio de estado y decide
   * mirando lo que ya hay, así que da igual en qué orden lleguen las cosas.
   */
  function avanzar() {
    if (!vivo || resuelta || !miHash) return;

    // Fase 1: el compromiso. El anfitrión abre; el invitado contesta.
    if (!mandeCompromiso && (primero || suCompromiso)) {
      mandeCompromiso = true;
      ctx.sala.enviar({ t: 'compromiso', hash: miHash });
    }
    if (!mandeCompromiso || !suCompromiso) return;

    // Fase 2: la revelación, con los dos ya comprometidos.
    if (!mandeRevelacion && (primero || suValor !== null)) {
      mandeRevelacion = true;
      ctx.sala.enviar({ t: 'revelacion', valor: miValor, sal: miSal });
      // El anfitrión revela primero, así que es el que puede quedarse esperando
      // a alguien que ha visto que pierde y se calla.
      if (primero) armarPlazo();
    }
    if (suValor === null) return;

    comprobarYResolver();
  }

  /**
   * El plazo para revelar. Va con `cadaCierto` porque es lo único que da el
   * contrato, pero es de una sola vez: se para en cuanto salta.
   */
  function armarPlazo() {
    if (pararPlazo) return;
    pararPlazo = ctx.cadaCierto(() => {
      if (pararPlazo) { pararPlazo(); pararPlazo = null; }
      if (resuelta) return;
      resolver({ mio: miValor, suyo: null, tramposo: false, plantado: true });
    }, PLAZO_REVELACION_MS);
  }

  async function comprobarYResolver() {
    const limpio = await cumpleCompromiso(JSON.stringify(suValor), suSal, suCompromiso);
    if (!vivo || resuelta) return;
    resolver({ mio: miValor, suyo: suValor, tramposo: !limpio, plantado: false });
  }

  function resolver(r) {
    if (resuelta) return;
    resuelta = true;
    if (pararPlazo) { pararPlazo(); pararPlazo = null; }
    alResolver(r);
  }
}
