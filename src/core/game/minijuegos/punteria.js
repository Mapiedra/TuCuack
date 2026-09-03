// Puntería: lanzar a la mascota contra las dianas.
//
// Es el otro juego de escenario, y el reverso de la paleta. Allí la mascota está
// siempre en el aire y tú reaccionas; aquí no se mueve nada hasta que sueltas, y
// lo que se juega es la decisión anterior al disparo.
//
// Lo que lo hace del pato y no de cualquier juego: se dispara con el MISMO
// lanzamiento con el que se le tira estando quieto —`limitarLanzamiento` y
// `arrancarVuelo`, tal cual—, así que quien ya sabe lanzar a su mascota por la
// pantalla ya sabe jugar. Lo único que cambia son los números.

import { sembrar } from './azar.js';

/**
 * La física de los disparos.
 *
 * Sin PLANEO, como en la paleta y por lo mismo: el aleteo convierte una parábola
 * en un descenso a velocidad fija, que está muy bien para aterrizar suave y muy
 * mal para apuntar. Aquí la parábola tiene que ser honrada, porque es lo que se
 * está leyendo al apuntar.
 *
 * Las paredes devuelven bastante a propósito: un tiro de banda es la jugada
 * bonita de este juego.
 */
function ajustesDeTiro(fisica) {
  return fisica.conAjustes({
    GRAVEDAD: 1500,
    ROZAMIENTO_AIRE: 0.3,
    PLANEO_UMBRAL: 0,
    REBOTE_PARED: 0.72,
    REBOTE_SUELO: 0.36,
    REBOTE_TECHO: 0.45
  });
}

const DIANAS = 5;
const DISPAROS = 6;

const PUNTOS_DIANA = 10;
const PUNTOS_CENTRO = 25;
/** Lo que vale cada disparo que sobre al limpiarlas todas. */
const PUNTOS_SOBRANTE = 5;
/** Qué parte del radio de la diana cuenta como centro. */
const CENTRO = 0.36;

/** Lo que se espera entre un disparo y el siguiente, para ver dónde ha caído. */
const RESPIRO_MS = 550;
/** Tope por disparo: una mascota rebotando entre dos paredes no acaba sola. */
const DISPARO_MAX_MS = 7000;

/** Cuánto de la pantalla hay que arrastrar para el lanzamiento más fuerte. */
const ALCANCE = 0.45;
/** Lo que se enseña de la trayectoria al apuntar: la salida, no el final. */
const PREVIO_S = 0.4;
const PREVIO_PASO_S = 1 / 60;

/**
 * @param {import('./index.js').ContextoPartida} ctx
 * @returns {import('./index.js').Partida}
 */
export function crearPartida(ctx) {
  const pista = ctx.escenario;
  const { fisica, vuelo, pato, entrada } = pista;

  const mejorPrevio = typeof ctx.marcas.mejor === 'number' ? ctx.marcas.mejor : null;

  /** 'apuntando' | 'volando' | 'espera' | 'fin' */
  let fase = 'apuntando';
  let disparo = 1;
  let puntos = 0;
  let terminada = false;
  let pulsadoAntes = false;
  let tiempoDeVuelo = 0;
  let espera = 0;
  /** El centro del cuerpo en el fotograma anterior, para no perder un impacto. */
  let anterior = null;

  pista.ajustes = ajustesDeTiro(fisica);

  const medidas0 = pista.medidas;
  const salida = {
    x: Math.max(0, medidas0.ancho * 0.1),
    y: medidas0.suelo
  };
  /** @type {{x:number, y:number, radio:number, viva:boolean}[]} */
  const dianas = repartirDianas(medidas0, ctx.semilla);

  colocarEnLaSalida();
  marcar();

  return { actualizar, destroy };

  function destroy() { terminada = true; }

  // ---- Un fotograma ------------------------------------------------------

  function actualizar(dt, p) {
    if (terminada) return;
    const medidas = p.medidas;

    if (fase === 'espera') {
      espera -= dt * 1000;
      if (espera <= 0) siguienteDisparo();
      pintar(p, medidas);
      return;
    }

    if (fase === 'apuntando') {
      apuntar(medidas);
      pintar(p, medidas);
      return;
    }

    volar(dt, p, medidas);
    pintar(p, medidas);
  }

  // ---- Apuntar -----------------------------------------------------------

  function apuntar(medidas) {
    const tiro = tiroDelCursor(medidas);
    // Mirando a donde va a salir: apuntar de espaldas quedaría raro.
    pato.setFacing(tiro.vx >= 0 ? 1 : -1);

    // Se dispara al SOLTAR, no al pulsar: así se puede corregir la puntería sin
    // gastar el disparo, que es de lo que va el juego.
    if (pulsadoAntes && !entrada.pulsado) {
      pulsadoAntes = false;
      lanzar(tiro);
      return;
    }
    pulsadoAntes = entrada.pulsado;
  }

  /**
   * A dónde iría el disparo con el cursor donde está ahora.
   *
   * Se apunta HACIA el cursor, no en contra: un tirachinas invertido se entiende
   * en un juego de móvil donde se ve la goma, y aquí lo que se ve es una mascota
   * quieta en el suelo. La fuerza sale de lo lejos que esté el cursor, medida
   * contra el ancho de la pantalla para que valga igual en un monitor grande que
   * en el panel lateral.
   */
  function tiroDelCursor(medidas) {
    const cuerpo = pato.cuerpo();
    const dx = entrada.x - cuerpo.cx;
    const dy = entrada.y - cuerpo.cy;
    const k = pista.ajustes.LANZAMIENTO_MAX / Math.max(1, medidas.ancho * ALCANCE);
    // La Y de la pantalla crece hacia abajo y la del vuelo hacia arriba.
    return fisica.limitarLanzamiento(dx * k, -dy * k, pista.ajustes);
  }

  function lanzar(tiro) {
    fase = 'volando';
    tiempoDeVuelo = 0;
    anterior = null;
    fisica.arrancarVuelo(vuelo, { x: salida.x, y: salida.y, vx: tiro.vx, vy: tiro.vy });
    ctx.sonido.boing(0.7);
  }

  // ---- Volar -------------------------------------------------------------

  function volar(dt, p, medidas) {
    tiempoDeVuelo += dt * 1000;

    const sucesos = fisica.paso(vuelo, dt, p.limites(), p.ajustes);
    if (sucesos.pared) ctx.sonido.boing(Math.min(0.5, sucesos.pared));
    fisica.aplicar(pato, vuelo, p.ajustes);

    mirarImpactos(medidas);

    // El disparo acaba cuando la mascota se para. Los botes no cuentan: un tiro
    // de banda que acaba entrando es la mejor jugada que tiene este juego.
    if (sucesos.posado || tiempoDeVuelo > DISPARO_MAX_MS) {
      anterior = null;
      if (dianas.every((d) => !d.viva)) return acabar();
      if (disparo >= DISPAROS) return acabar();
      fase = 'espera';
      espera = RESPIRO_MS;
    }
  }

  function mirarImpactos(medidas) {
    const cuerpo = pato.cuerpo();
    const desde = anterior;
    anterior = { x: cuerpo.cx, y: cuerpo.cy };

    for (const d of dianas) {
      if (!d.viva) continue;
      const dy = pista.aPantalla(d.y);
      // Con el tramo recorrido y no sólo con la posición de ahora: a mil píxeles
      // por segundo, entre dos fotogramas se cruza una diana entera sin tocarla
      // en ninguno de los dos.
      const dist = desde
        ? distanciaASegmento(d.x, dy, desde.x, desde.y, cuerpo.cx, cuerpo.cy)
        : Math.hypot(d.x - cuerpo.cx, dy - cuerpo.cy);
      if (dist > d.radio + cuerpo.radio) continue;

      d.viva = false;
      const enElCentro = dist <= d.radio * CENTRO;
      puntos += enElCentro ? PUNTOS_CENTRO : PUNTOS_DIANA;
      ctx.sonido.nota(enElCentro ? 1046 : 784, 0.14);
      if (enElCentro) ctx.sonido.nota(1318, 0.16);
      marcar();
    }
  }

  // ---- Entre disparos ----------------------------------------------------

  function siguienteDisparo() {
    disparo++;
    fase = 'apuntando';
    pulsadoAntes = entrada.pulsado;   // no dispara solo si se llegó soltando
    colocarEnLaSalida();
    marcar();
  }

  function colocarEnLaSalida() {
    fisica.detenerVuelo(vuelo);
    vuelo.x = salida.x;
    vuelo.y = salida.y;
    pato.setX(salida.x);
    pato.setY(salida.y);
    pato.setTilt(0);
    pato.setState('idle');
  }

  // ---- Final -------------------------------------------------------------

  function acabar() {
    if (terminada) return;
    terminada = true;

    const quedan = dianas.filter((d) => d.viva).length;
    // Lo que sobra al limpiarlas todas vale puntos: si no, no habría diferencia
    // entre acertar a la primera y acertar con el último disparo.
    if (!quedan) puntos += (DISPAROS - disparo) * PUNTOS_SOBRANTE;

    const esRecord = puntos > 0 && (mejorPrevio === null || puntos > mejorPrevio);
    marcar();
    ctx.sonido[quedan ? 'derrota' : 'victoria']();
    ctx.alTerminar({
      resultado: quedan ? 'derrota' : 'victoria',
      puntos,
      detalle: detalleFinal(quedan, esRecord)
    });
  }

  function detalleFinal(quedan, esRecord) {
    const cuenta = `${puntos} puntos`;
    const cola = esRecord
      ? (mejorPrevio === null ? ' A ver quién lo mejora.' : ` Récord nuevo: antes eran ${mejorPrevio}.`)
      : (mejorPrevio === null ? '' : ` Tu récord sigue en ${mejorPrevio}.`);
    if (!quedan) return `Todas. ${cuenta}.${cola}`;
    const faltan = quedan === 1 ? 'Quedó una diana' : `Quedaron ${quedan} dianas`;
    return `${faltan}. ${cuenta}.${cola}`;
  }

  function marcar() {
    const base = `Disparo ${Math.min(disparo, DISPAROS)}/${DISPAROS}  ·  ${puntos} pts`;
    pista.marcador(mejorPrevio === null ? base : `${base}  ·  récord ${mejorPrevio}`);
  }

  // ---- Pintado -----------------------------------------------------------

  function pintar(p, medidas) {
    const g = p.pintor;

    for (const d of dianas) dibujarDiana(g, d, p.aPantalla(d.y));

    if (fase !== 'apuntando') return;
    dibujarPrevia(g, p, medidas);
  }

  function dibujarDiana(g, d, y) {
    g.save();
    if (!d.viva) g.globalAlpha = 0.18;

    g.beginPath();
    g.arc(d.x, y, d.radio, 0, Math.PI * 2);
    g.fillStyle = '#fffdf7';
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = '#2b2b3a';
    g.stroke();

    g.beginPath();
    g.arc(d.x, y, d.radio * 0.62, 0, Math.PI * 2);
    g.strokeStyle = '#fb8500';
    g.stroke();

    g.beginPath();
    g.arc(d.x, y, d.radio * CENTRO, 0, Math.PI * 2);
    g.fillStyle = '#c1121f';
    g.fill();
    g.restore();
  }

  /**
   * La salida del disparo, en puntos.
   *
   * Se simula con la MISMA física sobre un vuelo de usar y tirar, así que lo que
   * se ve es exactamente lo que va a pasar. Y se enseña sólo el principio: con
   * la parábola entera dibujada esto dejaría de ser un juego de puntería y
   * pasaría a ser uno de seguir una línea.
   */
  function dibujarPrevia(g, p, medidas) {
    const tiro = tiroDelCursor(medidas);
    const ensayo = fisica.crearVuelo();
    fisica.arrancarVuelo(ensayo, { x: salida.x, y: salida.y, vx: tiro.vx, vy: tiro.vy });

    const limites = p.limites();
    const pasos = Math.round(PREVIO_S / PREVIO_PASO_S);

    // El vuelo dice dónde está la ESQUINA de la mascota y el cuerpo dónde su
    // centro; los puntos salen del centro, así que se guarda la diferencia una
    // vez y se le suma a cada paso.
    const centro = pato.cuerpo();
    const dx = centro.cx - vuelo.x;
    const dy = centro.cy - p.aPantalla(vuelo.y);

    g.save();
    g.fillStyle = 'rgba(43, 43, 58, 0.55)';
    for (let i = 1; i <= pasos; i++) {
      fisica.paso(ensayo, PREVIO_PASO_S, limites, p.ajustes);
      if (i % 5) continue;
      g.beginPath();
      g.arc(ensayo.x + dx, p.aPantalla(ensayo.y) + dy, 4 - (i / pasos) * 1.6, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
}

// ---- Colocación ----------------------------------------------------------

/**
 * Dónde van las dianas.
 *
 * Sale de la semilla y no de `Math.random` para que "repetir la misma partida"
 * signifique algo, y porque es lo que hace el resto de los juegos. Se reparten
 * por columnas en vez de a voleo: cinco dianas al azar en una pantalla ancha se
 * amontonan en un rincón la mitad de las veces, y entonces sobran disparos.
 */
export function repartirDianas(medidas, semilla) {
  const azar = sembrar(semilla);
  // El tamaño va con la mascota, pero topado por el ancho de la pantalla: en el
  // panel lateral, una diana de "cuarenta por ciento del pato" ocupa un tercio
  // del sitio donde hay que colocar cinco.
  const radio = Math.max(22, Math.min(medidas.patoAncho * 0.4, medidas.ancho * 0.08));
  const margen = radio + 6;

  // Se empieza pasada la salida, para que no se acierte sin apuntar, y se acaba
  // antes del borde. Los dos límites se recortan contra la pantalla: en el panel
  // lateral "un tercio del ancho" dejaba a la última diana medio fuera.
  const izq = Math.min(Math.max(medidas.ancho * 0.34, margen), medidas.ancho - margen);
  const der = Math.max(izq, medidas.ancho - margen);
  const paso = (der - izq) / DIANAS;
  const bajo = medidas.suelo + medidas.alto * 0.12;
  const alto = medidas.alto * 0.62;

  return Array.from({ length: DIANAS }, (_, i) => ({
    x: izq + paso * (i + 0.15 + azar() * 0.7),
    y: bajo + azar() * alto,
    radio,
    viva: true
  }));
}

/** Distancia de un punto al segmento AB. */
export function distanciaASegmento(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const largo = dx * dx + dy * dy;
  if (largo === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / largo;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
