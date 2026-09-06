// El suelo es lava: saltar de bloque en bloque antes de que se derritan.
//
// Del techo caen bloques que se quedan flotando un momento y **se van hundiendo
// porque la lava los derrite**. El que pisas baja más deprisa que los demás, así
// que quedarse quieto no es una opción: hay que ir saltando al siguiente. Se
// cuenta lo que aguantas.
//
// ---- Lo que estrena ---------------------------------------------------------
//
// Es el primero que pide **moverse en dos ejes**. Hasta ahora la mascota corría
// en el sitio (Runner), subía y bajaba (Flappy) o no se movía (Hook); aquí hay
// izquierda, derecha y salto, y las tres a la vez.
//
// Y trae lo único de verdad nuevo: **plataformas que se mueven**. Ahí hay un
// detalle de `pet/fisica.js` que decide medio juego:
//
//   > `paso()` empieza con `if (!vuelo.volando) return`.
//
// O sea que la física NO mueve a la mascota mientras está posada. Con un suelo
// fijo da igual; con un bloque que se hunde, no: si se dejara en manos de
// `paso`, la mascota se quedaría flotando en el aire mientras el bloque baja sin
// ella. Así que hay dos regímenes y se llevan a mano:
//
//   - **Posada**: la `y` de la mascota ES el techo del bloque, fotograma a
//     fotograma. Baja con él porque se la copia, no porque caiga.
//   - **En el aire**: manda `fisica.paso`, y el `suelo` que se le pasa no es el
//     de la ventana sino **el techo del bloque que tenga debajo**. Con eso el
//     aterrizaje, el bote y el `posado` salen gratis y son los de siempre.
//
// Si no hay bloque debajo, el suelo que se le pasa es la lava. Y ahí se acaba.

import { sembrar } from './azar.js';

/**
 * La física del salto.
 *
 * Es la del Runner: mucha gravedad y sin planeo. Un salto tiene que subir y
 * bajar YA, porque lo que se decide es dónde caes, y una mascota que se queda
 * flotando es una que no puedes colocar.
 */
function ajustesDeSalto(fisica) {
  return fisica.conAjustes({
    GRAVEDAD: 3000,
    ROZAMIENTO_AIRE: 0,
    PLANEO_UMBRAL: 0,
    REBOTE_SUELO: 0,
    REBOTE_PARED: 0,
    VELOCIDAD_REPOSO: 240   // alto: al tocar bloque se posa y ya, sin botar
  });
}

/** Lo que empuja un salto, y el empujón extra mientras se mantenga pulsado. */
const SALTO = 1150;
const SALTO_LARGO = 1900;
const SALTO_LARGO_MS = 165;
/** Con esto, el salto sube unos 220 px: la distancia entre bloques sale de ahí. */

/** Lo que corre de lado, y lo que se gobierna en el aire. */
const LATERAL = 540;
const LATERAL_AIRE = 0.85;

/** Lo que tarda un bloque en caer del techo hasta su altura. */
const CAIDA = 900;

/**
 * Lo que se hunde un bloque recién posado, en píxeles por segundo.
 *
 * Los cuatro números salen de una cuenta, no del gusto: lo que decide si esto es
 * un juego o una encerrona es **cuánto dura el bloque que estás pisando**. Con
 * los primeros —base 9, edad 3,2 y pisado ×4,5— el de salida, a 183 píxeles de la
 * lava, se hundía en **tres segundos**: medido, y no da tiempo ni a mirar dónde
 * saltar. Ahora dura unos seis, y uno vacío entre diez y dieciocho, que es el
 * margen para elegir en vez de reaccionar.
 */
const HUNDE_BASE = 7;
/** Y cuánto más por cada segundo que lleve flotando: nada dura. */
const HUNDE_POR_EDAD = 2;
/** Lo que multiplica tenerla encima. Es lo que impide quedarse quieto. */
const HUNDE_PISADO = 2.4;
/** Y cuánto más se hunde todo según avanza la partida: la cuesta. */
const HUNDE_POR_PARTIDA = 0.5;

/** Cada cuánto cae uno nuevo, y cuánto se aprieta con el tiempo. */
const INTERVALO = 1.15;
const INTERVALO_MINIMO = 0.72;
const INTERVALO_APRIETA = 0.006;

/** Cuántos puede haber a la vez. Más que esto es una alfombra, no un juego. */
const TOPE_BLOQUES = 9;

/**
 * Lo que el juego se da antes de cerrar.
 *
 * El préstamo del escenario corta a los diez minutos y lo hace SIN resultado
 * (ver `TOPE_PARTIDA_MS` en escenario.js). Aguantar ocho minutos y medio saltando
 * es una barbaridad, pero si alguien lo hace no puede perder la marca por buena.
 */
const PRESUPUESTO_MS = 8.5 * 60 * 1000;

/**
 * @param {import('./index.js').ContextoPartida} ctx
 * @returns {import('./index.js').Partida}
 */
export function crearPartida(ctx) {
  const pista = ctx.escenario;
  const { fisica, vuelo, pato, entrada } = pista;
  const azar = sembrar(ctx.semilla);
  const mejorPrevio = typeof ctx.marcas.mejor === 'number' ? ctx.marcas.mejor : null;

  pista.ajustes = ajustesDeSalto(fisica);

  let medidas = pista.medidas;
  /** La línea de la lava, en el marco del vuelo (crece hacia arriba). */
  let lava = medidas.suelo;

  /** @type {{x:number, ancho:number, alto:number, y:number, destino:number,
   *          cayendo:boolean, edad:number, pisado:boolean}[]} */
  const bloques = [];

  let transcurrido = 0;
  let vivo = 0;                 // segundos aguantados
  let hastaElSiguiente = 0.35;
  let saltando = false;
  let desdeElSalto = 0;
  let pulsadoAntes = false;
  let terminada = false;
  /** El bloque que se pisa ahora mismo, o null si se está en el aire. */
  let apoyo = null;
  /**
   * El último segundo que se pintó en el marcador.
   *
   * Aquí arriba y no al lado de `marcarSiCambia`, que es donde pediría el orden:
   * todo lo de abajo vive DESPUÉS del `return` de `crearPartida`, y ahí sólo se
   * izan las declaraciones de función. Un `let` ahí no se inicializa nunca.
   */
  let ultimoMarcado = -1;

  primerBloque();
  marcar();

  return { actualizar, destroy };

  function destroy() { terminada = true; }

  // ---- Un fotograma ------------------------------------------------------

  function actualizar(dt, p) {
    if (terminada) return;
    medidas = p.medidas;
    lava = medidas.suelo;

    transcurrido += dt * 1000;
    if (transcurrido >= PRESUPUESTO_MS) return acabar();

    vivo += dt;
    moverBloques(dt);
    soltarBloques(dt);
    mover(dt, p);

    if (vuelo.y <= lava + 2) return acabar();

    fisica.aplicar(pato, vuelo, p.ajustes);
    pintar(p);
    marcarSiCambia();
  }

  // ---- Los bloques -------------------------------------------------------

  /** El primero va debajo de la mascota, y ya posado: empezar cayendo es feo. */
  function primerBloque() {
    const ancho = medidas.patoAncho * 2.4;
    const x = medidas.ancho * 0.5 - ancho / 2;
    const y = lava + medidas.alto * 0.22;
    bloques.push(nuevoBloque(x, ancho, y, false));

    fisica.detenerVuelo(vuelo);
    vuelo.x = x + ancho / 2 - medidas.patoAncho / 2;
    vuelo.y = y;
    apoyo = bloques[0];
  }

  function nuevoBloque(x, ancho, destino, cayendo) {
    return {
      x,
      ancho,
      alto: Math.max(14, Math.min(30, medidas.alto * 0.028)),
      y: cayendo ? medidas.alto + 40 : destino,
      destino,
      cayendo,
      edad: 0,
      pisado: false
    };
  }

  function soltarBloques(dt) {
    hastaElSiguiente -= dt;
    if (hastaElSiguiente > 0) return;
    hastaElSiguiente = Math.max(INTERVALO_MINIMO, INTERVALO - vivo * INTERVALO_APRIETA);
    if (bloques.length >= TOPE_BLOQUES) return;

    // Estrechos según avanza, con suelo: por debajo de dos patos de ancho
    // aterrizar deja de ser una decisión y pasa a ser suerte.
    const anchoMax = medidas.patoAncho * Math.max(2, 3.4 - vivo * 0.012);
    const ancho = medidas.patoAncho * 2 + azar() * (anchoMax - medidas.patoAncho * 2);
    const x = azar() * Math.max(1, medidas.ancho - ancho);

    // La banda de alturas la marca el salto: sube unos 220 px, así que dos
    // bloques separados por más de eso serían dos islas sin puente.
    const bajo = lava + medidas.alto * 0.10;
    const alto = lava + medidas.alto * 0.52;
    bloques.push(nuevoBloque(x, ancho, bajo + azar() * (alto - bajo), true));
  }

  function moverBloques(dt) {
    for (let i = bloques.length - 1; i >= 0; i--) {
      const b = bloques[i];

      if (b.cayendo) {
        b.y -= CAIDA * dt;
        if (b.y <= b.destino) { b.y = b.destino; b.cayendo = false; }
        continue;
      }

      b.edad += dt;
      b.pisado = b === apoyo;
      const velocidad = (HUNDE_BASE + b.edad * HUNDE_POR_EDAD + vivo * HUNDE_POR_PARTIDA)
        * (b.pisado ? HUNDE_PISADO : 1);
      b.y -= velocidad * dt;

      // Tragado por la lava. Si era el que se pisaba, la mascota se queda en el
      // aire y cae: no hace falta matarla aquí, ya lo hará la lava.
      if (b.y + b.alto <= lava) {
        if (apoyo === b) apoyo = null;
        bloques.splice(i, 1);
      }
    }
  }

  /**
   * El bloque que hay justo debajo de los pies.
   *
   * Se mira el centro de la mascota y no su caja entera: con la caja, quedarse
   * con un pie fuera bastaría para seguir de pie, y entonces el borde de un
   * bloque deja de ser un borde.
   */
  function bloqueDebajo(pies) {
    const cx = vuelo.x + medidas.patoAncho / 2;
    let mejor = null;
    for (const b of bloques) {
      if (b.cayendo) continue;
      if (cx < b.x || cx > b.x + b.ancho) continue;
      if (b.y > pies + 1) continue;              // por encima de los pies: no sostiene
      if (!mejor || b.y > mejor.y) mejor = b;    // el más alto de los de abajo
    }
    return mejor;
  }

  // ---- La mascota --------------------------------------------------------

  function pidenSalto() {
    return entrada.pulsada(' ') || entrada.pulsada('Spacebar')
      || entrada.pulsada('ArrowUp') || entrada.pulsada('w') || entrada.pulsado;
  }

  function lado() {
    const izq = entrada.pulsada('ArrowLeft') || entrada.pulsada('a');
    const der = entrada.pulsada('ArrowRight') || entrada.pulsada('d');
    return (der ? 1 : 0) - (izq ? 1 : 0);
  }

  function mover(dt, p) {
    // ---- De lado, siempre a mano: `paso` mueve la x con `vx`, y aquí la x no
    // es física, es mando. Se deja `vx` a cero y se lleva a pelo.
    const dir = lado();
    const gobierno = apoyo ? 1 : LATERAL_AIRE;
    vuelo.x += dir * LATERAL * gobierno * dt;
    vuelo.x = Math.max(0, Math.min(medidas.ancho - medidas.patoAncho, vuelo.x));
    vuelo.vx = 0;
    if (dir) pato.setFacing(dir);

    const ahora = pidenSalto();
    const nuevo = ahora && !pulsadoAntes;
    pulsadoAntes = ahora;

    if (nuevo && apoyo) {
      saltando = true;
      desdeElSalto = 0;
      fisica.arrancarVuelo(vuelo, { x: vuelo.x, y: vuelo.y, vx: 0, vy: SALTO });
      apoyo = null;
      ctx.sonido.aleteo();
    }

    // Mientras se mantenga, y sólo un momento: es lo que separa un salto corto
    // de uno largo, y con bloques a distintas alturas eso es media partida.
    if (saltando && ahora && desdeElSalto < SALTO_LARGO_MS && vuelo.vy > 0) {
      vuelo.vy += SALTO_LARGO * dt;
    }
    desdeElSalto += dt * 1000;

    if (apoyo) { seguirAlBloque(); return; }
    caer(dt, p);
  }

  /**
   * Posada: la `y` ES la del bloque, copiada cada fotograma.
   *
   * Aquí está el motivo de que esto no lo lleve `fisica.paso`: `paso` no toca
   * nada mientras `volando` es falso, así que un bloque que se hunde dejaría a
   * la mascota flotando donde estaba.
   */
  function seguirAlBloque() {
    const cx = vuelo.x + medidas.patoAncho / 2;
    // Si se ha salido por el borde del bloque, deja de sostenerla.
    if (cx < apoyo.x || cx > apoyo.x + apoyo.ancho) {
      const otro = bloqueDebajo(vuelo.y);
      if (otro) { apoyo = otro; vuelo.y = otro.y; return; }
      apoyo = null;
      fisica.arrancarVuelo(vuelo, { x: vuelo.x, y: vuelo.y, vx: 0, vy: 0 });
      return;
    }
    vuelo.y = apoyo.y;
    pato.setTilt(0);
  }

  /** En el aire: manda la física, con el bloque de debajo haciendo de suelo. */
  function caer(dt, p) {
    const debajo = bloqueDebajo(vuelo.y);
    // Sin bloque, el suelo es la lava. No hay que matar a nadie a mano: se cae
    // hasta ahí y el fotograma siguiente lo ve.
    const suelo = debajo ? debajo.y : lava;

    const sucesos = fisica.paso(vuelo, dt, {
      ...p.limites(),
      izquierda: 0,
      derecha: Math.max(1, medidas.ancho - medidas.patoAncho),
      suelo
    }, p.ajustes);

    if (sucesos.posado && debajo) {
      apoyo = debajo;
      saltando = false;
      vuelo.y = debajo.y;
      ctx.sonido.nota(320, 0.04);
    }
  }

  // ---- Final -------------------------------------------------------------

  function acabar() {
    if (terminada) return;
    terminada = true;

    const segundos = Math.floor(vivo);
    const esRecord = segundos > 0 && (mejorPrevio === null || segundos > mejorPrevio);
    ctx.sonido[esRecord ? 'victoria' : 'derrota']();
    ctx.alTerminar({
      resultado: esRecord ? 'victoria' : 'derrota',
      puntos: segundos,
      detalle: detalleFinal(segundos, esRecord)
    });
  }

  function detalleFinal(segundos, esRecord) {
    const cola = esRecord
      ? (mejorPrevio === null ? ' A ver quién aguanta más.' : ` Récord nuevo: antes eran ${mejorPrevio}.`)
      : (mejorPrevio === null ? '' : ` Tu récord sigue en ${mejorPrevio}.`);
    return `${segundos} ${segundos === 1 ? 'segundo' : 'segundos'} sin tocar la lava.${cola}`;
  }

  function marcarSiCambia() {
    const s = Math.floor(vivo);
    if (s === ultimoMarcado) return;
    ultimoMarcado = s;
    marcar();
  }

  function marcar() {
    const base = `${Math.floor(vivo)} s  ·  ${bloques.length} bloques`;
    pista.marcador(mejorPrevio === null ? base : `${base}  ·  récord ${mejorPrevio} s`);
  }

  // ---- Pintado -----------------------------------------------------------

  function pintar(p) {
    const g = p.pintor;
    const suelo = p.aPantalla(lava);

    // La lava, del borde de abajo hasta su línea. Traslúcida como el resto: el
    // pato vive encima del escritorio de alguien.
    g.save();
    const alto = Math.max(0, medidas.alto - suelo);
    const degradado = g.createLinearGradient(0, suelo, 0, medidas.alto);
    degradado.addColorStop(0, 'rgba(255, 183, 3, 0.95)');
    degradado.addColorStop(1, 'rgba(193, 18, 31, 0.95)');
    g.fillStyle = degradado;
    g.fillRect(0, suelo, medidas.ancho, alto + 4);
    g.lineWidth = 3;
    g.strokeStyle = '#c1121f';
    g.beginPath();
    g.moveTo(0, suelo);
    g.lineTo(medidas.ancho, suelo);
    g.stroke();
    g.restore();

    for (const b of bloques) dibujarBloque(g, p, b);
  }

  function dibujarBloque(g, p, b) {
    const y = p.aPantalla(b.y + b.alto);
    const abajo = p.aPantalla(b.y);
    const suelo = p.aPantalla(lava);
    // Recortado por la lava: lo que ya se ha hundido no se ve, que es lo que
    // cuenta que se está derritiendo.
    const fondo = Math.min(abajo, suelo);
    if (fondo <= y) return;

    g.save();
    // Cuanto más viejo, más al rojo: se ve de un vistazo cuál está por irse.
    const calor = Math.min(1, b.edad / 7);
    g.fillStyle = b.cayendo
      ? '#8ecae6'
      : `rgb(${Math.round(138 + calor * 100)}, ${Math.round(90 - calor * 50)}, ${Math.round(59 - calor * 30)})`;
    g.fillRect(b.x, y, b.ancho, fondo - y);
    g.lineWidth = 3;
    g.strokeStyle = b.pisado ? '#ffb703' : '#2b2b3a';
    g.strokeRect(b.x, y, b.ancho, fondo - y);
    g.restore();
  }
}
