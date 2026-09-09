// Hundir la flota: el tablero secreto, y la promesa de que no se ha movido.
//
// ---- Las medidas, que aquí no son gusto -------------------------------------
//
// Un 10 × 10 de los de siempre no cabe: el tablero de un juego de panel no puede
// pasar de 280 × 300 px (contrato), y ahí una casilla saldría a 26 px con las
// etiquetas. Y cien casillas por mar son una partida larga, que es justo lo que
// un minijuego no debe ser. Así que **7 × 7 y flota de catorce casillas**:
// 4, 3, 3, 2, 2.
//
// Y por lo mismo los dos mares van en PESTAÑAS. Dos rejillas de siete en alto no
// entran en 300 px una encima de otra, y encoger las casillas hasta que entren
// deja un juego donde no se acierta a pulsar.
//
// ---- Lo que estrena: la revelación de verdad --------------------------------
//
// El ahorcado estrenó el compromiso para una palabra; aquí es para un tablero, y
// con una vuelta más que es la que importa:
//
//   1. Al empezar, cada uno manda el **hash** de `sal:flota`. La flota no viaja.
//   2. Durante la partida, cada tiro se contesta con agua, tocado o hundido.
//   3. Al acabar, los dos revelan flota y sal. Y no basta con que el hash cuadre:
//      **se recomprueban TODAS las respuestas que dio contra el tablero que
//      revela**. Un tablero legítimo con una sola respuesta mentida se cazaría
//      igual.
//
// No se puede impedir hacer trampas sin un servidor que juegue la partida. Se
// puede dejarlas en evidencia, que entre amigos es lo que hace falta.

import { sembrar } from './azar.js';
import { compromiso, cumpleCompromiso } from '../protocolo.js';

const LADO = 7;
const CASILLAS = LADO * LADO;
/** Portaaviones, dos cruceros y dos lanchas: catorce casillas de cuarenta y nueve. */
const FLOTA = [4, 3, 3, 2, 2];

const LETRAS = 'ABCDEFG';

/** Lo que espera la mascota entre sus disparos, para que se vea lo que hace. */
const PIENSA_MS = 550;

/**
 * @param {import('./index.js').ContextoPartida} ctx
 * @returns {import('./index.js').Partida}
 */
export function crearPartida(ctx) {
  // ---- TODO el estado, antes del `return`. Cuarta regla del contrato. ------

  const contraLaMascota = ctx.modo === 'solo' || !ctx.sala;
  const azar = sembrar(ctx.semilla);
  const nombreRival = (ctx.jugadores || []).find((n) => n !== ctx.yo) || 'tu rival';

  /** 'colocando' | 'esperando' | 'mio' | 'suyo' | 'fin' */
  let fase = 'colocando';
  let terminada = false;
  /** Qué mar se está viendo: 'suyo' donde disparo, 'mio' donde me disparan. */
  let vista = 'suyo';

  // ---- Mi mar ----
  /** Índice del barco en cada casilla, o -1. */
  const miMar = new Int8Array(CASILLAS).fill(-1);
  /** @type {{largo:number, celdas:number[], tocadas:Set<number>}[]} */
  const misBarcos = [];
  /** Dónde me han disparado, y con qué resultado. */
  const susTiros = new Map();
  let miSal = '';
  let miPrometido = '';

  // ---- Su mar, según lo que sé ----
  /** '' | 'agua' | 'tocado' | 'hundido' */
  const suMar = new Array(CASILLAS).fill('');
  let suPrometido = '';
  let misTiros = 0;
  let suFlotaHundida = 0;
  /** Lo que ha ido contestando. Es lo que se recomprueba al revelar. */
  const registro = [];

  // ---- Colocación ----
  let porColocar = 0;
  let horizontal = true;

  // ---- La mascota, cuando se juega en solo ----
  /** Su mar de verdad, que en solo este lado sí conoce. */
  const suMarReal = new Int8Array(CASILLAS).fill(-1);
  /** @type {{largo:number, celdas:number[], tocadas:Set<number>}[]} */
  const susBarcos = [];
  /** Casillas que ya ha probado, y los tocados sin rematar. */
  const suyosProbados = new Set();
  const porRematar = [];
  let parar = null;

  // ---- Interfaz ----------------------------------------------------------
  const el = document.createElement('div');
  el.className = 'fl';

  const aviso = document.createElement('p');
  aviso.className = 'jt-aviso';
  el.appendChild(aviso);

  const pestanas = document.createElement('div');
  pestanas.className = 'fl-pestanas';
  const verSuyo = document.createElement('button');
  verSuyo.className = 'fl-pestana';
  verSuyo.type = 'button';
  verSuyo.textContent = 'Su mar';
  const verMio = document.createElement('button');
  verMio.className = 'fl-pestana';
  verMio.type = 'button';
  verMio.textContent = 'Tu mar';
  pestanas.append(verSuyo, verMio);
  el.appendChild(pestanas);

  const rejilla = document.createElement('div');
  rejilla.className = 'fl-rejilla';
  el.appendChild(rejilla);

  /** @type {HTMLButtonElement[]} */
  const casillas = [];
  for (let i = 0; i < CASILLAS; i++) {
    const b = document.createElement('button');
    b.className = 'fl-casilla';
    b.type = 'button';
    b.title = `${LETRAS[i % LADO]}${Math.floor(i / LADO) + 1}`;
    b.addEventListener('click', () => tocar(i));
    // La previa se hace al pasar por encima: colocar a ciegas y descubrir que
    // no cabe al pulsar es la forma más rápida de que nadie coloque a mano.
    b.addEventListener('mouseenter', () => previa(i));
    b.addEventListener('mouseleave', () => previa(-1));
    rejilla.appendChild(b);
    casillas.push(b);
  }

  const pie = document.createElement('div');
  pie.className = 'btn-row fl-pie';
  const girar = document.createElement('button');
  girar.className = 'btn';
  girar.type = 'button';
  girar.textContent = '↻ Girar';
  const barajar = document.createElement('button');
  barajar.className = 'btn';
  barajar.type = 'button';
  barajar.textContent = '🎲 Barajar';
  pie.append(girar, barajar);
  el.appendChild(pie);

  verSuyo.addEventListener('click', () => { vista = 'suyo'; pintar(); });
  verMio.addEventListener('click', () => { vista = 'mio'; pintar(); });
  // Con la guarda de fase, y no es de adorno: «Barajar» llama a `colocarAlAzar`,
  // que VACÍA el mar y vuelve a repartir. Sin guarda se podía pulsar con la
  // partida en marcha y la flota se movía debajo de los disparos del rival, con
  // los tocados ya anotados dentro. Lo cazó el banco de pruebas a dos.
  girar.addEventListener('click', () => {
    if (fase !== 'colocando') return;
    horizontal = !horizontal;
    pintar();
  });
  barajar.addEventListener('click', () => {
    if (fase !== 'colocando') return;
    colocarAlAzar();
    pintar();
  });

  if (ctx.sala) {
    ctx.alDestruir(ctx.sala.alRecibir((msg) => { recibir(msg); }));
    ctx.alDestruir(ctx.sala.alIrseUnJugador((quien) => {
      if (terminada) return;
      acabar('victoria', `${quien} ha dejado la partida.`);
    }));
  }

  vista = 'mio';
  pintar();

  return {
    el,
    destroy() {
      terminada = true;
      if (parar) { try { parar(); } catch { /* da igual */ } parar = null; }
    }
  };

  // ---- Colocar la flota ---------------------------------------------------

  function fila(i) { return Math.floor(i / LADO); }
  function columna(i) { return i % LADO; }

  /** Las casillas que ocuparía un barco ahí, o null si no cabe. */
  function huecoPara(largo, origen, enHorizontal) {
    const celdas = [];
    for (let k = 0; k < largo; k++) {
      const i = enHorizontal ? origen + k : origen + k * LADO;
      if (i < 0 || i >= CASILLAS) return null;
      if (enHorizontal && fila(i) !== fila(origen)) return null;
      if (miMar[i] !== -1) return null;
      celdas.push(i);
    }
    // Ni pegados: dos barcos tocándose se leen como uno solo y hundir el
    // primero delataría al segundo sin haberlo buscado.
    for (const i of celdas) {
      for (const v of vecinas(i)) if (miMar[v] !== -1) return null;
    }
    return celdas;
  }

  function vecinas(i) {
    const f = fila(i);
    const c = columna(i);
    const fuera = [];
    for (let df = -1; df <= 1; df++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!df && !dc) continue;
        const nf = f + df;
        const nc = c + dc;
        if (nf < 0 || nf >= LADO || nc < 0 || nc >= LADO) continue;
        fuera.push(nf * LADO + nc);
      }
    }
    return fuera;
  }

  function ponerBarco(celdas) {
    const idx = misBarcos.length;
    for (const i of celdas) miMar[i] = idx;
    misBarcos.push({ largo: celdas.length, celdas, tocadas: new Set() });
  }

  function vaciarMar() {
    miMar.fill(-1);
    misBarcos.length = 0;
    porColocar = 0;
  }

  function colocarAlAzar() {
    vaciarMar();
    for (const largo of FLOTA) {
      let puesto = null;
      for (let intento = 0; intento < 400 && !puesto; intento++) {
        const h = azar() < 0.5;
        const origen = Math.floor(azar() * CASILLAS);
        puesto = huecoPara(largo, origen, h);
      }
      // Con catorce casillas de cuarenta y nueve, cuatrocientos intentos no
      // fallan nunca; si fallaran, se empieza el reparto de cero antes que
      // dejar la flota a medias.
      if (!puesto) { colocarAlAzar(); return; }
      ponerBarco(puesto);
    }
    porColocar = FLOTA.length;
  }

  function tocar(i) {
    if (terminada) return;
    if (fase === 'colocando') { intentarColocar(i); return; }
    if (fase === 'mio' && vista === 'suyo') disparar(i);
  }

  function intentarColocar(origen) {
    if (porColocar >= FLOTA.length) return;
    const celdas = huecoPara(FLOTA[porColocar], origen, horizontal);
    if (!celdas) { avisar('Ahí no cabe.'); return; }
    ponerBarco(celdas);
    porColocar++;
    ctx.sonido.nota(520, 0.04);
    pintar();
  }

  async function listo() {
    if (misBarcos.length !== FLOTA.length) return;
    // Ya se confirmó: el botón vive en el pie y no se iba solo, así que seguía
    // ahí toda la partida y cada clic sorteaba una sal nueva y mandaba otra
    // promesa. El de enfrente ya las ignora, pero mandarlas tampoco está bien.
    if (fase !== 'colocando') return;
    miSal = Math.random().toString(36).slice(2, 10);
    miPrometido = await compromiso(`${miSal}:${comoTexto()}`);
    if (terminada) return;

    cerrarColocacion();

    if (contraLaMascota) {
      prepararMascota();
      fase = 'mio';
      vista = 'suyo';
      pintar();
      return;
    }
    ctx.sala.enviar({ t: 'flota', prometido: miPrometido });
    fase = 'esperando';
    vista = 'suyo';
    // Puede que la suya ya hubiera llegado mientras yo colocaba: entonces no
    // hay a quién esperar y la partida empieza aquí.
    if (suPrometido) { empezarPartida(); return; }
    pintar();
  }

  /** La flota en una línea, que es lo que se promete y lo que se revela. */
  function comoTexto() {
    return misBarcos.map((b) => b.celdas.join('.')).join('|');
  }

  // ---- La mascota ---------------------------------------------------------

  function prepararMascota() {
    // Se reparte con las mismas reglas: sin salirse y sin pegarse.
    const ocupado = new Int8Array(CASILLAS).fill(-1);
    const cabe = (largo, origen, h) => {
      const celdas = [];
      for (let k = 0; k < largo; k++) {
        const i = h ? origen + k : origen + k * LADO;
        if (i < 0 || i >= CASILLAS) return null;
        if (h && fila(i) !== fila(origen)) return null;
        if (ocupado[i] !== -1) return null;
        celdas.push(i);
      }
      for (const i of celdas) for (const v of vecinas(i)) if (ocupado[v] !== -1) return null;
      return celdas;
    };
    for (const largo of FLOTA) {
      let puesto = null;
      for (let intento = 0; intento < 400 && !puesto; intento++) {
        puesto = cabe(largo, Math.floor(azar() * CASILLAS), azar() < 0.5);
      }
      if (!puesto) { ocupado.fill(-1); susBarcos.length = 0; prepararMascota(); return; }
      const idx = susBarcos.length;
      for (const i of puesto) { ocupado[i] = idx; suMarReal[i] = idx; }
      susBarcos.push({ largo, celdas: puesto, tocadas: new Set() });
    }
  }

  /**
   * Cómo dispara la mascota: a lo tonto hasta que toca, y entonces remata.
   *
   * Es la IA de siempre y no hace falta más: buscar de forma óptima —en damero,
   * descartando huecos donde ya no cabe nada— la haría casi imbatible, y esto se
   * juega para pasar el rato.
   */
  function tiroDeLaMascota() {
    while (porRematar.length) {
      const i = porRematar.pop();
      if (!suyosProbados.has(i)) return i;
    }
    const libres = [];
    for (let i = 0; i < CASILLAS; i++) if (!suyosProbados.has(i)) libres.push(i);
    if (!libres.length) return -1;
    return libres[Math.floor(azar() * libres.length)];
  }

  function turnoDeLaMascota() {
    if (terminada || fase !== 'suyo') return;
    parar = ctx.cadaCierto(() => {
      if (parar) { parar(); parar = null; }
      if (terminada || fase !== 'suyo') return;

      const i = tiroDeLaMascota();
      if (i < 0) return;
      suyosProbados.add(i);
      const r = recibirTiro(i);
      if (r.r !== 'agua') {
        for (const v of vecinas(i)) {
          // Sólo en cruz: en diagonal no hay barco que seguir, y meterlas
          // haría que rematara probando esquinas.
          if (fila(v) === fila(i) || columna(v) === columna(i)) porRematar.push(v);
        }
      }
      pintar();
      if (miFlotaHundida()) { acabar('derrota', `${suNombre()} ha hundido tu flota.`); return; }
      if (r.r === 'agua') { fase = 'mio'; pintar(); return; }
      turnoDeLaMascota();
    }, PIENSA_MS);
  }

  function suNombre() { return contraLaMascota ? 'Tu mascota' : nombreRival; }

  // ---- Disparar -----------------------------------------------------------

  function disparar(i) {
    if (suMar[i]) return;                 // ahí ya se ha tirado
    misTiros++;

    if (contraLaMascota) { resolverContraLaMascota(i); return; }
    ctx.sala.enviar({ t: 'tiro', i });
    fase = 'esperando';
    pintar();
  }

  function resolverContraLaMascota(i) {
    const idx = suMarReal[i];
    if (idx < 0) { anotarTiro(i, 'agua'); fase = 'suyo'; pintar(); turnoDeLaMascota(); return; }

    const barco = susBarcos[idx];
    barco.tocadas.add(i);
    const hundido = barco.tocadas.size === barco.largo;
    anotarTiro(i, hundido ? 'hundido' : 'tocado', hundido ? barco.celdas : null);
    if (hundido) suFlotaHundida++;
    pintar();
    if (suFlotaHundida === FLOTA.length) { ganar(); return; }
    // Acierto, repites: es la regla de siempre y es lo que hace que rematar un
    // barco se sienta como rematarlo.
  }

  function anotarTiro(i, r, celdasHundido) {
    suMar[i] = r === 'hundido' ? 'hundido' : r;
    if (celdasHundido) for (const c of celdasHundido) suMar[c] = 'hundido';
    registro.push({ i, r });
    ctx.sonido.nota(r === 'agua' ? 260 : 780, r === 'agua' ? 0.07 : 0.05);
  }

  /** Me disparan a mí. @returns {{r:string, celdas:number[]|null}} */
  function recibirTiro(i) {
    const idx = miMar[i];
    if (idx < 0) { susTiros.set(i, 'agua'); return { r: 'agua', celdas: null }; }
    const barco = misBarcos[idx];
    barco.tocadas.add(i);
    const hundido = barco.tocadas.size === barco.largo;
    susTiros.set(i, hundido ? 'hundido' : 'tocado');
    if (hundido) for (const c of barco.celdas) susTiros.set(c, 'hundido');
    return { r: hundido ? 'hundido' : 'tocado', celdas: hundido ? barco.celdas : null };
  }

  function miFlotaHundida() {
    return misBarcos.every((b) => b.tocadas.size === b.largo);
  }

  function ganar() {
    if (ctx.sala) ctx.sala.enviar({ t: 'revelo', mar: comoTexto(), sal: miSal });
    acabar('victoria', `Flota hundida en ${misTiros} disparos.`, misTiros);
  }

  // ---- Red ----------------------------------------------------------------

  function recibir(msg) {
    if (!msg || terminada) return;

    if (msg.t === 'flota') {
      // **Sólo la primera.** Sobrescribir aquí vaciaba el compromiso de todo su
      // sentido: el rival podía mandar una flota, jugar, ver dónde le tiras y
      // mandar OTRA promesa de un tablero que esquiva tus disparos, revelarla al
      // final y cuadrar. Prometer antes de tirar es justo lo único que aporta
      // este mecanismo, y una promesa que se puede cambiar después no es una
      // promesa.
      //
      // Lo cazó el banco de pruebas a dos, no jugando: el bot pulsaba «Listo»
      // en cada vuelta y aquí entraba un compromiso nuevo por turno.
      if (suPrometido) return;
      suPrometido = String(msg.prometido || '');
      if (fase === 'esperando' && miPrometido) empezarPartida();
      return;
    }

    if (msg.t === 'tiro') {
      const i = Number(msg.i);
      if (!Number.isInteger(i) || i < 0 || i >= CASILLAS) return;
      const r = recibirTiro(i);
      ctx.sala.enviar({ t: 'resultado', i, r: r.r, celdas: r.celdas });
      pintar();
      if (miFlotaHundida()) {
        ctx.sala.enviar({ t: 'revelo', mar: comoTexto(), sal: miSal });
        acabar('derrota', `${nombreRival} ha hundido tu flota.`);
        return;
      }
      if (r.r === 'agua') { fase = 'mio'; pintar(); }
      return;
    }

    if (msg.t === 'resultado') {
      const i = Number(msg.i);
      if (!Number.isInteger(i)) return;
      const r = String(msg.r || 'agua');
      anotarTiro(i, r, Array.isArray(msg.celdas) ? msg.celdas : null);
      if (r === 'hundido') suFlotaHundida++;
      pintar();
      if (suFlotaHundida === FLOTA.length) { ganar(); return; }
      fase = r === 'agua' ? 'suyo' : 'mio';
      pintar();
      return;
    }

    if (msg.t === 'revelo') comprobarRevelacion(msg);
  }

  function empezarPartida() {
    // Abre quien no es anfitrión: da igual quién, pero tiene que ser el mismo
    // en los dos lados y sin negociarlo.
    fase = ctx.anfitrion ? 'suyo' : 'mio';
    vista = 'suyo';
    pintar();
  }

  /**
   * Su tablero revelado, contra lo que fue contestando.
   *
   * Dos comprobaciones, y la segunda es la que de verdad importa: que el hash
   * cuadre sólo dice que no ha cambiado el tablero al final. Recomprobar cada
   * respuesta contra él caza al que tenía un tablero legítimo y mintió sobre una
   * casilla concreta.
   */
  function comprobarRevelacion(msg) {
    const texto = String(msg.mar || '');
    if (!suPrometido || !texto) return;
    cumpleCompromiso(texto, String(msg.sal || ''), suPrometido).then((cuadra) => {
      if (terminada && fase !== 'fin') return;
      if (!cuadra) { ctx.decir(`Ojo: la flota de ${nombreRival} no es la que prometió.`); return; }
      const mal = respuestasQueNoCuadran(texto);
      if (mal) ctx.decir(`Ojo: ${nombreRival} contestó mal en ${mal}.`);
    });
  }

  /** @returns {string|null} la primera casilla donde mintió, o null */
  function respuestasQueNoCuadran(texto) {
    const ocupadas = new Set();
    for (const barco of texto.split('|')) {
      for (const c of barco.split('.')) ocupadas.add(Number(c));
    }
    for (const { i, r } of registro) {
      const habia = ocupadas.has(i);
      if (habia !== (r !== 'agua')) return `${LETRAS[i % LADO]}${Math.floor(i / LADO) + 1}`;
    }
    return null;
  }

  // ---- Final --------------------------------------------------------------

  function acabar(resultado, detalle, disparos) {
    if (terminada) return;
    terminada = true;
    fase = 'fin';
    vista = 'suyo';
    pintar();
    // `puntos` SÓLO al ganar, y el contrato lo permite: con `mejor: 'menos'`,
    // apuntar los disparos de una derrota sería registrar como récord el haber
    // tirado poco porque te hundieron antes.
    ctx.alTerminar(typeof disparos === 'number'
      ? { resultado, puntos: disparos, detalle }
      : { resultado, detalle });
  }

  // ---- Pintado ------------------------------------------------------------

  function avisar(texto) { aviso.textContent = texto; }

  function pintar() {
    verSuyo.classList.toggle('activa', vista === 'suyo');
    verMio.classList.toggle('activa', vista === 'mio');
    pestanas.hidden = fase === 'colocando';
    pie.hidden = fase !== 'colocando';

    const colocando = fase === 'colocando';

    for (let i = 0; i < CASILLAS; i++) {
      const b = casillas[i];
      b.className = 'fl-casilla';
      b.textContent = '';
      b.disabled = true;

      if (colocando || vista === 'mio') {
        if (miMar[i] !== -1) b.classList.add('barco');
        const t = susTiros.get(i);
        if (t) b.classList.add(t);
        if (colocando) b.disabled = porColocar >= FLOTA.length;
        continue;
      }

      if (suMar[i]) b.classList.add(suMar[i]);
      b.disabled = fase !== 'mio' || !!suMar[i];
    }

    if (fase === 'fin') return;

    if (colocando) {
      if (porColocar >= FLOTA.length) { avisar('Flota lista.'); ponerListo(); return; }
      avisar(`Coloca el de ${FLOTA[porColocar]} (${horizontal ? 'horizontal' : 'vertical'}).`);
      return;
    }
    if (fase === 'esperando') { avisar('Un momento…'); return; }
    if (fase === 'suyo') { avisar(`Dispara ${suNombre()}.`); return; }
    avisar(`Te toca. ${FLOTA.length - suFlotaHundida} barcos suyos en pie.`);
  }

  /**
   * Enseña dónde caería el barco que toca, y si cabe.
   *
   * @param {number} origen la casilla bajo el ratón, o -1 para limpiar
   */
  function previa(origen) {
    if (fase !== 'colocando' || porColocar >= FLOTA.length) return;
    for (const b of casillas) b.classList.remove('cabe', 'nocabe');
    if (origen < 0) return;

    const celdas = huecoPara(FLOTA[porColocar], origen, horizontal);
    if (celdas) { for (const i of celdas) casillas[i].classList.add('cabe'); return; }
    casillas[origen].classList.add('nocabe');
  }

  /**
   * La fila de colocar se va entera en cuanto la flota está confirmada.
   *
   * Girar, barajar y confirmar sólo sirven para colocar. Dejándolos ahí toda la
   * partida, además de confundir, invitan a pulsarlos: y pulsarlos era mover la
   * flota o mandar otra promesa.
   */
  function cerrarColocacion() {
    pie.remove();
  }

  /** El botón de «Listo» sólo existe cuando hay algo que confirmar. */
  function ponerListo() {
    if (pie.querySelector('.fl-listo')) return;
    const b = document.createElement('button');
    b.className = 'btn fl-listo';
    b.type = 'button';
    b.textContent = '⚓ Listo';
    b.addEventListener('click', () => { listo(); });
    pie.appendChild(b);
  }

}
