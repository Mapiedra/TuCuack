// Panel de juegos: se ven todos, y los que piden más nivel salen atenuados y
// con un candado, igual que los diseños.
//
// Elegir modo no es una pantalla aparte: al tocar un juego que admite los dos,
// el cuerpo del panel se cambia por dos botones grandes y la lista de rivales.
// Un selector "solo/red" en cada tarjeta habría llenado la rejilla de controles
// para una decisión que se toma una vez por partida.

import { MINIJUEGOS, estaDesbloqueado, admiteModo, nombreDeJuego } from '../game/minijuegos/index.js';
import { XP } from '../game/Level.js';
import { panelHeader } from './panelHeader.js';

/**
 * @param {import('../game/Level.js').Level} level
 * @param {import('../game/minijuegos/progreso.js').ProgresoJuegos} progreso
 * @param {{yo:string, otros:string[], presentes:object[], conectado:boolean}} presencia
 * @param {Object} capacidades   lo que la carcasa permite (ver core/platform.js)
 * @param {Object} handlers
 * @param {(juego, modo:'solo'|'turnos', opciones:object) => void} handlers.onJugar
 * @param {Function} [handlers.onBack]
 * @param {Function} handlers.onClose
 * @returns {{el:HTMLElement, actualizar:(p:object)=>void}}
 */
export function buildJuegosPanel(level, progreso, presencia, capacidades, handlers) {
  let estado = presencia;
  /** Juego cuya vista de modo está abierta, o null si se ve la rejilla. */
  let elegido = null;

  const el = document.createElement('div');
  el.className = 'panel panel-juegos hot';

  // El botón de volver cambia de destino según la vista, así que la cabecera se
  // rehace al cambiar; el panel, no.
  let cabecera = null;
  const cuerpo = document.createElement('div');

  pintar();
  el.appendChild(cuerpo);

  return {
    el,
    /** Los rivales entran y salen del canal mientras el panel está abierto. */
    actualizar(p) {
      estado = p;
      if (elegido) pintar();
    }
  };

  function pintar() {
    if (cabecera) cabecera.remove();
    cabecera = panelHeader(elegido ? nombreDeJuego(elegido, estado.yo) : 'Juegos', {
      onBack: elegido ? () => { elegido = null; pintar(); } : handlers.onBack,
      onClose: handlers.onClose
    });
    el.prepend(cabecera);

    cuerpo.textContent = '';
    if (elegido) pintarModos(elegido);
    else pintarRejilla();
  }

  // ---- Rejilla -----------------------------------------------------------

  function pintarRejilla() {
    const grid = document.createElement('div');
    grid.className = 'juegos-grid';

    for (const juego of MINIJUEGOS) {
      // Un juego de escenario toma la pantalla entera, y eso no vale en todas
      // partes: sobre una página ajena el pato está de prestado. Se enseña
      // igual, pero apagado y diciendo por qué.
      const cabe = juego.superficie !== 'escenario' || !!capacidades.juegosDeEscenario;
      const libre = estaDesbloqueado(juego, level.nivel) && cabe;
      const marcas = progreso.de(juego.id);

      const card = document.createElement('button');
      card.className = 'juego-card' + (libre ? '' : ' bloqueada');
      card.type = 'button';
      card.disabled = !libre;
      card.title = !cabe
        ? 'Este juego necesita la pantalla entera: se juega en la app de escritorio.'
        : libre ? juego.descripcion : `Se desbloquea en el nivel ${juego.nivel}`;

      const icono = document.createElement('span');
      icono.className = 'juego-icono';
      icono.textContent = juego.icono;

      const nom = document.createElement('span');
      nom.className = 'skin-nombre';
      nom.textContent = nombreDeJuego(juego, estado.yo);

      const modos = document.createElement('span');
      modos.className = 'juego-modo';
      modos.textContent = etiquetaDeModos(juego);

      card.append(icono, nom, modos);

      if (!libre) {
        const lock = document.createElement('span');
        lock.className = 'skin-lock';
        lock.textContent = cabe ? `🔒 Nv ${juego.nivel}` : '🖥 Sólo en escritorio';
        card.appendChild(lock);
      } else if (marcas.victorias > 0) {
        const tick = document.createElement('span');
        tick.className = 'skin-tick';
        tick.textContent = `×${marcas.victorias}`;
        tick.title = `${marcas.victorias} ganadas de ${marcas.partidas}`;
        card.appendChild(tick);
      }

      card.addEventListener('click', () => {
        if (!libre) return;
        // Con un solo modo no hay nada que preguntar.
        if (juego.modos.length === 1) {
          handlers.onJugar(juego, juego.modos[0], {});
          return;
        }
        elegido = juego;
        pintar();
      });

      grid.appendChild(card);
    }

    cuerpo.appendChild(grid);
    cuerpo.appendChild(bloqueAyuda());
  }

  function etiquetaDeModos(juego) {
    const partes = [];
    if (admiteModo(juego, 'solo')) partes.push('Solo');
    if (admiteModo(juego, 'turnos')) {
      partes.push(juego.jugadores.min === juego.jugadores.max
        ? `Red · ${juego.jugadores.min}`
        : `Red · ${juego.jugadores.min}-${juego.jugadores.max}`);
    }
    if (juego.superficie === 'escenario') partes.push('📺');
    return partes.join(' · ');
  }

  // ---- Vista de modo -----------------------------------------------------

  function pintarModos(juego) {
    const marcas = progreso.de(juego.id);
    if (marcas.partidas > 0) {
      const linea = document.createElement('p');
      linea.className = 'muted';
      const trozos = [`${marcas.partidas} partidas`, `${marcas.victorias} ganadas`];
      if (marcas.mejor != null && juego.marca) {
        trozos.push(`mejor ${marcas.mejor} ${juego.marca.etiqueta}`);
      }
      linea.textContent = trozos.join(' · ');
      cuerpo.appendChild(linea);
    }

    const desc = document.createElement('p');
    desc.className = 'muted';
    desc.textContent = juego.descripcion;
    cuerpo.appendChild(desc);

    const caja = document.createElement('div');
    caja.className = 'juego-elegir';

    if (admiteModo(juego, 'solo')) {
      const solo = document.createElement('button');
      solo.className = 'btn';
      solo.type = 'button';
      solo.textContent = '🐾 Contra tu mascota';
      solo.addEventListener('click', () => handlers.onJugar(juego, 'solo', {}));
      caja.appendChild(solo);
    }

    if (admiteModo(juego, 'turnos')) caja.appendChild(bloqueRivales(juego));

    cuerpo.appendChild(caja);
  }

  /**
   * La lista de rivales, o el motivo por el que no la hay.
   *
   * Decir por qué no se puede retar importa: un botón apagado sin explicación
   * parece un fallo, y el caso normal —no hay nadie más conectado— no lo es.
   */
  function bloqueRivales(juego) {
    const caja = document.createElement('div');

    const titulo = document.createElement('p');
    titulo.className = 'muted';
    titulo.textContent = '🌐 Retar a otra mascota';
    caja.appendChild(titulo);

    if (!estado.conectado) {
      caja.appendChild(motivo('El chat no está conectado.'));
      return caja;
    }
    const rivales = (estado.presentes || []).filter((p) => p && p.clave);
    if (!rivales.length) {
      caja.appendChild(motivo((estado.otros || []).length
        ? 'Las mascotas conectadas llevan otra versión y todavía no pueden jugar.'
        : 'No hay ninguna otra mascota conectada ahora mismo.'));
      return caja;
    }

    for (const rival of rivales) {
      const b = document.createElement('button');
      b.className = 'btn';
      b.type = 'button';
      // textContent siempre: el nombre lo pone otra persona.
      b.textContent = `⚔ ${rival.nombre}`;
      b.addEventListener('click', () => handlers.onJugar(juego, 'turnos', { rival }));
      caja.appendChild(b);
    }
    return caja;
  }

  function motivo(texto) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = texto;
    return p;
  }
}

function bloqueAyuda() {
  const det = document.createElement('details');
  det.className = 'ayuda-xp';

  const sum = document.createElement('summary');
  sum.textContent = '¿Los juegos dan experiencia?';
  det.appendChild(sum);

  const ul = document.createElement('ul');
  for (const [txt, xp] of [
    ['Terminar una partida, se gane o no', `+${XP.PARTIDA}`],
    ['Ganarla', `+${XP.VICTORIA} más`],
    ['Empatar', `+${Math.round(XP.VICTORIA / 2)} más`]
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

  // El tope se dice en voz alta: si no, el contador parándose parece un fallo.
  const nota = document.createElement('p');
  nota.className = 'muted';
  nota.textContent = 'Sólo puntúan las primeras partidas de cada día. Pasadas '
    + 'ésas se sigue jugando igual, pero ya no suman: si no, jugar en bucle '
    + 'sería la forma más rápida de subir de nivel. Jugar también cansa a tu mascota.';
  det.appendChild(nota);

  return det;
}
