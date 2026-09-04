// El peaje del «No tocar»: diez cuentas para poder irse.
//
// Pulsas «Salir» y no sales: sale una operación. La resuelves y sale otra, un
// poco más difícil. Diez veces. Eso es todo el chiste, y por eso vive aparte de
// broma.js: una cosa es el desorden de patos y otra es la puerta.
//
// Y no es un trámite: **hay reloj y fallar cuesta la tanda entera**. Cada cuenta
// tiene su tiempo, y quedarse sin él —o contestar mal— devuelve a la primera. Es
// a propósito, porque el peaje paga: pasarlo entero da cuacks (ver
// docs/MINIJUEGOS.md §Los cuacks), y un premio que se cobra sin riesgo no es un
// premio, es un peaje al revés.
//
// Lo que SÍ se mantiene:
//
//   1. **Todas se pueden resolver, y de una sola manera.** Aritmética, no
//      acertijos: nada de series, ni de trucos, ni de dos lecturas posibles. El
//      resultado es siempre un entero exacto —las raíces son de cuadrados
//      perfectos y las divisiones no dejan resto— así que la calculadora del
//      sistema basta y sobra.
//   2. **No se puede memorizar.** Los números salen al azar dentro de cada
//      nivel, y ADEMÁS el orden de los tipos se baraja en cada tanda: la cuesta
//      es siempre la misma —fácil, media, potencias— pero cuál toca dentro de
//      cada tramo, no.
//   3. **No hay que resolverlo para seguir jugando.** El botón de «Vale, sigo»
//      cierra el peaje y te devuelve a los patos. Sólo bloquea la salida
//      voluntaria.
//
// Y por debajo siguen estando las salidas que no se negocian, que son las que
// hacen que esto sea una broma y no un secuestro: el tope de diez minutos del
// escenario, el icono de la bandeja junto al reloj —esa franja nunca captura el
// ratón— y el apagado del pato.

/** Cuántas hay que resolver para que te deje en paz. */
export const CUENTAS = 10;

/**
 * Lo que se dice en cada una, en orden.
 *
 * Va subiendo de la reprimenda al hartazgo. Son diez porque son diez cuentas: si
 * se añade una, se añade su frase, que si no repetiría.
 */
const RECADOS = [
  'Te dije que no tocaras.',
  'Ya te avisé.',
  'No debiste hacer eso.',
  'Había un cartel. Lo ponía bien grande.',
  '¿Por qué tocas?',
  'Ponía «No tocar». En serio.',
  'Esto te lo has buscado tú solo.',
  'Y todavía quedan. Sigue.',
  'Ya queda menos. No te vengas arriba.',
  'La última. Y luego te dejo en paz.'
];

/** Lo que se contesta a un fallo. Ahora sí hay saña: se vuelve a empezar. */
const FALLOS = [
  'No. Otra vez desde la primera.',
  'Casi. Que no, vamos.',
  'Ni de lejos. Vuelta a empezar.',
  'Mal. Desde el principio.',
  'Que no. Y van…'
];

/** Y lo que se dice cuando se acaba el tiempo. */
const TARDE = [
  'Se acabó el tiempo. Desde la primera.',
  'Muy lento. Otra vez.',
  'Tic, tac. Vuelta a empezar.'
];

/**
 * Cuánto tiempo se da para cada cuenta, en segundos.
 *
 * Sube con la dificultad, que si no las últimas serían imposibles: para
 * `16³ + √1600 − 808` hay que ir a por la calculadora. Lo que aprieta no es el
 * reloj de una cuenta suelta, es que un despiste devuelve a la primera.
 */
export function segundosDeNivel(n) {
  return 7 + Math.max(0, Math.min(CUENTAS - 1, n)) * 2;
}

const entero = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

/**
 * Las diez cuentas, de menos a más.
 *
 * Cada una devuelve `{texto, resultado}` y los números salen al azar dentro de
 * su nivel, así que no hay nada que memorizar. Lo que importa es la CUESTA: se
 * empieza con `3 + 4` y se acaba con un cubo, una raíz y una resta en la misma
 * línea. Que la última sea desproporcionada no es un descuido, es el remate.
 *
 * Todo sale entero: los cuadrados de las raíces son perfectos y las divisiones
 * son exactas. Un peaje que además admita decimales sería otra broma distinta y
 * bastante peor.
 */
const CUENTAS_POR_NIVEL = [
  // 1-3: se hacen sin pensar. Es la parte en la que crees que va a ser rápido.
  () => { const a = entero(2, 9), b = entero(2, 9); return { texto: `${a} + ${b}`, resultado: a + b }; },
  () => { const a = entero(21, 79), b = entero(14, 68); return { texto: `${a} + ${b}`, resultado: a + b }; },
  () => { const a = entero(120, 480), b = entero(37, 99); return { texto: `${a} − ${b}`, resultado: a - b }; },

  // 4-6: ya hay que pararse.
  () => { const a = entero(12, 29), b = entero(4, 9); return { texto: `${a} × ${b}`, resultado: a * b }; },
  () => { const b = entero(7, 17), r = entero(13, 34); return { texto: `${b * r} ÷ ${b}`, resultado: r }; },
  () => { const a = entero(23, 79), b = entero(14, 38); return { texto: `${a} × ${b}`, resultado: a * b }; },

  // 7-10: potencias y raíces. Aquí ya es abuso, que es de lo que se trata.
  () => { const n = entero(12, 39); return { texto: `√${n * n}`, resultado: n }; },
  () => {
    const n = entero(17, 46);
    // Lo que se resta va acotado por el cuadrado: con `n` en el suelo del rango,
    // un `c` en el techo daba resultados NEGATIVOS —`17² − 399` es −110—. Se
    // resuelven igual, pero un peaje que de pronto pide un número con signo
    // parece un fallo, y encima admite escribirlo mal de tres maneras.
    const c = entero(84, Math.max(120, n * n - 60));
    return { texto: `${n}² − ${c}`, resultado: n * n - c };
  },
  () => {
    const n = entero(21, 48), m = entero(7, 19), c = entero(56, 480);
    return { texto: `√${n * n} × ${m} + ${c}`, resultado: n * m + c };
  },
  () => {
    const n = entero(11, 24), m = entero(23, 61), c = entero(137, 999);
    return { texto: `${n}³ + √${m * m} − ${c}`, resultado: n * n * n + m - c };
  }
];

/**
 * Los tramos de la cuesta. Dentro de cada uno se baraja; entre ellos, no.
 *
 * Así la dificultad sube siempre igual —tres fáciles, tres medias, tres de
 * potencias— pero cuál cae en cada puesto cambia en cada tanda, y no se puede
 * aprender la secuencia a base de repetirla. La última se queda fija: es el
 * remate, y un remate que a veces no sale no es un remate.
 */
const TRAMOS = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9]];

/**
 * Una tanda: qué cuenta toca en cada uno de los diez puestos.
 *
 * Se pide una nueva cada vez que se vuelve a empezar, así que ni siquiera
 * repetir el peaje diez veces enseña nada.
 */
export function nuevaTanda() {
  const orden = [];
  for (const tramo of TRAMOS) {
    const sueltos = tramo.slice();
    while (sueltos.length) {
      orden.push(sueltos.splice(Math.floor(Math.random() * sueltos.length), 1)[0]);
    }
  }
  return orden;
}

/** @returns {{texto:string, resultado:number}} */
export function cuentaDeNivel(n) {
  const hacer = CUENTAS_POR_NIVEL[Math.max(0, Math.min(CUENTAS_POR_NIVEL.length - 1, n))];
  return hacer();
}

/** El recado que toca. */
export function recadoDeNivel(n) {
  return RECADOS[Math.max(0, Math.min(RECADOS.length - 1, n))];
}

export function recadoDeFallo() {
  return FALLOS[Math.floor(Math.random() * FALLOS.length)];
}

/**
 * El panel del peaje.
 *
 * Se monta por encima del lienzo con `pista.panel`, así que ningún pato puede
 * taparlo por mucho que caigan. Devuelve `{el, tic, enfocar, cerrar}`; quien lo
 * abre decide cuándo se va, y le pasa el tiempo con `tic` en cada fotograma.
 *
 * El reloj va por `tic` y no por un `setInterval` propio a propósito: así se
 * para solo cuando se para la broma, y no hay un temporizador suelto que pueda
 * sobrevivir al cierre. Es la misma regla que el contrato les pone a los juegos.
 *
 * @param {(acertadas:number) => void} alTerminar  se llama al resolver las diez
 * @param {() => void} alRendirse                  cerrar sin resolverlas
 */
export function crearPeaje(alTerminar, alRendirse) {
  let tanda = nuevaTanda();
  let puesto = 0;
  let cuenta = cuentaDeNivel(tanda[0]);
  let queda = segundosDeNivel(0);
  /** Cuántas veces se ha vuelto a la primera. Sólo para poder decirlo. */
  let vueltas = 0;
  let vivo = true;

  const el = document.createElement('div');
  el.className = 'panel panel-peaje hot';

  const recado = document.createElement('p');
  recado.className = 'peaje-recado';

  const cuentaEl = document.createElement('p');
  cuentaEl.className = 'peaje-cuenta';

  const reloj = document.createElement('div');
  reloj.className = 'peaje-reloj';
  const relojBarra = document.createElement('div');
  relojBarra.className = 'peaje-reloj-barra';
  reloj.appendChild(relojBarra);

  const campo = document.createElement('input');
  campo.type = 'text';
  campo.inputMode = 'numeric';
  campo.autocomplete = 'off';
  campo.className = 'peaje-campo';

  const fila = document.createElement('div');
  fila.className = 'btn-row';
  const enviar = document.createElement('button');
  enviar.className = 'btn';
  enviar.type = 'button';
  enviar.textContent = 'Ya está';
  const dejarlo = document.createElement('button');
  dejarlo.className = 'btn';
  dejarlo.type = 'button';
  dejarlo.textContent = 'Vale, sigo';
  dejarlo.title = 'Cerrar esto y seguir con los patos';
  fila.append(enviar, dejarlo);

  const cuantas = document.createElement('p');
  cuantas.className = 'muted';

  el.append(recado, cuentaEl, reloj, campo, fila, cuantas);

  enviar.addEventListener('click', comprobar);
  dejarlo.addEventListener('click', () => { if (vivo) alRendirse(); });
  // El teclado se engancha al propio campo y no al documento, como manda el
  // contrato: aquí sólo se escuchan las teclas de quien está escribiendo.
  campo.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    comprobar();
  });

  pintar();

  return {
    el,
    /** Un fotograma de reloj. Lo llama quien abrió el peaje. */
    tic(dt) {
      if (!vivo) return;
      queda -= dt;
      if (queda <= 0) { volverAEmpezar(unoDe(TARDE)); return; }
      pintarReloj();
    },
    /** Hay que llamarlo DESPUÉS de montarlo: antes no se le puede dar el foco. */
    enfocar() { try { campo.focus(); campo.select(); } catch { /* da igual */ } },
    cerrar() { vivo = false; }
  };

  function comprobar() {
    if (!vivo) return;
    const dicho = Number(String(campo.value).trim().replace(',', '.'));
    if (!Number.isFinite(dicho) || dicho !== cuenta.resultado) {
      volverAEmpezar(unoDe(FALLOS));
      return;
    }

    puesto++;
    if (puesto >= CUENTAS) { vivo = false; alTerminar(puesto); return; }
    cuenta = cuentaDeNivel(tanda[puesto]);
    queda = segundosDeNivel(puesto);
    campo.value = '';
    pintar();
    campo.focus();
  }

  /**
   * A la primera otra vez, y con una tanda nueva.
   *
   * Lo de rebarajar es lo que hace que empezar de cero no sea repetir lo mismo:
   * si la secuencia fuera fija, volver a empezar sería una lata en vez de un
   * castigo, porque ya te la sabrías.
   */
  function volverAEmpezar(motivo) {
    if (!vivo) return;
    vueltas++;
    tanda = nuevaTanda();
    puesto = 0;
    cuenta = cuentaDeNivel(tanda[0]);
    queda = segundosDeNivel(0);
    campo.value = '';
    pintar();
    recado.textContent = motivo;
    recado.classList.add('mal');
    campo.focus();
  }

  function pintar() {
    recado.classList.remove('mal');
    recado.textContent = recadoDeNivel(puesto);
    cuentaEl.textContent = `${cuenta.texto} =`;
    cuantas.textContent = vueltas
      ? `${puesto} de ${CUENTAS}  ·  ${vueltas} ${vueltas === 1 ? 'vuelta' : 'vueltas'} a empezar`
      : `${puesto} de ${CUENTAS}`;
    pintarReloj();
  }

  function pintarReloj() {
    const total = segundosDeNivel(puesto);
    const parte = Math.max(0, Math.min(1, queda / total));
    relojBarra.style.width = `${parte * 100}%`;
    // Rojo en el último tercio: es cuando hay que mirarlo.
    relojBarra.classList.toggle('poco', parte < 0.34);
  }
}

function unoDe(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}
