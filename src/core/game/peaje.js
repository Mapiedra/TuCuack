// El peaje del «No tocar»: diez cuentas para poder irse.
//
// Pulsas «Salir» y no sales: sale una operación. La resuelves y sale otra, un
// poco más difícil. Diez veces. Eso es todo el chiste, y por eso vive aparte de
// broma.js: una cosa es el desorden de patos y otra es la puerta.
//
// Dos reglas que lo mantienen del lado de la broma y no del secuestro:
//
//   1. **Todas se pueden resolver.** Nada de acertijos ni de números de ocho
//      cifras: aritmética de cabeza o de calculadora, subiendo despacio.
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
 * Cada una devuelve `{texto, resultado}`. El orden de dificultad importa más que
 * los números concretos: se empieza con algo que se hace sin pensar y se acaba
 * con algo que hay que apuntar, pero nunca con algo imposible.
 */
const CUENTAS_POR_NIVEL = [
  () => { const a = entero(2, 9), b = entero(2, 9); return { texto: `${a} + ${b}`, resultado: a + b }; },
  () => { const a = entero(11, 29), b = entero(4, 19); return { texto: `${a} + ${b}`, resultado: a + b }; },
  () => { const a = entero(12, 40), b = entero(3, 11); return { texto: `${a} − ${b}`, resultado: a - b }; },
  () => { const a = entero(3, 9), b = entero(3, 9); return { texto: `${a} × ${b}`, resultado: a * b }; },
  () => { const b = entero(3, 9), r = entero(3, 12); return { texto: `${b * r} ÷ ${b}`, resultado: r }; },
  () => { const a = entero(11, 19), b = entero(3, 9); return { texto: `${a} × ${b}`, resultado: a * b }; },
  () => {
    const a = entero(6, 14), b = entero(4, 9), c = entero(5, 30);
    return { texto: `${a} × ${b} + ${c}`, resultado: a * b + c };
  },
  () => { const a = entero(12, 29), b = entero(11, 19); return { texto: `${a} × ${b}`, resultado: a * b }; },
  () => {
    const b = entero(4, 12), r = entero(6, 15), k = entero(2, 4);
    return { texto: `${b * r} ÷ ${b} × ${k}`, resultado: r * k };
  },
  () => {
    const a = entero(14, 24), b = entero(12, 18), c = entero(20, 99);
    return { texto: `(${a} × ${b}) − ${c}`, resultado: a * b - c };
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
