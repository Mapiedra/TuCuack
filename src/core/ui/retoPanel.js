// "Fulano te reta a una partida": aceptar o no, con cuenta atrás.
//
// El reto llega cuando llega, y el pato puede estar en mitad de otra cosa. Por
// eso este panel sólo se monta si el pato está libre; si no, el reto espera en
// el menú. Interrumpir a alguien con una ventana encima de lo que está haciendo
// no es avisar, es secuestrar.

import { panelHeader } from './panelHeader.js';
import { RETO_MS } from '../game/protocolo.js';

/**
 * @param {{sala:string, juego:string, rival:{nombre:string}, caduca:number}} reto
 * @param {string} nombreDelJuego
 * @param {{onAceptar:Function, onRechazar:Function, onClose:Function}} handlers
 * @returns {{el:HTMLElement, destroy:Function}}
 */
export function buildRetoPanel(reto, nombreDelJuego, handlers) {
  const el = document.createElement('div');
  el.className = 'panel panel-reto hot';
  el.appendChild(panelHeader('Te retan', { onClose: handlers.onClose }));

  const quien = document.createElement('p');
  quien.className = 'reto-quien';
  // textContent: el nombre lo escribe otra persona.
  quien.textContent = reto.rival.nombre;
  el.appendChild(quien);

  const que = document.createElement('p');
  que.textContent = `Quiere jugar a ${nombreDelJuego}.`;
  el.appendChild(que);

  const cuenta = document.createElement('p');
  cuenta.className = 'muted';
  el.appendChild(cuenta);

  const fila = document.createElement('div');
  fila.className = 'btn-row';

  const si = document.createElement('button');
  si.className = 'btn';
  si.type = 'button';
  si.textContent = '⚔ Jugar';
  si.addEventListener('click', () => handlers.onAceptar());

  const no = document.createElement('button');
  no.className = 'btn';
  no.type = 'button';
  no.textContent = 'Ahora no';
  no.addEventListener('click', () => handlers.onRechazar());

  fila.append(si, no);
  el.appendChild(fila);

  // La cuenta atrás no es decoración: un reto caduca solo, y sin verla el panel
  // se cerraría de repente sin que se entienda por qué.
  const tic = setInterval(pintarCuenta, 500);
  pintarCuenta();

  el.addEventListener('panel:cerrado', () => clearInterval(tic), { once: true });

  return { el, destroy: () => clearInterval(tic) };

  function pintarCuenta() {
    const quedan = Math.max(0, Math.round((reto.caduca - Date.now()) / 1000));
    cuenta.textContent = quedan > 0
      ? `Caduca en ${quedan} s`
      : 'Caducado';
    if (quedan <= 0) clearInterval(tic);
  }
}

export { RETO_MS };
