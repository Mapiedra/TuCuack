// Ladrillos: la mascota de pala abajo, un muro arriba, y la pelota rompiendo.
//
// ---- Por qué existe, habiendo ya un Pong -----------------------------------
//
// La duda estaba anotada desde el principio: «Pato Jumping», el Pong y esto son
// los tres «mantén la pelota en el aire con la mascota», y tres es el límite. Se
// dejó escrito que se decidía DESPUÉS de tener el Pong, y ésta es la decisión:
// se hace, porque en las manos no se parecen.
//
//   - En **Jumping** la mascota ES la pelota. Hay gravedad y se juega en
//     vertical: lo que haces es no dejarla caer.
//   - En el **Pong** la mascota es una pala VERTICAL en la banda izquierda, se
//     mueve arriba y abajo, y enfrente hay alguien que devuelve.
//   - Aquí es una pala HORIZONTAL abajo del todo, se mueve a izquierda y
//     derecha, y enfrente no hay nadie: hay algo que romper.
//
// Eje distinto y objetivo distinto. El Pong es defenderse; esto es apuntar. Y de
// paso, es el único de los tres donde la mascota se queda en su suelo de
// siempre: no hay que moverla en vertical ni pelearse con `Duck.setY`.
//
// ---- Lo que se guarda ------------------------------------------------------
//
// La marca son los **ladrillos rotos** en toda la partida, no el muro al que
// llegaste. Los muros se cuentan con los dedos de una mano y un marcador donde
// todo el mundo empata en «4» no compara nada; los ladrillos dan grano fino y
// dicen lo mismo, porque cada muro trae más que el anterior.

import { sembrar } from './azar.js';

/** Vidas. Tres, como manda el género. */
const VIDAS = 3;

/**
 * La pelota, por muro.
 *
 * Va deprisa a propósito, y es por el tamaño de la pantalla. Un Breakout de los
 * de siempre cabe en un cuadrado; aquí la pista es la pantalla entera del
 * escritorio, y entre el muro y la pala hay medio metro de nada. Con la primera
 * versión —520 px/s— cada ladrillo costaba tres segundos y medio de ida y vuelta:
 * medido, veintitrés ladrillos en tres mil fotogramas, o sea dos minutos y medio
 * para limpiar el primer muro y el presupuesto entero gastado en dos. La pelota
 * no era lenta: la pista era grande.
 */
const VELOCIDAD_BASE = 780;
const VELOCIDAD_POR_MURO = 55;
const VELOCIDAD_MAX = 1400;
/** Y lo que acelera dentro de un mismo muro, por golpe a la pala. */
const VELOCIDAD_POR_GOLPE = 6;

/** Cuánto desvía golpear con el borde de la pala en vez de con el centro. */
const DESVIO_MAX = 1.02;
/** Y lo mínimo que se desvía aunque le des con el centro justo. Ver `golpeDeLaPala`. */
const ANGULO_MINIMO = 0.16;
/** Cuánto del movimiento de la pala se le pega a la pelota. */
const EFECTO = 0.18;

/** Lo deprisa que sigue la mascota al ratón. Instantáneo sería no jugar. */
const VELOCIDAD_PALA = 1500;

/** Píxeles como mucho por subpaso: una pelota rápida no se salta un ladrillo. */
const PASO_MAX = 5;

/** Lo que se espera antes de sacar, para colocarse. */
const RESPIRO_S = 0.9;

/**
 * Lo que el juego se da antes de cerrar.
 *
 * El préstamo del escenario corta a los diez minutos y lo hace SIN resultado
 * (ver `TOPE_PARTIDA_MS` en escenario.js). Tres vidas acaban solas, pero alguien
 * que no falle puede encadenar muros hasta el infinito, y perder la partida
 * entera por buena sería el peor final posible. Al llegar, se cierra con lo que
 * lleve roto.
 */
const PRESUPUESTO_MS = 8.5 * 60 * 1000;
/** A partir de aquí el marcador avisa de que queda poco. */
const AVISO_MS = 60 * 1000;

/**
 * @param {import('./index.js').ContextoPartida} ctx
 * @returns {import('./index.js').Partida}
 */
export function crearPartida(ctx) {
  const pista = ctx.escenario;
  const { pato, entrada } = pista;

  const mejorPrevio = typeof ctx.marcas.mejor === 'number' ? ctx.marcas.mejor : null;
  const azar = sembrar(ctx.semilla);

  /** 'sirviendo' | 'jugando' | 'fin' */
  let fase = 'sirviendo';
  let muro = 1;
  let vidas = VIDAS;
  let rotos = 0;
  let puntos = 0;
  let espera = RESPIRO_S;
  let terminada = false;
  let transcurrido = 0;

  let campo = medirCampo();
  const pelota = { x: 0, y: 0, vx: 0, vy: 0, radio: 9 };
  /** La pala de la mascota: la caja donde está ahora, y hacia dónde va. */
  const pala = { x: 0, y: 0, w: 90, h: 40, destino: 0, vx: 0 };
  /** @type {{x:number,y:number,w:number,h:number,dureza:number}[]} */
  let ladrillos = [];

  pista.cursor('none');
  aplicarMedidas();
  levantarMuro();
  centrarPelota();
  marcar();

  return { actualizar, destroy };

  function destroy() { terminada = true; }

  // ---- Un fotograma ------------------------------------------------------

  function actualizar(dt, p) {
    if (terminada) return;
    sincronizarCampo(p);

    const antes = transcurrido;
    transcurrido += dt * 1000;
    if (transcurrido >= PRESUPUESTO_MS) { acabar('tiempo'); return; }
    if (PRESUPUESTO_MS - transcurrido < AVISO_MS
      && Math.ceil(antes / 1000) !== Math.ceil(transcurrido / 1000)) marcar();

    moverPala(dt);

    if (fase === 'sirviendo') {
      // La pelota espera encima de la pala, para que se pueda elegir desde
      // dónde sale: es la única decisión que hay antes del saque.
      pelota.x = pala.x + pala.w / 2;
      pelota.y = pala.y - pelota.radio - 2;
      espera -= dt;
      if (espera <= 0) sacar();
    } else if (fase === 'jugando') {
      moverPelota(dt);
    }

    pintar(p.pintor);
  }

  // ---- La pala -----------------------------------------------------------

  /**
   * Sigue al ratón en horizontal, con tope de velocidad.
   *
   * La mascota se queda en su suelo y sólo se mueve de lado: aquí no hace falta
   * tocar la altura para nada, que es lo que hace este juego más barato que el
   * Pong pese a parecerse.
   */
  function moverPala(dt) {
    const antes = pala.x + pala.w / 2;
    const medio = pala.w / 2;
    const quiero = Math.max(campo.x0 + medio, Math.min(campo.x1 - medio, entrada.x));
    const paso = VELOCIDAD_PALA * dt;
    const dx = quiero - pala.destino;
    pala.destino += Math.abs(dx) <= paso ? dx : Math.sign(dx) * paso;

    pato.setX(pala.destino - campo.patoAncho / 2);
    const c = pato.cuerpo();
    pala.x = c.cx - pala.w / 2;
    pala.y = c.cy - pala.h / 2;
    pala.vx = dt > 0 ? (pala.x + pala.w / 2 - antes) / dt : 0;
    // Mirando hacia donde se mueve, que es lo que haría cualquiera.
    if (Math.abs(pala.vx) > 40) pato.setFacing(pala.vx > 0 ? 1 : -1);
  }

  // ---- La pelota ---------------------------------------------------------

  function centrarPelota() {
    pelota.x = (campo.x0 + campo.x1) / 2;
    pelota.y = pala.y - pelota.radio - 2;
    pelota.vx = 0;
    pelota.vy = 0;
  }

  function sacar() {
    // Siempre hacia arriba, y con un ángulo que no sea vertical del todo: una
    // pelota que sube recta baja recta y no hay jugada.
    const angulo = (azar() * 0.9 - 0.45) + (azar() < 0.5 ? 0.22 : -0.22);
    const v = velocidadDelMuro();
    pelota.vx = Math.sin(angulo) * v;
    pelota.vy = -Math.cos(angulo) * v;
    fase = 'jugando';
    // Se le quita la cara de fiesta de haber limpiado el muro anterior.
    pato.setState('idle');
    ctx.sonido.nota(520, 0.06);
  }

  function velocidadDelMuro() {
    return Math.min(VELOCIDAD_MAX, VELOCIDAD_BASE + (muro - 1) * VELOCIDAD_POR_MURO);
  }

  function moverPelota(dt) {
    const v = Math.hypot(pelota.vx, pelota.vy);
    const pasos = Math.max(1, Math.ceil((v * dt) / PASO_MAX));
    const paso = dt / pasos;

    for (let i = 0; i < pasos; i++) {
      pelota.x += pelota.vx * paso;
      pelota.y += pelota.vy * paso;

      if (pelota.x < campo.x0 + pelota.radio && pelota.vx < 0) {
        pelota.x = campo.x0 + pelota.radio; pelota.vx = -pelota.vx; ctx.sonido.boing(0.16);
      } else if (pelota.x > campo.x1 - pelota.radio && pelota.vx > 0) {
        pelota.x = campo.x1 - pelota.radio; pelota.vx = -pelota.vx; ctx.sonido.boing(0.16);
      }
      if (pelota.y < campo.y0 + pelota.radio && pelota.vy < 0) {
        pelota.y = campo.y0 + pelota.radio; pelota.vy = -pelota.vy; ctx.sonido.boing(0.16);
      }

      romper();
      if (pelota.vy > 0) golpeDeLaPala();

      if (!ladrillos.length) { siguienteMuro(); return; }
      if (pelota.y > campo.y1 + pelota.radio * 2) { perderVida(); return; }
    }
  }

  function golpeDeLaPala() {
    if (!toca(pala)) return;
    pelota.y = pala.y - pelota.radio;

    // El ángulo sale de DÓNDE golpeó, como en el Pong y por lo mismo: sin eso
    // la pala es un muro y no algo que se apunta. Aquí importa el doble, porque
    // lo que se apunta son los ladrillos que faltan.
    const donde = Math.max(-1, Math.min(1, (pelota.x - (pala.x + pala.w / 2)) / (pala.w / 2)));
    const v = Math.min(VELOCIDAD_MAX, Math.hypot(pelota.vx, pelota.vy) + VELOCIDAD_POR_GOLPE);

    // Nunca del todo vertical, y esto no es un detalle: golpeando con el centro
    // la pelota sube y baja por el mismo pasillo para siempre. Medido con un bot
    // que centra la pala en la pelota: mil ochocientos fotogramas rebotando en
    // una mitad de la pista que ya había limpiado, sin tocar un ladrillo. Con un
    // ángulo mínimo, la pelota siempre va a alguna parte.
    const lado = donde === 0 ? (pelota.vx >= 0 ? 1 : -1) : Math.sign(donde);
    const angulo = lado * Math.max(Math.abs(donde) * DESVIO_MAX, ANGULO_MINIMO);
    pelota.vx = Math.sin(angulo) * v + pala.vx * EFECTO;
    pelota.vy = -Math.abs(Math.cos(angulo) * v);
    // El efecto de la pala suma velocidad y no la reparte, así que hay que
    // volver a normalizar: sin esto, arrastrar el ratón a cada golpe acelera la
    // pelota sin techo y a los diez toques esto es injugable.
    const total = Math.hypot(pelota.vx, pelota.vy);
    if (total > VELOCIDAD_MAX) {
      pelota.vx *= VELOCIDAD_MAX / total;
      pelota.vy *= VELOCIDAD_MAX / total;
    }
    ctx.sonido.nota(680, 0.05);
  }

  /** Caja contra círculo. Basta: ni la pala ni los ladrillos giran. */
  function toca(caja) {
    return pelota.x + pelota.radio > caja.x
      && pelota.x - pelota.radio < caja.x + caja.w
      && pelota.y + pelota.radio > caja.y
      && pelota.y - pelota.radio < caja.y + caja.h;
  }

  /**
   * El ladrillo que toque, si toca alguno.
   *
   * Uno por subpaso y no todos los que solapen: con los subpasos la pelota
   * nunca está dentro de dos a la vez, y romper dos de un golpe se ve como un
   * fallo aunque sume más.
   */
  function romper() {
    for (let i = 0; i < ladrillos.length; i++) {
      const l = ladrillos[i];
      if (!toca(l)) continue;

      // Por dónde entró: se compara cuánto solapa en cada eje y se rebota
      // contra el lado por el que menos ha entrado, que es por el que venía.
      const solapeX = Math.min(pelota.x + pelota.radio - l.x, l.x + l.w - (pelota.x - pelota.radio));
      const solapeY = Math.min(pelota.y + pelota.radio - l.y, l.y + l.h - (pelota.y - pelota.radio));
      if (solapeX < solapeY) pelota.vx = -pelota.vx;
      else pelota.vy = -pelota.vy;

      l.dureza--;
      if (l.dureza > 0) {
        ctx.sonido.nota(300, 0.04);
        return;
      }

      ladrillos.splice(i, 1);
      rotos++;
      puntos += puntosDe(l.original);
      ctx.sonido.nota(880 + l.fila * 60, 0.05);
      marcar();
      return;
    }
  }

  // ---- Vidas y muros -----------------------------------------------------

  function perderVida() {
    vidas--;
    ctx.sonido.nota(180, 0.2);
    if (vidas <= 0) { acabar('vidas'); return; }
    fase = 'sirviendo';
    espera = RESPIRO_S;
    centrarPelota();
    marcar();
  }

  function siguienteMuro() {
    muro++;
    fase = 'sirviendo';
    espera = RESPIRO_S;
    pato.setState('happy');
    ctx.sonido.nota(1046, 0.1);
    ctx.sonido.nota(1318, 0.14);
    ctx.decir(`Muro limpio. Va el ${muro}.`);
    levantarMuro();
    centrarPelota();
    marcar();
  }

  /**
   * El muro que toca.
   *
   * Crece de dos maneras a la vez: más filas y ladrillos más duros. La segunda
   * es la que de verdad cambia el juego —un ladrillo de tres golpes obliga a
   * volver al mismo sitio— y por eso entra más tarde.
   */
  function levantarMuro() {
    // Una fila más por muro hasta llenar la pantalla. Con la fórmula anterior
    // el primero y el segundo salían idénticos —mismas filas, misma dureza— y
    // lo único que cambiaba era la velocidad: se notaba a repétido.
    const filas = Math.min(8, 2 + muro);
    const columnas = Math.max(6, Math.min(14, Math.round(campo.ancho / (campo.patoAncho * 1.15))));
    const hueco = 4;
    const ancho = (campo.ancho - hueco * (columnas + 1)) / columnas;
    const alto = Math.max(14, Math.min(30, campo.alto * 0.032));
    // El muro, más abajo de lo que pediría el gusto: cada píxel de hueco entre el
    // muro y la pala es tiempo de pelota volando por nada, y en una pantalla de
    // escritorio ese hueco es enorme.
    const arriba = campo.y0 + Math.max(24, campo.alto * 0.16);

    // Las filas de arriba son las duras, y no es capricho: si estuvieran abajo,
    // el muro se limpiaría de abajo a arriba de una pasada y nunca habría que
    // apuntar. Arriba obligan a abrirse un hueco y colar la pelota por él.
    const plan = planDelMuro(muro);
    const durasArriba = Math.round(filas * plan.parte);

    ladrillos = [];
    for (let f = 0; f < filas; f++) {
      for (let c = 0; c < columnas; c++) {
        // Claros al azar desde el cuarto muro: uno con agujeros se lee mucho
        // mejor que uno macizo, y abre caminos por los que colarse.
        if (muro >= 4 && azar() < 0.10) continue;
        const dureza = f < durasArriba ? plan.base + 1 : plan.base;
        ladrillos.push({
          x: campo.x0 + hueco + c * (ancho + hueco),
          y: arriba + f * (alto + hueco),
          w: ancho,
          h: alto,
          fila: f,
          dureza,
          original: dureza
        });
      }
    }
  }

  // ---- Final -------------------------------------------------------------

  function acabar(motivo) {
    if (terminada) return;
    terminada = true;
    fase = 'fin';

    const esRecord = rotos > 0 && (mejorPrevio === null || rotos > mejorPrevio);
    if (motivo === 'tiempo') ctx.decir('Se acabó el tiempo. Se cierra con lo que llevas.');

    ctx.sonido[esRecord ? 'victoria' : 'derrota']();
    ctx.alTerminar({
      resultado: esRecord ? 'victoria' : 'derrota',
      puntos: rotos,
      detalle: detalleFinal(esRecord)
    });
  }

  function detalleFinal(esRecord) {
    const donde = muro === 1 ? 'en el primer muro' : `hasta el muro ${muro}`;
    const cola = esRecord
      ? (mejorPrevio === null ? ' A ver quién lo mejora.' : ` Récord nuevo: antes eran ${mejorPrevio}.`)
      : (mejorPrevio === null ? '' : ` Tu récord sigue en ${mejorPrevio}.`);
    return `${rotos} ladrillos ${donde}, ${puntos} puntos.${cola}`;
  }

  function marcar() {
    const vidasTxt = '●'.repeat(Math.max(0, vidas)) + '○'.repeat(Math.max(0, VIDAS - vidas));
    const base = `Muro ${muro}  ·  ${vidasTxt}  ·  ${rotos} ladrillos  ·  ${puntos} pts`;
    const record = mejorPrevio === null ? '' : `  ·  récord ${mejorPrevio}`;
    const queda = PRESUPUESTO_MS - transcurrido;
    const prisa = queda < AVISO_MS ? `  ·  ¡${Math.max(0, Math.ceil(queda / 1000))} s!` : '';
    pista.marcador(base + record + prisa);
  }

  // ---- Medidas -----------------------------------------------------------

  /**
   * La pista: la pantalla menos los márgenes, y por abajo hasta el suelo de la
   * mascota, que es donde de verdad está la pala.
   */
  function medirCampo() {
    const m = pista.medidas;
    const margen = Math.max(14, Math.min(40, m.ancho * 0.02));
    pato.setTilt(0);
    pato.setState('idle');
    pato.setY(m.suelo);
    const c = pato.cuerpo();

    const x0 = margen;
    const x1 = Math.max(x0 + 240, m.ancho - margen);
    const y0 = margen;
    // El fondo de la pista es el centro de la pala: por debajo de ahí la pelota
    // ya está perdida y no hay nada que dibujar.
    const y1 = Math.min(m.alto - 4, c.cy);
    return {
      x0, x1, y0, y1,
      ancho: x1 - x0,
      alto: Math.max(160, y1 - y0),
      patoAncho: m.patoAncho,
      palaAncho: Math.max(40, m.patoAncho * 0.72),
      palaAlto: Math.max(18, m.patoAlto * 0.5),
      ventanaAncho: m.ancho,
      ventanaAlto: m.alto
    };
  }

  function sincronizarCampo(p) {
    const m = p.medidas;
    if (m.ancho === campo.ventanaAncho && m.alto === campo.ventanaAlto) return;
    const antes = campo;
    campo = medirCampo();
    aplicarMedidas();
    // Se reescala lo que hay en vez de rehacerlo: cambiar de tamaño la ventana
    // no puede costarte el muro que llevas medio roto.
    const fx = campo.ancho / antes.ancho;
    const fy = campo.alto / antes.alto;
    for (const l of ladrillos) {
      l.x = campo.x0 + (l.x - antes.x0) * fx;
      l.y = campo.y0 + (l.y - antes.y0) * fy;
      l.w *= fx;
      l.h *= fy;
    }
    pelota.x = campo.x0 + (pelota.x - antes.x0) * fx;
    pelota.y = campo.y0 + (pelota.y - antes.y0) * fy;
    pelota.vx *= fx;
    pelota.vy *= fy;
  }

  function aplicarMedidas() {
    pala.w = campo.palaAncho;
    pala.h = campo.palaAlto;
    pelota.radio = Math.max(7, Math.min(13, campo.alto * 0.014));
    pala.destino = Math.max(campo.x0 + pala.w / 2,
      Math.min(campo.x1 - pala.w / 2, pala.destino || (campo.x0 + campo.x1) / 2));
    pato.setY(pista.medidas.suelo);
  }

  // ---- Pintado -----------------------------------------------------------

  function pintar(g) {
    g.save();
    g.fillStyle = 'rgba(20, 20, 30, 0.86)';
    g.fillRect(campo.x0, campo.y0, campo.ancho, campo.y1 - campo.y0);
    g.lineWidth = 5;
    g.strokeStyle = '#fffdf7';
    g.strokeRect(campo.x0, campo.y0, campo.ancho, campo.y1 - campo.y0);
    g.restore();

    for (const l of ladrillos) dibujarLadrillo(g, l);

    g.save();
    g.fillStyle = '#ffb703';
    g.fillRect(pala.x, pala.y, pala.w, pala.h);
    g.lineWidth = 3;
    g.strokeStyle = '#2b2b3a';
    g.strokeRect(pala.x, pala.y, pala.w, pala.h);

    g.beginPath();
    g.arc(pelota.x, pelota.y, pelota.radio, 0, Math.PI * 2);
    g.fillStyle = '#fffdf7';
    g.fill();
    g.restore();
  }

  function dibujarLadrillo(g, l) {
    g.save();
    // El color dice la fila; lo que queda por romper, el brillo. Un ladrillo
    // tocado se ve tocado sin tener que pintarle grietas.
    g.fillStyle = COLORES[l.fila % COLORES.length];
    g.globalAlpha = l.dureza >= l.original ? 1 : 0.55;
    g.fillRect(l.x, l.y, l.w, l.h);
    g.globalAlpha = 1;
    g.lineWidth = 2;
    g.strokeStyle = '#2b2b3a';
    g.strokeRect(l.x, l.y, l.w, l.h);
    if (l.original > 1) {
      g.fillStyle = '#2b2b3a';
      g.font = `700 ${Math.round(l.h * 0.6)}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(l.dureza), l.x + l.w / 2, l.y + l.h / 2);
    }
    g.restore();
  }
}

const COLORES = ['#c1121f', '#fb8500', '#ffb703', '#8ecae6', '#219ebc', '#35a34a', '#a06cd5', '#e0e0e8'];

/**
 * La dureza del muro `m`: una cuesta que NO se acaba.
 *
 * La primera versión tenía tres escalones a mano —dos golpes desde el muro 3,
 * tres desde el 6— y ahí se quedaba. Como las filas también topan en ocho, del
 * muro 7 en adelante lo único que subía era la velocidad de la pelota, que topa
 * en el 12. **Del 12 en adelante el juego no se ponía más difícil.**
 *
 * Ahora la cuesta es una sola regla que se repite para siempre: se van
 * convirtiendo filas de arriba abajo al siguiente número de golpes, y **cuando
 * el muro entero está en ese número, empieza otra vuelta con el siguiente**.
 * Cuatro muros por vuelta.
 *
 *   muro 2 → todo de 1        muro 6  → todo de 2      muro 10 → todo de 3
 *   muro 3 → el cuarto de arriba de 2   muro 7 → el cuarto de arriba de 3
 *   muro 4 → la mitad de arriba de 2    muro 8 → la mitad de arriba de 3
 *   muro 5 → tres cuartos de 2          muro 9 → tres cuartos de 3
 *
 * Y de ahí a los de cuatro golpes, y a los de cinco, sin techo.
 *
 * @param {number} muro
 * @returns {{base:number, parte:number}} el suelo de dureza del muro, y qué
 *   proporción de las filas de ARRIBA lleva ya un golpe más.
 */
export function planDelMuro(muro) {
  const avance = Math.max(0, (Number(muro) || 1) - INICIO_DUREZA);
  return {
    base: 1 + Math.floor(avance / PASOS_POR_DUREZA),
    parte: (avance % PASOS_POR_DUREZA) / PASOS_POR_DUREZA
  };
}

/** Desde qué muro empieza a endurecerse. Antes de él, todo de un golpe. */
const INICIO_DUREZA = 2;
/** Cuántos muros cuesta convertir uno entero al siguiente número de golpes. */
const PASOS_POR_DUREZA = 4;

/**
 * Lo que vale un ladrillo, según lo que costaba tirarlo.
 *
 * Fórmula y no tabla, porque la dureza ya no tiene techo. Da 10, 30, 60, 100,
 * 150…: crece más deprisa que el esfuerzo, que es lo que hace que valga la pena
 * meterse con las filas de arriba en vez de barrer las de abajo.
 */
export function puntosDe(dureza) {
  const d = Math.max(1, Math.round(dureza) || 1);
  return 5 * d * (d + 1);
}
