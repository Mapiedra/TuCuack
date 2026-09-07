// Plataforma de escritorio: traduce el contrato del núcleo (`src/core/platform.js`)
// al puente `window.pato` que expone el preload de Electron.
//
// Aquí no hay lógica de pato: sólo el cambio de idioma entre el núcleo y el
// proceso principal.

/** @returns {import('../core/platform.js').Plataforma} */
export function crearPlataformaElectron() {
  const pato = window.pato;

  return {
    nombre: 'electron',

    // El overlay de escritorio lo puede todo: es una ventana propia con bandeja,
    // varios monitores debajo y autoactualización por electron-updater.
    capacidades: {
      capturaRaton: true,
      multiMonitor: true,
      salir: true,
      ocultar: true,      // se recoge en la bandeja, y de ahí se le vuelve a sacar
      autoArranque: true,
      actualizaciones: true,
      comandosExternos: true,
      juegosDeEscenario: true,
      marcadorGlobal: true,
      historialDePartidas: true,
      privados: true
    },

    config: () => pato.getConfig(),
    cargarEstado: () => pato.loadState(),
    guardarEstado: (d) => pato.saveState(d),
    cargarAjustes: () => pato.loadSettings(),
    guardarAjustes: (d) => pato.saveSettings(d),

    // El documento vive en `src/desktop/`, dos niveles por debajo de `assets/`.
    urlAsset: (rel) => `../../assets/${rel}`,

    // El núcleo pide el ratón en positivo; la ventana se configura al revés.
    capturarRaton: (capturar) => pato.setIgnoreMouse(!capturar),
    empezarArrastre: () => pato.dragStart(),
    terminarArrastre: () => pato.dragEnd(),
    alCambiarEscenario: (cb) => pato.onLayoutChanged(cb),
    alCambiarPantalla: (cb) => pato.onDisplayChanged(cb),

    salir: () => pato.quit(),
    ocultar: () => pato.hide(),
    estadoActualizacion: () => pato.estadoActualizacion(),
    buscarActualizacion: () => pato.buscarActualizacion(),
    instalarActualizacion: () => pato.instalarActualizacion(),
    abrirExterno: (url) => pato.openExternal(url),
    alCerrar: (cb) => pato.onBeforeQuit(cb),
    alRecibirComando: (cb) => pato.onTrayCommand(cb),
    alRecibirActualizacion: (cb) => pato.onUpdateEvent(cb),

    marcador: {
      mejores: (juego, mejorEs) => pato.marcadorMejores(juego, mejorEs),
      todos: () => pato.marcadorTodos(),
      guardar: (record) => pato.marcadorGuardar(record)
    },

    partidas: {
      guardar: (p) => pato.partidasGuardar(p),
      mias: () => pato.partidasMias()
    },

    privados: {
      enviar: (m) => pato.privadosEnviar(m),
      leer: (con, tope) => pato.privadosLeer(con, tope),
      conversaciones: () => pato.privadosConversaciones(),
      bloquear: (a, si) => pato.privadosBloquear(a, si),
      bloqueados: () => pato.privadosBloqueados(),
      borrarTodo: () => pato.privadosBorrarTodo()
    },

    // El histórico del chat se guarda al otro lado del puente, en un fichero
    // propio: aquí el pato es el único que escribe, así que basta con pasarle
    // cada mensaje según se apunta.
    historial: {
      cargar: () => pato.historialCargar(),
      anotar: (m) => pato.historialAnotar(m),
      marcarLeido: (ts) => pato.historialLeido(ts)
    },

    chat: {
      enviar: (msg) => pato.sendChat(msg),
      enviarVisita: (v) => pato.sendVisit(v),
      enviarJuego: (m, porSala) => pato.sendGame(m, porSala),
      entrarEnSala: (salaId) => pato.entrarEnSala(salaId),
      salirDeSala: () => pato.salirDeSala(),
      // El proceso principal sabe abrir un canal por partida. Se dice aquí y no
      // preguntándoselo por IPC porque no cambia nunca: es una propiedad de la
      // carcasa, no un estado.
      puedeSala: () => true,
      // En el escritorio el canal vive en el proceso main y el pato no se muda
      // a ninguna parte: no hay partida que guardar para nadie.
      ponerNombre: (n) => pato.setChatName(n),
      alRecibirEvento: (cb) => pato.onChatEvent(cb),
      estado: () => pato.chatStatus()
    }
  };
}
