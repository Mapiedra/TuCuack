// «Angry {mascota}»: lanzar a la mascota contra cosas que se vienen abajo.
//
// ---- El riesgo, que estaba escrito antes de empezar -------------------------
//
// El catálogo avisaba de esto: «que se parezca demasiado a Pato Hook. Si los
// derrumbes no se disfrutan, es Pato Hook con decorado». Y el lanzamiento es,
// literalmente, el de «Pato Hook»: mismo `limitarLanzamiento`, mismo
// `arrancarVuelo`, misma forma de apuntar. Eso es a propósito —quien sabe lanzar
// a su mascota ya sabe jugar— pero significa que lo nuevo tiene que estar
// entero en la otra mitad.
//
// Así que la regla de diseño de este juego es una sola:
//
//   **En «Pato Hook» el tiro ES el juego. Aquí el tiro es la mitad: lo que
//   cuenta pasa DESPUÉS de que la mascota se pare.**
//
// De ahí sale todo lo demás. Las gaviotas están METIDAS en la estructura, casi
// nunca a tiro directo, y la mayoría no se derriban de un golpe: se derriban
// porque les cae encima lo que sostenía la columna que has roto. La decisión no
// es «dónde está el bicho» sino «qué quito para que se le caiga el techo».
//
// ---- El derrumbe, sin motor de físicas -------------------------------------
//
// El derrumbe de verdad —cajas que giran, se apoyan y se vencen de lado— es un
// motor de cuerpos rígidos: contactos en reposo, rotación, fricción y un
// solucionador iterativo. Es exactamente lo que se decidió NO escribir para el
// montón de «The Hole», y por los mismos motivos.
//
// Aquí las piezas **no giran**: caen a plomo, como en el plan. Pero eso solo no
// basta, y el problema se ve en cuanto se dibuja el primer nivel:
//
//   **Una viga apoyada en dos columnas no puede caer nunca.** Le quitas una
//   columna y la otra sigue justo debajo, así que no tiene sitio donde caer. En
//   un motor de verdad se vencería hacia el lado vacío; sin rotación se queda
//   ahí colgada, tan pancha, y el derrumbe no ocurre.
//
// La salida no es añadir rotación, es cambiar lo que hace una viga cuando se
// queda sin apoyo: **se parte**. Una pieza de más de una casilla que pierde el
// apoyo se rompe en trozos de una casilla, y cada trozo cae por su cuenta. Los
// que estaban sobre el hueco se van abajo —y aplastan lo que haya— y los que
// quedaban sobre la columna que aguanta se quedan.
//
// Es lo que hace una viga de verdad cuando le quitas medio apoyo, se lee de un
// vistazo, y da la cadena de derrumbes entera sin un solo iterador de impulsos.
//
// Y el apoyo se mira así: **por el centro, o por los dos extremos**. Una viga
// sobre dos columnas se sostiene por los extremos; si cae una, ya no tiene ni
// centro ni los dos extremos, y se parte. Una pieza de una casilla tiene el
// centro y los extremos en el mismo sitio, así que para ella la regla es la de
// siempre: si no hay nada debajo, cae.
//
// ---- Los materiales ---------------------------------------------------------
//
// Tres, y cada uno dice qué hacer con él:
//
//   * **hielo** — se rompe con cualquier cosa y casi no frena. Es el que se pone
//     donde quieres que el jugador pase de largo.
//   * **madera** — se rompe con un tiro decente y frena bastante. Es el material
//     de las columnas: lo que se quita para que caiga el techo.
//   * **piedra** — sólo se rompe con un tiro fuerte y directo. Casi siempre es
//     una pared que devuelve, no algo que romper. Sirve de peso: cuando la
//     piedra cae, lo que haya debajo no lo cuenta.
//
// ---- La cuesta --------------------------------------------------------------
//
// Diez estructuras dibujadas a mano y, a partir de ahí, **generadas**. No es
// pereza: los ladrillos ya enseñaron que un juego con techo se acaba, y una
// marca con tope de diez la empata todo el mundo. Las de a mano enseñan; las
// generadas no se acaban nunca.

import { sembrar } from './azar.js';
import { MARCADOR_ABAJO, AIRE_MARCADOR } from './lienzo.js';

/**
 * La física de los tiros.
 *
 * Es la de «Pato Hook» con dos cambios: rebota menos en las paredes —aquí el
 * tiro de banda no es la jugada bonita, la jugada bonita es el derrumbe— y cae
 * un poco más rápido, para que el arco quede más corto y la estructura se pueda
 * poner más cerca sin que todo se resuelva con tiros altísimos.
 */
function ajustesDeTiro(fisica) {
  return fisica.conAjustes({
    GRAVEDAD: 1650,
    ROZAMIENTO_AIRE: 0.3,
    PLANEO_UMBRAL: 0,
    REBOTE_PARED: 0.5,
    REBOTE_SUELO: 0.34,
    REBOTE_TECHO: 0.4
  });
}

/**
 * Los tres materiales.
 *
 * `rompe` es la velocidad de la mascota, en píxeles por segundo, a partir de la
 * cual la pieza revienta en vez de devolver. El lanzamiento más fuerte que
 * permite la física son 2600, así que la piedra pide casi un tiro a bocajarro.
 * `freno` es lo que le queda a la mascota después de atravesarla.
 */
const MATERIALES = {
  '~': { id: 'hielo', color: '#a8dadc', borde: '#6fa8ac', rompe: 240, freno: 0.9 },
  '=': { id: 'madera', color: '#c98a4b', borde: '#8a5a2b', rompe: 700, freno: 0.56 },
  '#': { id: 'piedra', color: '#98a2b3', borde: '#5f6a7d', rompe: 1500, freno: 0.3 }
};

/** Lo que devuelve una pieza que NO se ha roto. */
const REBOTE_PIEZA = 0.44;

/** Gravedad de los escombros. Más que la de la mascota: caen secos. */
const GRAVEDAD_ESCOMBRO = 2400;
/** Y su velocidad máxima, para que no se salten una gaviota entre fotogramas. */
const CAIDA_MAX = 1400;
/** Hueco por debajo que todavía cuenta como estar apoyado. */
const APOYO_MAX = 3;

/**
 * Lo que tiene que poder caer una pieza para que le compense.
 *
 * Por debajo de esto no cae: se queda donde está. Sin este mínimo, una pieza
 * apoyada con un píxel de holgura se pasaría la partida temblando.
 */
const CAIDA_MINIMA = 2;

/** Tiros por estructura. */
const TIROS = 4;
/** Y los que se llevan de premio a la siguiente por cada gaviota de más. */
const TIRO_EXTRA_CADA = 3;

/** Lo que se espera entre un tiro y el siguiente, para ver cómo ha quedado. */
const RESPIRO_MS = 700;
/** Tope por tiro: una mascota rebotando entre dos paredes no acaba sola. */
const TIRO_MAX_MS = 8000;
/** Lo que la estructura tiene que estar quieta para darla por asentada. */
const ASENTADA_S = 0.35;

/** Cuánto de la pantalla hay que arrastrar para el lanzamiento más fuerte. */
const ALCANCE = 0.45;
/** Lo que se enseña de la trayectoria al apuntar: la salida, no el final. */
const PREVIO_S = 0.45;
const PREVIO_PASO_S = 1 / 60;

/**
 * Presupuesto del juego, por debajo del tope del préstamo del escenario.
 *
 * El escenario corta a los diez minutos y lo hace SIN resultado (ver
 * `TOPE_PARTIDA_MS` en escenario.js), así que una tirada larga podría acabar en
 * nada. Con esto el juego llega antes y cierra él, con lo que lleve.
 */
const PRESUPUESTO_MS = 8.5 * 60 * 1000;
const AVISO_MS = 60 * 1000;

/**
 * Las diez de a mano.
 *
 * Cada fila es una fila de casillas, de arriba abajo, y la última se apoya en el
 * suelo. `~` hielo, `=` madera, `#` piedra, `o` gaviota, espacio nada.
 *
 * Todas siguen la misma regla de diseño: la gaviota está en un hueco con **sitio
 * libre encima**, para que lo que se rompa arriba tenga por dónde caerle. Una
 * gaviota metida en un nicho de piedra cerrado es un nivel imposible, no un
 * nivel difícil.
 */
export const ESTRUCTURAS = [
  // 1. La lección: no le tires a la gaviota, tírale a la columna.
  [
    '  ~  ',
    ' === ',
    ' =o= '
  ],
  // 2. Dos gaviotas y un techo de piedra: se llevan las dos de una.
  [
    ' ##### ',
    ' =   = ',
    ' =o o= '
  ],
  // 3. Dos alturas. Lo de arriba se viene abajo al partirse su suelo.
  [
    '  ~~~  ',
    '  =o=  ',
    ' ##### ',
    ' =   = ',
    ' = o = '
  ],
  // 4. Piedra en los cimientos: hay que romper la madera de en medio.
  [
    ' ===== ',
    ' =   = ',
    ' = o = ',
    ' #   # '
  ],
  // 5. Dos torres gemelas, y el hielo de en medio invitando a pasar de largo.
  [
    ' ===   === ',
    ' = =   = = ',
    ' =o=   =o= ',
    ' ### ~ ### '
  ],
  // 6. Un puente largo sobre dos patas. Se parte por donde le des.
  [
    ' ######### ',
    ' =       = ',
    ' = o   o = '
  ],
  // 7. Escalera: lo de arriba cae sobre lo de abajo.
  [
    '     ~~~ ',
    '     =o= ',
    ' ####### ',
    ' =     = ',
    ' = o   = '
  ],
  // 8. Tres gaviotas bajo el mismo techo, y sólo dos patas.
  [
    ' ######### ',
    ' =       = ',
    ' =o= o =o= '
  ],
  // 9. La caja fuerte: piedra arriba y abajo, madera sólo en los lados.
  [
    '  #######  ',
    '  =     =  ',
    '  = o o =  ',
    '  #     #  '
  ],
  // 10. Todo junto, y alta.
  [
    '   #####   ',
    '   =   =   ',
    '   = o =   ',
    ' ######### ',
    ' =       = ',
    ' =o     o= '
  ]
];

export function crearPartida(ctx) {
  const pista = ctx.escenario;
  const { fisica, vuelo, pato, entrada } = pista;

  const mejorPrevio = typeof ctx.marcas.mejor === 'number' ? ctx.marcas.mejor : null;
  const azar = sembrar(ctx.semilla);

  /** 'apuntando' | 'volando' | 'derrumbe' | 'espera' | 'fin' */
  let fase = 'apuntando';
  let terminada = false;
  let transcurrido = 0;
  let pulsadoAntes = false;

  /** En cuál vamos, empezando por cero. */
  let estructura = 0;
  /** Las que se han derribado enteras: es la marca. */
  let derribadas = 0;
  let gaviotasCaidas = 0;
  let tiros = TIROS;

  let tiempoDeVuelo = 0;
  let espera = 0;
  let quieta = 0;
  /** El centro del cuerpo en el fotograma anterior, para no perder un impacto. */
  let anterior = null;

  pista.ajustes = ajustesDeTiro(fisica);

  let rejilla = medirRejilla(pista.medidas);
  /** @type {{x:number,y:number,w:number,h:number,mat:string,rota:boolean,vy:number,cayendo:boolean}[]} */
  let piezas = [];
  /** @type {{x:number,y:number,r:number,viva:boolean,vy:number}[]} */
  let gaviotas = [];
  let salida = { x: 0, y: 0 };

  montarEstructura();
  colocarEnLaSalida();
  marcar();

  return { actualizar, destroy };

  function destroy() { terminada = true; }

  // ---- Un fotograma ------------------------------------------------------

  function actualizar(dt, p) {
    if (terminada) return;
    sincronizar(p.medidas);

    const antes = transcurrido;
    transcurrido += dt * 1000;
    if (transcurrido >= PRESUPUESTO_MS && fase !== 'volando' && fase !== 'derrumbe') {
      cerrarPorTiempo();
      return;
    }
    if (PRESUPUESTO_MS - transcurrido < AVISO_MS
      && Math.ceil(antes / 1000) !== Math.ceil(transcurrido / 1000)) marcar();

    // El derrumbe corre SIEMPRE, también mientras la mascota vuela: si no, lo
    // que tiras al principio del vuelo se queda flotando hasta que se pare.
    const semueve = derrumbar(dt);

    if (fase === 'volando') {
      volar(dt, p);
    } else if (fase === 'derrumbe') {
      quieta = semueve ? 0 : quieta + dt;
      if (quieta >= ASENTADA_S) decidirDespuesDelTiro();
    } else if (fase === 'espera') {
      espera -= dt * 1000;
      if (espera <= 0) siguienteTiro();
    } else if (fase === 'apuntando') {
      apuntar(p.medidas);
    }

    pintar(p, p.medidas);
  }

  // ---- Apuntar -----------------------------------------------------------

  function apuntar(medidas) {
    const tiro = tiroDelCursor(medidas);
    pato.setFacing(tiro.vx >= 0 ? 1 : -1);

    // Se dispara al SOLTAR y no al pulsar, como en «Pato Hook»: con cuatro tiros
    // por estructura, gastar uno sin querer duele.
    if (pulsadoAntes && !entrada.pulsado) {
      pulsadoAntes = false;
      lanzar(tiro);
      return;
    }
    pulsadoAntes = entrada.pulsado;
  }

  /** Hacia el cursor, y con la fuerza que dé la distancia. Igual que Hook. */
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
    tiros--;
    fisica.arrancarVuelo(vuelo, { x: salida.x, y: salida.y, vx: tiro.vx, vy: tiro.vy });
    ctx.sonido.boing(0.7);
    marcar();
  }

  // ---- Volar -------------------------------------------------------------

  function volar(dt, p) {
    tiempoDeVuelo += dt * 1000;

    const sucesos = fisica.paso(vuelo, dt, p.limites(), p.ajustes);
    if (sucesos.pared) ctx.sonido.boing(Math.min(0.5, sucesos.pared));
    fisica.aplicar(pato, vuelo, p.ajustes);

    if (mirarChoques()) fisica.aplicar(pato, vuelo, p.ajustes);

    if (sucesos.posado || tiempoDeVuelo > TIRO_MAX_MS) {
      anterior = null;
      fase = 'derrumbe';
      quieta = 0;
    }
  }

  /**
   * La mascota contra las gaviotas y contra las piezas.
   *
   * @returns {boolean} si ha tocado el vuelo y hay que volver a aplicarlo
   */
  function mirarChoques() {
    const cuerpo = pato.cuerpo();
    const desde = anterior;
    anterior = { x: cuerpo.cx, y: cuerpo.cy };

    for (const g of gaviotas) {
      if (!g.viva) continue;
      // Con el tramo recorrido y no sólo con la posición de ahora: a mil píxeles
      // por segundo, entre dos fotogramas se cruza una gaviota sin tocarla en
      // ninguno de los dos.
      const dist = desde
        ? distanciaASegmento(g.x, g.y, desde.x, desde.y, cuerpo.cx, cuerpo.cy)
        : Math.hypot(g.x - cuerpo.cx, g.y - cuerpo.cy);
      if (dist <= g.r + cuerpo.radio) tumbarGaviota(g, 'directo');
    }

    // Una pieza por fotograma: encadenar dos rebotes en el mismo cuadro deja a
    // la mascota en sitios raros, y con subpasos esto no hace falta.
    for (const p of piezas) {
      if (p.rota || p.cayendo) continue;
      if (!tocaCirculo(p, cuerpo)) continue;
      return chocarConPieza(p, cuerpo);
    }
    return false;
  }

  /**
   * Romper o rebotar, según con qué venga.
   *
   * @returns {boolean} si se ha tocado el vuelo
   */
  function chocarConPieza(p, cuerpo) {
    // La velocidad, en píxeles por segundo. Da igual el signo de la Y: lo que
    // decide es con cuánta fuerza llega.
    const velocidad = Math.hypot(vuelo.vx, vuelo.vy);
    const mat = MATERIALES[p.mat];

    if (velocidad >= mat.rompe) {
      p.rota = true;
      vuelo.vx *= mat.freno;
      vuelo.vy *= mat.freno;
      ctx.sonido.nota(mat.id === 'hielo' ? 1200 : mat.id === 'madera' ? 420 : 190, 0.08);
      return true;
    }

    // No la rompe: rebota. La normal sale del punto de la caja más cercano al
    // centro del cuerpo, que es lo mismo que hace el minigolf con sus muros.
    const px = Math.max(p.x, Math.min(cuerpo.cx, p.x + p.w));
    const py = Math.max(p.y, Math.min(cuerpo.cy, p.y + p.h));
    let nx = cuerpo.cx - px;
    let ny = cuerpo.cy - py;
    let d = Math.hypot(nx, ny);
    if (d < 0.0001) {
      // El centro está DENTRO de la caja: se sale por la cara más cercana.
      const izq = cuerpo.cx - p.x;
      const der = p.x + p.w - cuerpo.cx;
      const arr = cuerpo.cy - p.y;
      const aba = p.y + p.h - cuerpo.cy;
      const min = Math.min(izq, der, arr, aba);
      nx = min === izq ? -1 : min === der ? 1 : 0;
      ny = min === arr ? -1 : min === aba ? 1 : 0;
      d = 1;
    }
    nx /= d;
    ny /= d;

    // Fuera de la pieza. La Y de la pantalla baja y la del vuelo sube, así que
    // el empujón vertical va con el signo cambiado.
    const empuje = cuerpo.radio - d + 0.5;
    vuelo.x += nx * empuje;
    vuelo.y -= ny * empuje;

    // Y el rebote, en coordenadas de pantalla, que es donde vive la normal.
    const vy = -vuelo.vy;
    const proy = vuelo.vx * nx + vy * ny;
    if (proy < 0) {
      vuelo.vx = (vuelo.vx - 2 * proy * nx) * REBOTE_PIEZA;
      vuelo.vy = -((vy - 2 * proy * ny) * REBOTE_PIEZA);
    }
    ctx.sonido.boing(Math.min(0.4, Math.hypot(vuelo.vx, vuelo.vy) / 2600));
    return true;
  }

  // ---- El derrumbe -------------------------------------------------------
  //
  // Lo gordo no está aquí: está abajo, en `derrumbarMundo`, que es pura y sólo
  // toca las piezas que se le pasan. Es la misma leccción del billar: encerrado
  // en este cierre, un derrumbe no se puede comprobar sin abrir una ventana y
  // mirar, y mirar no es medir. Aquí queda lo que depende de la partida: el
  // sonido y la cuenta de gaviotas.

  function derrumbar(dt) {
    const parte = derrumbarMundo(piezas, gaviotas, rejilla, dt);
    for (const g of parte.aplastadas) tumbarGaviota(g, 'aplastada');
    if (parte.partidas) ctx.sonido.nota(300, 0.05);
    if (parte.posadas) ctx.sonido.nota(150, 0.04);
    return parte.movido;
  }

  function tumbarGaviota(g, como) {
    if (!g.viva) return;
    g.viva = false;
    gaviotasCaidas++;
    ctx.sonido.nota(como === 'directo' ? 880 : 660, 0.12);
    marcar();
  }

  // ---- Entre tiros -------------------------------------------------------

  function decidirDespuesDelTiro() {
    if (gaviotas.every((g) => !g.viva)) { limpiarEstructura(); return; }
    if (tiros <= 0) { acabar(); return; }
    fase = 'espera';
    espera = RESPIRO_MS;
  }

  function limpiarEstructura() {
    derribadas++;
    estructura++;
    // Los tiros que sobran no se pierden del todo: uno de premio por cada tres.
    // Sin esto, resolver una estructura de un tiro no da nada, y ésa es
    // justamente la jugada que hay que premiar.
    const premio = Math.floor(Math.max(0, tiros) / TIRO_EXTRA_CADA);
    ctx.decir(tiros > 0
      ? `¡Abajo! Te sobraban ${tiros} ${tiros === 1 ? 'tiro' : 'tiros'}.`
      : '¡Abajo!');
    ctx.pato.animar('happy', 900);
    montarEstructura();
    tiros = TIROS + premio;
    fase = 'espera';
    espera = RESPIRO_MS;
  }

  function siguienteTiro() {
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

  // ---- Montar ------------------------------------------------------------

  function montarEstructura() {
    const mapa = estructura < ESTRUCTURAS.length
      ? ESTRUCTURAS[estructura]
      : generarEstructura(estructura, azar);
    rejilla = medirRejilla(pista.medidas, mapa);
    const puesto = colocarMapa(mapa, rejilla);
    piezas = puesto.piezas;
    gaviotas = puesto.gaviotas;
    salida = {
      x: Math.max(0, pista.medidas.ancho * 0.08),
      y: pista.medidas.suelo
    };
  }

  /**
   * La ventana puede cambiar de tamaño a mitad. Se REESCALA lo que hay en vez de
   * volver a montar: montar de nuevo sería regalarle al jugador la estructura
   * entera de vuelta y borrarle los tiros gastados.
   */
  function sincronizar(medidas) {
    const nueva = medirRejilla(medidas, null, rejilla.cols, rejilla.filas);
    if (nueva.celda === rejilla.celda && nueva.x0 === rejilla.x0
      && nueva.suelo === rejilla.suelo) return;

    const k = nueva.celda / rejilla.celda;
    const mover = (x, y) => ({
      x: nueva.x0 + (x - rejilla.x0) * k,
      y: nueva.suelo - (rejilla.suelo - y) * k
    });
    for (const p of piezas) {
      const m = mover(p.x, p.y);
      p.x = m.x;
      p.y = m.y;
      p.w *= k;
      p.h *= k;
    }
    for (const g of gaviotas) {
      const m = mover(g.x, g.y);
      g.x = m.x;
      g.y = m.y;
      g.r *= k;
    }
    rejilla = nueva;
    salida = { x: Math.max(0, medidas.ancho * 0.08), y: medidas.suelo };
  }

  // ---- Final -------------------------------------------------------------

  function cerrarPorTiempo() {
    ctx.decir('Se acabó el tiempo.');
    acabar();
  }

  function acabar() {
    if (terminada) return;
    terminada = true;
    fase = 'fin';

    // Se gana batiendo tu marca, como en los demás juegos de uno solo: no hay
    // rival al que ganar, y «has derribado tres» no es ni victoria ni derrota
    // hasta que se compara con lo que hiciste la vez anterior.
    const esRecord = mejorPrevio === null || derribadas > mejorPrevio;
    const resultado = esRecord && derribadas > 0 ? 'victoria' : 'derrota';

    ctx.sonido[resultado === 'victoria' ? 'victoria' : 'derrota']();
    ctx.alTerminar({
      resultado,
      puntos: derribadas,
      detalle: detalleFinal(esRecord)
    });
  }

  function detalleFinal(esRecord) {
    const cuantas = derribadas === 0 ? 'Ni una estructura'
      : derribadas === 1 ? 'Una estructura' : `${derribadas} estructuras`;
    const aves = `${gaviotasCaidas} ${gaviotasCaidas === 1 ? 'gaviota' : 'gaviotas'}`;
    const cola = esRecord && derribadas > 0
      ? (mejorPrevio === null ? ' Estrenas marca.' : ` Récord: antes eran ${mejorPrevio}.`)
      : mejorPrevio !== null ? ` Tu récord sigue en ${mejorPrevio}.` : '';
    return `${cuantas} abajo, con ${aves}.${cola}`;
  }

  function marcar() {
    const queda = PRESUPUESTO_MS - transcurrido;
    const prisa = queda < AVISO_MS ? `  ·  ¡${Math.max(0, Math.ceil(queda / 1000))} s!` : '';
    const vivas = gaviotas.filter((g) => g.viva).length;
    const record = mejorPrevio === null ? '' : `  ·  récord ${mejorPrevio}`;
    pista.marcador(`Estructura ${estructura + 1}  ·  ${vivas} por derribar  ·  `
      + `${Math.max(0, tiros)} ${tiros === 1 ? 'tiro' : 'tiros'}${record}${prisa}`);
  }

  // ---- Pintado -----------------------------------------------------------

  function pintar(p, medidas) {
    const g = p.pintor;
    dibujarSuelo(g, medidas);
    for (const pieza of piezas) { if (!pieza.rota) dibujarPieza(g, pieza); }
    dibujarGaviotas(g, medidas);
    if (fase === 'apuntando') dibujarPrevia(g, p, medidas);
  }

  function dibujarSuelo(g, medidas) {
    g.save();
    g.fillStyle = 'rgba(120, 92, 60, 0.5)';
    g.fillRect(0, rejilla.suelo, medidas.ancho, Math.max(4, medidas.alto - rejilla.suelo));
    g.restore();
  }

  function dibujarPieza(g, p) {
    const mat = MATERIALES[p.mat] || MATERIALES['='];
    g.save();
    g.fillStyle = mat.color;
    g.fillRect(p.x, p.y, p.w, p.h);
    g.lineWidth = 2;
    g.strokeStyle = mat.borde;
    g.strokeRect(p.x + 1, p.y + 1, p.w - 2, p.h - 2);
    // Las juntas: sin ellas una viga de cinco casillas parece una losa y no se
    // entiende por qué se parte en trozos.
    if (p.w > rejilla.celda * 1.5) {
      g.globalAlpha = 0.45;
      g.beginPath();
      for (let x = p.x + rejilla.celda; x < p.x + p.w - 1; x += rejilla.celda) {
        g.moveTo(x, p.y + 3);
        g.lineTo(x, p.y + p.h - 3);
      }
      g.stroke();
    }
    g.restore();
  }

  function dibujarGaviotas(g, medidas) {
    const talla = Math.max(18, Math.min(rejilla.celda * 0.8, medidas.patoAncho * 0.5));
    g.save();
    g.font = `${Math.round(talla)}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const gv of gaviotas) {
      if (!gv.viva) continue;
      g.fillText('🐦', gv.x, gv.y);
    }
    g.restore();
  }

  /** La salida del tiro, como en «Pato Hook»: el principio, no el final. */
  function dibujarPrevia(g, p, medidas) {
    const tiro = tiroDelCursor(medidas);
    if (Math.hypot(tiro.vx, tiro.vy) < 60) return;

    const cuerpo = pato.cuerpo();
    const v = fisica.crearVuelo({ x: salida.x, y: salida.y, vx: tiro.vx, vy: tiro.vy, volando: true });
    const limites = p.limites();

    g.save();
    g.fillStyle = 'rgba(255, 255, 255, 0.8)';
    let t = 0;
    while (t < PREVIO_S) {
      fisica.paso(v, PREVIO_PASO_S, limites, p.ajustes);
      t += PREVIO_PASO_S;
      const x = v.x + (cuerpo.cx - salida.x);
      const y = p.aPantalla(v.y) - (p.aPantalla(salida.y) - cuerpo.cy);
      g.beginPath();
      g.arc(x, y, 2.5, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
}

// ---- El derrumbe -----------------------------------------------------------
//
// Pura: recibe las piezas, las gaviotas y la rejilla, y no sabe nada de la
// partida. Así se pueden derribar mil estructuras en Node y contar qué pasa, que
// es la única forma de saber si un derrumbe encadena o se queda a medias.

/** @typedef {{x:number,y:number,w:number,h:number,mat:string,rota:boolean,vy:number,cayendo:boolean}} Pieza */

/**
 * Un fotograma de escombros.
 *
 * @returns {{movido:boolean, aplastadas:Object[], partidas:number, posadas:number}}
 *   `movido` dice si algo se ha movido —con eso se sabe cuándo ha asentado— y
 *   `aplastadas` son las gaviotas que se ha llevado por delante lo que caía.
 */
export function derrumbarMundo(piezas, gaviotas, rejilla, dt) {
  const parte = { movido: false, aplastadas: [], partidas: 0, posadas: 0 };

  // Primero, quién se ha quedado sin apoyo. En una pasada aparte para que
  // partir una viga no le cambie el suelo a las demás a media lista.
  const sueltas = [];
  for (const p of piezas) {
    if (p.rota || p.cayendo) continue;
    if (!soportada(p, piezas, rejilla)) sueltas.push(p);
  }
  for (const p of sueltas) {
    if (p.rota || p.cayendo) continue;
    if (soportada(p, piezas, rejilla)) continue;
    if (soltarPieza(p, piezas, rejilla)) parte.partidas++;
    parte.movido = true;
  }

  for (const p of piezas) {
    if (p.rota || !p.cayendo) continue;
    parte.movido = true;
    if (caer(p, piezas, gaviotas, rejilla, dt, parte)) parte.posadas++;
  }

  for (const g of gaviotas) {
    if (!g.viva) continue;
    if (caerGaviota(g, piezas, rejilla, dt)) parte.movido = true;
  }
  return parte;
}

/**
 * Una pieza se queda sin apoyo.
 *
 * Si es de más de una casilla, **se parte**: es la regla que hace que un
 * derrumbe ocurra sin rotación (ver la cabecera del fichero). Si es de una, cae.
 *
 * @returns {boolean} si se ha partido
 */
export function soltarPieza(p, piezas, rejilla) {
  if (p.w > rejilla.celda * 1.5) {
    p.rota = true;
    const trozos = Math.round(p.w / rejilla.celda);
    for (let i = 0; i < trozos; i++) {
      piezas.push({
        x: p.x + i * rejilla.celda, y: p.y,
        w: rejilla.celda, h: p.h,
        mat: p.mat, rota: false, vy: 0, cayendo: true
      });
    }
    return true;
  }
  p.cayendo = true;
  p.vy = 0;
  return false;
}

/** @returns {boolean} si ha llegado al suelo en este fotograma */
function caer(p, piezas, gaviotas, rejilla, dt, parte) {
  p.vy = Math.min(CAIDA_MAX, p.vy + GRAVEDAD_ESCOMBRO * dt);
  const antes = p.y;
  p.y += p.vy * dt;

  const tope = sueloBajo(p, antes, piezas, rejilla);
  let posada = false;
  if (p.y + p.h >= tope) {
    p.y = tope - p.h;
    p.vy = 0;
    p.cayendo = false;
    posada = true;
  }
  aplastar(p, antes, gaviotas, parte);
  return posada;
}

/** Lo que una pieza que baja se lleva por delante. */
function aplastar(p, antesY, gaviotas, parte) {
  for (const g of gaviotas) {
    if (!g.viva) continue;
    if (g.x < p.x - g.r || g.x > p.x + p.w + g.r) continue;
    // El tramo barrido, no sólo dónde está ahora: a mil cuatrocientos píxeles
    // por segundo un escombro cruza una gaviota entera entre dos fotogramas.
    if (g.y >= antesY - g.r && g.y <= p.y + p.h + g.r) parte.aplastadas.push(g);
  }
}

function caerGaviota(g, piezas, rejilla, dt) {
  const caja = { x: g.x - g.r, y: g.y - g.r, w: g.r * 2, h: g.r * 2 };
  const tope = sueloBajo(caja, caja.y, piezas, rejilla);
  if (caja.y + caja.h >= tope - 0.5) { g.vy = 0; return false; }
  g.vy = Math.min(CAIDA_MAX, g.vy + GRAVEDAD_ESCOMBRO * dt);
  g.y = Math.min(g.y + g.vy * dt, tope - g.r);
  return true;
}

/**
 * ¿Se sostiene? **El centro tiene que caer entre el apoyo más a la izquierda y
 * el más a la derecha.**
 *
 * Es la condición de verdad de una viga: si su centro de masas se sale de los
 * apoyos, vuelca. Y es lo único que hace falta, porque las piezas son uniformes.
 *
 * La primera versión decía «por el centro, o por los dos extremos», que suena
 * parecido y no lo es: con eso, una viga de nueve casillas sobre cinco columnas
 * no se venía abajo por mucho que le quitaras, porque siempre le quedaba el
 * centro o los dos extremos. Se vio midiendo —dos estructuras enteras en las que
 * romper madera no derribaba una sola gaviota— y no jugando.
 *
 * Para una pieza de una casilla hay un solo apoyo posible, así que se reduce a
 * «¿hay algo debajo?», que es lo que tiene que ser.
 */
export function soportada(p, piezas, rejilla) {
  if (p.y + p.h >= rejilla.suelo - 0.5) return true;

  const celdas = Math.max(1, Math.round(p.w / rejilla.celda));
  const ancho = p.w / celdas;
  let izq = -1;
  let der = -1;
  for (let i = 0; i < celdas; i++) {
    const x = p.x + (i + 0.5) * ancho;
    if (!hayApoyo(p, x, piezas)) continue;
    if (izq < 0) izq = x;
    der = x;
  }
  if (izq < 0) return false;   // nada debajo: cae a plomo

  // Media casilla de holgura: sin ella, una viga apoyada justo en su casilla
  // central se quedaría en el filo y temblaría.
  const centro = p.x + p.w / 2;
  return centro >= izq - ancho * 0.5 && centro <= der + ancho * 0.5;
}

function hayApoyo(p, x, piezas) {
  for (const q of piezas) {
    if (q === p || q.rota || q.cayendo) continue;
    if (x < q.x || x > q.x + q.w) continue;
    const hueco = q.y - (p.y + p.h);
    if (hueco >= -APOYO_MAX && hueco <= APOYO_MAX) return true;
  }
  return false;
}

/** La Y del primer techo que hay bajo una caja: otra pieza, o el suelo. */
function sueloBajo(caja, desdeY, piezas, rejilla) {
  let tope = rejilla.suelo;
  for (const q of piezas) {
    if (q === caja || q.rota || q.cayendo) continue;
    if (q.x + q.w <= caja.x + 1 || q.x >= caja.x + caja.w - 1) continue;
    // A mi altura o por encima: ése no es mi suelo, es mi vecino.
    if (q.y < desdeY + caja.h - CAIDA_MINIMA) continue;
    if (q.y < tope) tope = q.y;
  }
  return tope;
}

// ---- Geometría -------------------------------------------------------------

/** ¿La caja toca el círculo? */
function tocaCirculo(p, cuerpo) {
  const px = Math.max(p.x, Math.min(cuerpo.cx, p.x + p.w));
  const py = Math.max(p.y, Math.min(cuerpo.cy, p.y + p.h));
  return Math.hypot(cuerpo.cx - px, cuerpo.cy - py) <= cuerpo.radio;
}

function distanciaASegmento(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const largo = dx * dx + dy * dy;
  if (largo === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / largo));
  return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
}

// ---- Medidas ---------------------------------------------------------------

/**
 * Dónde cae la rejilla de la estructura.
 *
 * A la derecha, apoyada en el suelo, y por debajo del marcador —que va POR
 * ENCIMA del lienzo y taparía las plantas de arriba de una torre alta—.
 *
 * Cuando se le pasa un mapa, se dimensiona para ese mapa; cuando se le pasan
 * `cols` y `filas` es que se está recolocando una estructura ya montada.
 */
export function medirRejilla(medidas, mapa, cols, filas) {
  const anchoMapa = mapa ? Math.max(...mapa.map((f) => f.length)) : (cols || 7);
  const altoMapa = mapa ? mapa.length : (filas || 4);

  // La línea del suelo, en coordenadas de PANTALLA. Las piezas viven en
  // pantalla —es donde se pintan y donde caen— y sólo la mascota vive en
  // coordenadas de vuelo, que es al revés. Se convierte aquí una vez.
  const sueloY = medidas.alto - medidas.suelo;
  const arriba = MARCADOR_ABAJO + AIRE_MARCADOR;

  // La estructura ocupa la franja derecha: la mascota sale del 8 % y entre las
  // dos tiene que caber el arco entero.
  const zonaX = medidas.ancho * 0.55;
  const zonaAncho = medidas.ancho - zonaX - 12;
  const zonaAlto = Math.max(80, sueloY - arriba);
  // El tope va atado al tamaño de la mascota y no a un número suelto: un
  // bloque más o menos como ella se lee de un vistazo como algo que se puede
  // mover de un golpe. Con 74 fijos, en una pantalla grande la estructura
  // quedaba de juguete en una esquina.
  const tope = Math.max(40, medidas.patoAncho * 1.05);
  const celda = Math.max(18, Math.min(zonaAncho / anchoMapa, zonaAlto / altoMapa, tope));

  return {
    celda,
    cols: anchoMapa,
    filas: altoMapa,
    // Centrada en su franja: con el mapa estrecho, si no, se queda pegada a la
    // izquierda de la zona y la mitad derecha de la pantalla sobra.
    x0: zonaX + Math.max(0, (zonaAncho - celda * anchoMapa) / 2),
    suelo: sueloY
  };
}

/** Pasa un mapa de texto a piezas y gaviotas, en píxeles. */
export function colocarMapa(mapa, rejilla) {
  const piezas = [];
  const gaviotas = [];
  const alto = mapa.length;

  for (let f = 0; f < alto; f++) {
    const fila = mapa[f];
    const y = rejilla.suelo - (alto - f) * rejilla.celda;
    let c = 0;
    while (c < fila.length) {
      const s = fila[c];
      if (s === 'o') {
        gaviotas.push({
          x: rejilla.x0 + (c + 0.5) * rejilla.celda,
          y: y + rejilla.celda * 0.5,
          r: rejilla.celda * 0.34,
          viva: true, vy: 0
        });
        c++;
        continue;
      }
      if (!MATERIALES[s]) { c++; continue; }
      // Las casillas seguidas del mismo material son UNA pieza: eso es lo que
      // convierte una fila de arriba en una viga, con su forma de partirse.
      let fin = c;
      while (fin + 1 < fila.length && fila[fin + 1] === s) fin++;
      piezas.push({
        x: rejilla.x0 + c * rejilla.celda,
        y,
        w: (fin - c + 1) * rejilla.celda,
        h: rejilla.celda,
        mat: s, rota: false, vy: 0, cayendo: false
      });
      c = fin + 1;
    }
  }
  return { piezas, gaviotas };
}

// ---- Las generadas ---------------------------------------------------------

/**
 * A partir de la décima, la máquina.
 *
 * Siempre la misma forma —bahías con una gaviota dentro y una viga encima— pero
 * con más bahías, más altura y más piedra según se avanza. La forma se repite a
 * propósito: lo que tiene que subir es la dificultad, no la sorpresa, y una
 * estructura irreconocible no se puede planear de un vistazo.
 */
export function generarEstructura(n, azar) {
  const avance = Math.max(0, n - ESTRUCTURAS.length);

  // Lo que crece es **cuántas torres separadas hay**, no lo alta que es una.
  //
  // Se midió al revés primero —torres cada vez más altas— y salía una cuesta
  // hacia abajo: una torre alta es un castillo de naipes, y un solo golpe en la
  // columna de abajo se llevaba las nueve gaviotas. Más grande era más fácil.
  //
  // Con torres sueltas hay que gastar un tiro en cada una, y sólo se llevan
  // cuatro por estructura. Eso sí aprieta.
  const torres = Math.min(3, 1 + Math.floor(avance / 6));
  const bahias = Math.min(3, 1 + Math.floor(avance / 4));
  const alto = Math.min(4, 2 + Math.floor(avance / 9));
  // Y la piedra, que es lo otro que endurece de verdad: no se rompe de un tiro
  // normal, así que hay que quitarle el apoyo en vez de reventarla.
  const dureza = Math.min(0.75, 0.15 + avance * 0.05);

  const ancho = bahias * 2 + 1;
  const filas = [];

  for (let f = 0; f < alto + 1; f++) filas.push([]);

  for (let t = 0; t < torres; t++) {
    if (t > 0) for (const fila of filas) fila.push(' ');

    // El techo: UNA viga de punta a punta sobre las dos columnas de los lados.
    // Es lo que la hace volcar en cuanto le quitas una. Columnas por el medio
    // la dejarían inmóvil, que es el fallo que se cazó midiendo.
    filas[0].push((azar() < dureza ? '#' : '=').repeat(ancho));

    for (let f = 0; f < alto; f++) {
      const ultima = f === alto - 1;
      let fila = '';
      for (let c = 0; c < ancho; c++) {
        if (c === 0 || c === ancho - 1) {
          fila += (ultima && azar() < dureza * 0.5) ? '#' : '=';
          continue;
        }
        // En las impares: con `ancho = bahias * 2 + 1`, las columnas caen en
        // las pares, así que las gaviotas van en medio de cada bahía. Con las
        // pares, una torre de tres casillas se quedaba SIN gaviota.
        fila += (ultima && c % 2 === 1) ? 'o' : ' ';
      }
      filas[f + 1].push(fila);
    }
  }
  return filas.map((f) => f.join(''));
}
