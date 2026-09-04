// «No tocar»: la broma.
//
// Se pulsa un botón que dice que no se pulse, sale un cartel diciendo que no
// debiste hacerlo, y empiezan a caer patos. Si haces clic en uno, se parte en dos
// más pequeños. Y otra vez. Y otra vez.
//
// NO es un minijuego y por eso no está en el catálogo: no da experiencia, no
// cuenta partidas, no guarda marca y no cansa a la mascota. Lo único que usa es
// el préstamo del escenario, que es lo que sabe pedir la pantalla y devolverla.
//
// Aquí SÍ hay choques entre cuerpos, y al revés que en The Hole: la gracia es el
// desorden. Círculo contra círculo, sin contactos en reposo ni solucionador
// iterativo. Que tiemble, que se cuele uno por una pared, que el montón se
// sacuda: ahí eso no son fallos, son el chiste. Es la única parte del proyecto
// donde la física mal hecha es la especificación.
//
// Y tres cosas que hay que hacer bien para que sea una broma y no un parte de
// incidencias, que están en docs/MINIJUEGOS.md §La broma:
//
//   1. La partida SIEMPRE termina. Ojo al matiz: la salida VOLUNTARIA tiene un
//      peaje —diez cuentas, ver peaje.js—, que es el chiste; pero las salidas
//      que no se negocian siguen ahí y no las toca nadie: el tope de diez
//      minutos del escenario, el apagado del pato y el fallo del propio juego.
//      Y el peaje se puede intentar tantas veces como haga falta: fallar no
//      castiga, no hay reloj y no vuelve a empezar.
//   2. "Sin fin" necesita techo. Partir en dos sin límite son veinte clics
//      buenos hasta el millón de patos, y ahí la pestaña se muere de verdad.
//   3. Sobre una página ajena, ni asomarse. De eso se encarga quien abre esto.

import * as fisica from '../pet/fisica.js';
import { SKINS, estaDesbloqueada, SKIN_POR_DEFECTO } from './skins.js';
import { cargarSheet } from '../assets.js';
import { crearPeaje } from './peaje.js';

/**
 * El puntero mientras dura la broma.
 *
 * Una mira —«aquí se apunta»— y, encima de un pato, una explosión —«esto se
 * revienta»—. Van como SVG en la propia URL: no hay que empaquetar nada, y el
 * `img-src 'self' data:` del escritorio los admite. Si alguna carcasa los
 * bloqueara, la coma del final deja el cursor de siempre y no se rompe nada.
 */
const RAYOS = 'M14 3v6M14 19v6M3 14h6M19 14h6M7 7l4 4M17 17l4 4M21 7l-4 4M11 17l-4 4';
const CURSOR_REVENTAR = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">`
  + `<g fill="none" stroke="#fffdf7" stroke-width="5.5" stroke-linecap="round"><path d="${RAYOS}"/></g>`
  + `<g fill="none" stroke="#c1121f" stroke-width="2.6" stroke-linecap="round"><path d="${RAYOS}"/></g>`
  + `<circle cx="14" cy="14" r="3.4" fill="#c1121f" stroke="#fffdf7" stroke-width="1.6"/></svg>`
)}") 14 14, pointer`;
const CURSOR_MIRA = 'crosshair';

const POSES = ['flap', 'idle', 'happy', 'play', 'sad', 'cool'];

/** Lo grande que sale el primero, respecto a la mascota de casa. */
const ESCALA_INICIAL = 0.8;
/** Lo que encoge al partirse. */
const ENCOGE = 0.68;
/**
 * Por debajo de aquí ya no se parte: revienta y desaparece.
 *
 * Es el techo del "sin fin". Se siente infinito —nunca ganas, se multiplican más
 * rápido de lo que los revientas— pero el número de bichos vivos está acotado, y
 * de paso da mecánica: PUEDES limpiarlo, pero no a ese ritmo.
 */
const ESCALA_MINIMA = 0.19;

/**
 * Cuántos caben vivos a la vez.
 *
 * Los choques son N², así que este número es el que decide si el chiste va a 60
 * fotogramas o a 6. Está medido, no elegido: ver la sonda de la broma.
 */
const TOPE_VIVOS = 150;

/** Cada cuánto cae uno nuevo, y hasta dónde se acelera con el desorden. */
const CAIDA_MS = 900;
const CAIDA_MIN_MS = 320;

/** Lo que se queda el cartel antes de irse. Lo justo para leerlo dos veces. */
const CARTEL_MS = 4200;

/** A partir de aquí el marcador deja de ser informativo y empieza a insistir. */
const AGOBIO = 45;

function ajustesDeLaBroma() {
  return fisica.conAjustes({
    GRAVEDAD: 1100,
    ROZAMIENTO_AIRE: 0.25,
    PLANEO_UMBRAL: 0,      // aquí nadie planea: se cae y se choca
    REBOTE_PARED: 0.8,
    REBOTE_SUELO: 0.62,
    REBOTE_TECHO: 0.6,
    FRICCION_SUELO: 0.92,
    VELOCIDAD_REPOSO: 0    // que no se posen nunca: esto no se calma solo
  });
}

/**
 * @param {Object} ctx
 * @param {Object} ctx.escenario   la pista prestada (ver minijuegos/escenario.js)
 * @param {Object} ctx.sprites     medidas de las hojas de diseño
 * @param {number} ctx.nivel
 * @param {Object} ctx.sonido
 * @param {(texto:string) => void} ctx.decir
 * @returns {{actualizar:(dt:number, pista:Object)=>void, destroy:Function}}
 */
export function crearBroma(ctx) {
  const pista = ctx.escenario;
  const { entrada } = pista;
  pista.ajustes = ajustesDeLaBroma();

  const m0 = pista.medidas;
  const hojas = cargarHojas(ctx.nivel);

  /** @type {{vuelo:object, escala:number, radio:number, skin:string, pose:string}[]} */
  const patos = [];
  /** Reventados: se pintan un momento como una nubecilla y se olvidan. */
  const nubes = [];

  let reventados = 0;
  let desdeLaCaida = 0;
  let cartel = CARTEL_MS;
  let pulsadoAntes = false;
  let terminada = false;
  /** El peaje, mientras esté abierto. Ver peaje.js. */
  let peaje = null;
  let cursorPuesto = '';

  soltarUno(m0);
  // Directamente al sprite y no por `pato.animar`: mientras el escenario está
  // prestado, `behavior` está bloqueado y `playOnce` no hace nada a propósito.
  // Un juego de escenario manda sobre el sprite, y esto lo es.
  pista.pato.setState('sad');
  ponerCursor(CURSOR_MIRA);
  // Esc y el botón de salir dejan de terminar esto y pasan por la puerta de
  // pago. Ver peaje.js, y el aviso de `alPedirSalir` en escenario.js.
  pista.alPedirSalir(abrirElPeaje);
  ctx.decir('Te dije que no.');
  ctx.sonido.cuack({ agudo: 0.7 });
  marcar();

  return { actualizar, destroy };

  function destroy() {
    terminada = true;
    if (peaje) { peaje.cerrar(); peaje = null; }
  }

  // ---- Un fotograma ------------------------------------------------------

  function actualizar(dt, p) {
    if (terminada) return;
    const medidas = p.medidas;

    if (cartel > 0) cartel -= dt * 1000;

    desdeLaCaida += dt * 1000;
    if (desdeLaCaida >= ritmo()) {
      desdeLaCaida = 0;
      soltarUno(medidas);
    }

    // El reloj del peaje va de aquí y no de un temporizador suyo: así se para
    // solo cuando se para la broma, sin dejar nada suelto.
    if (peaje) peaje.tic(dt);

    mirarElClic();
    mirarElCursor();
    mover(dt, p, medidas);
    chocarEntreEllos();
    pintar(p, medidas);
  }

  /** Cuanto más desorden hay, más deprisa llegan. Es una broma, no un juego. */
  function ritmo() {
    return Math.max(CAIDA_MIN_MS, CAIDA_MS - patos.length * 6);
  }

  // ---- Los patos ---------------------------------------------------------

  function soltarUno(medidas) {
    if (patos.length >= TOPE_VIVOS) return;
    nace(ESCALA_INICIAL,
      Math.random() * Math.max(1, medidas.ancho - m0.patoAncho * ESCALA_INICIAL),
      medidas.alto - m0.patoAlto * ESCALA_INICIAL,
      (Math.random() - 0.5) * 260, 0);
    marcar();
  }

  function nace(escala, x, y, vx, vy) {
    const vuelo = fisica.crearVuelo();
    fisica.arrancarVuelo(vuelo, { x, y, vx, vy });
    patos.push({
      vuelo,
      escala,
      radio: m0.patoAncho * escala * 0.29,
      skin: hojas.unaCualquiera(),
      pose: POSES[Math.floor(Math.random() * POSES.length)]
    });
  }

  /**
   * El puntero dice lo que va a pasar si pulsas.
   *
   * Encima de un pato, la explosión; en el resto de la pantalla, la mira. Se
   * mira cada fotograma porque los patos se mueven solos: aquí no basta con
   * enterarse al mover el ratón.
   */
  function mirarElCursor() {
    ponerCursor(quienEstaDebajo() >= 0 ? CURSOR_REVENTAR : CURSOR_MIRA);
  }

  function ponerCursor(css) {
    if (css === cursorPuesto) return;
    cursorPuesto = css;
    pista.cursor(css);
  }

  /** El índice del pato bajo el puntero, o -1. El de encima gana. */
  function quienEstaDebajo() {
    if (sobreElPeaje()) return -1;
    for (let i = patos.length - 1; i >= 0; i--) {
      const q = patos[i];
      if (Math.hypot(entrada.x - centroX(q), entrada.y - centroY(q)) <= q.radio) return i;
    }
    return -1;
  }

  /** ¿El puntero está sobre el panel del peaje? Ahí los clics no son para aquí. */
  function sobreElPeaje() {
    if (!peaje) return false;
    const r = peaje.el.getBoundingClientRect();
    return entrada.x >= r.left && entrada.x <= r.right
      && entrada.y >= r.top && entrada.y <= r.bottom;
  }

  // ---- La puerta de pago -------------------------------------------------

  /**
   * Alguien quiere irse. Pues no: primero, diez cuentas.
   *
   * Si ya está abierto no se abre otro —pulsar Esc diez veces no debería
   * apilar diez peajes— y se le devuelve el foco, que es lo que se busca al
   * volver a pulsar.
   */
  function abrirElPeaje() {
    if (terminada) return;
    if (peaje) { peaje.enfocar(); return; }
    peaje = crearPeaje(
      () => {
        if (peaje) { peaje.cerrar(); peaje = null; }
        pista.panel(null);
        pista.salir('usuario');
        // Y DESPUÉS se cobra, con la mascota ya devuelta: el aviso del premio
        // sale en un cartel sobre ella, y sacarlo antes sería pintarlo encima de
        // una pantalla que está desapareciendo. Quien paga es app.js, que es
        // quién tiene la cartera; la broma sólo dice que se ha pasado.
        if (ctx.alPasarElPeaje) ctx.alPasarElPeaje();
      },
      () => cerrarElPeaje()
    );
    pista.panel(peaje.el);
    peaje.enfocar();
    ctx.sonido.nota(320, 0.12);
  }

  function cerrarElPeaje() {
    if (!peaje) return;
    peaje.cerrar();
    peaje = null;
    pista.panel(null);
  }

  /**
   * Un clic parte en dos al que esté debajo.
   *
   * Se mira al PULSAR y no al soltar, al revés que en «Pato Hook»: aquí no hay
   * nada que apuntar, y esperar al soltar haría que el clic se sintiera pastoso
   * justo cuando lo que se quiere es aporrear.
   */
  function mirarElClic() {
    const ahora = entrada.pulsado;
    const nuevo = ahora && !pulsadoAntes;
    pulsadoAntes = ahora;
    if (!nuevo) return;

    // Un clic dentro del peaje es para el peaje: app.js reenvía TODOS los
    // `mousedown` mientras hay escena, también los que caen sobre un panel.
    const i = quienEstaDebajo();
    if (i >= 0) partir(i);
  }

  function partir(i) {
    const q = patos[i];
    const cx = centroX(q);
    const cy = centroY(q);
    patos.splice(i, 1);

    const escala = q.escala * ENCOGE;
    if (escala < ESCALA_MINIMA) {
      reventados++;
      nubes.push({ x: cx, y: cy, radio: q.radio, vida: 1 });
      ctx.sonido.nota(1200, 0.06);
      marcar();
      return;
    }

    // Dos, saliendo hacia los lados y hacia arriba: si salieran quietos se
    // taparían el uno al otro y no se vería que se ha partido.
    const ancho = m0.patoAncho * escala;
    const alto = m0.patoAlto * escala;
    // De vuelta a coordenadas de vuelo: la esquina de abajo, con la Y al revés.
    const abajo = pista.medidas.alto - (cy + alto / 2);
    for (const lado of [-1, 1]) {
      if (patos.length >= TOPE_VIVOS) break;
      nace(escala, cx - ancho / 2 + lado * ancho * 0.6, abajo,
        lado * (200 + Math.random() * 220), 320 + Math.random() * 180);
    }
    ctx.sonido.cuack({ agudo: Math.min(1.9, 1 / q.escala) });
    marcar();
  }

  /**
   * El centro en coordenadas de pantalla.
   *
   * `vuelo.x/y` es la esquina de abajo a la izquierda y la Y crece hacia arriba;
   * en pantalla crece hacia abajo. Se convierte aquí, una sola vez, y todo lo
   * demás —dibujo, clic y choques— trabaja ya en pantalla.
   */
  function centroX(q) { return q.vuelo.x + m0.patoAncho * q.escala / 2; }
  function centroY(q) { return pista.aPantalla(q.vuelo.y) - m0.patoAlto * q.escala / 2; }

  // ---- Moverse y chocar --------------------------------------------------

  function mover(dt, p, medidas) {
    for (const q of patos) {
      // Con `VELOCIDAD_REPOSO` a cero esto no se posa nunca, pero un rebote
      // puede acabar en una velocidad exactamente cero y ahí sí se para. Y un
      // pato parado ya no reaccionaría a que le empujen, porque `paso` sale
      // antes de nada si el vuelo está detenido. Se vuelve a soltar.
      if (!q.vuelo.volando) {
        fisica.arrancarVuelo(q.vuelo,
          { x: q.vuelo.x, y: q.vuelo.y, vx: q.vuelo.vx, vy: q.vuelo.vy });
      }
      const ancho = m0.patoAncho * q.escala;
      const alto = m0.patoAlto * q.escala;
      // Los límites son los suyos: uno pequeño llega más lejos que la mascota de
      // casa, que es para la que están calculados los del escenario.
      const suyos = {
        izquierda: 0,
        derecha: Math.max(1, medidas.ancho - ancho),
        suelo: medidas.suelo,
        techo: Math.max(1, medidas.alto - alto)
      };
      fisica.paso(q.vuelo, dt, suyos, p.ajustes);
    }

    for (let i = nubes.length - 1; i >= 0; i--) {
      nubes[i].vida -= dt * 3.2;
      if (nubes[i].vida <= 0) nubes.splice(i, 1);
    }
  }

  /**
   * Círculo contra círculo, y nada más.
   *
   * Sin contactos en reposo, sin solucionador iterativo, sin nada. Se separan
   * los que se solapan y se intercambia la velocidad en el eje que los une. Un
   * montón hecho así tiembla y a veces escupe a alguno por una pared, y eso es
   * exactamente lo que se busca: en cualquier otro sitio del proyecto sería un
   * fallo; aquí es el chiste.
   *
   * Es N², y por eso hay tope de vivos. Con 150 son unas 11.000 comprobaciones
   * por fotograma, que son céntimos. Los centros se calculan UNA vez y se
   * guardan en dos arrays: hacerlo dentro del bucle sería crear once mil objetos
   * por fotograma, y eso ya no son céntimos.
   */
  function chocarEntreEllos() {
    const n = patos.length;
    const cx = new Float64Array(n);
    const cy = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      cx[i] = centroX(patos[i]);
      cy[i] = centroY(patos[i]);
    }

    for (let i = 0; i < n; i++) {
      const a = patos[i];
      for (let j = i + 1; j < n; j++) {
        const b = patos[j];
        const dx = cx[j] - cx[i];
        const dy = cy[j] - cy[i];
        const d = Math.hypot(dx, dy);
        const juntos = a.radio + b.radio;
        if (d >= juntos || d === 0) continue;

        const nx = dx / d;
        const ny = dy / d;
        const solape = (juntos - d) / 2;

        // Separar. La Y del vuelo crece hacia arriba y la de pantalla hacia
        // abajo, así que en Y se le cambia el signo.
        a.vuelo.x -= nx * solape;
        a.vuelo.y += ny * solape;
        b.vuelo.x += nx * solape;
        b.vuelo.y -= ny * solape;
        cx[i] -= nx * solape; cy[i] -= ny * solape;
        cx[j] += nx * solape; cy[j] += ny * solape;

        // Y rebotar: sólo la parte de la velocidad que los acerca, para que dos
        // que ya se están separando no se peguen un tirón absurdo.
        const dvx = b.vuelo.vx - a.vuelo.vx;
        const dvy = -(b.vuelo.vy - a.vuelo.vy);
        const acercan = dvx * nx + dvy * ny;
        if (acercan >= 0) continue;
        const golpe = acercan * 0.9;
        a.vuelo.vx += nx * golpe;
        a.vuelo.vy -= ny * golpe;
        b.vuelo.vx -= nx * golpe;
        b.vuelo.vy += ny * golpe;
      }
    }
  }

  // ---- Pintado -----------------------------------------------------------

  function pintar(p, medidas) {
    const g = p.pintor;

    for (const q of patos) dibujarPato(g, q, centroX(q), centroY(q));

    for (const n of nubes) {
      g.save();
      g.globalAlpha = Math.max(0, n.vida) * 0.7;
      g.beginPath();
      g.arc(n.x, n.y, n.radio * (2 - n.vida), 0, Math.PI * 2);
      g.strokeStyle = '#fb8500';
      g.lineWidth = 3;
      g.stroke();
      g.restore();
    }

    if (cartel > 0) dibujarCartel(g, medidas);
  }

  function dibujarPato(g, q, cx, cy) {
    const ancho = m0.patoAncho * q.escala;
    const alto = m0.patoAlto * q.escala;
    const imagen = hojas.imagen(q.skin);
    const meta = ctx.sprites[q.skin];
    const anim = meta && meta.animations && meta.animations[q.pose];
    if (!imagen || !anim) {
      // Mientras la hoja no llegue —o si no llega nunca, que sobre una página
      // con CSP estricto puede pasar— al menos se ve que hay algo cayendo.
      g.beginPath();
      g.arc(cx, cy, q.radio, 0, Math.PI * 2);
      g.fillStyle = '#ffb703';
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = '#2b2b3a';
      g.stroke();
      return;
    }
    const cuadro = Math.floor((anim.frames || 1) / 2);
    g.drawImage(imagen,
      cuadro * meta.frameW, anim.row * meta.frameH, meta.frameW, meta.frameH,
      cx - ancho / 2, cy - alto / 2, ancho, alto);
  }

  /**
   * El cartel, en el lienzo.
   *
   * Y con la salida escrita dentro: quien acaba de pulsar un botón que decía que
   * no lo pulsara merece saber cómo se para esto antes de que haya cien patos.
   */
  function dibujarCartel(g, medidas) {
    const alfa = Math.min(1, cartel / 600);
    const x = medidas.ancho / 2;
    const y = medidas.alto * 0.3;

    g.save();
    g.globalAlpha = alfa;
    g.textAlign = 'center';

    g.font = '700 46px system-ui, sans-serif';
    g.lineWidth = 8;
    g.strokeStyle = '#fffdf7';
    g.strokeText('No debiste hacer eso', x, y);
    g.fillStyle = '#c1121f';
    g.fillText('No debiste hacer eso', x, y);

    g.font = '600 18px system-ui, sans-serif';
    g.lineWidth = 6;
    g.strokeStyle = '#fffdf7';
    g.strokeText('Esc para que pare', x, y + 34);
    g.fillStyle = '#2b2b3a';
    g.fillText('Esc para que pare', x, y + 34);
    g.restore();
  }

  function marcar() {
    const cuantos = patos.length;
    const cola = reventados ? `  ·  ${reventados} reventados` : '';
    pista.marcador(cuantos >= AGOBIO
      ? `${cuantos} PATOS${cola}  ·  ESC PARA QUE PARE`
      : `${cuantos} patos${cola}  ·  Esc para que pare`);
  }
}

// ---- Las hojas de sprites ------------------------------------------------

function cargarHojas(nivel) {
  const libres = SKINS.filter((s) => estaDesbloqueada(s, nivel));
  const ids = libres.length ? libres.map((s) => s.id) : [SKIN_POR_DEFECTO];
  const imagenes = new Map();
  for (const id of ids) {
    cargarSheet(id).then((img) => imagenes.set(id, img)).catch(() => {});
  }
  return {
    unaCualquiera: () => ids[Math.floor(Math.random() * ids.length)],
    imagen: (id) => imagenes.get(id) || null
  };
}
