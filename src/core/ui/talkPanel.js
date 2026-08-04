// Panel de Hablar: el histórico de la sesión y la caja para escribir.
//
// Antes era una barrita suelta con un cuadro de texto. Se ha hecho panel como
// los demás por dos motivos: para tener el "volver" al menú que tienen todos, y
// porque los mensajes recibidos duraban lo que dura un bocadillo y no había
// forma de releerlos.
//
// El histórico no lo guarda este panel: vive en chat/historial.js, que sigue
// apuntando mensajes aunque el panel esté cerrado (que es cuando más falta
// hace).

import { panelHeader } from './panelHeader.js';
import { objetivoReal } from '../stage.js';
import * as historial from '../chat/historial.js';

/**
 * @param {{onSend:(text:string)=>boolean, onClose:Function, onBack?:Function}} handlers
 *   `onSend` devuelve si el mensaje ha salido de verdad.
 * @returns {{el:HTMLElement}}
 */
export function buildTalkPanel(handlers) {
  const el = document.createElement('div');
  el.className = 'panel panel-hablar hot';

  el.appendChild(panelHeader('Hablar', handlers));

  const lista = document.createElement('div');
  lista.className = 'chat-historial';
  el.appendChild(lista);

  const fila = document.createElement('div');
  fila.className = 'chat-escribir';
  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 280;
  input.placeholder = 'Escribe algo…';
  const enviar = document.createElement('button');
  enviar.className = 'btn';
  enviar.type = 'button';
  enviar.textContent = 'Enviar';
  fila.append(input, enviar);
  el.appendChild(fila);

  const aviso = document.createElement('div');
  aviso.className = 'muted';
  el.appendChild(aviso);

  const pintar = () => {
    const mensajes = historial.todos();
    lista.textContent = '';
    if (!mensajes.length) {
      const vacio = document.createElement('div');
      vacio.className = 'muted chat-vacio';
      vacio.textContent = 'Aquí aparecerán los mensajes de esta sesión.';
      lista.appendChild(vacio);
      return;
    }
    for (const m of mensajes) lista.appendChild(linea(m));
    // Lo último dicho es lo que interesa ver.
    lista.scrollTop = lista.scrollHeight;
  };
  pintar();

  const dejarDeEscuchar = historial.alCambiar(pintar);

  const enviarTexto = () => {
    const texto = input.value.trim();
    if (!texto) return;
    const salio = handlers.onSend(texto);
    input.value = '';
    // A diferencia de la caja de antes, el panel NO se cierra al enviar: con el
    // histórico delante lo natural es seguir la conversación.
    input.focus();
    aviso.textContent = salio === false
      ? 'El chat no está conectado: ese mensaje no ha salido de aquí.'
      : '';
    aviso.classList.toggle('error', salio === false);
  };

  enviar.addEventListener('click', enviarTexto);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') enviarTexto();
  });

  // Escape en todo el documento, no sólo dentro de la caja: el foco puede
  // haberse ido a cualquier parte. Y un clic fuera cierra, como en el menú.
  // Quedarse encerrado en un cuadro de texto es de las cosas más molestas que
  // puede hacer un pato.
  const alPulsarTecla = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handlers.onClose();
    }
  };
  const alPulsarFuera = (e) => {
    if (!el.contains(objetivoReal(e))) handlers.onClose();
  };
  document.addEventListener('keydown', alPulsarTecla, true);
  // En diferido: el mismo clic que lo abre no debe cerrarlo.
  const pendiente = setTimeout(() => {
    document.addEventListener('mousedown', alPulsarFuera, true);
  }, 0);

  // Se limpia solo, se cierre como se cierre: por la ×, por el volver, por
  // Escape o por un clic fuera.
  el.addEventListener('panel:cerrado', () => {
    clearTimeout(pendiente);
    document.removeEventListener('keydown', alPulsarTecla, true);
    document.removeEventListener('mousedown', alPulsarFuera, true);
    dejarDeEscuchar();
  }, { once: true });

  setTimeout(() => input.focus(), 0);
  return { el };
}

/** @param {import('../chat/historial.js').Mensaje} m */
function linea(m) {
  const fila = document.createElement('div');
  fila.className = 'chat-msg' + (m.propio ? ' propio' : '');

  const cab = document.createElement('div');
  cab.className = 'chat-msg-cab';
  const quien = document.createElement('span');
  quien.className = 'chat-quien';
  // Nombre y texto los pone otra persona: siempre como texto, nunca como HTML.
  quien.textContent = m.propio ? 'Tú' : m.from;
  const hora = document.createElement('span');
  hora.className = 'chat-hora';
  hora.textContent = new Date(m.ts).toLocaleTimeString('es-ES', {
    hour: '2-digit', minute: '2-digit'
  });
  cab.append(quien, hora);

  const texto = document.createElement('div');
  texto.className = 'chat-texto';
  texto.textContent = m.text;

  fila.append(cab, texto);

  if (m.fallo) {
    const nota = document.createElement('div');
    nota.className = 'chat-fallo';
    nota.textContent = 'no enviado';
    fila.appendChild(nota);
  }
  return fila;
}
