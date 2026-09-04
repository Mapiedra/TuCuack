'use strict';

const { app } = require('electron');
const fs = require('fs');
const path = require('path');

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
  recordSecreto: ''     // la firma para el marcador global (ver abajo)
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
 *   - **No se puede recuperar.** Perder los ajustes es perder las filas, y no
 *     hay a quién reclamar: no hay cuenta, ni correo, ni servidor que sepa quién
 *     eres. Es el precio de no pedirle a nadie que se registre para jugar.
 *
 * Treinta y dos caracteres de dos tiradas: el SQL exige veinticuatro como
 * mínimo, precisamente para que no se pueda adivinar a fuerza de llamadas.
 */
function nuevoRecordSecreto() {
  const trozo = () => Math.random().toString(36).slice(2).padEnd(16, '0').slice(0, 16);
  return `${trozo()}${trozo()}`;
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
    const { recordSecreto, ...paraElPato } = guardados;
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
    writeJson(SETTINGS_FILE, {
      ...DEFAULT_SETTINGS,
      ...(data || {}),
      patoId: guardados.patoId,
      recordSecreto: guardados.recordSecreto
    });
  },

  /** La firma para el marcador global. Sólo la usa el proceso principal. */
  secretoDelMarcador() {
    return leerAjustes().recordSecreto;
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
