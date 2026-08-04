// app.js — arranque del pato: lo monta, arranca los bucles y cablea
// interacción, Tamagotchi, chat y eventos del sistema.
//
// No sabe dónde vive. Todo lo que necesita del entorno llega por la plataforma
// que le pasa la carcasa (ver `platform.js`), así que el mismo código sirve
// para la ventana de Electron y para la extensión de Chrome.

import { Duck } from './pet/Duck.js';
import { Behavior } from './pet/behavior.js';
import { Tamagotchi, AGOTAMIENTO } from './game/Tamagotchi.js';
import { updateBubbles } from './ui/bubbles.js';
import { showContextMenu, closeContextMenu } from './ui/contextMenu.js';
import { buildStatsPanel } from './ui/panels.js';
import { buildSettingsPanel } from './ui/settings.js';
import { buildTalkPanel } from './ui/talkPanel.js';
import * as historial from './chat/historial.js';
import { showStatsTooltip, hideStatsTooltip } from './ui/tooltip.js';
import { buildStatsView } from './ui/statsView.js';
import { buildSkinsPanel } from './ui/skinsPanel.js';
import { buildOnlinePanel } from './ui/onlinePanel.js';
import { Level } from './game/Level.js';
import { SKINS, skinPorId, estaDesbloqueada, SKIN_POR_DEFECTO } from './game/skins.js';
import { ChatClient } from './chat/chatClient.js';
import { SpeechBubbles } from './chat/speechBubble.js';
import * as sonido from './audio/sounds.js';
import { normalizarPlataforma } from './platform.js';
import { configurarAssets, configurarCargadorSheet } from './assets.js';
import { fijarFactor, normalizarFactor } from './scale.js';
import { porId, todos, uno, montar, elementoVisible, objetivoReal } from './stage.js';

// La instala `arrancarPato`. Hasta entonces, una plataforma que no hace nada,
// para que nada reviente si algo se dispara antes de tiempo.
let api = normalizarPlataforma();

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

// ---- Apagado ------------------------------------------------------------
//
// El pato de escritorio vive hasta que se cierra la app y nunca necesita esto,
// pero en la extensión se muda de pestaña, y al mudarse hay que apagar el de
// antes: si no, quedarían dos bucles guardando el mismo estado a la vez.
const tareasDeApagado = [];

function alApagar(fn) {
  tareasDeApagado.push(fn);
}

/** Añade un listener que se retira solo al apagar el pato. */
function escuchar(objetivo, evento, fn, opciones) {
  objetivo.addEventListener(evento, fn, opciones);
  alApagar(() => objetivo.removeEventListener(evento, fn, opciones));
}

function updateMouseCapture() {
  // Hace falta el ratón si: arrastramos, hay un panel abierto, o el cursor está
  // sobre el pato o una zona interactiva. En el overlay de escritorio eso decide
  // si los clics atraviesan la ventana; donde el pato tiene documento propio, la
  // plataforma lo ignora y sólo queda el cursor.
  const capture = dragging || openOverlays.size > 0 || overHot;
  api.capturarRaton(capture);
  updateCursor();
}

/** Mano abierta al pasar por encima del pato, cerrada mientras se arrastra. */
function updateCursor() {
  const c = dragging ? 'grabbing' : (overDuck ? 'grab' : 'default');
  if (c !== lastCursor) {
    lastCursor = c;
    elementoVisible().style.cursor = c;
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
  for (const el of todos('.hot')) {
    if (pointInRect(px, py, el.getBoundingClientRect())) return true;
  }
  return false;
}

// ---- Bootstrap ----------------------------------------------------------
/**
 * Monta el pato en el documento actual.
 * @param {import('./platform.js').Plataforma} plataforma
 */
export async function arrancarPato(plataforma) {
  api = normalizarPlataforma(plataforma);
  configurarAssets(api.urlAsset);
  if (api.cargarSheet) configurarCargadorSheet(api.cargarSheet);

  config = await api.config();
  settings = await api.cargarAjustes();
  const saved = await api.cargarEstado();

  // Primer arranque: el pato necesita un nombre para el chat. Se propone uno
  // con sufijo aleatorio para que dos instalaciones no choquen de salida; el
  // usuario puede cambiarlo en Ajustes.
  if (!(settings.displayName || '').trim()) {
    settings.displayName = `Pato-${Math.floor(1000 + Math.random() * 9000)}`;
    api.guardarAjustes(settings);
  }

  sonido.setVolumen(settings.volumen != null ? settings.volumen : 0.5);
  sonido.setSilenciado(!!settings.silenciado);

  // El tamaño elegido, antes de montar el pato: se mide a sí mismo al nacer.
  fijarFactor(normalizarFactor(settings.escala));

  // El suelo es la parte superior de la barra de tareas: el pato camina ahí y
  // el overlay ocupa toda la pantalla para poder arrastrarlo a cualquier punto.
  // Experiencia y diseño elegido (si el guardado apunta a uno que ya no está
  // desbloqueado o no existe, se vuelve al de por defecto).
  level = new Level(saved.level);
  const skin = skinPorId(settings.skin);
  const skinValida = skin && estaDesbloqueada(skin, level.nivel) ? skin.id : SKIN_POR_DEFECTO;

  duck = new Duck(
    porId('duck'),
    porId('duckCanvas'),
    config.ground || 0,
    skinValida,
    config.sprites            // metadatos de cada diseño
  );
  // Dónde aparece. Si hay una posición guardada se recupera, y en proporción al
  // ancho: el pato se muda entre pestañas de tamaños distintos, y así no salta de
  // lado ni acaba fuera de la ventana.
  const sitioLibre = Math.max(0, window.innerWidth - duck.width);
  duck.setX(saved.x != null && saved.x >= 0 && saved.x <= 1
    ? Math.round(saved.x * sitioLibre)
    : Math.min(sitioLibre, 260));
  api.alCambiarEscenario((d) => duck.setGround(d && d.ground));

  // El pato ha cruzado a otro monitor mientras se arrastraba: la ventana ya se
  // ha mudado, así que sólo hay que recolocarlo bajo el cursor y ajustar el
  // suelo del monitor nuevo.
  api.alCambiarPantalla((d) => {
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

  speech = new SpeechBubbles(porId('speechLayer'));
  const statusBubbles = porId('statusBubbles');

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
    sonido.fanfarria();
    behavior.playOnce('happy', 1.6);
  });

  setupChat();
  setupInteraction();
  setupTray();
  setupUpdates();

  // Guardado al salir.
  api.alCerrar(() => saveNow());

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
      verConectados: () => { const p = duckAnchor(); openOnline(p.x, p.y); },
      verHablar: () => { const p = duckAnchor(); openTalk(p.x, p.y); },
      verAjustes: () => { const p = duckAnchor(); openSettings(p.x, p.y); },
      level,
      darXp: (n) => { level.xp += n; return level.nivel; },
      act: doAction,
      chat,
      historial,
      speech,
      sonido,
      decir: (from, text) => speech.show(from, text, { self: false }),
      settings: () => settings,
      name: duckName
    };
  }

  startLoops(statusBubbles);

  return { apagar };
}

/**
 * Para el pato y lo deja todo como estaba: sin bucles, sin listeners y sin
 * paneles abiertos. Guarda antes, que es lo último que hace un pato educado.
 */
function apagar() {
  try {
    saveNow();
  } catch (err) {
    console.warn('[pato] no se pudo guardar al apagar', err);
  }

  cancelarTooltip();
  closeContextMenu();
  for (const el of [...openOverlays]) unregisterOverlay(el);
  // El animador de sprites corre en su propio bucle, aparte del del pato.
  if (duck) duck.detener();
  // Y el chat puede tener un puente abierto con quien mantenga la conexión.
  if (api.chat && api.chat.cerrar) api.chat.cerrar();

  for (const fn of tareasDeApagado.splice(0)) {
    try {
      fn();
    } catch (err) {
      console.warn('[pato] fallo al apagar', err);
    }
  }
}

// ---- Bucles -------------------------------------------------------------
function startLoops(statusBubbles) {
  let last = performance.now();
  let pedido = 0;
  const frame = (t) => {
    const dt = Math.min((t - last) / 1000, 0.1);
    last = t;
    updateFlight(dt);
    behavior.update(dt);
    pedido = requestAnimationFrame(frame);
  };
  pedido = requestAnimationFrame(frame);
  alApagar(() => cancelAnimationFrame(pedido));

  // Decaimiento de necesidades y experiencia por convivencia (1 s).
  cadaCierto(() => {
    tam.tick(1);
    level.convivencia(1, tam.mood() === 'contento');
  }, 1000);

  // Burbuja de ánimo (2 s).
  cadaCierto(() => {
    if (!dragging) updateBubbles(statusBubbles, tam.mood());
  }, 2000);
  updateBubbles(statusBubbles, tam.mood());

  // Guardado periódico (15 s).
  cadaCierto(saveNow, 15000);
}

/** setInterval que se para solo cuando el pato se apaga. */
function cadaCierto(fn, ms) {
  const id = setInterval(fn, ms);
  alApagar(() => clearInterval(id));
}

function saveNow() {
  const sitioLibre = Math.max(1, window.innerWidth - duck.width);
  api.guardarEstado({
    stats: tam.stats,
    level: level.toJSON(),
    // Como proporción del sitio disponible, no en píxeles: la ventana de la
    // pestaña siguiente no tiene por qué medir lo mismo.
    x: Math.min(1, Math.max(0, duck.x / sitioLibre))
  });
}

// ---- Interacción: arrastre + menú clic derecho --------------------------
function setupInteraction() {
  escuchar(document, 'mousemove', (e) => {
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

  escuchar(document, 'mousedown', (e) => {
    if (e.button !== 0) return;
    if (isOverHotElement(objetivoReal(e))) return; // paneles/menús se gestionan solos
    if (duck.hitTest(e.clientX, e.clientY)) startDrag(e);
  });

  escuchar(document, 'mouseup', () => { if (dragging) endDrag(); });

  escuchar(document, 'contextmenu', (e) => {
    e.preventDefault();
    if (isOverHotElement(objetivoReal(e))) return;
    // El menú se ancla al pato (no al cursor) y se abre por encima de él.
    if (duck.hitTest(e.clientX, e.clientY)) {
      const p = duckAnchor();
      openDuckMenu(p.x, p.y);
    }
  });

  escuchar(window, 'resize', () => {
    duck.medir();      // la escala puede depender del hueco disponible
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
  api.empezarArrastre();    // donde haya varios monitores, se vigila si cruza
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
  api.terminarArrastre();
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
    sonido.aleteo();          // sólo suena mientras aletea para frenar
  }

  let nx = duck.x + vx * dt;
  let ny = duck.y + vy * dt;

  // Rebote en los lados.
  const maxX = window.innerWidth - duck.width;
  if (nx <= 0 || nx >= maxX) {
    nx = nx <= 0 ? 0 : maxX;
    vx = (nx === 0 ? Math.abs(vx) : -Math.abs(vx)) * WALL_BOUNCE;
    sonido.boing(Math.abs(vx) / MAX_THROW);
  }

  // Techo: no se escapa por arriba.
  const maxY = window.innerHeight - duck.height;
  if (ny >= maxY) { ny = maxY; vy = -Math.abs(vy) * 0.35; }

  // Suelo: bota y va perdiendo energía hasta quedarse quieto.
  if (ny <= duck.ground) {
    ny = duck.ground;
    if (Math.abs(vy) > REST_SPEED) {
      sonido.boing(Math.abs(vy) / MAX_THROW);
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
  // Cuidar al pato ya no son opciones del menú: se hace desde la botonera de la
  // cabecera, con las barras delante y sin que el menú se cierre en cada gesto.
  const items = [
    { label: '💬 Hablar…', onClick: () => openTalk(x, y) },
    { label: etiquetaConectados(), onClick: () => openOnline(x, y) },
    { label: '👕 Diseños', onClick: () => openSkins(x, y) },
    { label: '⚙️ Ajustes…', onClick: () => openSettings(x, y) }
  ];
  // "Salir" sólo donde hay algo de lo que salir: en una extensión el pato no
  // tiene proceso propio que cerrar.
  if (api.capacidades.salir) {
    items.push({ sep: true }, { label: '❌ Salir', ancho: true, onClick: () => api.salir() });
  }

  // La misma vista que sale al dejar el ratón sobre el pato, aquí con botonera:
  // con el menú abierto el globo no aparece, y decidir a ciegas qué le hace
  // falta no tenía ningún sentido.
  const vista = buildStatsView(tam, duckName(), level, { onAction: doAction });

  let menuEl = null;
  showContextMenu(x, y, items, {
    cabecera: vista.el,
    columnas: 2,           // la cabecera es ancha: las opciones caben a dos
    center: true,          // `x` es el centro del pato
    onClose: () => {
      vista.destroy();
      if (menuEl) openOverlays.delete(menuEl);
      updateMouseCapture();
    }
  });
  // El menú es .hot: computeOverHot ya lo cubre. Lo registramos además por si el
  // cursor quedara estático tras abrirlo.
  menuEl = uno('.ctx-menu');
  if (menuEl) registerOverlay(menuEl);
}

// ---- Acciones -----------------------------------------------------------
// Necesidad que atiende cada acción, para saber si hacía falta de verdad.
const STAT_DE_ACCION = { feed: 'hunger', play: 'happiness', clean: 'hygiene' };

function doAction(name) {
  // Agotado no hay nada que hacer con él. Se dice, porque la orden también
  // puede venir de la bandeja, donde no hay forma de apagar la opción y el
  // silencio parecería un botón roto.
  if (tam.agotado) {
    toast(`Está agotado: duerme hasta recuperar el ${AGOTAMIENTO.DESPIERTA} % de energía.`);
    return;
  }

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
    puedeAutoArrancar: api.capacidades.autoArranque,
    // El tamaño se ve al momento mientras se mueve el control, y se guarda ya:
    // si el pato queda enorme, cerrar el panel sin más no debería perder el
    // ajuste con el que el usuario se ha quedado.
    onEscala: (pct) => {
      fijarFactor(pct);
      settings = { ...settings, escala: pct };
      api.guardarAjustes(settings);
    },
    // El volumen se aplica al momento, para poder ajustarlo de oído.
    onSonido: ({ volumen, silenciado }) => {
      sonido.setVolumen(volumen);
      sonido.setSilenciado(silenciado);
      settings = { ...settings, volumen, silenciado };
      api.guardarAjustes(settings);
      if (!silenciado) sonido.cuack();     // muestra de cómo suena
    },
    onSave: (s) => {
      settings = { ...settings, ...s };
      api.guardarAjustes(settings);
      chat.setName(settings.displayName);   // re-anuncia el nombre en el canal
      avisarPresencia();                    // nuestro nombre en la lista de conectados
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
  const head = porId('statusBubbles').getBoundingClientRect();
  return { x: Math.round(r.left + r.width / 2), y: Math.round(head.bottom) };
}

/** Nombre del pato (siempre hay uno: se genera en el primer arranque). */
function duckName() {
  return (settings.displayName || '').trim() || 'Pato';
}

function openOnline(x, y) {
  const { el, actualizar } = buildOnlinePanel(estadoPresencia(), {
    onBack: () => volverAlMenu(el, x, y),
    onClose: () => unregisterOverlay(el)
  });
  // Los patos entran y salen del canal por su cuenta, así que la lista se
  // mantiene viva mientras el panel esté abierto.
  oyentesPresencia.add(actualizar);
  el.addEventListener('panel:cerrado', () => oyentesPresencia.delete(actualizar), { once: true });
  mountPanel(el, x, y);
}

function openSkins(x, y) {
  const { el } = buildSkinsPanel(level, duck.skinId, {
    onElegir: (id) => {
      duck.setSkin(id);
      settings = { ...settings, skin: id };
      api.guardarAjustes(settings);
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
  montar(el);
  const a = duckAnchor();
  el.style.left = `${Math.max(8, Math.min(a.x - el.offsetWidth / 2,
    window.innerWidth - el.offsetWidth - 8))}px`;
  el.style.top = `${Math.max(8, a.y - el.offsetHeight - 10)}px`;
  setTimeout(() => el.remove(), 5000);
}

function openTalk(x, y) {
  const { el } = buildTalkPanel({
    onSend: (text) => sendChat(text),
    onBack: () => volverAlMenu(el, x, y),
    onClose: () => unregisterOverlay(el)
  });
  mountPanel(el, x, y);
}

// Añade un panel al DOM, lo centra sobre el punto indicado y por encima de él
// (para no tapar al pato), y lo registra para la captura de ratón.
function mountPanel(el, x, y) {
  el.style.visibility = 'hidden';
  montar(el);
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
//
// Quién está conectado se guarda aquí y no en el panel: el ChatClient sólo
// admite un oyente de presencia, y el panel de conectados se abre y se cierra.
let conectados = [];                 // los demás patos del canal (sin el nuestro)
const oyentesPresencia = new Set();  // paneles abiertos que quieren enterarse

/** @returns {{yo:string, otros:string[], conectado:boolean}} */
function estadoPresencia() {
  return { yo: duckName(), otros: conectados, conectado: !!(chat && chat.connected) };
}

function avisarPresencia() {
  const estado = estadoPresencia();
  for (const cb of oyentesPresencia) cb(estado);
}

/** Entrada del menú, con cuántos patos hay ahora mismo (contándonos). */
function etiquetaConectados() {
  if (!chat || !chat.connected) return '🟢 Conectados';
  return `🟢 Conectados · ${conectados.length + 1}`;
}

function setupChat() {
  chat = new ChatClient(api.chat);
  chat.onMessage((m) => {
    // Se anota SIEMPRE, esté abierto el panel de Hablar o no: el bocadillo dura
    // unos segundos y justo eso es lo que hay que poder releer después.
    historial.anadir({ from: m.from, text: m.text, ts: m.ts, propio: false });
    speech.show(m.from, m.text, { self: false });
    // Un poco más grave que el propio, para distinguir quién habla.
    sonido.cuack({ agudo: 0.9 });
    if (behavior) behavior.playOnce('talk', 2.2);
  });
  // Sólo en la extensión: el pato se muda de pestaña y el histórico de este
  // documento nace vacío, así que quien mantiene la conexión le pasa el suyo.
  //
  // Si llega vacío no se hace nada: significa "todavía no hay nada apuntado"
  // —o que el service worker estaba dormido—, y nunca que haya que borrar lo
  // que este pato ya tenga.
  chat.onHistorial((ms) => { if (ms.length) historial.sembrar(ms); });
  chat.onStatus(() => {
    // Con el canal caído no se sabe quién sigue ahí, y los demás tampoco nos
    // ven: la lista de antes ya no vale.
    if (!chat.connected) conectados = [];
    avisarPresencia();
  });
  chat.onPresence((names) => {
    conectados = names;
    avisarPresencia();
  });
  // El canal ya puede estar conectado antes de llegar aquí.
  chat.sync();
  // Anuncia el nombre en la presencia del canal. Hace falta en el primer
  // arranque: quien mantiene la conexión lo lee de los ajustes guardados, y ahí
  // todavía no había nombre porque se acaba de generar. Sin esto, el pato sale
  // sin nombre en la lista de conectados hasta que se abren los Ajustes.
  chat.setName(duckName());
}

/**
 * Manda un mensaje al canal común.
 * @returns {boolean} si ha salido de verdad; el panel de Hablar lo dice cuando
 *   no, en vez de dejar creer que el mensaje llegó a alguien.
 */
function sendChat(text) {
  // El nivel viaja con el mensaje: es lo que hace que la progresión se vea
  // entre compañeros, que es la gracia de tenerla.
  const name = `${duckName()} · Nv ${level.nivel}`;
  const salio = !!(chat && chat.connected);
  chat.send(name, text);
  historial.anadir({ from: name, text, ts: Date.now(), propio: true, fallo: !salio });
  speech.show(name, text, { self: true });
  sonido.cuack();
  level.chat();
  if (behavior) behavior.playOnce('talk', 2.2);
  return salio;
}

// ---- Órdenes desde fuera del documento ----------------------------------
// La bandeja del sistema en el escritorio; el menú de la extensión en Chrome.
function setupTray() {
  api.alRecibirComando((cmd) => {
    const { x: cx, y: cy } = duckAnchor();
    if (cmd === 'feed' || cmd === 'play' || cmd === 'clean' || cmd === 'sleep') {
      doAction(cmd);
    } else if (cmd === 'stats') openStats(cx, cy);
    else if (cmd === 'online') openOnline(cx, cy);
    else if (cmd === 'settings') openSettings(cx, cy);
  });
}

// ---- Actualizaciones ----------------------------------------------------
function setupUpdates() {
  api.alRecibirActualizacion((evt) => {
    if (!evt) return;
    if (evt.type === 'available') toast(`Descargando actualización v${evt.version}…`);
    else if (evt.type === 'ready') toast('¡Nueva versión lista! Se aplicará al reiniciar.');
  });
}

function toast(text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  montar(el);
  setTimeout(() => el.remove(), 5000);
}
