// El pato de otro, de visita en esta pantalla.
//
// Cuando alguien te manda su pato (ver `enviarVisita` en chat/chatClient.js),
// aparece un SEGUNDO pato en el escenario: con el diseño y el nombre de quien lo
// manda, entra andando por un lado, se planta al lado del pato de casa, hace su
// gesto, suelta el recado si lo trae, y se va por donde vino.
//
// Es un pato prestado, no uno de verdad: no tiene Tamagotchi, ni nivel, ni se le
// puede coger. De ahí que no use `Behavior` —que decide a partir del ánimo y del
// cansancio, y aquí no hay ni lo uno ni lo otro— sino una coreografía corta y
// siempre igual. Del dibujo sí se encarga `Duck`, que es exactamente el mismo.
//
// El visitante NO lleva la clase `.hot`: no debe entrar en el hit-test del
// overlay ni robarle clics al escritorio que hay debajo. Pasa por delante, y ya.

import { Duck } from '../pet/Duck.js';
import { SpeechBubbles } from '../chat/speechBubble.js';
import { skinPorId, SKIN_POR_DEFECTO } from '../game/skins.js';
import { montar } from '../stage.js';

// Gesto de la visita → animación del sheet, con su respaldo por si el diseño
// todavía no la tiene dibujada (ver docs/DISENOS.md: `regalo` es opcional).
const ANIM_DE_GESTO = {
  saludo: { anim: 'happy', respaldo: 'happy' },
  regalo: { anim: 'regalo', respaldo: 'happy' }
};

// La visita entra por el lado contrario al pato de casa, así que la distancia a
// recorrer depende del monitor: media pantalla en un portátil, metro y medio en
// un 4K. A velocidad fija, lo segundo son quince segundos de pato andando antes
// de saludar. Así que lo fijo es el TIEMPO, y la velocidad se saca de ahí; los
// topes evitan tanto el paseo a cámara lenta como el borrón.
const DUR_TRAYECTO = 3.4;    // segundos que tarda en cruzar, mida lo que mida
const VELOCIDAD_MIN = 70;    // px/s
const VELOCIDAD_MAX = 520;   // px/s

/**
 * Lo que tiene que pasar entre dos visitas del mismo pato.
 *
 * Lo aplica el que recibe, pero lo mira TAMBIÉN el que manda, para poder enseñar
 * cuánto falta en vez de dejarle mandar un pato que se va a descartar en la otra
 * punta sin que se entere nadie. Por eso vive aquí y se exporta: si los dos
 * lados no usan el mismo número, la cuenta atrás miente.
 *
 * La visita entera dura unos 12 s (entrar + gesto + irse), así que esto es esa
 * ida y vuelta más un respiro. Subirlo protege más de un pesado del canal
 * global; bajarlo hace más ágil mandarle un par de patos seguidos a un amigo.
 */
export const ESPERA_ENTRE_VISITAS = 25000;
const HUECO = 1.15;          // a cuántos cuerpos del pato local se planta
const DUR_GESTO = 2.4;       // segundos haciendo el gesto
const DUR_RECADO = 3.2;      // segundos de más si trae recado, para poder leerlo
const MARGEN_SALIDA = 4;     // px del borde a partir de los que se da por ido
const MARGEN_ENTRADA = 12;   // px de más fuera del cuadro, para no verle el pico

/**
 * Una visita en curso. La monta y la desmonta `ColaDeVisitas`; no se usa suelta.
 */
class PatoVisitante {
  /**
   * @param {{de:string, skin:string, gesto:string, texto:string}} visita
   * @param {{sprites:object, suelo:()=>number, xLocal:()=>number}} escena
   */
  constructor(visita, escena) {
    this.visita = visita;
    this.escena = escena;
    this.fase = 'entrar';
    this.espera = 0;
    this.velocidad = null;   // la fija cada tramo; ver `_andarHasta`
    this.raf = null;
    this.terminado = false;
    this._alTerminar = () => {};

    const meta = escena.sprites || {};
    const skin = this._skinValida(visita.skin);
    const dims = meta[skin] || {};

    // El marcado del pato está escrito a mano en cada carcasa (index.html del
    // escritorio, panel.html de la extensión, y generado en content.js), así que
    // el visitante se construye el suyo. Mismas clases, para heredar el CSS y la
    // escala tal cual. Sin `.status-bubbles`: no tiene ánimo que enseñar.
    this.el = document.createElement('div');
    this.el.className = 'duck duck-visita';
    this.el.dataset.state = 'walk';
    this.el.dataset.facing = 'right';

    this.capaBocadillo = document.createElement('div');
    this.capaBocadillo.className = 'speech-layer';

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'duck-canvas';
    this.canvas.width = dims.frameW || 248;
    this.canvas.height = dims.frameH || 268;

    const sombra = document.createElement('div');
    sombra.className = 'duck-shadow';

    this.el.append(this.capaBocadillo, this.canvas, sombra);
    // Antes de construir el Duck: `medir()` lee el tamaño en pantalla, y fuera
    // del documento sale cero.
    montar(this.el);

    this.duck = new Duck(this.el, this.canvas, escena.suelo(), skin, meta);
    this.bocadillos = new SpeechBubbles(this.capaBocadillo);

    this._colocarEnElBorde();
  }

  /**
   * El diseño llega por un canal público: sólo vale si es uno de los nuestros.
   * Sin esta comprobación, un mensaje cualquiera decidiría qué imagen se carga.
   *
   * No se mira el nivel: la visita enseña el diseño que tenga QUIEN la manda, y
   * lo que él haya desbloqueado no es asunto de esta pantalla.
   */
  _skinValida(id) {
    return skinPorId(id) ? id : SKIN_POR_DEFECTO;
  }

  /**
   * Entra por el lado que le pilla más lejos al pato de casa, para que se le vea
   * cruzar en vez de aparecerle encima.
   *
   * Empieza FUERA del cuadro y asoma andando; por eso se le abre el tope de
   * pantalla (ver `Duck.setMargenFuera`), que si no aparecería de golpe pegado
   * al borde. Se queda abierto toda la visita, para que la salida también sea
   * marcharse de verdad y no esfumarse en el filo.
   */
  _colocarEnElBorde() {
    const ancho = this.duck.width;
    const desdeLaIzquierda = this.escena.xLocal() > window.innerWidth / 2;
    this.ladoEntrada = desdeLaIzquierda ? -1 : 1;

    this.duck.setMargenFuera(ancho + MARGEN_ENTRADA);
    this.duck.setDragTransition(false);
    this.duck.setX(desdeLaIzquierda
      ? -(ancho + MARGEN_ENTRADA)
      : window.innerWidth + MARGEN_ENTRADA);
    this.duck.toGround();
    this.duck.setFacing(desdeLaIzquierda ? 1 : -1);
    this.duck.setState('walk');

    // Dónde se planta: a un par de cuerpos del pato de casa, por el lado por el
    // que ha entrado.
    const objetivo = this.escena.xLocal()
      - (desdeLaIzquierda ? ancho * (1 + HUECO) : -ancho * HUECO);
    this.destino = Math.max(0, Math.min(window.innerWidth - ancho, objetivo));
  }

  alTerminar(cb) { this._alTerminar = cb; }

  arrancar() {
    let ultimo = performance.now();
    const paso = (t) => {
      const dt = Math.min((t - ultimo) / 1000, 0.1);
      ultimo = t;
      this._actualizar(dt);
      if (!this.terminado) this.raf = requestAnimationFrame(paso);
    };
    this.raf = requestAnimationFrame(paso);
  }

  _actualizar(dt) {
    // El suelo se mueve (cambio de resolución, panel redimensionado) y el pato
    // de casa también: la visita sigue a los dos.
    this.duck.setGround(this.escena.suelo());

    if (this.fase === 'entrar') return this._andarHasta(this.destino, dt, () => this._gesto());
    if (this.fase === 'gesto') {
      this.espera -= dt;
      if (this.espera <= 0) this._irse();
      return;
    }
    if (this.fase === 'irse') {
      // Se va del todo, hasta perderse de vista por donde vino.
      const salida = this.ladoEntrada === -1
        ? -(this.duck.width + MARGEN_ENTRADA)
        : window.innerWidth + MARGEN_ENTRADA;
      return this._andarHasta(salida, dt, () => this.terminar());
    }
  }

  /** A qué ritmo hay que andar para cruzar `distancia` en el tiempo de siempre. */
  _velocidadPara(distancia) {
    return Math.max(VELOCIDAD_MIN,
      Math.min(VELOCIDAD_MAX, Math.abs(distancia) / DUR_TRAYECTO));
  }

  _andarHasta(x, dt, alLlegar) {
    // La velocidad se fija al empezar el tramo y no se recalcula por el camino:
    // si se sacara de lo que falta, el pato iría frenando hasta no llegar nunca.
    if (this.velocidad == null) this.velocidad = this._velocidadPara(x - this.duck.x);

    const dx = x - this.duck.x;
    if (Math.abs(dx) <= Math.max(MARGEN_SALIDA, this.velocidad * dt)) {
      this.duck.setX(x);
      this.velocidad = null;
      alLlegar();
      return;
    }
    const dir = dx > 0 ? 1 : -1;
    this.duck.setFacing(dir);
    this.duck.setState('walk');
    this.duck.setX(this.duck.x + dir * this.velocidad * dt);
  }

  _gesto() {
    this.fase = 'gesto';
    // De cara al pato de casa, que es a quien viene a ver.
    this.duck.setFacing(this.escena.xLocal() > this.duck.centerX() ? 1 : -1);

    const g = ANIM_DE_GESTO[this.visita.gesto] || ANIM_DE_GESTO.saludo;
    // Si el diseño no tiene todavía la fila del gesto, se usa el respaldo:
    // `Duck.setState` se quedaría en la animación anterior, y el visitante
    // llegaría, se plantase y no hiciera nada.
    this.duck.setState(this.duck.tieneAnimacion(g.anim) ? g.anim : g.respaldo);

    // El bocadillo sale SIEMPRE, aunque no traiga recado: es lo único que dice
    // de quién es el pato. Sin él, una visita a secas es un pato desconocido que
    // saluda y se va, y no hay forma de saber quién ha sido.
    this.espera = DUR_GESTO;
    const texto = (this.visita.texto || '').trim();
    this.bocadillos.show(this.visita.de, texto || '👋', { self: false });
    if (texto) this.espera += DUR_RECADO;
  }

  _irse() {
    this.fase = 'irse';
    this.duck.setState('walk');
  }

  /** Se acabó la visita: se para todo y no queda rastro en el documento. */
  terminar() {
    if (this.terminado) return;
    this.terminado = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    // El animador de sprites corre en su propio bucle: hay que pararlo aparte o
    // se queda dibujando sobre un lienzo que ya no está en ninguna parte.
    this.duck.detener();
    this.el.remove();
    this._alTerminar();
  }
}

/**
 * Las visitas que van llegando, de una en una.
 *
 * Dos patos ajenos a la vez no se entienden: se pisan el sitio y los bocadillos.
 * Y como el canal es global —cualquiera con TuCuack abierto está en la misma
 * lista— hay además un límite por remitente, que es lo único que impide que
 * alguien te llene el escritorio de patos.
 */
export class ColaDeVisitas {
  /**
   * `alAnotar` salta en cuanto se admite la visita, y `alAparecer` cuando el
   * pato se planta de verdad en la pantalla. No son lo mismo si hay cola: lo que
   * hay que dejar apuntado conviene apuntarlo ya —el pato puede apagarse antes
   * de que le llegue el turno—, pero el cuack y el saludo del pato de casa tienen
   * que sonar cuando hay algo que ver.
   *
   * @param {{sprites:object, suelo:()=>number, xLocal:()=>number,
   *          seAdmiten:()=>boolean, alAnotar?:(v:object)=>void,
   *          alAparecer?:(v:object)=>void}} escena
   */
  constructor(escena) {
    this.escena = escena;
    this.cola = [];
    this.actual = null;
    /** Última visita admitida de cada remitente, para el límite de frecuencia. */
    this.ultima = new Map();
  }

  /** Cuánto tiene que esperar un mismo remitente entre visita y visita (ms). */
  static get ESPERA_POR_REMITENTE() { return ESPERA_ENTRE_VISITAS; }

  /** Cuántas visitas se guardan esperando turno antes de empezar a tirarlas. */
  static get TOPE_COLA() { return 3; }

  /**
   * Una visita recién llegada del canal.
   * @returns {boolean} si se ha admitido; se descarta en silencio si no.
   */
  recibir(visita) {
    if (!visita || !this.escena.seAdmiten()) return false;

    const ahora = Date.now();
    // Se poda ANTES de los descartes: si sólo se limpiara al admitir una visita,
    // una cola siempre llena dejaría el registro creciendo para siempre.
    this._olvidarViejos(ahora);

    const remitente = visita.deClave || visita.de;
    const anterior = this.ultima.get(remitente);
    if (anterior && ahora - anterior < ColaDeVisitas.ESPERA_POR_REMITENTE) return false;
    if (this.cola.length >= ColaDeVisitas.TOPE_COLA) return false;

    this.ultima.set(remitente, ahora);
    this.cola.push(visita);
    if (this.escena.alAnotar) this.escena.alAnotar(visita);
    this._siguiente();
    return true;
  }

  /**
   * Quita del registro a quien ya no puede estar limitado.
   *
   * El canal es global: sin esto, el mapa se queda con una entrada por cada pato
   * del mundo que haya pasado por aquí, y ninguna sirve ya para nada.
   */
  _olvidarViejos(ahora) {
    for (const [quien, cuando] of this.ultima) {
      if (ahora - cuando >= ColaDeVisitas.ESPERA_POR_REMITENTE) this.ultima.delete(quien);
    }
  }

  _siguiente() {
    if (this.actual || !this.cola.length) return;
    const visita = this.cola.shift();
    const pato = new PatoVisitante(visita, this.escena);
    this.actual = pato;
    pato.alTerminar(() => {
      this.actual = null;
      this._siguiente();
    });
    pato.arrancar();
    if (this.escena.alAparecer) this.escena.alAparecer(visita);
  }

  /**
   * Se apaga el pato de casa: la visita se va con él.
   *
   * Hace falta sobre todo en la extensión, donde el pato se muda de pestaña: sin
   * esto quedaría un visitante dibujando en cada sitio por el que ha pasado.
   */
  apagar() {
    this.cola.length = 0;
    if (this.actual) this.actual.terminar();
    this.actual = null;
  }
}
