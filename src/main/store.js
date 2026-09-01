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
  patoId: ''            // quién es este pato para los demás (ver abajo)
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
      x: proporcion(state.x),
      savedAt: typeof state.savedAt === 'number' ? state.savedAt : 0
    };
  },

  save(data) {
    writeJson(STATE_FILE, {
      stats: (data && data.stats) || DEFAULT_STATE.stats,
      level: (data && data.level) || DEFAULT_STATE.level,
      minijuegos: (data && data.minijuegos) || {},
      x: proporcion(data && data.x),
      savedAt: Date.now()
    });
  },

  loadSettings() {
    const s = readJson(SETTINGS_FILE, null);
    const ajustes = (s && typeof s === 'object')
      ? { ...DEFAULT_SETTINGS, ...s }
      : { ...DEFAULT_SETTINGS };
    // Se estrena y se guarda aquí mismo: el chat se conecta antes de que el pato
    // haya arrancado siquiera, y necesita anunciar la identidad al presentarse.
    if (!patoIdValido(ajustes.patoId)) {
      ajustes.patoId = nuevoPatoId();
      writeJson(SETTINGS_FILE, ajustes);
    }
    return ajustes;
  },

  saveSettings(data) {
    writeJson(SETTINGS_FILE, { ...DEFAULT_SETTINGS, ...(data || {}) });
  }
};
