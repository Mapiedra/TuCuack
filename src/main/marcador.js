'use strict';

// El marcador global, por el lado del escritorio.
//
// Cómo se habla con Supabase desde aquí —y por qué el secreto no sale de este
// lado— está en `supabaseRest.js`. Esto es sólo lo que el marcador pide.
//
// Su gemelo en la extensión está en `extension/sw.js`, por el mismo motivo por
// el que el chat está duplicado: cada carcasa habla con Supabase desde donde
// puede.

const { pedir } = require('./supabaseRest.js');
const store = require('./store.js');

/** Cuántos se piden para la tabla de un juego. */
const TOPE_FILAS = 20;

/**
 * Cuántas filas se traen para la vista de conjunto.
 *
 * La tabla entera de una vez, y a propósito: son diez filas hoy y agrupar por
 * juego en el pato sale mucho más barato que una petición por cada uno de los
 * trece juegos con marca. Cuando esto se quede corto se notará en que la vista
 * empieza a olvidar juegos poco jugados —vienen ordenadas por lo último que se
 * ha movido—, y ahí tocará una consulta que devuelva sólo el líder de cada uno.
 */
const TOPE_TODOS = 500;

/**
 * Los mejores de un juego.
 *
 * La dirección la dice quien pregunta, porque la sabe el catálogo: hay juegos
 * donde gana el número más alto y uno —el minigolf— donde gana el más bajo.
 *
 * @param {string} juego
 * @param {'mas'|'menos'} mejorEs
 * @returns {Promise<{ok:boolean, datos?:object[], error?:string}>}
 */
async function mejores(juego, mejorEs) {
  const orden = mejorEs === 'menos' ? 'marca.asc' : 'marca.desc';
  const ruta = `/rest/v1/records_publicos`
    + `?juego=eq.${encodeURIComponent(juego)}`
    + `&order=${orden}&limit=${TOPE_FILAS}`
    + `&select=nombre,marca,actualizado`;
  return pedir(ruta, { method: 'GET' });
}

/**
 * Todo el marcador de una vez, para la vista de conjunto.
 *
 * Sin filtrar por juego y ordenado por lo más reciente: el pato agrupa, elige
 * al líder de cada juego con la dirección que dice su catálogo —y no la de la
 * fila, que puede venir de cuando el juego puntuaba al revés— y descarta lo que
 * no reconozca.
 *
 * @returns {Promise<{ok:boolean, datos?:object[], error?:string}>}
 */
async function todos() {
  const ruta = '/rest/v1/records_publicos'
    + '?select=juego,nombre,marca,mejor_es,actualizado'
    + `&order=actualizado.desc&limit=${TOPE_TODOS}`;
  return pedir(ruta, { method: 'GET' });
}

/**
 * Manda una marca propia.
 *
 * El secreto lo pone este fichero, no quien llama. La función del servidor
 * decide si vale: crea la fila la primera vez, y después sólo la toca si la
 * marca mejora (ver supabase/records.sql).
 *
 * @param {{juego:string, nombre:string, marca:number, mejorEs:'mas'|'menos'}} r
 */
async function guardar(r) {
  const secreto = store.secretoDelMarcador();
  if (!secreto) return { ok: false, error: 'sin-firma' };
  if (!r || !r.juego || typeof r.marca !== 'number' || !Number.isFinite(r.marca)) {
    return { ok: false, error: 'marca-mala' };
  }

  return pedir('/rest/v1/rpc/guardar_record', {
    method: 'POST',
    body: JSON.stringify({
      p_secreto: secreto,
      p_juego: String(r.juego).slice(0, 40),
      p_nombre: String(r.nombre || 'Pato').slice(0, 40),
      p_marca: Math.max(0, Math.round(r.marca)),
      p_mejor_es: r.mejorEs === 'menos' ? 'menos' : 'mas'
    })
  });
}

module.exports = { mejores, todos, guardar };
