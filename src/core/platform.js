// Contrato entre el pato y la carcasa que lo aloja.
//
// El núcleo (`src/core`) es JavaScript de navegador puro: no sabe si vive en una
// ventana de Electron, en el panel lateral de una extensión de Chrome o en una
// pestaña suelta. Todo lo que necesita del entorno pasa por este objeto.
//
// Cada carcasa aporta su implementación:
//   - `src/desktop/platform.js`   → Electron, a través del puente `window.pato`.
//   - `src/extension/platform.js` → chrome.storage + service worker.
//
// `normalizarPlataforma` rellena con no-ops todo lo que la carcasa no
// implemente, de modo que el núcleo puede llamar a cualquier método sin
// comprobar antes si existe. Lo que NO se puede simular con un no-op —porque
// cambia lo que se le enseña al usuario— va en `capacidades`.

const noop = () => {};
const noSuscribir = () => {};

/** Lo que la carcasa puede o no puede hacer. El núcleo consulta esto para
 *  decidir qué opciones ofrece, no para saber si un método existe. */
const CAPACIDADES_POR_DEFECTO = {
  // ¿La ventana deja pasar los clics cuando el cursor no está sobre el pato?
  // Sólo el overlay de escritorio: en un panel o una página el pato ocupa su
  // propio documento y no hay nada debajo que estorbar.
  capturaRaton: false,
  // ¿El pato puede cruzar de monitor mientras se arrastra?
  multiMonitor: false,
  // ¿Tiene sentido un "Salir" en el menú? En una extensión no se sale de nada.
  salir: false,
  // ¿Se puede arrancar con el sistema? Sólo una app instalada.
  autoArranque: false,
  // ¿Hay autoactualización de la que informar?
  actualizaciones: false,
  // ¿Llegan órdenes desde fuera del documento (bandeja del sistema, menú de la
  // extensión)?
  comandosExternos: false
};

const CONFIG_POR_DEFECTO = { version: '0.0.0', isDev: false, ground: 0, sprites: {} };

const CHAT_DESACTIVADO = {
  enviar: noop,
  ponerNombre: noop,
  alRecibirEvento: noSuscribir,
  estado: async () => ({ connected: false, names: [], historial: [], reason: 'sin-plataforma' }),
  // Sólo hace falta donde el canal viva fuera del pato y haya que soltarlo al
  // apagarse, para no dejar puentes abiertos que dupliquen los mensajes.
  cerrar: noop
};

/**
 * Completa una implementación parcial de plataforma.
 * @param {Partial<Plataforma>} p
 * @returns {Plataforma}
 */
export function normalizarPlataforma(p = {}) {
  return {
    nombre: p.nombre || 'desconocida',
    capacidades: { ...CAPACIDADES_POR_DEFECTO, ...(p.capacidades || {}) },

    // ---- Configuración y persistencia -----------------------------------
    // `config()` describe el entorno: versión, si es desarrollo, a qué altura
    // está el suelo y los metadatos de los sprite sheets.
    config: p.config || (async () => ({ ...CONFIG_POR_DEFECTO })),
    cargarEstado: p.cargarEstado || (async () => ({})),
    guardarEstado: p.guardarEstado || noop,
    cargarAjustes: p.cargarAjustes || (async () => ({})),
    guardarAjustes: p.guardarAjustes || noop,

    // ---- Recursos --------------------------------------------------------
    // Convierte una ruta dentro de `assets/` en una URL utilizable. En Electron
    // es una ruta relativa al documento; en una extensión, chrome.runtime.getURL.
    urlAsset: p.urlAsset || ((rel) => `assets/${rel}`),
    // Opcional. Sólo lo aporta quien no pueda cargar el sheet como una imagen
    // normal del documento: ver `configurarCargadorSheet` en assets.js.
    cargarSheet: p.cargarSheet || null,

    // ---- Puntero y escenario --------------------------------------------
    // El núcleo avisa en positivo: "ahora hace falta el ratón". Traducirlo a lo
    // que toque (en Electron, invertirlo para setIgnoreMouseEvents) es cosa de
    // la carcasa.
    capturarRaton: p.capturarRaton || noop,
    empezarArrastre: p.empezarArrastre || noop,
    terminarArrastre: p.terminarArrastre || noop,
    // El suelo se ha movido (cambio de resolución, panel redimensionado).
    alCambiarEscenario: p.alCambiarEscenario || noSuscribir,
    // El pato ha cruzado a otro monitor: llega el suelo nuevo y dónde está el
    // cursor dentro de la ventana recién mudada.
    alCambiarPantalla: p.alCambiarPantalla || noSuscribir,

    // ---- Ciclo de vida ---------------------------------------------------
    salir: p.salir || noop,
    abrirExterno: p.abrirExterno || noop,
    alCerrar: p.alCerrar || noSuscribir,
    alRecibirComando: p.alRecibirComando || noSuscribir,
    alRecibirActualizacion: p.alRecibirActualizacion || noSuscribir,

    // ---- Chat entre patos ------------------------------------------------
    chat: { ...CHAT_DESACTIVADO, ...(p.chat || {}) }
  };
}

/** Plataforma que no hace nada: útil para pruebas y para arrancar el núcleo
 *  aislado y ver si el pato se mueve. */
export function plataformaNula(extra = {}) {
  return normalizarPlataforma(extra);
}
