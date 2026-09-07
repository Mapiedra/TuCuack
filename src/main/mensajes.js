'use strict';

// Mensajes privados entre patos, por el lado del escritorio.
//
// A diferencia del chat, esto NO va por el canal de Realtime: va a una tabla, y
// se lee pidiéndola. Un privado tiene que llegar aunque el otro no estuviera
// conectado, y un broadcast no se guarda en ninguna parte.
//
// Lo que hay que leer antes de tocar nada de aquí es `supabase/mensajes.sql`,
// donde está por qué la dirección de un pato es el hash de su secreto, por qué
// el tope por minuto y la lista de bloqueados van DENTRO de la función del
// servidor y no aquí, y qué se guarda y durante cuánto.
//
// Como el marcador y el historial de partidas, la firma se queda en este lado:
// el pato pide «mándale esto a esa dirección» y no ve el secreto (ver
// `supabaseRest.js`). Y leer también lo exige: una conversación es de los dos
// que la tienen.
//
// Su gemelo en la extensión está en `extension/sw.js`.

const { pedir } = require('./supabaseRest.js');
const store = require('./store.js');

/** Cuántos mensajes se traen de una conversación al abrirla. */
const TOPE_MENSAJES = 100;
/** Cuántas conversaciones se listan. */
const TOPE_HILOS = 30;

const DIRECCION = /^[0-9a-f]{64}$/;

function rpc(fn, cuerpo) {
  const secreto = store.secretoDelMarcador();
  if (!secreto) return Promise.resolve({ ok: false, error: 'sin-firma' });
  return pedir(`/rest/v1/rpc/${fn}`, {
    method: 'POST',
    body: JSON.stringify({ p_secreto: secreto, ...cuerpo })
  });
}

/**
 * Manda un privado.
 *
 * `mid` lo pone el pato, el mismo identificador que ya usa el chat: así reenviar
 * no deja dos filas y lo que llega por el canal no se apunta dos veces.
 *
 * Ojo con la respuesta: `enviado` NO significa que el otro lo vaya a leer. Si te
 * tiene bloqueado, el servidor contesta lo mismo a propósito, para no convertir
 * esto en un detector de bloqueos (ver supabase/mensajes.sql).
 */
async function enviar({ para, mid, texto, nombre }) {
  if (!DIRECCION.test(String(para || ''))) return { ok: false, error: 'destino-malo' };
  const limpio = String(texto || '').slice(0, 280);
  if (!limpio.trim()) return { ok: false, error: 'vacio' };
  return rpc('enviar_mensaje', {
    p_para: String(para),
    p_mid: String(mid || '').slice(0, 40),
    p_texto: limpio,
    // Con qué nombre firmas. Es lo que hace que al otro le salga tu nombre en la
    // lista de conversaciones y no un hash.
    p_nombre: String(nombre || '').slice(0, 40)
  });
}

/** Una conversación, de la más reciente a la más antigua. */
async function leer(con, tope) {
  if (!DIRECCION.test(String(con || ''))) return { ok: false, error: 'destino-malo' };
  return rpc('leer_mensajes', {
    p_con: String(con),
    p_tope: Math.min(Math.max(Number(tope) || TOPE_MENSAJES, 1), TOPE_MENSAJES)
  });
}

/** Con quién tienes conversación, con lo último que se dijo en cada una. */
async function conversaciones() {
  return rpc('mis_conversaciones', { p_tope: TOPE_HILOS });
}

/** Bloquear a alguien, o dejar de hacerlo. */
async function bloquear(a, bloquear_ = true) {
  if (!DIRECCION.test(String(a || ''))) return { ok: false, error: 'destino-malo' };
  return rpc('bloquear', { p_a: String(a), p_bloquear: !!bloquear_ });
}

/** A quién tienes bloqueado. */
async function bloqueados() {
  return rpc('mis_bloqueos', {});
}

/**
 * Borra TODOS tus privados, los que mandaste y los que te mandaron.
 *
 * Existe porque tiene que existir: si se guardan conversaciones, tiene que haber
 * una forma de deshacerlo sin pedírselo a nadie.
 */
async function borrarTodo() {
  return rpc('borrar_mis_mensajes', {});
}

module.exports = { enviar, leer, conversaciones, bloquear, bloqueados, borrarTodo };
