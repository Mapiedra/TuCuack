'use strict';

// El monedero, por el lado del escritorio.
//
// Lectura previa obligatoria: `supabase/cuacks.sql`, que es donde está razonado
// lo importante. El resumen, en tres frases:
//
//   * El libro mayor vive en Supabase. Lo que hay en `pet-state.json` es una
//     copia para poder enseñar algo sin conexión, no la verdad.
//   * El pato NO declara cuántos cuacks ha ganado: declara qué partida ha
//     jugado. El importe lo calcula el servidor con su propio catálogo. Esa es
//     toda la diferencia entre esto y guardar el saldo en la nube.
//   * La firma se queda en este lado, como en el marcador y en el historial: el
//     núcleo pide «apunta esta partida» y no ve nunca el secreto.
//
// Su gemelo en la extensión está en `extension/sw.js`, por el mismo motivo por
// el que el chat está duplicado: cada carcasa habla con Supabase desde donde
// puede.

const { pedir } = require('./supabaseRest.js');
const store = require('./store.js');

const RESULTADOS = ['victoria', 'derrota', 'empate'];

/**
 * Llama a una función del monedero y devuelve lo que conteste.
 *
 * Todas las de `cuacks.sql` devuelven la misma forma —`{ok, motivo, cuacks,
 * saldo, ganado, comprados, diaDeLaBroma, existe}`— para que el pato tenga UN
 * solo sitio donde leer la respuesta, y el saldo que pinta sea siempre el que
 * acaba de decir el servidor pase lo que pase con la operación.
 *
 * El secreto lo pone este fichero, nunca quien llama.
 */
async function rpc(nombre, cuerpo) {
  const secreto = store.secretoDelMarcador();
  if (!secreto) return { ok: false, error: 'sin-firma' };

  const res = await pedir(`/rest/v1/rpc/${nombre}`, {
    method: 'POST',
    body: JSON.stringify({ p_secreto: secreto, ...cuerpo })
  });
  if (!res.ok) return res;

  // `ok: false` con motivo es una respuesta, no un fallo de red, y la diferencia
  // importa: de un «no te llega» no hay que reintentar, de un «sin respuesta»
  // sí. Por eso el motivo sube tal cual y el `ok` de fuera dice si se ha
  // hablado con el servidor, no si la operación salió como se quería.
  return { ok: true, datos: res.datos || null };
}

/** El monedero propio, tal y como está en el servidor. */
async function mios() {
  return rpc('mis_cuacks', {});
}

/**
 * Crea el monedero con lo que hubiera en el disco.
 *
 * Se llama SIEMPRE al arrancar, no sólo la primera vez: si la fila ya existe, el
 * servidor la devuelve sin tocarla (ver `estrenar_cuacks`). Así el pato no tiene
 * que llevar la cuenta de si ya se estrenó, que es justo la clase de bandera que
 * se queda mal puesta cuando algo falla a medias.
 *
 * @param {{saldo:number, ganado:number, comprados:string[], diaDeLaBroma:string}} local
 */
async function estrenar(local) {
  const l = local && typeof local === 'object' ? local : {};
  return rpc('estrenar_cuacks', {
    p_saldo: entero(l.saldo),
    p_ganado: entero(l.ganado),
    p_comprados: Array.isArray(l.comprados)
      ? l.comprados.filter((x) => typeof x === 'string').slice(0, 200)
      : [],
    p_dia_broma: typeof l.diaDeLaBroma === 'string' ? l.diaDeLaBroma : ''
  });
}

/**
 * Apunta una partida terminada para que la pague el servidor.
 *
 * `id` es lo que hace que reintentarla no la cobre dos veces, y el pato SIEMPRE
 * reintenta: lo que se juega sin conexión se queda en una cola y sale al volver.
 *
 * @param {{id:string, juego:string, resultado:string, enRed:boolean}} p
 */
async function apuntarPartida(p) {
  if (!p || !p.id || !p.juego || !RESULTADOS.includes(p.resultado)) {
    return { ok: false, error: 'partida-mala' };
  }
  return rpc('apuntar_partida_cuacks', {
    p_partida: String(p.id).slice(0, 80),
    p_juego: String(p.juego).slice(0, 40),
    p_resultado: p.resultado,
    p_en_red: !!p.enRed
  });
}

/** Compra un juego. El precio lo pone el catálogo del servidor, no el mensaje. */
async function comprar(juegoId) {
  if (!juegoId) return { ok: false, error: 'juego-malo' };
  return rpc('comprar_juego', { p_juego: String(juegoId).slice(0, 40) });
}

/** Cobra el peaje de la broma del «No tocar». Una vez al día, lo mira el SQL. */
async function cobrarBroma(nivel) {
  return rpc('cobrar_broma', { p_nivel: entero(nivel) });
}

/** Tira el monedero propio. No tiene vuelta: se van los cuacks y lo comprado. */
async function borrar() {
  return rpc('borrar_mis_cuacks', {});
}

function entero(v) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

module.exports = { mios, estrenar, apuntarPartida, comprar, cobrarBroma, borrar };
