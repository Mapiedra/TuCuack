// Marco de una partida: cabecera, el tablero que ponga el juego, y el pie con
// el resultado.
//
// Es la pieza que hace que añadir un minijuego salga barato. Todo lo que se
// repite en cualquier juego vive aquí —traer el módulo, apagar sus bucles,
// contar el resultado una sola vez, la experiencia, el "¿Otra?"—, de modo que un
// juego nuevo sólo tiene que saber pintar su tablero.

import { cargarMinijuego } from '../game/minijuegos/index.js';
import { panelHeader } from './panelHeader.js';
import { nombreDeJuego } from '../game/minijuegos/index.js';
import * as sonido from '../audio/sounds.js';

const VEREDICTO = {
  victoria: '¡Ganaste!',
  derrota: 'Perdiste',
  empate: 'Empate'
};

/**
 * @param {import('../game/minijuegos/index.js').Minijuego} juego
 * @param {'solo'|'turnos'} modo
 * @param {Object} handlers
 * @param {Object} handlers.ctx        lo que aporta app.js al contexto del juego
 * @param {(r:import('../game/minijuegos/index.js').ResultadoPartida) => {xp:number}} handlers.onFin
 *   Anota, puntúa y guarda. Devuelve la experiencia concedida para poder
 *   enseñarla en el pie.
 * @param {Function} [handlers.onRevancha]
 *   Sólo en 'turnos'. Propone otra partida al rival; no la empieza. Quien la
 *   empieza es la sala, cuando los dos hayan dicho que sí.
 * @param {Function} [handlers.onDejarlo]
 *   Sólo en 'turnos'. Avisa al rival de que no hay revancha.
 * @param {Function} [handlers.onBack]
 * @param {Function} handlers.onClose
 * @returns {{el: HTMLElement, revanchaPedida: (nombre:string) => void,
 *            revanchaEsperando: (nombre:string) => void}}
 */
export function buildPartidaPanel(juego, modo, handlers) {
  const enRed = modo === 'turnos' && !!handlers.onRevancha;

  const el = document.createElement('div');
  el.className = 'panel panel-partida hot';
  el.appendChild(panelHeader(nombreDeJuego(juego, handlers.ctx.yo), handlers));

  const cuerpo = document.createElement('div');
  cuerpo.className = 'juego-cuerpo';
  el.appendChild(cuerpo);

  const pie = document.createElement('div');
  pie.className = 'juego-fin';
  pie.hidden = true;
  el.appendChild(pie);

  // Lo que haya que apagar al cerrar o al empezar otra partida. Lo llena el
  // propio contexto que se le pasa al juego, así que un juego que use las
  // herramientas del ctx no puede dejarse nada encendido.
  let limpieza = [];
  /** @type {{el:HTMLElement|null, destroy:Function}|null} */
  let partida = null;
  let vivo = true;
  /** El botón de "¿Otra?", que en red cambia de texto según la negociación. */
  let botonOtra = null;
  let notaPie = null;

  arrancar();

  // El pato puede mudarse de pestaña sin avisar; este es el aviso de que el
  // panel se va. Es el mismo gancho que usan los demás paneles.
  el.addEventListener('panel:cerrado', () => { vivo = false; recoger(); }, { once: true });

  return {
    el,
    /** El rival ha pedido otra: se dice, y el botón deja de ser una pregunta. */
    revanchaPedida(nombre) {
      if (!botonOtra) return;
      botonOtra.textContent = '¿Otra? ¡Él quiere!';
      nota(`${nombre} quiere otra partida.`);
    },
    /** Lo hemos pedido nosotros: toca esperar, y se ve que se está esperando. */
    revanchaEsperando(nombre) {
      if (!botonOtra) return;
      botonOtra.disabled = true;
      botonOtra.textContent = 'Esperando…';
      nota(`Esperando a que ${nombre} conteste.`);
    },
    /**
     * No hay revancha: el rival ha dicho que no, se ha ido o ha desaparecido.
     *
     * Sin esto el panel se quedaba en "Esperando…" para siempre, que es la
     * peor manera de decir que ya no hay nada que esperar.
     */
    revanchaCancelada(texto) {
      if (!botonOtra) return;
      botonOtra.disabled = true;
      botonOtra.textContent = 'Se acabó';
      nota(texto);
    }
  };

  // ---- Ciclo de una partida ---------------------------------------------

  async function arrancar() {
    recoger();
    pie.hidden = true;
    pie.textContent = '';
    cuerpo.textContent = 'Cargando…';

    let modulo;
    try {
      modulo = await cargarMinijuego(juego.id);
    } catch (err) {
      console.error(`[juego:${juego.id}] no se pudo cargar`, err);
      if (vivo) mostrarAviso('No se ha podido abrir este juego.');
      return;
    }
    // Entre el `await` y aquí el usuario ha podido cerrar el panel.
    if (!vivo) return;

    let creada;
    try {
      creada = modulo.crearPartida(construirContexto());
    } catch (err) {
      console.error(`[juego:${juego.id}] falló al empezar`, err);
      mostrarAviso('Este juego se ha estropeado al empezar.');
      return;
    }

    partida = creada;
    cuerpo.textContent = '';
    if (creada && creada.el) cuerpo.appendChild(creada.el);
    sonido.empezarPartida();
  }

  /** Apaga la partida anterior: sus bucles, sus listeners y su tablero. */
  function recoger() {
    for (const fn of limpieza.splice(0)) {
      try { fn(); } catch (err) { console.warn(`[juego:${juego.id}] fallo al recoger`, err); }
    }
    if (partida && partida.destroy) {
      try { partida.destroy(); } catch (err) { console.warn(`[juego:${juego.id}] fallo al destruir`, err); }
    }
    partida = null;
    cuerpo.textContent = '';
  }

  function mostrarAviso(texto) {
    cuerpo.textContent = '';
    const p = document.createElement('p');
    p.className = 'muted error';
    p.textContent = texto;
    cuerpo.appendChild(p);
  }

  // ---- El contexto que recibe el juego -----------------------------------

  function construirContexto() {
    // Sólo el primer `alTerminar` cuenta. Un juego con un fallo que lo llame
    // dos veces no debe dar experiencia doble ni anotar dos partidas.
    let terminada = false;

    const registrar = (fn) => { limpieza.push(fn); return fn; };

    return {
      ...handlers.ctx,
      juego,
      modo,

      alTerminar(resultado) {
        if (terminada || !vivo) return;
        terminada = true;
        const r = normalizar(resultado);
        let xp = 0;
        try {
          const info = handlers.onFin(r) || {};
          xp = Number(info.xp) || 0;
        } catch (err) {
          console.warn(`[juego:${juego.id}] fallo al anotar el resultado`, err);
        }
        pintarPie(r, xp);
      },

      /**
       * Un bucle de fotogramas que se apaga solo. Devuelve la función para
       * pararlo antes, por si el juego quiere.
       */
      cadaFrame(fn) {
        let pedido = 0;
        let ultimo = performance.now();
        const paso = (t) => {
          const dt = Math.min((t - ultimo) / 1000, 0.1);
          ultimo = t;
          fn(dt);
          pedido = requestAnimationFrame(paso);
        };
        pedido = requestAnimationFrame(paso);
        const parar = () => cancelAnimationFrame(pedido);
        registrar(parar);
        return parar;
      },

      cadaCierto(fn, ms) {
        const id = setInterval(fn, ms);
        const parar = () => clearInterval(id);
        registrar(parar);
        return parar;
      },

      escuchar(objetivo, evento, fn, opciones) {
        objetivo.addEventListener(evento, fn, opciones);
        registrar(() => objetivo.removeEventListener(evento, fn, opciones));
      },

      alDestruir: registrar
    };
  }

  // ---- El pie -------------------------------------------------------------

  function pintarPie(r, xp) {
    if (r.resultado === 'victoria') sonido.victoria();
    else sonido.derrota();

    pie.textContent = '';
    pie.hidden = false;

    const veredicto = document.createElement('p');
    veredicto.className = 'juego-veredicto';
    veredicto.textContent = VEREDICTO[r.resultado] || '';
    pie.appendChild(veredicto);

    if (r.detalle) {
      const d = document.createElement('p');
      d.className = 'muted';
      d.textContent = r.detalle;
      pie.appendChild(d);
    }

    const exp = document.createElement('p');
    exp.className = xp > 0 ? 'xp' : 'muted';
    // Decir por qué no suma evita que el tope parezca un fallo.
    exp.textContent = xp > 0 ? `+${xp} XP` : 'Hoy ya no da más experiencia. Se juega igual.';
    pie.appendChild(exp);

    notaPie = document.createElement('p');
    notaPie.className = 'muted';
    notaPie.hidden = true;
    pie.appendChild(notaPie);

    const fila = document.createElement('div');
    fila.className = 'btn-row';

    const otra = document.createElement('button');
    otra.className = 'btn';
    otra.type = 'button';
    otra.textContent = '¿Otra?';
    // Contra el pato se reinicia y ya está. Por red hay que preguntárselo al
    // otro: reiniciar por nuestra cuenta nos dejaría jugando solos.
    otra.addEventListener('click', () => {
      if (enRed) {
        otra.disabled = true;
        handlers.onRevancha();
      } else {
        arrancar();
      }
    });
    fila.appendChild(otra);
    botonOtra = otra;

    const salir = document.createElement('button');
    salir.className = 'btn';
    salir.type = 'button';
    salir.textContent = 'Salir';
    salir.addEventListener('click', () => {
      // Irse sin decir nada dejaría al rival esperando una respuesta que no va
      // a llegar hasta que salte su plazo de ausencia.
      if (enRed && handlers.onDejarlo) handlers.onDejarlo();
      handlers.onClose();
    });
    fila.appendChild(salir);

    pie.appendChild(fila);
  }

  function nota(texto) {
    if (!notaPie) return;
    notaPie.hidden = false;
    notaPie.textContent = texto;
  }
}

/** Un resultado que venga raro no debe tumbar el marco ni falsear las marcas. */
function normalizar(r) {
  const bruto = r && r.resultado;
  const resultado = bruto === 'victoria' || bruto === 'empate' ? bruto : 'derrota';
  const salida = { resultado };
  if (r && typeof r.puntos === 'number' && Number.isFinite(r.puntos)) salida.puntos = r.puntos;
  if (r && r.detalle) salida.detalle = String(r.detalle);
  return salida;
}
