// Artillería: dos mascotas, una en cada punta, y el suelo se va gastando.
//
// Es el último de la escalera y el que el catálogo señalaba como mejor
// candidato, porque trae un modo que no existía —por turnos con física
// compartida— y porque las tres piezas que necesita ya estaban escritas:
//
//   * un turno es una jugada  ->  `salas.js`, que es exactamente eso;
//   * que los dos vean el mismo tiro  ->  `ctx.semilla` y una física propia y
//     determinista;
//   * terreno destructible  ->  el mapa de alturas del montón de «The Hole».
//
// ---- El terreno -------------------------------------------------------------
//
// Un array con la Y de la superficie en cada columna de cuatro píxeles. Nada
// más. Un cráter es restarle una campana centrada en el impacto, y saber si el
// huevo ha chocado es comparar su Y con la de su columna: una resta, no una
// búsqueda. Es la misma idea que hace que el montón de «The Hole» no sea N².
//
// El perfil sale de sumar tres senos con la semilla, así que los dos lados
// generan **el mismo terreno** sin mandarse nada.
//
// ---- La deriva numérica, que era el riesgo -----------------------------------
//
// El catálogo lo avisaba: si los dos lados simulan por separado y uno redondea
// distinto, los cráteres acaban en sitios distintos y la partida se parte sin
// que nadie se entere.
//
// Ya está resuelto, y no aquí: lo resolvió el billar. **El que dispara manda
// dónde cayó el huevo y cuánto daño hizo**, igual que allí manda dónde acabó
// cada bola. El otro lado repite el tiro para verlo —eso es adorno— y luego cava
// el cráter en el punto que diga el mensaje y se cree las vidas que le llegan.
// Con eso no hay deriva que valga: no hay dos simulaciones que comparar, hay una
// y una repetición.
//
// ---- El viento ---------------------------------------------------------------
//
// Cambia cada turno y es lo que impide que el segundo disparo sea el primero
// repetido. Y **lo manda quien dispara, junto con el resultado**: sortearlo cada
// uno por su cuenta con la semilla funcionaría sólo mientras los dos lados
// gasten exactamente los mismos números en el mismo orden, que es una promesa
// que se rompe el día que alguien añada un sorteo en medio.
//
// ---- Contra la mascota --------------------------------------------------------
//
// El plan decía sólo red. Va también en solo, y con motivo: un juego que exige
// que haya otra persona conectada es un juego que casi nunca se juega. Y aquí la
// mascota rival sale natural, porque juega como juega una persona: tira, ve
// dónde ha caído y **corrige**. Cada fallo la acerca. Lo que cambia con el nivel
// es cuánto se equivoca al empezar y cuánto corrige, no si sabe apuntar.

import { sembrar } from './azar.js';
import { cargarSheet } from '../../assets.js';
import { SKINS, estaDesbloqueada, SKIN_POR_DEFECTO } from '../skins.js';
import { MARCADOR_ABAJO, AIRE_MARCADOR } from './lienzo.js';

/** Ancho de una columna de terreno. Cuatro píxeles: se ve liso y son pocas. */
const COLUMNA = 4;

/** Vida de cada mascota. */
const VIDA = 100;

/** Gravedad del huevo, en píxeles por segundo al cuadrado. */
const GRAVEDAD = 900;
/**
 * El disparo más fuerte.
 *
 * El alcance de una parábola a 45° es `v²/g`, y las dos mascotas están a un 76 %
 * del ancho: en una pantalla de 1920 son 1460 píxeles. Con 1150 el alcance eran
 * 1469 —justo, justo— y con viento de cara sencillamente NO llegaba: la búsqueda
 * de la mascota daba 248 píxeles de error medio y no era que apuntara mal, era
 * que no existía ningún disparo bueno. Con 1450 el alcance sube a 2336 y sobra
 * margen para el viento en contra y para las lomas.
 */
const FUERZA_MAX = 1450;
/** Cuánto hay que alejar el cursor, en partes del ancho, para el tiro máximo. */
const ALCANCE = 0.34;
/** Un clic encima de la mascota no es un disparo. */
const FUERZA_MINIMA = 90;
/** Píxeles como mucho por subpaso: el huevo no puede saltarse una loma. */
const PASO_MAX = 3;
/** Y lo que como mucho dura un vuelo, por si el viento lo deja flotando. */
const VUELO_MAX_S = 12;

/** Lo que empuja el viento, en píxeles por segundo al cuadrado. */
const VIENTO_MAX = 220;

/** Radio del cráter, en píxeles. */
const CRATER = 58;
/** Y lo hondo que es en el centro. */
const CRATER_HONDO = 46;

/** Radio dentro del cual un impacto hace daño. */
const RADIO_DANO = 96;
/** Daño de un impacto en el mismo sitio. */
const DANO_MAX = 62;

/** Lo que se espera entre un disparo y el siguiente, para ver dónde ha caído. */
const RESPIRO_MS = 900;
/** Lo que se piensa la mascota antes de tirar. */
const PENSAR_S = 1.2;
/** Y el tope de la repetición del tiro del rival: es adorno, no puede colgar. */
const REPETICION_MAX_S = 12;

/** Lo que se enseña de la parábola al apuntar: la salida, no el final. */
const PREVIO_S = 0.35;
const PREVIO_PASO_S = 1 / 60;

/**
 * Presupuesto del juego, por debajo del tope del préstamo del escenario.
 *
 * El escenario corta a los diez minutos y lo hace SIN resultado (ver
 * `TOPE_PARTIDA_MS` en escenario.js). Con esto el juego cierra él y con un
 * resultado: gana quien llegue con más vida.
 */
const PRESUPUESTO_MS = 8.5 * 60 * 1000;
const AVISO_MS = 60 * 1000;

// ---- La cuesta -------------------------------------------------------------
//
// Contra la mascota, la dificultad es cuánto se equivoca al primer disparo y
// cuánto corrige después. Nunca llega a no fallar: una que acierta siempre a la
// primera no es un rival, es un cronómetro.

const NIVEL_BASE = 68;
const NIVEL_MAESTRO = 110;
/** Desvío del primer disparo, en píxeles de la pantalla, de la más torpe. */
const TANTEO_TORPE = 420;
/** Lo que se le quita con el nivel. */
const TANTEO_APRENDIDO = 330;
/** Y lo que corrige de lo que le falló, de 0 a 1. */
const CORRIGE_TORPE = 0.45;
const CORRIGE_APRENDIDO = 0.45;
/**
 * El temblor de cada disparo, que NO se corrige.
 *
 * Sin él, en cuanto la mascota clava el sesgo acierta siempre en el mismo punto
 * y la partida se acaba sola. Con él, aprender le sirve para acercarse, no para
 * volverse infalible.
 *
 * Baja poco con el nivel —de 150 a 130— y eso es a propósito: lo que mejora con
 * el nivel es el SESGO, que se aprende, no el pulso. Con el temblor bajando
 * también, al nivel 110 acertaba el 99 % de los tiros, que es justo el cronómetro
 * que este comentario dice que no debe ser.
 */
const RUIDO_TORPE = 150;
const RUIDO_APRENDIDO = 20;

export function crearPartida(ctx) {
  const pista = ctx.escenario;
  const { pato, entrada } = pista;

  const mejorPrevio = typeof ctx.marcas.mejor === 'number' ? ctx.marcas.mejor : null;
  const enRed = ctx.modo === 'turnos' && !!ctx.sala;
  const nombreRival = (ctx.jugadores || []).find((n) => n !== ctx.yo) || 'tu rival';

  const azar = sembrar(ctx.semilla);
  const maña = Math.max(0, Math.min(1,
    (ctx.nivel - NIVEL_BASE) / (NIVEL_MAESTRO - NIVEL_BASE)));

  /** 'apuntando' | 'volando' | 'pensando' | 'esperando' | 'asentando' | 'fin' */
  let fase = 'apuntando';
  let terminada = false;
  let transcurrido = 0;
  let pulsadoAntes = false;

  /** De quién es el disparo. En red empieza el anfitrión. */
  let turno = enRed ? (ctx.anfitrion ? 'yo' : 'el') : 'yo';
  let tirador = turno;
  let misDisparos = 0;
  let pensando = 0;
  let espera = 0;
  let reloj = 0;

  let medidas = pista.medidas;
  let anchoAntes = medidas.ancho;
  let altoAntes = medidas.alto;
  let terreno = generarTerreno(medidas, ctx.semilla);
  /** Empuje del viento de este turno: negativo a la izquierda. */
  let viento = sortearViento(azar);

  const mio = { x: 0, y: 0, vida: VIDA, lado: -1 };
  const suyo = { x: 0, y: 0, vida: VIDA, lado: 1 };

  /** El huevo en el aire, mío o suyo. */
  let huevo = null;
  /** Dónde dice el rival que cayó el suyo, para clavarlo al acabar. */
  let pendiente = null;
  /** Los cráteres ya cavados, sólo para pintarlos con su borde quemado. */
  const marcas = [];

  /**
   * Por dónde apunta de más la mascota rival, en píxeles.
   *
   * Se sortea UNA vez al empezar y va bajando con cada tiro. Es lo que hace que
   * «corregir» signifique algo: la primera versión sorteaba un fallo nuevo en
   * cada disparo y luego lo «corregía», que es corregir ruido —no converge, y
   * medido salía peor con tres correcciones que con ninguna—. Un sesgo sí se
   * puede aprender, y es además lo que le pasa a una persona: no sabes cuánto
   * empuja el viento hasta que ves caer el primero.
   */
  let sesgo = (azar() * 2 - 1) * (TANTEO_TORPE - maña * TANTEO_APRENDIDO);

  const hojas = cargarHojas(ctx.nivel);
  let bajaSala = null;
  if (enRed) bajaSala = ctx.sala.alRecibir((m) => recibirDisparo(m));

  colocarMascotas();
  pista.cursor('crosshair');
  arrancarTurno();
  marcar();

  return { actualizar, destroy };

  function destroy() {
    terminada = true;
    if (bajaSala) { try { bajaSala(); } catch { /* da igual */ } bajaSala = null; }
  }

  // ---- Un fotograma ------------------------------------------------------

  function actualizar(dt, p) {
    if (terminada) return;
    sincronizar(p.medidas);

    const antes = transcurrido;
    transcurrido += dt * 1000;
    // Se acaba el tiempo, pero no se corta a mitad de un disparo ni con una
    // jugada del rival por aplicar: cortar ahí deja a los dos lados con vidas
    // distintas, que es justo lo que estropea el final.
    if (transcurrido >= PRESUPUESTO_MS && fase !== 'volando' && !pendiente) {
      cerrarPorTiempo();
      return;
    }
    if (PRESUPUESTO_MS - transcurrido < AVISO_MS
      && Math.ceil(antes / 1000) !== Math.ceil(transcurrido / 1000)) marcar();

    if (fase === 'volando') {
      volar(dt);
    } else if (fase === 'pensando') {
      pensando -= dt;
      if (pensando <= 0) dispararLaMascota();
    } else if (fase === 'esperando' && !enRed) {
      espera -= dt * 1000;
      if (espera <= 0) arrancarTurno();
    } else if (fase === 'esperando' && enRed) {
      espera -= dt * 1000;
      if (espera <= 0 && turno === 'yo') arrancarTurno();
    } else if (fase === 'apuntando') {
      apuntar();
    }

    pintar(p.pintor);
  }

  // ---- Apuntar -----------------------------------------------------------

  function apuntar() {
    const tiro = tiroDelCursor();
    pato.setFacing(tiro.vx >= 0 ? 1 : -1);

    // Se dispara al SOLTAR, como en todos los de apuntar de esta casa: así se
    // corrige la puntería sin gastar el turno.
    if (pulsadoAntes && !entrada.pulsado) {
      pulsadoAntes = false;
      if (tiro.fuerza >= FUERZA_MINIMA) disparar(tiro.vx, tiro.vy);
      return;
    }
    pulsadoAntes = entrada.pulsado;
  }

  /** Hacia el cursor, y con la fuerza que dé la distancia. */
  function tiroDelCursor() {
    const dx = entrada.x - mio.x;
    const dy = entrada.y - (mio.y - alturaMascota() * 0.5);
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return { vx: 0, vy: 0, fuerza: 0 };
    const parte = Math.min(1, dist / Math.max(1, medidas.ancho * ALCANCE));
    const fuerza = parte * FUERZA_MAX;
    return { vx: (dx / dist) * fuerza, vy: (dy / dist) * fuerza, fuerza };
  }

  function disparar(vx, vy) {
    const quien = tirador === 'yo' ? mio : suyo;
    huevo = {
      x: quien.x, y: quien.y - alturaMascota() * 0.7,
      vx, vy, mio: tirador === 'yo', reloj: 0
    };
    if (tirador === 'yo') misDisparos++;
    fase = 'volando';
    ctx.sonido.nota(320, 0.06);
    marcar();
  }

  // ---- Volar -------------------------------------------------------------

  function volar(dt) {
    const fin = volarHuevo(huevo, terreno, medidas, viento, dt);
    if (!fin) return;

    if (pendiente) { aplicarPendiente(); return; }
    resolverImpacto(fin.x, fin.y);
  }

  /**
   * El impacto: cráter, daño y turno.
   *
   * Sólo lo calcula el lado que dispara. El otro se cree lo que le llegue, que
   * es lo que quita la deriva de en medio.
   */
  function resolverImpacto(ix, iy) {
    cavarCrater(terreno, medidas, ix, CRATER, CRATER_HONDO);
    marcas.push({ x: ix, y: iy });
    ctx.sonido.nota(120, 0.16);

    // La mascota mira dónde ha caído el suyo y se corrige. Va aquí y no al
    // disparar porque es aquí donde existe el dato: lo que se aprende es el
    // fallo de verdad, no el que se pretendía cometer.
    if (!enRed && tirador === 'el') {
      sesgo -= (ix - mio.x) * (CORRIGE_TORPE + maña * CORRIGE_APRENDIDO);
    }

    const aMi = danoEn(ix, iy, mio);
    const aEl = danoEn(ix, iy, suyo);
    mio.vida = Math.max(0, mio.vida - aMi);
    suyo.vida = Math.max(0, suyo.vida - aEl);
    asentarMascotas();

    // Se sortea una sola vez y sirve para las dos cosas: mandarlo y usarlo. Si
    // se sorteara aparte, el que dispara se quedaría con un viento distinto del
    // que acaba de mandar, y a partir de ahí los dos lados apuntan a mundos
    // distintos.
    const siguiente = sortearViento(azar);

    if (enRed && tirador === 'yo') {
      ctx.sala.enviar({
        t: 'disparo',
        vx: huevo.vx / medidas.ancho, vy: huevo.vy / medidas.alto,
        viento,
        ix: ix / medidas.ancho, iy: iy / medidas.alto,
        // Las vidas van con el nombre del que las mira, no del que las manda:
        // «mia» es la del que dispara. Al llegar se cruzan.
        mia: mio.vida, suya: suyo.vida,
        // Y el viento del turno siguiente, que lo sortea quien dispara.
        siguiente
      });
    }

    huevo = null;
    // El viento se cambia ANTES de mirar si alguien ha muerto, igual que hace
    // `aplicarPendiente` en el otro lado. Al revés los dos lados acababan la
    // partida con vientos distintos en el cartel —se vio en las pruebas en red—,
    // y aunque ahí ya no importe, dos estados que se separan al final son dos
    // estados que se pueden separar antes el día que alguien mueva una línea.
    if (!enRed || tirador === 'yo') viento = siguiente;
    if (mio.vida <= 0 || suyo.vida <= 0) { acabar(); return; }
    turno = tirador === 'yo' ? 'el' : 'yo';
    fase = 'esperando';
    espera = RESPIRO_MS;
    marcar();
  }

  function danoEn(ix, iy, quien) {
    const d = Math.hypot(quien.x - ix, quien.y - alturaMascota() * 0.5 - iy);
    if (d >= RADIO_DANO) return 0;
    return Math.round(DANO_MAX * (1 - d / RADIO_DANO));
  }

  // ---- La mascota rival --------------------------------------------------

  /**
   * Busca el ángulo, y luego se equivoca.
   *
   * No hay fórmula cerrada: con viento y con un terreno que cambia, lo barato y
   * lo honrado es **probar**. Se simulan unos cuantos disparos con la misma
   * física que usa el jugador y se elige el que caiga más cerca. Eso da el tiro
   * perfecto, que no es lo que se quiere: encima se le suma el desvío que le
   * toque por nivel, menos lo que ya haya corregido de sus fallos.
   */
  function dispararLaMascota() {
    tirador = 'el';
    // El desvío se aplica al OBJETIVO, no al ángulo: así «falla por doscientos
    // píxeles» significa lo que parece y no depende de lo lejos que se tire.
    const ruido = (azar() * 2 - 1) * (RUIDO_TORPE - maña * RUIDO_APRENDIDO);
    const plan = mejorDisparo(suyo, { x: mio.x + sesgo + ruido, y: mio.y },
      terreno, medidas, viento);

    disparar(plan.vx, plan.vy);
    ctx.pato.animar('play', 600);
  }

  // ---- Por la red --------------------------------------------------------

  /**
   * El disparo del rival: se repite para verlo, y se clava lo que él diga.
   *
   * Igual que la tacada del billar. El huevo que sale de aquí es adorno; el
   * cráter y las vidas salen del mensaje.
   */
  function recibirDisparo(m) {
    if (!m || m.t !== 'disparo' || terminada) return;
    tirador = 'el';
    viento = Number(m.viento) || 0;
    pendiente = {
      ix: (Number(m.ix) || 0) * medidas.ancho,
      iy: (Number(m.iy) || 0) * medidas.alto,
      // Se cruzan: su «mia» es mi rival.
      suya: Number(m.mia), mia: Number(m.suya),
      siguiente: Number(m.siguiente) || 0
    };
    huevo = {
      x: suyo.x, y: suyo.y - alturaMascota() * 0.7,
      vx: (Number(m.vx) || 0) * medidas.ancho,
      vy: (Number(m.vy) || 0) * medidas.alto,
      mio: false, reloj: 0
    };
    fase = 'volando';
    ctx.sonido.nota(320, 0.06);
    marcar();
  }

  function aplicarPendiente() {
    const p = pendiente;
    pendiente = null;
    huevo = null;

    cavarCrater(terreno, medidas, p.ix, CRATER, CRATER_HONDO);
    marcas.push({ x: p.ix, y: p.iy });
    ctx.sonido.nota(120, 0.16);

    mio.vida = Math.max(0, Number.isFinite(p.mia) ? p.mia : mio.vida);
    suyo.vida = Math.max(0, Number.isFinite(p.suya) ? p.suya : suyo.vida);
    asentarMascotas();
    viento = p.siguiente;

    if (mio.vida <= 0 || suyo.vida <= 0) { acabar(); return; }
    turno = 'yo';
    fase = 'esperando';
    espera = RESPIRO_MS;
    marcar();
  }

  // ---- Turnos ------------------------------------------------------------

  function arrancarTurno() {
    if (terminada) return;
    tirador = turno;
    if (turno === 'yo') {
      fase = 'apuntando';
      pulsadoAntes = entrada.pulsado;   // no dispara solo si se llegó soltando
      marcar();
      return;
    }
    if (enRed) { fase = 'esperando'; marcar(); return; }
    fase = 'pensando';
    pensando = PENSAR_S;
    marcar();
  }

  // ---- Final -------------------------------------------------------------

  /**
   * Se acabó el tiempo.
   *
   * Contra la mascota gana quien llegue con más vida, que es lo justo.
   *
   * **En red es empate**, por lo mismo que en el billar: los dos lados no
   * cuentan el reloj a la vez, así que uno puede cerrar con el último disparo
   * del otro todavía viajando y comparar vidas que ya no son las de nadie. Se
   * vio en el banco de pruebas a dos: una partida acababa con **«victoria» en
   * las dos pantallas**, que es peor que cualquier resultado injusto. Arreglarlo
   * de verdad pediría un apretón de manos al final que el protocolo no tiene.
   */
  function cerrarPorTiempo() {
    if (enRed) {
      ctx.decir('Se acabó el tiempo. Empate.');
      acabar('tiempo', 'empate');
      return;
    }
    ctx.decir('Se acabó el tiempo. Gana quien llegue con más vida.');
    acabar('tiempo');
  }

  function acabar(motivo, forzado) {
    if (terminada) return;
    terminada = true;
    fase = 'fin';

    const resultado = forzado || (mio.vida > suyo.vida ? 'victoria'
      : mio.vida < suyo.vida ? 'derrota' : 'empate');

    ctx.sonido[resultado === 'victoria' ? 'victoria' : 'derrota']();
    ctx.pato.animar(resultado === 'victoria' ? 'happy' : 'idle', 1400);

    // La marca son los disparos, y **sólo si ganas**: perder en tres tiros no
    // es un récord de puntería, es que te han acertado antes. Es la misma razón
    // por la que hundir la flota sólo apunta los suyos al ganar.
    // El marcador, antes de irse: `resolverImpacto` llama aquí y sale sin
    // repintarlo, así que se quedaba enseñando las vidas de ANTES del último
    // impacto. Se vio en las pruebas en red —un lado decía «victoria» con menos
    // vida que el otro— y no era el resultado, era el cartel.
    marcar();

    ctx.alTerminar({
      resultado,
      puntos: resultado === 'victoria' ? misDisparos : undefined,
      detalle: detalleFinal(resultado, motivo)
    });
  }

  function detalleFinal(resultado, motivo) {
    const contra = enRed ? nombreRival : 'tu mascota';
    if (motivo === 'tiempo') {
      return enRed
        ? `Empate por tiempo contra ${contra}: ${mio.vida} a ${suyo.vida}.`
        : `Se acabó el tiempo contra ${contra}: ${mio.vida} a ${suyo.vida}.`;
    }
    if (resultado === 'victoria') {
      const record = mejorPrevio === null ? ' Estrenas marca.'
        : misDisparos < mejorPrevio ? ` Récord: antes eran ${mejorPrevio}.`
          : ` Tu récord sigue en ${mejorPrevio}.`;
      return `Ganado a ${contra} en ${misDisparos} `
        + `${misDisparos === 1 ? 'disparo' : 'disparos'}, con ${mio.vida} de vida.${record}`;
    }
    if (resultado === 'empate') return `Empate con ${contra}: los dos a cero.`;
    return `${contra} te ha dejado sin vida. Le quedaban ${suyo.vida}.`;
  }

  function quienEs(quien) {
    return quien === 'yo' ? 'tú' : (enRed ? nombreRival : 'tu mascota');
  }

  function marcar() {
    const queda = PRESUPUESTO_MS - transcurrido;
    const prisa = queda < AVISO_MS ? `  ·  ¡${Math.max(0, Math.ceil(queda / 1000))} s!` : '';
    const flecha = viento === 0 ? '·' : viento > 0 ? '→' : '←';
    const fuerza = Math.round(Math.abs(viento) / VIENTO_MAX * 5);
    const aire = `viento ${flecha}${'·'.repeat(Math.max(1, fuerza))}`;
    const turnoTexto = terminada ? ''
      : fase === 'volando' ? '  ·  ¡va!'
        : turno === 'yo' ? '  ·  te toca' : `  ·  tira ${quienEs('el')}`;
    pista.marcador(`tú ${mio.vida}  ·  ${quienEs('el')} ${suyo.vida}  ·  ${aire}`
      + turnoTexto + prisa);
  }

  // ---- Medidas y colocación ----------------------------------------------

  function alturaMascota() { return medidas.patoAlto; }

  /**
   * Lo alto que se VE la mascota, que no es lo alto que mide.
   *
   * `patoAlto` es el alto del elemento, y el dibujo ocupa algo más de la mitad:
   * el resto es aire. Colgando las barras de `patoAlto` quedaban flotando a un
   * palmo por encima de la cabeza, y eso se ve en una captura y no en un número.
   */
  function alturaVisible() { return medidas.patoAlto * 0.62; }

  function colocarMascotas() {
    mio.x = Math.max(40, medidas.ancho * 0.12);
    suyo.x = Math.min(medidas.ancho - 40, medidas.ancho * 0.88);
    asentarMascotas();
  }

  /**
   * Las dos se posan sobre el terreno que haya AHORA.
   *
   * Es lo único que hace falta para que un cráter debajo de alguien se note: no
   * cae, se asienta. Un daño por caída sonaría bien y traería muertes raras —te
   * mueres por un cráter a tres columnas— que en una partida de cuatro turnos no
   * se entienden.
   */
  function asentarMascotas() {
    mio.y = alturaEn(terreno, mio.x, medidas);
    suyo.y = alturaEn(terreno, suyo.x, medidas);
    pato.setTilt(0);
    pato.setState('idle');
    pato.setX(mio.x - medidas.patoAncho / 2);
    // `setY` toma la Y de VUELO de los pies, y la de vuelo crece hacia arriba:
    // para dejarlos en `mio.y` de pantalla, la resta es ésta y no lleva el alto
    // del pato en medio.
    pato.setY(medidas.alto - mio.y);
    pato.setFacing(1);
  }

  /**
   * La ventana puede cambiar de tamaño a mitad. Se reescala el terreno en vez de
   * generarlo otra vez: generarlo sería borrar todos los cráteres, y con ellos
   * la partida.
   */
  function sincronizar(nuevas) {
    // Contra los números guardados y no contra `medidas`: la pista entrega
    // SIEMPRE el mismo objeto, así que compararlo consigo mismo nunca detecta un
    // cambio de tamaño y el terreno se quedaría desencajado para siempre.
    if (nuevas.ancho === anchoAntes && nuevas.alto === altoAntes) return;
    const kx = nuevas.ancho / anchoAntes;
    const ky = nuevas.alto / altoAntes;
    const cols = Math.max(8, Math.ceil(nuevas.ancho / COLUMNA));
    const nuevo = new Float64Array(cols);
    for (let c = 0; c < cols; c++) {
      const viejo = Math.min(terreno.length - 1, Math.round(c * terreno.length / cols));
      nuevo[c] = terreno[viejo] * ky;
    }
    for (const m of marcas) { m.x *= kx; m.y *= ky; }
    if (huevo) { huevo.x *= kx; huevo.y *= ky; huevo.vx *= kx; huevo.vy *= ky; }
    terreno = nuevo;
    medidas = nuevas;
    anchoAntes = nuevas.ancho;
    altoAntes = nuevas.alto;
    colocarMascotas();
  }

  // ---- Pintado -----------------------------------------------------------

  function pintar(g) {
    dibujarTerreno(g);
    for (const m of marcas) dibujarMarca(g, m);
    dibujarRival(g);
    dibujarVidas(g);
    if (huevo) dibujarHuevo(g);
    if (fase === 'apuntando') dibujarPrevia(g);
  }

  function dibujarTerreno(g) {
    g.save();
    g.beginPath();
    g.moveTo(0, medidas.alto);
    for (let c = 0; c < terreno.length; c++) g.lineTo(c * COLUMNA, terreno[c]);
    g.lineTo(terreno.length * COLUMNA, medidas.alto);
    g.closePath();
    // Traslúcido: el pato vive encima del escritorio de alguien y un bloque
    // opaco a pantalla completa da un susto que no toca.
    g.fillStyle = 'rgba(106, 143, 70, 0.9)';
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = '#4a6b32';
    g.stroke();
    g.restore();
  }

  /** El borde quemado de un cráter. Se pinta encima del terreno ya cavado. */
  function dibujarMarca(g, m) {
    g.save();
    g.beginPath();
    g.arc(m.x, m.y, CRATER * 0.5, 0, Math.PI * 2);
    g.fillStyle = 'rgba(60, 44, 28, 0.35)';
    g.fill();
    g.restore();
  }

  function dibujarHuevo(g) {
    g.save();
    g.fillStyle = '#fffdf7';
    g.strokeStyle = '#2b2b3a';
    g.lineWidth = 1.5;
    g.beginPath();
    g.ellipse(huevo.x, huevo.y, 6, 9, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.restore();
  }

  function dibujarVidas(g) {
    const ancho = Math.max(60, medidas.patoAncho * 0.9);
    for (const quien of [mio, suyo]) {
      const y = quien.y - alturaVisible() - 12;
      g.save();
      g.fillStyle = 'rgba(0, 0, 0, 0.3)';
      g.fillRect(quien.x - ancho / 2, y, ancho, 7);
      g.fillStyle = quien.vida > 40 ? '#35a34a' : '#e63946';
      g.fillRect(quien.x - ancho / 2, y, ancho * (quien.vida / VIDA), 7);
      g.restore();
    }
  }

  /**
   * La mascota de enfrente.
   *
   * Con su hoja de sprites si ha llegado, y si no un bulto: igual que en «The
   * Hole». Un juego donde no se ve a quién le disparas no es difícil, es
   * imposible.
   */
  function dibujarRival(g) {
    const w = medidas.patoAncho;
    const h = medidas.patoAlto;
    const cx = suyo.x;
    const cy = suyo.y - h / 2;

    const skin = hojas.disponibles[0];
    const imagen = hojas.imagen(skin);
    const meta = ctx.sprites[skin];
    const anim = meta && meta.animations && meta.animations.idle;
    if (!imagen || !anim) {
      g.save();
      g.beginPath();
      g.arc(cx, cy, w * 0.3, 0, Math.PI * 2);
      g.fillStyle = '#ffb703';
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = '#2b2b3a';
      g.stroke();
      g.restore();
      return;
    }
    g.save();
    // Espejado, para que mire hacia el jugador.
    g.translate(cx, cy);
    g.scale(-1, 1);
    g.drawImage(imagen,
      0, anim.row * meta.frameH, meta.frameW, meta.frameH,
      -w / 2, -h / 2, w, h);
    g.restore();
  }

  function dibujarPrevia(g) {
    const tiro = tiroDelCursor();
    if (tiro.fuerza < FUERZA_MINIMA) return;

    const v = {
      x: mio.x, y: mio.y - alturaMascota() * 0.7,
      vx: tiro.vx, vy: tiro.vy
    };
    g.save();
    g.fillStyle = 'rgba(255, 255, 255, 0.8)';
    let t = 0;
    while (t < PREVIO_S) {
      v.vx += viento * PREVIO_PASO_S;
      v.vy += GRAVEDAD * PREVIO_PASO_S;
      v.x += v.vx * PREVIO_PASO_S;
      v.y += v.vy * PREVIO_PASO_S;
      t += PREVIO_PASO_S;
      g.beginPath();
      g.arc(v.x, v.y, 2.5, 0, Math.PI * 2);
      g.fill();
    }
    // Y la barra de fuerza, junto a la mascota.
    const parte = tiro.fuerza / FUERZA_MAX;
    const ancho = Math.max(50, medidas.patoAncho);
    const y = mio.y - alturaVisible() - 26;
    g.fillStyle = 'rgba(0, 0, 0, 0.35)';
    g.fillRect(mio.x - ancho / 2, y, ancho, 5);
    g.fillStyle = parte > 0.9 ? '#e63946' : '#ffb703';
    g.fillRect(mio.x - ancho / 2, y, ancho * parte, 5);
    g.restore();
  }

  function sortearViento(rnd) {
    return (rnd() * 2 - 1) * VIENTO_MAX;
  }
}

// ---- El terreno ------------------------------------------------------------
//
// Puras: reciben el terreno y las medidas y no saben nada de la partida. Es lo
// mismo que se hizo con la física del billar y con el derrumbe del «Angry», y
// por lo mismo: un terreno destructible no se puede comprobar mirándolo.

/**
 * El perfil, de tres senos y la semilla.
 *
 * Tres y no uno porque uno solo es una duna simétrica y se juega igual siempre;
 * y tres y no diez porque a partir de ahí son picos que esconden el objetivo sin
 * que se entienda por qué.
 *
 * @returns {Float64Array} la Y de la superficie en cada columna
 */
export function generarTerreno(medidas, semilla) {
  const azar = sembrar(semilla);
  const cols = Math.max(8, Math.ceil(medidas.ancho / COLUMNA));
  // `medidas.suelo` viene en coordenadas de VUELO, que crecen hacia arriba; el
  // terreno vive en pantalla, que crecen hacia abajo. Es la única conversión de
  // todo el fichero y se hace aquí.
  const suelo = medidas.alto - medidas.suelo;
  const base = suelo - medidas.alto * 0.12;
  const techo = MARCADOR_ABAJO + AIRE_MARCADOR + medidas.patoAlto * 1.4;

  const ondas = [];
  for (let i = 0; i < 3; i++) {
    ondas.push({
      largo: 0.6 + azar() * 2.4 + i * 1.3,
      alto: (medidas.alto * 0.11) / (i + 1),
      fase: azar() * Math.PI * 2
    });
  }

  const terreno = new Float64Array(cols);
  for (let c = 0; c < cols; c++) {
    const t = c / cols;
    let y = base;
    for (const o of ondas) y -= Math.sin(t * Math.PI * 2 * o.largo + o.fase) * o.alto;
    // El tope de abajo es la línea del suelo, no el borde de la pantalla: por
    // debajo está la franja de la barra de tareas, que este proyecto deja libre
    // pase lo que pase. Un valle ahí abajo dejaría a la mascota flotando, porque
    // `setY` la recorta contra el suelo y el terreno no.
    terreno[c] = Math.max(techo, Math.min(suelo, y));
  }
  return terreno;
}

/** La Y de la superficie en una X cualquiera. */
export function alturaEn(terreno, x, medidas) {
  const c = Math.max(0, Math.min(terreno.length - 1, Math.round(x / COLUMNA)));
  return terreno[c];
}

/**
 * Un cráter: restarle una campana al terreno.
 *
 * Con coseno y no con un semicírculo porque un semicírculo deja los bordes en
 * pico y el terreno se llena de dientes de sierra al segundo impacto.
 */
export function cavarCrater(terreno, medidas, ix, radio, hondo) {
  const centro = ix / COLUMNA;
  const anchoCols = radio / COLUMNA;
  const desde = Math.max(0, Math.floor(centro - anchoCols));
  const hasta = Math.min(terreno.length - 1, Math.ceil(centro + anchoCols));
  for (let c = desde; c <= hasta; c++) {
    const parte = Math.abs(c - centro) / anchoCols;
    if (parte >= 1) continue;
    const baja = hondo * (0.5 + 0.5 * Math.cos(parte * Math.PI));
    // Y un cráter tampoco cava por debajo del suelo, por lo mismo.
    terreno[c] = Math.min(medidas.alto - medidas.suelo, terreno[c] + baja);
  }
}

/**
 * Un fotograma del huevo, en los subpasos que hagan falta.
 *
 * @returns {{x:number,y:number}|null} dónde ha chocado, o null si sigue volando
 */
export function volarHuevo(huevo, terreno, medidas, viento, dt) {
  huevo.reloj += dt;
  const v = Math.hypot(huevo.vx, huevo.vy);
  const pasos = Math.max(1, Math.ceil((v * dt) / PASO_MAX));
  const paso = dt / pasos;

  for (let i = 0; i < pasos; i++) {
    huevo.vx += viento * paso;
    huevo.vy += GRAVEDAD * paso;
    huevo.x += huevo.vx * paso;
    huevo.y += huevo.vy * paso;

    // Por los lados se pierde, pero por arriba no: un tiro alto tiene que poder
    // salir de la pantalla y volver, que es media gracia de la artillería.
    if (huevo.x < -80 || huevo.x > medidas.ancho + 80) {
      return { x: Math.max(0, Math.min(medidas.ancho, huevo.x)), y: medidas.alto };
    }
    if (huevo.y >= alturaEn(terreno, huevo.x, medidas)) {
      return { x: huevo.x, y: alturaEn(terreno, huevo.x, medidas) };
    }
  }
  if (huevo.reloj > VUELO_MAX_S) return { x: huevo.x, y: huevo.y };
  return null;
}

/**
 * El disparo que más se acerca al objetivo, probando.
 *
 * No hay fórmula cerrada con viento y con un terreno que cambia, así que se
 * barre el ángulo y la fuerza y se simula cada candidato con la MISMA función
 * que usa el juego. Son unas cuantas decenas de vuelos de dos segundos: en el
 * fotograma en que la mascota decide, ni se nota.
 *
 * @returns {{vx:number, vy:number, error:number}}
 */
export function mejorDisparo(desde, hacia, terreno, medidas, viento) {
  const origen = { x: desde.x, y: desde.y - medidas.patoAlto * 0.7 };
  const haciaIzquierda = hacia.x < desde.x;
  let mejor = { vx: 0, vy: -FUERZA_MAX, error: Infinity };

  // Dos pasadas: una gruesa por todo el abanico y otra fina alrededor de lo que
  // gane. Con la gruesa sola el error medio eran 178 píxeles —casi el doble del
  // radio de daño—, y eso no es una mascota que falla, es una búsqueda que no
  // busca. Las dos juntas cuestan un milisegundo, medido.
  let a0 = 12;
  let a1 = 78;
  let paso = 6;
  let f0 = 0.35;
  let f1 = 1;
  let pasoF = 0.09;

  for (let vuelta = 0; vuelta < 2; vuelta++) {
    for (let a = a0; a <= a1 + 0.001; a += paso) {
      const rad = (a * Math.PI) / 180;
      for (let f = f0; f <= f1 + 0.0001; f += pasoF) {
        const fuerza = FUERZA_MAX * Math.max(0.15, Math.min(1, f));
        const vx = Math.cos(rad) * fuerza * (haciaIzquierda ? -1 : 1);
        const vy = -Math.sin(rad) * fuerza;
        const h = { x: origen.x, y: origen.y, vx, vy, reloj: 0 };
        let fin = null;
        for (let n = 0; n < 900 && !fin; n++) {
          fin = volarHuevo(h, terreno, medidas, viento, 1 / 60);
        }
        if (!fin) continue;
        const error = Math.hypot(fin.x - hacia.x, fin.y - hacia.y);
        if (error < mejor.error) mejor = { vx, vy, error, angulo: a, parte: f };
      }
    }
    if (mejor.angulo == null) break;
    a0 = mejor.angulo - paso;
    a1 = mejor.angulo + paso;
    paso = 1;
    f0 = mejor.parte - pasoF;
    f1 = mejor.parte + pasoF;
    pasoF = 0.012;
  }
  return mejor;
}

// ---- Las hojas de sprites --------------------------------------------------

/**
 * Trae las hojas de los diseños desbloqueados, para pintar a la de enfrente.
 *
 * Con `cargarSheet` y no con CSS, igual que «The Hole» y la memoria: un
 * `background-image` sobre una página con CSP estricto lo bloquea el `img-src`
 * de esa página, y la mascota rival saldría en blanco.
 */
function cargarHojas(nivel) {
  const libres = SKINS.filter((s) => estaDesbloqueada(s, nivel));
  const disponibles = libres.length ? libres.map((s) => s.id) : [SKIN_POR_DEFECTO];
  const imagenes = new Map();
  for (const id of disponibles) {
    cargarSheet(id).then((img) => imagenes.set(id, img)).catch(() => {});
  }
  return { disponibles, imagen: (id) => imagenes.get(id) || null };
}
