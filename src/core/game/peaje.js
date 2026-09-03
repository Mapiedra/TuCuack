// El peaje del «No tocar»: diez cuentas para poder irse.
//
// Pulsas «Salir» y no sales: sale una operación. La resuelves y sale otra, un
// poco más difícil. Diez veces. Eso es todo el chiste, y por eso vive aparte de
// broma.js: una cosa es el desorden de patos y otra es la puerta.
//
// Dos reglas que lo mantienen del lado de la broma y no del secuestro:
//
//   1. **Todas se pueden resolver, y de una sola manera.** Aritmética, no
//      acertijos: nada de series, ni de trucos, ni de dos lecturas posibles. El
//      resultado es siempre un entero exacto —las raíces son de cuadrados
//      perfectos y las divisiones no dejan resto— así que la calculadora del
//      sistema basta y sobra. Las tres primeras se hacen de cabeza; las tres
//      últimas, no, y eso también es el chiste.
//   2. **Fallar no castiga.** Se repite LA MISMA cuenta, no vuelve a empezar y
//      no hay reloj. Equivocarse cuesta otro intento, no la partida.
//
// Y por debajo siguen estando las salidas que no se negocian: el tope de diez
// minutos del escenario, el apagado del pato y el fallo del propio juego.

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

/** Lo que se contesta a un fallo. Sin saña: se repite la misma cuenta. */
const FALLOS = ['No.', 'Casi.', 'Ni de lejos.', 'Otra vez.', 'Que no.'];

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
    const n = entero(17, 46), c = entero(84, 399);
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
 * taparlo por mucho que caigan. Devuelve `{el, cerrar}`; quien lo abre decide
 * cuándo se va.
 *
 * @param {(acertadas:number) => void} alTerminar  se llama al resolver las diez
 * @param {() => void} alRendirse                  cerrar sin resolverlas
 */
export function crearPeaje(alTerminar, alRendirse) {
  let nivel = 0;
  let cuenta = cuentaDeNivel(0);
  let vivo = true;

  const el = document.createElement('div');
  el.className = 'panel panel-peaje hot';

  const recado = document.createElement('p');
  recado.className = 'peaje-recado';

  const cuentaEl = document.createElement('p');
  cuentaEl.className = 'peaje-cuenta';

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

  el.append(recado, cuentaEl, campo, fila, cuantas);

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
    /** Hay que llamarlo DESPUÉS de montarlo: antes no se le puede dar el foco. */
    enfocar() { try { campo.focus(); campo.select(); } catch { /* da igual */ } },
    cerrar() { vivo = false; }
  };

  function comprobar() {
    if (!vivo) return;
    const dicho = Number(String(campo.value).trim().replace(',', '.'));
    if (!Number.isFinite(dicho) || dicho !== cuenta.resultado) {
      recado.textContent = recadoDeFallo();
      recado.classList.add('mal');
      campo.value = '';
      campo.focus();
      return;
    }

    nivel++;
    if (nivel >= CUENTAS) { vivo = false; alTerminar(nivel); return; }
    cuenta = cuentaDeNivel(nivel);
    campo.value = '';
    pintar();
    campo.focus();
  }

  function pintar() {
    recado.classList.remove('mal');
    recado.textContent = recadoDeNivel(nivel);
    cuentaEl.textContent = `${cuenta.texto} =`;
    cuantas.textContent = `${nivel} de ${CUENTAS}`;
  }
}
