// "¿Volvemos a concentrarnos?": el descanso se ha acabado, pero el siguiente
// tramo de trabajo no arranca solo — hay que confirmarlo. Sin cuenta atrás:
// a diferencia de un reto, aquí no caduca nada, se espera lo que haga falta.

import { panelHeader } from './panelHeader.js';

/**
 * @param {{onConfirmar:Function, onRechazar:Function, onClose:Function}} handlers
 * @returns {{el:HTMLElement}}
 */
export function buildFocusPromptPanel(handlers) {
  const el = document.createElement('div');
  el.className = 'panel panel-reto hot';
  el.appendChild(panelHeader('Descanso terminado', { onClose: handlers.onClose }));

  const que = document.createElement('p');
  que.textContent = '¿Volvemos a concentrarnos?';
  el.appendChild(que);

  const fila = document.createElement('div');
  fila.className = 'btn-row';

  const si = document.createElement('button');
  si.className = 'btn';
  si.type = 'button';
  si.textContent = '🍅 Sí, vamos';
  si.addEventListener('click', () => handlers.onConfirmar());

  const no = document.createElement('button');
  no.className = 'btn';
  no.type = 'button';
  no.textContent = 'Ahora no';
  no.addEventListener('click', () => handlers.onRechazar());

  fila.append(si, no);
  el.appendChild(fila);

  return { el };
}
