// Minigolf: diez hoyos, y que no se te vayan los golpes.
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
// líneas de integración propias y la mascota se queda mirando desde abajo, que
// es su papel en este.
//
// Lo que sí se calca de «Pato Hook» es APUNTAR: se apunta hacia el cursor y la
// fuerza sale de lo lejos que esté, medida contra el ancho de la pantalla. Quien
// sepa jugar a uno sabe jugar al otro.
//
// ---- El recorrido ----------------------------------------------------------
//
// Diez hoyos que van creciendo: el primero es una recta para entender el golpe y
// el décimo tiene nueve piezas por medio. Lo que cambia no es sólo cuántas, es
// QUÉ: los muros aparecen desde el principio, la arena a partir del quinto, el
// agua en el séptimo y los topes en el octavo. Cada pieza sale con su sitio y su
// tamaño al azar, y hasta el lado al que se juega se sortea.
//
// La regla que lo mantiene sano: **ninguna pieza sólida cruza el campo entero**.
// Cada muro deja hueco a un lado, y los bloques sueltos son pequeños. Con eso el
// hoyo siempre se puede alcanzar sin tener que comprobarlo con un buscador de
// caminos, que para nueve rectángulos sería matar moscas a cañonazos.

import { sembrar } from './azar.js';

const HOYOS = 10;

/** Rozamiento del césped, exponencial y por segundo. */
const ROZAMIENTO = 1.5;
/** El de la arena. Frena tanto que cruzarla de largo no es una opción. */
const ROZAMIENTO_ARENA = 6.5;
/** Por debajo de esto la bola se considera parada y se puede volver a golpear. */
const PARADA = 26;
/** Lo que devuelven las bandas y los muros. */
const REBOTE = 0.74;
/** Y los topes, que devuelven MÁS de lo que reciben: para eso están. */
const REBOTE_TOPE = 1.12;
const TOPE_MINIMO = 260;

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
 * Golpes de más antes de dar un hoyo por perdido.
 *
 * Va sobre el par y no fijo, que un hoyo de par 5 con nueve piezas no se puede
 * medir con la misma vara que la recta del primero. Y tiene que existir: con
 * `mejor: 'menos'`, una bola atascada detrás de un muro no sólo dejaría la
 * partida colgada, además envenenaría el récord, porque bastaría con abandonar
 * para no empeorar nunca la marca.
 */
const MARGEN_TOPE = 3;

/**
 * Lo que el juego se da a sí mismo antes de cerrar la ronda.
 *
 * El préstamo del escenario corta a los diez minutos y lo hace SIN resultado
 * —ver `TOPE_PARTIDA_MS` en escenario.js—, así que una ronda larga de diez hoyos
 * podría acabar tirando la partida entera a la basura. Con esto el juego llega
 * antes y cierra él: los hoyos que falten se dan por perdidos y la marca se
 * apunta. Perder por lento es una derrota; perderlo todo, un fallo.
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

  /** El recorrido en proporciones, para que un cambio de tamaño no lo rehaga. */
  const disenos = disenarRecorrido(ctx.semilla);
  const parTotal = disenos.reduce((s, d) => s + d.par, 0);

  /** 'apuntando' | 'rodando' | 'celebrando' | 'fin' */
  let fase = 'apuntando';
  let hoyo = 0;
  let golpesAqui = 0;
  let golpesTotal = 0;
  let terminada = false;
  let pulsadoAntes = false;
  let celebracion = 0;
  let transcurrido = 0;
  /** Dónde estaba la bola al empezar el golpe, para devolverla si cae al agua. */
  let antesDelGolpe = { x: 0, y: 0 };

  let campo = medirCampo(pista.medidas, pista.aPantalla);
  const bola = { x: 0, y: 0, vx: 0, vy: 0, radio: 8 };
  /** El hoyo, las piezas y la salida de ESTE hoyo, ya en píxeles. */
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

    const antes = transcurrido;
    transcurrido += dt * 1000;
    if (transcurrido >= PRESUPUESTO_MS) { cerrarPorTiempo(); return; }
    // La cuenta atrás del final se repinta sola, pero sólo al cambiar de
    // segundo: el marcador es DOM y no hace falta tocarlo sesenta veces por
    // segundo para enseñar un número que cambia una.
    if (PRESUPUESTO_MS - transcurrido < AVISO_MS
      && Math.ceil(antes / 1000) !== Math.ceil(transcurrido / 1000)) marcar();

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
    antesDelGolpe = { x: bola.x, y: bola.y };
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
      // acabando, que es como rueda una bola de verdad. En la arena, el mismo
      // cálculo con otro número.
      const roce = enAlgo('arena') ? ROZAMIENTO_ARENA : ROZAMIENTO;
      const freno = Math.exp(-roce * paso);
      bola.vx *= freno;
      bola.vy *= freno;
      bola.x += bola.vx * paso;
      bola.y += bola.vy * paso;

      for (const m of mapa.muros) chocarConMuro(m);
      for (const t of mapa.topes) chocarConTope(t);
      chocarConLasBandas();

      if (enAlgo('agua')) { alAgua(); return; }
      if (entraEnElHoyo()) { embocar(); return; }
    }

    if (Math.hypot(bola.vx, bola.vy) < PARADA) {
      bola.vx = 0;
      bola.vy = 0;
      if (golpesAqui >= mapa.tope) { rendirElHoyo(); return; }
      fase = 'apuntando';
      // No dispara solo si se llegó aquí con el botón pulsado.
      pulsadoAntes = entrada.pulsado;
    }
  }

  /** Si el centro de la bola está dentro de alguna zona de ese tipo. */
  function enAlgo(tipo) {
    for (const z of mapa.zonas) {
      if (z.tipo !== tipo) continue;
      if (bola.x >= z.x && bola.x <= z.x + z.w && bola.y >= z.y && bola.y <= z.y + z.h) return true;
    }
    return false;
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
    reflejar(nx, ny, REBOTE);
  }

  /**
   * Los topes devuelven más de lo que reciben.
   *
   * Y con un mínimo: un roce suave contra un tope tiene que salir despedido
   * igual, o el tope se convierte en un sitio donde la bola se queda muerta,
   * que es justo lo contrario de lo que promete su pinta.
   */
  function chocarConTope(t) {
    const dx = bola.x - t.x;
    const dy = bola.y - t.y;
    const d = Math.hypot(dx, dy) || 0.0001;
    const juntos = t.r + bola.radio;
    if (d >= juntos) return;

    const nx = dx / d;
    const ny = dy / d;
    bola.x = t.x + nx * juntos;
    bola.y = t.y + ny * juntos;
    if (!reflejar(nx, ny, REBOTE_TOPE)) return;

    const v = Math.hypot(bola.vx, bola.vy);
    if (v < TOPE_MINIMO) {
      bola.vx = nx * TOPE_MINIMO;
      bola.vy = ny * TOPE_MINIMO;
    }
    ctx.sonido.nota(660, 0.07);
  }

  /** Refleja la velocidad contra una normal. Devuelve si de verdad chocaba. */
  function reflejar(nx, ny, devuelve) {
    const vn = bola.vx * nx + bola.vy * ny;
    if (vn >= 0) return false;              // ya se estaba alejando
    bola.vx -= (1 + devuelve) * vn * nx;
    bola.vy -= (1 + devuelve) * vn * ny;
    sonarChoque(-vn);
    return true;
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
   * Al agua: un golpe de penalización y a repetir desde donde salió.
   *
   * Desde donde salió y no desde la salida del hoyo, que es la regla de verdad
   * del golf y además la única sensata aquí: mandar la bola al principio después
   * de cinco golpes de acercamiento no es un castigo, es una encerrona.
   */
  function alAgua() {
    golpesTotal++;
    golpesAqui++;
    bola.x = antesDelGolpe.x;
    bola.y = antesDelGolpe.y;
    bola.vx = 0;
    bola.vy = 0;
    ctx.sonido.nota(180, 0.22);
    ctx.decir('Al agua. Un golpe de penalización.');
    if (golpesAqui >= mapa.tope) { rendirElHoyo(); return; }
    fase = 'apuntando';
    pulsadoAntes = entrada.pulsado;
    marcar();
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
    antesDelGolpe = { x: bola.x, y: bola.y };
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
    celebracion = 0.8;
    pato.setState('happy');
    ctx.sonido.nota(880, 0.1);
    ctx.sonido.nota(1174, 0.14);
    const par = disenos[hoyo].par;
    if (golpesAqui < par) ctx.decir(golpesAqui === 1 ? '¡De un golpe!' : `${par - golpesAqui} bajo par.`);
    marcar();
  }

  /** El hoyo se da por jugado con el tope puesto. Ver `MARGEN_TOPE`. */
  function rendirElHoyo() {
    fase = 'celebrando';
    celebracion = 0.6;
    ctx.sonido.nota(220, 0.18);
    ctx.decir(`Ese hoyo, por imposible: ${mapa.tope} golpes.`);
    marcar();
  }

  function siguienteHoyo() {
    pato.setState('idle');
    hoyo++;
    if (hoyo >= HOYOS) { acabar(); return; }
    empezarHoyo();
  }

  // ---- Final -------------------------------------------------------------

  /** Se acabó el tiempo: lo que falte se da por perdido y la marca se apunta. */
  function cerrarPorTiempo() {
    for (let i = hoyo; i < HOYOS; i++) {
      const tope = disenos[i].par + MARGEN_TOPE;
      golpesTotal += i === hoyo ? Math.max(0, tope - golpesAqui) : tope;
    }
    ctx.decir('Se acabó el tiempo. Los hoyos que faltaban, por perdidos.');
    acabar();
  }

  function acabar() {
    if (terminada) return;
    terminada = true;
    fase = 'fin';

    // A menos es mejor, así que aquí un récord es bajar, no subir.
    const esRecord = mejorPrevio === null || golpesTotal < mejorPrevio;

    ctx.sonido[esRecord ? 'victoria' : 'derrota']();
    ctx.alTerminar({
      resultado: esRecord ? 'victoria' : 'derrota',
      puntos: golpesTotal,
      detalle: detalleFinal(golpesTotal, esRecord)
    });
  }

  function detalleFinal(total, esRecord) {
    const contra = total === parTotal ? 'justo el par'
      : total < parTotal ? `${parTotal - total} bajo par`
        : `${total - parTotal} sobre par`;
    const cola = esRecord
      ? (mejorPrevio === null ? ' A ver quién baja de ahí.' : ` Récord nuevo: antes eran ${mejorPrevio}.`)
      : ` Tu récord sigue en ${mejorPrevio}.`;
    return `${total} golpes en ${HOYOS} hoyos, ${contra}.${cola}`;
  }

  function marcar() {
    const d = disenos[Math.min(hoyo, HOYOS - 1)];
    const base = `Hoyo ${Math.min(hoyo + 1, HOYOS)}/${HOYOS}  ·  ${golpesAqui} de par ${d.par}`
      + `  ·  ${golpesTotal} de ${parTotal}`;
    const record = mejorPrevio === null ? '' : `  ·  récord ${mejorPrevio}`;
    const queda = PRESUPUESTO_MS - transcurrido;
    const prisa = queda < AVISO_MS ? `  ·  ¡${Math.max(0, Math.ceil(queda / 1000))} s!` : '';
    pista.marcador(base + record + prisa);
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
    const mover = (p) => ({
      x: nuevo.x0 + (p.x - campo.x0) * fx,
      y: nuevo.y0 + (p.y - campo.y0) * fy
    });
    const b = mover(bola);
    bola.x = b.x;
    bola.y = b.y;
    bola.vx *= fx;
    bola.vy *= fy;
    antesDelGolpe = mover(antesDelGolpe);
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
    // Las zonas primero: son suelo, y todo lo demás va encima.
    for (const z of mapa.zonas) dibujarZona(g, z);
    for (const m of mapa.muros) dibujarMuro(g, m);
    for (const t of mapa.topes) dibujarTope(g, t);
    dibujarSalida(g);
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

  function dibujarZona(g, z) {
    g.save();
    g.fillStyle = z.tipo === 'arena' ? 'rgba(232, 213, 166, 0.92)' : 'rgba(47, 111, 176, 0.92)';
    g.beginPath();
    g.rect(z.x, z.y, z.w, z.h);
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = z.tipo === 'arena' ? '#b99e5e' : '#1c4a78';
    g.stroke();
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

  function dibujarTope(g, t) {
    g.save();
    g.beginPath();
    g.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    g.fillStyle = '#ffb703';
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = '#2b2b3a';
    g.stroke();
    g.beginPath();
    g.arc(t.x, t.y, t.r * 0.42, 0, Math.PI * 2);
    g.fillStyle = '#fb8500';
    g.fill();
    g.restore();
  }

  /** De dónde salió la bola. Sin esto no se ve cuánto llevas avanzado. */
  function dibujarSalida(g) {
    g.save();
    g.beginPath();
    g.arc(mapa.salida.x, mapa.salida.y, bola.radio * 0.7, 0, Math.PI * 2);
    g.lineWidth = 2;
    g.strokeStyle = 'rgba(255, 253, 247, 0.5)';
    g.stroke();
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
 * Cuántas piezas lleva cada hoyo: el primero ninguna, el décimo nueve.
 *
 * Literal a propósito. Un hoyo que crece de uno en uno se nota mientras juegas,
 * y es la forma más barata de que la ronda tenga una cuesta sin tener que
 * inventarse una curva de dificultad aparte.
 */
function piezasDelHoyo(i) {
  return i;
}

/**
 * Qué tipos de pieza pueden salir en el hoyo `i`.
 *
 * Escalonado para que cada elemento se aprenda solo: primero muros, y cuando ya
 * sabes rodearlos aparece la arena; cuando ya la esquivas, el agua; y al final
 * los topes, que son los únicos que devuelven MÁS de lo que reciben y por eso
 * conviene descubrirlos con el resto ya sabido.
 */
/**
 * Cuántas piezas de cada tipo caben en UN hoyo.
 *
 * Sin esto, el sorteo puede sacar cinco charcos seguidos y entonces el hoyo deja
 * de ser un hoyo difícil para ser un peaje: cada agua cuesta un golpe, y cinco se
 * comen el tope entero antes de llegar. Los muros no llevan cupo —de esos, todos
 * los que quiera—, y por eso son también el recambio cuando otro se agota.
 */
const CUPO = { agua: 2, arena: 3, tope: 3 };

function repertorio(i) {
  const tipos = ['muroV'];
  if (i >= 2) tipos.push('muroH');
  if (i >= 3) tipos.push('bloque');
  if (i >= 4) tipos.push('arena');
  if (i >= 6) tipos.push('agua');
  if (i >= 7) tipos.push('tope');
  return tipos;
}

/**
 * Los diez hoyos, en proporciones de 0 a 1.
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
 * Un hoyo.
 *
 * La salida va en un extremo y el hoyo en el otro, y **de qué lado se juega se
 * sortea**: jugar hacia la izquierda no es lo mismo que jugar hacia la derecha
 * aunque el recorrido sea el espejo, porque el brazo con el que apuntas no lo
 * es. Las piezas se reparten por el pasillo, una por tramo, para que no se
 * amontonen en un rincón dejando media pantalla vacía.
 *
 * @param {number} i     el hoyo, de 0 a 9
 * @param {() => number} azar
 */
function disenarHoyo(i, azar) {
  const cuantas = piezasDelHoyo(i);
  const tipos = repertorio(i);
  const alaDerecha = azar() < 0.5;

  // `t` es el avance de salida a hoyo, de 0 a 1. Se convierte a `x` al final, y
  // ahí es donde se aplica el espejo: así el generador no tiene que pensarlo.
  const enX = (t) => (alaDerecha ? 0.08 + t * 0.82 : 0.9 - t * 0.82);

  const salida = { x: enX(0), y: 0.18 + azar() * 0.64 };
  const hoyo = { x: enX(1), y: 0.18 + azar() * 0.64 };

  const muros = [];
  const zonas = [];
  const topes = [];

  const puestas = {};
  for (let n = 0; n < cuantas; n++) {
    // Un tramo por pieza, con holgura dentro del tramo: repartidas pero no
    // alineadas, que es lo que las hace parecer puestas a mano.
    const tramo = 0.72 / cuantas;
    const t = 0.14 + tramo * (n + 0.2 + azar() * 0.6);

    let tipo = tipos[Math.floor(azar() * tipos.length)];
    // Si ese tipo ya ha llenado su cupo en este hoyo, se pone un muro y ya
    // está. Volver a sortear hasta acertar daría vueltas de más para acabar
    // casi siempre en lo mismo.
    if (CUPO[tipo] != null && (puestas[tipo] || 0) >= CUPO[tipo]) tipo = 'muroV';
    puestas[tipo] = (puestas[tipo] || 0) + 1;

    ponerPieza(tipo, enX(t), azar, { muros, zonas, topes }, salida, hoyo);
  }

  return {
    salida,
    hoyo,
    muros,
    zonas,
    topes,
    // Un golpe para salir y uno más por cada tres piezas que sortear. Topado en
    // cinco: un par de seis ya no es un hoyo, es un recado.
    par: Math.min(5, 2 + Math.ceil(cuantas / 3))
  };
}

/**
 * Coloca una pieza en la columna `x`.
 *
 * La regla que sostiene todo el generador: **ninguna pieza sólida cruza el campo
 * entero**. Los muros dejan siempre un hueco a un lado y los bloques son
 * pequeños, así que el hoyo se alcanza siempre sin tener que comprobarlo con un
 * buscador de caminos.
 */
function ponerPieza(tipo, x, azar, destino, salida, hoyo) {
  const rect = fabricar(tipo, x, azar);

  // Ni encima de la salida ni encima del hoyo, y esto vale para TODAS. Empezar
  // encajonado detrás de un bloque, o tener que embocar desde la arena, no son
  // dificultades: son fallos del generador. Cuando cae ahí, la pieza no se
  // recoloca, se descarta —mover una para que no estorbe es como acaban
  // amontonándose todas en el mismo sitio—, y ese hoyo lleva una menos.
  if (pisa(rect, salida) || pisa(rect, hoyo)) return;

  if (tipo === 'tope') destino.topes.push(rect);
  else if (tipo === 'arena' || tipo === 'agua') destino.zonas.push(rect);
  else destino.muros.push(rect);
}

function fabricar(tipo, x, azar) {
  if (tipo === 'muroV') {
    const hueco = 0.24 + azar() * 0.12;
    const arriba = azar() < 0.5;
    const ancho = 0.014 + azar() * 0.016;
    return { x: x - ancho / 2, y: arriba ? 0 : hueco, w: ancho, h: 1 - hueco };
  }

  if (tipo === 'muroH') {
    // Horizontal y corto: nunca llega a las dos bandas, así que siempre se
    // puede rodear por un lado o por el otro.
    const largo = 0.10 + azar() * 0.14;
    const alto = 0.02 + azar() * 0.025;
    return {
      x: Math.max(0, Math.min(1 - largo, x - largo / 2)),
      y: 0.10 + azar() * 0.74,
      w: largo,
      h: alto
    };
  }

  if (tipo === 'bloque') {
    const w = 0.035 + azar() * 0.05;
    const h = 0.10 + azar() * 0.18;
    return {
      x: Math.max(0, Math.min(1 - w, x - w / 2)),
      y: azar() * (1 - h),
      w,
      h
    };
  }

  if (tipo === 'tope') {
    const r = 0.018 + azar() * 0.016;
    return { x, y: 0.14 + azar() * 0.72, r };
  }

  // Arena y agua: no bloquean, así que pueden ser grandes. El agua se queda algo
  // más pequeña porque cuesta un golpe y una que ocupe medio pasillo no es un
  // obstáculo, es un peaje.
  const grande = tipo === 'arena';
  const w = (grande ? 0.06 : 0.04) + azar() * (grande ? 0.09 : 0.06);
  const h = (grande ? 0.16 : 0.12) + azar() * (grande ? 0.24 : 0.18);
  return {
    tipo,
    x: Math.max(0, Math.min(1 - w, x - w / 2)),
    y: azar() * (1 - h),
    w,
    h
  };
}

/** Si una pieza —rectángulo o círculo— le cae encima a un punto, con holgura. */
function pisa(pieza, p) {
  const margen = 0.035;
  if (pieza.r != null) {
    return Math.hypot(p.x - pieza.x, p.y - pieza.y) < pieza.r + margen;
  }
  return p.x >= pieza.x - margen && p.x <= pieza.x + pieza.w + margen
    && p.y >= pieza.y - margen && p.y <= pieza.y + pieza.h + margen;
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
  const enX = (v) => campo.x0 + v * campo.ancho;
  const enY = (v) => campo.y0 + v * campo.alto;

  return {
    bolaRadio,
    tope: diseno.par + MARGEN_TOPE,
    salida: { x: enX(diseno.salida.x), y: enY(diseno.salida.y) },
    hoyo: { x: enX(diseno.hoyo.x), y: enY(diseno.hoyo.y), radio: bolaRadio * 2.1 },
    muros: diseno.muros.map((m) => ({
      x: enX(m.x),
      y: enY(m.y),
      // Con un mínimo en píxeles: un dos por ciento de un panel lateral son
      // cuatro píxeles, y una bola de seis los cruza de un bote.
      w: Math.max(10, m.w * campo.ancho),
      h: Math.max(10, m.h * campo.alto)
    })),
    zonas: diseno.zonas.map((z) => ({
      tipo: z.tipo,
      x: enX(z.x),
      y: enY(z.y),
      w: z.w * campo.ancho,
      h: z.h * campo.alto
    })),
    topes: diseno.topes.map((t) => ({
      x: enX(t.x),
      y: enY(t.y),
      // Contra el ALTO y no contra el ancho: en una pantalla panorámica, un
      // tope medido en partes del ancho sale del tamaño de un plato.
      r: Math.max(9, t.r * campo.alto)
    }))
  };
}
