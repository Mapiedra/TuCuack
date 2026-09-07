// Lo que comparten las dos casas del pato en Chrome: el panel lateral y las
// páginas web. Almacenamiento y puente de chat con el service worker.

const CLAVE_ESTADO = 'estado';
const CLAVE_AJUSTES = 'ajustes';
const CLAVE_HISTORIAL = 'historial';

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

/**
 * Esconde el pato: lo mismo que "Ocultar la mascota" en el menú del icono.
 *
 * Lo comparten el panel y las páginas porque es la misma orden y tiene que
 * hacer lo mismo en los dos sitios.
 *
 * Si no se puede, se dice. Un "Ocultar" que no hace nada y encima calla es
 * indistinguible de un botón roto, que es justo lo que parecía.
 */
export function ocultarElPato() {
  if (!contextoVivo()) {
    // Pasa después de recargar la extensión: el pato que quedó en la pestaña
    // sigue pintándose, pero su `chrome.*` ya no lleva a ninguna parte.
    console.warn('[pato] no se puede ocultar: esta copia quedó huérfana al '
      + 'recargar la extensión. Recarga la pestaña.');
    return;
  }
  try {
    const envio = chrome.runtime.sendMessage({ tipo: 'ocultar' });
    // En MV3 devuelve una promesa; en un content script viejo puede no hacerlo.
    if (envio && typeof envio.then === 'function') {
      envio.catch((err) => console.warn('[pato] no se pudo ocultar:', err && err.message));
    }
  } catch (err) {
    console.warn('[pato] no se pudo ocultar:', err && err.message);
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
 * El histórico del chat, leído directamente del almacenamiento.
 *
 * Se lee aquí y no se pide por el puerto porque son miles de mensajes y el pato
 * estrena documento cada vez que cambias de pestaña: mandarlos por el puente
 * sería mover cientos de kilobytes cada pocos segundos.
 *
 * Sólo se LEE. Quien escribe es el service worker, que es el único que sigue
 * despierto cuando no hay ninguna pestaña a la vista (ver sw.js); desde aquí se
 * le pide por el puerto que apunte lo que él no puede saber.
 */
export async function leerHistorial() {
  const d = await leer(CLAVE_HISTORIAL);
  return {
    mensajes: Array.isArray(d.mensajes) ? d.mensajes : [],
    leidoHasta: Number(d.leidoHasta) || 0
  };
}

/**
 * El marcador global, preguntándoselo al worker.
 *
 * Va por ahí y no directamente porque las credenciales y —sobre todo— la firma
 * con la que se escriben los récords viven allí. Desde aquí no se ve el secreto,
 * que es justo el punto: este código corre dentro de la página web de
 * cualquiera.
 *
 * Devuelven `{ok, datos?, error?}` y no lanzan, como el gemelo del escritorio.
 */
/**
 * El historial de partidas por red, preguntándoselo al worker.
 *
 * Por ahí y no directamente por lo mismo que el marcador: la firma vive allí, y
 * este código corre dentro de la página web de cualquiera. Aquí LEER también la
 * exige, así que `mias` no lleva identidad ninguna — el worker ya sabe de quién.
 */
export const partidas = {
  guardar: (partida) => preguntarAlWorker({ tipo: 'partidas-guardar', partida }),
  mias: () => preguntarAlWorker({ tipo: 'partidas-mias' })
};

export const marcador = {
  mejores: (juego, mejorEs) => preguntarAlWorker({ tipo: 'marcador-mejores', juego, mejorEs }),
  todos: () => preguntarAlWorker({ tipo: 'marcador-todos' }),
  guardar: (record) => preguntarAlWorker({ tipo: 'marcador-guardar', record })
};

async function preguntarAlWorker(msg) {
  try {
    const r = await chrome.runtime.sendMessage(msg);
    return r || { ok: false, error: 'sin-respuesta' };
  } catch (err) {
    // El worker duerme y a veces no despierta a tiempo. No es un fallo del
    // que haya que enterarse a gritos: es un marcador.
    return { ok: false, error: String((err && err.message) || err) };
  }
}

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
    enviarVisita: (visita) => enviarAlWorker({ tipo: 'visita', visita }),
    enviarJuego: (mensaje, porSala) => enviarAlWorker({ tipo: 'juego', mensaje, porSala: !!porSala }),
    // El canal privado de una partida. Lo abre el worker, que es quien tiene la
    // conexión y lo único que sobrevive a que el pato se mude de pestaña.
    entrarEnSala: (sala) => enviarAlWorker({ tipo: 'sala-entrar', sala }),
    salirDeSala: () => enviarAlWorker({ tipo: 'sala-salir' }),
    puedeSala: () => true,
    olvidarPartida: () => enviarAlWorker({ tipo: 'olvidar-partida' }),
    ponerNombre: (nombre) => enviarAlWorker({ tipo: 'nombre', nombre }),
    // Histórico: apuntar y decir hasta dónde se ha leído. Va por el puerto
    // porque el fichero es del worker, no de este documento.
    anotarEnHistorial: (mensaje) => enviarAlWorker({ tipo: 'anotar-historial', mensaje }),
    marcarHistorialLeido: (ts) => enviarAlWorker({ tipo: 'historial-leido', ts }),
    alRecibirEvento: (cb) => { alRecibir = cb; },
    estado: async () => {
      try {
        return await chrome.runtime.sendMessage({ tipo: 'estado' });
      } catch {
        return {
          connected: false, names: [], presentes: [], clave: '', id: '',
          partida: null, reason: 'worker-dormido'
        };
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
