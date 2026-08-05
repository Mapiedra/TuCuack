// El pato se va corriendo a llevar el recado... y vuelve enseguida.
//
// Es puro teatro: el pato de verdad viaja por el canal en un mensaje, y el otro
// lo ve aparecer al instante (ver PatoVisitante.js). Pero que el tuyo se quede
// tan pancho después de "mandarlo" quedaba raro, así que sale corriendo por el
// borde más cercano, desaparece un momento y vuelve por donde se fue.
//
// No tiene nada que ver con la espera entre visitas: dura un par de segundos y
// se acabó. Si mientras tanto le coges con el ratón, se corta y el pato es tuyo.

const DUR_IDA = 0.75;        // segundos hasta perderse de vista
const DUR_FUERA = 0.55;      // lo que tarda en asomar otra vez
const DUR_VUELTA = 0.85;     // un poco más, que vuelve sin prisa
const HOLGURA = 12;          // px de más, para que no se le vea el pico

/**
 * Manda al pato fuera de la pantalla y lo trae de vuelta a donde estaba.
 *
 * @param {import('../pet/Duck.js').Duck} duck
 * @param {import('../pet/behavior.js').Behavior} behavior
 * @returns {{cancelar:()=>void}} para cortarlo si pasa algo antes (que le
 *   agarren, que se apague el pato) y devolverlo a su sitio.
 */
export function salirYVolver(duck, behavior) {
  const vuelvoA = duck.x;
  // Por el borde que le pilla más cerca: se trata de que vuelva enseguida.
  const dir = duck.centerX() < window.innerWidth / 2 ? -1 : 1;
  const afuera = dir === -1
    ? -(duck.width + HOLGURA)
    : window.innerWidth + HOLGURA;

  // El tope de pantalla existe para no perder al pato al lanzarlo contra un
  // borde; aquí estorba, así que se abre justo lo que dura el paseo.
  duck.setMargenFuera(duck.width + HOLGURA);
  // `lock` deja al pato colgado del cursor (estado 'drag'): aquí sólo se
  // aprovecha que congela la IA, y el estado se pone a mano acto seguido.
  behavior.lock();
  duck.setDragTransition(false);
  duck.setFacing(dir);
  duck.setState('walk');

  let fase = 'ida';
  let espera = 0;
  let raf = null;
  let cortado = false;
  let ultimo = performance.now();

  const paso = (t) => {
    const dt = Math.min((t - ultimo) / 1000, 0.1);
    ultimo = t;
    avanzar(dt);
    if (!cortado) raf = requestAnimationFrame(paso);
  };

  const avanzar = (dt) => {
    if (fase === 'ida') {
      if (mover(afuera, DUR_IDA, dt)) { fase = 'fuera'; espera = DUR_FUERA; }
      return;
    }
    if (fase === 'fuera') {
      espera -= dt;
      if (espera <= 0) {
        fase = 'vuelta';
        duck.setFacing(-dir);
        duck.setState('walk');
      }
      return;
    }
    if (mover(vuelvoA, DUR_VUELTA, dt)) terminar();
  };

  /** Un tramo a ritmo constante. Devuelve si ya ha llegado. */
  const mover = (destino, duracion, dt) => {
    const dx = destino - duck.x;
    const velocidad = Math.abs(afuera - vuelvoA) / duracion;
    if (Math.abs(dx) <= velocidad * dt) {
      duck.setX(destino);
      return true;
    }
    duck.setX(duck.x + Math.sign(dx) * velocidad * dt);
    return false;
  };

  /** Devuelve el pato a su sitio y a su vida. Vale llamarlo dos veces. */
  const terminar = () => {
    if (cortado) return;
    cortado = true;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    // El margen se cierra ANTES de recolocarlo: así, si el paseo se corta con el
    // pato a medio salir, el tope lo devuelve al cuadro en vez de dejarlo fuera.
    duck.setMargenFuera(0);
    duck.setX(vuelvoA);
    behavior.unlock();
  };

  raf = requestAnimationFrame(paso);
  // `volverA` es dónde estaba antes de irse: es la posición que hay que guardar
  // mientras dure el paseo, porque la de ahora puede estar fuera de la pantalla.
  return { cancelar: terminar, volverA: vuelvoA };
}
