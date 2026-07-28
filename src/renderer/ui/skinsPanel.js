// Panel de diseños de pato: se ven todos, pero los que piden más nivel salen
// atenuados y con un candado, para que se sepa qué hay por delante.

import { SKINS, estaDesbloqueada, rutaSheet } from '../game/skins.js';
import { XP, RANGOS, xpParaNivel } from '../game/Level.js';

// El retrato de cada diseño es el primer frame de 'idle' del sheet, recortado
// al pato mediante background-size/position (ver .skin-mini en styles.css).

/**
 * @param {import('../game/Level.js').Level} level
 * @param {string} actual  id del diseño puesto
 * @param {{onElegir:(id:string)=>void, onClose:Function}} handlers
 */
export function buildSkinsPanel(level, actual, handlers) {
  const el = document.createElement('div');
  el.className = 'panel panel-skins hot';

  const h = document.createElement('h3');
  h.textContent = 'Diseños';
  const close = document.createElement('span');
  close.className = 'close';
  close.textContent = '×';
  close.addEventListener('click', () => handlers.onClose());
  h.appendChild(close);
  el.appendChild(h);

  // Nivel y progreso hacia el siguiente.
  const cab = document.createElement('div');
  cab.className = 'nivel-cab';
  const nivelTxt = document.createElement('div');
  nivelTxt.className = 'nivel-txt';
  nivelTxt.innerHTML = `<b>Nivel ${level.nivel}</b> · ${level.rango}`;
  const barra = document.createElement('div');
  barra.className = 'nivel-barra';
  const relleno = document.createElement('div');
  relleno.className = 'nivel-fill';
  relleno.style.width = `${Math.round(level.progreso * 100)}%`;
  barra.appendChild(relleno);
  const restante = document.createElement('div');
  restante.className = 'muted';
  restante.textContent =
    `${level.xpNivelActual} / ${level.xpNivelSiguiente} XP para el nivel ${level.nivel + 1}`;
  cab.append(nivelTxt, barra, restante);
  el.appendChild(cab);

  // Rejilla de diseños.
  const grid = document.createElement('div');
  grid.className = 'skins-grid';
  for (const skin of SKINS) {
    const libre = estaDesbloqueada(skin, level.nivel);
    const card = document.createElement('button');
    card.className = 'skin-card' + (libre ? '' : ' bloqueada') +
      (skin.id === actual ? ' puesta' : '');
    card.disabled = !libre;
    card.title = libre ? skin.descripcion : `Se desbloquea en el nivel ${skin.nivel}`;

    const mini = document.createElement('span');
    mini.className = 'skin-mini';
    mini.style.backgroundImage = `url("${rutaSheet(skin.id)}")`;

    const nom = document.createElement('span');
    nom.className = 'skin-nombre';
    nom.textContent = skin.nombre;

    card.append(mini, nom);

    if (!libre) {
      const lock = document.createElement('span');
      lock.className = 'skin-lock';
      lock.textContent = `🔒 Nv ${skin.nivel}`;
      card.appendChild(lock);
    } else if (skin.id === actual) {
      const tick = document.createElement('span');
      tick.className = 'skin-tick';
      tick.textContent = '✓';
      card.appendChild(tick);
    }

    card.addEventListener('click', () => {
      if (!libre) return;
      handlers.onElegir(skin.id);
      handlers.onClose();
    });
    grid.appendChild(card);
  }
  el.appendChild(grid);

  // Explicación del sistema, plegada para no abrumar.
  el.appendChild(bloqueAyuda());

  return { el };
}

function bloqueAyuda() {
  const det = document.createElement('details');
  det.className = 'ayuda-xp';

  const sum = document.createElement('summary');
  sum.textContent = '¿Cómo se sube de nivel?';
  det.appendChild(sum);

  const p = document.createElement('p');
  p.textContent = 'Cuidar bien al pato da experiencia. No sirve de nada machacar '
    + 'los botones: sólo cuenta cuando de verdad lo necesita.';
  det.appendChild(p);

  const ul = document.createElement('ul');
  for (const [txt, xp] of [
    ['Tenerlo contento (todas las barras por encima de la mitad)', `+${XP.CONVIVENCIA} por minuto`],
    ['Atender una necesidad que estaba baja', `+${XP.CUIDADO}`],
    ['Primera atención del día (sube con los días seguidos)', `+${XP.RACHA}`],
    ['Hablar por el chat', `+${XP.CHAT}`]
  ]) {
    const li = document.createElement('li');
    const a = document.createElement('span');
    a.textContent = txt;
    const b = document.createElement('b');
    b.textContent = xp;
    li.append(a, b);
    ul.appendChild(li);
  }
  det.appendChild(ul);

  const nota = document.createElement('p');
  nota.className = 'muted';
  nota.textContent = 'Un pato descuidado deja de sumar por convivencia, pero nunca '
    + 'se pierde nivel. Con el ordenador apagado no se acumula experiencia.';
  det.appendChild(nota);

  const rangos = document.createElement('p');
  rangos.className = 'muted';
  rangos.textContent = 'Rangos: ' + RANGOS
    .map((r) => `${r.nombre} (Nv ${r.desde})`).join(' · ');
  det.appendChild(rangos);

  const curva = document.createElement('p');
  curva.className = 'muted';
  curva.textContent = 'Siguientes metas: ' + [5, 10, 15, 20]
    .map((n) => `Nv ${n} = ${xpParaNivel(n)} XP`).join(' · ');
  det.appendChild(curva);

  return det;
}
