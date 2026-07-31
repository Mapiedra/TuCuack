// Arranque del pato dentro del panel lateral de Chrome.
//
// El panel no monta el pato por su cuenta: hay un solo pato y quien decide dónde
// vive es el árbitro del service worker (ver sw.js). Aquí se le anuncia que este
// panel existe y se espera su orden. Si el pato está en otra ventana, el panel se
// queda con un aviso en lugar del pato.

import { arrancarPato } from './core/app.js';
import { crearPlataformaExtension } from './platform.js';
import { vigilarEscala } from './escala.js';

let pato = null;
let arrancando = false;
let escalaVigilada = false;

async function montar() {
  if (pato || arrancando) return;
  arrancando = true;
  try {
    // El escenario tiene que estar VISIBLE antes de montar al pato: lo primero
    // que hace es medirse, y con el escenario oculto se mediría a cero.
    mostrarAviso(false);

    // El tamaño depende del hueco del panel, y hay que fijarlo antes de montarlo
    // por el mismo motivo. Se vigila una sola vez, aunque el pato entre y salga.
    if (!escalaVigilada) {
      vigilarEscala();
      escalaVigilada = true;
    }

    pato = await arrancarPato(crearPlataformaExtension());
  } catch (err) {
    console.error('[pato] error al arrancar', err);
    mostrarAviso(true);
  } finally {
    arrancando = false;
  }
}

function desmontar() {
  if (pato) {
    pato.apagar();
    pato = null;
  }
  mostrarAviso(true);
}

function mostrarAviso(visible) {
  const aviso = document.getElementById('aviso');
  const escenario = document.getElementById('stage');
  if (aviso) aviso.hidden = !visible;
  if (escenario) escenario.hidden = visible;
}

// Mientras no llegue orden del árbitro, el panel está en blanco a propósito: no
// se enseña "tu pato está en otra ventana" antes de saber si es verdad. Pero si
// no contesta nadie —service worker caído, por ejemplo— más vale un mensaje que
// un panel vacío sin explicación.
let respaldo = setTimeout(() => {
  if (!pato && !arrancando) mostrarAviso(true);
}, 3000);

function llegoRespuesta() {
  clearTimeout(respaldo);
  respaldo = null;
}

async function anunciarse() {
  let ventana = null;
  try {
    ventana = (await chrome.windows.getCurrent()).id;
  } catch (err) {
    console.warn('[pato] no se pudo saber en qué ventana está el panel:', err);
  }

  const puerto = chrome.runtime.connect({ name: 'panel' });
  puerto.onMessage.addListener((msg) => {
    if (!msg) return;
    llegoRespuesta();
    if (msg.tipo === 'montar') montar();
    else if (msg.tipo === 'desmontar') desmontar();
  });
  puerto.onDisconnect.addListener(() => {
    // Si Chrome duerme al service worker, el puerto se cae; se vuelve a abrir y
    // eso lo despierta, que además es la señal de que este panel sigue vivo.
    setTimeout(anunciarse, 1000);
  });
  puerto.postMessage({ tipo: 'hola', windowId: ventana });
}

anunciarse();
