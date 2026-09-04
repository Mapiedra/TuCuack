// «Flappy {mascota}»: volar a base de aletazos, entre huecos.
//
// Es [«{mascota} Runner»](./obstaculos.js) con la gravedad cambiada de bando.
// Allí la mascota está en el suelo y decides CUÁNDO despegarla; aquí está en el
// aire cayendo y decides cuándo NO dejarla caer. El mismo botón, la decisión
// contraria.
//
// Se lleva de allí el desfile que entra por la derecha acelerando, la separación
// medida en tiempo y no en píxeles, y la colisión de círculo contra rectángulo.
// Lo que cambia son tres cosas: el impulso va en CADA pulsación y no sólo desde
// el suelo, los obstáculos vienen por parejas con un hueco en medio, y tocar el
// suelo mata en vez de ser el sitio donde se vive.

import { sembrar } from './azar.js';

/**
 * La física del aleteo.
 *
 * Bastante menos gravedad que en el Runner: allí un salto tiene que ir y volver
 * en medio segundo, y aquí la caída es el estado normal, así que tiene que dar
 * tiempo a leerla. Sin planeo, como en todos los de escenario: el aleteo
 * automático del pato dejaría a la mascota bajando a velocidad fija, y entonces
 * el juego lo jugaría ella.
 *
 * El número sale de la ALTURA DE LA PANTALLA y no de copiar el original: un
 * escenario de escritorio mide el doble que un móvil, y con la gravedad de un
 * flappy de teléfono la mascota cruzaba los mil píxeles en nueve décimas. Con
 * ésta, caer de arriba abajo lleva segundo y medio, que es lo que da tiempo a
 * leer.
 */
function ajustesDeVuelo(fisica) {
  return fisica.conAjustes({
    GRAVEDAD: 850,
    ROZAMIENTO_AIRE: 0,
    PLANEO_UMBRAL: 0,
    REBOTE_SUELO: 0,
    REBOTE_TECHO: 0,        // contra el techo se para, no rebota ni muere
    VELOCIDAD_REPOSO: 0,
    INCLINACION_POR_VX: 0
  });
}

/** Lo que sube un aletazo. Se sustituye la velocidad, no se suma. */
const ALETAZO = 520;

/** Dónde vuela la mascota, en tanto por uno del ancho. */
const CARRIL = 0.24;

/** Velocidad del desfile, cuánto acelera por hueco pasado, y el tope. */
const VELOCIDAD = 400;
const ACELERA = 7;
const VELOCIDAD_MAX = 780;

/**
 * El hueco entre las dos columnas, en alturas de mascota. Se estrecha con los
 * huecos pasados: es lo que hace que la partida se endurezca.
 */
const HUECO = 3.1;
const HUECO_MIN = 2.05;
const HUECO_APRIETA = 0.035;

/** Lo ancho que es una columna, en anchos de mascota. */
const COLUMNA = 0.62;

/** El margen que se deja arriba y abajo para que el hueco no quede pegado. */
const MARGEN = 0.1;

/**
 * @param {import('./index.js').ContextoPartida} ctx
 * @returns {import('./index.js').Partida}
 */
export function crearPartida(ctx) {
  const pista = ctx.escenario;
  const { fisica, vuelo, pato, entrada } = pista;
  const azar = sembrar(ctx.semilla);
  const mejorPrevio = typeof ctx.marcas.mejor === 'number' ? ctx.marcas.mejor : null;

  pista.ajustes = ajustesDeVuelo(fisica);

  const m0 = pista.medidas;
  const carril = m0.ancho * CARRIL;
  const anchoColumna = m0.patoAncho * COLUMNA;

  /** Parejas de columnas. `hueco` es el borde de ABAJO del hueco, en coords del vuelo. */
  const parejas = [];

  let huecos = 0;
  let velocidad = VELOCIDAD;
  let hastaLaSiguiente = m0.ancho * 0.62;
  let pulsadoAntes = false;
  let terminada = false;

  // Se empieza a media altura y subiendo: si empezara cayendo, la presentación
  // se acabaría con la mascota ya a medio metro del suelo.
  fisica.arrancarVuelo(vuelo, {
    x: carril,
    y: m0.suelo + (m0.alto - m0.suelo) * 0.58,
    vx: 0,
    vy: ALETAZO
  });
  colocar();
  marcar();

  return { actualizar, destroy };

  function destroy() { terminada = true; }

  // ---- Un fotograma ------------------------------------------------------

  function actualizar(dt, p) {
    if (terminada) return;
    const medidas = p.medidas;

    avanzar(dt, medidas);
    aletear(dt, p, medidas);
    if (chocado(medidas)) return acabar();

    colocar();
    pintar(p, medidas);
  }

  // ---- El desfile --------------------------------------------------------

  function avanzar(dt, medidas) {
    velocidad = Math.min(VELOCIDAD_MAX, VELOCIDAD + huecos * ACELERA);
    const paso = velocidad * dt;

    const cx = carril + m0.patoAncho / 2;
    for (const c of parejas) {
      c.x -= paso;
      // Pasada: se cuenta cuando la columna queda entera por detrás.
      if (!c.contada && c.x + anchoColumna < cx) {
        c.contada = true;
        huecos++;
        ctx.sonido.nota(660 + Math.min(8, huecos) * 30, 0.07);
        marcar();
      }
    }
    while (parejas.length && parejas[0].x + anchoColumna < -20) parejas.shift();

    hastaLaSiguiente -= paso;
    if (hastaLaSiguiente <= 0) {
      soltarPareja(medidas);
      hastaLaSiguiente = separacion();
    }
  }

  /**
   * Igual que en el Runner: en TIEMPO y apretándose con el avance.
   *
   * Lo de medirlo en tiempo evita que a velocidad alta las columnas se junten
   * solas; lo de apretar es lo que hace que el juego se endurezca de verdad y no
   * sólo se vea más rápido.
   */
  function separacion() {
    const aprieta = Math.min(0.45, huecos * 0.012);
    return velocidad * ((1.55 - aprieta) + azar() * 0.35);
  }

  function soltarPareja(medidas) {
    const hueco = m0.patoAlto * Math.max(HUECO_MIN, HUECO - huecos * HUECO_APRIETA);
    const margen = (medidas.alto - medidas.suelo) * MARGEN;
    const libre = Math.max(40, (medidas.alto - medidas.suelo) - hueco - margen * 2);
    parejas.push({
      x: medidas.ancho + 20,
      abajo: medidas.suelo + margen + azar() * libre,
      hueco,
      contada: false
    });
  }

  // ---- El aletazo --------------------------------------------------------

  function piden() {
    return entrada.pulsada(' ') || entrada.pulsada('Spacebar') || entrada.pulsado;
  }

  function aletear(dt, p, medidas) {
    const ahora = piden();
    const nuevo = ahora && !pulsadoAntes;
    pulsadoAntes = ahora;

    if (nuevo) {
      // Se SUSTITUYE la velocidad, no se suma: si se sumara, machacar el botón
      // mandaría a la mascota al techo y no habría juego. Cada aletazo vale lo
      // mismo, venga de donde venga.
      if (!vuelo.volando) fisica.arrancarVuelo(vuelo, { x: carril, y: vuelo.y, vx: 0, vy: ALETAZO });
      else vuelo.vy = ALETAZO;
      ctx.sonido.aleteo();
    }

    fisica.paso(vuelo, dt, {
      izquierda: carril,
      derecha: carril,
      suelo: medidas.suelo,
      techo: medidas.alto - m0.patoAlto
    }, p.ajustes);
    vuelo.x = carril;
  }

  // ---- Choques -----------------------------------------------------------

  function chocado(medidas) {
    // El suelo mata. El techo no: allí sólo se para, que es lo de siempre en
    // este juego y perdona los aletazos de más.
    if (vuelo.y <= medidas.suelo + 0.5) return true;

    const cuerpo = pato.cuerpo();
    const radio = cuerpo.radio * 0.82;

    for (const c of parejas) {
      if (c.x > cuerpo.cx + radio) break;
      if (c.x + anchoColumna < cuerpo.cx - radio) continue;
      // Dos rectángulos: lo que hay por debajo del hueco y lo que hay por
      // encima. Se mide la distancia del centro al rectángulo, como en el
      // Runner: caja contra caja daría muertes injustas por las esquinas.
      const yAbajo = pista.aPantalla(c.abajo);
      const yArriba = pista.aPantalla(c.abajo + c.hueco);
      if (tocaCaja(cuerpo, radio, c.x, yAbajo, anchoColumna, medidas.alto - yAbajo)) return true;
      if (tocaCaja(cuerpo, radio, c.x, 0, anchoColumna, yArriba)) return true;
    }
    return false;
  }

  function tocaCaja(cuerpo, radio, x, y, w, h) {
    const px = Math.max(x, Math.min(cuerpo.cx, x + w));
    const py = Math.max(y, Math.min(cuerpo.cy, y + h));
    return Math.hypot(cuerpo.cx - px, cuerpo.cy - py) <= radio;
  }

  // ---- Final -------------------------------------------------------------

  function acabar() {
    if (terminada) return;
    terminada = true;
    const esRecord = huecos > 0 && (mejorPrevio === null || huecos > mejorPrevio);
    pato.setState('sad');
    ctx.sonido[esRecord ? 'victoria' : 'derrota']();
    marcar();
    ctx.alTerminar({
      resultado: esRecord ? 'victoria' : 'derrota',
      puntos: huecos,
      detalle: detalleFinal(esRecord)
    });
  }

  function detalleFinal(esRecord) {
    const cuenta = huecos === 1 ? '1 hueco' : `${huecos} huecos`;
    if (!huecos) return 'Ni uno. Se cayó de primeras.';
    if (esRecord) {
      return mejorPrevio === null
        ? `${cuenta}. A ver quién lo mejora.`
        : `${cuenta}. Récord nuevo: antes eran ${mejorPrevio}.`;
    }
    return `${cuenta}. Tu récord sigue en ${mejorPrevio}.`;
  }

  function marcar() {
    pista.marcador(mejorPrevio === null ? `${huecos}` : `${huecos}  ·  récord ${mejorPrevio}`);
  }

  // ---- Pintado -----------------------------------------------------------

  /** La mascota no se mueve en horizontal: se le toca la altura y la inclinación. */
  function colocar() {
    pato.setX(carril);
    pato.setY(vuelo.y);
    pato.setFacing(1);
    // Morro arriba al subir y abajo al caer. Es lo que hace que se lea la
    // velocidad sin mirar nada más.
    pato.setTilt(Math.max(-42, Math.min(28, -vuelo.vy * 0.05)));
    pato.setState(vuelo.vy > 0 ? 'flap' : 'fall');
  }

  function pintar(p, medidas) {
    const g = p.pintor;
    const ySuelo = p.aPantalla(m0.suelo);

    // El suelo es lo que mata, así que se ve.
    g.strokeStyle = 'rgba(193, 18, 31, 0.5)';
    g.lineWidth = 3;
    g.setLineDash([10, 8]);
    g.beginPath();
    g.moveTo(0, ySuelo);
    g.lineTo(medidas.ancho, ySuelo);
    g.stroke();
    g.setLineDash([]);

    for (const c of parejas) {
      const yAbajo = p.aPantalla(c.abajo);
      const yArriba = p.aPantalla(c.abajo + c.hueco);
      columna(g, c.x, yAbajo, anchoColumna, medidas.alto - yAbajo);
      columna(g, c.x, 0, anchoColumna, yArriba);
    }
  }

  function columna(g, x, y, w, h) {
    if (h <= 0) return;
    g.fillStyle = '#35a34a';
    g.strokeStyle = '#2b2b3a';
    g.lineWidth = 3;
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, 8);
    else g.rect(x, y, w, h);
    g.fill();
    g.stroke();
  }
}
