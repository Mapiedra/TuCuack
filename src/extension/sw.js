'use strict';

// Service worker de la extensión: mantiene el chat entre patos y hace de puente
// con el panel.
//
// Es el equivalente a src/main/chat.js del escritorio, y habla EXACTAMENTE el
// mismo protocolo (mismo canal, mismo evento de broadcast, misma presencia), que
// es lo que permite que los patos de extensión y los de escritorio compartan la
// conversación.
//
// supabase-js viene empaquetado en `vendor/`: Manifest V3 prohíbe cargar código
// desde fuera de la extensión, así que no vale un CDN.

importScripts('vendor/supabase.js');

// Canal único común: todos los patos comparten la misma conversación.
// Debe coincidir con CHANNEL en src/main/config.js.
const CANAL = 'patos-global';

let cliente = null;
let canal = null;
let conectado = false;
let miNombre = '';
let miClave = '';
/** Si ya nos hemos anunciado en la presencia con el nombre actual. */
let anunciado = false;

/** Paneles abiertos escuchando. Normalmente uno; puede haber varios si el
 *  usuario tiene varias ventanas de Chrome. */
const puertos = new Set();

function avisar(evt) {
  for (const p of puertos) {
    try {
      p.postMessage(evt);
    } catch { puertos.delete(p); }
  }
}

// ---- Histórico de la sesión ---------------------------------------------
//
// El pato guarda los mensajes de la sesión para poder releerlos (ver
// src/core/chat/historial.js), pero aquí no basta con eso: el pato se muda de
// pestaña y en cada página empieza un documento nuevo, con su memoria en blanco.
// Así que el worker lleva su propia copia y se la entrega al llegar.
//
// Va en `storage.session` y no en una variable porque Manifest V3 recicla el
// worker a los 30 segundos de inactividad; storage.session se borra sola al
// cerrar Chrome, que es justo la vida que debe tener un histórico de sesión.
const CLAVE_HISTORIAL = 'historial';
const TOPE_HISTORIAL = 50;   // el mismo que el del pato

// Los mensajes pueden llegar de dos en dos: sin encolar las escrituras, dos
// lecturas simultáneas del storage se pisarían y se perdería uno.
let colaHistorial = Promise.resolve();

async function leerHistorial() {
  try {
    const guardado = await chrome.storage.session.get(CLAVE_HISTORIAL);
    const lista = guardado[CLAVE_HISTORIAL];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

function anotarEnHistorial(mensaje) {
  colaHistorial = colaHistorial.then(async () => {
    try {
      const lista = await leerHistorial();
      lista.push(mensaje);
      await chrome.storage.session.set({
        [CLAVE_HISTORIAL]: lista.slice(-TOPE_HISTORIAL)
      });
    } catch (err) {
      console.warn('[chat] no se pudo anotar en el histórico:', err);
    }
  });
  return colaHistorial;
}

// ---- Credenciales -------------------------------------------------------
// No se versionan: el ensamblado copia supabase.json si existe (ver
// tools/build-extension.js y docs/CONFIGURACION.md).
async function leerCredenciales() {
  try {
    const res = await fetch(chrome.runtime.getURL('supabase.json'));
    if (!res.ok) return null;
    const datos = await res.json();
    const url = datos.url;
    const clave = datos.publishableKey || datos.anonKey;
    if (!url || !clave) return null;
    return { url, clave };
  } catch {
    return null;
  }
}

// ---- Conexión -----------------------------------------------------------
//
// `iniciar` se llama desde varios sitios a la vez —al arrancar el worker, al
// conectarse un panel, al preguntar por el estado—, y como tiene esperas dentro,
// dos llamadas seguidas se colaban las dos antes de que `cliente` estuviera
// asignado: se creaban dos clientes y dos canales sobre el mismo topic, y el
// segundo dejaba huérfano al primero. Se guarda la faena en curso para que todos
// esperen a la misma.
let arranqueEnCurso = null;

function iniciar() {
  if (cliente) return Promise.resolve();
  if (!arranqueEnCurso) {
    arranqueEnCurso = conectar().finally(() => { arranqueEnCurso = null; });
  }
  return arranqueEnCurso;
}

async function conectar() {
  const cred = await leerCredenciales();
  if (!cred) {
    console.log('[chat] sin configurar: no se encontró supabase.json con datos válidos');
    avisar({ type: 'status', connected: false, reason: 'not-configured' });
    return;
  }

  // El nombre lo elige el pato en el panel; aquí se lee de donde él lo guarda,
  // para poder anunciarse aunque el panel aún no esté abierto.
  const { ajustes } = await chrome.storage.local.get('ajustes');
  miNombre = (ajustes && ajustes.displayName) || '';
  miClave = `pato-${Math.random().toString(36).slice(2, 10)}`;

  console.log(`[chat] conectando a ${cred.url} · canal "${CANAL}" · como "${miNombre || '(sin nombre)'}"`);

  cliente = supabase.createClient(cred.url, cred.clave, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 10 } }
  });

  canal = crearCanal();
  suscribir();
}

function crearCanal() {
  anunciado = false;   // canal nuevo, presencia nueva
  const ch = cliente.channel(CANAL, {
    config: {
      broadcast: { self: false },
      presence: { key: miClave }
    }
  });

  ch.on('broadcast', { event: 'chat' }, ({ payload }) => {
    if (!payload) return;
    // Si no hay panel abierto, el mensaje no tiene a quién entregarse y se
    // pierde: los broadcast de Realtime no se guardan en ningún sitio. Queda
    // anotado aquí porque es justo lo que hay que observar para saber si merece
    // la pena guardar historial.
    if (puertos.size === 0) {
      console.log(`[chat] llega "${payload.from}" pero no hay pato a la vista: se descarta`);
    } else {
      console.log(`[chat] recibido de ${payload.from}: ${payload.text}`);
    }
    const mensaje = {
      from: String(payload.from || 'Pato'),
      text: String(payload.text || ''),
      ts: payload.ts || Date.now()
    };
    // Se anota aunque no haya ningún pato a la vista: es entonces cuando el
    // histórico gana su sueldo.
    anotarEnHistorial({ ...mensaje, propio: false });
    avisar({ type: 'message', ...mensaje });
  });

  // Visitas: un pato que viene a esta pantalla. Van a todo el canal, así que lo
  // que no venga dirigido a nosotros se descarta aquí y no llega al pato.
  ch.on('broadcast', { event: 'visita' }, ({ payload }) => {
    if (!payload || payload.aClave !== miClave) return;
    if (puertos.size === 0) {
      // A diferencia del chat, una visita no se guarda para después: llegar
      // tarde a una visita es no haberla tenido.
      console.log(`[chat] visita de "${payload.de}" sin pato a la vista: se descarta`);
      return;
    }
    avisar({ type: 'visita', visita: limpiarVisita(payload) });
  });

  for (const evento of ['sync', 'join', 'leave']) {
    ch.on('presence', { event: evento }, () => {
      avisar({ type: 'presence', names: nombresPresentes(), presentes: presentes() });
    });
  }
  return ch;
}

// Reintentos con espera creciente, igual que en el escritorio: la red se cae
// sola (wifi, suspensión) y sin reintentar el chat se quedaría muerto.
let reintentos = 0;
let temporizador = null;
const ESPERA_MIN = 5000;
const ESPERA_MAX = 5 * 60 * 1000;

function suscribir() {
  if (!canal) return;
  canal.subscribe(async (status, err) => {
    const antes = conectado;
    conectado = status === 'SUBSCRIBED';

    if (conectado) {
      reintentos = 0;
      if (!antes) console.log('[chat] canal: conectado');
      avisar({ type: 'status', connected: true, reason: status });
      // Sólo una vez por canal: repetir el anuncio no reemplaza la entrada
      // anterior en la presencia, la duplica.
      if (!anunciado) {
        try {
          await canal.track({ name: miNombre, at: Date.now() });
          anunciado = true;
        } catch (e) {
          console.error('[chat] no se pudo anunciar la presencia:', e);
        }
      }
      avisar({ type: 'presence', names: nombresPresentes(), presentes: presentes() });
      return;
    }

    console.log(`[chat] canal: ${status}${err ? ` (${err.message || err})` : ''}`);
    avisar({ type: 'status', connected: false, reason: status });
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      programarReintento();
    }
  });
}

function programarReintento() {
  if (temporizador) return;
  const espera = Math.min(ESPERA_MAX, ESPERA_MIN * Math.pow(2, reintentos));
  reintentos++;
  console.log(`[chat] reintentando en ${Math.round(espera / 1000)}s (intento ${reintentos})`);
  temporizador = setTimeout(() => {
    temporizador = null;
    if (!cliente || !canal) return;
    try {
      // Se rehace el canal: reutilizar uno que ya falló no vuelve a conectar.
      cliente.removeChannel(canal);
      canal = crearCanal();
      suscribir();
    } catch (e) {
      console.error('[chat] fallo al reconectar:', e.message);
      programarReintento();
    }
  }, espera);
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
  if (!canal || !conectado) return [];
  try {
    const estado = canal.presenceState() || {};
    const salida = [];
    const vistos = new Set();
    for (const [clave, metas] of Object.entries(estado)) {
      if (clave === miClave) continue;
      for (const m of metas) {
        // Un mismo pato puede figurar varias veces: le pasa a quien siga con una
        // versión que se anunciaba de más.
        if (!m || !m.name || vistos.has(clave)) continue;
        vistos.add(clave);
        salida.push({ clave: String(clave), nombre: String(m.name) });
      }
    }
    return salida;
  } catch {
    return [];
  }
}

/** Nombres de los demás patos conectados (excluye el propio). */
function nombresPresentes() {
  return presentes().map((p) => p.nombre);
}

// ---- Visitas -------------------------------------------------------------

const GESTOS = ['saludo', 'regalo'];

/**
 * Deja una visita en lo que se puede enseñar sin sustos. Igual que
 * `limpiarVisita` en src/main/chat.js: los dos extremos del canal recortan lo
 * mismo. El diseño se comprueba más adelante, ya en el pato, que es quien sabe
 * qué diseños existen.
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

function enviarVisita(v) {
  if (!canal || !conectado || !v || !v.aClave) {
    console.warn('[chat] NO se envía la visita: el canal no está conectado');
    return;
  }
  canal.send({
    type: 'broadcast',
    event: 'visita',
    payload: limpiarVisita({ ...v, deClave: miClave })
  });
}

// ---- Puente con el panel ------------------------------------------------

chrome.runtime.onConnect.addListener((puerto) => {
  // El panel abre además este puerto para que el árbitro sepa que existe y en
  // qué ventana está. Que se caiga el puerto es la señal de que se ha cerrado:
  // no hay ninguna API que lo pregunte.
  if (puerto.name === 'panel') {
    let ventanaDelPanel = null;
    puerto.onMessage.addListener((msg) => {
      if (msg && msg.tipo === 'hola' && msg.windowId != null) {
        ventanaDelPanel = msg.windowId;
        panelesAbiertos.set(ventanaDelPanel, puerto);
        recalcular();
      }
    });
    puerto.onDisconnect.addListener(async () => {
      if (ventanaDelPanel != null) panelesAbiertos.delete(ventanaDelPanel);
      // El panel se ha cerrado (o el worker se recicló). Si el pato estaba ahí, ya
      // no está en ninguna parte: se olvida, para que el árbitro lo mande a la
      // pestaña en vez de creer que sigue en un panel que no existe.
      const titular = await titularActual();
      if (titular && titular.tipo === 'panel' && titular.windowId === ventanaDelPanel) {
        await anotarTitular(null);
      }
      recalcular();
    });
    return;
  }

  if (puerto.name !== 'chat') return;
  puertos.add(puerto);
  puerto.onDisconnect.addListener(() => puertos.delete(puerto));

  puerto.onMessage.addListener(async (msg) => {
    if (!msg) return;
    if (msg.tipo === 'enviar') {
      enviar(msg.msg);
    } else if (msg.tipo === 'visita') {
      enviarVisita(msg.visita);
    } else if (msg.tipo === 'nombre') {
      await ponerNombre(msg.nombre);
    }
  });

  // El pato puede llegar con el canal ya conectado: se le pone al día en cuanto
  // aparece, que si no se quedaría creyendo que no hay chat. Y con el histórico
  // de la sesión, que él acaba de estrenar documento y no recuerda nada.
  iniciar().then(async () => {
    puerto.postMessage({ type: 'status', connected: conectado, reason: 'sync' });
    puerto.postMessage({ type: 'presence', names: nombresPresentes(), presentes: presentes() });
    const mensajes = await leerHistorial();
    if (mensajes.length) puerto.postMessage({ type: 'historial', mensajes });
  });
});

function enviar(msg) {
  if (!msg) return;
  const texto = String(msg.text || '').slice(0, 280);
  if (!texto.trim()) return;

  // Callarse sin decir nada es lo peor que puede hacer un chat: si no se puede
  // enviar, que al menos quede escrito por qué.
  if (!canal || !conectado) {
    console.warn(`[chat] NO se envía "${texto}": el canal no está conectado ` +
      `(canal=${!!canal}, conectado=${conectado})`);
    return;
  }

  console.log(`[chat] enviando: ${msg.from}: ${texto}`);
  const propio = { from: String(msg.from || 'Pato').slice(0, 40), text: texto, ts: Date.now() };
  canal.send({ type: 'broadcast', event: 'chat', payload: propio });
  // Lo dicho por uno mismo también es conversación: si no, al mudarse de
  // pestaña el histórico quedaría lleno de respuestas sin pregunta.
  anotarEnHistorial({ ...propio, propio: true });
}

async function ponerNombre(nombre) {
  const nuevo = String(nombre || '').slice(0, 40);
  // Anunciarse otra vez con el mismo nombre deja una entrada de más en la
  // presencia: el pato aparecería repetido en la lista de conectados.
  if (nuevo === miNombre && anunciado) return;
  miNombre = nuevo;
  if (canal && conectado) {
    try {
      await canal.track({ name: miNombre, at: Date.now() });
      anunciado = true;
    } catch (err) {
      console.error('[chat] no se pudo actualizar el nombre:', err);
    }
  }
}

chrome.runtime.onMessage.addListener((msg, _emisor, responder) => {
  if (!msg) return false;
  if (msg.tipo === 'estado') {
    // El histórico viaja también aquí, y no sólo al abrirse el puerto: el pato
    // instala sus oyentes DESPUÉS de abrirlo, así que un envío que llegue justo
    // en medio se perdería. Al preguntar él, no hay carrera que valga.
    iniciar()
      .then(() => leerHistorial())
      .then((historial) => responder({
        connected: conectado,
        names: nombresPresentes(),
        presentes: presentes(),
        clave: miClave,
        historial
      }));
    return true;   // la respuesta llega de forma asíncrona
  }
  if (msg.tipo === 'abrir' && typeof msg.url === 'string' && /^https?:\/\//.test(msg.url)) {
    chrome.tabs.create({ url: msg.url });
    return false;
  }
  return false;
});

// ---- Árbitro: dónde vive el pato ----------------------------------------
//
// Hay UN pato. Vive en la ventana que tenga el foco: en su panel lateral si está
// abierto, y si no en su pestaña activa. Así nunca hay dos, que serían el mismo
// pato guardando su estado dos veces y hablando por duplicado.
//
// El estado (stats, nivel, diseño) no está aquí: vive en chrome.storage, así que
// mudarse es sólo cuestión de dónde se dibuja.

const CLAVE_VISIBLE = 'visible';
// Dónde está el pato ahora mismo. Va en storage.session y no en una variable
// porque Manifest V3 recicla el service worker a los 30 segundos de inactividad:
// si esto viviera sólo en memoria, al despertar no sabría a quién echar ni dónde
// estaba el pato, y a partir de la primera siesta dejaría de mudarse bien.
const CLAVE_TITULAR = 'titular';

// Sitios donde Chrome no deja entrar. No es una elección nuestra.
const ESQUEMAS_VETADOS = /^(chrome|chrome-extension|edge|about|view-source|devtools|moz-extension|data):/i;
const TIENDA = /^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore)/i;

let visible = true;
/** windowId → puerto del panel abierto en esa ventana. Esto sí puede vivir en
 *  memoria: los puertos se caen cuando el worker se recicla, y los paneles se
 *  vuelven a anunciar solos. */
const panelesAbiertos = new Map();

/** @typedef {{tipo:'panel'|'pagina', windowId:number, tabId?:number}} Sitio */

/** @returns {Promise<Sitio|null>} */
async function titularActual() {
  try {
    const g = await chrome.storage.session.get(CLAVE_TITULAR);
    return g[CLAVE_TITULAR] || null;
  } catch {
    return null;
  }
}

async function anotarTitular(sitio) {
  try {
    await chrome.storage.session.set({ [CLAVE_TITULAR]: sitio || null });
  } catch (err) {
    console.warn('[pato] no se pudo anotar dónde está:', err);
  }
}

function sePuedeEntrar(url) {
  if (!url) return false;
  if (ESQUEMAS_VETADOS.test(url) || TIENDA.test(url)) return false;
  return /^(https?|file):/i.test(url);
}

async function dondeToca() {
  if (!visible) return null;

  let ventana;
  try {
    ventana = await chrome.windows.getLastFocused();
  } catch {
    return null;
  }
  if (!ventana) return null;

  if (panelesAbiertos.has(ventana.id)) {
    return { tipo: 'panel', windowId: ventana.id };
  }

  let pestañas;
  try {
    pestañas = await chrome.tabs.query({ active: true, windowId: ventana.id });
  } catch {
    return null;
  }
  const pestaña = pestañas && pestañas[0];
  if (!pestaña || !sePuedeEntrar(pestaña.url)) return null;
  return { tipo: 'pagina', windowId: ventana.id, tabId: pestaña.id };
}

function elMismoSitio(a, b) {
  if (!a || !b) return a === b;
  return a.tipo === b.tipo && a.windowId === b.windowId && a.tabId === b.tabId;
}

// Los eventos llegan a rachas (cambiar de ventana dispara varios), así que se
// serializa: si entra otro mientras hay uno en marcha, se recalcula al acabar.
let recalculando = false;
let hayQueRepetir = false;

async function recalcular() {
  if (recalculando) {
    hayQueRepetir = true;
    return;
  }
  recalculando = true;
  try {
    const titular = await titularActual();
    const destino = await dondeToca();
    if (!elMismoSitio(destino, titular)) {
      console.log(`[pato] se muda: ${describir(titular)} → ${describir(destino)}`);
      await echarDe(titular);
      await anotarTitular(destino);
      const entro = await instalarEn(destino);
      // Si no se pudo entrar, el pato no está en ninguna parte: hay que decirlo,
      // porque si no el árbitro creería que sigue ahí y no volvería a intentarlo.
      if (!entro) await anotarTitular(null);
    }
  } catch (err) {
    console.error('[pato] el árbitro falló:', err);
  } finally {
    recalculando = false;
    if (hayQueRepetir) {
      hayQueRepetir = false;
      recalcular();
    }
  }
}

function describir(sitio) {
  if (!sitio) return 'ninguna parte';
  return sitio.tipo === 'panel'
    ? `panel de la ventana ${sitio.windowId}`
    : `pestaña ${sitio.tabId}`;
}

async function echarDe(sitio) {
  if (!sitio) return;
  if (sitio.tipo === 'panel') {
    const puerto = panelesAbiertos.get(sitio.windowId);
    if (puerto) {
      try { puerto.postMessage({ tipo: 'desmontar' }); } catch { /* ya se fue */ }
    }
    return;
  }
  // Se ejecuta el desmontador que el content script dejó puesto, en vez de
  // mandarle un mensaje: si no hubiera nadie escuchando —porque el pato aún
  // estaba montándose, o porque el worker durmió entre medias— el mensaje se
  // perdería y la pestaña se quedaría marcada como ocupada para siempre, sin
  // volver a aceptar al pato.
  try {
    await chrome.scripting.executeScript({
      target: { tabId: sitio.tabId },
      func: () => {
        if (typeof window.__tucuackDesmontar === 'function') window.__tucuackDesmontar();
      }
    });
  } catch {
    // La pestaña puede haberse cerrado o navegado: entonces ya no hay pato.
  }
}

/** @returns {Promise<boolean>} si el pato quedó instalado */
async function instalarEn(sitio) {
  if (!sitio) return false;
  if (sitio.tipo === 'panel') {
    const puerto = panelesAbiertos.get(sitio.windowId);
    if (!puerto) return false;
    try {
      puerto.postMessage({ tipo: 'montar' });
      return true;
    } catch {
      return false;
    }
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId: sitio.tabId },
      files: ['content.js']
    });
    return true;
  } catch (err) {
    // Hay páginas que parecen normales y no lo son (una descarga, un visor, un
    // sitio que se cerró a medias). Se anota y el pato espera al siguiente sitio.
    console.log('[pato] no se pudo entrar en la pestaña:', err.message);
    return false;
  }
}

chrome.tabs.onActivated.addListener(() => recalcular());
chrome.windows.onFocusChanged.addListener(() => recalcular());
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const titular = await titularActual();
  if (titular && titular.tabId === tabId) await anotarTitular(null);
  recalcular();
});
// Al navegar, el content script se va con la página anterior: si esa pestaña era
// la del pato, hay que volver a entrar.
chrome.tabs.onUpdated.addListener(async (tabId, cambios) => {
  if (cambios.status !== 'complete') return;
  const titular = await titularActual();
  if (titular && titular.tipo === 'pagina' && titular.tabId === tabId) {
    await anotarTitular(null);
  }
  recalcular();
});

// ---- Mostrar / ocultar --------------------------------------------------

const ID_MENU = 'tucuack-alternar';

function textoDelMenu() {
  return visible ? 'Ocultar el pato' : 'Mostrar el pato';
}

function refrescarMenu() {
  chrome.contextMenus.update(ID_MENU, { title: textoDelMenu() })
    .catch(() => { /* el menú aún no existe */ });
}

async function crearMenu() {
  try {
    await chrome.contextMenus.removeAll();
    chrome.contextMenus.create({
      id: ID_MENU,
      title: textoDelMenu(),
      // Sólo en el icono de la extensión: no ensuciamos el menú de las páginas.
      contexts: ['action']
    });
  } catch (err) {
    console.error('[pato] no se pudo crear el menú:', err);
  }
}

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== ID_MENU) return;
  visible = !visible;
  await chrome.storage.local.set({ [CLAVE_VISIBLE]: visible });
  refrescarMenu();
  recalcular();
});

// ---- Ciclo de vida ------------------------------------------------------

async function arrancar() {
  const guardado = await chrome.storage.local.get(CLAVE_VISIBLE);
  visible = guardado[CLAVE_VISIBLE] !== false;   // por defecto, visible
  await crearMenu();
  iniciar();

  // Un momento antes de repartir. Si el worker acaba de despertar de una siesta,
  // los puertos de los paneles se cayeron con él y tardan un instante en volver a
  // anunciarse; sin esta pausa el árbitro creería que no hay ningún panel abierto
  // y mandaría el pato a la pestaña para devolverlo acto seguido.
  setTimeout(recalcular, 500);
}

/**
 * Barre los patos que dejó la versión anterior de la extensión.
 *
 * Al recargarla, los content scripts que ya estaban en las pestañas siguen
 * ejecutándose pero desconectados de la extensión: no se les puede dar ninguna
 * orden. Lo que sí se puede es quitarles el nodo del documento, que es compartido.
 * Ellos se dan cuenta y se retiran.
 */
async function barrerHuerfanos() {
  let pestañas = [];
  try {
    pestañas = await chrome.tabs.query({});
  } catch {
    return;
  }
  const barridos = await Promise.all(pestañas.map(async (p) => {
    if (!sePuedeEntrar(p.url)) return false;
    try {
      await chrome.scripting.executeScript({
        target: { tabId: p.id },
        func: () => {
          const previo = document.getElementById('tucuack-pato-anfitrion');
          if (previo) previo.remove();
        }
      });
      return true;
    } catch {
      return false;
    }
  }));
  const n = barridos.filter(Boolean).length;
  if (n) console.log(`[pato] repasadas ${n} pestañas por si quedaban patos de la versión anterior`);
}

// Pulsar el icono abre el panel; mostrar/ocultar va en su menú contextual.
chrome.runtime.onInstalled.addListener(async () => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.error('[panel] no se pudo configurar la apertura:', err));

  // Recién instalada o recién recargada: no hay ningún pato válido en ninguna
  // parte, así que lo anotado antes es mentira. Sin esto, el árbitro creería que
  // el pato sigue en una pestaña donde sólo queda un fantasma, y no volvería a
  // mandarlo allí.
  await anotarTitular(null);
  await barrerHuerfanos();
  arrancar();
});

chrome.runtime.onStartup.addListener(() => { arrancar(); });

arrancar();
