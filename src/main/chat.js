'use strict';

// Chat social entre patos con Supabase Realtime (canal global único).
// Se ejecuta en el proceso main porque Electron main no expone `WebSocket`
// global: pasamos `ws` como transporte. El renderer habla por IPC.
//
// Además del chat, el canal mantiene la PRESENCIA de cada pato conectado con su
// nombre, que es lo que permite comprobar que un nombre no esté ya en uso.
//
// Por el mismo canal viajan las VISITAS: un pato que se planta en la pantalla de
// otro. Van en un evento de broadcast aparte (`visita`) para no ensuciar la
// conversación, y llevan destinatario. Como el canal es un broadcast público, el
// recado llega a todos los clientes; el filtro por destinatario se hace AQUÍ, y
// no en el pato, para que lo dirigido a otro no llegue siquiera al renderer.

const tls = require('tls');
const { execFile } = require('child_process');
const config = require('./config');

let supabase = null;
/** Cómo se construye el cliente, para poder rehacerlo al reconectar. */
let crearCliente = null;
let channel = null;
let connected = false;
let myName = '';
let myKey = '';
// Si ya nos hemos anunciado en la presencia con el nombre actual. Repetir el
// anuncio deja una entrada de más, y el pato sale duplicado en la lista de
// conectados que ven los demás.
let anunciado = false;

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

  // El canal se levanta en cuanto se sepa de qué certificados fiarse (unos
  // cientos de ms). Hasta entonces la app va normal, sólo que sin chat.
  transporteQueSeFiaDelSistema(WebSocketImpl).then((Transporte) => {
    // Se guarda cómo se construye para poder rehacerlo si la reconexión se
    // atasca. El proceso main de Electron no trae `WebSocket`, así que hay que
    // pasarle el del paquete `ws`; sin él, supabase-js ni siquiera crea el
    // cliente.
    crearCliente = () => createClient(config.SUPABASE_URL, config.SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { transport: Transporte, params: { eventsPerSecond: 10 } }
    });

    supabase = crearCliente();

    channel = crearCanal(getWin);
    suscribir(getWin);
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

    /**
     * Manda el pato a la pantalla de otro. `destino` es la clave de presencia
     * del destinatario: los nombres se repiten, las claves no.
     */
    sendVisit(v) {
      if (!channel || !connected || !v || !v.aClave) return false;
      channel.send({
        type: 'broadcast',
        event: 'visita',
        payload: limpiarVisita({ ...v, deClave: myKey })
      });
      return true;
    },

    /** Actualiza el nombre anunciado en la presencia. */
    async setName(name) {
      const nuevo = String(name || '').slice(0, 40);
      if (nuevo === myName && anunciado) return;
      myName = nuevo;
      if (channel && connected) {
        try {
          await channel.track({ name: myName, at: Date.now() });
          anunciado = true;
        } catch (err) {
          console.error('[chat] no se pudo actualizar el nombre:', err);
        }
      }
    },

    names: () => presentNames(),
    presentes: () => presentes(),
    /** Nuestra clave de presencia: es la dirección de vuelta de las visitas. */
    clave: () => myKey,
    isReady: () => connected
  };
}

// --- Visitas --------------------------------------------------------------

const GESTOS = ['saludo', 'regalo'];

/**
 * Deja una visita en lo que se puede enseñar sin sustos.
 *
 * Vale tanto para lo que se manda como para lo que llega: el canal es público y
 * cualquiera puede poner ahí lo que quiera. El diseño se comprueba más adelante,
 * ya en el pato, que es quien sabe qué diseños existen.
 */
function limpiarVisita(v) {
  return {
    id: String(v.id || '').slice(0, 40),
    de: String(v.de || 'Pato').slice(0, 40),
    deClave: String(v.deClave || '').slice(0, 40),
    aClave: String(v.aClave || '').slice(0, 40),
    skin: String(v.skin || '').slice(0, 24),
    gesto: GESTOS.includes(v.gesto) ? v.gesto : 'saludo',
    texto: String(v.texto || '').slice(0, 280),
    ts: Number(v.ts) || Date.now()
  };
}

// --- Certificados: convivir con los antivirus que inspeccionan el tráfico ---
//
// En Windows es corriente que un antivirus (AVG, Avast, ESET…) o un proxy de
// empresa se meta en medio del HTTPS: sustituye el certificado del servidor por
// uno suyo, firmado por una raíz que instala en el almacén de Windows. Chromium
// la da por buena, pero Node —y por tanto el proceso main de Electron, que es
// quien mantiene el chat— sólo se fía de la lista que trae compilada. De ahí el
// "unable to verify the first certificate" que tumbaba el canal una y otra vez.
//
// Los antivirus lo apañan poniendo NODE_EXTRA_CA_CERTS en el entorno, pero eso
// sólo alcanza a los procesos que arrancan después y heredan la variable: con
// una terminal abierta de antes, el pato se queda sin chat sin motivo aparente.
// Así que se leen las raíces del almacén de Windows y se le pasan al WebSocket,
// que es justo lo que haría el navegador.

/** Las raíces de confianza de Windows, en PEM. Vacío si no se pueden leer. */
function raicesDeWindows() {
  if (process.platform !== 'win32') return Promise.resolve([]);
  const guion = 'Get-ChildItem Cert:\\LocalMachine\\Root, Cert:\\CurrentUser\\Root '
    + '| ForEach-Object { [Convert]::ToBase64String($_.RawData) }';
  return new Promise((resolve) => {
    execFile('powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', guion],
      { timeout: 10000, maxBuffer: 16 * 1024 * 1024, windowsHide: true },
      (err, stdout) => {
        if (err) {
          console.warn('[chat] no se pudo leer el almacén de certificados:', err.message);
          return resolve([]);
        }
        const vistos = new Set();
        const pems = [];
        for (const linea of String(stdout).split(/\r?\n/)) {
          const b64 = linea.trim();
          if (!b64 || vistos.has(b64)) continue;
          vistos.add(b64);
          pems.push('-----BEGIN CERTIFICATE-----\n'
            + b64.replace(/(.{64})/g, '$1\n').replace(/\n$/, '')
            + '\n-----END CERTIFICATE-----');
        }
        resolve(pems);
      });
  });
}

/**
 * El transporte de siempre, pero fiándose además de las raíces de Windows.
 *
 * Si no se pueden leer, se devuelve `ws` tal cual: mejor el comportamiento de
 * antes que quedarse sin lista de certificados, que dejaría el chat inservible
 * incluso donde funcionaba.
 */
async function transporteQueSeFiaDelSistema(WebSocketImpl) {
  let extra = [];
  try {
    extra = await raicesDeWindows();
  } catch (err) {
    console.warn('[chat] no se pudieron reunir los certificados:', err.message);
  }
  if (!extra.length) return WebSocketImpl;

  // Pasar `ca` REEMPLAZA la lista, no la amplía: hay que incluir las de siempre.
  const ca = [...tls.rootCertificates, ...extra];
  console.log(`[chat] ${extra.length} certificados raíz del sistema añadidos a los de Node`);

  return class WebSocketConRaicesDelSistema extends WebSocketImpl {
    constructor(direccion, protocolos, opciones) {
      super(direccion, protocolos, { ...(opciones || {}), ca });
    }
  };
}

/** Crea el canal con sus escuchas. Se rehace entero en cada reconexión. */
function crearCanal(getWin) {
  anunciado = false;   // canal nuevo, presencia nueva
  const ch = supabase.channel(config.CHANNEL, {
    config: {
      broadcast: { self: false },
      presence: { key: myKey }
    }
  });

  ch.on('broadcast', { event: 'chat' }, ({ payload }) => {
    if (!payload) return;
    notify(getWin, {
      type: 'message',
      from: String(payload.from || 'Pato'),
      text: String(payload.text || ''),
      ts: payload.ts || Date.now()
    });
  });

  // Visitas: un pato que viene a la pantalla de otro. Llegan a todo el canal,
  // así que lo que no venga dirigido a nosotros se descarta aquí mismo.
  ch.on('broadcast', { event: 'visita' }, ({ payload }) => {
    if (!payload || payload.aClave !== myKey) return;
    notify(getWin, { type: 'visita', visita: limpiarVisita(payload) });
  });

  // Presencia: quién está conectado y con qué nombre.
  for (const evento of ['sync', 'join', 'leave']) {
    ch.on('presence', { event: evento }, () => {
      notify(getWin, { type: 'presence', names: presentNames(), presentes: presentes() });
    });
  }
  return ch;
}

// --- Conexión con reintentos ---------------------------------------------
//
// El canal puede caerse por algo ajeno a la app (una caída del servicio, la red
// del portátil al suspenderse, un cambio de wifi). Sin reintentar, el chat se
// quedaba muerto hasta reiniciar la app, aunque el servicio volviera enseguida.

let reintentos = 0;
let temporizador = null;
const ESPERA_MIN = 5000;
const ESPERA_MAX = 5 * 60 * 1000;

/**
 * Saca el motivo de verdad de un error del canal.
 *
 * Supabase envuelve los fallos de transporte en un "channel error: transport
 * failure" que no dice nada, y deja el error original en `cause`. Ahí es donde
 * aparece lo que hace falta saber: un certificado que no se pudo verificar (un
 * antivirus que inspecciona el tráfico), un DNS que no resuelve, un proxy que
 * corta. Sin esto, todos los fallos de red se parecen.
 */
function describirError(err) {
  if (!err) return '';
  const partes = [err.message || String(err)];
  let causa = err.cause;
  let vueltas = 0;
  while (causa && vueltas++ < 4) {
    const texto = causa.message || causa.code || causa.type
      || (typeof causa === 'string' ? causa : null);
    if (texto) partes.push(String(texto));
    causa = causa.cause || (causa.error && causa.error.message ? causa.error : null);
  }
  return partes.join(' ← ');
}

function suscribir(getWin) {
  if (!channel) return;
  channel.subscribe(async (status, err) => {
    const antes = connected;
    connected = status === 'SUBSCRIBED';
    const detalle = err ? ` (${describirError(err)})` : '';
    if (connected) {
      reintentos = 0;
      if (!antes) console.log('[chat] canal: conectado');
      notify(getWin, { type: 'status', connected: true, reason: status });
      // Sólo una vez por canal. Supabase puede avisar de SUBSCRIBED más de una
      // vez sobre el mismo canal, y cada anuncio deja una entrada NUEVA en la
      // presencia en vez de reemplazar la anterior: el pato se va multiplicando
      // en la lista de conectados de todos los demás.
      if (!anunciado) {
        try {
          await channel.track({ name: myName, at: Date.now() });
          anunciado = true;
        } catch (e) {
          console.error('[chat] no se pudo anunciar la presencia:', e);
        }
      }
      notify(getWin, { type: 'presence', names: presentNames(), presentes: presentes() });
      return;
    }

    console.log(`[chat] canal: ${status}${detalle}`);
    notify(getWin, { type: 'status', connected: false, reason: status });
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      programarReintento(getWin);
    }
  });
}

function programarReintento(getWin) {
  if (temporizador) return;   // ya hay uno en marcha
  const espera = Math.min(ESPERA_MAX, ESPERA_MIN * Math.pow(2, reintentos));
  reintentos++;
  // A partir del tercer intento no basta con rehacer el canal: se rehace el
  // cliente entero. Quitar el último canal deja al socket programando su propia
  // desconexión, y el canal nuevo puede quedarse esperando a un socket que se
  // está yendo — con lo que los reintentos fallan uno tras otro para siempre,
  // aunque la red ya haya vuelto.
  const desdeCero = reintentos >= 3;
  console.log(`[chat] reintentando en ${Math.round(espera / 1000)}s `
    + `(intento ${reintentos}${desdeCero ? ', reconectando desde cero' : ''})`);

  temporizador = setTimeout(() => {
    temporizador = null;
    if (!supabase) return;
    try {
      if (desdeCero) {
        try {
          supabase.removeAllChannels();
          if (supabase.realtime && typeof supabase.realtime.disconnect === 'function') {
            supabase.realtime.disconnect();
          }
        } catch { /* el cliente viejo ya estaba para el arrastre */ }
        supabase = crearCliente();
      } else if (channel) {
        // Reutilizar un canal que ya falló no vuelve a conectar.
        supabase.removeChannel(channel);
      }
      channel = crearCanal(getWin);
      suscribir(getWin);
    } catch (e) {
      console.error('[chat] fallo al reconectar:', e.message);
      programarReintento(getWin);
    }
  }, espera);
}

function disabledChat() {
  return {
    send() { return false; },
    sendVisit() { return false; },
    async setName() {},
    names: () => [],
    presentes: () => [],
    clave: () => '',
    isReady: () => false
  };
}

/**
 * Los demás patos conectados, con su clave de presencia (excluye el propio).
 *
 * La clave hace falta para dirigirle una visita a uno en concreto: dos patos
 * pueden llamarse igual, pero cada uno tiene su clave.
 *
 * @returns {{clave:string, nombre:string}[]}
 */
function presentes() {
  if (!channel || !connected) return [];
  try {
    const state = channel.presenceState() || {};
    const out = [];
    const vistos = new Set();
    for (const [key, metas] of Object.entries(state)) {
      if (key === myKey) continue;
      for (const m of metas) {
        // Un mismo pato puede figurar varias veces: le pasa a quien siga con una
        // versión que se anunciaba de más.
        if (!m || !m.name || vistos.has(key)) continue;
        vistos.add(key);
        out.push({ clave: String(key), nombre: String(m.name) });
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** Nombres de los demás patos conectados (excluye el propio). */
function presentNames() {
  return presentes().map((p) => p.nombre);
}

function notify(getWin, evt) {
  const win = getWin();
  if (win && !win.isDestroyed()) win.webContents.send('chat:event', evt);
}

module.exports = { initChat };
