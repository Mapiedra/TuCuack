'use strict';

// El marcador global, por el lado del escritorio.
//
// Dos llamadas HTTP y nada más, así que va con `fetch` a pelo y no con
// `supabase-js`: ese paquete exige un WebSocket para construirse aunque no se
// use Realtime, y en el proceso principal eso obliga a arrastrar `ws` y a
// esperar a los certificados del sistema (ver main/chat.js). Para leer una vista
// y llamar a una función eso sobra.
//
// Vive AQUÍ y no en el núcleo por una razón de fondo: la firma con la que se
// escribe en el marcador no puede salir de la carcasa. El pato pide «guarda esta
// marca» y quien la firma es este fichero. Si el secreto viajara al renderer
// estaría también en la extensión, dentro de la página web de cualquiera.
//
// Su gemelo en la extensión está en `extension/sw.js`, por el mismo motivo por
// el que el chat está duplicado: cada carcasa habla con Supabase desde donde
// puede.

const config = require('./config.js');
const store = require('./store.js');

/** Lo que se espera a que conteste. Un marcador no puede colgar la partida. */
const TOPE_MS = 8000;

/** Cuántos se piden para la tabla de un juego. */
const TOPE_FILAS = 20;

function cabeceras() {
  return {
    apikey: config.SUPABASE_KEY,
    Authorization: `Bearer ${config.SUPABASE_KEY}`,
    'Content-Type': 'application/json'
  };
}

/**
 * Llama y se rinde a tiempo.
 *
 * Devuelve `{ok, datos, error}` en vez de lanzar: quien lo llama es el pato en
 * mitad de una partida, y ahí una excepción sin dueño se lleva por delante algo
 * que sí importaba.
 */
async function pedir(ruta, opciones) {
  if (!config.isConfigured()) return { ok: false, error: 'sin-credenciales' };

  const corta = new AbortController();
  const reloj = setTimeout(() => corta.abort(), TOPE_MS);
  try {
    const res = await fetch(`${config.SUPABASE_URL}${ruta}`, {
      ...opciones,
      headers: cabeceras(),
      signal: corta.signal
    });
    const texto = await res.text();
    if (!res.ok) return { ok: false, error: `${res.status} ${texto.slice(0, 120)}` };
    return { ok: true, datos: texto ? JSON.parse(texto) : null };
  } catch (err) {
    return { ok: false, error: err.name === 'AbortError' ? 'sin respuesta' : String(err.message || err) };
  } finally {
    clearTimeout(reloj);
  }
}

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

module.exports = { mejores, guardar };
