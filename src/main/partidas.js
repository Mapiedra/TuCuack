'use strict';

// El historial de partidas por red, por el lado del escritorio.
//
// Una fila por partida terminada y por jugador: el juego, contra quién, cómo
// acabó, la marca y cuándo. Las jugadas NO se guardan, y no es un olvido: está
// razonado en `supabase/partidas.sql`, que es lectura obligatoria antes de tocar
// nada de aquí.
//
// Como el marcador, la firma se queda en este lado: el pato pide «apunta esta
// partida» y no ve el secreto (ver `supabaseRest.js`). Y a diferencia del
// marcador, LEER también exige el secreto: un marcador es público y un historial
// es de quien lo juega.
//
// Su gemelo en la extensión está en `extension/sw.js`.

const { pedir } = require('./supabaseRest.js');
const store = require('./store.js');

/** Cuántas se piden para el panel. El servidor recorta a su propio tope. */
const TOPE_FILAS = 40;

const RESULTADOS = ['victoria', 'derrota', 'empate'];

/**
 * Apunta una partida terminada.
 *
 * @param {{id:string, juego:string, rival:string, resultado:string,
 *          marca:number|null}} p
 *   `id` identifica la partida dentro de la sala, y es lo que hace que apuntar
 *   dos veces la misma no deje dos filas.
 */
async function guardar(p) {
  const secreto = store.secretoDelMarcador();
  if (!secreto) return { ok: false, error: 'sin-firma' };
  if (!p || !p.id || !p.juego || !RESULTADOS.includes(p.resultado)) {
    return { ok: false, error: 'partida-mala' };
  }

  const marca = (typeof p.marca === 'number' && Number.isFinite(p.marca))
    ? Math.max(0, Math.round(p.marca))
    : null;

  return pedir('/rest/v1/rpc/guardar_partida', {
    method: 'POST',
    body: JSON.stringify({
      p_secreto: secreto,
      p_id: String(p.id).slice(0, 80),
      p_juego: String(p.juego).slice(0, 40),
      p_rival: String(p.rival || 'Pato').slice(0, 40),
      p_resultado: p.resultado,
      p_marca: marca
    })
  });
}

/**
 * Las propias, de la más reciente a la más antigua.
 *
 * Sin secreto no devuelve nada, y eso no es un fallo: es la respuesta correcta
 * a pedir el historial de alguien de quien no se sabe el secreto.
 */
async function mias() {
  const secreto = store.secretoDelMarcador();
  if (!secreto) return { ok: false, error: 'sin-firma' };
  return pedir('/rest/v1/rpc/mis_partidas', {
    method: 'POST',
    body: JSON.stringify({ p_secreto: secreto, p_tope: TOPE_FILAS })
  });
}

module.exports = { guardar, mias };
