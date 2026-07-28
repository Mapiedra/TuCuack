// Globo con las necesidades del pato, que aparece al dejar el ratón encima.
// Es sólo informativo: no captura el ratón ni interrumpe el arrastre.

const STATS = [
  { key: 'hunger', icon: '🍖', label: 'Comida' },
  { key: 'energy', icon: '⚡', label: 'Energía' },
  { key: 'hygiene', icon: '🧼', label: 'Higiene' },
  { key: 'happiness', icon: '❤️', label: 'Ánimo' }
];

let actual = null;

/**
 * @param {import('../game/Tamagotchi.js').Tamagotchi} tam
 * @param {string} nombre
 * @param {{x:number,y:number}} anchor  punto sobre la cabeza del pato
 */
export function showStatsTooltip(tam, nombre, anchor, level) {
  hideStatsTooltip();

  const el = document.createElement('div');
  el.className = 'tooltip';

  const t = document.createElement('div');
  t.className = 'tooltip-title';
  t.textContent = nombre;
  el.appendChild(t);

  // El nivel va con el resto de indicadores, no aparte.
  if (level) {
    const niv = document.createElement('div');
    niv.className = 'tooltip-nivel';
    const et = document.createElement('span');
    et.textContent = `Nv ${level.nivel} · ${level.rango}`;
    const bar = document.createElement('span');
    bar.className = 'bar';
    const fill = document.createElement('span');
    fill.className = 'fill';
    fill.style.width = `${Math.round(level.progreso * 100)}%`;
    bar.appendChild(fill);
    niv.append(et, bar);
    el.appendChild(niv);
  }

  for (const s of STATS) {
    const v = Math.round(tam.stats[s.key]);
    const fila = document.createElement('div');
    fila.className = 'tooltip-stat' + (v < 30 ? ' low' : '');

    const ico = document.createElement('span');
    ico.className = 'ic';
    ico.textContent = s.icon;

    const bar = document.createElement('span');
    bar.className = 'bar';
    const fill = document.createElement('span');
    fill.className = 'fill';
    fill.style.width = `${v}%`;
    bar.appendChild(fill);

    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = v;

    fila.append(ico, bar, num);
    el.appendChild(fila);
  }

  const mood = document.createElement('div');
  mood.className = 'tooltip-mood';
  mood.textContent = tam.sleeping ? 'durmiendo…' : tam.mood();
  el.appendChild(mood);

  document.body.appendChild(el);

  // Centrado sobre el pato y por encima de su cabeza.
  //
  // Se mide con offsetWidth/offsetHeight y no con getBoundingClientRect: el
  // globo entra con una animación que arranca en scale(0), y el rect devuelve
  // el tamaño ya transformado, es decir 0x0 mientras dura la animación.
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const x = Math.min(Math.max(8, anchor.x - w / 2), window.innerWidth - w - 8);
  let y = anchor.y - h - 8;
  if (y < 8) y = anchor.y + 8;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;

  actual = el;
  return el;
}

export function hideStatsTooltip() {
  if (actual) {
    actual.remove();
    actual = null;
  }
}

export function isTooltipVisible() {
  return Boolean(actual);
}
