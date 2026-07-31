// Menú contextual (clic derecho) como HTML propio, para convivir con el overlay.

import { montar, objetivoReal } from '../stage.js';

let openMenu = null;

/**
 * @param {number} x @param {number} y
 * @param {Array<{label?:string, onClick?:Function, sep?:boolean}>} items
 * @param {{onClose?:Function}} [opts]
 */
export function showContextMenu(x, y, items, opts = {}) {
  closeContextMenu();

  const menu = document.createElement('div');
  menu.className = 'ctx-menu hot';

  for (const item of items) {
    if (item.sep) {
      const sep = document.createElement('div');
      sep.className = 'sep';
      menu.appendChild(sep);
      continue;
    }
    const btn = document.createElement('button');
    btn.textContent = item.label;
    btn.addEventListener('click', () => {
      closeContextMenu();
      if (item.onClick) item.onClick();
    });
    menu.appendChild(btn);
  }

  montar(menu);

  // El menú se abre POR ENCIMA del punto indicado (con `gap` de margen) para no
  // taparle la cara al pato. Si no cabe arriba, cae por debajo.
  const gap = opts.gap != null ? opts.gap : 12;
  const rect = menu.getBoundingClientRect();
  let py = y - rect.height - gap;
  if (py < 4) py = Math.min(y + gap, window.innerHeight - rect.height - 4);
  // Con `center`, `x` es el centro deseado (el del pato) y no el borde izquierdo.
  const left = opts.center ? x - rect.width / 2 : x;
  const px = Math.min(left, window.innerWidth - rect.width - 4);
  menu.style.left = `${Math.max(4, px)}px`;
  menu.style.top = `${Math.max(4, py)}px`;

  const onDocDown = (e) => {
    if (!menu.contains(objetivoReal(e))) closeContextMenu();
  };
  setTimeout(() => document.addEventListener('mousedown', onDocDown), 0);

  openMenu = { menu, onDocDown, onClose: opts.onClose };
  return closeContextMenu;
}

export function closeContextMenu() {
  if (!openMenu) return;
  document.removeEventListener('mousedown', openMenu.onDocDown);
  openMenu.menu.remove();
  const cb = openMenu.onClose;
  openMenu = null;
  if (cb) cb();
}
