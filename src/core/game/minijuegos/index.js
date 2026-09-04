// Catálogo de minijuegos.
//
// Igual que los diseños, se desbloquean por nivel y se ven todos desde el
// principio: saber qué hay por delante es media gracia de subir.
//
// Para añadir uno nuevo:
//   1. Escribe `src/core/game/minijuegos/<id>.js` cumpliendo el contrato de
//      abajo (exporta `crearPartida(ctx)`).
//   2. Añade su entrada a MINIJUEGOS.
//   3. Ya está. El panel de selección, el desbloqueo, la experiencia, el
//      progreso guardado y el aviso al subir de nivel salen todos de esta lista.
//
// Lo único que este fichero sabe hacer con un juego es CARGARLO: el módulo se
// trae con `import()` dinámico y sólo cuando alguien va a jugar, para no pagar
// en el arranque del pato juegos que quizá no se abran nunca.

// ---- El descriptor -------------------------------------------------------

/**
 * @typedef {Object} Minijuego
 * @property {string} id
 *   Clave estable: da nombre al fichero y al progreso guardado. **No se
 *   renombra nunca**, o los récords de ese juego quedan huérfanos.
 * @property {string} nombre
 * @property {string} icono        un emoji; así no hay arte que empaquetar
 * @property {string} descripcion
 * @property {number} nivel        nivel al que se desbloquea
 * @property {Array<'solo'|'turnos'>} modos
 * @property {{min:number, max:number}} jugadores  sólo cuenta en 'turnos'
 * @property {'panel'|'escenario'} superficie
 *   'panel'     → se juega dentro de un panel, como el resto de la interfaz.
 *   'escenario' → toma la pantalla entera y pilota al pato (paleta, puntería).
 * @property {{etiqueta:string, mejor:'mas'|'menos'}|null} marca
 *   Qué se guarda como récord y en qué dirección es "mejor". `null` si el juego
 *   sólo se gana o se pierde (tres en raya, hundir la flota).
 * @property {() => Promise<ModuloMinijuego>} cargar
 */

/**
 * El orden de la lista es el orden en que se ven, y va de menos a más: primero
 * los de decidir en un segundo, después los de pensar. El nivel acompaña a esa
 * misma cuesta, con hueco de sobra por delante para los que faltan —la paleta,
 * el ahorcado, hundir la flota—, que son bastante más largos.
 *
 * No hay campo de experiencia por juego, y es a propósito: sería la puerta de
 * la granja de XP. El día que alguien meta un juego de cinco segundos, subiría
 * de nivel mientras cena. Lo que da un minijuego lo decide `Level.minijuego`,
 * igual para todos y con tope diario.
 */
export const MINIJUEGOS = [
  {
    id: 'piedrapapeltijera',
    nombre: 'Piedra, papel o tijera',
    icono: '✌️',
    descripcion: 'Al mejor de tres. Los dos eligen a la vez.',
    nivel: 1,
    modos: ['solo', 'turnos'],
    jugadores: { min: 2, max: 2 },
    superficie: 'panel',
    marca: null,
    // La ruta va escrita literal y no `import('./' + id + '.js')`: así la
    // dependencia se ve, y no depende de que nadie empaquete nada.
    cargar: () => import('./piedraPapelTijera.js')
  },
  {
    id: 'mascotadice',
    // `{mascota}` lo rellena `nombreDeJuego` con el nombre que tenga puesto en
    // Ajustes: «Pato dice», «Cuacky dice». El juego es de toda la vida y se
    // llama por el nombre de quien canta, así que aquí canta la tuya.
    nombre: '{mascota} dice',
    icono: '🔊',
    descripcion: 'Repite la serie sin equivocarte. Cada ronda, una más.',
    nivel: 2,
    modos: ['solo'],
    jugadores: { min: 1, max: 1 },
    superficie: 'panel',
    marca: { etiqueta: 'ronda', mejor: 'mas' },
    cargar: () => import('./laMascotaDice.js')
  },
  {
    id: 'parimpar',
    nombre: 'Par o impar',
    icono: '🎲',
    descripcion: 'Uno pide par, el otro impar, y la suma decide.',
    nivel: 3,
    modos: ['solo', 'turnos'],
    jugadores: { min: 2, max: 2 },
    superficie: 'panel',
    marca: null,
    cargar: () => import('./parImpar.js')
  },
  {
    id: 'memoria',
    nombre: 'Memoria',
    icono: '🃏',
    descripcion: 'Parejas con tu mascota. Doce cartas, seis poses.',
    nivel: 4,
    modos: ['solo', 'turnos'],
    jugadores: { min: 2, max: 2 },
    superficie: 'panel',
    marca: null,
    cargar: () => import('./memoria.js')
  },
  {
    id: 'tresenraya',
    nombre: 'Tres en raya',
    icono: '⭕',
    descripcion: 'El de siempre. Contra tu mascota o contra otra.',
    nivel: 6,
    modos: ['solo', 'turnos'],
    jugadores: { min: 2, max: 2 },
    superficie: 'panel',
    marca: null,
    cargar: () => import('./tresEnRaya.js')
  },
  {
    id: 'obstaculos',
    nombre: 'Obstáculos',
    icono: '🌵',
    descripcion: 'Corre y salta con la barra espaciadora. Hasta que falles.',
    nivel: 8,
    modos: ['solo'],
    jugadores: { min: 1, max: 1 },
    superficie: 'escenario',
    marca: { etiqueta: 'm', mejor: 'mas' },
    cargar: () => import('./obstaculos.js')
  },
  {
    id: 'paleta',
    // Que es lo que se hace: mantenerla en el aire a base de toques. «Pong» se
    // deja libre a propósito, que va a haber uno de verdad.
    nombre: 'Malabares',
    icono: '🏓',
    descripcion: 'Que no toque el suelo. Se juega en la pantalla entera.',
    nivel: 9,
    modos: ['solo'],
    jugadores: { min: 1, max: 1 },
    superficie: 'escenario',
    marca: { etiqueta: 'toques', mejor: 'mas' },
    cargar: () => import('./paleta.js')
  },
  {
    id: 'punteria',
    // Robin Hood con la mascota de casa: «Pato Hook», «Cuacky Hook». El id se
    // queda como estaba, que los ids no se renombran nunca.
    nombre: '{mascota} Hook',
    icono: '🎯',
    descripcion: 'Seis disparos, cinco dianas. Apunta y suelta.',
    nivel: 12,
    modos: ['solo'],
    jugadores: { min: 1, max: 1 },
    superficie: 'escenario',
    marca: { etiqueta: 'puntos', mejor: 'mas' },
    cargar: () => import('./punteria.js')
  },
  {
    id: 'agujero',
    // El id se queda: los ids no se renombran nunca, que dan nombre al fichero y
    // al progreso guardado.
    nombre: 'The Hole',
    icono: '🕳️',
    descripcion: 'Recoge las que caen. Las que no, se quedan en el suelo.',
    nivel: 16,
    modos: ['solo'],
    jugadores: { min: 1, max: 1 },
    superficie: 'escenario',
    marca: { etiqueta: 'calibre', mejor: 'mas' },
    cargar: () => import('./agujero.js')
  }
];

// ---- El contrato que cumple cada juego -----------------------------------

/**
 * @typedef {Object} ModuloMinijuego
 * @property {(ctx: ContextoPartida) => Partida} crearPartida
 *
 * Es TODO lo que exporta un juego. Un módulo de juego no guarda estado suyo:
 * `crearPartida` se vuelve a llamar en cada "¿Otra?", así que cualquier
 * variable a nivel de módulo se filtraría de una partida a la siguiente.
 */

/**
 * @typedef {Object} Partida
 * @property {HTMLElement|null} el
 *   El tablero. El marco lo monta dentro del panel. En un juego de superficie
 *   'escenario' aquí va sólo el marcador, o `null`: la acción pasa fuera.
 * @property {() => void} destroy
 *   Suelta lo que el juego haya cogido por su cuenta. Lo llama el marco al
 *   cerrar, al empezar otra partida y cuando el pato se apaga (en la extensión
 *   se muda de pestaña sin avisar). Después de esto el juego no puede volver a
 *   pintar ni a sonar.
 * @property {(dt:number, pista:Object) => void} [actualizar]
 *   Sólo en superficie 'escenario': un fotograma. Lo llama el bucle del pato con
 *   el lienzo ya limpio, así que el juego pinta y ya está. Un juego de panel no
 *   lo trae; si necesita un bucle, usa `ctx.cadaFrame`.
 */

/**
 * Lo que recibe un juego al empezar una partida.
 *
 * Dos reglas duras, y las dos por la extensión, donde el pato vive sobre la
 * página de otra persona:
 *
 *   1. Un juego **nunca** escucha en `document` ni en `window`. Robarle las
 *      teclas a quien está leyendo una web es inaceptable. El teclado se
 *      engancha al propio `el`, con `tabindex="-1"` y `focus()`.
 *   2. Un juego **nunca** llama a `requestAnimationFrame`, `setInterval` ni
 *      `addEventListener` por su cuenta: usa `cadaFrame`, `cadaCierto` y
 *      `escuchar`. El pato se muda de pestaña continuamente y un bucle suelto
 *      se queda dando vueltas sobre un documento muerto.
 *
 * Y una medida: el tablero no debería pasar de **280 × 300 px**. Por encima, el
 * panel se coloca debajo del pato y entra en scroll.
 *
 * @typedef {Object} ContextoPartida
 * @property {Minijuego} juego
 * @property {'solo'|'turnos'} modo
 * @property {number} nivel            nivel del pato, por si el juego se ajusta
 * @property {string} yo               nombre de este pato
 * @property {string[]} jugadores      nombres en orden de turno, incluido `yo`.
 *   En 'solo' es `[yo]`, y el rival lo pone el propio juego (el pato).
 * @property {boolean} anfitrion       quién decide lo que se decide una sola vez
 *   (la palabra del ahorcado, quién empieza). En 'solo', siempre true.
 * @property {number} semilla          aleatoriedad compartida: los dos lados
 *   barajan igual sin mandarse la baraja entera.
 * @property {Object} marcas           progreso guardado de ESTE juego, de sólo
 *   lectura: se anota al terminar, no durante.
 * @property {Object} sprites          medidas y filas de cada hoja de diseño,
 *   `{ <skinId>: {frameW, frameH, animations: {<nombre>: {row, frames}}} }`.
 *   Para los juegos que dibujen mascotas —la memoria, el agujero—. Va aquí y no
 *   se lee de un fichero porque cómo se llega a los recursos lo decide la
 *   carcasa (ver core/assets.js). La IMAGEN se pide con `cargarSheet`, que sabe
 *   traerla también sobre una página con CSP estricto; ponerla de fondo con CSS
 *   la sometería al `img-src` de esa página y saldría en blanco.
 *
 * @property {Sala|null} sala          null en 'solo'
 * @property {Object|null} escenario   null salvo superficie 'escenario'
 *
 * @property {Object} sonido
 * @property {{animar:(estado:string, dur?:number)=>void}} pato
 *   Gestos del pato durante la partida ('happy' al ganar, 'play' al mover). Es
 *   una rendija estrecha a propósito: un juego no debe poder tocar al pato.
 * @property {(texto:string) => void} decir   cartelito ("te toca", "fallaste")
 *
 * @property {(r: ResultadoPartida) => void} alTerminar
 *   Se llama UNA vez por partida. A partir de ahí el marco pinta el pie con el
 *   resultado y la experiencia, y el tablero se queda como esté.
 *
 * @property {(fn:(dt:number)=>void) => (() => void)} cadaFrame
 * @property {(fn:Function, ms:number) => (() => void)} cadaCierto
 * @property {(objetivo:EventTarget, evento:string, fn:Function, op?:any) => void} escuchar
 * @property {(fn:Function) => void} alDestruir
 */

/**
 * @typedef {Object} ResultadoPartida
 * @property {'victoria'|'derrota'|'empate'} resultado
 *   No existe 'abandono': cerrar el panel no es un resultado. Si lo fuera,
 *   abrir y cerrar sería una fuente de partidas y, peor, en la extensión
 *   mudarse de pestaña anotaría una derrota fantasma cada vez.
 * @property {number} [puntos]   la marca del juego, si tiene (ver `marca`)
 * @property {string} [detalle]  una línea para el pie ("4 aciertos seguidos")
 */

/**
 * Lo que un juego usa de una sala. La sala entera la gobierna game/salas.js;
 * al juego sólo le hace falta esto.
 *
 * @typedef {Object} Sala
 * @property {(msg:Object) => void} enviar
 * @property {(cb:(msg:Object, de:string)=>void) => (() => void)} alRecibir
 * @property {(cb:(quien:string)=>void) => (() => void)} alIrseUnJugador
 */

// ---- Consultas -----------------------------------------------------------

/**
 * Cuánto del nombre de la mascota cabe en un título de juego.
 *
 * En Ajustes caben 24 caracteres, y «Cuackenstein el Grande dice» no entra en
 * una tarjeta ni en la cabecera de un panel. Se recorta aquí y no con CSS para
 * que se corte igual en los tres sitios donde sale.
 */
const TOPE_MASCOTA = 14;

/**
 * El nombre de un juego, ya con la mascota puesta.
 *
 * Casi todos tienen un nombre fijo y esto no les hace nada. El que lleve
 * `{mascota}` en el suyo se lo cambia por el nombre de la de casa.
 *
 * @param {Minijuego} juego
 * @param {string} [mascota]  lo que hay en Ajustes; `ctx.yo`, `presencia.yo`
 */
export function nombreDeJuego(juego, mascota) {
  if (!juego) return '';
  if (!juego.nombre.includes('{mascota}')) return juego.nombre;
  const suyo = String(mascota || '').trim() || 'Tu mascota';
  const corto = suyo.length > TOPE_MASCOTA ? `${suyo.slice(0, TOPE_MASCOTA - 1)}…` : suyo;
  return juego.nombre.replace('{mascota}', corto);
}

/** @param {string} id @returns {Minijuego|null} */
export function minijuegoPorId(id) {
  return MINIJUEGOS.find((j) => j.id === id) || null;
}

/** @param {Minijuego} juego @param {number} nivel */
export function estaDesbloqueado(juego, nivel) {
  return nivel >= juego.nivel;
}

/**
 * Los que se pueden jugar ya. El panel los enseña TODOS, con candado en los que
 * faltan; esto es para todo lo demás.
 */
export function juegosDisponibles(nivel) {
  return MINIJUEGOS.filter((j) => estaDesbloqueado(j, nivel));
}

/** @param {Minijuego} juego @param {'solo'|'turnos'} modo */
export function admiteModo(juego, modo) {
  return juego.modos.includes(modo);
}

/**
 * Trae el módulo de un juego.
 *
 * Es el único punto del proyecto donde se carga código a demanda: si algún día
 * una carcasa no lo permitiera, se arregla aquí y en ningún otro sitio.
 *
 * @param {string} id
 * @returns {Promise<ModuloMinijuego>}
 */
export function cargarMinijuego(id) {
  const juego = minijuegoPorId(id);
  if (!juego) return Promise.reject(new Error(`minijuego desconocido: ${id}`));
  return juego.cargar();
}
