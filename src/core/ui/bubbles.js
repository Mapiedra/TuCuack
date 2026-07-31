// Burbujas de emoción sobre el pato según el ánimo del Tamagotchi.
//
// Cada icono es el MISMO que el de su necesidad en el panel de estadísticas
// (ver ui/tooltip.js y ui/panels.js), para que al verlo sobre el pato se sepa
// de un vistazo qué le pasa y qué barra hay que subir.

const MOOD_EMOJI = {
  hambriento: '🍖',   // = Comida
  cansado: '💤',      // = Energía (dormido comunica mejor que el rayo)
  sucio: '🧼',        // = Higiene
  aburrido: '⚽',     // = Ánimo: quiere jugar
  triste: '💔',       // = Ánimo por los suelos (antes una gota, que se leía
                      //   como suciedad)
  contento: ''
};

let currentMood = null;

export function updateBubbles(container, mood) {
  if (mood === currentMood) return;
  currentMood = mood;
  const emo = MOOD_EMOJI[mood] || '';
  container.textContent = '';
  if (emo) {
    const span = document.createElement('span');
    span.className = 'emo';
    span.textContent = emo;
    container.appendChild(span);
  }
}
