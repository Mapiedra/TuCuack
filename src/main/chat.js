'use strict';

// Chat social entre patos con Supabase Realtime (canal global único).
// Se ejecuta en el proceso main porque Electron main no expone `WebSocket`
// global: pasamos `ws` como transporte. El renderer habla por IPC.
//
// Además del chat, el canal mantiene la PRESENCIA de cada pato conectado con su
// nombre, que es lo que permite comprobar que un nombre no esté ya en uso.

const config = require('./config');

let supabase = null;
let channel = null;
let connected = false;
let myName = '';
let myKey = '';

/**
 * @param {() => import('electron').BrowserWindow | null} getWin
 * @param {string} initialName
 */
function initChat(getWin, initialName) {
  myName = initialName || '';

  if (!config.isConfigured()) {
    // Sin credenciales: el chat queda deshabilitado pero la app funciona.
    notify(getWin, { type: 'status', connected: false, reason: 'not-configured' });
    return disabledChat();
  }

  let createClient;
  let WebSocketImpl;
  try {
    ({ createClient } = require('@supabase/supabase-js'));
    WebSocketImpl = require('ws');
  } catch (err) {
    console.error('[chat] dependencias no disponibles:', err);
    return disabledChat();
  }

  // Clave estable por instalación para identificar nuestra propia presencia.
  myKey = `pato-${Math.random().toString(36).slice(2, 10)}`;

  supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocketImpl, params: { eventsPerSecond: 10 } }
  });

  channel = supabase.channel(config.CHANNEL, {
    config: {
      broadcast: { self: false },
      presence: { key: myKey }
    }
  });

  channel.on('broadcast', { event: 'chat' }, ({ payload }) => {
    if (!payload) return;
    notify(getWin, {
      type: 'message',
      from: String(payload.from || 'Pato'),
      text: String(payload.text || ''),
      ts: payload.ts || Date.now()
    });
  });

  // Presencia: quién está conectado y con qué nombre.
  channel.on('presence', { event: 'sync' }, () => {
    notify(getWin, { type: 'presence', names: presentNames() });
  });
  channel.on('presence', { event: 'join' }, () => {
    notify(getWin, { type: 'presence', names: presentNames() });
  });
  channel.on('presence', { event: 'leave' }, () => {
    notify(getWin, { type: 'presence', names: presentNames() });
  });

  channel.subscribe(async (status) => {
    connected = status === 'SUBSCRIBED';
    notify(getWin, { type: 'status', connected, reason: status });
    if (connected) {
      try {
        await channel.track({ name: myName, at: Date.now() });
      } catch (err) {
        console.error('[chat] no se pudo anunciar la presencia:', err);
      }
      notify(getWin, { type: 'presence', names: presentNames() });
    }
  });

  return {
    send(from, text) {
      if (!channel || !connected) return false;
      const clean = String(text || '').slice(0, 280);
      if (!clean.trim()) return false;
      channel.send({
        type: 'broadcast',
        event: 'chat',
        payload: { from: String(from || 'Pato').slice(0, 40), text: clean, ts: Date.now() }
      });
      return true;
    },

    /** Actualiza el nombre anunciado en la presencia. */
    async setName(name) {
      myName = String(name || '').slice(0, 40);
      if (channel && connected) {
        try {
          await channel.track({ name: myName, at: Date.now() });
        } catch (err) {
          console.error('[chat] no se pudo actualizar el nombre:', err);
        }
      }
    },

    names: () => presentNames(),
    isReady: () => connected
  };
}

function disabledChat() {
  return {
    send() { return false; },
    async setName() {},
    names: () => [],
    isReady: () => false
  };
}

/** Nombres de los demás patos conectados (excluye el propio). */
function presentNames() {
  if (!channel || !connected) return [];
  try {
    const state = channel.presenceState() || {};
    const out = [];
    for (const [key, metas] of Object.entries(state)) {
      if (key === myKey) continue;
      for (const m of metas) {
        if (m && m.name) out.push(String(m.name));
      }
    }
    return out;
  } catch {
    return [];
  }
}

function notify(getWin, evt) {
  const win = getWin();
  if (win && !win.isDestroyed()) win.webContents.send('chat:event', evt);
}

module.exports = { initChat };
