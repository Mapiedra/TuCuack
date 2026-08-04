// Vista de estado del pato: nombre, nivel, las cuatro necesidades, el ánimo y
// —donde tenga sentido— la botonera para cuidarlo.
//
// Es UNA sola vista con dos casas: el globo que sale al dejar el ratón encima
// (ui/tooltip.js) y la cabecera del menú del pato (desde app.js). No son copias
// parecidas: es el mismo componente, así que lo que se cambie aquí cambia en
// los dos sitios a la vez.
//
// La botonera sólo aparece si quien la monta pasa `onAction`. El globo del
// ratón no lo hace a propósito: es informativo y no captura el puntero (ver
// `pointer-events: none` en styles.css), así que unos botones ahí serían
// botones muertos.

import { AGOTAMIENTO } from '../game/Tamagotchi.js';

// Cada icono es el MISMO que usa su necesidad en el resto de la interfaz
// (ver ui/bubbles.js y ui/panels.js), para que se lea de un vistazo.
export const NECESIDADES = [
  { key: 'hunger', icon: '🍖', label: 'Comida' },
  { key: 'energy', icon: '⚡', label: 'Energía' },
  { key: 'hygiene', icon: '🧼', label: 'Higiene' },
  { key: 'happiness', icon: '❤️', label: 'Ánimo' }
];

// La botonera repite el icono de la necesidad que atiende cada acción: el pan
// sube la comida, el balón el ánimo, el jabón la higiene.
const ACCIONES = [
  { id: 'feed', icon: '🍞', titulo: 'Alimentar' },
  { id: 'play', icon: '⚽', titulo: 'Jugar' },
  { id: 'clean', icon: '🧼', titulo: 'Limpiar' },
  { id: 'sleep', icon: '💤', titulo: 'Dormir', durmiendo: { icon: '☀️', titulo: 'Despertar' } }
];

/** Por debajo de esto la barra se pinta en rojo. */
const BAJO = 30;

/**
 * @param {import('../game/Tamagotchi.js').Tamagotchi} tam
 * @param {string} nombre
 * @param {import('../game/Level.js').Level} [level]
 * @param {{onAction?:(id:string)=>void}} [opciones]
 * @returns {{el:HTMLElement, destroy:Function}}
 */
export function buildStatsView(tam, nombre, level, opciones = {}) {
  const el = document.createElement('div');
  el.className = 'vista-stats';

  const t = document.createElement('div');
  t.className = 'tooltip-title';
  t.textContent = nombre;
  el.appendChild(t);

  // El nivel va con el resto de indicadores, no aparte.
  let nivelTxt = null;
  let nivelFill = null;
  if (level) {
    const niv = document.createElement('div');
    niv.className = 'tooltip-nivel';
    nivelTxt = document.createElement('span');
    const bar = document.createElement('span');
    bar.className = 'bar';
    nivelFill = document.createElement('span');
    nivelFill.className = 'fill';
    bar.appendChild(nivelFill);
    niv.append(nivelTxt, bar);
    el.appendChild(niv);
  }

  const barras = {};
  for (const s of NECESIDADES) {
    const fila = document.createElement('div');
    fila.className = 'tooltip-stat';

    const ico = document.createElement('span');
    ico.className = 'ic';
    ico.textContent = s.icon;
    ico.title = s.label;

    const bar = document.createElement('span');
    bar.className = 'bar';
    const fill = document.createElement('span');
    fill.className = 'fill';
    bar.appendChild(fill);

    const num = document.createElement('span');
    num.className = 'num';

    fila.append(ico, bar, num);
    el.appendChild(fila);
    barras[s.key] = { fila, fill, num };
  }

  const mood = document.createElement('div');
  mood.className = 'tooltip-mood';
  el.appendChild(mood);

  const botones = {};
  if (opciones.onAction) {
    const fila = document.createElement('div');
    fila.className = 'stats-acciones';
    for (const a of ACCIONES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.addEventListener('click', () => opciones.onAction(a.id));
      fila.appendChild(b);
      botones[a.id] = b;
    }
    el.appendChild(fila);
  }

  const pintar = () => {
    if (level) {
      nivelTxt.textContent = `Nv ${level.nivel} · ${level.rango}`;
      nivelFill.style.width = `${Math.round(level.progreso * 100)}%`;
    }
    for (const s of NECESIDADES) {
      const v = Math.round(tam.stats[s.key]);
      const b = barras[s.key];
      b.fill.style.width = `${v}%`;
      b.num.textContent = v;
      b.fila.classList.toggle('low', v < BAJO);
    }
    mood.textContent = textoDeAnimo(tam);
    for (const a of ACCIONES) {
      const b = botones[a.id];
      if (!b) continue;
      // "Dormir" pasa a ser "Despertar" mientras duerme.
      const cara = a.durmiendo && tam.sleeping ? a.durmiendo : a;
      b.textContent = cara.icon;
      b.title = cara.titulo;
      b.setAttribute('aria-label', cara.titulo);
      // Agotado no acepta nada: los botones se apagan en vez de no hacer nada.
      b.disabled = tam.agotado;
    }
  };
  pintar();

  // Se mantiene al día mientras esté a la vista: en el menú se cuida al pato
  // desde aquí mismo y las barras tienen que moverse al pulsar.
  tam.on('change', pintar);

  return { el, destroy() { tam.off('change', pintar); } };
}

/**
 * Cómo está el pato, en una línea. Lo usan esta vista y el panel de
 * estadísticas, para que digan lo mismo.
 * @param {import('../game/Tamagotchi.js').Tamagotchi} tam
 */
export function textoDeAnimo(tam) {
  // Sin dos puntos: el panel de estadísticas antepone "Estado de ánimo:".
  if (tam.agotado) return `agotado, duerme hasta el ${AGOTAMIENTO.DESPIERTA} % de energía`;
  return tam.sleeping ? 'durmiendo…' : tam.mood();
}
