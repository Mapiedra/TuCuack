// Menú contextual (clic derecho) como HTML propio, para convivir con el overlay.

import { montar, objetivoReal } from '../stage.js';

let openMenu = null;

/**
 * @param {number} x @param {number} y
 * @param {Array<{label?:string, onClick?:Function, sep?:boolean,
 *                disabled?:boolean, ancho?:boolean}>} items
 *   `ancho`: la opción ocupa la fila entera cuando el menú va en dos columnas.
 * @param {{onClose?:Function, cabecera?:HTMLElement, columnas?:number}} [opts]
 *   `cabecera`: elemento que se pone arriba del todo, antes de las opciones
 *   (el pato lo usa para enseñar su estado y cuidarlo sin abrir nada más).
 *   `columnas`: 2 reparte las opciones en dos columnas; con una cabecera ancha
 *   se aprovecha el sitio y el menú queda mucho menos alto.
 */
export function showContextMenu(x, y, items, opts = {}) {
  closeContextMenu();

  const menu = document.createElement('div');
  menu.className = 'ctx-menu hot';
  if (opts.cabecera) menu.classList.add('con-cabecera');
  if (opts.columnas === 2) menu.classList.add('dos-columnas');

  if (opts.cabecera) menu.appendChild(opts.cabecera);

  // Las opciones van en su propio contenedor: es lo que se reparte en columnas,
  // sin arrastrar a la cabecera.
  const lista = document.createElement('div');
  lista.className = 'ctx-opciones';
  menu.appendChild(lista);

  for (const item of items) {
    if (item.sep) {
      const sep = document.createElement('div');
      sep.className = 'sep';
      lista.appendChild(sep);
      continue;
    }
    const btn = document.createElement('button');
    btn.textContent = item.label;
    if (item.ancho) btn.className = 'ancho';
    // Deshabilitada: se sigue viendo, para que se note que la opción existe
    // aunque ahora mismo no se pueda (p. ej. con el pato agotado).
    if (item.disabled) btn.disabled = true;
    btn.addEventListener('click', () => {
      closeContextMenu();
      if (item.onClick) item.onClick();
    });
    lista.appendChild(btn);
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
