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
import { MINIJUEGOS, minijuegoPorId, nombreDeJuego } from './game/minijuegos/index.js';
import { ProgresoJuegos } from './game/minijuegos/progreso.js';
import { buildJuegosPanel } from './ui/juegosPanel.js';
import { buildPartidaPanel } from './ui/partidaPanel.js';
import { prestarEscenario } from './game/minijuegos/escenario.js';
import { crearGestorDeSalas } from './game/salas.js';
import { buildRetoPanel } from './ui/retoPanel.js';
import { ChatClient } from './chat/chatClient.js';
import { SpeechBubbles } from './chat/speechBubble.js';
import { ColaDeVisitas, ESPERA_ENTRE_VISITAS } from './visita/PatoVisitante.js';
import { salirYVolver } from './visita/salirYVolver.js';
import * as sonido from './audio/sounds.js';
import { normalizarPlataforma } from './platform.js';
import { configurarAssets, configurarCargadorSheet } from './assets.js';
import { fijarFactor, normalizarFactor } from './scale.js';
import { porId, todos, uno, montar, elementoVisible, objetivoReal } from './stage.js';
import * as fisica from './pet/fisica.js';
import { crearInercia } from './pet/inercia.js';

// La instala `arrancarPato`. Hasta entonces, una plataforma que no hace nada,
// para que nada reviente si algo se dispara antes de tiempo.
let api = normalizarPlataforma();

let duck, behavior, tam, chat, speech, level, visitas, juegos, salas;
let settings = { displayName: '', autoLaunch: false };
let config = { version: '0.0.0', isDev: false };

// ---- Estado de interacción ----------------------------------------------
let dragging = false;
// El vuelo del pato: posición, velocidad y si está en el aire. Va en un objeto
// y no en variables sueltas porque un minijuego de escenario lo pilota prestado
// (ver game/minijuegos/escenario.js) y hay que poder pasárselo.
const vuelo = fisica.crearVuelo();
const inercia = crearInercia();  // velocidad del cursor, para lanzar al soltar
let escena = null;               // minijuego que tiene prestado el escenario
// El panel de la partida en curso, para poder hablarle desde fuera: en una
// revancha hay que cerrarlo y abrir el de la partida nueva.
let partidaAbierta = null;
/** Cerrando un panel para abrir el de la partida siguiente, no para irse. */
let cambiandoDePartida = false;
let overHot = false;         // sobre el pato o sobre un panel/menú
let overDuck = false;        // sobre el pato en concreto (para el cursor)
let lastCursor = '';
let hoverTimer = null;       // cuenta atrás para mostrar las stats en un tooltip
let paseo = null;            // el pato, fuera de la pantalla llevando un recado
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
  // El pato anterior pudo apagarse por una mudanza, y en la extensión el panel
  // vuelve a montarlo en el MISMO documento. Sin esto, el pato nuevo heredaría
  // el "me estoy mudando" del viejo y no avisaría al rival al dejar la partida.
  mudandose = false;
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
  juegos = new ProgresoJuegos(saved.minijuegos);
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
    avisoNivel(`¡Nivel <b>${nivel}</b>! · ${rango}${novedadesDeNivel(nivel)}`);
    sonido.fanfarria();
    behavior.playOnce('happy', 1.6);
  });

  setupChat();
  setupVisitas();
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
        fisica.arrancarVuelo(vuelo, { x: duck.x, y: duck.y, vx: vx0, vy: vy0 });
        duck.setState('fall');
      },
      state: () => ({ ...vuelo }),
      fisica,
      /**
       * La física sola, sin reloj ni pantalla: N pasos con dt fijo sobre un
       * vuelo de usar y tirar. Es lo que permite comparar trayectorias entre
       * versiones sin depender de cuántos fotogramas haya dado el navegador.
       */
      simular: (inicio, dt = 1 / 60, pasos = 600, ajustes) => {
        const v = fisica.crearVuelo({ ...inicio, volando: true });
        const limites = fisica.limitesDeVentana(duck);
        const traza = [];
        for (let i = 0; i < pasos; i++) {
          const s = fisica.paso(v, dt, limites, ajustes);
          traza.push({ ...v, ...s });
          if (s.posado) break;
        }
        return traza;
      },
      hover: () => ({ overDuck, overHot, dragging, cursor: lastCursor,
                      paneles: openOverlays.size, timer: !!hoverTimer }),
      verTooltip: () => showStatsTooltip(tam, duckName(), duckAnchor(), level),
      verMenu: () => { const p = duckAnchor(); openDuckMenu(p.x, p.y); },
      verSkins: () => { const p = duckAnchor(); openSkins(p.x, p.y); },
      verJuegos: () => { const p = duckAnchor(); openJuegos(p.x, p.y); },
      verPartida: (id, modo = 'solo') => {
        const p = duckAnchor();
        openPartida(minijuegoPorId(id), modo, {}, p.x, p.y);
      },
      juegos: () => juegos.toJSON(),
      salas: () => salas,
      /** Un vistazo a la partida por red, para ver dónde se ha atascado. */
      estadoDeJuego: () => {
        const s = salas && salas.sala();
        return {
          chatConectado: chat.connected,
          miId: chat.miId,
          rivalesJugables: chat.rivales().map((r) => r.nombre),
          sala: s ? {
            fase: s.fase, n: s.n, anfitrion: s.anfitrion,
            rival: s.rival && s.rival.nombre, juego: s.juego,
            suspendida: !!s.suspendidaDesde
          } : null,
          panelAbierto: !!document.querySelector('.panel-partida'),
          aviso: (document.querySelector('.jt-aviso') || {}).textContent || ''
        };
      },
      /** Juega una partida entera contra un rival simulado, sin tocar la red. */
      pruebaDeSalas: (opciones) => import('./game/rivalDePruebas.js')
        .then((m) => m.probarSalas(opciones)),
      /**
       * Inyecta un reto entrante de mentira. Va por el camino de siempre —lo
       * recibe el gestor de salas y él decide— para que la prueba valga: entrar
       * por detrás sólo enseñaría el panel, no comprobaría nada.
       */
      simularReto: (juegoId = 'tresenraya') => {
        salas.recibir({
          pv: 1, t: 'reto', sala: `s-prueba-${Date.now().toString(36)}`,
          aClave: chat.miClave, deClave: 'k-prueba', de: 'p-prueba00001',
          n: 0, mid: Math.random().toString(36).slice(2),
          d: { juego: juegoId, nombre: 'Vecino' }
        });
        return salas.retos().length;
      },
      escena: () => (escena ? escena.id : null),
      /**
       * Presta el escenario a un juego de mentira, para comprobar lo único que
       * de verdad no puede fallar: que el pato SIEMPRE vuelve. Con
       * `{revienta:true}` el juego lanza en el primer fotograma; con
       * `{revientaAlMontar:true}`, al construirse.
       */
      probarEscena: (opciones = {}) => {
        abrirEscena({
          id: 'prueba', nombre: 'Prueba', superficie: 'escenario',
          cargar: async () => ({
            crearPartida(ctx) {
              if (opciones.revientaAlMontar) throw new Error('prueba: revienta al montar');
              let n = 0;
              return {
                actualizar(dt, pista) {
                  if (opciones.revienta) throw new Error('prueba: revienta en un fotograma');
                  n++;
                  pista.marcador(`${n}`);
                  pista.pintor.fillStyle = 'rgba(255,183,3,.5)';
                  pista.pintor.fillRect(20, 20, 60, 60);
                  if (n >= (opciones.fotogramas || 30)) ctx.alTerminar({ resultado: 'victoria' });
                },
                destroy() {}
              };
            }
          })
        }, 'solo', {});
        return true;
      },
      verStats: () => { const p = duckAnchor(); openStats(p.x, p.y); },
      verConectados: () => { const p = duckAnchor(); openOnline(p.x, p.y); },
      verHablar: () => { const p = duckAnchor(); openTalk(p.x, p.y); },
      verAjustes: () => { const p = duckAnchor(); openSettings(p.x, p.y); },
      level,
      // Por `_sumar` y no tocando `level.xp` a pelo: así se emiten los eventos
      // de subida de nivel y se puede probar el aviso de desbloqueo.
      darXp: (n) => { level._sumar(n, 'depuración'); return level.nivel; },
      act: doAction,
      /** Simula un pato de visita sin tocar la red. */
      verVisita: (opciones = {}) => visitas.recibir({
        id: `local-${Date.now()}`,
        de: opciones.de || 'Vecino',
        // Sin clave repetida, para que el límite por remitente no bloquee las
        // pruebas seguidas.
        deClave: opciones.deClave || `prueba-${Date.now()}`,
        skin: opciones.skin || 'duro',
        gesto: opciones.gesto || 'saludo',
        texto: opciones.texto != null ? opciones.texto : '¡Buenas! Vengo a saludar.',
        ts: Date.now()
      }),
      visitas: () => visitas,
      /** El paseíllo de "me voy a llevarlo", sin mandar nada a nadie. */
      verPaseo: () => hacerElPaseo(),
      paseo: () => paseo,
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

/** Apagando para reaparecer en otro sitio, no para irse. */
let mudandose = false;

/**
 * Para el pato y lo deja todo como estaba: sin bucles, sin listeners y sin
 * paneles abiertos. Guarda antes, que es lo último que hace un pato educado.
 *
 * @param {'mudanza'|string} [motivo]
 *   'mudanza' significa que el pato se está cambiando de sitio —de pestaña, o a
 *   un panel— y va a volver enseguida. Importa para las partidas: irse de una
 *   partida es abandonarla, pero mudarse no lo es, y en la extensión el pato se
 *   muda cada vez que el usuario cambia de pestaña. Avisar al rival ahí sería
 *   rendirse cada dos por tres sin querer.
 */
function apagar(motivo) {
  mudandose = motivo === 'mudanza';
  // Antes de guardar: si una partida de escenario devolviera el pato DESPUÉS,
  // se habría persistido la posición de mitad de partida en vez de la suya.
  if (escena) {
    try { escena.terminar('apagado'); } catch (err) {
      console.warn('[pato] fallo al cerrar la partida', err);
    }
  }

  try {
    saveNow();
  } catch (err) {
    console.warn('[pato] no se pudo guardar al apagar', err);
  }

  cancelarTooltip();
  cancelarPaseo();
  closeContextMenu();
  for (const el of [...openOverlays]) unregisterOverlay(el);
  // El animador de sprites corre en su propio bucle, aparte del del pato.
  if (duck) duck.detener();
  // Antes de soltar el puente, no después: el aviso de que abandonamos la
  // partida tiene que salir por él. Salvo en una mudanza, donde no hay nada que
  // avisar: la partida sigue viva y se reanuda al otro lado.
  if (salas && !mudandose) {
    try { salas.cerrar(); } catch (err) { console.warn('[pato] fallo al cerrar la sala', err); }
  }
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
    // Con una partida de escenario en marcha, el pato lo pilota ella: la física
    // es la misma, pero con sus números y sus límites.
    if (escena) escena.actualizar(dt);
    else updateFlight(dt);
    behavior.update(dt);   // bloqueado durante la partida: no hace nada
    pedido = requestAnimationFrame(frame);
  };
  pedido = requestAnimationFrame(frame);
  alApagar(() => cancelAnimationFrame(pedido));

  // Decaimiento de necesidades y experiencia por convivencia (1 s).
  cadaCierto(() => {
    tam.tick(1);
    level.convivencia(1, tam.mood() === 'contento');
  }, 1000);

  // Burbuja de ánimo (2 s). Durante una partida de escenario estorba: el pato
  // está haciendo otra cosa y el globo taparía el juego.
  cadaCierto(() => {
    if (!dragging && !escena) updateBubbles(statusBubbles, tam.mood());
  }, 2000);
  updateBubbles(statusBubbles, tam.mood());

  // Guardado periódico (15 s). En mitad de una partida de escenario la posición
  // del pato es la de la pelota, no la suya: se guarda al devolverlo.
  cadaCierto(() => { if (!escena) saveNow(); }, 15000);
}

/** setInterval que se para solo cuando el pato se apaga. */
function cadaCierto(fn, ms) {
  const id = setInterval(fn, ms);
  alApagar(() => clearInterval(id));
}

function saveNow() {
  const sitioLibre = Math.max(1, window.innerWidth - duck.width);
  // Si justo ahora anda fuera de la pantalla llevando un recado, se guarda de
  // dónde salió: apagar en ese par de segundos no debe dejarlo pegado al borde.
  const x = paseo ? paseo.volverA : duck.x;
  api.guardarEstado({
    stats: tam.stats,
    level: level.toJSON(),
    minijuegos: juegos.toJSON(),
    // Como proporción del sitio disponible, no en píxeles: la ventana de la
    // pestaña siguiente no tiene por qué medir lo mismo.
    x: Math.min(1, Math.max(0, x / sitioLibre))
  });
}

// ---- Interacción: arrastre + menú clic derecho --------------------------
function setupInteraction() {
  // Con una partida de escenario en marcha, el ratón es suyo: ni hover, ni
  // tooltip, ni arrastre, ni menú. Se cortocircuita aquí en vez de quitar y
  // reponer los listeners porque `escuchar` lleva la cuenta para el apagado, y
  // añadirlos a mano a mitad rompería esa contabilidad.
  escuchar(document, 'mousemove', (e) => {
    if (escena) { escena.entrada.mover(e); return; }
    if (dragging) {
      // Si el botón se soltó fuera de la ventana (p. ej. justo al cruzar de
      // monitor), el mouseup no llega y el pato se quedaría pegado al cursor.
      if (e.buttons === 0) { endDrag(); return; }
      duck.setX(e.clientX - grab.x);
      duck.setY((window.innerHeight - e.clientY) + grab.y);
      inercia.anotar(e.clientX, e.clientY);   // para lanzarlo al soltar
      // Mira hacia donde se le está moviendo.
      const dx = inercia.avanceX();
      if (Math.abs(dx) > 8) duck.setFacing(dx > 0 ? 1 : -1);
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
    if (escena) { escena.entrada.pulsar(e); return; }
    if (isOverHotElement(objetivoReal(e))) return; // paneles/menús se gestionan solos
    if (duck.hitTest(e.clientX, e.clientY)) startDrag(e);
  });

  escuchar(document, 'mouseup', (e) => {
    if (escena) { escena.entrada.soltar(e); return; }
    if (dragging) endDrag();
  });

  escuchar(document, 'contextmenu', (e) => {
    e.preventDefault();
    // Durante una partida no hay menú: se sale con Esc o con el botón del
    // marcador.
    if (escena) return;
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
  fisica.detenerVuelo(vuelo);
  cancelarTooltip();
  // Si le agarras mientras iba de recado, se acabó el recado: manda el ratón.
  cancelarPaseo();
  grab.x = e.clientX - duck.x;
  grab.y = duck.y - (window.innerHeight - e.clientY);
  inercia.limpiar();
  inercia.anotar(e.clientX, e.clientY);
  duck.setDragTransition(false);
  duck.setTilt(0);          // por si se le agarra mientras volaba
  behavior.lock();          // el pato cuelga del cursor
  api.empezarArrastre();    // donde haya varios monitores, se vigila si cruza
  updateMouseCapture();
}

// Al soltarlo sale despedido con la inercia del ratón y describe una parábola,
// rebotando en el suelo y en los lados. Si se suelta casi quieto, en vez de
// desplomarse planea aleteando hasta posarse.
function endDrag() {
  dragging = false;
  api.terminarArrastre();
  updateMouseCapture();

  const v = inercia.velocidad();
  const impulso = fisica.limitarLanzamiento(v.vx, v.vy);
  inercia.limpiar();

  if (duck.onGround() && Math.abs(impulso.vx) < 60 && impulso.vy <= 0) {
    behavior.unlock();
    return;
  }
  fisica.arrancarVuelo(vuelo, { x: duck.x, y: duck.y, vx: impulso.vx, vy: impulso.vy });
  duck.setDragTransition(false);
  duck.setState('fall');
  if (Math.abs(impulso.vx) > 40) duck.setFacing(impulso.vx > 0 ? 1 : -1);
}

// --- Física del vuelo ----------------------------------------------------
//
// Los números y la integración viven en pet/fisica.js, que no sabe de sonido ni
// de sprites. Aquí sólo se traduce lo que ha pasado a lo que se ve y se oye.
// El orden de los sonidos es el de siempre: primero el aleteo, luego la pared y
// luego el suelo.

function updateFlight(dt) {
  if (!vuelo.volando) return;

  const s = fisica.paso(vuelo, dt, fisica.limitesDeVentana(duck));

  if (s.aleteo) sonido.aleteo();          // sólo suena mientras aletea para frenar
  // `!== null` y no un simple `if`: un choque de fuerza cero es un choque, y
  // suena. Ver el comentario de `Sucesos` en pet/fisica.js.
  if (s.pared !== null) sonido.boing(s.pared);
  if (s.suelo !== null) sonido.boing(s.suelo);

  if (s.posado) { land(); return; }

  fisica.aplicar(duck, vuelo);
}

function land() {
  duck.setX(vuelo.x);
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
  const items = [];
  // Los retos pendientes van primero: caducan solos, así que llegar tarde es
  // perderlos.
  const pendientesDeReto = salas ? salas.retos() : [];
  if (pendientesDeReto.length) {
    items.push({
      label: `⚔️ Retos · ${pendientesDeReto.length}`,
      ancho: true,
      onClick: () => abrirPanelDeReto(pendientesDeReto[pendientesDeReto.length - 1])
    });
  }
  // Las cuatro cosas que se hacen CON el pato, en dos filas limpias.
  items.push(
    { label: '💬 Hablar…', onClick: () => openTalk(x, y) },
    { label: etiquetaConectados(), onClick: () => openOnline(x, y) },
    { label: '👕 Diseños', onClick: () => openSkins(x, y) },
    { label: '🎮 Juegos', onClick: () => openJuegos(x, y) }
  );
  // Y abajo, tras la raya, las dos que son sobre el pato y no con él. Van juntas
  // para que la última fila quede completa: Ajustes solo dejaba un hueco.
  items.push({ sep: true }, { label: '⚙️ Ajustes…', onClick: () => openSettings(x, y) });
  if (api.capacidades.ocultar) {
    // Esconderse, no cerrarse: vuelve desde la bandeja del sistema o desde el
    // menú del icono de la extensión. Cerrar del todo sigue estando en la
    // bandeja, que es donde no se pulsa sin querer.
    items.push({ label: '🙈 Ocultar', onClick: () => api.ocultar() });
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
    // Sólo donde el pato tiene la pantalla para él. Sobre una página ajena, ni
    // el botón aparece: llenarla de patos capturándole el ratón a quien está
    // leyendo no es una broma.
    puedeLaBroma: api.capacidades.juegosDeEscenario,
    // El panel se cierra antes: la broma toma la pantalla entera y dejarlo
    // abierto encima sería enseñarle al usuario el botón que acaba de pulsar
    // mientras le llueven patos.
    onLaBroma: () => { unregisterOverlay(el); abrirLaBroma(); },
    actualizaciones: api.capacidades.actualizaciones,
    estadoActualizacion: () => ultimaActualizacion,
    alCambiarActualizacion: (cb) => {
      oyentesActualizacion.add(cb);
      return () => oyentesActualizacion.delete(cb);
    },
    onBuscarActualizacion: () => {
      // Se pinta ya, sin esperar al primer aviso: pulsar un botón y que no pase
      // nada visible durante un segundo parece que no ha funcionado.
      ultimaActualizacion = { tipo: 'comprobando' };
      avisarActualizacion();
      api.buscarActualizacion();
    },
    onInstalarActualizacion: () => api.instalarActualizacion(),
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
    onEnviar: (destino, texto) => enviarVisita(destino, texto),
    esperaDe: (clave) => esperaParaVisitar(clave),
    esperaTotal: ESPERA_ENTRE_VISITAS + MARGEN_ENVIO,
    onBack: () => volverAlMenu(el, x, y),
    onClose: () => unregisterOverlay(el)
  });
  // Los patos entran y salen del canal por su cuenta, así que la lista se
  // mantiene viva mientras el panel esté abierto.
  oyentesPresencia.add(actualizar);
  el.addEventListener('panel:cerrado', () => oyentesPresencia.delete(actualizar), { once: true });
  mountPanel(el, x, y);
}

function openJuegos(x, y) {
  const { el, actualizar } = buildJuegosPanel(level, juegos, estadoPresencia(), api.capacidades, {
    onJugar: (juego, modo, opciones) => {
      unregisterOverlay(el);
      openPartida(juego, modo, opciones, x, y);
    },
    onBack: () => volverAlMenu(el, x, y),
    onClose: () => unregisterOverlay(el)
  });
  // Los rivales entran y salen del canal mientras el panel está abierto.
  oyentesPresencia.add(actualizar);
  el.addEventListener('panel:cerrado', () => oyentesPresencia.delete(actualizar), { once: true });
  mountPanel(el, x, y);
}

/**
 * Abre una partida.
 *
 * Es el único sitio donde se juntan el pato, la red y el disco: el marco y los
 * juegos reciben rendijas ya cerradas. Es la misma división que hay entre
 * `doAction` y los paneles de cuidados.
 */
function openPartida(juego, modo, opciones, x, y) {
  if (!juego) return;
  // Una partida cada vez, sea de la superficie que sea.
  if (escena) return;

  // Retar es el paso previo, no la partida: no hay nada que abrir hasta que el
  // otro conteste. Cuando conteste, la sala avisa y se vuelve por aquí con
  // `opciones.sala` ya puesta.
  if (modo === 'turnos' && opciones.rival && !opciones.sala) {
    if (!salas.retar(opciones.rival, juego.id)) {
      toast('Ahora mismo no se puede retar a nadie.');
    }
    return;
  }
  // Jugar cansa, igual que jugar con el bate: un pato agotado no juega a nada.
  if (tam.agotado) {
    toast(`Está agotado: duerme hasta recuperar el ${AGOTAMIENTO.DESPIERTA} % de energía.`);
    return;
  }
  // El coste en stats, pero sin pasar por `doAction`: eso encadenaría
  // `level.cuidado` y jugar acabaría dando experiencia de cuidados.
  //
  // Al reanudar no se cobra: es la misma partida de antes, y cambiar de pestaña
  // tres veces no puede dejar al pato agotado.
  if (!opciones.previas) tam.play();

  if (juego.superficie === 'escenario') { abrirEscena(juego, modo, opciones); return; }

  const enRed = modo === 'turnos' && !!opciones.sala;

  const panel = buildPartidaPanel(juego, modo, {
    // Sólo los datos: el marco pone las herramientas de ciclo de vida, porque es
    // quien tiene que apagarlas entre una partida y la siguiente.
    ctx: datosDePartida(juego, modo, opciones),
    // Anotar, puntuar y guardar, en un solo sitio: el marco no sabe de
    // experiencia ni de disco, y los juegos menos.
    onFin: (r) => anotarPartida(juego, r),
    // En red, "¿Otra?" es una propuesta: la partida nueva la abre la sala cuando
    // los dos hayan dicho que sí (ver `empiezaLaPartida`).
    onRevancha: enRed ? () => salas.proponerRevancha() : undefined,
    onDejarlo: enRed ? () => salas.rechazarRevancha() : undefined,
    onBack: () => { unregisterOverlay(panel.el); openJuegos(x, y); },
    onClose: () => unregisterOverlay(panel.el)
  });

  const el = panel.el;
  if (enRed) {
    partidaAbierta = panel;
    el.addEventListener('panel:cerrado', () => {
      if (partidaAbierta === panel) partidaAbierta = null;
      // Cerrar el panel es irse, se haya usado el botón de salir o la ×. Si no
      // se avisa, el rival se queda esperando a alguien que ya no está hasta
      // que salte su plazo de ausencia, que es minuto y medio mirando a nada.
      //
      // Con dos excepciones. Una revancha cierra este panel para dejar sitio al
      // siguiente, y avisar ahí sería abandonar la partida que acabamos de
      // aceptar. Y mudarse de pestaña tampoco es irse: la partida sigue viva y
      // se reanuda al otro lado.
      if (!cambiandoDePartida && !mudandose) {
        salas.abandonar();
        // Y que no la guarde nadie para la próxima pestaña: esta partida se ha
        // acabado, y reanudarla mañana sería resucitar un muerto.
        chat.olvidarPartida();
      }
    }, { once: true });
  }
  mountPanel(el, x, y);
}

/**
 * La broma del «No tocar». Ver core/game/broma.js.
 *
 * Va por su cuenta y no por `openPartida` porque NO es un minijuego: no está en
 * el catálogo, no da experiencia, no cuenta partidas y no cansa a la mascota. Lo
 * único que comparte con ellos es el préstamo del escenario, que es la pieza que
 * sabe pedir la pantalla y —sobre todo— devolverla.
 */
function abrirLaBroma() {
  if (escena) return;
  if (!api.capacidades.juegosDeEscenario) return;

  const limpieza = [];
  const prestamo = prestarEscenario({
    pato: duck, behavior, vuelo, alApagar, toast, nombre: 'No tocar',
    registrarOverlay: registerOverlay,
    soltarOverlay: unregisterOverlay,
    alDevolver: () => {
      escena = null;
      for (const fn of limpieza.splice(0)) {
        try { fn(); } catch (err) { console.warn('[pato] fallo al recoger la broma', err); }
      }
      fisica.detenerVuelo(vuelo);
      duck.setTilt(0);
      duck.toGround();
      behavior.unlock();
      updateMouseCapture();
    }
  });

  import('./game/broma.js').then((modulo) => {
    const enMarcha = prestamo.ejecutar(modulo.crearBroma({
      escenario: prestamo.pista,
      sprites: config.sprites || {},
      nivel: level.nivel,
      sonido,
      decir: (t) => toast(t)
    }));
    if (!enMarcha) return;
    escena = enMarcha;
  }).catch((err) => {
    console.error('[broma] no se pudo abrir', err);
    prestamo.terminar('error');
  });
}

/**
 * Una partida que se juega en el escenario entero: el juego pilota al pato y la
 * pantalla, y cuando acaba se los devuelve.
 *
 * No hay panel: el marcador y el botón de salir los pone el propio préstamo.
 */
function abrirEscena(juego, modo, opciones) {
  const limpieza = [];
  let contada = false;

  const prestamo = prestarEscenario({
    // Ya resuelto: el nombre puede llevar dentro el de la mascota, y en el
    // marcador de la partida no puede salir un `{mascota}` a medio hacer.
    pato: duck, behavior, vuelo, alApagar, toast,
    nombre: nombreDeJuego(juego, duckName()),
    registrarOverlay: registerOverlay,
    soltarOverlay: unregisterOverlay,
    // Pase lo que pase —fin normal, Esc, error del juego o apagado— esto se
    // ejecuta, y el pato vuelve a ser del usuario.
    alDevolver: () => {
      escena = null;
      for (const fn of limpieza.splice(0)) {
        try { fn(); } catch (err) { console.warn('[pato] fallo al recoger la partida', err); }
      }
      fisica.detenerVuelo(vuelo);
      duck.setTilt(0);
      duck.toGround();
      behavior.unlock();
      updateMouseCapture();
      saveNow();
    }
  });

  const ctx = {
    ...datosDePartida(juego, modo, opciones),
    ...herramientasDePartida(limpieza),
    escenario: prestamo.pista,
    alTerminar: (r) => {
      if (contada) return;
      contada = true;
      const res = anotarPartida(juego, r);
      // Sin panel donde pintar el pie, el resultado se dice en un cartel.
      toast(res.xp > 0
        ? `${veredicto(r.resultado)} · +${res.xp} XP`
        : `${veredicto(r.resultado)} · hoy ya no da experiencia`);
      sonido[r.resultado === 'victoria' ? 'victoria' : 'derrota']();
      prestamo.terminar('fin');
    }
  };

  // Por el descriptor y no por `cargarMinijuego(id)`: es lo mismo para un juego
  // del catálogo, y permite probar el préstamo con uno de mentira.
  juego.cargar().then((modulo) => {
    const enMarcha = prestamo.ejecutar(modulo.crearPartida(ctx));
    // `ejecutar` devuelve null si el escenario ya se devolvió mientras cargaba
    // (el usuario cerró, o el pato se mudó de pestaña).
    if (!enMarcha) return;
    escena = enMarcha;
    sonido.empezarPartida();
  }).catch((err) => {
    console.error(`[juego:${juego.id}] no se pudo abrir`, err);
    toast('No se ha podido abrir este juego.');
    prestamo.terminar('error');
  });
}

function veredicto(r) {
  return r === 'victoria' ? '¡Ganaste!' : r === 'empate' ? 'Empate' : 'Perdiste';
}

/** Anota el resultado, suma la experiencia y guarda. Un solo sitio. */
function anotarPartida(juego, r) {
  juegos.anotar(juego.id, r);
  const xp = level.minijuego(r.resultado);
  saveNow();     // un récord no se pierde por cerrar antes del guardado
  return { xp };
}

/**
 * Los datos que recibe un juego, sin las herramientas de ciclo de vida: ésas
 * las pone quien monta la partida, porque tiene que poder apagarlas —el panel al
 * cerrarse o al empezar otra, el préstamo al devolver el escenario—.
 */
function datosDePartida(juego, modo, opciones) {
  return {
    juego,
    modo,
    nivel: level.nivel,
    yo: duckName(),
    jugadores: opciones.jugadores || [duckName()],
    anfitrion: opciones.anfitrion !== false,
    // En red la semilla la reparte el anfitrión: los dos lados tienen que
    // barajar igual, y eso no se puede sortear por separado.
    semilla: opciones.semilla != null ? opciones.semilla : (Math.random() * 2 ** 31) | 0,
    marcas: juegos.de(juego.id),
    // Las medidas de las hojas de sprites, para el que dibuje mascotas.
    sprites: config.sprites || {},
    sonido,
    pato: { animar: (estado, dur) => behavior.playOnce(estado, dur || 1.4) },
    decir: (t) => toast(t),
    sala: opciones.sala || null,
    // Lo jugado antes de mudarse de pestaña, en orden. Vacío en una partida
    // nueva. Un juego que no lo mire simplemente empieza de cero: se pierde el
    // tablero, no la partida.
    previas: opciones.previas || [],
    escenario: null
  };
}

/** Las cuatro herramientas del contrato, atadas a una lista de apagado. */
function herramientasDePartida(limpieza) {
  const registrar = (fn) => { limpieza.push(fn); return fn; };
  return {
    cadaFrame(fn) {
      let pedido = 0;
      let ultimo = performance.now();
      const paso = (t) => {
        const dt = Math.min((t - ultimo) / 1000, 0.1);
        ultimo = t;
        fn(dt);
        pedido = requestAnimationFrame(paso);
      };
      pedido = requestAnimationFrame(paso);
      return registrar(() => cancelAnimationFrame(pedido));
    },
    cadaCierto(fn, ms) {
      const id = setInterval(fn, ms);
      return registrar(() => clearInterval(id));
    },
    escuchar(objetivo, evento, fn, opciones) {
      objetivo.addEventListener(evento, fn, opciones);
      registrar(() => objetivo.removeEventListener(evento, fn, opciones));
    },
    alDestruir: registrar
  };
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
// Catálogos que se desbloquean por nivel. Añadir uno nuevo —marcos, sonidos, lo
// que sea— es meterlo en esta lista: el aviso de subida de nivel lo anuncia solo.
const DESBLOQUEABLES = [
  { lista: SKINS, singular: 'Nuevo diseño', plural: 'Nuevos diseños' },
  { lista: MINIJUEGOS, singular: 'Nuevo juego', plural: 'Nuevos juegos' }
];

/**
 * Qué se estrena al llegar a un nivel, como HTML.
 *
 * Los nombres se escapan. Casi todos son literales del catálogo, pero uno lleva
 * dentro el nombre de la mascota —lo que el usuario haya escrito en Ajustes— y
 * eso ya no es texto propio: un `<` suyo aquí rompería el cartel.
 */
function novedadesDeNivel(nivel) {
  return DESBLOQUEABLES.map(({ lista, singular, plural }) => {
    const nuevos = lista.filter((x) => x.nivel === nivel);
    if (!nuevos.length) return '';
    const etiqueta = nuevos.length > 1 ? plural : singular;
    const nombres = nuevos.map((x) => escaparHtml(nombreDeJuego(x, duckName()))).join(', ');
    return `<br>${etiqueta}: <b>${nombres}</b>`;
  }).join('');
}

/** Para lo poco que sigue yendo por `innerHTML`. */
function escaparHtml(texto) {
  const d = document.createElement('div');
  d.textContent = String(texto);
  return d.innerHTML;
}

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

/** @returns {{yo:string, otros:string[], presentes:object[], conectado:boolean}} */
function estadoPresencia() {
  return {
    yo: duckName(),
    otros: conectados,
    // Los mismos, con su clave: es lo que hace falta para mandarle el pato a uno
    // en concreto. Viene vacío si al otro lado del canal hay una versión que
    // todavía no la anuncia, y entonces sólo se puede mirar la lista.
    presentes: (chat && chat.presentes) || [],
    conectado: !!(chat && chat.connected)
  };
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
    if (salas) salas.canalCambio(chat.connected);
  });
  chat.onPresence((names) => {
    conectados = names;
    avisarPresencia();
    // Al rival le puede cambiar la clave al reconectar: la sala lo vuelve a
    // localizar por su identidad estable.
    if (salas) salas.presenciaCambio(chat.presentes);
  });
  chat.onJuego((m) => { if (salas) salas.recibir(m); });
  // Sólo en la extensión: había una partida en marcha cuando el pato se mudó de
  // pestaña. Se rehace en la pestaña nueva a partir de los mensajes que guardó
  // el worker; si no se puede —terminó, o falta el inicio— se suelta y se dice,
  // que es mejor que dejar una partida a medias que no responde.
  chat.onPartidaGuardada((partida) => {
    if (salas && salas.reanudar(partida)) return;
    chat.olvidarPartida();
  });
  // El canal ya puede estar conectado antes de llegar aquí.
  chat.sync();
  // Anuncia el nombre en la presencia del canal. Hace falta en el primer
  // arranque: quien mantiene la conexión lo lee de los ajustes guardados, y ahí
  // todavía no había nombre porque se acaba de generar. Sin esto, el pato sale
  // sin nombre en la lista de conectados hasta que se abren los Ajustes.
  chat.setName(duckName());
  setupSalas();
}

// ---- Partidas entre patos -----------------------------------------------

function setupSalas() {
  salas = crearGestorDeSalas({
    transporte: { enviar: (m) => chat.enviarJuego(m) },
    yo: () => ({ id: chat.miId, nombre: duckName() }),
    rivales: () => chat.rivales(),
    hayCanal: () => chat.connected,
    cadaCierto,
    traza: !!config.isDev
  });

  // Antes de que el chat suelte el puente: el aviso de abandono tiene que salir
  // por él. Aun así, el otro extremo no depende de recibirlo.
  alApagar(() => salas.cerrar());

  salas.alCambiar((s) => {
    if (s.tipo === 'reto') return llegaUnReto(s.reto);
    if (s.tipo === 'empieza') return empiezaLaPartida(s.sala);
    if (s.tipo === 'reanudada') return empiezaLaPartida(s.sala, s.jugadas);
    if (s.tipo === 'rechazado') {
      toast(s.motivo === 'ocupado'
        ? `${s.nombre} está jugando ahora mismo.`
        : `${s.nombre} no quiere jugar ahora.`);
      return;
    }
    if (s.tipo === 'sin-respuesta') { toast(`${s.nombre} no ha contestado.`); return; }
    if (s.tipo === 'revancha-pedida') {
      if (partidaAbierta) partidaAbierta.revanchaPedida(s.nombre);
      else toast(`${s.nombre} quiere otra partida.`);
      return;
    }
    if (s.tipo === 'revancha-esperando') {
      if (partidaAbierta) partidaAbierta.revanchaEsperando(s.nombre);
      return;
    }
    if (s.tipo === 'revancha-rechazada') {
      cerrarPartidaPorElRival(s.nombre, 'Lo dejo aquí. ¡Otro día seguimos!');
      return;
    }
    // Ausente no es lo mismo que ido: todavía puede volver, así que se avisa
    // dentro del panel y no se cierra nada.
    if (s.tipo === 'rival-ausente') {
      if (partidaAbierta) partidaAbierta.revanchaCancelada('Tu rival lleva un rato sin dar señales.');
      else toast('Tu rival lleva un rato sin dar señales.');
      return;
    }
    if (s.tipo === 'fin') {
      const nombre = s.sala && s.sala.rival ? s.sala.rival.nombre : '';
      if (s.motivo === 'abandono-rival') {
        cerrarPartidaPorElRival(nombre, '¡Me tengo que ir! Otra vez será.');
      } else if (s.motivo === 'rival-desconectado' || s.motivo === 'desconexion') {
        // Aquí el rival no ha dicho nada: se ha caído. Poner palabras en su boca
        // sería mentir sobre lo que ha pasado.
        cerrarPartidaPorElRival(null, `Se ha perdido la conexión con ${nombre || 'tu rival'}.`);
      }
      return;
    }
    if (s.tipo === 'retando') { toast('Reto enviado. A ver si contesta…'); return; }
    if (s.tipo === 'suspendida') { toast('Sin conexión: la partida espera.'); return; }
    if (s.tipo === 'reanudada') { toast('De vuelta.'); return; }
    if (s.tipo === 'aviso') { toast(s.texto); return; }
  });
}

/**
 * Se acabó, y no por decisión nuestra: el rival se ha ido o se ha caído.
 *
 * Se cierra el panel y se cuenta en un bocadillo, que es como habla todo lo
 * demás en esta app. Dejar el tablero muerto delante con una nota pequeña al pie
 * es fácil de no ver, y encima invita a seguir pulsando algo que ya no responde.
 *
 * @param {string|null} nombre  quién lo dice; null si nadie ha dicho nada y
 *   sólo se está informando de una desconexión.
 * @param {string} texto
 */
function cerrarPartidaPorElRival(nombre, texto) {
  if (partidaAbierta) {
    // Marcado como cambio de partida: el rival YA se ha ido, así que anunciarle
    // a él que abandonamos no tiene sentido.
    cambiandoDePartida = true;
    try { unregisterOverlay(partidaAbierta.el); } finally { cambiandoDePartida = false; }
    partidaAbierta = null;
  }
  if (nombre) {
    speech.show(nombre, texto, { self: false });
    sonido.cuack({ agudo: 0.9 });
  } else {
    toast(texto);
  }
}

/**
 * Llega un reto.
 *
 * Se avisa siempre —con cartel, cuack y un gesto del pato, que se ve aunque esté
 * en una esquina— pero el panel sólo se monta si el pato está libre. Saltarle
 * una ventana encima a alguien que está haciendo otra cosa no es avisar.
 */
function llegaUnReto(reto) {
  const juego = minijuegoPorId(reto.juego);
  toast(`${reto.rival.nombre} te reta a ${juego ? juego.nombre : 'una partida'}`);
  sonido.cuack({ agudo: 1.25 });
  if (behavior) behavior.playOnce('happy', 1.6);
  if (openOverlays.size === 0 && !dragging && !escena) abrirPanelDeReto(reto);
}

function abrirPanelDeReto(reto) {
  const juego = minijuegoPorId(reto.juego);
  if (!juego) { salas.rechazar(reto.sala, 'no'); return; }
  const p = duckAnchor();
  const { el } = buildRetoPanel(reto, juego.nombre, {
    onAceptar: () => { unregisterOverlay(el); salas.aceptar(reto.sala); },
    onRechazar: () => { unregisterOverlay(el); salas.rechazar(reto.sala, 'no'); },
    onClose: () => unregisterOverlay(el)
  });
  mountPanel(el, p.x, p.y);
}

/**
 * El reto cuajó (o los dos han querido otra): se abre la partida con la sala ya
 * montada. En una revancha hay que cerrar antes el panel de la anterior, que
 * sigue enseñando el resultado.
 */
function empiezaLaPartida(sala, previas) {
  const juego = minijuegoPorId(sala.juego);
  if (!juego) { salas.abandonar(); return; }
  if (partidaAbierta) {
    cambiandoDePartida = true;
    try { unregisterOverlay(partidaAbierta.el); } finally { cambiandoDePartida = false; }
    partidaAbierta = null;
  }
  const p = duckAnchor();
  openPartida(juego, 'turnos', {
    sala: salas.paraElJuego(),
    jugadores: sala.jugadores,
    anfitrion: sala.anfitrion,
    semilla: sala.semilla,
    previas
  }, p.x, p.y);
}

// ---- Visitas ------------------------------------------------------------
//
// Un pato de otra pantalla que viene a ésta. Ver core/visita/PatoVisitante.js.

function setupVisitas() {
  visitas = new ColaDeVisitas({
    sprites: config.sprites,
    // La visita se coloca respecto al pato de casa y pisa su mismo suelo, que
    // cambia con la barra de tareas y con el tamaño del panel.
    suelo: () => duck.ground,
    xLocal: () => duck.centerX(),
    seAdmiten: () => settings.visitas !== false,
    // Se apunta al admitirla, no al verla: una visita dura unos segundos, y
    // enterarse después es justo para lo que sirve el histórico.
    alAnotar: (v) => {
      const texto = (v.texto || '').trim();
      historial.anadir({
        from: v.de,
        text: texto ? `🛫 vino a saludar: ${texto}` : '🛫 vino a saludar',
        ts: v.ts || Date.now(),
        propio: false
      });
    },
    // Y esto cuando ya se le ve entrar, que si no el pato de casa saludaría a
    // uno que todavía está haciendo cola.
    alAparecer: () => {
      sonido.cuack({ agudo: 0.9 });
      if (behavior) behavior.playOnce('happy', 1.4);
    }
  });
  chat.onVisita((v) => visitas.recibir(v));
  alApagar(() => visitas.apagar());
}

// Cuándo se le mandó el pato a cada uno. Vive aquí y no en el panel porque el
// panel se abre y se cierra, y la espera no.
const ultimoEnvio = new Map();

// El receptor cuenta su espera desde que RECIBE, y nosotros desde que mandamos:
// entre una cosa y otra está el viaje por la red. Sin este margen, la cuenta
// atrás podría llegar a cero justo antes que la suya y el pato se descartaría al
// otro lado sin que aquí se notara — que es exactamente lo que hay que evitar.
const MARGEN_ENVIO = 2000;

/**
 * Cuánto falta para poder mandarle otra vez el pato a alguien (ms; 0 = ya).
 *
 * Es la misma espera que aplica quien recibe (ver ESPERA_ENTRE_VISITAS): se
 * mira aquí para poder enseñarla, porque un pato mandado antes de tiempo se
 * descarta en la otra punta y el que lo manda no se entera de nada.
 */
function esperaParaVisitar(clave) {
  const cuando = ultimoEnvio.get(clave);
  if (!cuando) return 0;
  return Math.max(0, (ESPERA_ENTRE_VISITAS + MARGEN_ENVIO) - (Date.now() - cuando));
}

/**
 * Manda el pato a la pantalla de otro.
 * @returns {boolean} si ha salido de verdad.
 */
function enviarVisita(destino, texto) {
  if (!destino || !destino.clave) return false;
  // El panel ya no deja pulsar durante la espera; esto es por si acaso, para no
  // apuntar en el histórico un viaje que no va a llegar.
  if (esperaParaVisitar(destino.clave) > 0) return false;

  const salio = chat.enviarVisita({
    aClave: destino.clave,
    de: duckName(),
    skin: duck.skinId,
    gesto: 'saludo',
    texto: (texto || '').trim()
  });
  historial.anadir({
    from: duckName(),
    text: `🛫 tu mascota se ha ido a ver a ${destino.nombre}`,
    ts: Date.now(),
    propio: true,
    fallo: !salio
  });
  // La espera empieza a contar sólo si el pato salió: si el canal estaba caído
  // no ha ido a ninguna parte, y no hay por qué castigar el reintento.
  if (salio) {
    ultimoEnvio.set(destino.clave, Date.now());
    hacerElPaseo();
  }
  return salio;
}

/** El paseíllo de "me voy a llevarlo", si no hay ya uno en marcha. */
function hacerElPaseo() {
  if (!duck || !behavior) return;
  // Estando en el aire no hay paseo que valga: el pato está describiendo una
  // parábola y meterle un bucle encima lo dejaría clavado a media caída.
  if (dragging || vuelo.volando) return;
  cancelarPaseo();
  paseo = salirYVolver(duck, behavior);
}

/** Corta el paseo y devuelve el pato a su sitio. Vale aunque no hubiera ninguno. */
function cancelarPaseo() {
  if (!paseo) return;
  paseo.cancelar();
  paseo = null;
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
// Lo último que se sabe de la actualización, y quién quiere enterarse.
//
// Se recuerda porque los avisos vuelan antes de que nadie los escuche: la
// comprobación del arranque termina mucho antes de que se abra Ajustes, y sin
// esto el panel se abriría en blanco.
let ultimaActualizacion = { tipo: 'desconocido' };
const oyentesActualizacion = new Set();

function avisarActualizacion() {
  for (const cb of oyentesActualizacion) {
    try { cb(ultimaActualizacion); } catch (err) { console.warn('[pato] oyente falló', err); }
  }
}

function setupUpdates() {
  api.alRecibirActualizacion((evt) => {
    if (!evt) return;
    // Los avisos de siempre, que no cambian.
    if (evt.type === 'available') toast(`Descargando actualización v${evt.version}…`);
    else if (evt.type === 'ready') toast('¡Nueva versión lista! Se aplicará al reiniciar.');

    // Y lo nuevo: recordarlo para Ajustes. El proceso principal manda ahora el
    // estado con `tipo`; los avisos de arriba llegan con `type` desde siempre y
    // se dejan como están para no tocar lo que ya funciona.
    if (evt.tipo) {
      ultimaActualizacion = evt;
      avisarActualizacion();
    }
  });

  // Y se pregunta una vez al arrancar: puede haber pasado ya de todo antes de
  // que el pato estuviera montado.
  Promise.resolve(api.estadoActualizacion())
    .then((estado) => {
      if (!estado) return;
      ultimaActualizacion = estado;
      avisarActualizacion();
    })
    .catch(() => { /* sin actualizaciones que consultar */ });
}

function toast(text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  montar(el);
  setTimeout(() => el.remove(), 5000);
}
