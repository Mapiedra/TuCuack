// Globo con las necesidades del pato, que aparece al dejar el ratón encima.
// Es sólo informativo: no captura el ratón ni interrumpe el arrastre.
//
// El contenido no se arma aquí: es la vista compartida de ui/statsView.js, la
// misma que enseña el menú del pato en su cabecera.

import { montar } from '../stage.js';
import { buildStatsView } from './statsView.js';

let actual = null;

/**
 * @param {import('../game/Tamagotchi.js').Tamagotchi} tam
 * @param {string} nombre
 * @param {{x:number,y:number}} anchor  punto sobre la cabeza del pato
 */
export function showStatsTooltip(tam, nombre, anchor, level) {
  hideStatsTooltip();

  const el = document.createElement('div');
  el.className = 'tooltip';
  // Sin `onAction`: el globo es informativo y no captura el ratón, así que no
  // lleva botonera (ver ui/statsView.js).
  const vista = buildStatsView(tam, nombre, level);
  el.appendChild(vista.el);

  montar(el);

  // Centrado sobre el pato y por encima de su cabeza.
  //
  // Se mide con offsetWidth/offsetHeight y no con getBoundingClientRect: el
  // globo entra con una animación que arranca en scale(0), y el rect devuelve
  // el tamaño ya transformado, es decir 0x0 mientras dura la animación.
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const x = Math.min(Math.max(8, anchor.x - w / 2), window.innerWidth - w - 8);
  let y = anchor.y - h - 8;
  if (y < 8) y = anchor.y + 8;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;

  actual = { el, vista };
  return el;
}

export function hideStatsTooltip() {
  if (actual) {
    actual.vista.destroy();   // deja de escuchar al Tamagotchi
    actual.el.remove();
    actual = null;
  }
}

export function isTooltipVisible() {
  return Boolean(actual);
}
