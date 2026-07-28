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

const DEFAULT_STATE = {
  stats: { hunger: 80, energy: 80, hygiene: 80, happiness: 80 },
  // Experiencia y racha de días (ver renderer/game/Level.js).
  level: { xp: 0, racha: 0, ultimoDia: "", diaDelChat: "", chatHoy: 0 },
  savedAt: 0
};

const DEFAULT_SETTINGS = {
  displayName: '',
  autoLaunch: false,
  skin: 'normal'        // diseño de pato elegido (renderer/game/skins.js)
};

module.exports = {
  load() {
    const state = readJson(STATE_FILE, null);
    if (!state || typeof state !== 'object') return { ...DEFAULT_STATE };
    return {
      stats: { ...DEFAULT_STATE.stats, ...(state.stats || {}) },
      level: { ...DEFAULT_STATE.level, ...(state.level || {}) },
      savedAt: typeof state.savedAt === 'number' ? state.savedAt : 0
    };
  },

  save(data) {
    writeJson(STATE_FILE, {
      stats: (data && data.stats) || DEFAULT_STATE.stats,
      level: (data && data.level) || DEFAULT_STATE.level,
      savedAt: Date.now()
    });
  },

  loadSettings() {
    const s = readJson(SETTINGS_FILE, null);
    if (!s || typeof s !== 'object') return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...s };
  },

  saveSettings(data) {
    writeJson(SETTINGS_FILE, { ...DEFAULT_SETTINGS, ...(data || {}) });
  }
};
