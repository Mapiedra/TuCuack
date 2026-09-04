// Plataforma del pato cuando vive sobre una página web.
//
// Se parece a la del panel (`platform.js`): mismo almacenamiento y mismo puente
// de chat con el service worker. Cambian tres cosas, y las tres son por estar de
// prestado en el documento de otro:
//
//   - hay que ceder el ratón a la página cuando el pato no está debajo del cursor;
//   - el sheet de sprites no puede cargarse como imagen del documento, porque el
//     `img-src` del sitio lo bloquearía;
//   - el suelo es el borde inferior de la ventana.

import { conectarChat, marcador, leerAjustes, escribirAjustes, leerEstado, escribirEstado,
  alCerrarDocumento, ocultarElPato } from './almacen.js';

/**
 * @param {HTMLElement} anfitrion el div que aloja el Shadow DOM
 * @returns {import('./core/platform.js').Plataforma}
 */
export function crearPlataformaPagina(anfitrion) {
  const manifest = chrome.runtime.getManifest();

  return {
    nombre: 'pagina',

    capacidades: {
      // Sí: el pato está sobre el contenido de otro y tiene que dejarle los
      // clics cuando no le tocan a él.
      capturaRaton: true,
      multiMonitor: false,
      salir: false,
      ocultar: true,      // vuelve con el menú del icono de la extensión
      autoArranque: false,
      actualizaciones: false,
      comandosExternos: true,
      // Aquí no: el pato está de prestado sobre la web de otro, y tomarle la
      // pantalla entera al usuario mientras lee sería un secuestro.
      juegosDeEscenario: false,
      // Esto sí: el marcador lo pide el worker, que es quien tiene las
      // credenciales y quien sobrevive a que el pato se mude de pestaña. Desde
      // aquí sólo se le pregunta.
      marcadorGlobal: true
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
        isDev: !('update_url' in manifest),
        // El pato camina por el borde inferior de la ventana.
        ground: 0,
        sprites
      };
    },

    cargarEstado: leerEstado,
    guardarEstado: escribirEstado,
    cargarAjustes: leerAjustes,
    guardarAjustes: escribirAjustes,

    urlAsset: (rel) => chrome.runtime.getURL(`assets/${rel}`),

    // Se baja con fetch, que se rige por el CSP de la extensión y no por el de la
    // página, y se convierte en algo que el canvas puede pintar sin que el
    // documento tenga que cargar ninguna imagen.
    cargarSheet: async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`no se pudo cargar ${url}`);
      return createImageBitmap(await res.blob());
    },

    // Mientras el pato no esté bajo el cursor, la página se maneja como si él no
    // estuviera.
    capturarRaton: (capturar) => {
      anfitrion.style.pointerEvents = capturar ? 'auto' : 'none';
    },

    abrirExterno: (url) => chrome.runtime.sendMessage({ tipo: 'abrir', url }),
    ocultar: () => ocultarElPato(),
    alCerrar: alCerrarDocumento,

    // Órdenes que llegan del service worker (por ahora, esconderse).
    alRecibirComando: (cb) => {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg && msg.tipo === 'comando') cb(msg.comando);
      });
    },

    chat: conectarChat(),
    marcador
  };
}
