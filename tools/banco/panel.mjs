// Banco de pruebas para un minijuego de PANEL, sin abrir ventana.
//
// Un juego de panel devuelve un `el` que el marco monta, se construye con
// `document.createElement` y responde a clics. O sea que necesita DOM.
//
// ---- Por qué jsdom y no un remedo ------------------------------------------
//
// Escribir cuatro objetos con `appendChild` y `classList` es tentador y sale
// mal: un remedo se parece a lo que UNO CREE que hace el DOM, no a lo que hace.
// Y lo que se prueba aquí son cosas como «este botón sigue vivo cuando no
// debería» o «este clic llega al manejador de al lado», que son exactamente las
// que un remedo se inventa a su favor.
//
// jsdom es dependencia de desarrollo, no de la app: `npm ci --omit=dev` no la
// trae, y por eso `cargarPanel` avisa en vez de reventar cuando falta.
//
// ---- Los relojes sí son de mentira ------------------------------------------
//
// `cadaCierto` se guarda y se dispara a mano con `avanzar(ms)`. Así una partida
// de tres minutos se juega en unos milisegundos y, sobre todo, es determinista:
// con temporizadores de verdad, el mismo fallo aparece unas veces sí y otras no.

/**
 * UNA sola ventana para todo el proceso.
 *
 * Con una por banco, dos partidas a la vez se pisan el `globalThis.document` y
 * la segunda acaba creando sus elementos en el documento de la primera. Y una
 * sola es además más fiel: en la app también hay un solo documento.
 */
let ventana = null;

/**
 * Prepara el DOM. Hay que llamarla —y esperarla— antes de crear ningún panel.
 *
 * @returns {Promise<boolean>} si jsdom está disponible
 */
export async function cargarPanel() {
  if (ventana) return true;
  let JSDOM = null;
  try {
    ({ JSDOM } = await import('jsdom'));
  } catch {
    return false;
  }
  ventana = new JSDOM('<!doctype html><body></body>').window;
  globalThis.window = ventana;
  globalThis.document = ventana.document;
  globalThis.Node = ventana.Node;
  globalThis.Element = ventana.Element;
  globalThis.HTMLElement = ventana.HTMLElement;
  return true;
}

/**
 * @param {Object} [opciones] los mismos que el banco de escenario
 * @returns {{ctx:Object, caja:Object, registro:Object, montar:Function,
 *            avanzar:Function, matar:Function}}
 */
export function crearPanel(opciones = {}) {
  if (!ventana) throw new Error('hay que llamar a `cargarPanel()` antes');

  // Cada banco en su propio cajón: así el `querySelector` de una partida no
  // encuentra los botones de la otra, que es el fallo más fácil de cometer al
  // probar dos a la vez y el más difícil de ver luego.
  const caja = ventana.document.createElement('div');
  ventana.document.body.appendChild(caja);

  const relojes = [];
  const cuadros = [];
  const alMorir = [];
  const registro = { dichos: [], fin: null, notas: 0 };

  const ctx = {
    juego: { id: opciones.id || 'x', nombre: opciones.id || 'x' },
    modo: opciones.modo || 'solo',
    nivel: opciones.nivel || 50,
    yo: opciones.yo || 'Yo',
    jugadores: opciones.jugadores || ['Yo'],
    anfitrion: opciones.anfitrion !== false,
    semilla: opciones.semilla || 1,
    marcas: opciones.marcas || {},
    sprites: {},
    sala: opciones.sala || null,
    escenario: null,
    sonido: { nota: () => { registro.notas++; }, boing: () => {}, victoria: () => {}, derrota: () => {} },
    pato: { animar: () => {} },
    decir: (t) => registro.dichos.push(String(t)),
    alTerminar: (r) => { if (!registro.fin) registro.fin = r; },
    cadaFrame: (fn) => {
      cuadros.push(fn);
      return () => { const i = cuadros.indexOf(fn); if (i >= 0) cuadros.splice(i, 1); };
    },
    cadaCierto: (fn, ms) => {
      const r = { fn, ms: Math.max(1, ms), resto: Math.max(1, ms), vivo: true };
      relojes.push(r);
      return () => { r.vivo = false; };
    },
    escuchar: (objetivo, evento, fn, op) => { objetivo.addEventListener(evento, fn, op); },
    alDestruir: (fn) => { alMorir.push(fn); }
  };

  return {
    ctx, caja, registro,
    ventana,
    /** Mete el tablero en la página, que es lo que hace el marco de verdad. */
    montar(el) { if (el) caja.appendChild(el); },
    /** Adelanta el reloj: dispara los `cadaCierto` que toquen. */
    avanzar(ms) {
      for (const r of relojes) {
        if (!r.vivo) continue;
        r.resto -= ms;
        // Con tope: un `cadaCierto` de 1 ms y un salto grande dispararían miles
        // de veces y la prueba parecería colgada.
        let vueltas = 0;
        while (r.vivo && r.resto <= 0 && vueltas < 200) {
          r.resto += r.ms;
          vueltas++;
          r.fn();
        }
      }
      for (const fn of cuadros.slice()) fn(ms / 1000);
    },
    /** Lo que el marco suelta al cerrar. */
    matar() {
      for (const fn of alMorir) { try { fn(); } catch { /* da igual */ } }
      caja.remove();
    }
  };
}

/** Un clic de verdad, con su evento y su burbuja. */
export function pulsar(el) {
  if (!el || el.disabled) return false;
  el.dispatchEvent(new ventana.MouseEvent('click', { bubbles: true }));
  return true;
}

/** El primer botón de la caja cuyo texto contenga `txt`. */
export function boton(caja, txt) {
  return Array.from(caja.querySelectorAll('button'))
    .find((b) => (b.textContent || '').includes(txt)) || null;
}

/**
 * Un respiro al bucle de eventos.
 *
 * Hace falta un temporizador DE VERDAD y no `setImmediate`: los compromisos van
 * con `crypto.subtle.digest`, que resuelve desde fuera del bucle de microtareas.
 * Con `setImmediate` la promesa no se cumple nunca y la partida parece colgada
 * cuando lo único que pasa es que la prueba no la deja respirar.
 */
export function respirar() {
  return new Promise((r) => setTimeout(r, 0));
}
