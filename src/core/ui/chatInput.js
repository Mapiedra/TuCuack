// Caja de texto para escribir un mensaje de chat (bocadillo).

import { montar, objetivoReal } from '../stage.js';

/**
 * @param {number} x @param {number} y  posición (client coords)
 * @param {{onSend:(text:string)=>void, onClose:Function}} handlers
 * @returns {{el:HTMLElement}}
 */
export function openChatInput(x, y, handlers) {
  const el = document.createElement('div');
  el.className = 'chat-input hot';

  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 280;
  input.placeholder = 'Escribe algo…';

  const send = document.createElement('button');
  send.textContent = 'Enviar';

  // Sin esto sólo se podía cerrar con Escape teniendo el foco en la caja, o
  // enviando algo. Quedarse encerrado en un cuadro de texto es de las cosas más
  // molestas que puede hacer un pato.
  const cerrar = document.createElement('button');
  cerrar.className = 'chat-cerrar';
  cerrar.textContent = '✕';
  cerrar.title = 'Cerrar';
  cerrar.setAttribute('aria-label', 'Cerrar');

  let cerrado = false;
  const salir = () => {
    if (cerrado) return;
    cerrado = true;
    document.removeEventListener('keydown', alPulsarTecla, true);
    document.removeEventListener('mousedown', alPulsarFuera, true);
    handlers.onClose();
  };

  const submit = () => {
    const text = input.value.trim();
    if (text) handlers.onSend(text);
    salir();
  };

  // Escape en todo el documento, no sólo dentro de la caja: el foco puede
  // haberse ido a cualquier parte.
  const alPulsarTecla = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      salir();
    }
  };
  // Y un clic fuera también cierra, como en el menú del pato.
  const alPulsarFuera = (e) => {
    if (!el.contains(objetivoReal(e))) salir();
  };

  send.addEventListener('click', submit);
  cerrar.addEventListener('click', salir);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });

  el.append(input, send, cerrar);

  // Se mide oculto para que no se le vea aterrizar en la esquina antes de
  // colocarse, igual que hacen los paneles.
  el.style.visibility = 'hidden';
  montar(el);
  colocar(el, x, y);
  el.style.visibility = 'visible';

  document.addEventListener('keydown', alPulsarTecla, true);
  // En diferido: el mismo clic que lo abre no debe cerrarlo.
  setTimeout(() => {
    if (!cerrado) document.addEventListener('mousedown', alPulsarFuera, true);
  }, 0);

  setTimeout(() => input.focus(), 0);
  return { el };
}

/**
 * Encima del pato, y si no cabe, arriba del todo.
 *
 * Nunca por debajo del punto de anclaje: ahí está el pato, y taparle la cara con
 * la caja de texto es justo lo que no se quiere.
 */
function colocar(el, x, y) {
  const w = el.offsetWidth;
  const h = el.offsetHeight;

  const px = Math.min(x - w / 2, window.innerWidth - w - 4);
  el.style.left = `${Math.max(4, px)}px`;

  const py = y - h - 10;
  el.style.top = `${Math.max(4, py)}px`;
}
