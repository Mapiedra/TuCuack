// app.js — arranque del renderer: monta el pato, arranca los bucles y cablea
// interacción, Tamagotchi, chat y eventos del sistema.

import { Duck } from './pet/Duck.js';
import { Behavior } from './pet/behavior.js';
import { Tamagotchi } from './game/Tamagotchi.js';
import { updateBubbles } from './ui/bubbles.js';
import { showContextMenu, closeContextMenu } from './ui/contextMenu.js';
import { buildStatsPanel } from './ui/panels.js';
import { buildSettingsPanel } from './ui/settings.js';
import { openChatInput } from './ui/chatInput.js';
import { showStatsTooltip, hideStatsTooltip } from './ui/tooltip.js';
import { buildSkinsPanel } from './ui/skinsPanel.js';
import { Level } from './game/Level.js';
import { SKINS, skinPorId, estaDesbloqueada, SKIN_POR_DEFECTO } from './game/skins.js';
import { ChatClient } from './chat/chatClient.js';
import { SpeechBubbles } from './chat/speechBubble.js';

const api = window.pato;

let duck, behavior, tam, chat, speech, level;
let settings = { displayName: '', autoLaunch: false };
let config = { version: '0.0.0', isDev: false };

// ---- Estado de interacción ----------------------------------------------
let dragging = false;
let flying = false;          // en el aire: volando/botando tras un lanzamiento
let vx = 0;                  // velocidad en px/s
let vy = 0;
const trail = [];            // muestras recientes del cursor (para la inercia)
const VELOCITY_WINDOW = 90;  // ms sobre los que se promedia la velocidad
let overHot = false;         // sobre el pato o sobre un panel/menú
let overDuck = false;        // sobre el pato en concreto (para el cursor)
let lastCursor = '';
let hoverTimer = null;       // cuenta atrás para mostrar las stats en un tooltip
let grab = { x: 0, y: 0 };
const openOverlays = new Set(); // menús/paneles/inputs abiertos

function updateMouseCapture() {
  // El overlay captura el ratón si: arrastramos, hay un panel abierto, o el
  // cursor está sobre el pato o una zona interactiva. Si no, deja pasar clics.
  const capture = dragging || openOverlays.size > 0 || overHot;
  api.setIgnoreMouse(!capture);
  updateCursor();
}

/** Mano abierta al pasar por encima del pato, cerrada mientras se arrastra. */
function updateCursor() {
  const c = dragging ? 'grabbing' : (overDuck ? 'grab' : 'default');
  if (c !== lastCursor) {
    lastCursor = c;
    document.body.style.cursor = c;
  }
}

function registerOverlay(el) {
  openOverlays.add(el);
  updateMouseCapture();
}
function unregisterOverlay(el) {
  openOverlays.delete(el);
  if (el) {
    el.dispatchEvent(new Event('panel:cerrado'));
    if (el.remove) el.remove();
  }
  updateMouseCapture();
}

// ---- Hit-test -----------------------------------------------------------
function pointInRect(px, py, rect) {
  return px >= rect.left && px <= rect.right && py >= rect.top && py <= rect.bottom;
}
function isOverHotElement(target) {
  return target && target.closest && target.closest('.hot');
}
function computeOverHot(px, py) {
  if (duck.hitTest(px, py)) return true;
  for (const el of document.querySelectorAll('.hot')) {
    if (pointInRect(px, py, el.getBoundingClientRect())) return true;
  }
  return false;
}

// ---- Bootstrap ----------------------------------------------------------
async function main() {
  config = await api.getConfig();
  settings = await api.loadSettings();
  const saved = await api.loadState();

  // Primer arranque: el pato necesita un nombre para el chat. Se propone uno
  // con sufijo aleatorio para que dos instalaciones no choquen de salida; el
  // usuario puede cambiarlo en Ajustes.
  if (!(settings.displayName || '').trim()) {
    settings.displayName = `Pato-${Math.floor(1000 + Math.random() * 9000)}`;
    api.saveSettings(settings);
  }

  // El suelo es la parte superior de la barra de tareas: el pato camina ahí y
  // el overlay ocupa toda la pantalla para poder arrastrarlo a cualquier punto.
  // Experiencia y diseño elegido (si el guardado apunta a uno que ya no está
  // desbloqueado o no existe, se vuelve al de por defecto).
  level = new Level(saved.level);
  const skin = skinPorId(settings.skin);
  const skinValida = skin && estaDesbloqueada(skin, level.nivel) ? skin.id : SKIN_POR_DEFECTO;

  duck = new Duck(
    document.getElementById('duck'),
    document.getElementById('duckCanvas'),
    config.ground || 0,
    skinValida,
    config.sprites            // metadatos de cada diseño
  );
  duck.setX(Math.min(window.innerWidth - duck.width - 40, 260));
  api.onLayoutChanged((d) => duck.setGround(d && d.ground));

  // El pato ha cruzado a otro monitor mientras se arrastraba: la ventana ya se
  // ha mudado, así que sólo hay que recolocarlo bajo el cursor y ajustar el
  // suelo del monitor nuevo.
  api.onDisplayChanged((d) => {
    if (!d) return;
    duck.setGround(d.ground);
    if (d.cursor) {
      duck.setDragTransition(false);
      duck.setX(d.cursor.x - grab.x);
      duck.setY((window.innerHeight - d.cursor.y) + grab.y);
    }
  });

  tam = new Tamagotchi(saved.stats);
  tam.applyOfflineDecay(saved.savedAt);

  behavior = new Behavior(duck, tam);

  speech = new SpeechBubbles(document.getElementById('speechLayer'));
  const statusBubbles = document.getElementById('statusBubbles');

  // Reacciones del Tamagotchi a las acciones → animación del pato.
  tam.on('action', (kind) => {
    if (kind === 'eat') behavior.playOnce('eat', 1.8);
    else if (kind === 'play') behavior.playOnce('play', 1.8);   // golpe de bate
    else if (kind === 'happy') behavior.playOnce('happy', 1.4); // saludo con el ala
    else if (kind === 'sleep' || kind === 'wake') behavior.refresh();
  });

  // Al subir de nivel se avisa, y se cuenta si eso ha desbloqueado un diseño.
  level.on('nivel', ({ nivel, rango }) => {
    const nuevas = SKINS.filter((s) => s.nivel === nivel);
    const extra = nuevas.length
      ? `<br>Nuevo diseño: <b>${nuevas.map((s) => s.nombre).join(', ')}</b>`
      : '';
    avisoNivel(`¡Nivel <b>${nivel}</b>! · ${rango}${extra}`);
    behavior.playOnce('happy', 1.6);
  });

  setupChat();
  setupInteraction();
  setupTray();
  setupUpdates();

  // Guardado al salir.
  api.onBeforeQuit(() => saveNow());

  // Hook de depuración: permite probar desde fuera acciones que normalmente
  // requieren ratón (p. ej. soltar el pato desde arriba para ver el planeo).
  if (config.isDev) {
    window.__pato = {
      duck, behavior, tam,
      /** Lanza el pato desde (x,y) con una velocidad dada, como si se soltara. */
      throwFrom(x, y, vx0 = 0, vy0 = 0) {
        behavior.lock();
        duck.setDragTransition(false);
        if (x != null) duck.setX(x);
        duck.setY(y);
        dragging = false;
        flying = true;
        vx = vx0;
        vy = vy0;
        duck.setState('fall');
      },
      state: () => ({ x: duck.x, y: duck.y, vx, vy, flying }),
      hover: () => ({ overDuck, overHot, dragging, cursor: lastCursor,
                      paneles: openOverlays.size, timer: !!hoverTimer }),
      verTooltip: () => showStatsTooltip(tam, duckName(), duckAnchor(), level),
      verMenu: () => { const p = duckAnchor(); openDuckMenu(p.x, p.y); },
      verSkins: () => { const p = duckAnchor(); openSkins(p.x, p.y); },
      verStats: () => { const p = duckAnchor(); openStats(p.x, p.y); },
      level,
      darXp: (n) => { level.xp += n; return level.nivel; },
      act: doAction,
      chat,
      speech,
      decir: (from, text) => speech.show(from, text, { self: false }),
      settings: () => settings,
      name: duckName
    };
  }

  startLoops(statusBubbles);
}

// ---- Bucles -------------------------------------------------------------
function startLoops(statusBubbles) {
  let last = performance.now();
  const frame = (t) => {
    const dt = Math.min((t - last) / 1000, 0.1);
    last = t;
    updateFlight(dt);
    behavior.update(dt);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // Decaimiento de necesidades y experiencia por convivencia (1 s).
  setInterval(() => {
    tam.tick(1);
    level.convivencia(1, tam.mood() === 'contento');
  }, 1000);

  // Burbuja de ánimo (2 s).
  setInterval(() => {
    if (!dragging) updateBubbles(statusBubbles, tam.mood());
  }, 2000);
  updateBubbles(statusBubbles, tam.mood());

  // Guardado periódico (15 s).
  setInterval(saveNow, 15000);
}

function saveNow() {
  api.saveState({ stats: tam.stats, level: level.toJSON() });
}

// ---- Interacción: arrastre + menú clic derecho --------------------------
function setupInteraction() {
  document.addEventListener('mousemove', (e) => {
    if (dragging) {
      // Si el botón se soltó fuera de la ventana (p. ej. justo al cruzar de
      // monitor), el mouseup no llega y el pato se quedaría pegado al cursor.
      if (e.buttons === 0) { endDrag(); return; }
      duck.setX(e.clientX - grab.x);
      duck.setY((window.innerHeight - e.clientY) + grab.y);
      pushTrail(e);           // para calcular la inercia al soltar
      // Mira hacia donde se le está moviendo.
      if (trail.length >= 2) {
        const dx = trail[trail.length - 1].x - trail[0].x;
        if (Math.abs(dx) > 8) duck.setFacing(dx > 0 ? 1 : -1);
      }
      return;
    }
    const sobreElPato = duck.hitTest(e.clientX, e.clientY);
    if (sobreElPato !== overDuck) {
      overDuck = sobreElPato;
      // El pato se para mientras lo señalas, para no escaparse del cursor.
      if (behavior) behavior.setPaused(sobreElPato);
      if (sobreElPato) armarTooltip(); else cancelarTooltip();
    }
    overHot = sobreElPato || computeOverHot(e.clientX, e.clientY);
    updateMouseCapture();
  });

  document.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (isOverHotElement(e.target)) return; // paneles/menús se gestionan solos
    if (duck.hitTest(e.clientX, e.clientY)) startDrag(e);
  });

  document.addEventListener('mouseup', () => { if (dragging) endDrag(); });

  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (isOverHotElement(e.target)) return;
    // El menú se ancla al pato (no al cursor) y se abre por encima de él.
    if (duck.hitTest(e.clientX, e.clientY)) {
      const p = duckAnchor();
      openDuckMenu(p.x, p.y);
    }
  });

  window.addEventListener('resize', () => {
    duck.setX(duck.x); // re-clamp
  });
}

function startDrag(e) {
  dragging = true;
  flying = false;
  cancelarTooltip();
  grab.x = e.clientX - duck.x;
  grab.y = duck.y - (window.innerHeight - e.clientY);
  trail.length = 0;
  pushTrail(e);
  duck.setDragTransition(false);
  duck.setTilt(0);          // por si se le agarra mientras volaba
  behavior.lock();          // el pato cuelga del cursor
  api.dragStart();          // el main vigila si cruza a otro monitor
  updateMouseCapture();
}

// Muestras recientes del cursor, para saber a qué velocidad se lanza el pato.
function pushTrail(e) {
  const now = performance.now();
  trail.push({ x: e.clientX, y: e.clientY, t: now });
  while (trail.length > 2 && now - trail[0].t > VELOCITY_WINDOW) trail.shift();
}

/** Velocidad del cursor en px/s, promediada en los últimos ms. */
function pointerVelocity() {
  if (trail.length < 2) return { vx: 0, vy: 0 };
  const a = trail[0];
  const b = trail[trail.length - 1];
  const dt = (b.t - a.t) / 1000;
  if (dt <= 0.001) return { vx: 0, vy: 0 };
  // El eje Y del pato crece hacia arriba; el del cursor, hacia abajo.
  return { vx: (b.x - a.x) / dt, vy: -(b.y - a.y) / dt };
}

// Al soltarlo sale despedido con la inercia del ratón y describe una parábola,
// rebotando en el suelo y en los lados. Si se suelta casi quieto, en vez de
// desplomarse planea aleteando hasta posarse.
function endDrag() {
  dragging = false;
  api.dragEnd();
  updateMouseCapture();

  const v = pointerVelocity();
  vx = clamp(v.vx, -MAX_THROW, MAX_THROW);
  vy = clamp(v.vy, -MAX_THROW, MAX_THROW);
  trail.length = 0;

  if (duck.onGround() && Math.abs(vx) < 60 && vy <= 0) {
    behavior.unlock();
    return;
  }
  flying = true;
  duck.setDragTransition(false);
  duck.setState('fall');
  if (Math.abs(vx) > 40) duck.setFacing(vx > 0 ? 1 : -1);
}

// --- Física del vuelo ----------------------------------------------------
const GRAVITY = 1750;          // px/s²
const MAX_THROW = 2600;        // tope de la velocidad de lanzamiento (px/s)
const AIR_DRAG = 0.55;         // rozamiento horizontal (1/s)
const GLIDE_SPEED = 240;       // velocidad de caída cuando planea aleteando
const GLIDE_THRESHOLD = 300;   // por debajo de esta velocidad, aletea y frena
const WALL_BOUNCE = 0.6;       // rebote en los lados
const GROUND_BOUNCE = 0.42;    // rebote contra el suelo
const GROUND_FRICTION = 0.7;   // el suelo frena el avance en cada bote
const REST_SPEED = 70;         // por debajo de esto, deja de botar

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function updateFlight(dt) {
  if (!flying) return;

  vy -= GRAVITY * dt;
  vx -= vx * AIR_DRAG * dt;

  // Cuando va despacio el pato aletea y frena la caída: así un simple soltar
  // se convierte en un aterrizaje suave, mientras que un lanzamiento fuerte
  // conserva su parábola.
  if (Math.hypot(vx, vy) < GLIDE_THRESHOLD && vy < -GLIDE_SPEED) {
    vy = -GLIDE_SPEED;
  }

  let nx = duck.x + vx * dt;
  let ny = duck.y + vy * dt;

  // Rebote en los lados.
  const maxX = window.innerWidth - duck.width;
  if (nx <= 0) { nx = 0; vx = Math.abs(vx) * WALL_BOUNCE; }
  else if (nx >= maxX) { nx = maxX; vx = -Math.abs(vx) * WALL_BOUNCE; }

  // Techo: no se escapa por arriba.
  const maxY = window.innerHeight - duck.height;
  if (ny >= maxY) { ny = maxY; vy = -Math.abs(vy) * 0.35; }

  // Suelo: bota y va perdiendo energía hasta quedarse quieto.
  if (ny <= duck.ground) {
    ny = duck.ground;
    if (Math.abs(vy) > REST_SPEED) {
      vy = Math.abs(vy) * GROUND_BOUNCE;
      vx *= GROUND_FRICTION;
    } else {
      land(nx);
      return;
    }
  }

  duck.setX(nx);
  duck.setY(ny);
  duck.setState('fall');

  // Se inclina hacia donde vuela y mira en esa dirección.
  duck.setTilt(clamp(-vx * 0.035, -45, 45));
  if (Math.abs(vx) > 120) duck.setFacing(vx > 0 ? 1 : -1);
}

function land(nx) {
  flying = false;
  vx = 0;
  vy = 0;
  duck.setX(nx);
  duck.toGround();
  duck.setTilt(0);
  behavior.unlock();
  behavior.playOnce('happy', 0.6);   // se sacude al posarse (tras unlock, que
                                     // si no reiniciaría el estado)
}

function openDuckMenu(x, y) {
  cancelarTooltip();
  const items = [
    { label: '🍞 Alimentar', onClick: () => doAction('feed') },
    { label: '⚽ Jugar', onClick: () => doAction('play') },
    { label: '🧼 Limpiar', onClick: () => doAction('clean') },
    { label: tam.sleeping ? '☀️ Despertar' : '💤 Dormir', onClick: () => doAction('sleep') },
    { sep: true },
    { label: '💬 Hablar…', onClick: () => openTalk(x, y) },
    { label: '📊 Estadísticas', onClick: () => openStats(x, y) },
    { label: `👕 Diseños · Nv ${level.nivel}`, onClick: () => openSkins(x, y) },
    { label: '⚙️ Ajustes…', onClick: () => openSettings(x, y) },
    { sep: true },
    { label: '❌ Salir', onClick: () => api.quit() }
  ];
  let menuEl = null;
  showContextMenu(x, y, items, {
    center: true,          // `x` es el centro del pato
    onClose: () => {
      if (menuEl) openOverlays.delete(menuEl);
      updateMouseCapture();
    }
  });
  // El menú es .hot: computeOverHot ya lo cubre. Lo registramos además por si el
  // cursor quedara estático tras abrirlo.
  menuEl = document.querySelector('.ctx-menu');
  if (menuEl) registerOverlay(menuEl);
}

// ---- Acciones -----------------------------------------------------------
// Necesidad que atiende cada acción, para saber si hacía falta de verdad.
const STAT_DE_ACCION = { feed: 'hunger', play: 'happiness', clean: 'hygiene' };

function doAction(name) {
  // Se mira el valor ANTES de actuar: sólo da experiencia si estaba bajo, así
  // machacar el botón con la barra llena no sirve de nada.
  const stat = STAT_DE_ACCION[name];
  const previo = stat ? tam.stats[stat] : null;

  let hecho = false;
  if (name === 'feed') hecho = tam.feed();
  else if (name === 'play') hecho = tam.play();
  else if (name === 'clean') hecho = tam.clean();
  else if (name === 'sleep') hecho = tam.toggleSleep();

  if (hecho && previo != null) level.cuidado(previo);
}

// ---- Paneles ------------------------------------------------------------
/** Cierra el panel y vuelve al menú del pato, desde donde se abrió. */
function volverAlMenu(el, x, y) {
  unregisterOverlay(el);
  openDuckMenu(x, y);
}

function openStats(x, y) {
  const { el } = buildStatsPanel(tam, {
    onAction: doAction,
    name: duckName(),
    level,
    onBack: () => volverAlMenu(el, x, y),
    onClose: () => unregisterOverlay(el)
  });
  mountPanel(el, x, y);
}

function openSettings(x, y) {
  const { el } = buildSettingsPanel(settings, config.version, {
    isNameTaken: (n) => chat.isNameTaken(n),
    chatReady: chat.connected,
    onSave: (s) => {
      settings = { ...settings, ...s };
      api.saveSettings(settings);
      chat.setName(settings.displayName);   // re-anuncia el nombre en el canal
    },
    onBack: () => volverAlMenu(el, x, y),
    onClose: () => unregisterOverlay(el)
  });
  mountPanel(el, x, y);
}

// ---- Globo de estadísticas al pasar el ratón ----------------------------
const HOVER_MS = 800;   // lo que hay que quedarse quieto encima para que salga

function armarTooltip() {
  cancelarTooltip();
  hoverTimer = setTimeout(() => {
    // Si mientras tanto se ha empezado a arrastrar o hay un panel abierto, no
    // se muestra: sería ruido encima de otra cosa.
    if (!overDuck || dragging || openOverlays.size > 0) return;
    showStatsTooltip(tam, duckName(), duckAnchor(), level);
  }, HOVER_MS);
}

function cancelarTooltip() {
  if (hoverTimer) clearTimeout(hoverTimer);
  hoverTimer = null;
  hideStatsTooltip();
}

/**
 * Punto de anclaje para menús y paneles: centrado sobre el pato y a la altura
 * de su coronilla, para que se abran encima y no le tapen.
 */
function duckAnchor() {
  const r = duck.rect();
  const head = document.getElementById('statusBubbles').getBoundingClientRect();
  return { x: Math.round(r.left + r.width / 2), y: Math.round(head.bottom) };
}

/** Nombre del pato (siempre hay uno: se genera en el primer arranque). */
function duckName() {
  return (settings.displayName || '').trim() || 'Pato';
}

function openSkins(x, y) {
  const { el } = buildSkinsPanel(level, duck.skinId, {
    onElegir: (id) => {
      duck.setSkin(id);
      settings = { ...settings, skin: id };
      api.saveSettings(settings);
    },
    onBack: () => volverAlMenu(el, x, y),
    onClose: () => unregisterOverlay(el)
  });
  mountPanel(el, x, y);
}

/** Cartelito de subida de nivel, sobre el pato. */
function avisoNivel(html) {
  const el = document.createElement('div');
  el.className = 'levelup';
  el.innerHTML = html;      // sólo texto propio, sin datos de terceros
  document.body.appendChild(el);
  const a = duckAnchor();
  el.style.left = `${Math.max(8, Math.min(a.x - el.offsetWidth / 2,
    window.innerWidth - el.offsetWidth - 8))}px`;
  el.style.top = `${Math.max(8, a.y - el.offsetHeight - 10)}px`;
  setTimeout(() => el.remove(), 5000);
}

function openTalk(x, y) {
  const { el } = openChatInput(x, y, {
    onSend: (text) => sendChat(text),
    onClose: () => unregisterOverlay(el)
  });
  registerOverlay(el); // openChatInput ya lo añade al DOM y lo posiciona
}

// Añade un panel al DOM, lo centra sobre el punto indicado y por encima de él
// (para no tapar al pato), y lo registra para la captura de ratón.
function mountPanel(el, x, y) {
  el.style.visibility = 'hidden';
  document.body.appendChild(el);
  colocarPanel(el, x, y);
  el.style.visibility = 'visible';

  // Los paneles pueden crecer después de colocarlos (al desplegar la ayuda, por
  // ejemplo) y saldrían de la pantalla: se recolocan cuando cambian de tamaño.
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(() => colocarPanel(el, x, y));
    ro.observe(el);
    el.addEventListener('panel:cerrado', () => ro.disconnect(), { once: true });
  }
  registerOverlay(el);
}

function colocarPanel(el, x, y) {
  // La altura se limita a la ventana; si el contenido no cabe, el panel hace
  // scroll en lugar de desbordarse.
  el.style.maxHeight = `${window.innerHeight - 16}px`;
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const px = Math.min(x - w / 2, window.innerWidth - w - 8);
  let py = y - h - 12;
  if (py < 8) py = Math.min(y + 12, window.innerHeight - h - 8);
  el.style.left = `${Math.max(8, px)}px`;
  el.style.top = `${Math.max(8, py)}px`;
}

// ---- Chat ---------------------------------------------------------------
function setupChat() {
  chat = new ChatClient();
  chat.onMessage((m) => {
    speech.show(m.from, m.text, { self: false });
    if (behavior) behavior.playOnce('talk', 2.2);
  });
  chat.onStatus(() => { /* opcional: indicador de conexión */ });
  // El canal ya puede estar conectado antes de llegar aquí.
  chat.sync();
}

function sendChat(text) {
  // El nivel viaja con el mensaje: es lo que hace que la progresión se vea
  // entre compañeros, que es la gracia de tenerla.
  const name = `${duckName()} · Nv ${level.nivel}`;
  chat.send(name, text);
  speech.show(name, text, { self: true });
  level.chat();
  if (behavior) behavior.playOnce('talk', 2.2);
}

// ---- Bandeja ------------------------------------------------------------
function setupTray() {
  api.onTrayCommand((cmd) => {
    const { x: cx, y: cy } = duckAnchor();
    if (cmd === 'feed' || cmd === 'play' || cmd === 'clean' || cmd === 'sleep') {
      doAction(cmd);
    } else if (cmd === 'stats') openStats(cx, cy);
    else if (cmd === 'settings') openSettings(cx, cy);
  });
}

// ---- Actualizaciones ----------------------------------------------------
function setupUpdates() {
  api.onUpdateEvent((evt) => {
    if (!evt) return;
    if (evt.type === 'available') toast(`Descargando actualización v${evt.version}…`);
    else if (evt.type === 'ready') toast('¡Nueva versión lista! Se aplicará al reiniciar.');
  });
}

function toast(text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

main().catch((err) => console.error('[pato] error al arrancar', err));
