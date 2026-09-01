// Física del vuelo del pato: la parábola, los rebotes y el planeo.
//
// Vivía dentro de app.js como variables sueltas de módulo, y eso la hacía
// intocable desde fuera: un minijuego que quiera pilotar al pato —darle toques
// con una paleta, lanzarlo contra dianas— necesita LA MISMA física con otros
// números, no una copia parecida que se vaya separando de la original con los
// meses.
//
// Por eso aquí no hay ni DOM ni sonido: sólo números. `paso` integra un
// fotograma sobre un objeto de estado y CUENTA lo que ha pasado; quien llama
// decide qué hacer con ello (mover el pato, sonar un boing, sumar puntos). Así
// la misma función sirve al pato de siempre, a un minijuego y a una comprobación
// sin pantalla, que es lo que permite demostrar que sigue comportándose igual.
//
// Convenio de ejes: la Y crece HACIA ARRIBA desde el borde inferior de la
// ventana, igual que en Duck. `suelo` no es el origen: es la altura mínima, que
// en el escritorio es la barra de tareas.

/**
 * @typedef {Object} Vuelo
 * @property {number} x  borde izquierdo del pato, en px
 * @property {number} y  altura de los pies sobre el borde inferior, en px
 * @property {number} vx px/s
 * @property {number} vy px/s
 * @property {boolean} volando
 */

/**
 * @typedef {Object} Limites
 * @property {number} izquierda
 * @property {number} derecha
 * @property {number} suelo
 * @property {number} techo
 */

/**
 * Lo que ha ocurrido en este fotograma. Son sucesos, no órdenes: quien llama
 * decide si suenan, si puntúan o si se ignoran.
 *
 * @typedef {Object} Sucesos
 * @property {boolean} aleteo     está planeando: toca batir alas
 * @property {number|null} pared  null si no ha chocado; si no, fuerza del golpe
 * @property {number|null} suelo  ídem contra el suelo
 * @property {boolean} techo      ha topado arriba (nunca sonó; se cuenta por si acaso)
 * @property {boolean} posado     se ha quedado quieto: el vuelo ha terminado
 *
 * `pared` y `suelo` son `null` y no `0` cuando no hay choque porque **un choque
 * de fuerza cero existe**: el pato quieto contra el borde izquierdo (x e vx
 * exactamente 0) choca en cada fotograma con fuerza 0, y el código de siempre lo
 * hacía sonar. Distinguir "no ha chocado" de "ha chocado sin fuerza" es lo que
 * permite reproducir eso exactamente.
 */

/**
 * Los números que dan el "tacto" del pato.
 *
 * Se exportan congelados porque son el comportamiento por defecto y nadie
 * debería cambiarlos a espaldas de los demás: para una partida con otra
 * gravedad está `conAjustes`.
 *
 * Cuidado con `LANZAMIENTO_MAX`: hace dos trabajos, recortar el lanzamiento y
 * normalizar la fuerza de los golpes que se devuelve en `Sucesos`. Se deja como
 * uno solo para no cambiar el comportamiento de siempre, pero un juego que lo
 * baje oirá los boings más fuertes.
 */
export const AJUSTES = Object.freeze({
  GRAVEDAD: 1750,            // px/s²
  LANZAMIENTO_MAX: 2600,     // tope de la velocidad de lanzamiento (px/s)
  ROZAMIENTO_AIRE: 0.55,     // rozamiento horizontal (1/s)
  PLANEO_VELOCIDAD: 240,     // velocidad de caída cuando planea aleteando
  PLANEO_UMBRAL: 300,        // por debajo de esta velocidad, aletea y frena
  REBOTE_PARED: 0.6,         // rebote en los lados
  REBOTE_SUELO: 0.42,        // rebote contra el suelo
  REBOTE_TECHO: 0.35,        // rebote contra el techo
  FRICCION_SUELO: 0.7,       // el suelo frena el avance en cada bote
  VELOCIDAD_REPOSO: 70,      // por debajo de esto, deja de botar
  // Presentación: cuánto se inclina y cuándo se gira. Va aquí y no en Duck
  // porque depende de la velocidad, que es cosa de la física.
  INCLINACION_POR_VX: 0.035,
  INCLINACION_MAX: 45,
  GIRO_MINIMO: 120
});

/**
 * Ajustes para una partida concreta. Un juego de paleta querrá menos gravedad y
 * ningún rebote de suelo (tocar el suelo es perder); lo que no toque se queda
 * como siempre.
 *
 * @param {Partial<typeof AJUSTES>} cambios
 * @returns {typeof AJUSTES}
 */
export function conAjustes(cambios) {
  return Object.freeze({ ...AJUSTES, ...cambios });
}

/** @param {Partial<Vuelo>} [inicial] @returns {Vuelo} */
export function crearVuelo(inicial) {
  return { x: 0, y: 0, vx: 0, vy: 0, volando: false, ...(inicial || {}) };
}

/**
 * Empieza (o reinicia) un vuelo desde una posición y una velocidad concretas.
 * @param {Vuelo} vuelo
 * @param {{x?:number, y?:number, vx?:number, vy?:number}} desde
 */
export function arrancarVuelo(vuelo, desde) {
  const d = desde || {};
  if (d.x != null) vuelo.x = d.x;
  if (d.y != null) vuelo.y = d.y;
  vuelo.vx = d.vx || 0;
  vuelo.vy = d.vy || 0;
  vuelo.volando = true;
  return vuelo;
}

/** @param {Vuelo} vuelo */
export function detenerVuelo(vuelo) {
  vuelo.vx = 0;
  vuelo.vy = 0;
  vuelo.volando = false;
  return vuelo;
}

/** Recorta la velocidad de un lanzamiento. Lo usa el soltar del arrastre. */
export function limitarLanzamiento(vx, vy, ajustes) {
  const t = (ajustes || AJUSTES).LANZAMIENTO_MAX;
  return { vx: limitar(vx, -t, t), vy: limitar(vy, -t, t) };
}

/**
 * El escenario por defecto: la ventana entera, con el pato cabiendo dentro.
 * Se recalcula en cada fotograma porque la ventana cambia de tamaño y el pato
 * de escala, igual que hacía el código de siempre.
 *
 * @param {{width:number, height:number, ground:number}} pato
 * @returns {Limites}
 */
export function limitesDeVentana(pato) {
  return {
    izquierda: 0,
    derecha: window.innerWidth - pato.width,
    suelo: pato.ground,
    techo: window.innerHeight - pato.height
  };
}

/**
 * Integra un fotograma. Muta `vuelo` y no toca nada más.
 *
 * El orden de las operaciones es el que era, y no es casual:
 *   - El planeo se evalúa DESPUÉS de gravedad y rozamiento, y ANTES de integrar
 *     la posición.
 *   - La fuerza del golpe contra la pared se mide DESPUÉS de aplicar el rebote;
 *     la del suelo, ANTES. Medirlas al revés cambiaría el volumen de todos los
 *     choques.
 *   - Al posarse se sale antes de tocar la presentación (inclinación, giro).
 *
 * @param {Vuelo} vuelo
 * @param {number} dt segundos
 * @param {Limites} limites
 * @param {typeof AJUSTES} [ajustes]
 * @returns {Sucesos}
 */
export function paso(vuelo, dt, limites, ajustes) {
  const a = ajustes || AJUSTES;
  const s = { aleteo: false, pared: null, suelo: null, techo: false, posado: false };
  if (!vuelo.volando) return s;

  vuelo.vy -= a.GRAVEDAD * dt;
  vuelo.vx -= vuelo.vx * a.ROZAMIENTO_AIRE * dt;

  // Cuando va despacio el pato aletea y frena la caída: así un simple soltar se
  // convierte en un aterrizaje suave, mientras que un lanzamiento fuerte
  // conserva su parábola.
  if (Math.hypot(vuelo.vx, vuelo.vy) < a.PLANEO_UMBRAL && vuelo.vy < -a.PLANEO_VELOCIDAD) {
    vuelo.vy = -a.PLANEO_VELOCIDAD;
    s.aleteo = true;
  }

  let nx = vuelo.x + vuelo.vx * dt;
  let ny = vuelo.y + vuelo.vy * dt;

  // Rebote en los lados. El borde izquierdo manda si se salen los dos a la vez
  // (ventana más estrecha que el pato), que es lo que hacía el ternario de antes.
  if (nx <= limites.izquierda || nx >= limites.derecha) {
    nx = nx <= limites.izquierda ? limites.izquierda : limites.derecha;
    vuelo.vx = (nx === limites.izquierda ? Math.abs(vuelo.vx) : -Math.abs(vuelo.vx))
      * a.REBOTE_PARED;
    s.pared = Math.abs(vuelo.vx) / a.LANZAMIENTO_MAX;
  }

  // Techo: no se escapa por arriba.
  if (ny >= limites.techo) {
    ny = limites.techo;
    vuelo.vy = -Math.abs(vuelo.vy) * a.REBOTE_TECHO;
    s.techo = true;
  }

  // Suelo: bota y va perdiendo energía hasta quedarse quieto.
  if (ny <= limites.suelo) {
    ny = limites.suelo;
    if (Math.abs(vuelo.vy) > a.VELOCIDAD_REPOSO) {
      s.suelo = Math.abs(vuelo.vy) / a.LANZAMIENTO_MAX;
      vuelo.vy = Math.abs(vuelo.vy) * a.REBOTE_SUELO;
      vuelo.vx *= a.FRICCION_SUELO;
    } else {
      // Se posa en el sitio al que iba, no en el que estaba.
      vuelo.x = nx;
      vuelo.y = ny;
      detenerVuelo(vuelo);
      s.posado = true;
      return s;
    }
  }

  vuelo.x = nx;
  vuelo.y = ny;
  return s;
}

/**
 * Vuelca el vuelo sobre el pato: posición, inclinación y hacia dónde mira.
 *
 * Es la mitad de PRESENTACIÓN, y va aquí y no en cada juego porque "cómo se ve
 * un pato volando" es parte de la física para quien lo mira. No le importa que
 * sea un `Duck`: le vale cualquier cosa con estos métodos.
 *
 * @param {any} pato
 * @param {Vuelo} vuelo
 * @param {typeof AJUSTES} [ajustes]
 */
export function aplicar(pato, vuelo, ajustes) {
  const a = ajustes || AJUSTES;
  pato.setX(vuelo.x);
  pato.setY(vuelo.y);
  pato.setState('fall');

  // Se inclina hacia donde vuela y mira en esa dirección.
  pato.setTilt(limitar(-vuelo.vx * a.INCLINACION_POR_VX, -a.INCLINACION_MAX, a.INCLINACION_MAX));
  if (Math.abs(vuelo.vx) > a.GIRO_MINIMO) pato.setFacing(vuelo.vx > 0 ? 1 : -1);

  // El pato recorta la posición si la ventana ha encogido, y la suya es la
  // verdad: el fotograma siguiente tiene que salir de ahí y no de un punto que
  // ya no existe. Antes esto salía gratis porque la física leía `duck.x`.
  vuelo.x = pato.x;
  vuelo.y = pato.y;
}

function limitar(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
