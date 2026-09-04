// Panel de juegos: se ven todos, y los que piden más nivel salen atenuados y
// con un candado, igual que los diseños.
//
// Elegir modo no es una pantalla aparte: al tocar un juego que admite los dos,
// el cuerpo del panel se cambia por dos botones grandes y la lista de rivales.
// Un selector "solo/red" en cada tarjeta habría llenado la rejilla de controles
// para una decisión que se toma una vez por partida.

import { MINIJUEGOS, estaDesbloqueado, admiteModo, nombreDeJuego } from '../game/minijuegos/index.js';
import { XP, JUEGOS_TOPE_DIARIO } from '../game/Level.js';
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
  /** Si se está viendo la lista de récords en vez de la rejilla. */
  let enRecords = false;
  /** Juego cuyo marcador global se está viendo, o null. */
  let enMarcador = null;

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
    const dentro = elegido || enRecords || enMarcador;
    cabecera = panelHeader(titulo(), {
      // El botón de volver cambia de destino según la vista. Desde el marcador
      // de un juego se vuelve a la lista de récords, que es de donde se entró;
      // desde el resto, a la rejilla.
      onBack: enMarcador
        ? () => { enMarcador = null; enRecords = true; pintar(); }
        : (dentro ? () => { elegido = null; enRecords = false; pintar(); } : handlers.onBack),
      onClose: handlers.onClose
    });
    el.prepend(cabecera);

    cuerpo.textContent = '';
    if (enMarcador) pintarMarcador(enMarcador);
    else if (elegido) pintarModos(elegido);
    else if (enRecords) pintarRecords();
    else pintarRejilla();
  }

  function titulo() {
    if (enMarcador) return nombreDeJuego(enMarcador, estado.yo);
    if (elegido) return nombreDeJuego(elegido, estado.yo);
    return enRecords ? 'Tus récords' : 'Juegos';
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

    const verRecords = document.createElement('button');
    verRecords.className = 'btn';
    verRecords.type = 'button';
    const t = progreso.totales();
    verRecords.textContent = t.partidas
      ? `🏅 Tus récords · ${t.partidas} ${t.partidas === 1 ? 'partida' : 'partidas'}`
      : '🏅 Tus récords';
    verRecords.addEventListener('click', () => { enRecords = true; pintar(); });
    cuerpo.appendChild(verRecords);

    cuerpo.appendChild(bloqueAyuda());
  }

  // ---- Récords -----------------------------------------------------------

  /**
   * Lo que llevas jugado, por juego y en total.
   *
   * Es una vista de LECTURA sobre lo que ya está guardado: no calcula nada que
   * no esté en `ProgresoJuegos`. Salen todos los juegos, también los que aún no
   * tienes por nivel y los que no has tocado —un marcador vacío es una
   * invitación—, y también las marcas de un juego que se te haya vuelto a
   * bloquear, porque el progreso se guarda aparte del catálogo.
   */
  /**
   * El marcador global de un juego.
   *
   * Se pide al abrirlo y no antes: son juegos que la mayoría no va a mirar, y
   * una petición de red por cada uno al abrir el panel sería pagar por lo que
   * nadie ha pedido.
   */
  function pintarMarcador(juego) {
    const mio = progreso.de(juego.id);

    const nota = document.createElement('p');
    nota.className = 'muted';
    nota.textContent = mio.mejor != null
      ? `Tu marca: ${mio.mejor} ${juego.marca.etiqueta}`
      : 'Todavía no tienes marca en este juego.';
    cuerpo.appendChild(nota);

    const lista = document.createElement('ol');
    lista.className = 'marcador-lista';
    const cargando = document.createElement('li');
    cargando.className = 'muted';
    cargando.textContent = 'Preguntando…';
    lista.appendChild(cargando);
    cuerpo.appendChild(lista);

    const aviso = document.createElement('p');
    aviso.className = 'muted';
    // Y esto no es letra pequeña: sin un servidor que juegue la partida, una
    // marca es lo que su dueño dice que es. Decirlo es más honesto que
    // presentarlo como verificado, y además explica por qué sale el nombre.
    aviso.textContent = 'Lo declara cada pato. Nadie lo comprueba.';
    cuerpo.appendChild(aviso);

    handlers.onMarcador(juego).then((res) => {
      // El panel puede haberse cerrado o cambiado de vista mientras tanto.
      if (enMarcador !== juego || !lista.isConnected) return;
      lista.textContent = '';
      if (!res || !res.ok) {
        const mal = document.createElement('li');
        mal.className = 'muted';
        mal.textContent = 'No se ha podido consultar. ¿Hay conexión?';
        lista.appendChild(mal);
        return;
      }
      if (!res.datos.length) {
        const vacio = document.createElement('li');
        vacio.className = 'muted';
        vacio.textContent = 'Nadie ha marcado nada todavía. Estrénalo.';
        lista.appendChild(vacio);
        return;
      }
      for (const fila of res.datos) lista.appendChild(filaDelMarcador(fila, juego));
    });
  }

  function filaDelMarcador(fila, juego) {
    const li = document.createElement('li');
    li.className = 'marcador-fila';

    const quien = document.createElement('span');
    // Los nombres los escribe otra gente: `textContent` siempre.
    quien.textContent = fila.nombre;
    quien.className = 'marcador-nombre';

    const marca = document.createElement('b');
    marca.textContent = `${fila.marca} ${juego.marca.etiqueta}`;

    li.append(quien, marca);
    return li;
  }

  function pintarRecords() {
    const t = progreso.totales();

    const resumen = document.createElement('div');
    resumen.className = 'records-totales';
    for (const [valor, etiqueta] of [
      [t.partidas, t.partidas === 1 ? 'partida' : 'partidas'],
      [t.victorias, t.victorias === 1 ? 'ganada' : 'ganadas'],
      [`${level.partidasQuePuntuanHoy()}/${JUEGOS_TOPE_DIARIO}`, 'con XP hoy']
    ]) {
      const caja = document.createElement('div');
      const n = document.createElement('b');
      n.textContent = String(valor);
      const e = document.createElement('span');
      e.textContent = etiqueta;
      caja.append(n, e);
      resumen.appendChild(caja);
    }
    cuerpo.appendChild(resumen);

    const lista = document.createElement('ul');
    lista.className = 'records-lista';
    for (const juego of MINIJUEGOS) lista.appendChild(filaDeRecord(juego));
    cuerpo.appendChild(lista);

    const nota = document.createElement('p');
    nota.className = 'muted';
    // Dicho con palabras además de con el globo: el marcador global es lo más
    // nuevo del panel y lo único que hay que descubrir para llegar a él.
    nota.textContent = hayFilasConMarcador()
      ? 'Pulsa una fila con 🌐 para ver el marcador de todos los patos.'
      : 'Las marcas se guardan aunque un juego se vuelva a bloquear.';
    cuerpo.appendChild(nota);
  }

  /** Si alguna fila lleva a un marcador, para no prometer lo que no hay. */
  function hayFilasConMarcador() {
    return !!handlers.hayMarcadorGlobal && MINIJUEGOS.some((j) => j.marca);
  }

  function filaDeRecord(juego) {
    const m = progreso.de(juego.id);
    const jugado = m.partidas > 0;
    // Sólo los juegos con marca tienen marcador: los demás se ganan o se
    // pierden, y una tabla de «victorias» no compara nada entre patos.
    const conMarcador = !!(juego.marca && handlers.hayMarcadorGlobal);

    const li = document.createElement('li');
    li.className = 'records-fila' + (jugado ? '' : ' vacia')
      + (conMarcador ? ' conMarcador' : '');
    if (conMarcador) {
      li.tabIndex = 0;
      li.title = 'Ver el marcador de todos';
      li.addEventListener('click', () => { enMarcador = juego; enRecords = false; pintar(); });
      li.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        enMarcador = juego;
        enRecords = false;
        pintar();
      });
    }

    const icono = document.createElement('span');
    icono.className = 'records-icono';
    icono.textContent = juego.icono;

    const medio = document.createElement('div');
    const nom = document.createElement('b');
    nom.textContent = nombreDeJuego(juego, estado.yo);
    const bajo = document.createElement('span');
    bajo.className = 'records-detalle';
    bajo.textContent = jugado
      ? `${m.partidas} ${m.partidas === 1 ? 'partida' : 'partidas'} · ${m.victorias} ${m.victorias === 1 ? 'ganada' : 'ganadas'}`
      : (estaDesbloqueado(juego, level.nivel) ? 'sin estrenar' : `se abre en el nivel ${juego.nivel}`);
    medio.append(nom, bajo);

    const marca = document.createElement('span');
    marca.className = 'records-marca';
    // Sólo los juegos con `marca` guardan récord; los demás sólo se ganan o se
    // pierden, y ahí lo que dice algo son las victorias, que ya están arriba.
    marca.textContent = (juego.marca && m.mejor != null)
      ? `${m.mejor} ${juego.marca.etiqueta}`
      : '';

    // El globo y la flecha son toda la pista de que la fila lleva a algún
    // sitio. Sin ellos sólo lo delataba el cursor al pasarle por encima, que
    // es tanto como no decirlo: nadie pasa el ratón por una lista que ha
    // venido a leer. La columna existe siempre para que las marcas de las
    // filas sin marcador no se descoloquen respecto a las que sí lo tienen.
    const flecha = document.createElement('span');
    flecha.className = 'records-flecha';
    flecha.textContent = conMarcador ? '🌐›' : '';

    li.append(icono, medio, marca, flecha);
    return li;
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
