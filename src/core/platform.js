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
  marcadorGlobal: false,
  // ¿Se guardan las partidas por red para poder mirarlas luego? Necesita lo
  // mismo que el marcador, pero se pregunta aparte a propósito: son dos tablas
  // distintas y una carcasa puede llegar a una y no a la otra mientras se está
  // desplegando.
  historialDePartidas: false,
  // ¿Hay mensajes privados? Necesita que la carcasa pueda hablar con Supabase y
  // que tenga una dirección con la que firmar (ver `privados` más abajo).
  privados: false,
  // ¿El monedero vive en el servidor? Necesita lo mismo que el marcador. Donde
  // no lo hay —el banco de pruebas— los cuacks siguen funcionando contra el
  // disco, como antes: el juego no se queda sin moneda por no haber servidor.
  // Lo que cambia es quién manda, y eso sí hay que preguntarlo antes de decirle
  // a nadie que su saldo está a salvo de que le toquen el fichero.
  monederoEnServidor: false,
  // ¿Tiene sentido el modo concentración? Necesita poder esconderse Y volver a
  // sacarse él solo (a diferencia de `ocultar`, que sólo lo primero) y un sitio
  // fuera del documento donde enseñar la cuenta atrás mientras está escondido.
  // Sólo el escritorio tiene las dos cosas: bandeja del sistema y una ventana
  // que puede mostrarse sin que nadie la reabra a mano.
  focus: false
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
  /** Todo el marcador de una vez, para la vista de conjunto.
   *  @type {() => Promise<object>} */
  todos: async () => ({ ok: false, error: 'sin-marcador' }),
  /** @type {(r:{juego:string, nombre:string, marca:number, mejorEs:string}) => Promise<object>} */
  guardar: async () => ({ ok: false, error: 'sin-marcador' })
};

/**
 * Dónde se guarda el histórico del chat, cuando no hay dónde.
 *
 * Quién escribe de verdad cambia según la casa, y por eso esto es un hueco del
 * contrato y no un fichero del núcleo: en el escritorio el pato es el único que
 * está despierto y escribe él; en la extensión escribe el service worker, que
 * es lo único que sigue vivo cuando el pato se muda de pestaña o no hay ninguna
 * a la vista. `anotar` tiene que ser idempotente —el mismo mensaje puede
 * llegarle a los dos—, y por eso los mensajes llevan identificador.
 */
const HISTORIAL_SIN_GUARDAR = {
  /** @type {() => Promise<{mensajes:object[], leidoHasta:number}>} */
  cargar: async () => ({ mensajes: [], leidoHasta: 0 }),
  /** Apunta un mensaje, si no estaba ya. */
  anotar: noop,
  /** Guarda hasta qué instante está leído el histórico. */
  marcarLeido: noop
};

/**
 * El historial de partidas, cuando no lo hay.
 *
 * Mismo reparto que el marcador y por el mismo motivo: el núcleo nunca ve la
 * firma con la que se escribe. Pide «apunta esta partida» y quien la firma es la
 * carcasa. Y aquí LEER también la exige —un historial es de quien lo juega, no
 * una tabla pública—, así que `mias` tampoco recibe identidad ninguna: la
 * carcasa ya sabe de quién es.
 *
 * Las dos devuelven `{ok, datos?, error?}` y no lanzan.
 */
const PARTIDAS_DESACTIVADAS = {
  /** @type {(p:{id:string, juego:string, rival:string, resultado:string,
   *              marca:number|null}) => Promise<object>} */
  guardar: async () => ({ ok: false, error: 'sin-historial' }),
  /** @type {() => Promise<object>} */
  mias: async () => ({ ok: false, error: 'sin-historial' })
};

/**
 * El monedero, cuando no lo hay.
 *
 * Mismo reparto que el marcador: el núcleo nunca ve la firma. Y una diferencia
 * de fondo con todo lo demás del contrato, que está razonada entera en
 * `supabase/cuacks.sql`: el pato NO manda cuántos cuacks ha ganado, manda QUÉ
 * partida ha jugado. El importe lo calcula el servidor con su propio catálogo,
 * porque si no, mover el saldo a la nube no habría arreglado nada.
 *
 * Desactivado, todas contestan que no hay servidor. Eso NO deja al pato sin
 * moneda: la cartera del núcleo sigue llevando la cuenta contra el disco (ver
 * game/cuacks.js), y lo que se juega mientras tanto se apunta en su cola.
 *
 * Todas devuelven `{ok, datos?, error?}` y no lanzan.
 */
const MONEDERO_DESACTIVADO = {
  /** El monedero tal y como está en el servidor.
   *  @type {() => Promise<object>} */
  mios: async () => ({ ok: false, error: 'sin-monedero' }),
  /** Lo crea con la cifra del disco, si no existía. Si existía, no lo toca.
   *  @type {(local:{saldo:number, ganado:number, comprados:string[],
   *                 diaDeLaBroma:string}) => Promise<object>} */
  estrenar: async () => ({ ok: false, error: 'sin-monedero' }),
  /** Apunta una partida para que la pague el servidor. `id` la identifica, y por
   *  eso reintentarla no la cobra dos veces.
   *  @type {(p:{id:string, juego:string, resultado:string,
   *             enRed:boolean}) => Promise<object>} */
  partida: async () => ({ ok: false, error: 'sin-monedero' }),
  /** Compra un juego. El precio lo pone el catálogo del servidor.
   *  @type {(juegoId:string) => Promise<object>} */
  comprar: async () => ({ ok: false, error: 'sin-monedero' }),
  /** Cobra el peaje de la broma. Una vez al día, y lo vigila el servidor.
   *  @type {(nivel:number) => Promise<object>} */
  broma: async () => ({ ok: false, error: 'sin-monedero' }),
  /** Tira el monedero propio. Sin vuelta atrás.
   *  @type {() => Promise<object>} */
  borrar: async () => ({ ok: false, error: 'sin-monedero' })
};

/**
 * Mensajes privados, cuando no los hay.
 *
 * No van por el canal como el chat: van a una tabla. Un privado tiene que llegar
 * aunque el otro no estuviera conectado, y un broadcast no se guarda en ningún
 * sitio.
 *
 * Mismo reparto que el marcador: el núcleo no ve nunca la firma. Pide «mándale
 * esto a esa dirección» y quien firma es la carcasa. Y leer también la exige,
 * porque una conversación es de los dos que la tienen.
 *
 * Todas devuelven `{ok, datos?, error?}` y no lanzan.
 */
const PRIVADOS_DESACTIVADOS = {
  /** @type {(m:{para:string, mid:string, texto:string}) => Promise<object>} */
  enviar: async () => ({ ok: false, error: 'sin-privados' }),
  /** @type {(con:string, tope?:number) => Promise<object>} */
  leer: async () => ({ ok: false, error: 'sin-privados' }),
  /** @type {() => Promise<object>} */
  conversaciones: async () => ({ ok: false, error: 'sin-privados' }),
  /** @type {(a:string, bloquear?:boolean) => Promise<object>} */
  bloquear: async () => ({ ok: false, error: 'sin-privados' }),
  /** @type {() => Promise<object>} */
  bloqueados: async () => ({ ok: false, error: 'sin-privados' }),
  /** @type {() => Promise<object>} */
  borrarTodo: async () => ({ ok: false, error: 'sin-privados' })
};

const CHAT_DESACTIVADO = {
  enviar: noop,
  // Mandar el pato a la pantalla de otro. Va por el mismo canal que el chat,
  // pero en un evento aparte y con destinatario (ver core/visita/).
  enviarVisita: noop,
  // Jugadas de una partida. Van en su propio evento y con destinatario,
  // exactamente igual que las visitas (ver core/game/salas.js).
  enviarJuego: noop,

  // El canal privado de una partida.
  //
  // Estando dentro, los mensajes de ESA sala salen por ahí en vez de por el
  // canal común, y sólo los recibe quien juega. El reto sigue yendo por el
  // común: hasta que alguien reta no hay sala a la que ir.
  //
  // Es cosa de la carcasa porque es cosa de la conexión, y la conexión no vive
  // en el pato: está en el proceso principal de Electron o en el service worker
  // de la extensión, que es además lo único que sobrevive a que el pato se mude
  // de pestaña a mitad de partida.
  entrarEnSala: noop,
  salirDeSala: noop,
  /** ¿Sabe esta carcasa abrir un canal por partida? Sin preguntarlo, el pato lo
   *  intentaría igual y se quedaría hablándole a un canal en el que no está. */
  puedeSala: () => false,
  /** Tira el canal a propósito, para poder ver la reconexión. Sólo hace algo en
   *  desarrollo; ver `caerAdrede` en src/main/chat.js. */
  caerAdrede: noop,
  // Sólo donde el canal viva fuera del pato: le dice que ya no hay partida que
  // guardar para la próxima pestaña.
  olvidarPartida: noop,
  ponerNombre: noop,
  alRecibirEvento: noSuscribir,
  estado: async () => ({
    connected: false, names: [], presentes: [], clave: '', id: '',
    partida: null, reason: 'sin-plataforma'
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
    // Opcional. Sólo lo aporta la carcasa que no sepa reenviar el movimiento
    // del ratón mientras los clics la atraviesan (Linux): entonces el pato va
    // diciendo dónde está para que se le pueda ver venir. Ver `src/main/raton.js`.
    publicarZona: p.publicarZona || null,
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
    // Lo contrario de `ocultar`, pero desde el propio pato: hace falta para que
    // el modo concentración pueda sacarse solo al llegar el descanso, sin
    // esperar a que alguien vaya a la bandeja.
    mostrar: p.mostrar || noop,
    // El modo concentración avisa de la cuenta atrás fuera del documento (ver
    // `capacidades.focus`): mientras está escondido, la bandeja es lo único
    // que puede enseñar cuánto queda.
    avisarFoco: p.avisarFoco || noop,
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

    // ---- Histórico del chat ----------------------------------------------
    historial: { ...HISTORIAL_SIN_GUARDAR, ...(p.historial || {}) },

    // ---- Marcador global -------------------------------------------------
    marcador: { ...MARCADOR_DESACTIVADO, ...(p.marcador || {}) },

    // ---- Historial de partidas por red -----------------------------------
    partidas: { ...PARTIDAS_DESACTIVADAS, ...(p.partidas || {}) },

    // ---- El monedero -----------------------------------------------------
    monedero: { ...MONEDERO_DESACTIVADO, ...(p.monedero || {}) },

    // ---- Mensajes privados -----------------------------------------------
    privados: { ...PRIVADOS_DESACTIVADOS, ...(p.privados || {}) }
  };
}

/** Plataforma que no hace nada: útil para pruebas y para arrancar el núcleo
 *  aislado y ver si el pato se mueve. */
export function plataformaNula(extra = {}) {
  return normalizarPlataforma(extra);
}
