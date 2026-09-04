// «{mascota} Runner»: correr y saltar. El dinosaurio de Chrome, con tu mascota.
//
// La mascota corre en el sitio, el mundo pasa por detrás, y con la barra
// espaciadora salta lo que venga. Un botón y una sola decisión: cuándo.
//
// Es el más pequeño de los de escenario y el que menos inventa: la mascota no se
// mueve —lo que se mueve es el suelo— y saltar es un lanzamiento vertical con la
// misma física de siempre. Todo lo que hay que escribir de verdad es el desfile.
//
// Su gemelo es «Flappy {mascota}»: el mismo juego con la gravedad cambiada de
// bando. Si se escribe, conviene mirar aquí primero.

import { sembrar } from './azar.js';

/**
 * La física del salto.
 *
 * Mucha más gravedad que la del pato suelto, y sin planeo. Un salto tiene que
 * subir y bajar YA: en un juego de reflejos, un pato que se queda flotando es un
 * pato que no puedes colocar donde quieres. Con estos números el salto dura
 * poco más de medio segundo, que a la velocidad de salida son unos 380 px.
 */
function ajustesDeCarrera(fisica) {
  return fisica.conAjustes({
    GRAVEDAD: 3400,
    ROZAMIENTO_AIRE: 0,
    PLANEO_UMBRAL: 0,
    REBOTE_SUELO: 0,
    VELOCIDAD_REPOSO: 240   // alto: al tocar suelo se posa y ya, sin botar
  });
}

/** Lo que empuja un salto. */
const SALTO = 1180;
/**
 * Un empujón extra mientras se mantenga pulsado, y hasta cuándo.
 *
 * Es lo que separa un salto corto de uno largo, y es media profundidad del
 * juego: sin esto, todos los saltos son iguales y sólo se decide el instante.
 */
const SALTO_LARGO = 2100;
const SALTO_LARGO_MS = 170;

/** Dónde corre la mascota, en tanto por uno del ancho. */
const CARRIL = 0.16;

/** Velocidad de salida y cuánto acelera por metro, con tope. */
const VELOCIDAD = 560;
const ACELERA = 0.34;
const VELOCIDAD_MAX = 1250;

/** Píxeles por metro. Sólo sirve para que el marcador diga algo humano. */
const POR_METRO = 34;

/** A partir de cuántos metros empiezan a aparecer gaviotas. */
const GAVIOTAS_DESDE = 320;

/**
 * @param {import('./index.js').ContextoPartida} ctx
 * @returns {import('./index.js').Partida}
 */
export function crearPartida(ctx) {
  const pista = ctx.escenario;
  const { fisica, vuelo, pato, entrada } = pista;
  const azar = sembrar(ctx.semilla);
  const mejorPrevio = typeof ctx.marcas.mejor === 'number' ? ctx.marcas.mejor : null;

  pista.ajustes = ajustesDeCarrera(fisica);

  const m0 = pista.medidas;
  const carril = m0.ancho * CARRIL;

  /** @type {{x:number, ancho:number, alto:number, sobreElSuelo:number, tipo:string}[]} */
  const cosas = [];

  let metros = 0;
  let velocidad = VELOCIDAD;
  let hastaElSiguiente = m0.ancho * 0.75;   // el primero, con margen para mirar
  let saltando = false;
  let desdeElSalto = 0;
  let pulsadoAntes = false;
  let terminada = false;

  // Se arranca posada en el suelo: el vuelo se usa SÓLO para la altura, así que
  // la x no se toca en toda la partida.
  fisica.detenerVuelo(vuelo);
  vuelo.x = carril;
  vuelo.y = m0.suelo;
  colocar();
  marcar();

  return { actualizar, destroy };

  function destroy() { terminada = true; }

  // ---- Un fotograma ------------------------------------------------------

  function actualizar(dt, p) {
    if (terminada) return;
    const medidas = p.medidas;

    avanzar(dt, medidas);
    saltar(dt, p);
    if (chocado()) return acabar();

    colocar();
    pintar(p, medidas);
  }

  // ---- El mundo que pasa -------------------------------------------------

  function avanzar(dt, medidas) {
    velocidad = Math.min(VELOCIDAD_MAX, VELOCIDAD + metros * ACELERA);
    const paso = velocidad * dt;
    metros += paso / POR_METRO;

    for (const c of cosas) c.x -= paso;
    while (cosas.length && cosas[0].x + cosas[0].ancho < -20) cosas.shift();

    hastaElSiguiente -= paso;
    if (hastaElSiguiente <= 0) {
      soltarObstaculo(medidas);
      hastaElSiguiente = separacion();
    }
    marcar();
  }

  /**
   * Cuánto sitio se deja hasta el siguiente.
   *
   * Se mide en TIEMPO y no en píxeles: a mil doscientos por segundo, una
   * separación fija de cuatrocientos píxeles es medio salto y no se llega. Así
   * el hueco crece con la velocidad y el juego sigue siendo justo cuando se
   * pone rápido.
   */
  function separacion() {
    // Y se aprieta con los metros. Sin esto el juego no se endurece nunca: la
    // separación en tiempo era fija, así que a mil doscientos por segundo se
    // jugaba al mismo ritmo que al empezar, sólo que con el fondo pasando más
    // rápido. Lo que cambia es el compás, no sólo la velocidad.
    const aprieta = Math.min(0.34, metros / 7000);
    const segundos = (0.95 - aprieta) + azar() * (0.85 - aprieta * 0.6);
    return velocidad * segundos;
  }

  function soltarObstaculo(medidas) {
    const alto = m0.patoAlto;
    // Una gaviota a la altura de la cabeza: la única que NO se salta, se deja
    // pasar. Es lo que hace que el botón tenga dos respuestas y no una.
    if (metros > GAVIOTAS_DESDE && azar() < 0.22) {
      cosas.push({
        x: medidas.ancho + 20,
        ancho: alto * 0.42,
        alto: alto * 0.3,
        sobreElSuelo: alto * 0.62,
        tipo: 'gaviota'
      });
      return;
    }

    // Cactus: bajo, alto o doble. El doble es más ancho, no más alto: castiga
    // saltar tarde, que es distinto de castigar saltar bajo.
    const suerte = azar();
    const grande = suerte > 0.62;
    const doble = suerte > 0.86;
    cosas.push({
      x: medidas.ancho + 20,
      ancho: alto * (doble ? 0.5 : 0.26),
      alto: alto * (grande ? 0.52 : 0.36),
      sobreElSuelo: 0,
      tipo: doble ? 'doble' : 'cactus'
    });
  }

  // ---- El salto ----------------------------------------------------------

  function enElSuelo() { return !vuelo.volando || vuelo.y <= m0.suelo + 0.5; }

  function pidenSalto() {
    return entrada.pulsada(' ') || entrada.pulsada('Spacebar') || entrada.pulsado;
  }

  function saltar(dt, p) {
    const ahora = pidenSalto();
    const nuevo = ahora && !pulsadoAntes;
    pulsadoAntes = ahora;

    if (nuevo && enElSuelo()) {
      saltando = true;
      desdeElSalto = 0;
      fisica.arrancarVuelo(vuelo, { x: carril, y: m0.suelo, vx: 0, vy: SALTO });
      ctx.sonido.aleteo();
    }

    // Mientras se mantenga, y sólo un momento: así se decide lo alto que se
    // salta sin que un botón pegado convierta el juego en volar.
    if (saltando && ahora && desdeElSalto < SALTO_LARGO_MS && vuelo.vy > 0) {
      vuelo.vy += SALTO_LARGO * dt;
    }
    desdeElSalto += dt * 1000;

    const sucesos = fisica.paso(vuelo, dt, { ...p.limites(), izquierda: carril, derecha: carril },
      p.ajustes);
    if (sucesos.posado) saltando = false;
    // La x no la toca nadie: el mundo se mueve, la mascota no.
    vuelo.x = carril;
  }

  // ---- Choques -----------------------------------------------------------

  /**
   * El cuerpo de la mascota es un círculo y los obstáculos rectángulos, así que
   * se mide la distancia del centro al rectángulo. Es exacto y son cuatro
   * líneas; un test de caja contra caja daría muertes injustas por las esquinas.
   */
  function chocado() {
    const cuerpo = pato.cuerpo();
    // Un pelín más pequeño que el dibujo: en un juego de reflejos, morir por dos
    // píxeles de pluma se siente como una trampa.
    const radio = cuerpo.radio * 0.82;

    for (const c of cosas) {
      if (c.x > cuerpo.cx + radio) break;             // vienen ordenados
      if (c.x + c.ancho < cuerpo.cx - radio) continue;
      const arriba = pista.aPantalla(m0.suelo + c.sobreElSuelo + c.alto);
      const abajo = pista.aPantalla(m0.suelo + c.sobreElSuelo);
      const px = Math.max(c.x, Math.min(cuerpo.cx, c.x + c.ancho));
      const py = Math.max(arriba, Math.min(cuerpo.cy, abajo));
      if (Math.hypot(cuerpo.cx - px, cuerpo.cy - py) <= radio) return true;
    }
    return false;
  }

  // ---- Final -------------------------------------------------------------

  function acabar() {
    if (terminada) return;
    terminada = true;
    const recorridos = Math.floor(metros);
    const esRecord = recorridos > 0 && (mejorPrevio === null || recorridos > mejorPrevio);
    pato.setState('sad');
    ctx.sonido[esRecord ? 'victoria' : 'derrota']();
    marcar();
    ctx.alTerminar({
      resultado: esRecord ? 'victoria' : 'derrota',
      puntos: recorridos,
      detalle: detalleFinal(recorridos, esRecord)
    });
  }

  function detalleFinal(recorridos, esRecord) {
    const cuenta = `${recorridos} m`;
    if (esRecord) {
      return mejorPrevio === null
        ? `${cuenta}. A ver quién lo mejora.`
        : `${cuenta}. Récord nuevo: antes eran ${mejorPrevio}.`;
    }
    return mejorPrevio === null ? `${cuenta}.` : `${cuenta}. Tu récord sigue en ${mejorPrevio}.`;
  }

  function marcar() {
    const m = Math.floor(metros);
    pista.marcador(mejorPrevio === null ? `${m} m` : `${m} m  ·  récord ${mejorPrevio}`);
  }

  // ---- Pintado -----------------------------------------------------------

  /** La mascota corre en el sitio: sólo se le toca la altura y el gesto. */
  function colocar() {
    pato.setX(carril);
    pato.setY(vuelo.y);
    pato.setTilt(0);
    pato.setFacing(1);
    pato.setState(enElSuelo() ? 'walk' : 'flap');
  }

  function pintar(p, medidas) {
    const g = p.pintor;
    const ySuelo = p.aPantalla(m0.suelo);

    // El suelo, con marcas que pasan: sin algo que se mueva de fondo no se nota
    // que la mascota corre, parece que sólo vienen cactus.
    g.strokeStyle = 'rgba(43, 43, 58, 0.55)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, ySuelo);
    g.lineTo(medidas.ancho, ySuelo);
    g.stroke();

    const paso = 96;
    const desfase = (metros * POR_METRO) % paso;
    g.lineWidth = 2;
    g.strokeStyle = 'rgba(43, 43, 58, 0.22)';
    g.beginPath();
    for (let x = medidas.ancho - desfase; x > -paso; x -= paso) {
      g.moveTo(x, ySuelo + 7);
      g.lineTo(x + 26, ySuelo + 7);
    }
    g.stroke();

    for (const c of cosas) dibujar(g, c, p);
  }

  function dibujar(g, c, p) {
    const abajo = p.aPantalla(m0.suelo + c.sobreElSuelo);
    const arriba = abajo - c.alto;

    if (c.tipo === 'gaviota') {
      // Dos trazos y ya: a esta escala una gaviota es su silueta.
      g.strokeStyle = '#2b2b3a';
      g.lineWidth = 3;
      g.beginPath();
      const cx = c.x + c.ancho / 2;
      const cy = arriba + c.alto / 2;
      g.moveTo(c.x, cy);
      g.quadraticCurveTo(cx - c.ancho * 0.2, cy - c.alto * 0.7, cx, cy);
      g.quadraticCurveTo(cx + c.ancho * 0.2, cy - c.alto * 0.7, c.x + c.ancho, cy);
      g.stroke();
      return;
    }

    g.fillStyle = '#35a34a';
    g.strokeStyle = '#2b2b3a';
    g.lineWidth = 3;
    const tronco = c.tipo === 'doble' ? c.ancho * 0.34 : c.ancho;
    caja(g, c.x, arriba, tronco, c.alto);
    if (c.tipo === 'doble') {
      caja(g, c.x + c.ancho - tronco, arriba + c.alto * 0.18, tronco, c.alto * 0.82);
    } else {
      // Un brazo, para que no sea un poste verde.
      caja(g, c.x - tronco * 0.55, arriba + c.alto * 0.34, tronco * 0.55, c.alto * 0.12);
      caja(g, c.x - tronco * 0.55, arriba + c.alto * 0.34, tronco * 0.4, c.alto * 0.4);
    }
  }

  function caja(g, x, y, w, h) {
    g.beginPath();
    const r = Math.min(6, w / 2, h / 2);
    if (g.roundRect) g.roundRect(x, y, w, h, r);
    else g.rect(x, y, w, h);
    g.fill();
    g.stroke();
  }
}
