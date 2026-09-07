// Plataforma del pato cuando vive en el panel lateral de Chrome.
//
// El panel es un documento propio de la extensión: no hay CSP ajena que
// esquivar, ni contenido de nadie a quien cederle los clics. Lo que comparte con
// la versión de página —almacenamiento y chat— está en `almacen.js`.

import { conectarChat, marcador, partidas, leerAjustes, escribirAjustes, leerEstado,
  escribirEstado, leerHistorial, alCerrarDocumento, ocultarElPato } from './almacen.js';

/** @returns {import('./core/platform.js').Plataforma} */
export function crearPlataformaExtension() {
  const manifest = chrome.runtime.getManifest();
  // Un solo puente con el worker: por él van el chat y el histórico.
  const canal = conectarChat();

  return {
    nombre: 'panel',

    // El panel es un documento propio: no hay nada debajo a lo que cederle los
    // clics, ni monitores que cruzar, ni proceso del que salir.
    capacidades: {
      capturaRaton: false,
      multiMonitor: false,
      salir: false,
      ocultar: true,      // vuelve con el menú del icono de la extensión
      autoArranque: false,
      actualizaciones: false,
      comandosExternos: true,
      // En el panel lateral el pato tiene el documento para él solo.
      juegosDeEscenario: true,
      marcadorGlobal: true,
      historialDePartidas: true
    },

    async config() {
      let sprites = {};
      try {
        const res = await fetch(chrome.runtime.getURL('assets/sprites/index.json'));
        if (res.ok) sprites = await res.json();
      } catch (err) {
        console.warn('[pato] no se pudo leer el índice de sprites:', err);
      }
      return {
        version: manifest.version,
        // Cargada sin empaquetar (modo desarrollador) no hay update_url.
        isDev: !('update_url' in manifest),
        // Altura de la hierba del panel: el pato camina encima, no sobre el borde
        // de la ventana. Tiene que coincidir con `--suelo` en panel.html.
        ground: 30,
        sprites
      };
    },

    cargarEstado: leerEstado,
    guardarEstado: escribirEstado,
    cargarAjustes: leerAjustes,
    guardarAjustes: escribirAjustes,

    urlAsset: (rel) => chrome.runtime.getURL(`assets/${rel}`),

    abrirExterno: (url) => chrome.tabs.create({ url }),
    ocultar: () => ocultarElPato(),
    // Guardado final: cerrar el panel destruye el documento sin más aviso.
    alCerrar: alCerrarDocumento,

    alRecibirComando: (cb) => {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg && msg.tipo === 'comando') cb(msg.comando);
      });
    },

    chat: canal,

    // El histórico del chat: se lee del almacenamiento y se escribe pidiéndoselo
    // al worker, que es el único que sigue despierto cuando el pato no está a la
    // vista. Ver `leerHistorial` en almacen.js.
    historial: {
      cargar: leerHistorial,
      anotar: (m) => canal.anotarEnHistorial(m),
      marcarLeido: (ts) => canal.marcarHistorialLeido(ts)
    },

    marcador,
    partidas
  };
}
