// Minigolf: cinco hoyos, y que no se te vayan los golpes.
//
// Es el primero que **puntúa a menos** —`marca: {mejor:'menos'}`—, una dirección
// que estaba en el contrato desde el principio y que no había usado nadie. Y es
// el primero que hay que comprar: el nivel 20 lo abre y 900 cuacks lo pagan.
//
// ---- Por qué la bola no es la mascota -------------------------------------
//
// «Pato Hook» lanza a la mascota con la MISMA física con la que se la tira por
// la pantalla, y ahí está media gracia. Aquí no: esto se ve desde arriba, no hay
// gravedad que valga, y lo que rueda es una bola. Reutilizar `pet/fisica.js`
// habría sido pelearse con un módulo que sabe de suelos, techos e inclinación
// —cosas que aquí no significan nada— para acabar necesitando igualmente lo
// único que no trae: círculo contra rectángulo. Así que la bola lleva sus
// veinte líneas de integración propias y la mascota se queda mirando desde
// abajo, que es su papel en este.
//
// Lo que sí se calca de «Pato Hook» es APUNTAR: se apunta hacia el cursor y la
// fuerza sale de lo lejos que esté, medida contra el ancho de la pantalla. Quien
// sepa jugar a uno sabe jugar al otro.

import { sembrar } from './azar.js';

const HOYOS = 5;

/**
 * Golpes por hoyo antes de darlo por perdido.
 *
 * Sin tope, una bola atascada detrás de un muro es una partida que no termina
 * nunca, y con `mejor: 'menos'` eso además envenena el récord: bastaría con
 * abandonar a mitad para no empeorar la marca. Al llegar al tope el hoyo se da
 * por jugado con los ocho golpes puestos y se pasa al siguiente.
 */
const TOPE_GOLPES = 8;

/** Rozamiento del césped, exponencial y por segundo. */
const ROZAMIENTO = 1.5;
/** Por debajo de esto la bola se considera parada y se puede volver a golpear. */
const PARADA = 26;
/** Lo que devuelven las bandas y los muros. */
const REBOTE = 0.74;

/** El golpe más fuerte, en píxeles por segundo. */
const FUERZA_MAX = 1250;
/** Cuánto hay que alejar el cursor, en partes del ancho, para el golpe máximo. */
const ALCANCE = 0.28;
/**
 * Deprisa, la bola pasa por encima del hoyo.
 *
 * Es la regla que convierte «apuntar bien» en «apuntar bien y con la fuerza
 * justa», que es de lo que va el minigolf. Sin esto, el tiro correcto sería
 * siempre el más fuerte.
 */
const ENTRADA_MAX = 620;

/** Lo que se enseña de la salida al apuntar: el principio, no el final. */
const PREVIO_S = 0.42;
/** Píxeles como mucho por subpaso: una bola rápida no puede saltarse un muro. */
const PASO_MAX = 4;

/**
 * @param {import('./index.js').ContextoPartida} ctx
 * @returns {import('./index.js').Partida}
 */
export function crearPartida(ctx) {
  const pista = ctx.escenario;
  const { pato, entrada } = pista;

  const mejorPrevio = typeof ctx.marcas.mejor === 'number' ? ctx.marcas.mejor : null;

  /** El campo en proporciones, para que un cambio de tamaño no rehaga el hoyo. */
  const disenos = disenarRecorrido(ctx.semilla);

  /** 'apuntando' | 'rodando' | 'celebrando' | 'fin' */
  let fase = 'apuntando';
  let hoyo = 0;
  let golpesAqui = 0;
  let golpesTotal = 0;
  let terminada = false;
  let pulsadoAntes = false;
  let celebracion = 0;

  let campo = medirCampo(pista.medidas, pista.aPantalla);
  const bola = { x: 0, y: 0, vx: 0, vy: 0, radio: 8 };
  /** El hoyo y los muros de ESTE hoyo, ya en píxeles. */
  let mapa = null;

  pista.cursor('crosshair');
  colocarMascota(pista.medidas);
  empezarHoyo();

  return { actualizar, destroy };

  function destroy() { terminada = true; }

  // ---- Un fotograma ------------------------------------------------------

  function actualizar(dt, p) {
    if (terminada) return;
    sincronizarCampo(p.medidas, p.aPantalla);

    if (fase === 'celebrando') {
      celebracion -= dt;
      if (celebracion <= 0) siguienteHoyo();
    } else if (fase === 'rodando') {
      rodar(dt);
    } else if (fase === 'apuntando') {
      apuntar(p.medidas);
    }

    pintar(p.pintor, p.medidas);
  }

  // ---- Apuntar -----------------------------------------------------------

  function apuntar(medidas) {
    const golpe = golpeDelCursor(medidas);
    // Mirando hacia donde va a salir, como en «Pato Hook»: apuntar de espaldas
    // queda raro.
    pato.setFacing(golpe.vx >= 0 ? 1 : -1);

    // Se golpea al SOLTAR y no al pulsar: así se corrige la puntería sin gastar
    // el golpe, que con `mejor: 'menos'` importa el doble.
    if (pulsadoAntes && !entrada.pulsado) {
      pulsadoAntes = false;
      golpear(golpe);
      return;
    }
    pulsadoAntes = entrada.pulsado;
  }

  /** Hacia el cursor, y con la fuerza que dé la distancia. */
  function golpeDelCursor(medidas) {
    const dx = entrada.x - bola.x;
    const dy = entrada.y - bola.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return { vx: 0, vy: 0, fuerza: 0 };
    const parte = Math.min(1, dist / Math.max(1, medidas.ancho * ALCANCE));
    const fuerza = parte * FUERZA_MAX;
    return { vx: (dx / dist) * fuerza, vy: (dy / dist) * fuerza, fuerza };
  }

  function golpear(golpe) {
    if (golpe.fuerza < 40) return;   // un clic encima de la bola no es un golpe
    golpesAqui++;
    golpesTotal++;
    bola.vx = golpe.vx;
    bola.vy = golpe.vy;
    fase = 'rodando';
    ctx.sonido.nota(560, 0.06);
    marcar();
  }

  // ---- Rodar -------------------------------------------------------------

  function rodar(dt) {
    // En subpasos: a mil doscientos píxeles por segundo, un fotograma entero
    // mueve veinte píxeles y la bola atravesaría un muro fino sin enterarse.
    const v = Math.hypot(bola.vx, bola.vy);
    const pasos = Math.max(1, Math.ceil((v * dt) / PASO_MAX));
    const paso = dt / pasos;

    for (let i = 0; i < pasos; i++) {
      // El rozamiento va exponencial: frena mucho al principio y se va
      // acabando, que es como rueda una bola de verdad.
      const freno = Math.exp(-ROZAMIENTO * paso);
      bola.vx *= freno;
      bola.vy *= freno;
      bola.x += bola.vx * paso;
      bola.y += bola.vy * paso;

      for (const m of mapa.muros) chocarConMuro(m);
      chocarConLasBandas();

      if (entraEnElHoyo()) { embocar(); return; }
    }

    if (Math.hypot(bola.vx, bola.vy) < PARADA) {
      bola.vx = 0;
      bola.vy = 0;
      if (golpesAqui >= TOPE_GOLPES) { rendirElHoyo(); return; }
      fase = 'apuntando';
      // No dispara solo si se llegó aquí con el botón pulsado.
      pulsadoAntes = entrada.pulsado;
    }
  }

  /**
   * Círculo contra rectángulo: se busca el punto del muro más cercano al centro
   * de la bola y, si está más cerca que el radio, se la saca por ahí y se
   * refleja la velocidad contra esa normal.
   */
  function chocarConMuro(m) {
    const px = Math.max(m.x, Math.min(bola.x, m.x + m.w));
    const py = Math.max(m.y, Math.min(bola.y, m.y + m.h));
    let dx = bola.x - px;
    let dy = bola.y - py;
    let d = Math.hypot(dx, dy);

    if (d >= bola.radio) return;

    if (d < 0.0001) {
      // El centro ha acabado dentro del muro. No debería pasar con subpasos,
      // pero si pasa hay que salir por algún lado: el más cercano.
      const izq = bola.x - m.x;
      const der = m.x + m.w - bola.x;
      const arr = bola.y - m.y;
      const aba = m.y + m.h - bola.y;
      const min = Math.min(izq, der, arr, aba);
      dx = min === izq ? -1 : min === der ? 1 : 0;
      dy = min === arr ? -1 : min === aba ? 1 : 0;
      d = 1;
    }

    const nx = dx / d;
    const ny = dy / d;
    bola.x = px + nx * bola.radio;
    bola.y = py + ny * bola.radio;

    const vn = bola.vx * nx + bola.vy * ny;
    if (vn >= 0) return;                  // ya se estaba alejando
    bola.vx -= (1 + REBOTE) * vn * nx;
    bola.vy -= (1 + REBOTE) * vn * ny;
    sonarChoque(-vn);
  }

  function chocarConLasBandas() {
    const r = bola.radio;
    if (bola.x < campo.x0 + r) { bola.x = campo.x0 + r; rebotar('x'); }
    else if (bola.x > campo.x1 - r) { bola.x = campo.x1 - r; rebotar('x'); }
    if (bola.y < campo.y0 + r) { bola.y = campo.y0 + r; rebotar('y'); }
    else if (bola.y > campo.y1 - r) { bola.y = campo.y1 - r; rebotar('y'); }
  }

  function rebotar(eje) {
    const v = eje === 'x' ? bola.vx : bola.vy;
    if (eje === 'x') bola.vx = -v * REBOTE; else bola.vy = -v * REBOTE;
    sonarChoque(Math.abs(v));
  }

  function sonarChoque(velocidad) {
    if (velocidad < 120) return;   // los roces no suenan
    ctx.sonido.boing(Math.min(0.45, velocidad / 2400));
  }

  /**
   * Deprisa se pasa de largo.
   *
   * Se mira la velocidad y no sólo la distancia: una bola lanzada se lleva el
   * hoyo por delante, y eso es lo que hace que la fuerza importe tanto como la
   * dirección.
   */
  function entraEnElHoyo() {
    const d = Math.hypot(bola.x - mapa.hoyo.x, bola.y - mapa.hoyo.y);
    if (d > mapa.hoyo.radio - bola.radio * 0.35) return false;
    return Math.hypot(bola.vx, bola.vy) <= ENTRADA_MAX;
  }

  // ---- De un hoyo al siguiente -------------------------------------------

  function empezarHoyo() {
    mapa = aPixeles(disenos[hoyo], campo);
    bola.radio = mapa.bolaRadio;
    bola.x = mapa.salida.x;
    bola.y = mapa.salida.y;
    bola.vx = 0;
    bola.vy = 0;
    golpesAqui = 0;
    fase = 'apuntando';
    pulsadoAntes = entrada.pulsado;
    marcar();
  }

  function embocar() {
    bola.vx = 0;
    bola.vy = 0;
    bola.x = mapa.hoyo.x;
    bola.y = mapa.hoyo.y;
    fase = 'celebrando';
    celebracion = 0.9;
    pato.setState('happy');
    ctx.sonido.nota(880, 0.1);
    ctx.sonido.nota(1174, 0.14);
    marcar();
  }

  /** El hoyo se da por jugado con el tope puesto. Ver `TOPE_GOLPES`. */
  function rendirElHoyo() {
    fase = 'celebrando';
    celebracion = 0.7;
    ctx.sonido.nota(220, 0.18);
    ctx.decir(`Ese hoyo, por imposible: ${TOPE_GOLPES} golpes.`);
    marcar();
  }

  function siguienteHoyo() {
    pato.setState('idle');
    hoyo++;
    if (hoyo >= HOYOS) { acabar(); return; }
    empezarHoyo();
  }

  // ---- Final -------------------------------------------------------------

  function acabar() {
    if (terminada) return;
    terminada = true;
    fase = 'fin';

    // A menos es mejor, así que aquí un récord es bajar, no subir.
    const esRecord = mejorPrevio === null || golpesTotal < mejorPrevio;
    const par = disenos.reduce((s, d) => s + d.par, 0);

    ctx.sonido[esRecord ? 'victoria' : 'derrota']();
    ctx.alTerminar({
      resultado: esRecord ? 'victoria' : 'derrota',
      puntos: golpesTotal,
      detalle: detalleFinal(golpesTotal, par, esRecord)
    });
  }

  function detalleFinal(total, par, esRecord) {
    const contra = total === par ? 'justo el par'
      : total < par ? `${par - total} bajo par`
        : `${total - par} sobre par`;
    const cola = esRecord
      ? (mejorPrevio === null ? ' A ver quién baja de ahí.' : ` Récord nuevo: antes eran ${mejorPrevio}.`)
      : ` Tu récord sigue en ${mejorPrevio}.`;
    return `${total} golpes en ${HOYOS} hoyos, ${contra}.${cola}`;
  }

  function marcar() {
    const par = disenos[Math.min(hoyo, HOYOS - 1)].par;
    const base = `Hoyo ${Math.min(hoyo + 1, HOYOS)}/${HOYOS}  ·  ${golpesAqui} de par ${par}`
      + `  ·  ${golpesTotal} en total`;
    pista.marcador(mejorPrevio === null ? base : `${base}  ·  récord ${mejorPrevio}`);
  }

  // ---- Medidas -----------------------------------------------------------

  /**
   * El campo se vuelve a medir en cada fotograma porque la ventana puede cambiar
   * de tamaño a mitad. Cuando cambia se REESCALA lo que hay —la bola incluida—
   * en vez de rehacer el hoyo: rehacerlo sería borrar los golpes que ya llevas.
   */
  function sincronizarCampo(medidas, aPantalla) {
    const nuevo = medirCampo(medidas, aPantalla);
    if (nuevo.x0 === campo.x0 && nuevo.y0 === campo.y0
      && nuevo.ancho === campo.ancho && nuevo.alto === campo.alto) return;

    const fx = nuevo.ancho / campo.ancho;
    const fy = nuevo.alto / campo.alto;
    bola.x = nuevo.x0 + (bola.x - campo.x0) * fx;
    bola.y = nuevo.y0 + (bola.y - campo.y0) * fy;
    bola.vx *= fx;
    bola.vy *= fy;
    campo = nuevo;
    mapa = aPixeles(disenos[Math.min(hoyo, HOYOS - 1)], campo);
    bola.radio = mapa.bolaRadio;
    colocarMascota(medidas);
  }

  /** Abajo a la izquierda, fuera del campo y mirando. */
  function colocarMascota(medidas) {
    pato.setTilt(0);
    pato.setState('idle');
    pato.setX(Math.max(4, campo.x0));
    pato.setY(medidas.suelo);
  }

  // ---- Pintado -----------------------------------------------------------

  function pintar(g, medidas) {
    dibujarCampo(g);
    for (const m of mapa.muros) dibujarMuro(g, m);
    dibujarHoyo(g);
    dibujarBola(g);
    if (fase === 'apuntando') dibujarPrevia(g, medidas);
  }

  function dibujarCampo(g) {
    g.save();
    // Traslúcido a propósito: el pato vive encima del escritorio de alguien, y
    // un rectángulo opaco a pantalla completa da un susto que no toca.
    g.fillStyle = 'rgba(41, 122, 74, 0.88)';
    g.fillRect(campo.x0, campo.y0, campo.ancho, campo.alto);
    g.lineWidth = 6;
    g.strokeStyle = '#2b2b3a';
    g.strokeRect(campo.x0, campo.y0, campo.ancho, campo.alto);
    g.restore();
  }

  function dibujarMuro(g, m) {
    g.save();
    g.fillStyle = '#8a5a3b';
    g.fillRect(m.x, m.y, m.w, m.h);
    g.lineWidth = 3;
    g.strokeStyle = '#2b2b3a';
    g.strokeRect(m.x, m.y, m.w, m.h);
    g.restore();
  }

  function dibujarHoyo(g) {
    const h = mapa.hoyo;
    g.save();
    g.beginPath();
    g.arc(h.x, h.y, h.radio, 0, Math.PI * 2);
    g.fillStyle = '#161620';
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = '#0b0b12';
    g.stroke();

    // La bandera, para que el hoyo se vea desde el otro lado del campo.
    const alto = h.radio * 3.4;
    g.beginPath();
    g.moveTo(h.x, h.y);
    g.lineTo(h.x, h.y - alto);
    g.lineWidth = 2;
    g.strokeStyle = '#fffdf7';
    g.stroke();
    g.beginPath();
    g.moveTo(h.x, h.y - alto);
    g.lineTo(h.x + h.radio * 2.2, h.y - alto + h.radio * 0.7);
    g.lineTo(h.x, h.y - alto + h.radio * 1.4);
    g.closePath();
    g.fillStyle = '#c1121f';
    g.fill();
    g.restore();
  }

  function dibujarBola(g) {
    g.save();
    g.beginPath();
    g.arc(bola.x, bola.y, bola.radio, 0, Math.PI * 2);
    g.fillStyle = '#fffdf7';
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = '#2b2b3a';
    g.stroke();
    g.restore();
  }

  /**
   * Por dónde va a salir la bola.
   *
   * Sólo el principio, y SIN rebotes: con la trayectoria entera resuelta, elegir
   * la banda dejaría de ser cosa del jugador. Lo que se enseña es la salida y la
   * fuerza —los puntos se van juntando según frena—, que es lo que de verdad
   * cuesta calibrar.
   */
  function dibujarPrevia(g, medidas) {
    const golpe = golpeDelCursor(medidas);
    if (golpe.fuerza < 40) return;

    let x = bola.x;
    let y = bola.y;
    let vx = golpe.vx;
    let vy = golpe.vy;
    const paso = 1 / 60;
    const pasos = Math.round(PREVIO_S / paso);

    g.save();
    g.fillStyle = 'rgba(255, 253, 247, 0.7)';
    for (let i = 1; i <= pasos; i++) {
      const freno = Math.exp(-ROZAMIENTO * paso);
      vx *= freno; vy *= freno;
      x += vx * paso; y += vy * paso;
      if (i % 4) continue;
      g.beginPath();
      g.arc(x, y, 3.2 - (i / pasos) * 1.4, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
}

// ---- El recorrido --------------------------------------------------------

/**
 * Los cinco hoyos, en proporciones de 0 a 1.
 *
 * En proporciones y no en píxeles porque la ventana puede cambiar de tamaño a
 * mitad de la partida, y un hoyo que se rehace cuando alguien mueve la ventana
 * es un hoyo que se puede rehacer a propósito.
 *
 * Sale de `ctx.semilla` como en el resto de los juegos: la misma partida se
 * puede repetir tal cual para depurarla.
 */
export function disenarRecorrido(semilla) {
  const azar = sembrar(semilla);
  return Array.from({ length: HOYOS }, (_, i) => disenarHoyo(i, azar));
}

/**
 * Un hoyo: salida a la izquierda, hoyo a la derecha y muros verticales en medio.
 *
 * Los muros son verticales y **nunca cruzan el campo entero**: cada uno deja un
 * hueco arriba o abajo. Con eso el hoyo siempre se puede alcanzar sin tener que
 * comprobarlo con un buscador de caminos, que para tres rectángulos sería
 * matar moscas a cañonazos. Y de paso es lo que hace que el recorrido se lea de
 * un vistazo: se ve por dónde hay que pasar.
 */
function disenarHoyo(i, azar) {
  // Más muros según se avanza: el primero es una recta para entender el golpe.
  const muros = Math.min(4, i);
  const lista = [];
  for (let c = 0; c < muros; c++) {
    const x = 0.24 + (0.54 / muros) * (c + 0.5);
    const hueco = 0.24 + azar() * 0.12;
    const arriba = azar() < 0.5;
    lista.push({
      x: x - 0.011,
      y: arriba ? 0 : hueco,
      w: 0.022,
      h: 1 - hueco
    });
  }
  return {
    salida: { x: 0.08, y: 0.18 + azar() * 0.64 },
    hoyo: { x: 0.9, y: 0.18 + azar() * 0.64 },
    muros: lista,
    // Un golpe para salir, uno por muro que sortear y uno de propina.
    par: 2 + Math.ceil(muros / 2)
  };
}

/** El campo en píxeles: la pantalla menos los márgenes y menos la mascota. */
export function medirCampo(medidas, aPantalla) {
  const margen = Math.max(14, Math.min(40, medidas.ancho * 0.02));
  const x0 = margen;
  const x1 = Math.max(x0 + 200, medidas.ancho - margen);
  const y0 = margen;
  // El borde de abajo lo marca la mascota: se queda FUERA del campo, en su
  // suelo de siempre, mirando. Meterla dentro de una vista cenital sería
  // pintarla tumbada en medio del césped.
  const y1 = Math.max(y0 + 160, aPantalla(medidas.suelo) - medidas.patoAlto - 10);
  return { x0, y0, x1, y1, ancho: x1 - x0, alto: y1 - y0 };
}

/** Pasa un diseño en proporciones al campo que hay ahora. */
export function aPixeles(diseno, campo) {
  const bolaRadio = Math.max(6, Math.min(11, campo.alto * 0.016));
  return {
    bolaRadio,
    salida: {
      x: campo.x0 + diseno.salida.x * campo.ancho,
      y: campo.y0 + diseno.salida.y * campo.alto
    },
    hoyo: {
      x: campo.x0 + diseno.hoyo.x * campo.ancho,
      y: campo.y0 + diseno.hoyo.y * campo.alto,
      radio: bolaRadio * 2.1
    },
    muros: diseno.muros.map((m) => ({
      x: campo.x0 + m.x * campo.ancho,
      // Los muros se miden con un ancho MÍNIMO en píxeles: un 2,2 % de un panel
      // lateral son cuatro píxeles, y una bola de seis los cruza de un bote.
      y: campo.y0 + m.y * campo.alto,
      w: Math.max(10, m.w * campo.ancho),
      h: m.h * campo.alto
    }))
  };
}
