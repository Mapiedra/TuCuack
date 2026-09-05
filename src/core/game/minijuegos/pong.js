// Pong: tu mascota de pala a la izquierda, la máquina a la derecha.
//
// Es el primero con un RIVAL de verdad en un juego de escenario. «Pato Jumping»
// y The Hole son contra el reloj y contra uno mismo; aquí enfrente hay algo que
// quiere ganar, y eso cambia lo que se siente al jugar aunque el bucle se
// parezca.
//
// ---- Lo que se guarda no es lo que se gana ---------------------------------
//
// Y es el primero donde ganar y batir el récord son dos cosas distintas. En el
// Runner, el Flappy o The Hole, «victoria» ES el récord: no hay a quién ganar.
// Aquí se gana el PARTIDO —a siete— y lo que se guarda como marca es el
// **peloteo más largo**, que mide otra cosa: no si pudiste con la máquina, sino
// cuánto aguantaste con la pelota cada vez más rápida. Se puede perder 7-3 y
// firmar el mejor peloteo de tu vida, y está bien que así sea.
//
// ---- Dos detalles que decidieron el diseño ---------------------------------
//
//   1. **La mascota no puede bajar de su suelo.** `Duck.setY` recorta contra la
//      línea del suelo, que es donde acaba la barra de tareas. O sea que la
//      pista no puede ocupar la pantalla entera: se mide DÓNDE llega de verdad
//      la mascota —moviéndola a los dos extremos y preguntándole— y la pista se
//      dibuja justo ahí. Así no hay ni un píxel de campo que la pala no cubra,
//      que en un Pong es la diferencia entre perder y que te roben.
//
//   2. **La pala es una caja, no el círculo del cuerpo.** `pato.cuerpo()`
//      devuelve un círculo de unos veintiséis píxeles de radio, y con eso
//      enfrente de una pelota a mil por hora esto no sería un juego, sería una
//      broma. La pala es la caja de la mascota, del tamaño que se ve.

import { sembrar } from './azar.js';

const PUNTOS_PARTIDO = 7;

/** La pelota, y cómo se va poniendo seria. */
const VELOCIDAD_BASE = 560;
const VELOCIDAD_POR_GOLPE = 22;
const VELOCIDAD_MAX = 1180;

/** Cuánto desvía golpear con el borde de la pala en vez de con el centro. */
const DESVIO_MAX = 0.85;
/** Cuánto del movimiento de la pala se le pega a la pelota. */
const EFECTO = 0.22;

/** Lo deprisa que sigue la mascota al ratón. Instantáneo sería no jugar. */
const VELOCIDAD_PALA = 1150;

/** Lo que se espera entre un punto y el siguiente, para ver qué ha pasado. */
const RESPIRO_S = 0.9;

/** Píxeles como mucho por subpaso: una pelota rápida no se salta una pala. */
const PASO_MAX = 5;

/**
 * De qué nivel a qué nivel aprende la máquina.
 *
 * Al desbloquear el juego —nivel 24— el rival es batible sin sufrir; a partir
 * del 40 juega a tope y ya no sube más. Es lo mismo que hace el tres en raya con
 * su torpeza, y por lo mismo: un rival perfecto desde el primer día no es
 * difícil, es que no hay juego.
 */
const NIVEL_FACIL = 24;
const NIVEL_DURO = 40;

/**
 * Lo que corre la máquina, y lo mal que apunta.
 *
 * La primera versión le puso 360 px/s de suelo y perdía 7-0 sin devolver casi
 * nada: con la pista de ochocientos de alto y la pelota cruzándola en segundo y
 * medio, a esa velocidad **no llegaba**, y un rival que no llega no es fácil, es
 * que no está. La dificultad tiene que estar en el ERROR y no en la velocidad:
 * así la máquina siempre se planta donde toca —hay peloteo— y lo que cambia con
 * el nivel es si acierta.
 */
const VELOCIDAD_RIVAL = 560;
const VELOCIDAD_RIVAL_EXTRA = 460;
/** El error, en partes del alto de la pala. */
const ERROR_TORPE = 0.50;
const ERROR_APRENDIDO = 0.46;

/**
 * Y cuánto empeora la puntería con la pelota lanzada.
 *
 * Esto no es adorno: **es lo que hace que un punto termine**. Sin ello, a partir
 * del nivel 32 el error del rival cae por debajo de media pala —o sea, no falla
 * nunca— y como su pala llega siempre a tiempo, el peloteo no se acaba. Medido:
 * 0-0 con sesenta y dos golpes y subiendo, hasta que cortó el reloj.
 *
 * Con esto, la pelota acelera veintidós por golpe, y al llegar arriba hasta el
 * rival más fino falla una de cada cinco. El punto se acaba porque la pelota va
 * demasiado deprisa para leerla, que es como se acaban los puntos en un Pong.
 */
const ERROR_POR_VELOCIDAD = 0.60;

/**
 * Lo que el juego se da antes de cerrar el partido.
 *
 * El préstamo del escenario corta a los diez minutos y lo hace SIN resultado
 * (ver `TOPE_PARTIDA_MS` en escenario.js). Un partido a siete no debería
 * acercarse, pero un peloteo eterno con dos palas que no fallan sí, y perder el
 * partido entero por eso sería un fallo. Al llegar, gana quien vaya por delante.
 */
const PRESUPUESTO_MS = 8.5 * 60 * 1000;

/**
 * @param {import('./index.js').ContextoPartida} ctx
 * @returns {import('./index.js').Partida}
 */
export function crearPartida(ctx) {
  const pista = ctx.escenario;
  const { pato, entrada } = pista;

  const mejorPrevio = typeof ctx.marcas.mejor === 'number' ? ctx.marcas.mejor : null;
  const maña = habilidadDelRival(ctx.nivel);
  // De la semilla y no de `Math.random`, como el resto: así un partido raro se
  // puede repetir tal cual para mirarlo.
  const azar = sembrar(ctx.semilla);

  /** 'sirviendo' | 'jugando' | 'fin' */
  let fase = 'sirviendo';
  let mios = 0;
  let suyos = 0;
  let peloteo = 0;
  let mejorPeloteo = 0;
  let espera = RESPIRO_S;
  /** Hacia quién sale la siguiente: empieza hacia la máquina, por cortesía. */
  let saqueHacia = 1;
  let terminada = false;
  let transcurrido = 0;

  let campo = medirCampo();
  const pelota = { x: 0, y: 0, vx: 0, vy: 0, radio: 9 };
  const rival = { y: 0, alto: 90, ancho: 14, x: 0, falloY: 0 };
  /** La pala de la mascota: la caja donde está ahora, y a qué altura va. */
  const pala = { x: 0, y: 0, w: 40, h: 90, destino: 0, vy: 0 };

  // El cursor se esconde porque aquí el puntero ES la mascota: dos cosas
  // persiguiéndose por la pantalla se estorban.
  pista.cursor('none');
  aplicarMedidas();
  centrarPelota();
  marcar();

  return { actualizar, destroy };

  function destroy() { terminada = true; }

  // ---- Un fotograma ------------------------------------------------------

  function actualizar(dt, p) {
    if (terminada) return;
    sincronizarCampo(p);

    transcurrido += dt * 1000;
    if (transcurrido >= PRESUPUESTO_MS) { acabar('tiempo'); return; }

    moverPala(dt);
    moverRival(dt);

    if (fase === 'sirviendo') {
      espera -= dt;
      if (espera <= 0) sacar();
    } else if (fase === 'jugando') {
      moverPelota(dt);
    }

    pintar(p.pintor);
  }

  // ---- La pala de la mascota ---------------------------------------------

  /**
   * Sigue al ratón, pero con un tope de velocidad.
   *
   * Pegar la mascota al cursor sería quitarle el juego: con la pala siempre en
   * su sitio no se falla nunca, y lo único que quedaría sería esperar a que el
   * rival se equivoque. El tope es lo que convierte «mover el ratón» en «llegar
   * a tiempo».
   */
  function moverPala(dt) {
    const antes = pala.y;
    const quiero = Math.max(campo.y0 + pala.h / 2, Math.min(campo.y1 - pala.h / 2, entrada.y));
    const paso = VELOCIDAD_PALA * dt;
    const dy = quiero - pala.destino;
    pala.destino += Math.abs(dy) <= paso ? dy : Math.sign(dy) * paso;

    // Se coloca por el ancla y se pregunta DÓNDE ha quedado el cuerpo: la
    // relación entre las dos no es cosa de este juego, y `cuerpo()` ya la sabe.
    pato.setY(alturaDePantalla(pala.destino));
    const c = pato.cuerpo();
    pala.x = c.cx - pala.w / 2;
    pala.y = c.cy - pala.h / 2;
    pala.vy = dt > 0 ? (pala.y + pala.h / 2 - antes) / dt : 0;
  }

  /**
   * De una `y` de pantalla a la que entiende `Duck.setY`, que crece al revés.
   *
   * El desfase entre el ancla y el centro del cuerpo NO se calcula: se mide una
   * vez en `medirCampo` moviendo la mascota y preguntándole dónde ha quedado.
   * Deducirlo a mano —dos tercios de la caja, menos el margen del CSS bajo los
   * pies— es exactamente la clase de cuenta que sale mal en silencio y deja la
   * pala unos píxeles por debajo del ratón para siempre.
   */
  function alturaDePantalla(cy) {
    return window.innerHeight - cy - campo.desfase;
  }

  // ---- El rival ----------------------------------------------------------

  /**
   * Persigue la pelota, con dos limitaciones que son toda su dificultad: no se
   * mueve más deprisa de lo que sabe, y apunta un poco mal.
   *
   * El error se sortea UNA vez por peloteo y no en cada fotograma: recalculado
   * cada vez, el temblor se promedia y el rival acaba jugando perfecto por
   * mucho ruido que se le meta.
   */
  function moverRival(dt) {
    const velocidad = VELOCIDAD_RIVAL + maña * VELOCIDAD_RIVAL_EXTRA;
    const objetivo = fase === 'jugando' && pelota.vx > 0
      ? pelota.y + rival.falloY
      : (campo.y0 + campo.y1) / 2;

    const dy = objetivo - rival.y;
    const paso = velocidad * dt;
    rival.y += Math.abs(dy) <= paso ? dy : Math.sign(dy) * paso;
    rival.y = Math.max(campo.y0 + rival.alto / 2, Math.min(campo.y1 - rival.alto / 2, rival.y));
  }

  function nuevoFallo() {
    // Dos sumandos, y cada uno hace una cosa distinta. El primero es la
    // DIFICULTAD: cuánto falla según tu nivel. Y es en el error donde vive, no
    // en la velocidad —un rival lento no falla, sencillamente no llega, y eso
    // se ve y no tiene gracia—. El segundo es lo que hace que el punto TERMINE:
    // con la pelota lanzada, hasta el rival fino se equivoca. Ver
    // `ERROR_POR_VELOCIDAD`.
    const rapidez = Math.min(1, Math.hypot(pelota.vx, pelota.vy) / VELOCIDAD_MAX);
    const margen = rival.alto
      * (ERROR_TORPE - maña * ERROR_APRENDIDO + rapidez * ERROR_POR_VELOCIDAD);
    rival.falloY = (azar() * 2 - 1) * margen;
  }

  // ---- La pelota ---------------------------------------------------------

  function centrarPelota() {
    pelota.x = (campo.x0 + campo.x1) / 2;
    pelota.y = (campo.y0 + campo.y1) / 2;
    pelota.vx = 0;
    pelota.vy = 0;
  }

  function sacar() {
    // Un ángulo de salida que no sea nunca horizontal del todo: una pelota que
    // va recta es la misma jugada siempre.
    const angulo = (azar() * 0.7 - 0.35) + (azar() < 0.5 ? 0.18 : -0.18);
    pelota.vx = Math.cos(angulo) * VELOCIDAD_BASE * saqueHacia;
    pelota.vy = Math.sin(angulo) * VELOCIDAD_BASE;
    peloteo = 0;
    nuevoFallo();
    fase = 'jugando';
    ctx.sonido.nota(440, 0.07);
  }

  function moverPelota(dt) {
    const v = Math.hypot(pelota.vx, pelota.vy);
    const pasos = Math.max(1, Math.ceil((v * dt) / PASO_MAX));
    const paso = dt / pasos;

    for (let i = 0; i < pasos; i++) {
      pelota.x += pelota.vx * paso;
      pelota.y += pelota.vy * paso;

      if (pelota.y < campo.y0 + pelota.radio && pelota.vy < 0) rebotarArriba();
      else if (pelota.y > campo.y1 - pelota.radio && pelota.vy > 0) rebotarAbajo();

      if (pelota.vx < 0) golpeDeLaPala();
      else golpeDelRival();

      if (pelota.x < campo.x0 - pelota.radio * 3) { punto('rival'); return; }
      if (pelota.x > campo.x1 + pelota.radio * 3) { punto('mio'); return; }
    }
  }

  function rebotarArriba() {
    pelota.y = campo.y0 + pelota.radio;
    pelota.vy = -pelota.vy;
    ctx.sonido.boing(0.18);
  }

  function rebotarAbajo() {
    pelota.y = campo.y1 - pelota.radio;
    pelota.vy = -pelota.vy;
    ctx.sonido.boing(0.18);
  }

  function golpeDeLaPala() {
    if (!toca(pala)) return;
    pelota.x = pala.x + pala.w + pelota.radio;
    devolver(1, (pelota.y - (pala.y + pala.h / 2)) / (pala.h / 2), pala.vy * EFECTO);
    peloteo++;
    if (peloteo > mejorPeloteo) mejorPeloteo = peloteo;
    ctx.sonido.nota(760, 0.05);
    marcar();
  }

  function golpeDelRival() {
    const caja = { x: rival.x, y: rival.y - rival.alto / 2, w: rival.ancho, h: rival.alto };
    if (!toca(caja)) return;
    pelota.x = caja.x - pelota.radio;
    devolver(-1, (pelota.y - rival.y) / (rival.alto / 2), 0);
    peloteo++;
    if (peloteo > mejorPeloteo) mejorPeloteo = peloteo;
    nuevoFallo();
    ctx.sonido.nota(520, 0.05);
    marcar();
  }

  /** Caja contra círculo, que aquí basta: las palas no giran. */
  function toca(caja) {
    return pelota.x + pelota.radio > caja.x
      && pelota.x - pelota.radio < caja.x + caja.w
      && pelota.y + pelota.radio > caja.y
      && pelota.y - pelota.radio < caja.y + caja.h;
  }

  /**
   * Devuelve la pelota, y con ella todo el control que tiene el jugador.
   *
   * El ángulo NO sale de reflejar la velocidad: sale de DÓNDE golpeó la pala,
   * como en el Pong de siempre. Es lo que convierte una pala en algo que se
   * apunta en vez de un muro, y sin ello el peloteo se vuelve una línea recta a
   * los cuatro golpes.
   *
   * @param {1|-1} hacia
   * @param {number} donde  de -1 (borde de arriba) a 1 (borde de abajo)
   * @param {number} extra  el efecto que le pega la pala al moverse
   */
  function devolver(hacia, donde, extra) {
    const v = Math.min(VELOCIDAD_MAX,
      Math.hypot(pelota.vx, pelota.vy) + VELOCIDAD_POR_GOLPE);
    const angulo = Math.max(-1, Math.min(1, donde)) * DESVIO_MAX;
    pelota.vx = Math.cos(angulo) * v * hacia;
    pelota.vy = Math.sin(angulo) * v + extra;
  }

  // ---- Puntos ------------------------------------------------------------

  function punto(dueño) {
    if (dueño === 'mio') { mios++; saqueHacia = -1; ctx.sonido.nota(880, 0.12); }
    else { suyos++; saqueHacia = 1; ctx.sonido.nota(200, 0.16); }

    centrarPelota();
    marcar();

    if (mios >= PUNTOS_PARTIDO || suyos >= PUNTOS_PARTIDO) { acabar('partido'); return; }
    fase = 'sirviendo';
    espera = RESPIRO_S;
    if (dueño === 'mio') pato.setState('happy');
  }

  // ---- Final -------------------------------------------------------------

  function acabar(motivo) {
    if (terminada) return;
    terminada = true;
    fase = 'fin';

    const gane = mios > suyos;
    if (motivo === 'tiempo') ctx.decir('Se acabó el tiempo. Manda el marcador.');

    ctx.sonido[gane ? 'victoria' : 'derrota']();
    ctx.alTerminar({
      resultado: gane ? 'victoria' : (mios === suyos ? 'empate' : 'derrota'),
      // La marca es el peloteo, no el resultado: ver la cabecera del fichero.
      puntos: mejorPeloteo,
      detalle: detalleFinal(gane)
    });
  }

  function detalleFinal(gane) {
    const marcador = `${mios}-${suyos}`;
    const esRecord = mejorPeloteo > 0 && (mejorPrevio === null || mejorPeloteo > mejorPrevio);
    const cola = esRecord
      ? (mejorPrevio === null ? ' Y estrenas marca.' : ` Récord de peloteo: antes eran ${mejorPrevio}.`)
      : (mejorPrevio === null ? '' : ` Tu récord sigue en ${mejorPrevio}.`);
    const cabeza = gane ? `Ganado ${marcador}` : (mios === suyos ? `Empate a ${mios}` : `Perdido ${marcador}`);
    return `${cabeza}. El peloteo más largo, ${mejorPeloteo} golpes.${cola}`;
  }

  function marcar() {
    const base = `Tú ${mios}  ·  ${suyos} máquina  ·  peloteo ${peloteo}`;
    const mejor = mejorPrevio === null ? '' : `  ·  récord ${mejorPrevio}`;
    pista.marcador(base + mejor);
  }

  // ---- Medidas -----------------------------------------------------------

  /**
   * Dónde cabe la pista.
   *
   * El alto NO se elige: se mide. `Duck.setY` recorta contra la línea del suelo
   * y contra el alto de la ventana, así que se manda la mascota a los dos
   * extremos, se le pregunta dónde ha quedado el cuerpo, y la pista se dibuja
   * justo entre esos dos puntos. Un campo más alto que eso tendría franjas que
   * la pala no puede defender, y en un Pong eso no es dificultad: es un robo.
   */
  function medirCampo() {
    const m = pista.medidas;
    const margen = Math.max(14, Math.min(40, m.ancho * 0.02));

    const guardado = pato.y;
    pato.setY(0);                       // se recorta solo al suelo
    const abajo = pato.cuerpo();
    const abajoY = pato.y;
    pato.setY(window.innerHeight);      // y arriba, al techo
    const arriba = pato.cuerpo();
    pato.setY(guardado);

    const alto = Math.max(60, m.patoAlto * 0.84);
    return {
      x0: margen,
      x1: Math.max(margen + 240, m.ancho - margen),
      y0: Math.max(4, arriba.cy - alto / 2),
      y1: Math.min(m.alto - 4, abajo.cy + alto / 2),
      // `cuerpo().cy = innerHeight - y - desfase`, con el desfase constante.
      // Con una muestra basta, y así sale exacto sea cual sea la escala del
      // pato o el margen que le ponga el CSS bajo los pies.
      desfase: window.innerHeight - abajo.cy - abajoY,
      palaAlto: alto,
      palaAncho: Math.max(24, m.patoAncho * 0.6)
    };
  }

  function sincronizarCampo(p) {
    const m = p.medidas;
    if (m.ancho === campo.ancho && m.alto === campo.altoVentana) return;
    campo = medirCampo();
    aplicarMedidas();
    // La pelota parada se recoloca; en juego se deja, que moverla a mitad de un
    // peloteo por cambiar de tamaño la ventana sería peor que el problema.
    if (fase !== 'jugando') centrarPelota();
  }

  /** Lo que depende del tamaño de la pista, en un solo sitio. */
  function aplicarMedidas() {
    const m = pista.medidas;
    campo.ancho = m.ancho;
    campo.altoVentana = m.alto;
    pala.w = campo.palaAncho;
    pala.h = campo.palaAlto;
    pelota.radio = Math.max(7, Math.min(13, campo.palaAlto * 0.11));
    pala.destino = Math.max(campo.y0 + pala.h / 2,
      Math.min(campo.y1 - pala.h / 2, pala.destino || (campo.y0 + campo.y1) / 2));
    colocarRival();
  }

  function colocarRival() {
    // Igual de alta que la tuya. La máquina ya juega con la ventaja de no
    // tener que mover un ratón; darle además más pala sería pasarse.
    rival.alto = campo.palaAlto;
    rival.ancho = Math.max(10, campo.palaAncho * 0.32);
    rival.x = campo.x1 - rival.ancho - 8;
    rival.y = Math.max(campo.y0 + rival.alto / 2,
      Math.min(campo.y1 - rival.alto / 2, rival.y || (campo.y0 + campo.y1) / 2));
    // Y la mascota, pegada a su banda y mirando al campo.
    pato.setTilt(0);
    pato.setState('idle');
    pato.setFacing(1);
    pato.setX(campo.x0 + 10);
  }

  // ---- Pintado -----------------------------------------------------------

  function pintar(g) {
    const ancho = campo.x1 - campo.x0;
    const alto = campo.y1 - campo.y0;

    g.save();
    g.fillStyle = 'rgba(20, 20, 30, 0.88)';
    g.fillRect(campo.x0, campo.y0, ancho, alto);
    g.lineWidth = 5;
    g.strokeStyle = '#fffdf7';
    g.strokeRect(campo.x0, campo.y0, ancho, alto);

    // La raya del centro, a trozos, como manda la tradición.
    g.strokeStyle = 'rgba(255, 253, 247, 0.35)';
    g.lineWidth = 3;
    g.setLineDash([14, 16]);
    g.beginPath();
    g.moveTo((campo.x0 + campo.x1) / 2, campo.y0 + 6);
    g.lineTo((campo.x0 + campo.x1) / 2, campo.y1 - 6);
    g.stroke();
    g.setLineDash([]);

    // El marcador, grande y al fondo: es lo que se mira sin dejar de jugar.
    g.font = `700 ${Math.round(alto * 0.22)}px system-ui, sans-serif`;
    g.fillStyle = 'rgba(255, 253, 247, 0.14)';
    g.textBaseline = 'middle';
    g.textAlign = 'right';
    g.fillText(String(mios), (campo.x0 + campo.x1) / 2 - alto * 0.06, campo.y0 + alto * 0.24);
    g.textAlign = 'left';
    g.fillText(String(suyos), (campo.x0 + campo.x1) / 2 + alto * 0.06, campo.y0 + alto * 0.24);
    g.restore();

    // La pala de la mascota va DEBAJO de ella: el lienzo está por detrás, así
    // que se ve el pato encima de su propia pala. Es exactamente lo que se
    // quiere contar.
    g.save();
    g.fillStyle = '#ffb703';
    g.fillRect(pala.x, pala.y, pala.w, pala.h);
    g.lineWidth = 3;
    g.strokeStyle = '#2b2b3a';
    g.strokeRect(pala.x, pala.y, pala.w, pala.h);

    g.fillStyle = '#fffdf7';
    g.fillRect(rival.x, rival.y - rival.alto / 2, rival.ancho, rival.alto);

    g.beginPath();
    g.arc(pelota.x, pelota.y, pelota.radio, 0, Math.PI * 2);
    g.fillStyle = '#fffdf7';
    g.fill();
    g.restore();
  }
}

/**
 * Lo bien que juega la máquina, de 0 a 1, según el nivel del pato.
 *
 * Se le pregunta al nivel y no a una opción de menú por lo mismo que en el tres
 * en raya: elegir la dificultad de un rival al que no conoces es elegir a
 * ciegas, y encima convierte el récord en algo que depende de lo que marcaste en
 * un desplegable.
 */
export function habilidadDelRival(nivel) {
  const n = Number(nivel) || 0;
  return Math.max(0, Math.min(1, (n - NIVEL_FACIL) / (NIVEL_DURO - NIVEL_FACIL)));
}
