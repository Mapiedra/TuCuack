// Burbujas de emoción sobre el pato según el ánimo del Tamagotchi.

const MOOD_EMOJI = {
  hambriento: '🍞',
  cansado: '💤',
  sucio: '🧼',
  aburrido: '⚽',
  triste: '💧',
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
