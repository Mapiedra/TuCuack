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
  // ¿El pato puede esconderse y volver luego? En el escritorio se recoge en la
  // bandeja; en la extensión, en el menú del icono. Donde no haya sitio del que
  // volver a sacarlo, mejor no ofrecerlo: sería una opción sin vuelta atrás.
  ocultar: false,
  // ¿Se puede arrancar con el sistema? Sólo una app instalada.
  autoArranque: false,
  // ¿Hay autoactualización de la que informar?
  actualizaciones: false,
  // ¿Llegan órdenes desde fuera del documento (bandeja del sistema, menú de la
  // extensión)?
  comandosExternos: false,
  // ¿Cabe un minijuego que ocupe el escenario entero? En el escritorio y en el
  // panel lateral, sí: el pato tiene el sitio para él solo. Sobre una página
  // ajena, no: capturar el ratón de toda la ventana dejaría al usuario sin poder
  // pulsar nada de la web que estaba leyendo, y eso no es un juego, es un
  // secuestro.
  juegosDeEscenario: false,
  // ¿Hay marcador global? Hace falta hablar con Supabase desde fuera del
  // documento, así que sólo donde la carcasa puede: el escritorio y la
  // extensión. En el banco de pruebas no, y por eso se pregunta antes de
  // ofrecerlo en vez de dar por hecho que existe.
  marcadorGlobal: false
};

const CONFIG_POR_DEFECTO = { version: '0.0.0', isDev: false, ground: 0, sprites: {} };

/**
 * El marcador global, cuando no lo hay.
 *
 * Ojo al reparto de trabajo, que es lo único raro de este trozo del contrato: el
 * núcleo NUNCA ve la firma con la que se escribe. Pide «guarda esta marca» y
 * quien la firma es la carcasa, desde donde el secreto no puede salir. Si
 * viajara hasta aquí estaría también en la extensión, dentro de la página web de
 * cualquiera. Ver `main/marcador.js` y `supabase/records.sql`.
 *
 * Las dos devuelven `{ok, datos?, error?}` y no lanzan: quien las llama es el
 * pato acabando una partida, y ahí una excepción sin dueño se lleva por delante
 * algo que sí importaba.
 */
const MARCADOR_DESACTIVADO = {
  /** @type {(juego:string, mejorEs:'mas'|'menos') => Promise<object>} */
  mejores: async () => ({ ok: false, error: 'sin-marcador' }),
  /** @type {(r:{juego:string, nombre:string, marca:number, mejorEs:string}) => Promise<object>} */
  guardar: async () => ({ ok: false, error: 'sin-marcador' })
};

const CHAT_DESACTIVADO = {
  enviar: noop,
  // Mandar el pato a la pantalla de otro. Va por el mismo canal que el chat,
  // pero en un evento aparte y con destinatario (ver core/visita/).
  enviarVisita: noop,
  // Jugadas de una partida. Van por el mismo canal, en su propio evento y con
  // destinatario, exactamente igual que las visitas (ver core/game/salas.js).
  enviarJuego: noop,
  // Sólo donde el canal viva fuera del pato: le dice que ya no hay partida que
  // guardar para la próxima pestaña.
  olvidarPartida: noop,
  ponerNombre: noop,
  alRecibirEvento: noSuscribir,
  estado: async () => ({
    connected: false, names: [], presentes: [], clave: '', id: '',
    historial: [], partida: null, reason: 'sin-plataforma'
  }),
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
    // Esconde al pato sin cerrarlo. Cómo se vuelve a sacar es cosa de la
    // carcasa: la bandeja del sistema o el menú del icono de la extensión.
    ocultar: p.ocultar || noop,
    abrirExterno: p.abrirExterno || noop,
    alCerrar: p.alCerrar || noSuscribir,
    alRecibirComando: p.alRecibirComando || noSuscribir,
    alRecibirActualizacion: p.alRecibirActualizacion || noSuscribir,
    // Actualizaciones a mano: mirar ahora y aplicar ahora. Donde no haya
    // actualizaciones —la extensión se actualiza sola desde Chrome— esto no se
    // ofrece; ver `capacidades.actualizaciones`.
    estadoActualizacion: p.estadoActualizacion || (async () => ({ tipo: 'no-disponible' })),
    buscarActualizacion: p.buscarActualizacion || noop,
    instalarActualizacion: p.instalarActualizacion || noop,

    // ---- Chat entre patos ------------------------------------------------
    chat: { ...CHAT_DESACTIVADO, ...(p.chat || {}) },

    // ---- Marcador global -------------------------------------------------
    marcador: { ...MARCADOR_DESACTIVADO, ...(p.marcador || {}) }
  };
}

/** Plataforma que no hace nada: útil para pruebas y para arrancar el núcleo
 *  aislado y ver si el pato se mueve. */
export function plataformaNula(extra = {}) {
  return normalizarPlataforma(extra);
}
