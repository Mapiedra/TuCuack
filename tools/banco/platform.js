// Plataforma de banco de pruebas: el pato corriendo en un navegador normal,
// sin Electron y sin extensión.
//
// Sirve para desarrollar el núcleo sin arrancar la app entera, y es la
// referencia más parecida a lo que necesitará la extensión de Chrome: el mismo
// contrato, con almacenamiento local y sin nada del sistema operativo.

const CLAVE_ESTADO = 'tucuack:estado';
const CLAVE_AJUSTES = 'tucuack:ajustes';
const CLAVE_HISTORIAL = 'tucuack:historial';

function leer(clave, porDefecto) {
  try {
    return { ...porDefecto, ...JSON.parse(localStorage.getItem(clave) || '{}') };
  } catch {
    return { ...porDefecto };
  }
}

function escribir(clave, datos) {
  try {
    localStorage.setItem(clave, JSON.stringify(datos));
  } catch { /* modo incógnito o cuota llena: el pato sigue vivo, sin recordar */ }
}

/** @returns {import('../../src/core/platform.js').Plataforma} */
export function crearPlataformaBanco({ ground = 48 } = {}) {
  return {
    nombre: 'banco',

    // Un navegador no tiene bandeja, ni monitores que cruzar, ni proceso del que
    // salir. El pato ocupa el documento entero, así que tampoco hay que ceder el
    // ratón a nadie.
    capacidades: {
      capturaRaton: false,
      multiMonitor: false,
      salir: false,
      actualizaciones: false,
      comandosExternos: false,
      // El pato tiene la pestaña para él solo, y aquí es donde más cómodo sale
      // desarrollar un minijuego de escenario: recarga instantánea y DevTools.
      juegosDeEscenario: true
    },

    async config() {
      // Los metadatos de los sheets los genera tools/pack_sprites.py; en el
      // escritorio llegan por IPC y aquí se piden por HTTP.
      let sprites = {};
      try {
        const res = await fetch('../../assets/sprites/index.json');
        if (res.ok) sprites = await res.json();
      } catch (err) {
        console.warn('[banco] no se pudo leer el índice de sprites:', err.message);
      }
      return { version: 'banco', isDev: true, ground, sprites };
    },

    cargarEstado: async () => leer(CLAVE_ESTADO, {}),
    guardarEstado: (d) => escribir(CLAVE_ESTADO, d),
    cargarAjustes: async () => leer(CLAVE_AJUSTES, {}),
    guardarAjustes: (d) => escribir(CLAVE_AJUSTES, d),

    // El histórico del chat, en localStorage. Aquí no hay red y por tanto no
    // llega ningún mensaje, pero sí se puede llenar a mano desde la consola
    // (`__pato.historial.anadir(...)`) y comprobar que sobrevive a recargar,
    // que es justo lo que se quiere poder probar sin levantar Electron.
    historial: {
      cargar: async () => {
        const d = leer(CLAVE_HISTORIAL, {});
        return {
          mensajes: Array.isArray(d.mensajes) ? d.mensajes : [],
          leidoHasta: Number(d.leidoHasta) || 0
        };
      },
      anotar: (m) => {
        const d = leer(CLAVE_HISTORIAL, {});
        const mensajes = Array.isArray(d.mensajes) ? d.mensajes : [];
        mensajes.push(m);
        escribir(CLAVE_HISTORIAL, { ...d, mensajes: mensajes.slice(-2000) });
      },
      marcarLeido: (ts) => {
        const d = leer(CLAVE_HISTORIAL, {});
        escribir(CLAVE_HISTORIAL, { ...d, leidoHasta: ts });
      }
    },

    urlAsset: (rel) => `../../assets/${rel}`,

    abrirExterno: (url) => window.open(url, '_blank', 'noopener'),
    // Último guardado antes de cerrar la pestaña.
    alCerrar: (cb) => window.addEventListener('beforeunload', () => cb())

    // Sin `chat`: el banco no se conecta a Supabase. El núcleo lo rellena con
    // no-ops y el pato funciona igual, mudo.
  };
}
