// Histórico del chat de esta sesión.
//
// Los bocadillos duran unos segundos y se van; si en ese rato no estabas
// mirando, el mensaje se perdía para siempre. Aquí se guardan los últimos, para
// poder leerlos desde el panel de Hablar.
//
// Vive en memoria y punto: ni fichero, ni base de datos, ni almacenamiento del
// navegador. Se vacía solo al cerrar el pato, que es lo que se quiere de un
// histórico "de sesión".
//
// En la extensión de Chrome el pato se muda de pestaña y cada página es un
// documento nuevo, así que este módulo empezaría de cero en cada mudanza: por
// eso el service worker guarda su propia copia y la manda al llegar (ver
// `sembrar` y src/extension/sw.js).

/** Cuántos mensajes se recuerdan. Con más, el panel deja de ser útil. */
export const TOPE = 50;

let mensajes = [];
const oyentes = new Set();

/**
 * @typedef {{from:string, text:string, ts:number, propio:boolean,
 *            fallo?:boolean}} Mensaje
 */

/** @param {Mensaje} m */
export function anadir(m) {
  mensajes.push({
    from: String(m.from || 'Pato'),
    text: String(m.text || ''),
    ts: m.ts || Date.now(),
    propio: !!m.propio,
    fallo: !!m.fallo
  });
  if (mensajes.length > TOPE) mensajes = mensajes.slice(-TOPE);
  avisar();
}

/**
 * Reemplaza el histórico con el que llega de fuera (el del service worker de la
 * extensión). Reemplaza en vez de sumar a propósito: el puente se puede volver a
 * abrir varias veces sobre el mismo documento —cada vez que Chrome despierta al
 * worker— y sumando saldrían los mensajes repetidos.
 * @param {Mensaje[]} lista
 */
export function sembrar(lista) {
  if (!Array.isArray(lista)) return;
  mensajes = lista.slice(-TOPE).map((m) => ({
    from: String(m.from || 'Pato'),
    text: String(m.text || ''),
    ts: m.ts || Date.now(),
    propio: !!m.propio,
    fallo: !!m.fallo
  }));
  avisar();
}

/** Los mensajes, del más antiguo al más reciente. */
export function todos() {
  return mensajes;
}

/** Escucha los cambios. Devuelve la función para dejar de escuchar. */
export function alCambiar(cb) {
  oyentes.add(cb);
  return () => oyentes.delete(cb);
}

function avisar() {
  for (const cb of oyentes) cb(mensajes);
}
