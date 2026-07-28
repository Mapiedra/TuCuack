'use strict';

// Credenciales de Supabase para el chat entre patos.
//
// NO se guardan en el repositorio. Se buscan, por este orden:
//   1. Variables de entorno SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY.
//   2. Un fichero `supabase.json` junto al proyecto (desarrollo) o dentro de
//      los recursos de la app instalada (producción):
//        { "url": "https://xxxx.supabase.co", "publishableKey": "sb_publishable_..." }
//
// La clave publicable (`sb_publishable_...`) es la que Supabase usa hoy para
// clientes; sustituye a la antigua `anon key`, que sigue aceptándose aquí como
// `anonKey` por compatibilidad con proyectos anteriores. Es pública por diseño,
// pero conviene no versionarla. Si algún día se persisten mensajes en tablas,
// hay que protegerlas con RLS (ver README).

const fs = require('fs');
const path = require('path');

// Canal único común: todos los patos comparten la misma conversación.
const CHANNEL = 'patos-global';

// Orden de búsqueda, de mayor a menor prioridad. El de la carpeta de datos del
// usuario va ANTES que el empaquetado para que se puedan cambiar las
// credenciales de una instalación ya hecha sin reinstalar.
function candidatePaths() {
  const out = [];
  try {
    const { app } = require('electron');
    if (app) {
      out.push(path.join(app.getPath('userData'), 'supabase.json'));
      out.push(path.join(app.getAppPath(), 'supabase.json'));
    }
  } catch { /* fuera de Electron (p. ej. en pruebas) */ }
  // Empaquetado junto al ejecutable instalado (extraResources).
  if (process.resourcesPath) out.push(path.join(process.resourcesPath, 'supabase.json'));
  // Raíz del proyecto (desarrollo).
  out.push(path.join(__dirname, '..', '..', 'supabase.json'));
  return out;
}

/** Acepta la clave nueva (publishableKey) y la antigua (anonKey). */
function pickKey(obj) {
  if (!obj) return '';
  return String(obj.publishableKey || obj.anonKey || '').trim();
}

/**
 * Deja la URL en la raíz del proyecto (`https://xxxx.supabase.co`).
 *
 * En el panel de Supabase es fácil copiar la URL del endpoint REST
 * (`.../rest/v1`) en lugar del Project URL; con ese sufijo, Realtime responde
 * 401 y el chat no conecta, así que se recorta cualquier ruta sobrante.
 */
function normalizeUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  try {
    const u = new URL(value);
    if (u.pathname && u.pathname !== '/') {
      console.warn(`[config] La URL de Supabase llevaba la ruta "${u.pathname}"; `
        + 'se usa sólo el dominio. Copia el "Project URL", no el del endpoint REST.');
    }
    return u.origin;
  } catch {
    return value.replace(/\/+$/, '');
  }
}

/** ¿Sigue con el texto de ejemplo sin rellenar? */
function isPlaceholder(value) {
  if (!value) return true;
  return /TU-PROYECTO|TU_CLAVE|TU_ANON|TU_KEY/i.test(value);
}

function readFileConfig() {
  for (const p of candidatePaths()) {
    try {
      if (!fs.existsSync(p)) continue;
      const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
      const url = normalizeUrl(raw && raw.url);
      const key = pickKey(raw);
      if (isPlaceholder(url) || isPlaceholder(key)) continue;  // sin rellenar
      return { url, key, source: p, legacy: Boolean(raw.anonKey && !raw.publishableKey) };
    } catch (err) {
      console.error('[config] supabase.json ilegible en', p, err.message);
    }
  }
  return null;
}

function resolve() {
  const envKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (process.env.SUPABASE_URL && envKey) {
    return {
      url: normalizeUrl(process.env.SUPABASE_URL),
      key: envKey,
      source: 'env',
      legacy: !process.env.SUPABASE_PUBLISHABLE_KEY
    };
  }
  return readFileConfig() || { url: '', key: '', source: null, legacy: false };
}

const resolved = resolve();

if (resolved.url) {
  console.log(`[config] Chat configurado desde: ${resolved.source}`);
  if (resolved.legacy) {
    console.warn('[config] Usando la "anon key" antigua. Supabase recomienda migrar a '
      + 'la clave publicable (sb_publishable_...): cámbiala por "publishableKey".');
  }
} else {
  console.log('[config] Chat sin configurar (no se encontró supabase.json con datos '
    + 'válidos). Ver docs/CONFIGURACION.md');
}

module.exports = {
  SUPABASE_URL: resolved.url,
  SUPABASE_KEY: resolved.key,
  SOURCE: resolved.source,
  CHANNEL,
  isConfigured() {
    return Boolean(resolved.url && resolved.key);
  }
};
