'use strict';

// Credenciales de Supabase para el chat entre patos.
//
// NO se guardan en el repositorio. Se buscan, por este orden:
//   1. Variables de entorno SUPABASE_URL y SUPABASE_ANON_KEY.
//   2. Un fichero `supabase.json` junto al proyecto (desarrollo) o dentro de
//      los recursos de la app instalada (producción):
//        { "url": "https://xxxx.supabase.co", "anonKey": "eyJhbGc..." }
//
// La `anon key` está pensada para usarse en clientes y es pública por diseño;
// aun así conviene no versionarla. Si se persisten mensajes en tablas, hay que
// protegerlas con RLS (ver README).

const fs = require('fs');
const path = require('path');

// Canal único común: todos los patos comparten la misma conversación.
const CHANNEL = 'patos-global';

function candidatePaths() {
  const out = [];
  // Junto al ejecutable instalado (extraResources) y en la carpeta de la app.
  if (process.resourcesPath) out.push(path.join(process.resourcesPath, 'supabase.json'));
  try {
    const { app } = require('electron');
    if (app) {
      out.push(path.join(app.getAppPath(), 'supabase.json'));
      out.push(path.join(app.getPath('userData'), 'supabase.json'));
    }
  } catch { /* fuera de Electron (p. ej. en pruebas) */ }
  out.push(path.join(__dirname, '..', '..', 'supabase.json'));
  return out;
}

function readFileConfig() {
  for (const p of candidatePaths()) {
    try {
      if (!fs.existsSync(p)) continue;
      const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (raw && raw.url && raw.anonKey) {
        return { url: String(raw.url), anonKey: String(raw.anonKey), source: p };
      }
    } catch (err) {
      console.error('[config] supabase.json ilegible en', p, err.message);
    }
  }
  return null;
}

function resolve() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    return {
      url: process.env.SUPABASE_URL,
      anonKey: process.env.SUPABASE_ANON_KEY,
      source: 'env'
    };
  }
  return readFileConfig() || { url: '', anonKey: '', source: null };
}

const resolved = resolve();

module.exports = {
  SUPABASE_URL: resolved.url,
  SUPABASE_ANON_KEY: resolved.anonKey,
  SOURCE: resolved.source,
  CHANNEL,
  isConfigured() {
    return Boolean(resolved.url && resolved.anonKey);
  }
};
