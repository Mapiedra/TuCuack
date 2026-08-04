// Panel de conectados: qué patos hay ahora mismo en el canal común del chat.
//
// La lista sale de la presencia del canal, que ya se mantenía para comprobar
// que un nombre no estuviera en uso; aquí simplemente se enseña. Como los patos
// entran y salen por su cuenta, el panel se repinta con `actualizar` mientras
// está abierto en vez de mostrar una foto fija.

import { panelHeader } from './panelHeader.js';

/**
 * @typedef {{yo:string, otros:string[], conectado:boolean}} EstadoPresencia
 */

/**
 * @param {EstadoPresencia} inicial
 * @param {{onBack?:Function, onClose:Function}} handlers
 * @returns {{el:HTMLElement, actualizar:(estado:EstadoPresencia)=>void}}
 */
export function buildOnlinePanel(inicial, handlers) {
  const el = document.createElement('div');
  el.className = 'panel hot';

  const cab = panelHeader('Conectados', handlers);
  el.appendChild(cab);
  const titulo = cab.querySelector('.panel-title');

  const lista = document.createElement('ul');
  lista.className = 'lista-conectados';
  el.appendChild(lista);

  const nota = document.createElement('div');
  nota.className = 'muted';
  el.appendChild(nota);

  // Se pinta también antes de estar en el documento (el panel se mide y se
  // coloca ya montado, pero con contenido). Quien lo abre deja de llamarlo en
  // cuanto se cierra, así que no hace falta comprobar si sigue vivo.
  const actualizar = (estado) => {
    const otros = Array.isArray(estado.otros) ? estado.otros : [];
    lista.textContent = '';

    if (!estado.conectado) {
      // Sin canal no se sabe quién anda por ahí, y los demás tampoco nos ven.
      titulo.textContent = 'Conectados';
      nota.textContent = 'El chat no está conectado. En cuanto vuelva, la lista '
        + 'se rellena sola.';
      return;
    }

    titulo.textContent = `Conectados · ${otros.length + 1}`;
    lista.appendChild(fila(estado.yo, true));
    for (const nombre of ordenar(otros)) lista.appendChild(fila(nombre, false));
    nota.textContent = otros.length
      ? ''
      : 'Ahora mismo no hay ningún otro pato conectado.';
  };
  actualizar(inicial);

  return { el, actualizar };
}

/** Alfabético, ignorando mayúsculas y acentos. */
function ordenar(nombres) {
  return [...nombres].sort((a, b) => String(a).localeCompare(String(b), 'es', { sensitivity: 'base' }));
}

function fila(nombre, esYo) {
  const li = document.createElement('li');
  if (esYo) li.className = 'yo';

  const punto = document.createElement('span');
  punto.className = 'punto';

  const txt = document.createElement('span');
  txt.className = 'nombre';
  // Nombre puesto por otra persona: siempre como texto, nunca como HTML.
  txt.textContent = String(nombre || 'Pato');
  txt.title = txt.textContent;      // por si no cabe y se recorta

  li.append(punto, txt);

  if (esYo) {
    const etiqueta = document.createElement('span');
    etiqueta.className = 'etiqueta-yo';
    etiqueta.textContent = 'tú';
    li.appendChild(etiqueta);
  }
  return li;
}
