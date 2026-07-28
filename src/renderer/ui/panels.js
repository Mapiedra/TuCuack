// Panel de estadísticas del Tamagotchi + acciones de cuidado.

const STAT_META = [
  { key: 'hunger', label: '🍖 Comida' },
  { key: 'energy', label: '⚡ Energía' },
  { key: 'hygiene', label: '🧼 Higiene' },
  { key: 'happiness', label: '❤️ Felicidad' }
];

/**
 * @param {import('../game/Tamagotchi.js').Tamagotchi} tam
 * @param {{onAction:(name:string)=>void, onClose:Function, name?:string}} handlers
 * @returns {{el:HTMLElement, destroy:Function}}
 */
export function buildStatsPanel(tam, handlers) {
  const el = document.createElement('div');
  el.className = 'panel hot';

  const h = document.createElement('h3');
  // Título = nombre del pato (el que se configura en Ajustes).
  h.textContent = handlers.name || 'Tu pato';
  const close = document.createElement('span');
  close.className = 'close';
  close.textContent = '×';
  close.addEventListener('click', () => handlers.onClose());
  h.appendChild(close);
  el.appendChild(h);

  const bars = {};
  for (const meta of STAT_META) {
    const stat = document.createElement('div');
    stat.className = 'stat';
    const lbl = document.createElement('div');
    lbl.className = 'lbl';
    const name = document.createElement('span');
    name.textContent = meta.label;
    const val = document.createElement('span');
    lbl.append(name, val);
    const bar = document.createElement('div');
    bar.className = 'bar';
    const fill = document.createElement('div');
    fill.className = 'fill';
    bar.appendChild(fill);
    stat.append(lbl, bar);
    el.appendChild(stat);
    bars[meta.key] = { stat, fill, val };
  }

  const moodLine = document.createElement('div');
  moodLine.className = 'muted';
  el.appendChild(moodLine);

  const btnRow = document.createElement('div');
  btnRow.className = 'btn-row';
  const actions = [
    ['Alimentar', 'feed'], ['Jugar', 'play'],
    ['Limpiar', 'clean'], ['Dormir', 'sleep']
  ];
  const buttons = {};
  for (const [label, action] of actions) {
    const b = document.createElement('button');
    b.className = 'btn';
    b.textContent = label;
    b.addEventListener('click', () => handlers.onAction(action));
    btnRow.appendChild(b);
    buttons[action] = b;
  }
  el.appendChild(btnRow);

  const render = () => {
    if (!el.isConnected) return; // panel cerrado: no-op
    for (const meta of STAT_META) {
      const v = Math.round(tam.stats[meta.key]);
      const b = bars[meta.key];
      b.fill.style.width = `${v}%`;
      b.val.textContent = `${v}`;
      b.stat.classList.toggle('low', v < 30);
    }
    moodLine.textContent = tam.sleeping
      ? 'Está durmiendo…'
      : `Estado de ánimo: ${tam.mood()}`;
    // Mientras duerme, "Dormir" pasa a ser "Despertar".
    if (buttons.sleep) buttons.sleep.textContent = tam.sleeping ? 'Despertar' : 'Dormir';
  };
  render();
  tam.on('change', render);

  return { el, destroy() { /* listeners viven mientras exista tam; el panel se elimina */ el.remove(); } };
}
