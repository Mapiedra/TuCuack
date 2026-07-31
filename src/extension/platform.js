// Plataforma del pato cuando vive en el panel lateral de Chrome.
//
// El panel es un documento propio de la extensión: no hay CSP ajena que
// esquivar, ni contenido de nadie a quien cederle los clics. Lo que comparte con
// la versión de página —almacenamiento y chat— está en `almacen.js`.

import { conectarChat, leerAjustes, escribirAjustes, leerEstado, escribirEstado, alCerrarDocumento }
  from './almacen.js';

/** @returns {import('./core/platform.js').Plataforma} */
export function crearPlataformaExtension() {
  const manifest = chrome.runtime.getManifest();

  return {
    nombre: 'panel',

    // El panel es un documento propio: no hay nada debajo a lo que cederle los
    // clics, ni monitores que cruzar, ni proceso del que salir.
    capacidades: {
      capturaRaton: false,
      multiMonitor: false,
      salir: false,
      autoArranque: false,
      actualizaciones: false,
      comandosExternos: true
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
    // Guardado final: cerrar el panel destruye el documento sin más aviso.
    alCerrar: alCerrarDocumento,

    alRecibirComando: (cb) => {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg && msg.tipo === 'comando') cb(msg.comando);
      });
    },

    chat: conectarChat()
  };
}
