// Histórico del chat: lo que se ha dicho, y hasta dónde se ha leído.
//
// Los bocadillos duran unos segundos y se van; si en ese rato no estabas
// mirando, el mensaje se perdía para siempre. Aquí se guardan, para poder
// leerlos desde el panel del chat.
//
// Ya no vive sólo en memoria: se guarda donde diga la carcasa (ver
// `historial` en platform.js). En el escritorio va a un fichero propio; en la
// extensión, al almacenamiento del navegador que mantiene el service worker.
// Cambia lo que se puede prometer: antes el histórico moría al cerrar el pato,
// y ahora sobrevive. Lo que NO cambia es el límite de fondo: los mensajes
// viajan por broadcast y no se guardan en ningún servidor, así que lo dicho
// mientras el pato estaba apagado no lo tiene nadie.
//
// Cada mensaje lleva `mid`, su identificador. Sirve para lo único que de
// verdad hace falta aquí —no apuntar dos veces el mismo mensaje— y viaja ya en
// el broadcast pensando en la tabla de mensajes que vendrá después: sin él, un
// pato que reciba el mensaje Y lo cargue del histórico lo vería repetido.
// Contra un pato viejo, que no lo manda, se usa la terna (ts, quién, texto),
// que es igual de exacta y no exige que la otra punta se actualice.

/** Cuántos mensajes se recuerdan. */
export const TOPE = 2000;

/**
 * Margen de reloj que se le tolera a un mensaje ajeno.
 *
 * El `ts` lo pone quien envía, y en este canal cualquiera puede poner lo que
 * quiera. Un mensaje fechado en el futuro no sólo se vería con una hora
 * absurda: al marcar todo como leído arrastraría la marca hasta esa fecha y
 * dejaría por leídos mensajes que aún no han llegado.
 */
const FUTURO_TOLERADO = 5 * 60 * 1000;

/** @type {Mensaje[]} */
let mensajes = [];
/** Hasta qué instante está leído el histórico. */
let leidoHasta = 0;
/** Las claves de los mensajes que ya están apuntados (ver `claveDe`). */
let vistos = new Set();
/** Dónde se guarda todo esto. Lo instala `arrancar`. */
let almacen = null;

const oyentes = new Set();

/**
 * @typedef {{mid:string, from:string, text:string, ts:number, propio:boolean,
 *            fallo?:boolean}} Mensaje
 */

/** Un identificador nuevo para un mensaje que nace aquí. */
export function nuevoMid() {
  return `m-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-6)}`;
}

/**
 * Carga el histórico guardado y deja instalado dónde se escribe.
 *
 * @param {import('../platform.js').Plataforma['historial']} donde
 */
export async function arrancar(donde) {
  almacen = donde || null;
  let guardado = null;
  try {
    guardado = almacen ? await almacen.cargar() : null;
  } catch (err) {
    // Un histórico que no se puede leer no es motivo para dejar al pato sin
    // chat: se arranca vacío y se sigue apuntando.
    console.warn('[chat] no se pudo cargar el histórico:', err);
  }
  mensajes = normalizarLista(guardado && guardado.mensajes);
  leidoHasta = instante(guardado && guardado.leidoHasta);
  vistos = new Set(mensajes.map(claveDe));
  avisar();
}

/**
 * Apunta un mensaje. Si ya estaba, no hace nada: se llama desde los dos sitios
 * que pueden enterarse de él (el pato y, en la extensión, el service worker).
 * @param {Partial<Mensaje>} m
 */
export function anadir(m) {
  const msg = normalizar(m);
  if (vistos.has(claveDe(msg))) return;
  vistos.add(claveDe(msg));
  mensajes.push(msg);
  recortar();
  if (almacen) almacen.anotar(msg);
  avisar();
}

/**
 * Mete en el histórico una lista que viene de fuera, sin repetir lo que ya
 * hubiera. No se guarda nada: lo que llega por aquí sale del propio almacén (o
 * de una sonda), y volver a escribirlo no añadiría nada.
 * @param {Partial<Mensaje>[]} lista
 */
export function sembrar(lista) {
  if (!Array.isArray(lista)) return;
  let algo = false;
  for (const m of lista) {
    const msg = normalizar(m);
    if (vistos.has(claveDe(msg))) continue;
    vistos.add(claveDe(msg));
    mensajes.push(msg);
    algo = true;
  }
  if (!algo) return;
  // Lo sembrado puede ser anterior a lo que ya había: el orden es por hora, no
  // por llegada.
  mensajes.sort((a, b) => a.ts - b.ts);
  recortar();
  avisar();
}

/** Los mensajes, del más antiguo al más reciente. */
export function todos() {
  return mensajes;
}

/** Cuántos mensajes ajenos hay sin leer. */
export function noLeidos() {
  let n = 0;
  for (const m of mensajes) if (!m.propio && m.ts > leidoHasta) n++;
  return n;
}

/**
 * Hasta dónde estaba leído.
 *
 * El panel lo pide UNA vez al abrirse y se queda con ese corte para pintar la
 * raya de "nuevos": si mirara el valor de verdad, marcar como leído haría
 * desaparecer la raya en el mismo momento de enseñarla.
 */
export function corteDeLectura() {
  return leidoHasta;
}

/** Da por leído todo lo que hay ahora mismo. */
export function marcarTodoLeido() {
  // Hasta el último mensaje, no hasta `Date.now()`: las horas las ponen los
  // demás y no tienen por qué coincidir con la de aquí.
  let tope = leidoHasta;
  for (const m of mensajes) if (m.ts > tope) tope = m.ts;
  if (tope === leidoHasta) return;
  leidoHasta = tope;
  if (almacen) almacen.marcarLeido(tope);
  avisar();
}

/** Escucha los cambios. Devuelve la función para dejar de escuchar. */
export function alCambiar(cb) {
  oyentes.add(cb);
  return () => oyentes.delete(cb);
}

/**
 * La clave con la que se reconoce un mensaje ya apuntado.
 *
 * Con `mid` es exacta. Sin él —lo manda un pato anterior a esto— la terna
 * (hora, quién, texto) lo es igual: haría falta que el mismo pato dijera lo
 * mismo en el mismo milisegundo para confundir dos mensajes distintos.
 *
 * RETIRAR el camino sin `mid`: cuando ningún pato en circulación mande mensajes
 * sin identificador. No corre prisa —cuesta una rama de nada— y hasta entonces
 * es lo único que evita ver repetido lo que dice un pato viejo.
 */
function claveDe(m) {
  return m.mid ? `i:${m.mid}` : `t:${m.ts}|${m.from}|${m.text}`;
}

function normalizar(m) {
  const msg = m || {};
  return {
    mid: String(msg.mid || '').slice(0, 40),
    from: String(msg.from || 'Pato').slice(0, 80),
    text: String(msg.text || ''),
    ts: instante(msg.ts) || Date.now(),
    propio: !!msg.propio,
    fallo: !!msg.fallo
  };
}

function normalizarLista(lista) {
  if (!Array.isArray(lista)) return [];
  const fuera = new Set();
  const out = [];
  for (const m of lista.slice(-TOPE)) {
    const msg = normalizar(m);
    const clave = claveDe(msg);
    if (fuera.has(clave)) continue;   // un guardado anterior pudo repetir
    fuera.add(clave);
    out.push(msg);
  }
  return out;
}

/** Una hora que se pueda usar, con el reloj ajeno bajo control. */
function instante(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const ahora = Date.now();
  return n > ahora + FUTURO_TOLERADO ? ahora : n;
}

function recortar() {
  if (mensajes.length <= TOPE) return;
  const sobran = mensajes.splice(0, mensajes.length - TOPE);
  for (const m of sobran) vistos.delete(claveDe(m));
}

function avisar() {
  for (const cb of oyentes) cb(mensajes);
}
