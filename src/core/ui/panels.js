// Panel de estadísticas del Tamagotchi + acciones de cuidado.

import { panelHeader } from './panelHeader.js';
import { textoDeAnimo } from './statsView.js';

const STAT_META = [
  { key: 'hunger', label: '🍖 Comida' },
  { key: 'energy', label: '⚡ Energía' },
  { key: 'hygiene', label: '🧼 Higiene' },
  { key: 'happiness', label: '❤️ Felicidad' }
];

/**
 * @param {import('../game/Tamagotchi.js').Tamagotchi} tam
 * @param {{onAction:(name:string)=>void, onClose:Function, onBack?:Function,
 *          name?:string, level?:import('../game/Level.js').Level}} handlers
 * @returns {{el:HTMLElement, destroy:Function}}
 */
export function buildStatsPanel(tam, handlers) {
  const el = document.createElement('div');
  el.className = 'panel hot';

  // Título = nombre del pato (el que se configura en Ajustes).
  el.appendChild(panelHeader(handlers.name || 'Tu pato', handlers));

  // El nivel va con el resto de indicadores: es una medida más de cómo va el pato.
  const level = handlers.level;
  if (level) {
    const fila = document.createElement('div');
    fila.className = 'nivel-cab nivel-inline';
    const txt = document.createElement('div');
    txt.className = 'nivel-txt';
    txt.innerHTML = `<b>Nivel ${level.nivel}</b> · ${level.rango}`;
    const barra = document.createElement('div');
    barra.className = 'nivel-barra';
    const relleno = document.createElement('div');
    relleno.className = 'nivel-fill';
    relleno.style.width = `${Math.round(level.progreso * 100)}%`;
    barra.appendChild(relleno);
    const resto = document.createElement('div');
    resto.className = 'muted';
    resto.textContent = `${level.xpNivelActual} / ${level.xpNivelSiguiente} XP`;
    fila.append(txt, barra, resto);
    el.appendChild(fila);
  }

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
    for (const meta of STAT_META) {
      const v = Math.round(tam.stats[meta.key]);
      const b = bars[meta.key];
      b.fill.style.width = `${v}%`;
      b.val.textContent = `${v}`;
      b.stat.classList.toggle('low', v < 30);
    }
    // El mismo texto que enseña la vista de estado, para no decir dos cosas
    // distintas de un pato que está igual.
    moodLine.textContent = `Estado de ánimo: ${textoDeAnimo(tam)}`;
    // Mientras duerme, "Dormir" pasa a ser "Despertar".
    if (buttons.sleep) buttons.sleep.textContent = tam.sleeping ? 'Despertar' : 'Dormir';
    // Agotado no acepta nada: los botones se apagan en vez de no hacer nada.
    for (const b of Object.values(buttons)) b.disabled = tam.agotado;
  };
  render();
  tam.on('change', render);
  // El panel va y viene; el Tamagotchi se queda. Sin soltar el oyente al
  // cerrarlo, cada apertura dejaba uno más pintando sobre un panel que ya no
  // está en el documento.
  el.addEventListener('panel:cerrado', () => tam.off('change', render), { once: true });

  return { el, destroy() { tam.off('change', render); el.remove(); } };
}
