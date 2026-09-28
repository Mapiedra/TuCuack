'use strict';

const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const identidad = require('./identidad.js');

// Ficheros JSON en la carpeta de datos del usuario.
function userDataDir() {
  return app.getPath('userData');
}

function filePath(name) {
  return path.join(userDataDir(), name);
}

function readJson(name, fallback) {
  try {
    const raw = fs.readFileSync(filePath(name), 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(name, data) {
  try {
    fs.mkdirSync(userDataDir(), { recursive: true });
    fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    // No bloqueamos la app por un fallo de guardado.
    console.error('[store] error guardando', name, err);
  }
}

const STATE_FILE = 'pet-state.json';
const SETTINGS_FILE = 'settings.json';

// OJO: `load` y `save` son listas blancas, no un volcado del objeto entero. Un
// campo nuevo del estado que no se añada a las TRES listas (aquí, en `load` y en
// `save`) se pierde en silencio, y sólo en el escritorio: en la extensión y en
// el banco de pruebas se guarda el objeto tal cual y parecería que funciona.
const DEFAULT_STATE = {
  stats: { hunger: 80, energy: 80, hygiene: 80, happiness: 80 },
  // Experiencia y racha de días (ver core/game/Level.js).
  level: {
    xp: 0, racha: 0, ultimoDia: "",
    diaDelChat: "", chatHoy: 0,
    diaDelJuego: "", juegosHoy: 0
  },
  // Partidas, victorias y récords de cada minijuego, por id
  // (ver core/game/minijuegos/progreso.js).
  minijuegos: {},
  // El monedero: saldo, ganado en total, juegos comprados y el día que se cobró
  // la broma (ver core/game/cuacks.js). `null` y no `{}` a propósito: la cartera
  // distingue «no existía» de «existía vacía» para saber si tiene que estrenarse
  // con la bienvenida de quien ya venía jugando.
  cuacks: null,
  // Dónde estaba el pato, como proporción del ancho disponible (ver core/app.js).
  x: null,
  savedAt: 0
};

const DEFAULT_SETTINGS = {
  displayName: '',
  autoLaunch: false,
  skin: 'normal',       // diseño de pato elegido (core/game/skins.js)
  volumen: 0.5,
  silenciado: false,
  escala: 100,          // tamaño del pato en % (ver core/scale.js)
  patoId: '',           // quién es este pato para los demás (ver abajo)
  recordSecreto: '',    // la firma para el marcador global (ver abajo)
  // Modo concentración (Pomodoro): duraciones en minutos y cada cuántos ciclos
  // de trabajo toca descanso largo en vez de corto.
  focusWorkMin: 25,
  focusShortBreakMin: 5,
  focusLongBreakMin: 20,
  focusCyclesToLong: 4
};

/**
 * Identidad estable de este pato.
 *
 * La clave de presencia (`myKey` en chat.js) no sirve: se genera al conectar y
 * cambia en cada reconexión, así que a mitad de una partida el rival dejaría de
 * ser el mismo. Y el nombre tampoco: se puede cambiar y se puede repetir.
 *
 * Se genera una vez y se guarda con los ajustes. Como consecuencia deliberada,
 * el pato de escritorio y el de Chrome son dos patos distintos —tienen dos
 * ajustes— y pueden retarse entre sí.
 */
function nuevoPatoId() {
  return `p-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-6)}`;
}

function patoIdValido(v) {
  return typeof v === 'string' && /^p-[a-z0-9]{6,24}$/.test(v);
}

/**
 * La firma del pato para el marcador global.
 *
 * En la tabla, el dueño de una fila ES el sha256 de esto (ver
 * supabase/records.sql). O sea que quien lo tenga puede escribir en tus récords
 * y quien no, no. Por eso:
 *
 *   - **No sale de aquí.** El núcleo nunca lo ve: pide «guarda esta marca» y
 *     quien la firma es el proceso principal. Si viviera en el renderer estaría
 *     también en la extensión, dentro de la página de cualquiera.
 *   - **No hay quien lo recupere por ti, pero se puede copiar.** No hay cuenta,
 *     ni correo, ni servidor que sepa quién eres, así que perder los ajustes sin
 *     más es perder las filas. Por eso el pato sabe enseñar un CÓDIGO con el que
 *     llevarse esta identidad a otra máquina (ver `codigoDeRecuperacion` y
 *     `main/identidad.js`). Sigue sin haber registro: la copia la guarda quien
 *     quiera guardarla.
 *
 * Treinta y dos caracteres, o sea 128 bits: el SQL exige veinticuatro como
 * mínimo, precisamente para que no se pueda adivinar a fuerza de llamadas.
 *
 * **De `crypto`, no de `Math.random`.** Hasta que existió el código de
 * recuperación esto se hacía con dos tiradas de `Math.random().toString(36)`, y
 * mientras el secreto sólo guardara récords era discutible pero no grave. Ya no:
 * `Math.random` es un generador de números pseudoaleatorios corriente —en V8, un
 * xorshift de 128 bits de estado—, predecible para quien vea unas cuantas
 * salidas seguidas, y además aquel apaño rellenaba con ceros cuando la tirada
 * salía corta, con lo que la mitad de los secretos llevaban ceros de adorno en
 * vez de azar. Para lo que ahora sostiene esta firma —el monedero, y con él los
 * premios— eso no vale.
 *
 * En hexadecimal y no en base 36 a propósito: el código de recuperación se
 * escribe a mano y se limpia de todo lo que no sea alfanumérico, así que el
 * alfabeto tiene que ser minúsculas y dígitos y nada más. Un `base64url` traería
 * guiones bajos que la limpieza se llevaría por delante.
 *
 * Los secretos de antes siguen valiendo tal cual: esto sólo decide cómo nacen
 * los nuevos.
 */
function nuevoRecordSecreto() {
  return require('crypto').randomBytes(16).toString('hex');
}

function recordSecretoValido(v) {
  return typeof v === 'string' && v.length >= 24 && v.length <= 64;
}

/** Valida una proporción 0..1; cualquier otra cosa se descarta. */
function proporcion(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1 ? v : null;
}

module.exports = {
  load() {
    const state = readJson(STATE_FILE, null);
    if (!state || typeof state !== 'object') return { ...DEFAULT_STATE };
    return {
      stats: { ...DEFAULT_STATE.stats, ...(state.stats || {}) },
      level: { ...DEFAULT_STATE.level, ...(state.level || {}) },
      // Un guardado anterior a los minijuegos no trae el campo: se arranca sin
      // récords, que es exactamente lo que había.
      minijuegos: (state.minijuegos && typeof state.minijuegos === 'object')
        ? state.minijuegos : {},
      // Un guardado anterior a la moneda no lo trae, y eso es información: es lo
      // que le dice a la cartera que la estrene. Por eso pasa `null` y no `{}`.
      cuacks: (state.cuacks && typeof state.cuacks === 'object') ? state.cuacks : null,
      x: proporcion(state.x),
      savedAt: typeof state.savedAt === 'number' ? state.savedAt : 0
    };
  },

  save(data) {
    writeJson(STATE_FILE, {
      stats: (data && data.stats) || DEFAULT_STATE.stats,
      level: (data && data.level) || DEFAULT_STATE.level,
      minijuegos: (data && data.minijuegos) || {},
      cuacks: (data && data.cuacks) || null,
      x: proporcion(data && data.x),
      savedAt: Date.now()
    });
  },

  /**
   * Los ajustes que ve el pato.
   *
   * OJO: sale SIN `recordSecreto`. Ese campo vive en el disco y lo usa el
   * proceso principal para firmar en el marcador; dárselo al renderer sería
   * dárselo también a la extensión, dentro de la página web de cualquiera. Se
   * lee con `secretoDelMarcador()`, que no cruza el puente.
   */
  loadSettings() {
    const guardados = leerAjustes();
    // Fuera los dos secretos, no sólo el de ahora: el anterior abre exactamente
    // lo mismo que abría ayer, o sea las filas de quien fuera este pato antes de
    // adoptar otro código. Dejarlo cruzar sería la misma fuga por la puerta de
    // al lado.
    const { recordSecreto, secretoAnterior, ...paraElPato } = guardados;
    return paraElPato;
  },

  /**
   * Guarda lo que manda el pato, conservando lo que el pato no conoce.
   *
   * Sin ese cuidado, el primer «Guardar» de Ajustes borraría el secreto —el
   * renderer no lo tiene, así que lo mandaría vacío y el `...data` lo pisaría—
   * y con él todos los récords de esta instalación, sin forma de recuperarlos.
   */
  saveSettings(data) {
    const guardados = leerAjustes();
    const escrito = {
      ...DEFAULT_SETTINGS,
      ...(data || {}),
      patoId: guardados.patoId,
      recordSecreto: guardados.recordSecreto
    };
    // El secreto anterior sólo se conserva si lo había: no se escribe la clave
    // vacía en los ajustes de todo el mundo para nada.
    if (guardados.secretoAnterior) escrito.secretoAnterior = guardados.secretoAnterior;
    writeJson(SETTINGS_FILE, escrito);
  },

  /** La firma para el marcador global. Sólo la usa el proceso principal. */
  secretoDelMarcador() {
    return leerAjustes().recordSecreto;
  },

  /**
   * La DIRECCIÓN de este pato: `sha256(recordSecreto)`, en hexadecimal.
   *
   * A diferencia del secreto, ésta sí sale de aquí: se anuncia en la presencia
   * del canal para que otros puedan escribirte en privado. Publicarla no abre
   * nada —escribir en tus filas exige el secreto, no su hash— y es lo mismo que
   * ya identifica al dueño en el marcador y en el historial de partidas (ver
   * supabase/mensajes.sql).
   */
  direccion() {
    const secreto = leerAjustes().recordSecreto;
    if (!secreto) return '';
    return require('crypto').createHash('sha256').update(secreto).digest('hex');
  },

  /**
   * El código con el que esta identidad se lleva a otra máquina.
   *
   * Lleva el secreto dentro, así que **sólo se le puede enseñar a quien ya es el
   * dueño de este disco**. En el escritorio eso es el propio pato, que corre en
   * una ventana nuestra; en la extensión el pato vive dentro de la página web de
   * cualquiera y ahí esto NO puede bajar (ver `capacidades.identidad` en
   * core/platform.js).
   */
  codigoDeRecuperacion() {
    return identidad.codigoDe(leerAjustes().recordSecreto);
  },

  /**
   * Adopta la identidad de otro código.
   *
   * Lo que cambia no es «el monedero»: es **quién eres** en las cuatro tablas a
   * la vez —marcador, historial de partidas, privados y cuacks—, porque las
   * cuatro llevan la misma firma. Lo que hubiera en esta instalación no se borra
   * de ningún sitio: sigue en el servidor bajo el secreto de antes, simplemente
   * deja de ser tuyo. Avisar de eso ANTES es cosa de quien llama.
   *
   * El secreto anterior se guarda al lado. No es una función de deshacer con
   * botones —no la hay—: es para que un «me he equivocado de pato» tenga arreglo
   * mirando el fichero de ajustes, en vez de ser definitivo.
   *
   * @param {string} codigo
   * @returns {{ok:boolean, error?:string, mensaje?:string}}
   */
  adoptarCodigo(codigo) {
    const leido = identidad.leerCodigo(codigo);
    if (!leido.ok) {
      return { ok: false, error: leido.error, mensaje: identidad.explicar(leido.error) };
    }

    const ajustes = leerAjustes();
    if (leido.secreto === ajustes.recordSecreto) {
      return { ok: false, error: 'ya-eres-ese', mensaje: 'Ese código ya es el de esta mascota.' };
    }

    writeJson(SETTINGS_FILE, {
      ...ajustes,
      recordSecreto: leido.secreto,
      // Por si el código era el que no tenía que ser.
      secretoAnterior: ajustes.recordSecreto
    });
    return { ok: true };
  }
};

/**
 * Los ajustes del disco, con la identidad y la firma ya estrenadas.
 *
 * Las dos se crean aquí y no donde se usan porque las dos hacen falta antes de
 * que el pato arranque: el chat se conecta y tiene que presentarse.
 */
function leerAjustes() {
  const s = readJson(SETTINGS_FILE, null);
  const ajustes = (s && typeof s === 'object')
    ? { ...DEFAULT_SETTINGS, ...s }
    : { ...DEFAULT_SETTINGS };

  let cambia = false;
  if (!patoIdValido(ajustes.patoId)) {
    ajustes.patoId = nuevoPatoId();
    cambia = true;
  }
  if (!recordSecretoValido(ajustes.recordSecreto)) {
    ajustes.recordSecreto = nuevoRecordSecreto();
    cambia = true;
  }
  if (cambia) writeJson(SETTINGS_FILE, ajustes);
  return ajustes;
}
