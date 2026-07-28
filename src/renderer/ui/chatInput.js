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

  const rect = el.getBoundingClientRect();
  const px = Math.min(x, window.innerWidth - rect.width - 4);
  const py = Math.min(y, window.innerHeight - rect.height - 4);
  el.style.left = `${Math.max(4, px)}px`;
  el.style.top = `${Math.max(4, py)}px`;

  setTimeout(() => input.focus(), 0);
  return { el };
}
