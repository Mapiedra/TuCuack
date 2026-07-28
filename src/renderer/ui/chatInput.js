// Caja de texto para escribir un mensaje de chat (bocadillo).

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

  const submit = () => {
    const text = input.value.trim();
    if (text) handlers.onSend(text);
    handlers.onClose();
  };

  send.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
    else if (e.key === 'Escape') handlers.onClose();
  });

  el.append(input, send);
  document.body.appendChild(el);

  // Centrado sobre el pato y por encima, igual que el menú y los paneles: `x`
  // es el centro, no el borde izquierdo.
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const px = Math.min(x - w / 2, window.innerWidth - w - 4);
  let py = y - h - 10;
  if (py < 4) py = Math.min(y + 10, window.innerHeight - h - 4);
  el.style.left = `${Math.max(4, px)}px`;
  el.style.top = `${Math.max(4, py)}px`;

  setTimeout(() => input.focus(), 0);
  return { el };
}
