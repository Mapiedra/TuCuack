'use strict';

// Llamar a Supabase por HTTP desde el proceso principal.
//
// Con `fetch` a pelo y no con `supabase-js`: ese paquete exige un WebSocket para
// construirse aunque no se use Realtime, y en el proceso principal eso obliga a
// arrastrar `ws` y a esperar a los certificados del sistema (ver main/chat.js).
// Para leer una vista y llamar a un par de funciones eso sobra.
//
// Vive aquí y no en el núcleo por una razón de fondo: la firma con la que se
// escribe —el `recordSecreto` de los ajustes— no puede salir de la carcasa. El
// pato pide «guarda esto» y quien lo firma es este lado. Si el secreto viajara
// al renderer estaría también en la extensión, dentro de la página web de
// cualquiera.
//
// Lo usan `marcador.js` y `partidas.js`. Su gemelo en la extensión es
// `pedirAlMarcador` en extension/sw.js, por el mismo motivo por el que el chat
// está duplicado: cada carcasa habla con Supabase desde donde puede.

const config = require('./config.js');

/** Lo que se espera a que conteste. Nada de esto puede colgar una partida. */
const TOPE_MS = 8000;

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
 *
 * @param {string} ruta      desde la raíz del proyecto, empezando por `/rest/v1`
 * @param {object} opciones  lo que acepta `fetch`, sin cabeceras
 * @returns {Promise<{ok:boolean, datos?:any, error?:string}>}
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
    return {
      ok: false,
      error: err.name === 'AbortError' ? 'sin respuesta' : String(err.message || err)
    };
  } finally {
    clearTimeout(reloj);
  }
}

module.exports = { pedir };
