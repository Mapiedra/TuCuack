// El agujero: recoger mascotas antes de que el suelo se llene.
//
// Caen mascotas desde arriba. Tu mascota lleva un agujero por el suelo y las que
// caen dentro, dentro. Las que no, se quedan en el suelo, y **ahí se quedan**:
// no desaparecen, no se limpian entre calibres, y van tapando el sitio por donde
// te mueves hasta que ya no cabe ninguna más.
//
// Es incremental: una barra se llena con cada mascota recogida, y al llenarse
// sube el CALIBRE —de una en una, de dos en dos, de tres en tres— mientras la
// barra pide cada vez más. Cada calibre nuevo es un regalo y una condena a la
// vez, y eso es lo que le pone freno a un incremental que si no, no acabaría.
//
// Sobre cómo se amontonan, que es la decisión técnica de este juego, ver
// docs/MINIJUEGOS.md §Amontonarse. En resumen: una mascota está en el aire —con
// física entera— o posada —sin física ninguna—, y nunca en los dos estados. No
// hay choques entre cuerpos: un montón de círculos con física de verdad tiembla,
// se hunde o se desparrama hasta quedar plano.

import { sembrar } from './azar.js';
import { SKINS, estaDesbloqueada, SKIN_POR_DEFECTO } from '../skins.js';
import { cargarSheet } from '../../assets.js';

/** Poses de las que caen. Variedad, nada más: aquí no hay que distinguirlas. */
const POSES = ['flap', 'idle', 'sleep', 'happy', 'play', 'sad'];

/**
 * La física de lo que cae.
 *
 * Sin planeo, como en los otros dos juegos de escenario: el aleteo dejaría a las
 * mascotas bajando a velocidad fija y flotando en vez de caer. Y con los rebotes
 * de pared bajos, que aquí lo que interesa es que bajen, no que hagan carambolas.
 */
function ajustesDeCaida(fisica) {
  return fisica.conAjustes({
    GRAVEDAD: 900,
    ROZAMIENTO_AIRE: 0.4,
    PLANEO_UMBRAL: 0,
    REBOTE_PARED: 0.4,
    REBOTE_SUELO: 0,
    REBOTE_TECHO: 0
  });
}

/** Lo grande que cae, respecto a la mascota de casa. */
const ESCALA = 0.55;
/** Lo que sube el montón por cada una que se posa: menos de su alto, para que
 *  se solapen y parezca un montón y no una pila de cajas. */
const APILADO = 0.6;

/** Lo ancho que es el agujero, respecto a la mascota. */
const AGUJERO = 0.62;
/** A qué velocidad puede moverse. Sin tope, se teletransportaría y no habría
 *  juego: la mitad del reto es llegar. */
const VELOCIDAD = 1250;

/**
 * Cada cuánto cae una tanda, y hasta dónde se acelera.
 *
 * Medido, no elegido: con tandas cada segundo y medio, una partida sin tocar el
 * ratón tardaba cinco minutos en llenar el suelo. Un juego de cosas que caen
 * tiene que agobiar desde el principio.
 */
const TANDA_MS = 850;
const TANDA_MIN_MS = 260;
const TANDA_ACELERA = 110;

/** Cuántas hay que recoger para subir de calibre. Crece rápido a propósito. */
function objetivoDe(calibre) {
  return Math.round(5 * Math.pow(1.65, calibre - 1));
}

/**
 * A qué altura de la pantalla se da el suelo por lleno.
 *
 * Es la duración de la partida disfrazada de número: con esto y el ritmo de las
 * tandas se decide cuánto se aguanta. Y hay más suelo del que parece —a lo ancho
 * de una pantalla caben treinta columnas—, así que con medio escenario de tope
 * la partida no acababa nunca.
 */
const TOPE_MONTON = 0.28;

/**
 * @param {import('./index.js').ContextoPartida} ctx
 * @returns {import('./index.js').Partida}
 */
export function crearPartida(ctx) {
  const pista = ctx.escenario;
  const { fisica, pato, entrada } = pista;
  const azar = sembrar(ctx.semilla);
  const mejorPrevio = typeof ctx.marcas.mejor === 'number' ? ctx.marcas.mejor : null;

  pista.ajustes = ajustesDeCaida(fisica);

  const m0 = pista.medidas;
  const cuerpoAncho = m0.patoAncho * ESCALA;
  const cuerpoAlto = m0.patoAlto * ESCALA;
  const agujeroMitad = m0.patoAncho * AGUJERO;

  /**
   * El montón, por columnas: cuánto llega en cada franja de pantalla.
   *
   * Es lo que hace que amontonarse no sea N². Una mascota que cae mira SU
   * columna y ya, en vez de comprobarse contra las doscientas que ya están
   * posadas.
   */
  const anchoColumna = Math.max(12, cuerpoAncho * 0.75);
  const columnas = Math.max(4, Math.ceil(m0.ancho / anchoColumna));
  const altura = new Array(columnas).fill(m0.suelo);

  /** @type {{vuelo:object, skin:string, pose:string}[]} */
  const cayendo = [];
  /** Las posadas, para poder repintar el fondo si cambia el tamaño. */
  const posadas = [];

  let calibre = 1;
  let recogidas = 0;
  let enLaBarra = 0;
  let objetivo = objetivoDe(1);
  let agujeroX = m0.ancho / 2;
  let desdeLaTanda = 0;
  let terminada = false;

  const hojas = cargarHojas(ctx.nivel);
  const fondo = crearFondo(m0);

  marcar();

  return { actualizar, destroy };

  function destroy() { terminada = true; }

  // ---- Un fotograma ------------------------------------------------------

  function actualizar(dt, p) {
    if (terminada) return;
    const medidas = p.medidas;
    fondo.ajustar(medidas, posadas, dibujarPosada);

    moverElAgujero(dt, medidas);

    desdeLaTanda += dt * 1000;
    if (desdeLaTanda >= ritmo()) {
      desdeLaTanda = 0;
      soltarTanda(medidas);
    }

    caer(dt, p, medidas);
    if (terminada) return;

    pintar(p, medidas);
  }

  /** Cada cuánto cae una tanda. Se acelera con el calibre, con suelo. */
  function ritmo() {
    return Math.max(TANDA_MIN_MS, TANDA_MS - (calibre - 1) * TANDA_ACELERA);
  }

  // ---- El agujero --------------------------------------------------------

  /**
   * La mascota lleva el agujero, y por eso no se teletransporta: va andando
   * hacia el ratón a una velocidad tope. Y el montón la frena de verdad —no se
   * atraviesa una pila que le llega por encima—, que es lo que hace que dejar
   * escapar mascotas se pague dos veces.
   */
  function moverElAgujero(dt, medidas) {
    const destino = Math.max(agujeroMitad, Math.min(medidas.ancho - agujeroMitad, entrada.x));
    const paso = VELOCIDAD * dt;
    const dx = Math.max(-paso, Math.min(paso, destino - agujeroX));

    const siguiente = agujeroX + dx;
    if (!bloqueado(siguiente, medidas)) agujeroX = siguiente;

    pato.setX(agujeroX - medidas.patoAncho / 2);
    pato.setY(medidas.suelo);
    pato.setTilt(0);
    if (Math.abs(dx) > 1) pato.setFacing(dx > 0 ? 1 : -1);
    pato.setState(Math.abs(dx) > 1 ? 'walk' : 'idle');
  }

  /** ¿Hay ahí un montón más alto que la mascota? */
  function bloqueado(x, medidas) {
    const alto = medidas.suelo + medidas.patoAlto * 0.55;
    const c = columnaDe(x, medidas);
    return altura[c] > alto;
  }

  function columnaDe(x, medidas) {
    const ancho = medidas.ancho / columnas;
    return Math.max(0, Math.min(columnas - 1, Math.floor(x / ancho)));
  }

  function centroDeColumna(c, medidas) {
    return (c + 0.5) * (medidas.ancho / columnas);
  }

  function enElAgujero(x) {
    return Math.abs(x - agujeroX) <= agujeroMitad;
  }

  /**
   * ¿Se cuela, o se queda encima?
   *
   * El agujero está en el SUELO, así que un montón que ya llega por ahí lo tapa.
   * Pero se aguanta un par de mascotas: si bastara una sola para anular la
   * columna, a los treinta segundos medio suelo estaría muerto y el agujero no
   * serviría de nada donde más falta hace. Medido: con la regla estricta, un
   * jugador que persigue lo que cae no pasaba del calibre 2.
   */
  function cabeEnElAgujero(c, medidas) {
    return altura[c] <= medidas.suelo + cuerpoAlto * APILADO * 1.5;
  }

  // ---- Lo que cae --------------------------------------------------------

  function soltarTanda(medidas) {
    const skins = hojas.disponibles;
    for (let i = 0; i < calibre; i++) {
      const vuelo = fisica.crearVuelo();
      fisica.arrancarVuelo(vuelo, {
        // Se suelta con la esquina, que es como trabaja el vuelo; al pintar se
        // le suma medio cuerpo para dar con el centro.
        x: cuerpoAncho + azar() * Math.max(1, medidas.ancho - cuerpoAncho * 3),
        // Justo debajo del borde: el techo del escenario está calculado para la
        // mascota de casa, que es más grande, y soltarlas por encima las haría
        // rebotar contra él antes de empezar a caer.
        y: medidas.alto - cuerpoAlto,
        vx: (azar() - 0.5) * 120,
        vy: 0
      });
      cayendo.push({
        vuelo,
        skin: skins[Math.floor(azar() * skins.length)],
        pose: POSES[Math.floor(azar() * POSES.length)]
      });
    }
  }

  function caer(dt, p, medidas) {
    const limites = p.limites();
    for (let i = cayendo.length - 1; i >= 0; i--) {
      const bicho = cayendo[i];
      const cx = bicho.vuelo.x + cuerpoAncho / 2;
      const c = columnaDe(cx, medidas);

      // Los límites son los suyos, no los de la mascota de casa: es más pequeña,
      // así que le cabe más pantalla. Y su suelo no es el del escenario, sino lo
      // alto que llegue el montón en su columna: con eso `paso` avisa de que ha
      // aterrizado igual que avisaría del suelo de verdad, y no hay que escribir
      // otra física distinta para lo que cae.
      const suyo = {
        ...limites,
        suelo: altura[c],
        derecha: medidas.ancho - cuerpoAncho,
        techo: medidas.alto - cuerpoAlto
      };
      const sucesos = fisica.paso(bicho.vuelo, dt, suyo, pista.ajustes);
      if (sucesos.suelo === null && !sucesos.posado) continue;

      cayendo.splice(i, 1);
      if (enElAgujero(cx) && cabeEnElAgujero(c, medidas)) recoger();
      else posar(bicho, c, medidas);
      if (terminada) return;
    }
  }

  function recoger() {
    recogidas++;
    enLaBarra++;
    ctx.sonido.nota(560 + Math.min(6, calibre) * 40, 0.09);
    if (enLaBarra >= objetivo) subirDeCalibre();
    marcar();
  }

  function subirDeCalibre() {
    calibre++;
    enLaBarra = 0;
    objetivo = objetivoDe(calibre);
    ctx.pato.animar('happy', 1.2);
    ctx.sonido.nota(660, 0.1);
    ctx.sonido.nota(880, 0.14);
  }

  /**
   * La deja en el montón.
   *
   * Antes de quedarse mira si a un lado hay hueco más abajo y rueda hacia allí:
   * son quince líneas y es lo que hace que salgan montones con forma —picos que
   * se desparraman cuando la pendiente es mucha— en vez de torres de una en
   * fondo.
   */
  function posar(bicho, c, medidas) {
    const col = rodarHastaElHueco(c);
    const y = altura[col];
    altura[col] = y + cuerpoAlto * APILADO;

    const posada = { x: centroDeColumna(col, medidas), y, skin: bicho.skin, pose: bicho.pose };
    posadas.push(posada);
    fondo.pintar(posada, medidas, dibujarPosada);
    ctx.sonido.boing(0.12);

    // Se acabó cuando ya no cabe: el montón ha llegado más arriba de lo que se
    // puede tolerar. Es el freno del incremental.
    if (altura[col] > medidas.suelo + medidas.alto * TOPE_MONTON) acabar();
  }

  function rodarHastaElHueco(desde) {
    let c = desde;
    // Un tope de pasos: sin él, un montón con una pendiente larga mandaría a
    // cada mascota a la otra punta de la pantalla.
    for (let i = 0; i < 6; i++) {
      const izq = c > 0 ? altura[c - 1] : Infinity;
      const der = c < columnas - 1 ? altura[c + 1] : Infinity;
      const bajo = Math.min(izq, der);
      // Sólo rueda si el desnivel es de una mascota entera. Con menos se pasaría
      // la vida rodando y el montón quedaría plano como una alfombra, que es
      // justo lo que hace la física de verdad y lo que no queremos.
      if (bajo >= altura[c] - cuerpoAlto * APILADO) break;
      c = izq <= der ? c - 1 : c + 1;
    }
    return c;
  }

  // ---- Final -------------------------------------------------------------

  function acabar() {
    if (terminada) return;
    terminada = true;
    const esRecord = calibre > 1 && (mejorPrevio === null || calibre > mejorPrevio);
    ctx.sonido[esRecord ? 'victoria' : 'derrota']();
    ctx.pato.animar('sad', 1.4);
    ctx.alTerminar({
      resultado: esRecord ? 'victoria' : 'derrota',
      puntos: calibre,
      detalle: detalleFinal(esRecord)
    });
  }

  function detalleFinal(esRecord) {
    const cuenta = `Calibre ${calibre}, ${recogidas} recogidas`;
    if (esRecord) {
      return mejorPrevio === null
        ? `${cuenta}. A ver quién lo mejora.`
        : `${cuenta}. Récord nuevo: antes era ${mejorPrevio}.`;
    }
    return mejorPrevio === null ? `${cuenta}.` : `${cuenta}. Tu récord sigue en ${mejorPrevio}.`;
  }

  function marcar() {
    pista.marcador(mejorPrevio === null
      ? `Calibre ${calibre}  ·  ${recogidas} recogidas`
      : `Calibre ${calibre}  ·  ${recogidas} recogidas  ·  récord ${mejorPrevio}`);
  }

  // ---- Pintado -----------------------------------------------------------

  function pintar(p, medidas) {
    const g = p.pintor;

    // El montón entero de un solo trazo: está dibujado de antes en su propio
    // lienzo, así que da igual que sean doscientas.
    g.drawImage(fondo.lienzo, 0, 0, medidas.ancho, medidas.alto);

    dibujarAgujero(g, p, medidas);

    for (const bicho of cayendo) {
      dibujarBicho(g, bicho.skin, bicho.pose,
        bicho.vuelo.x + cuerpoAncho / 2, p.aPantalla(bicho.vuelo.y) - cuerpoAlto / 2);
    }

    dibujarBarra(g, medidas);
  }

  function dibujarAgujero(g, p, medidas) {
    const y = p.aPantalla(medidas.suelo);
    const rx = agujeroMitad;
    const ry = Math.max(8, agujeroMitad * 0.3);

    g.save();
    g.beginPath();
    g.ellipse(agujeroX, y, rx, ry, 0, 0, Math.PI * 2);
    const degradado = g.createRadialGradient(agujeroX, y, 1, agujeroX, y, rx);
    degradado.addColorStop(0, '#0b0b12');
    degradado.addColorStop(1, '#2b2b3a');
    g.fillStyle = degradado;
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = '#2b2b3a';
    g.stroke();
    g.restore();
  }

  /** La barra va en el lienzo y no en el marcador: el marcador recibe texto. */
  function dibujarBarra(g, medidas) {
    const ancho = Math.min(360, medidas.ancho * 0.5);
    const alto = 14;
    const x = (medidas.ancho - ancho) / 2;
    const y = medidas.alto - 34;
    const parte = Math.max(0, Math.min(1, enLaBarra / objetivo));

    g.save();
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, ancho, alto, alto / 2);
    else g.rect(x, y, ancho, alto);
    g.fillStyle = 'rgba(255, 253, 247, 0.85)';
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = '#2b2b3a';
    g.stroke();

    if (parte > 0) {
      g.beginPath();
      const w = Math.max(alto, ancho * parte);
      if (g.roundRect) g.roundRect(x, y, w, alto, alto / 2);
      else g.rect(x, y, w, alto);
      g.fillStyle = '#ffb703';
      g.fill();
    }

    g.fillStyle = '#2b2b3a';
    g.font = '600 12px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText(`${enLaBarra} / ${objetivo}`, medidas.ancho / 2, y - 6);
    g.restore();
  }

  function dibujarPosada(g, posada, medidas) {
    dibujarBicho(g, posada.skin, posada.pose,
      posada.x, medidas.alto - posada.y - cuerpoAlto / 2);
  }

  /**
   * Una mascota, en el centro que se le diga.
   *
   * Si su hoja aún no ha llegado —o no va a llegar nunca, que sobre una página
   * con CSP estricto puede pasar— se pinta un bulto. Un juego donde caen cosas
   * invisibles no es difícil, es imposible.
   */
  function dibujarBicho(g, skin, pose, cx, cy) {
    const imagen = hojas.imagen(skin);
    const meta = ctx.sprites[skin];
    const anim = meta && meta.animations && meta.animations[pose];
    if (!imagen || !anim) {
      g.beginPath();
      g.arc(cx, cy, cuerpoAncho * 0.3, 0, Math.PI * 2);
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
      cx - cuerpoAncho / 2, cy - cuerpoAlto / 2, cuerpoAncho, cuerpoAlto);
  }
}

// ---- Las hojas de sprites ------------------------------------------------

/**
 * Trae las hojas de los diseños desbloqueados.
 *
 * Con `cargarSheet` y no con CSS, por lo mismo que la memoria: un
 * `background-image` sobre una página con CSP estricto lo bloquea el `img-src`
 * de esa página. Y sin esperar a que lleguen: el juego arranca igual y las va
 * usando según aparecen.
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

// ---- El lienzo del montón ------------------------------------------------

/**
 * Un lienzo aparte donde vive el montón.
 *
 * Es la mitad de §Amontonarse que no se ve: cada mascota posada se pinta UNA vez
 * aquí y no se vuelve a tocar. Con calibre alto y el suelo medio lleno son
 * cincuenta y pico sprites, y repintarlos a sesenta por segundo en un lienzo a
 * pantalla completa no sale gratis. Así el montón entero cuesta un `drawImage`.
 */
function crearFondo(medidas) {
  const lienzo = document.createElement('canvas');
  const g = lienzo.getContext('2d');
  let ancho = 0;
  let alto = 0;

  const dimensionar = (m) => {
    ancho = m.ancho;
    alto = m.alto;
    lienzo.width = Math.max(1, Math.round(ancho));
    lienzo.height = Math.max(1, Math.round(alto));
  };
  dimensionar(medidas);

  return {
    lienzo,
    /** Si la ventana cambia de tamaño, el montón se vuelve a pintar entero. */
    ajustar(m, posadas, dibujar) {
      if (m.ancho === ancho && m.alto === alto) return;
      dimensionar(m);
      for (const posada of posadas) dibujar(g, posada, m);
    },
    pintar(posada, m, dibujar) { dibujar(g, posada, m); }
  };
}
