// Toques con la paleta: mantener a la mascota en el aire sin que toque el suelo.
//
// Es el primer juego que toma prestado el escenario entero (ver escenario.js):
// en vez de un tablero dentro de un panel, pilota a la propia mascota por la
// pantalla con la MISMA física con la que vuela cuando la lanzas. Lo único que
// cambia son los números —menos gravedad, sin planeo— y quién manda.
//
// Se juega solo. No hay victoria posible: se aguanta hasta que se cae, y lo que
// se persigue es el récord.

const TOQUES_PARA_EMPEZAR_A_ACELERAR = 6;

/**
 * La física de la paleta.
 *
 * Se quita el PLANEO a propósito. En el vuelo normal, cuando la mascota va
 * despacio aletea y se queda cayendo a velocidad fija: perfecto para que un
 * lanzamiento acabe en un aterrizaje suave, y fatal aquí, porque flotaría en vez
 * de caer y no habría juego. Con el umbral a cero esa rama no entra nunca.
 */
function ajustesDeLaPaleta(fisica, toques) {
  // Sube un poco con los toques, para que la partida no se estanque.
  const extra = Math.min(220, Math.max(0, toques - TOQUES_PARA_EMPEZAR_A_ACELERAR) * 12);
  return fisica.conAjustes({
    GRAVEDAD: 1150 + extra,
    ROZAMIENTO_AIRE: 0.22,   // menos que el normal: conserva mejor el efecto
    PLANEO_UMBRAL: 0,        // sin planeo: aquí se cae de verdad
    REBOTE_PARED: 0.86,      // las paredes devuelven casi todo
    REBOTE_TECHO: 0.5,
    INCLINACION_POR_VX: 0.02
  });
}

/** Golpe base hacia arriba. Lo justo para llegar a media pantalla. */
const IMPULSO = 780;
/** Cuánto del movimiento de la paleta se le pega a la mascota. */
const EFECTO = 0.45;
/** Cuánto desvía golpear con el borde en vez de con el centro. */
const DESVIO_MAX = 520;

/**
 * @param {import('./index.js').ContextoPartida} ctx
 * @returns {import('./index.js').Partida}
 */
export function crearPartida(ctx) {
  const pista = ctx.escenario;
  const { fisica, vuelo, pato, entrada } = pista;

  let toques = 0;
  let terminada = false;
  let ultimoToque = 0;
  /** Dónde estaba el cuerpo el fotograma anterior, en coordenadas de pantalla.
   *  Sirve para no perder un golpe cuando la mascota pasa muy deprisa. */
  let cyAnterior = null;

  const mejorPrevio = typeof ctx.marcas.mejor === 'number' ? ctx.marcas.mejor : null;

  // Se lanza desde arriba para que la partida empiece con la mascota ya en el
  // aire: si empezara en el suelo, sería una derrota instantánea.
  const m = pista.medidas;
  pista.ajustes = ajustesDeLaPaleta(fisica, 0);
  fisica.arrancarVuelo(vuelo, {
    x: Math.max(0, m.ancho / 2 - m.patoAncho / 2),
    y: Math.max(m.suelo + 40, (m.alto - m.patoAlto) * 0.62),
    vx: (ctx.semilla % 2 === 0 ? 1 : -1) * 90,
    vy: 0
  });

  marcar();

  return { actualizar, destroy };

  function destroy() { terminada = true; }

  // ---- Un fotograma ------------------------------------------------------

  function actualizar(dt, p) {
    if (terminada) return;

    const medidas = p.medidas;
    const pala = dondeEstaLaPaleta(medidas);

    const sucesos = fisica.paso(vuelo, dt, p.limites(), p.ajustes);
    if (sucesos.pared) ctx.sonido.boing(Math.min(0.5, sucesos.pared));
    fisica.aplicar(pato, vuelo, p.ajustes);

    // El suelo es el final. Se mira ANTES de pintar, para no dejar un fotograma
    // con la mascota ya posada y el marcador todavía vivo.
    if (sucesos.suelo !== null || sucesos.posado || vuelo.y <= medidas.suelo + 0.5) {
      return acabar();
    }

    mirarSiHayGolpe(pala);
    pintar(p, pala, medidas);
  }

  // ---- La paleta ---------------------------------------------------------

  function dondeEstaLaPaleta(medidas) {
    // Ancho relativo al tamaño de la mascota: así el juego se siente igual en un
    // monitor de 1920 y en el panel lateral, que es mucho más estrecho.
    const mitad = Math.max(38, medidas.patoAncho * 0.62);
    const grosor = 14;
    // La paleta no sube más allá de media pantalla: si no, se podría "llevar" a
    // la mascota pegada al techo y no habría juego.
    const yMin = medidas.alto * 0.42;
    return {
      x: Math.max(mitad, Math.min(medidas.ancho - mitad, entrada.x)),
      y: Math.max(yMin, Math.min(medidas.alto - 8, entrada.y)),
      mitad,
      grosor
    };
  }

  function mirarSiHayGolpe(pala) {
    const cuerpo = pato.cuerpo();
    const cy = cuerpo.cy;
    const previo = cyAnterior;
    cyAnterior = cy;

    if (vuelo.vy >= 0) return;                 // sólo se golpea lo que cae
    if (Date.now() - ultimoToque < 120) return; // un contacto es un toque, no diez

    const dentroX = Math.abs(cuerpo.cx - pala.x) <= pala.mitad + cuerpo.radio * 0.45;
    if (!dentroX) return;

    const tocando = Math.abs(cy - pala.y) <= cuerpo.radio + pala.grosor / 2;
    // Y si venía tan deprisa que se la saltó entre dos fotogramas, también
    // cuenta: con la mascota cayendo a mil px/s, un test de contacto puro se
    // pierde el golpe una de cada tres veces.
    const seLaSalto = previo !== null && previo < pala.y && cy >= pala.y;

    if (tocando || seLaSalto) golpear(cuerpo, pala);
  }

  function golpear(cuerpo, pala) {
    toques++;
    ultimoToque = Date.now();
    pista.ajustes = ajustesDeLaPaleta(fisica, toques);

    // Dónde ha pegado dentro de la paleta, de -1 (punta izquierda) a 1.
    const donde = Math.max(-1, Math.min(1, (cuerpo.cx - pala.x) / pala.mitad));

    // El movimiento de la paleta se le pega: es lo que permite dar efecto y
    // colocar el siguiente toque en vez de limitarse a devolverla.
    vuelo.vy = IMPULSO + Math.max(0, entrada.vy) * EFECTO;
    vuelo.vx = vuelo.vx * 0.3 + donde * DESVIO_MAX + entrada.vx * EFECTO;

    // Y se la coloca justo encima de la paleta. Si venía tan rápida que se la
    // saltó, sin esto quedaría por debajo, y desde ahí ya no hay golpe que
    // valga: caería sin que la paleta pueda alcanzarla.
    //
    // Se trabaja con la DIFERENCIA y no con posiciones absolutas: en pantalla la
    // Y crece hacia abajo y en la mascota hacia arriba, así que un desplazamiento
    // se traduce cambiándole el signo y no hay que convertir orígenes.
    const objetivo = pala.y - cuerpo.radio - pala.grosor / 2;
    if (cuerpo.cy > objetivo) vuelo.y += cuerpo.cy - objetivo;

    ctx.sonido.boing(Math.min(1, 0.35 + toques / 40));
    marcar();
  }

  // ---- Final -------------------------------------------------------------

  function acabar() {
    if (terminada) return;
    terminada = true;

    const esRecord = toques > 0 && (mejorPrevio === null || toques > mejorPrevio);
    ctx.sonido[esRecord ? 'victoria' : 'derrota']();
    ctx.alTerminar({
      resultado: esRecord ? 'victoria' : 'derrota',
      puntos: toques,
      detalle: detalleFinal(esRecord)
    });
  }

  function detalleFinal(esRecord) {
    if (toques === 0) return 'Ni un toque. Se cayó de primeras.';
    const cuenta = toques === 1 ? '1 toque' : `${toques} toques`;
    if (esRecord) {
      return mejorPrevio === null ? `${cuenta}. A ver quién lo mejora.`
        : `${cuenta}. Récord nuevo: antes eran ${mejorPrevio}.`;
    }
    return `${cuenta}. Tu récord sigue en ${mejorPrevio}.`;
  }

  function marcar() {
    pista.marcador(mejorPrevio === null
      ? `${toques}`
      : `${toques}  ·  récord ${mejorPrevio}`);
  }

  // ---- Pintado -----------------------------------------------------------

  function pintar(p, pala, medidas) {
    const g = p.pintor;

    // La línea del suelo: es la que no hay que tocar, así que se ve.
    const ySuelo = p.aPantalla(medidas.suelo);
    g.strokeStyle = 'rgba(193, 18, 31, 0.45)';
    g.lineWidth = 3;
    g.setLineDash([10, 8]);
    g.beginPath();
    g.moveTo(0, ySuelo);
    g.lineTo(medidas.ancho, ySuelo);
    g.stroke();
    g.setLineDash([]);

    // Y la paleta, con el mismo trazo de tinta que el resto de la interfaz.
    const x = pala.x - pala.mitad;
    const y = pala.y - pala.grosor / 2;
    const r = pala.grosor / 2;
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, pala.mitad * 2, pala.grosor, r);
    else g.rect(x, y, pala.mitad * 2, pala.grosor);
    g.fillStyle = '#ffb703';
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = '#2b2b3a';
    g.stroke();
  }
}
