// Menú contextual (clic derecho) como HTML propio, para convivir con el overlay.

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

  document.body.appendChild(menu);

  // Colocar dentro de los límites de la ventana.
  const rect = menu.getBoundingClientRect();
  const px = Math.min(x, window.innerWidth - rect.width - 4);
  const py = Math.min(y, window.innerHeight - rect.height - 4);
  menu.style.left = `${Math.max(4, px)}px`;
  menu.style.top = `${Math.max(4, py)}px`;

  const onDocDown = (e) => {
    if (!menu.contains(e.target)) closeContextMenu();
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
