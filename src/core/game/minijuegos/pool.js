// 8 Pool: quince bolas, seis troneras y bolas que chocan entre sí.
//
// ---- Por qué aquí SÍ sale bien la física exacta ----------------------------
//
// En este proyecto la física de cuerpo contra cuerpo ha dado siempre problemas.
// «The Hole» tiembla porque la gravedad empuja el montón unos contra otros
// indefinidamente y no hay solucionador que aguante eso sin iterar. Por eso el
// minigolf tiene UNA bola, y por eso no hay ningún juego de apilar.
//
// El billar es la excepción, y conviene entender por qué antes de copiarlo a
// ningún sitio. Son círculos **del mismo tamaño**, **sin gravedad**, en un
// plano, y **sin contactos en reposo**: dos bolas quietas no se tocan salvo un
// instante. En esas condiciones el choque elástico entre dos discos iguales no
// necesita solucionador ninguno: se descompone la velocidad en la línea que une
// los centros, se INTERCAMBIAN las componentes normales —masas iguales— y las
// tangenciales se quedan como estaban. Son cuatro líneas y son exactas.
//
// Todo lo que hace difícil un motor de física de verdad —masas distintas,
// gravedad, pilas que se sostienen, fricción de contacto— aquí no existe.
//
// ---- La mesa ---------------------------------------------------------------
//
// Dos a uno, como una mesa de verdad, encajada en lo que deje la pantalla. La
// mascota se queda FUERA, abajo, igual que en el minigolf: esto se ve desde
// arriba y meterla dentro sería pintarla tumbada sobre el paño.
//
// Las troneras son huecos, no adornos: antes de mirar si la bola rebota en la
// banda se mira si ha entrado en una tronera, y cerca de la boca la banda deja
// de existir. Sin eso, una bola que va a la esquina rebota justo antes de
// entrar y nunca se cuela.
//
// ---- Las reglas que se quedan y las que no --------------------------------
//
// Se queda el 8 pool de verdad: mesa abierta hasta que alguien mete, grupos de
// lisas y rayadas, sigues tirando mientras metas de las tuyas, y la negra la
// última. Meter la negra antes de tiempo se pierde en el acto.
//
// Falta: colar la blanca, no tocar ninguna bola, o tocar primero una que no es
// tuya. Se pierde el turno y **la blanca vuelve a la cabecera**.
//
// Lo que NO se ha metido, y a propósito:
//
//   * **Bola en mano.** Es lo que manda el reglamento tras una falta, y aquí
//     costaría dos cosas: una interfaz para colocarla, y —peor— enseñarle a la
//     mascota a usarla. Devolverla a la cabecera es una variante de toda la vida
//     de los billares y castiga igual.
//   * **La banda obligatoria tras el contacto.** Existe para que no se pueda
//     jugar a no hacer nada, y contra una mascota que siempre intenta meter no
//     hace falta.
//   * **Cantar la tronera.** Para eso hace falta señalarla antes de tirar, y eso
//     es un paso más en cada tiro de un juego que ya tiene bastantes.
//
// ---- Por turnos, contra otra mascota ---------------------------------------
//
// Igual que el minigolf: el que tira manda **dónde acabó todo**, no sólo con qué
// fuerza tiró. Y aquí eso importa MÁS, no menos. Con una bola, dos máquinas con
// `dt` distinto acaban separándose despacio; con dieciséis y choques entre
// ellas, una diferencia de un píxel en el primer contacto reparte la mesa de
// otra manera. La repetición del tiro es adorno —para ver lo que hizo— y al
// acabar se clava todo donde diga el mensaje.
//
// Y el que tira manda también **el veredicto**: si hubo falta, qué grupo le tocó
// y si sigue él. Dejar que cada lado juzgue las reglas por su cuenta es la forma
// segura de acabar con dos partidas distintas.

import { sembrar } from './azar.js';

/** Las numeradas. Más la blanca, dieciséis en la mesa. */
const BOLAS = 15;
/** La negra. Ni lisa ni rayada: la última. */
const NEGRA = 8;

/** Rozamiento del paño, exponencial y por segundo. */
const ROZAMIENTO = 0.72;
/**
 * Por debajo de esto la bola está parada.
 *
 * Veinticuatro píxeles por segundo son 0,4 por fotograma: no se ve moverse. Con
 * once —lo primero que puse— la mesa tardaba casi un segundo más en darse por
 * quieta, y ese segundo es todo cola de bolas reptando.
 */
const PARADA = 24;
/** Lo que devuelve la banda. */
const REBOTE = 0.76;
/**
 * Lo que se conserva en un choque entre bolas.
 *
 * Con 1 sería elástico perfecto y la mesa no se calmaría nunca; con mucho menos
 * las bolas se quedan muertas al tocarse y no se puede jugar a nada.
 */
const CHOQUE = 0.95;

/**
 * El taco más fuerte, en píxeles por segundo.
 *
 * Medido: con esto la mesa más revuelta —una apertura a toda fuerza— se para en
 * 5,8 segundos, con margen sobre los 8 del tope de repetición. Subirlo a 3000
 * apenas mete más bolas y sí hace el tiro más difícil de dosificar.
 */
const FUERZA_MAX = 2400;
/** Cuánto hay que alejar el cursor, en partes del ancho, para el tiro máximo. */
const ALCANCE = 0.30;
/** Un clic encima de la blanca no es un tiro. */
const FUERZA_MINIMA = 90;

/** Píxeles como mucho por subpaso: una bola rápida no puede saltarse otra. */
const PASO_MAX = 3;

/** Lo más gorda que se pinta una bola, por grande que sea la pantalla. */
const RADIO_MAX = 20;
/** Y la boca de una tronera, en radios de bola. */
const BOCA = 1.85;

/**
 * Lo que el juego se da a sí mismo antes de cerrar.
 *
 * El préstamo del escenario corta a los diez minutos y lo hace SIN resultado
 * (ver `TOPE_PARTIDA_MS` en escenario.js), así que una partida larga podría
 * acabar en nada. Con esto el juego llega antes y cierra él, con el resultado
 * que haya: gana quien lleve menos bolas por meter.
 */
const PRESUPUESTO_MS = 8.5 * 60 * 1000;
/** A partir de aquí el marcador avisa de que queda poco. */
const AVISO_MS = 60 * 1000;

/** Lo que se piensa la mascota antes de tirar. Sin esto tira en el mismo cuadro. */
const PENSAR_S = 1.1;
/** Y lo que como mucho dura la repetición del tiro del rival. */
const TOPE_REPETICION_S = 8;

// ---- La cuesta -------------------------------------------------------------
//
// Contra la mascota, la dificultad es LA MASCOTA: cuánto se desvía al apuntar y
// cuánto se equivoca con la fuerza. Es la misma idea del Pong, donde el rival
// falla menos según el nivel, y por el mismo motivo: en un juego de dos no hay
// «más ladrillos», hay un rival mejor.

/** Nivel al que se abre el juego, y desde el que empieza a apretar. */
const NIVEL_BASE = 55;
/** Y aquel en el que la mascota ya es todo lo buena que va a ser. */
const NIVEL_MAESTRO = 100;

/** Desvío al apuntar, en radianes, de la mascota más torpe. */
const ERROR_TORPE = 0.075;
/**
 * Lo que se le quita con el nivel. Nunca todo: en el 100 le quedan 0,012
 * radianes, que a media mesa son unos cinco píxeles. Una mascota que no falla
 * jamás no es un rival, es un muro.
 */
const ERROR_APRENDIDO = 0.063;
/** Y lo que se equivoca con la fuerza, en partes de lo que quería tirar. */
const ERROR_FUERZA = 0.16;

/** Ángulo de corte por encima del cual la mascota no se fía de un tiro. */
const CORTE_MAX = 1.25;   // ~72°

export function crearPartida(ctx) {
  const pista = ctx.escenario;
  const { pato, entrada } = pista;

  const mejorPrevio = typeof ctx.marcas.mejor === 'number' ? ctx.marcas.mejor : null;

  const enRed = ctx.modo === 'turnos' && !!ctx.sala;
  const nombreRival = (ctx.jugadores || []).find((n) => n !== ctx.yo) || 'tu rival';

  /**
   * Lo torpe que es la mascota, de 0 (recién desbloqueado) a 1.
   *
   * En red no se usa: allí el rival es una persona.
   */
  const maña = Math.max(0, Math.min(1,
    (ctx.nivel - NIVEL_BASE) / (NIVEL_MAESTRO - NIVEL_BASE)));

  /** El orden del triángulo sale de la semilla: en red, la misma en los dos. */
  const orden = ordenDelTriangulo(ctx.semilla);

  /** 'apuntando' | 'rodando' | 'pensando' | 'esperando' | 'fin' */
  let fase = 'apuntando';
  let terminada = false;
  let transcurrido = 0;
  let pulsadoAntes = false;

  /** De quién es el tiro: 'yo' o 'el'. En red, el anfitrión rompe. */
  let turno = enRed ? (ctx.anfitrion ? 'yo' : 'el') : 'yo';
  /** 'lisas' | 'rayadas' | null mientras la mesa siga abierta. */
  let miGrupo = null;
  let suGrupo = null;

  let misTiros = 0;
  /** Bolas metidas seguidas sin perder el turno, y la mejor racha de la partida. */
  let seguidas = 0;
  let mejorRacha = 0;

  /** Lo que hace falta para juzgar el tiro cuando la mesa se para. */
  let tirador = 'yo';
  let primerContacto = -1;
  let metidasDelTiro = [];
  /** Dónde salió la blanca y con qué, para que el otro lado lo repita. */
  let salida = { x: 0, y: 0 };
  let ultimoTiro = { vx: 0, vy: 0 };
  let pensando = 0;
  let repeticion = 0;
  /**
   * Lo que dictó el rival y todavía no se ha aplicado.
   *
   * Llega con su tacada y espera a que termine la repetición: hasta que la mesa
   * no se para no se puede clavar nada, o se vería saltar las bolas a su sitio
   * en mitad del tiro.
   */
  let pendiente = null;

  let campo = medirCampo(pista.medidas, pista.aPantalla);
  let radio = radioDeBola(campo);
  /** @type {{n:number, x:number, y:number, vx:number, vy:number, metida:boolean}[]} */
  const bolas = [];
  /** Las seis troneras, en píxeles. Se rehacen con el campo. */
  let troneras = troneraDelCampo(campo, radio);

  let bajaSala = null;
  if (enRed) bajaSala = ctx.sala.alRecibir((m) => recibirTacada(m));

  colocarBolas();
  pista.cursor('crosshair');
  colocarMascota(pista.medidas);
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
    sincronizarCampo(p.medidas, p.aPantalla);

    const antes = transcurrido;
    transcurrido += dt * 1000;
    // Se acaba el tiempo, pero no se corta a mitad de una tacada: se espera a
    // que la mesa esté quieta y no quede nada del rival por aplicar. Cortar en
    // el aire dejaría a los dos lados con tableros distintos, y además se vería
    // fatal. La espera está acotada: `TOPE_REPETICION_S` para la mesa pase lo
    // que pase.
    if (transcurrido >= PRESUPUESTO_MS && fase !== 'rodando' && !pendiente) {
      cerrarPorTiempo();
      return;
    }
    // El aviso del final se repinta al cambiar de segundo, no sesenta veces por
    // segundo: el marcador es DOM.
    if (PRESUPUESTO_MS - transcurrido < AVISO_MS
      && Math.ceil(antes / 1000) !== Math.ceil(transcurrido / 1000)) marcar();

    if (fase === 'rodando') {
      rodar(dt);
    } else if (fase === 'pensando') {
      pensando -= dt;
      if (pensando <= 0) tirarLaMascota();
    } else if (fase === 'apuntando') {
      apuntar(p.medidas);
    }

    pintar(p.pintor, p.medidas);
  }

  // ---- Apuntar -----------------------------------------------------------

  function apuntar(medidas) {
    const blanca = laBlanca();
    const tiro = tiroDelCursor(blanca, medidas);
    pato.setFacing(tiro.vx >= 0 ? 1 : -1);

    // Se tira al SOLTAR y no al pulsar: así se corrige la puntería sin gastar el
    // tiro, igual que en el minigolf.
    if (pulsadoAntes && !entrada.pulsado) {
      pulsadoAntes = false;
      if (tiro.fuerza >= FUERZA_MINIMA) tirar(tiro.vx, tiro.vy);
      return;
    }
    pulsadoAntes = entrada.pulsado;
  }

  /** Hacia el cursor, y con la fuerza que dé la distancia. */
  function tiroDelCursor(blanca, medidas) {
    const dx = entrada.x - blanca.x;
    const dy = entrada.y - blanca.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return { vx: 0, vy: 0, fuerza: 0 };
    const parte = Math.min(1, dist / Math.max(1, medidas.ancho * ALCANCE));
    const fuerza = parte * FUERZA_MAX;
    return { vx: (dx / dist) * fuerza, vy: (dy / dist) * fuerza, fuerza };
  }

  /** Pone la mesa en marcha. Vale para mi tiro, el de la mascota y el del rival. */
  function tirar(vx, vy) {
    const blanca = laBlanca();
    salida = { x: blanca.x, y: blanca.y };
    ultimoTiro = { vx, vy };
    blanca.vx = vx;
    blanca.vy = vy;
    primerContacto = -1;
    metidasDelTiro = [];
    if (tirador === 'yo') misTiros++;
    fase = 'rodando';
    repeticion = 0;
    ctx.sonido.nota(300, 0.05);
  }

  // ---- Rodar -------------------------------------------------------------
  //
  // La física no vive aquí: está abajo, en funciones de módulo puras que sólo
  // tocan las bolas que se les pasan. No es manía de orden —encerrada en este
  // cierre no habría forma de medirla sin abrir una ventana, y una mesa de billar
  // es justo lo que hay que medir antes de jugarla—. Aquí sólo queda lo que
  // depende de la partida: las reglas, el sonido y de quién es el turno.

  function rodar(dt) {
    repeticion += dt;
    const paso = rodarMesa(bolas, radio, campo, troneras, dt);

    if (paso.contacto >= 0 && primerContacto < 0) primerContacto = paso.contacto;
    for (const n of paso.metidas) {
      metidasDelTiro.push(n);
      ctx.sonido.nota(n === 0 ? 170 : 720, 0.09);
    }
    // Sólo el choque más fuerte del fotograma: en una apertura hay quince en el
    // mismo cuadro y quince notas a la vez no son un sonido, son un ruido.
    if (paso.golpe >= 120) ctx.sonido.nota(420 + Math.min(260, paso.golpe * 0.14), 0.03);

    // Un tope de tiempo por si algo no se calma: en la repetición del tiro del
    // rival la posición buena viene en el mensaje, y en un tiro propio una mesa
    // que no para dejaría la partida colgada.
    if (todasQuietas(bolas) || repeticion > TOPE_REPETICION_S) {
      for (const b of bolas) { b.vx = 0; b.vy = 0; }
      resolverTacada();
    }
  }

  // ---- El veredicto ------------------------------------------------------

  /**
   * La mesa se ha parado: ahora se juzga.
   *
   * Lo juzga SIEMPRE el lado del que tiró, y en red se manda ya masticado. Que
   * cada uno aplique el reglamento por su cuenta es la forma segura de acabar
   * con dos partidas distintas.
   */
  function resolverTacada() {
    // Si el tiro era del rival, el veredicto vino con él: ni se juzga ni se
    // discute. Lo único que hacía falta era esperar a que la mesa se parara.
    if (pendiente) { aplicarPendiente(); return; }

    const veredicto = juzgar();
    aplicarVeredicto(veredicto);
    if (enRed && tirador === 'yo') mandarTacada(veredicto);
    if (!terminada) arrancarTurno();
  }

  /** @returns {{falta:boolean, grupo:string|null, sigue:boolean, gana:string|null}} */
  function juzgar() {
    const suyo = tirador === 'yo' ? miGrupo : suGrupo;
    const colóLaBlanca = metidasDelTiro.includes(0);
    const metióLaNegra = metidasDelTiro.includes(NEGRA);

    let falta = colóLaBlanca || primerContacto < 0;
    // Tocar primero una que no es tuya. Con la mesa abierta vale cualquiera
    // menos la negra, que es la última pase lo que pase.
    if (!falta && primerContacto === NEGRA && quedanDelGrupo(suyo)) falta = true;
    if (!falta && suyo && primerContacto > 0 && primerContacto !== NEGRA
      && grupoDe(primerContacto) !== suyo) falta = true;

    // La negra decide en el acto, y en la dirección que toque. `limpia` separa
    // dos finales que no se parecen en nada: cerrar la partida como se debe, o
    // mandar la negra dentro cuando todavía te quedaban bolas.
    if (metióLaNegra) {
      const limpia = !falta && !quedanDelGrupo(suyo);
      return {
        falta, grupo: null, sigue: false,
        gana: limpia ? tirador : otro(tirador),
        motivo: limpia ? 'negra' : 'negraPronto'
      };
    }

    // Mesa abierta: el grupo lo reparte la primera que se meta.
    let grupo = null;
    if (!suyo && !falta) {
      const primera = metidasDelTiro.find((n) => n > 0 && n !== NEGRA);
      if (primera != null) grupo = grupoDe(primera);
    }

    const mias = grupo || suyo;
    const metióDeLasSuyas = metidasDelTiro.some((n) =>
      n > 0 && n !== NEGRA && (!mias || grupoDe(n) === mias));

    return { falta, grupo, sigue: !falta && metióDeLasSuyas, gana: null };
  }

  function aplicarVeredicto(v) {
    if (v.grupo) {
      if (tirador === 'yo') { miGrupo = v.grupo; suGrupo = elOtroGrupo(v.grupo); }
      else { suGrupo = v.grupo; miGrupo = elOtroGrupo(v.grupo); }
    }

    // La racha es mía y sólo mía: lo que meta el rival no me la sube ni me la
    // baja, pero perder el turno la corta.
    if (tirador === 'yo') {
      const mias = metidasDelTiro.filter((n) =>
        n > 0 && n !== NEGRA && (!miGrupo || grupoDe(n) === miGrupo)).length;
      seguidas += mias;
      if (seguidas > mejorRacha) mejorRacha = seguidas;
      if (!v.sigue) seguidas = 0;
    }

    if (v.falta) {
      devolverLaBlanca();
      ctx.decir(tirador === 'yo' ? 'Falta. La blanca vuelve a la cabecera.'
        : `Falta de ${quienEs(tirador)}.`);
    }

    if (v.gana) { acabar(v.gana === 'yo' ? 'victoria' : 'derrota', v.motivo); return; }
    if (!v.sigue) turno = otro(tirador);
    marcar();
  }

  /** Tras una falta: a la cabecera, y si está ocupada, a un hueco al lado. */
  function devolverLaBlanca() {
    const blanca = laBlanca();
    blanca.metida = false;
    blanca.vx = 0;
    blanca.vy = 0;
    const y = campo.y0 + campo.alto * 0.5;
    for (let i = 0; i < 40; i++) {
      const x = campo.x0 + campo.ancho * 0.25;
      const cy = y + (i % 2 ? -1 : 1) * radio * 2.2 * Math.ceil(i / 2);
      if (cy < campo.y0 + radio || cy > campo.y1 - radio) continue;
      blanca.x = x;
      blanca.y = cy;
      if (!chocaConAlguna(blanca)) return;
    }
    blanca.x = campo.x0 + campo.ancho * 0.25;
    blanca.y = y;
  }

  function chocaConAlguna(quien) {
    for (const b of bolas) {
      if (b === quien || b.metida) continue;
      if (Math.hypot(b.x - quien.x, b.y - quien.y) < radio * 2.05) return true;
    }
    return false;
  }

  // ---- De un turno al siguiente ------------------------------------------

  function arrancarTurno() {
    if (terminada) return;
    tirador = turno;
    if (turno === 'yo') {
      fase = 'apuntando';
      // Si el botón viene pulsado de antes, soltarlo no puede contar como tiro.
      pulsadoAntes = entrada.pulsado;
      return;
    }
    if (enRed) { fase = 'esperando'; return; }
    fase = 'pensando';
    pensando = PENSAR_S;
    ctx.pato.animar('play', PENSAR_S * 1000);
  }

  // ---- La mascota --------------------------------------------------------

  /**
   * Elige tronera y bola, y tira con el error que le toque por nivel.
   *
   * Busca la bola fantasma: dónde tiene que estar la blanca en el momento del
   * contacto para que la suya salga hacia la tronera. Eso da la dirección exacta
   * del tiro; lo que la hace fallar es el desvío, no el cálculo.
   */
  function tirarLaMascota() {
    tirador = 'el';
    const blanca = laBlanca();
    const plan = mejorTiro(blanca, suGrupo);
    const desvio = (Math.random() * 2 - 1) * (ERROR_TORPE - maña * ERROR_APRENDIDO);
    const ang = plan.angulo + desvio;
    const fuerza = plan.fuerza * (1 + (Math.random() * 2 - 1) * ERROR_FUERZA * (1 - maña));
    tirar(Math.cos(ang) * fuerza, Math.sin(ang) * fuerza);
  }

  /** @returns {{angulo:number, fuerza:number}} */
  function mejorTiro(blanca, grupo) {
    let mejor = null;
    for (const b of bolas) {
      if (b.metida || b.n === 0) continue;
      if (!leToca(b.n, grupo)) continue;
      for (const t of troneras) {
        const tiro = tiroFantasma(blanca, b, t);
        if (!tiro) continue;
        if (!mejor || tiro.nota > mejor.nota) mejor = tiro;
      }
    }
    if (mejor) return { angulo: mejor.angulo, fuerza: mejor.fuerza };

    // Nada claro: se empuja hacia la bola más cercana de las suyas, flojo. Es la
    // jugada de seguridad del que no ve nada, y la mascota la juega igual.
    const suya = bolas.find((b) => !b.metida && b.n !== 0 && leToca(b.n, grupo));
    const hacia = suya || bolas.find((b) => !b.metida && b.n !== 0);
    const ang = hacia ? Math.atan2(hacia.y - blanca.y, hacia.x - blanca.x) : 0;
    return { angulo: ang, fuerza: FUERZA_MAX * 0.42 };
  }

  /**
   * El tiro que mete `bola` en `tronera`, si es que hay alguno.
   *
   * Devuelve `null` cuando el corte es demasiado abierto —por encima de
   * `CORTE_MAX` no se puede empujar una bola hacia allí— o cuando hay algo por
   * medio en cualquiera de los dos tramos.
   */
  function tiroFantasma(blanca, bola, tronera) {
    const hx = tronera.x - bola.x;
    const hy = tronera.y - bola.y;
    const haciaHoyo = Math.hypot(hx, hy);
    if (haciaHoyo < 1) return null;

    // La fantasma: a dos radios de la bola, en la línea contraria a la tronera.
    const fx = bola.x - (hx / haciaHoyo) * radio * 2;
    const fy = bola.y - (hy / haciaHoyo) * radio * 2;

    const dx = fx - blanca.x;
    const dy = fy - blanca.y;
    const alFantasma = Math.hypot(dx, dy);
    if (alFantasma < 1) return null;

    const corte = Math.acos(Math.max(-1, Math.min(1,
      (dx / alFantasma) * (hx / haciaHoyo) + (dy / alFantasma) * (hy / haciaHoyo))));
    if (corte > CORTE_MAX) return null;

    if (estorbaAlgo(blanca.x, blanca.y, fx, fy, [blanca.n, bola.n])) return null;
    if (estorbaAlgo(bola.x, bola.y, tronera.x, tronera.y, [bola.n])) return null;

    // Fuerza: lo justo para llegar, con margen. La distancia total y el corte la
    // suben, porque un corte abierto se lleva parte de la energía.
    const largo = alFantasma + haciaHoyo;
    const fuerza = Math.min(FUERZA_MAX,
      420 + largo * 0.95 + Math.tan(Math.min(corte, 1.3)) * 220);

    // Cuanto más corto y más recto, mejor.
    return { angulo: Math.atan2(dy, dx), fuerza, nota: 1 / (largo * (1 + corte * 1.4)) };
  }

  /** ¿Hay alguna bola cruzada en el segmento? */
  function estorbaAlgo(x0, y0, x1, y1, salvo) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const largo = Math.hypot(dx, dy);
    if (largo < 1) return false;
    for (const b of bolas) {
      if (b.metida || salvo.includes(b.n)) continue;
      // Distancia del centro al segmento, con el punto más cercano acotado a
      // los extremos: una bola detrás de la tronera no estorba.
      const t = Math.max(0, Math.min(1, ((b.x - x0) * dx + (b.y - y0) * dy) / (largo * largo)));
      const px = x0 + dx * t;
      const py = y0 + dy * t;
      if (Math.hypot(b.x - px, b.y - py) < radio * 1.95) return true;
    }
    return false;
  }

  // ---- Por la red --------------------------------------------------------

  /** Lo que se manda tras cada tacada. Todo en proporciones del campo. */
  function mandarTacada(v) {
    ctx.sala.enviar({
      t: 'tacada',
      sx: aProporcionX(salida.x), sy: aProporcionY(salida.y),
      vx: ultimoTiro.vx / campo.ancho, vy: ultimoTiro.vy / campo.alto,
      // La mesa entera al acabar, que es lo autoritativo. Cuatro decimales: un
      // campo de 1400 píxeles se reparte en trozos de 0,14, muy por debajo de un
      // píxel.
      mesa: bolas.map((b) => (b.metida ? 'x'
        : `${aProporcionX(b.x).toFixed(4)},${aProporcionY(b.y).toFixed(4)}`)).join('|'),
      falta: !!v.falta, grupo: v.grupo || '', sigue: !!v.sigue,
      gana: v.gana || '', motivo: v.motivo || ''
    });
  }

  /**
   * La tacada del rival.
   *
   * Se repite el tiro para que se vea lo que hizo, pero lo que manda es `mesa`:
   * con dieciséis bolas chocando entre sí, una diferencia de un píxel en el
   * primer contacto reparte la mesa de otra manera. Al acabar se clava todo.
   */
  function recibirTacada(m) {
    if (!m || m.t !== 'tacada' || terminada) return;

    // El veredicto se aplica ANTES que nada: si la partida ha acabado, no hay
    // repetición que valga.
    const suGana = m.gana === 'yo' ? 'el' : m.gana === 'el' ? 'yo' : null;
    if (m.grupo) {
      suGrupo = String(m.grupo);
      miGrupo = elOtroGrupo(suGrupo);
    }

    tirador = 'el';
    const blanca = laBlanca();
    blanca.metida = false;
    blanca.x = deProporcionX(m.sx);
    blanca.y = deProporcionY(m.sy);
    for (const b of bolas) { b.vx = 0; b.vy = 0; }
    blanca.vx = (Number(m.vx) || 0) * campo.ancho;
    blanca.vy = (Number(m.vy) || 0) * campo.alto;

    fase = 'rodando';
    repeticion = 0;
    primerContacto = -1;
    metidasDelTiro = [];
    // Lo que se aplicará cuando la mesa se pare, ya masticado por quien tiró.
    pendiente = {
      mesa: String(m.mesa || ''), falta: !!m.falta, sigue: !!m.sigue,
      gana: suGana, motivo: String(m.motivo || 'negra')
    };
    ctx.sonido.nota(300, 0.05);
    marcar();
  }

  /** Clava la mesa donde diga el mensaje y aplica lo que dictó el rival. */
  function aplicarPendiente() {
    const trozos = pendiente.mesa.split('|');
    for (let i = 0; i < bolas.length && i < trozos.length; i++) {
      const b = bolas[i];
      b.vx = 0;
      b.vy = 0;
      if (trozos[i] === 'x') { b.metida = true; continue; }
      const par = trozos[i].split(',');
      b.metida = false;
      b.x = deProporcionX(par[0]);
      b.y = deProporcionY(par[1]);
    }

    if (pendiente.falta) ctx.decir(`Falta de ${nombreRival}.`);
    const gana = pendiente.gana;
    const sigue = pendiente.sigue;
    const motivo = pendiente.motivo;
    pendiente = null;

    if (gana) { acabar(gana === 'yo' ? 'victoria' : 'derrota', motivo); return; }
    if (!sigue) turno = 'yo';
    marcar();
    arrancarTurno();
  }

  // ---- Final -------------------------------------------------------------

  /**
   * Se acabó el tiempo.
   *
   * Contra la mascota gana quien lleve menos bolas por meter, que es lo justo.
   *
   * **En red es empate, y no por pereza.** Los dos lados no cuentan el reloj a
   * la vez, así que uno puede cerrar con la última tacada del otro todavía
   * viajando: medido, dos tableros separados por una bola. Con eso, contar las
   * que quedan puede dar victoria en una pantalla y empate en la otra, y un
   * resultado que no cuadra entre los dos es peor que un empate romo. Arreglarlo
   * de verdad pediría un apretón de manos al final que el protocolo no tiene, y
   * no lo merece un caso que sólo pasa cuando los dos han jugado ocho minutos y
   * medio sin llegar a la negra.
   */
  function cerrarPorTiempo() {
    if (enRed) {
      ctx.decir('Se acabó el tiempo. Empate.');
      acabar('empate', 'tiempo');
      return;
    }
    const mias = quedanDelGrupo(miGrupo);
    const suyas = quedanDelGrupo(suGrupo);
    ctx.decir('Se acabó el tiempo.');
    acabar(mias < suyas ? 'victoria' : mias > suyas ? 'derrota' : 'empate', 'tiempo');
  }

  function acabar(resultado, motivo) {
    if (terminada) return;
    terminada = true;
    fase = 'fin';

    ctx.sonido[resultado === 'victoria' ? 'victoria' : 'derrota']();
    ctx.pato.animar(resultado === 'victoria' ? 'happy' : 'idle', 1400);
    ctx.alTerminar({
      resultado,
      puntos: mejorRacha,
      detalle: detalleFinal(resultado, motivo)
    });
  }

  function detalleFinal(resultado, motivo) {
    const contra = enRed ? nombreRival : 'tu mascota';
    const racha = mejorRacha >= 2 ? ` Tu mejor serie: ${mejorRacha} seguidas.` : '';
    const record = mejorPrevio !== null && mejorRacha > mejorPrevio
      ? ` Récord: antes eran ${mejorPrevio}.` : '';

    if (motivo === 'tiempo') {
      const cierre = enRed ? 'Empate por tiempo contra' : 'Se acabó el tiempo contra';
      return `${cierre} ${contra}, en ${misTiros} tacadas.${racha}${record}`;
    }

    // Cuatro finales, y hay que distinguirlos: ganar metiendo la negra como se
    // debe no se parece en nada a ganar porque el otro la coló antes de tiempo,
    // y decirle a alguien que «la negra se fue antes de tiempo» cuando lo que ha
    // pasado es que le han ganado limpiamente es sencillamente falso.
    const cabeza = motivo === 'negraPronto'
      ? (resultado === 'victoria'
        ? `${contra} ha metido la negra antes de tiempo. Ganas tú.`
        : 'La negra se te ha ido antes de tiempo.')
      : (resultado === 'victoria'
        ? `La negra, y a casa. Ganado a ${contra} en ${misTiros} tacadas.`
        : `${contra} ha cerrado con la negra. Buena partida.`);
    return `${cabeza}${racha}${record}`;
  }

  function marcar() {
    const queda = PRESUPUESTO_MS - transcurrido;
    const prisa = queda < AVISO_MS ? `  ·  ¡${Math.max(0, Math.ceil(queda / 1000))} s!` : '';
    const grupos = miGrupo
      ? `tú ${nombreGrupo(miGrupo)} ${quedanDelGrupo(miGrupo)}  ·  `
        + `${quienEs('el')} ${nombreGrupo(suGrupo)} ${quedanDelGrupo(suGrupo)}`
      : 'mesa abierta';
    const turnoTexto = terminada ? ''
      : turno === 'yo' ? '  ·  te toca' : `  ·  juega ${quienEs('el')}`;
    const racha = seguidas >= 2 ? `  ·  ${seguidas} seguidas` : '';
    pista.marcador(`${grupos}${turnoTexto}${racha}${prisa}`);
  }

  // ---- Consultas sobre la mesa -------------------------------------------

  // Declaradas con `function` y no con `const`: todo esto vive DESPUÉS del
  // `return` de `crearPartida`, donde sólo se izan las declaraciones de función
  // (ver la tercera regla del contrato, en minijuegos/index.js).
  function laBlanca() { return bolas[0]; }
  function otro(quien) { return quien === 'yo' ? 'el' : 'yo'; }
  function quienEs(quien) { return quien === 'yo' ? 'tú' : (enRed ? nombreRival : 'tu mascota'); }
  /** La negra no es de nadie: devuelve `null` a propósito. */
  function grupoDe(n) { return n === NEGRA ? null : n < NEGRA ? 'lisas' : 'rayadas'; }
  function elOtroGrupo(g) { return g === 'lisas' ? 'rayadas' : 'lisas'; }
  function nombreGrupo(g) { return g === 'lisas' ? 'lisas' : g === 'rayadas' ? 'rayadas' : ''; }
  /** ¿Esa bola es suya? La negra sólo cuando ya no le queda ninguna. */
  function leToca(n, grupo) {
    if (n === NEGRA) return grupo != null && quedanDelGrupo(grupo) === 0;
    if (!grupo) return true;      // mesa abierta: cualquiera menos la negra
    return grupoDe(n) === grupo;
  }

  /** Cuántas quedan del grupo. Sin grupo asignado, las siete de cada uno. */
  function quedanDelGrupo(grupo) {
    if (!grupo) return 7;
    let n = 0;
    for (const b of bolas) {
      if (!b.metida && b.n !== 0 && b.n !== NEGRA && grupoDe(b.n) === grupo) n++;
    }
    return n;
  }

  function aProporcionX(x) { return (x - campo.x0) / campo.ancho; }
  function aProporcionY(y) { return (y - campo.y0) / campo.alto; }
  function deProporcionX(p) { return campo.x0 + (Number(p) || 0) * campo.ancho; }
  function deProporcionY(p) { return campo.y0 + (Number(p) || 0) * campo.alto; }

  // ---- Medidas -----------------------------------------------------------

  function colocarBolas() {
    bolas.length = 0;
    for (const b of montarLasBolas(orden, campo, radio)) bolas.push(b);
  }

  /**
   * El campo se vuelve a medir en cada fotograma porque la ventana puede cambiar
   * de tamaño a mitad. Cuando cambia se REESCALA lo que hay en vez de rehacer la
   * mesa: rehacerla sería borrar la partida.
   */
  function sincronizarCampo(medidas, aPantalla) {
    const nuevo = medirCampo(medidas, aPantalla);
    if (nuevo.x0 === campo.x0 && nuevo.y0 === campo.y0
      && nuevo.ancho === campo.ancho && nuevo.alto === campo.alto) return;

    const fx = nuevo.ancho / campo.ancho;
    const fy = nuevo.alto / campo.alto;
    for (const b of bolas) {
      b.x = nuevo.x0 + (b.x - campo.x0) * fx;
      b.y = nuevo.y0 + (b.y - campo.y0) * fy;
      b.vx *= fx;
      b.vy *= fy;
    }
    salida = {
      x: nuevo.x0 + (salida.x - campo.x0) * fx,
      y: nuevo.y0 + (salida.y - campo.y0) * fy
    };
    campo = nuevo;
    radio = radioDeBola(campo);
    troneras = troneraDelCampo(campo, radio);
    colocarMascota(medidas);
  }

  /** Abajo a la izquierda, fuera de la mesa y mirando. */
  function colocarMascota(medidas) {
    pato.setTilt(0);
    pato.setState('idle');
    pato.setX(Math.max(4, campo.x0));
    pato.setY(medidas.suelo);
  }

  // ---- Pintado -----------------------------------------------------------

  function pintar(g, medidas) {
    dibujarMesa(g);
    for (const t of troneras) dibujarTronera(g, t);
    for (const b of bolas) { if (!b.metida) dibujarBola(g, b); }
    dibujarMetidas(g);
    if (fase === 'apuntando') dibujarPrevia(g, medidas);
  }

  function dibujarMesa(g) {
    g.save();
    // Traslúcido a propósito: el pato vive encima del escritorio de alguien, y
    // un rectángulo opaco a pantalla completa da un susto que no toca.
    g.fillStyle = 'rgba(20, 92, 62, 0.9)';
    g.fillRect(campo.x0, campo.y0, campo.ancho, campo.alto);
    g.lineWidth = Math.max(8, radio * 0.9);
    g.strokeStyle = '#5a3921';
    g.strokeRect(campo.x0 - g.lineWidth / 2, campo.y0 - g.lineWidth / 2,
      campo.ancho + g.lineWidth, campo.alto + g.lineWidth);
    // La línea de cabecera: donde vuelve la blanca tras una falta.
    g.lineWidth = 1;
    g.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    g.beginPath();
    g.moveTo(campo.x0 + campo.ancho * 0.25, campo.y0);
    g.lineTo(campo.x0 + campo.ancho * 0.25, campo.y1);
    g.stroke();
    g.restore();
  }

  function dibujarTronera(g, t) {
    g.save();
    g.fillStyle = '#15151c';
    g.beginPath();
    g.arc(t.x, t.y, t.radio, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  function dibujarBola(g, b) {
    g.save();
    g.beginPath();
    g.arc(b.x, b.y, radio, 0, Math.PI * 2);
    g.fillStyle = b.n === 0 ? '#f6f6f2' : colorDeBola(b.n);
    g.fill();

    // Las rayadas: casquetes blancos arriba y abajo, y la franja de color en
    // medio. Los casquetes son ESTRECHOS a propósito: la primera versión los
    // hacía de 0,62 del radio y la franja de color quedaba más fina que el
    // círculo del número, así que lo tapaba entero y las siete rayadas salían
    // blancas e iguales. Se veía en una captura y no jugando, que es justo para
    // lo que sirve mirar una captura.
    if (b.n > NEGRA) {
      g.save();
      g.beginPath();
      g.arc(b.x, b.y, radio, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = '#f6f6f2';
      g.fillRect(b.x - radio, b.y - radio, radio * 2, radio * 0.34);
      g.fillRect(b.x - radio, b.y + radio * 0.66, radio * 2, radio * 0.34);
      g.restore();
    }

    g.lineWidth = 1;
    g.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    g.stroke();

    if (b.n > 0 && radio >= 9) {
      g.beginPath();
      g.arc(b.x, b.y, radio * 0.46, 0, Math.PI * 2);
      g.fillStyle = '#f6f6f2';
      g.fill();
      g.fillStyle = '#1c1c26';
      g.font = `700 ${Math.round(radio * 0.7)}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(b.n), b.x, b.y + radio * 0.04);
    }
    g.restore();
  }

  /** Las metidas, en fila fuera de la mesa: saber qué queda es medio juego. */
  function dibujarMetidas(g) {
    const metidas = bolas.filter((b) => b.metida && b.n !== 0);
    if (!metidas.length) return;
    g.save();
    const r = Math.max(5, radio * 0.6);
    const y = campo.y1 + r + Math.max(10, radio);
    for (let i = 0; i < metidas.length; i++) {
      g.beginPath();
      g.arc(campo.x0 + r + i * r * 2.3, y, r, 0, Math.PI * 2);
      g.fillStyle = colorDeBola(metidas[i].n);
      g.fill();
      g.lineWidth = 1;
      g.strokeStyle = 'rgba(0, 0, 0, 0.4)';
      g.stroke();
    }
    g.restore();
  }

  /**
   * La ayuda de puntería: la línea hasta lo primero que se cruce, y dónde
   * quedaría la blanca al tocarlo.
   *
   * En un billar la línea recta es media partida, y sin ella apuntar a ojo en
   * una mesa de mil cuatrocientos píxeles es una lotería. La fuerza va en una
   * barra aparte, como en el minigolf.
   */
  function dibujarPrevia(g, medidas) {
    const blanca = laBlanca();
    const tiro = tiroDelCursor(blanca, medidas);
    if (tiro.fuerza < FUERZA_MINIMA) return;

    const largo = Math.hypot(tiro.vx, tiro.vy);
    const ux = tiro.vx / largo;
    const uy = tiro.vy / largo;
    const choque = hastaDondeLlega(blanca, ux, uy);

    g.save();
    g.setLineDash([6, 6]);
    g.lineWidth = 2;
    g.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    g.beginPath();
    g.moveTo(blanca.x, blanca.y);
    g.lineTo(blanca.x + ux * choque, blanca.y + uy * choque);
    g.stroke();
    g.setLineDash([]);

    g.beginPath();
    g.arc(blanca.x + ux * choque, blanca.y + uy * choque, radio, 0, Math.PI * 2);
    g.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    g.stroke();

    // La barra de fuerza, junto a la blanca.
    const parte = tiro.fuerza / FUERZA_MAX;
    g.fillStyle = 'rgba(0, 0, 0, 0.35)';
    g.fillRect(blanca.x - radio * 2, blanca.y - radio * 3, radio * 4, 5);
    g.fillStyle = parte > 0.85 ? '#e63946' : '#ffb703';
    g.fillRect(blanca.x - radio * 2, blanca.y - radio * 3, radio * 4 * parte, 5);
    g.restore();
  }

  /** Cuánto avanza la blanca antes de tocar una bola o una banda. */
  function hastaDondeLlega(blanca, ux, uy) {
    let tope = 4000;
    if (ux > 0.001) tope = Math.min(tope, (campo.x1 - radio - blanca.x) / ux);
    if (ux < -0.001) tope = Math.min(tope, (campo.x0 + radio - blanca.x) / ux);
    if (uy > 0.001) tope = Math.min(tope, (campo.y1 - radio - blanca.y) / uy);
    if (uy < -0.001) tope = Math.min(tope, (campo.y0 + radio - blanca.y) / uy);

    for (const b of bolas) {
      if (b.metida || b.n === 0) continue;
      // Corte de la recta con el círculo de radio doble alrededor de la otra
      // bola: es donde se tocarían.
      const px = b.x - blanca.x;
      const py = b.y - blanca.y;
      const proy = px * ux + py * uy;
      if (proy <= 0) continue;
      const dentro = (radio * 2) * (radio * 2) - (px * px + py * py - proy * proy);
      if (dentro < 0) continue;
      tope = Math.min(tope, proy - Math.sqrt(dentro));
    }
    return Math.max(0, tope);
  }
}

// ---- La física de la mesa -------------------------------------------------
//
// Puras: reciben las bolas, el campo y las troneras, y no saben nada de la
// partida. Así se pueden correr mil aperturas en Node sin abrir una ventana, que
// es como se han elegido el rozamiento y la restitución de aquí arriba.

/** @typedef {{n:number, x:number, y:number, vx:number, vy:number, metida:boolean}} Bola */

/**
 * Cuánto dura un subpaso para que nadie se salte a nadie.
 *
 * Se mira la bola más rápida de la mesa: si en un fotograma entero recorre más
 * de `PASO_MAX`, se parte. A 1900 píxeles por segundo y sesenta fotogramas son
 * treinta y dos píxeles, y una bola de diecinueve de radio atravesaría a otra
 * sin enterarse.
 *
 * @param {Bola[]} bolas
 */
export function subpasoDe(bolas, dt) {
  let vmax = 0;
  for (const b of bolas) {
    if (b.metida) continue;
    const v = Math.hypot(b.vx, b.vy);
    if (v > vmax) vmax = v;
  }
  return dt / Math.max(1, Math.ceil((vmax * dt) / PASO_MAX));
}

/**
 * Un fotograma entero de mesa, en los subpasos que hagan falta.
 *
 * @returns {{contacto:number, metidas:number[], golpe:number}}
 *   `contacto` es la PRIMERA bola que tocó la blanca —la que decide si hubo
 *   falta—, o -1; `golpe` es el choque más fuerte, para el sonido.
 */
export function rodarMesa(bolas, radio, campo, troneras, dt) {
  const paso = subpasoDe(bolas, dt);
  const pasos = Math.max(1, Math.round(dt / paso));
  const parte = { contacto: -1, metidas: [], golpe: 0 };
  for (let i = 0; i < pasos; i++) pasoDeMesa(bolas, radio, campo, troneras, paso, parte);
  return parte;
}

/** Un subpaso: rozamiento, avance, choques, troneras y bandas. En ese orden. */
export function pasoDeMesa(bolas, radio, campo, troneras, paso, parte) {
  const freno = Math.exp(-ROZAMIENTO * paso);
  for (const b of bolas) {
    if (b.metida) continue;
    b.vx *= freno;
    b.vy *= freno;
    b.x += b.vx * paso;
    b.y += b.vy * paso;
  }

  for (let i = 0; i < bolas.length; i++) {
    const a = bolas[i];
    if (a.metida) continue;
    for (let j = i + 1; j < bolas.length; j++) {
      const b = bolas[j];
      if (b.metida) continue;
      chocar(a, b, radio, parte);
    }
  }

  for (const b of bolas) {
    if (b.metida) continue;
    if (entraEnTronera(b, troneras)) {
      b.metida = true;
      b.vx = 0;
      b.vy = 0;
      parte.metidas.push(b.n);
      continue;
    }
    chocarConLasBandas(b, radio, campo);
  }
  return parte;
}

/**
 * El choque entre dos bolas iguales, exacto.
 *
 * Se descompone en la línea que une los centros: las componentes normales se
 * INTERCAMBIAN —masas iguales— y las tangenciales no se tocan. No hace falta
 * ningún solucionador porque no hay contactos sostenidos: dos bolas quietas no
 * se tocan, así que esto nunca actúa dos veces seguidas sobre la misma pareja.
 */
export function chocar(a, b, radio, parte) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  if (d >= radio * 2 || d === 0) return;

  const nx = dx / d;
  const ny = dy / d;

  // Se separan antes de nada: superpuestas, al siguiente subpaso volverían a
  // chocar y acabarían pegadas la una a la otra.
  const solape = radio * 2 - d;
  a.x -= nx * solape * 0.5;
  a.y -= ny * solape * 0.5;
  b.x += nx * solape * 0.5;
  b.y += ny * solape * 0.5;

  const va = a.vx * nx + a.vy * ny;
  const vb = b.vx * nx + b.vy * ny;
  // Ya se estaban separando: sin esto, un roce las volvería a juntar.
  if (vb - va > 0) return;

  const cambio = (vb - va) * CHOQUE;
  a.vx += nx * cambio;
  a.vy += ny * cambio;
  b.vx -= nx * cambio;
  b.vy -= ny * cambio;

  if (!parte) return;
  if (parte.contacto < 0) {
    if (a.n === 0) parte.contacto = b.n;
    else if (b.n === 0) parte.contacto = a.n;
  }
  const fuerte = Math.abs(va - vb);
  if (fuerte > parte.golpe) parte.golpe = fuerte;
}

/**
 * Las bandas. Siempre puestas, incluso en las bocas, y eso NO es un descuido.
 *
 * La primera versión apagaba la banda cerca de una tronera, con el miedo de que
 * la bola rebotara justo antes de colarse. Abría un agujero por el que la bola
 * salía despedida fuera de la mesa —medido: 214 fugas en 300 aperturas con el
 * paño rápido— y además no hacía falta, porque la geometría ya lo resuelve: la
 * captura se mira ANTES que la banda y la boca es más ancha que el radio de la
 * bola. Rodando pegada a la banda hacia la esquina, el centro entra en la boca
 * —a 37 píxeles— cuando todavía le faltan 11 para tocar la otra banda.
 *
 * Y con la banda puesta se gana algo: una bola que llega abierta rebota en la
 * mandíbula y se queda ahí, que es lo que hace de verdad en un billar.
 */
export function chocarConLasBandas(b, radio, campo) {
  if (b.x - radio < campo.x0) { b.x = campo.x0 + radio; b.vx = Math.abs(b.vx) * REBOTE; }
  if (b.x + radio > campo.x1) { b.x = campo.x1 - radio; b.vx = -Math.abs(b.vx) * REBOTE; }
  if (b.y - radio < campo.y0) { b.y = campo.y0 + radio; b.vy = Math.abs(b.vy) * REBOTE; }
  if (b.y + radio > campo.y1) { b.y = campo.y1 - radio; b.vy = -Math.abs(b.vy) * REBOTE; }
}

function entraEnTronera(b, troneras) {
  for (const t of troneras) {
    if (Math.hypot(b.x - t.x, b.y - t.y) < t.radio) return true;
  }
  return false;
}

/** @param {Bola[]} bolas */
export function todasQuietas(bolas) {
  for (const b of bolas) {
    if (b.metida) continue;
    if (Math.hypot(b.vx, b.vy) >= PARADA) return false;
  }
  return true;
}

// ---- Los colores ----------------------------------------------------------

/**
 * Los de siempre: del 1 al 7 lisas, del 9 al 15 las mismas pero rayadas. Por eso
 * el color sale del número módulo ocho, y la raya la pinta quien dibuja.
 */
const COLORES = ['#f4b400', '#2a6fdb', '#e63946', '#7b3fa0',
  '#f07818', '#2f9e44', '#8a2b2b'];

function colorDeBola(n) {
  if (n === NEGRA) return '#1c1c26';
  return COLORES[(n - 1) % 8 % COLORES.length];
}

// ---- El triángulo ---------------------------------------------------------

/**
 * El orden de las quince, con la negra en el centro del triángulo.
 *
 * De la semilla, así que en red los dos lados montan el MISMO triángulo sin
 * mandárselo. Lo único fijo es la negra: va en el sitio 5 —el centro de la
 * tercera fila— porque ahí va en todos los billares del mundo.
 */
export function ordenDelTriangulo(semilla) {
  const azar = sembrar(semilla);
  const resto = [];
  for (let n = 1; n <= BOLAS; n++) { if (n !== NEGRA) resto.push(n); }
  for (let i = resto.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    const t = resto[i];
    resto[i] = resto[j];
    resto[j] = t;
  }
  const orden = [];
  for (let i = 0; i < BOLAS; i++) orden.push(i === 4 ? NEGRA : resto.pop());
  return orden;
}

/**
 * La mesa recién puesta: la blanca en la cabecera y el triángulo con la negra en
 * el centro, como manda la tradición.
 *
 * Va aquí y no dentro de la partida por lo mismo que la física: así se puede
 * romper mil veces en Node y comprobar que ninguna bola sale despedida fuera.
 */
export function montarLasBolas(orden, campo, radio) {
  const bolas = [{
    n: 0,
    x: campo.x0 + campo.ancho * 0.25,
    y: campo.y0 + campo.alto * 0.5,
    vx: 0, vy: 0, metida: false
  }];

  const paso = radio * 2.02;
  // El triángulo va al fondo, y no por adorno: es la banda corta la que devuelve
  // las bolas hacia las troneras. Medido sobre 300 aperturas a toda fuerza, con
  // el ápice en 0,68 el 98 % salían secas; en 0,79, el 89 %. Es la misma razón
  // por la que en una mesa de verdad el triángulo se pone donde se pone.
  const apice = campo.x0 + campo.ancho * 0.79;
  const centro = campo.y0 + campo.alto * 0.5;
  let i = 0;
  for (let fila = 0; fila < 5; fila++) {
    for (let k = 0; k <= fila; k++) {
      bolas.push({
        n: orden[i++],
        x: apice + fila * paso * 0.87,
        y: centro + (k - fila / 2) * paso,
        vx: 0, vy: 0, metida: false
      });
    }
  }
  return bolas;
}

// ---- Medidas de la mesa ---------------------------------------------------

/**
 * Dónde acaba el marcador, contado desde el borde de la pantalla.
 *
 * El marcador —«8 Pool · te toca · Salir»— es DOM, no lienzo: `.juego-hud` va a
 * 12 píxeles del borde y ocupa 51, así que su última fila es la 63. **Medido en
 * la app**, no calculado a ojo: a ojo me salió 52 y la primera corrección se
 * quedó corta.
 *
 * Si alguien toca `.juego-hud` en styles.css, este número hay que volver a
 * medirlo.
 */
const MARCADOR_ABAJO = 63;
/** Y el aire que se le deja debajo, para que no se toquen. */
const AIRE_MARCADOR = 10;

/**
 * La mesa: dos a uno, centrada en lo que quede.
 *
 * Arriba manda el marcador; abajo, la mascota, que se queda FUERA con su suelo
 * de siempre y a la que hay que dejarle sitio para la fila de bolas metidas.
 */
export function medirCampo(medidas, aPantalla) {
  const margen = Math.max(16, Math.min(46, medidas.ancho * 0.022));
  const anchoLibre = Math.max(300, medidas.ancho - margen * 2);
  // La tronera se pinta CENTRADA en la esquina, así que sobresale una boca
  // entera por encima de `y0`: el borde de arriba de lo que se ve no es `y0`,
  // es `y0 - boca`. Eso es lo que se me olvidó la primera vez.
  const arriba = Math.max(margen, MARCADOR_ABAJO + AIRE_MARCADOR + RADIO_MAX * BOCA);
  const abajo = aPantalla(medidas.suelo) - medidas.patoAlto - 34;
  const altoLibre = Math.max(150, abajo - arriba);

  const ancho = Math.min(anchoLibre, altoLibre * 2);
  const alto = ancho / 2;
  const x0 = (medidas.ancho - ancho) / 2;
  // Centrada en la franja que queda, no en la pantalla: si sobra sitio, que
  // sobre por los dos lados.
  const y0 = arriba + Math.max(0, (abajo - arriba - alto) / 2);
  return { x0, y0, x1: x0 + ancho, y1: y0 + alto, ancho, alto };
}

/** Una bola es más o menos un treinta y seisavo del largo de la mesa. */
export function radioDeBola(campo) {
  return Math.max(6, Math.min(RADIO_MAX, campo.ancho / 72));
}

/** Las seis: cuatro esquinas y dos en medio de las bandas largas. */
export function troneraDelCampo(campo, radio) {
  const r = radio * BOCA;
  const cx = campo.x0 + campo.ancho / 2;
  return [
    { x: campo.x0, y: campo.y0, radio: r },
    { x: cx, y: campo.y0, radio: r },
    { x: campo.x1, y: campo.y0, radio: r },
    { x: campo.x0, y: campo.y1, radio: r },
    { x: cx, y: campo.y1, radio: r },
    { x: campo.x1, y: campo.y1, radio: r }
  ];
}
