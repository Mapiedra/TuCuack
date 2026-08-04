// Lo que comparten las dos casas del pato en Chrome: el panel lateral y las
// páginas web. Almacenamiento y puente de chat con el service worker.

const CLAVE_ESTADO = 'estado';
const CLAVE_AJUSTES = 'ajustes';

/**
 * ¿Seguimos formando parte de la extensión?
 *
 * Cuando la extensión se recarga o se actualiza, los content scripts que quedaron
 * en las pestañas siguen ejecutándose, pero desconectados: su `chrome.*` ya no
 * sirve para nada. Perder `chrome.runtime.id` es cómo se nota.
 */
export function contextoVivo() {
  try {
    return !!(chrome.runtime && chrome.runtime.id);
  } catch {
    return false;
  }
}

async function leer(clave) {
  try {
    const guardado = await chrome.storage.local.get(clave);
    return guardado[clave] || {};
  } catch (err) {
    console.warn('[pato] no se pudo leer', clave, err);
    return {};
  }
}

function escribir(clave, datos) {
  // El try/catch envuelve la llamada, no sólo la promesa: con el contexto
  // invalidado, `chrome.storage.local.set` no devuelve una promesa rechazada,
  // sino que lanza en el acto, y un `.catch()` no lo atrapa. Eso era lo que
  // llenaba la consola de "Extension context invalidated" cada 15 segundos.
  try {
    const tarea = chrome.storage.local.set({ [clave]: datos });
    if (tarea && typeof tarea.catch === 'function') {
      tarea.catch((err) => console.warn('[pato] no se pudo guardar', clave, err));
    }
  } catch {
    // Sin contexto no hay dónde guardar. Quien nos aloje se dará cuenta y se
    // retirará; aquí no hace falta armar ruido.
  }
}

export const leerEstado = () => leer(CLAVE_ESTADO);
export const escribirEstado = (d) => escribir(CLAVE_ESTADO, d);
export const leerAjustes = () => leer(CLAVE_AJUSTES);
export const escribirAjustes = (d) => escribir(CLAVE_AJUSTES, d);

/**
 * Puente de chat con el service worker, que es quien mantiene la conexión.
 *
 * El puerto se abre al arrancar y se queda abierto: además de traer los
 * mensajes, mantiene despierto al service worker mientras el pato esté a la
 * vista, que en Manifest V3 no es poca cosa.
 */
export function conectarChat() {
  let puerto = null;
  let alRecibir = () => {};
  let cerrado = false;

  const abrir = () => {
    if (cerrado) return;
    try {
      puerto = chrome.runtime.connect({ name: 'chat' });
      puerto.onMessage.addListener((evt) => alRecibir(evt));
      puerto.onDisconnect.addListener(() => {
        puerto = null;
        // Si Chrome duerme al service worker, el puerto se cae. Se vuelve a
        // abrir, y eso lo despierta. Salvo que hayamos cerrado a propósito.
        if (!cerrado) setTimeout(abrir, 1000);
      });
    } catch (err) {
      console.warn('[chat] no se pudo conectar con el service worker:', err);
      puerto = null;
    }
  };
  abrir();

  const enviarAlWorker = (mensaje) => {
    if (!puerto) abrir();
    try {
      if (puerto) puerto.postMessage(mensaje);
    } catch (err) {
      console.warn('[chat] mensaje perdido:', err);
    }
  };

  return {
    enviar: (msg) => enviarAlWorker({ tipo: 'enviar', msg }),
    ponerNombre: (nombre) => enviarAlWorker({ tipo: 'nombre', nombre }),
    alRecibirEvento: (cb) => { alRecibir = cb; },
    estado: async () => {
      try {
        return await chrome.runtime.sendMessage({ tipo: 'estado' });
      } catch {
        return { connected: false, names: [], historial: [], reason: 'worker-dormido' };
      }
    },

    /**
     * Cierra el puente. Lo llama el pato al apagarse.
     *
     * Sin esto, cada vez que el pato vuelve a una pestaña por la que ya pasó se
     * abriría otro puerto sin cerrar el anterior, y acabaría enseñando cada
     * mensaje del chat tantas veces como puertos tuviera abiertos.
     */
    cerrar: () => {
      cerrado = true;
      alRecibir = () => {};
      if (puerto) {
        try { puerto.disconnect(); } catch { /* ya estaba caído */ }
        puerto = null;
      }
    }
  };
}

/**
 * Aviso de que el documento se va a ir, para el último guardado.
 *
 * Se registra un único listener por documento aunque el pato se monte y se
 * desmonte varias veces: sólo cambia a quién avisa.
 */
let avisarCierre = null;
let cierreRegistrado = false;

export function alCerrarDocumento(cb) {
  avisarCierre = cb;
  if (cierreRegistrado) return;
  cierreRegistrado = true;
  window.addEventListener('pagehide', () => {
    if (avisarCierre) avisarCierre();
  });
}
