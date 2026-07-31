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
      autoArranque: true,
      actualizaciones: true,
      comandosExternos: true
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
    abrirExterno: (url) => pato.openExternal(url),
    alCerrar: (cb) => pato.onBeforeQuit(cb),
    alRecibirComando: (cb) => pato.onTrayCommand(cb),
    alRecibirActualizacion: (cb) => pato.onUpdateEvent(cb),

    chat: {
      enviar: (msg) => pato.sendChat(msg),
      ponerNombre: (n) => pato.setChatName(n),
      alRecibirEvento: (cb) => pato.onChatEvent(cb),
      estado: () => pato.chatStatus()
    }
  };
}
