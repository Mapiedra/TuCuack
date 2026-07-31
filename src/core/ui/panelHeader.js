// Cabecera común de los paneles: título, volver al menú y cerrar.
//
// Los paneles se abren desde el menú del pato, así que sin un "atrás" hay que
// volver a hacer clic derecho cada vez que se quiere pasar de uno a otro.

/**
 * @param {string} titulo
 * @param {{onBack?:Function, onClose:Function}} handlers
 */
export function panelHeader(titulo, handlers) {
  const h = document.createElement('h3');
  h.className = 'panel-head';

  if (handlers.onBack) {
    const back = document.createElement('button');
    back.className = 'panel-back';
    back.type = 'button';
    back.textContent = '‹';
    back.title = 'Volver al menú';
    back.addEventListener('click', () => handlers.onBack());
    h.appendChild(back);
  }

  const t = document.createElement('span');
  t.className = 'panel-title';
  t.textContent = titulo;
  h.appendChild(t);

  const close = document.createElement('button');
  close.className = 'panel-close';
  close.type = 'button';
  close.textContent = '×';
  close.title = 'Cerrar';
  close.addEventListener('click', () => handlers.onClose());
  h.appendChild(close);

  return h;
}
