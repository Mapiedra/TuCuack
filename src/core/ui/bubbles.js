// Burbujas sobre el pato: lo que le pasa a él, y lo que te espera a ti.
//
// Son dos cosas distintas y van juntas porque el sitio es el mismo —encima de
// la cabeza— y porque `.status-bubbles` ya es un `flex` con separación: caben
// las dos, una al lado de otra, sin pelearse.
//
//   * El ÁNIMO cambia solo y se va solo: si le das de comer, el 🍖 desaparece.
//   * Lo PENDIENTE se queda hasta que lo mires. Es su razón de ser: el chat pone
//     un bocadillo que dura unos segundos y un pato de visita entra y se va, así
//     que si no estabas delante no te enteras de nada. La marca sí espera.
//
// Cada icono de ánimo es el MISMO que el de su necesidad en el panel de
// estadísticas (ver ui/tooltip.js y ui/panels.js), para que al verlo sobre el
// pato se sepa de un vistazo qué le pasa y qué barra hay que subir.

const MOOD_EMOJI = {
  hambriento: '🍖',   // = Comida
  cansado: '💤',      // = Energía (dormido comunica mejor que el rayo)
  agotado: '😴',      // = Energía a cero: se ha desplomado y no atiende a nada
  sucio: '🧼',        // = Higiene
  aburrido: '⚽',     // = Ánimo: quiere jugar
  triste: '💔',       // = Ánimo por los suelos (antes una gota, que se leía
                      //   como suciedad)
  contento: ''
};

/**
 * La marca de lo pendiente.
 *
 * Un sobre, y **uno solo** aunque lo que espere venga de tres sitios distintos
 * —chat, privados, visitas—. Un emoji por tipo sería más informativo y se leería
 * peor: el pato mide noventa píxeles y no es un centro de notificaciones. El
 * desglose está a un clic, en la entrada del menú.
 */
const PENDIENTE_EMOJI = '✉️';

let animoAhora = null;
let pendientesAhora = 0;
let capa = null;

/**
 * @param {HTMLElement} container
 * @param {string} mood
 * @param {number} [pendientes] cuántas cosas hay sin ver
 */
export function updateBubbles(container, mood, pendientes) {
  const n = Math.max(0, Math.floor(Number(pendientes) || 0));
  if (mood === animoAhora && n === pendientesAhora && capa === container) return;
  animoAhora = mood;
  pendientesAhora = n;
  capa = container;

  container.textContent = '';
  const emo = MOOD_EMOJI[mood] || '';
  if (emo) container.appendChild(icono(emo, 'emo'));
  // El sobre a la derecha del ánimo, y siempre en el mismo sitio: si cambiara
  // de lado según hubiera o no ánimo, se leería como algo distinto cada vez.
  if (n > 0) container.appendChild(icono(PENDIENTE_EMOJI, 'emo pendiente'));
}

function icono(texto, clase) {
  const span = document.createElement('span');
  span.className = clase;
  span.textContent = texto;
  return span;
}
