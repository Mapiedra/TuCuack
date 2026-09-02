// Qué se dicen dos patos para jugar una partida.
//
// Este fichero es puro: construye y valida mensajes, y no toca ni la red ni el
// DOM. Quien los manda es game/salas.js; quien los transporta, el canal de
// siempre (ver src/main/chat.js y src/extension/sw.js).
//
// Los mensajes van DIRIGIDOS, como las visitas: llevan la clave de presencia del
// destinatario y quien mantiene la conexión descarta lo que no es suyo antes de
// que llegue al pato. No hay "salas" que el canal entero tenga que filtrar.
//
// Postura sobre las trampas, dicha en voz alta: el canal es público y no hay
// servidor que arbitre. Se confía en el rival, se comprueba lo que sale barato
// (la secuencia, de quién es el turno, que la jugada quepa) y, cuando algo no
// cuadra, se DICE en vez de disimularlo. Es un juego entre amigos, no un torneo.

/**
 * Versión del protocolo.
 *
 * Sube cuando cambie la forma de cualquier mensaje. Es independiente de la
 * versión de la app: cambiar el color de un botón no rompe una partida.
 *
 * Dos patos con `pv` distinto no juegan, y se lo dicen. Vale mucho más un "no
 * puedo, llevas otra versión" que una partida que se queda a medias sin que
 * nadie sepa por qué.
 */
export const PV = 1;

// ---- Tiempos -------------------------------------------------------------

export const RETO_MS = 45000;            // lo que un reto espera respuesta
export const REENVIO_MS = 3000;          // cada cuánto se reintenta lo no confirmado
// Ocho intentos son casi medio minuto insistiendo. Parece mucho y no lo es: en
// un juego por turnos, un turno tarda más que eso, así que rendirse antes deja
// partidas colgadas que se habrían salvado solas. El tope existe para que la
// cosa no insista eternamente, no para cortar por lo sano.
export const REENVIOS_MAX = 8;
export const LATIDO_MS = 20000;          // "sigo aquí", lo manda quien tiene el turno
export const AUSENTE_MS = 90000;         // sin señales del rival
export const GRACIA_PRESENCIA_MS = 45000; // desaparecido de la lista de conectados
export const SUSPENSION_MAX_MS = 180000;  // con el canal caído, se da por perdida

/** Mensajes de juego por segundo que se permite emitir. El cliente Realtime
 *  admite 10 en total; se dejan 6 para el chat, que es lo que hay que proteger. */
export const RITMO_MAX = 4;

// ---- Tipos de mensaje ----------------------------------------------------

export const TIPOS = {
  RETO: 'reto',
  RESPUESTA: 'respuesta',
  INICIO: 'inicio',
  JUGADA: 'jugada',
  ACK: 'ack',
  PEDIR_SINCRO: 'pedir-sincro',
  SINCRO: 'sincro',
  LATIDO: 'latido',
  // "¿Otra?". Hace falta negociarla: si cada uno reiniciara su tablero por su
  // cuenta, uno se quedaría jugando solo mientras el otro mira el resultado.
  // Se reinicia cuando los DOS quieren; quien no quiera lo dice, para que el
  // otro no se quede esperando a alguien que ya se ha ido.
  REVANCHA: 'revancha',
  ABANDONO: 'abandono',
  FIN: 'fin'
};

/**
 * @typedef {Object} Sobre
 * @property {number} pv
 * @property {string} t       tipo (ver TIPOS)
 * @property {string} sala    identificador de la partida
 * @property {string} aClave  clave de presencia del destinatario
 * @property {string} [deClave] la pone el transporte
 * @property {string} [de]      identidad estable del emisor; la pone el transporte
 * @property {number} n       secuencia dentro de la sala (0 antes de empezar)
 * @property {string} mid     id del mensaje, para descartar duplicados
 * @property {object} d       datos propios del tipo
 */

/**
 * Construye un mensaje. `deClave`, `de` y `ts` los rellena el transporte, que es
 * quien sabe quiénes somos en el canal.
 *
 * @returns {Sobre}
 */
export function sobre(tipo, sala, aClave, datos, n = 0) {
  return {
    pv: PV,
    t: tipo,
    sala: String(sala),
    aClave: String(aClave),
    n: Number(n) || 0,
    mid: nuevoMid(),
    d: datos || {}
  };
}

/** Identificador de sala: lo estrena quien reta. */
export function nuevaSala() {
  return `s-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

function nuevoMid() {
  return Math.random().toString(36).slice(2, 11);
}

/**
 * ¿Es esto un mensaje de partida que podamos entender?
 *
 * Se comprueba de verdad y no por encima: lo que llega viene de otro ordenador,
 * de una versión que puede no ser la nuestra, y por un canal donde cualquiera
 * puede emitir.
 */
export function esValido(m) {
  if (!m || typeof m !== 'object') return false;
  if (m.pv !== PV) return false;
  if (typeof m.t !== 'string' || !Object.values(TIPOS).includes(m.t)) return false;
  if (typeof m.sala !== 'string' || !m.sala) return false;
  if (typeof m.mid !== 'string' || !m.mid) return false;
  if (typeof m.n !== 'number' || !Number.isFinite(m.n) || m.n < 0) return false;
  if (m.d != null && typeof m.d !== 'object') return false;
  return true;
}

/** ¿Es de una versión distinta de la nuestra? Merece decírselo al usuario. */
export function esDeOtraVersion(m) {
  return !!m && typeof m === 'object' && typeof m.pv === 'number' && m.pv !== PV;
}

// ---- Secretos: compromiso y revelación -----------------------------------
//
// Para el ahorcado (la palabra), hundir la flota (los barcos) y memoria (el
// mazo). El secreto NO viaja al empezar: viaja su hash. Al terminar se revela y
// cada uno comprueba que cuadra con lo que le prometieron.
//
// No impide hacer trampas —nada puede, sin un servidor— pero las deja en
// evidencia, que entre amigos es suficiente. Y protege del rival, no sólo de los
// mirones, que es más de lo que daría un canal privado.

/**
 * Sal de 16 bytes. Sin ella, un tablero de barcos tiene pocas disposiciones
 * plausibles y el compromiso se rompería con una tabla precalculada.
 */
export function sal() {
  const b = new Uint8Array(16);
  (globalThis.crypto || {}).getRandomValues
    ? globalThis.crypto.getRandomValues(b)
    : b.forEach((_, i) => { b[i] = Math.floor(Math.random() * 256); });
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash de un compromiso.
 *
 * Usa `crypto.subtle` donde está, que es lo normal: en el escritorio el
 * documento se carga desde `file://`, que Electron trata como contexto seguro, y
 * en el panel de la extensión también. Donde NO está es en el pato que vive
 * sobre una página `http://`, y por eso hay respaldo.
 *
 * El repaso honesto del respaldo: un FNV-1a de 128 bits **no** es
 * criptográficamente fuerte. Pero la amenaza real aquí no es alguien con
 * recursos, es un amigo cambiando sus barcos a mitad de partida; para eso basta,
 * y es infinitamente mejor que mandar los barcos en claro.
 *
 * @param {string} texto
 * @returns {Promise<string>}
 */
export async function compromiso(texto, algoritmo) {
  const s = String(texto);
  const sub = (globalThis.crypto || {}).subtle;
  if (algoritmo !== 'fnv' && sub && typeof sub.digest === 'function') {
    try {
      const datos = new TextEncoder().encode(s);
      const buf = await sub.digest('SHA-256', datos);
      return 'sha256:' + Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
    } catch { /* sin contexto seguro: se cae al respaldo */ }
  }
  return 'fnv:' + fnv128(s);
}

function fnv128(s) {
  // Cuatro acumuladores de 32 bits con semillas distintas: un FNV-1a corriente
  // daría 32 bits, y con tan pocos las colisiones dejan de ser teóricas.
  const semillas = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b];
  const acc = semillas.slice();
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    for (let k = 0; k < 4; k++) {
      acc[k] ^= c + k;
      acc[k] = Math.imul(acc[k], 0x01000193) >>> 0;
    }
  }
  return acc.map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('');
}

/** ¿El secreto revelado es el que se prometió? */
/**
 * ¿El secreto revelado es el que se prometió?
 *
 * Se recalcula con EL ALGORITMO QUE DICE EL COMPROMISO, no con el que use este
 * lado. Los dos extremos no tienen por qué poder lo mismo: `crypto.subtle` sólo
 * existe en contexto seguro, así que el pato de escritorio firma con sha256 y el
 * que vive sobre una página `http://` cae al respaldo. Recalculando con el
 * preferido de casa, NINGUNA partida entre esos dos cuadraba nunca: cada jugada
 * del otro se daba por trampa.
 */
export async function cumpleCompromiso(secreto, salt, prometido) {
  if (!prometido || typeof prometido !== 'string') return false;
  const algoritmo = prometido.startsWith('fnv:') ? 'fnv' : 'sha256';
  // Un sha256 no se puede comprobar sin `crypto.subtle`: mejor decir que no se
  // pudo verificar —lo que aquí es "no cuadra"— que fingir que sí.
  const calculado = await compromiso(`${salt}:${secreto}`, algoritmo);
  return calculado === prometido;
}
