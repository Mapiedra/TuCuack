// Duck — el pato en pantalla: posición, dirección y estado de animación.
// Renderiza el sprite sheet (assets/sprites/duck.png) sobre un <canvas> mediante
// SpriteAnimator. Si el sprite no carga, cae a un emoji como respaldo.

import { SpriteAnimator } from './SpriteAnimator.js';
import { cargarSheet } from '../assets.js';

// Los metadatos del sheet (filas, frames y fps de cada animación) los genera
// tools/pack_sprites.py y llegan desde el proceso principal: cada diseño tiene
// los suyos, así que no pueden ir escritos aquí. Todas las animaciones miran a
// la DERECHA.
//
// Este es el respaldo por si el índice no estuviera disponible.
const SHEET_POR_DEFECTO = {
  frameW: 248,
  frameH: 268,
  animations: {
    idle:  { row: 0,  frames: 7, fps: 6,  loop: true },
    walk:  { row: 1,  frames: 8, fps: 12, loop: true },
    play:  { row: 2,  frames: 8, fps: 12, loop: true },
    eat:   { row: 3,  frames: 8, fps: 10, loop: true },
    sleep: { row: 4,  frames: 8, fps: 5,  loop: true },
    happy: { row: 5,  frames: 4, fps: 8,  loop: true },
    talk:  { row: 6,  frames: 6, fps: 8,  loop: true },
    cool:  { row: 7,  frames: 6, fps: 8,  loop: true },
    sad:   { row: 8,  frames: 6, fps: 5,  loop: true },
    flap:  { row: 9,  frames: 6, fps: 14, loop: true },
    drag:  { row: 10, frames: 6, fps: 10, loop: true }
  }
};

// Estado lógico → animación del sheet.
const STATE_ANIM = {
  idle: 'idle', walk: 'walk', sleep: 'sleep', happy: 'happy', sad: 'sad',
  eat: 'eat', play: 'play', talk: 'talk', cool: 'cool',
  drag: 'drag', fall: 'flap',
  // Entregar algo con el ala. Es la única animación OPCIONAL: los diseños cuyo
  // arte no la traiga dibujada simplemente no la tienen (ver docs/DISENOS.md y
  // `tieneAnimacion`), y quien la pida se queda con otra.
  regalo: 'regalo'
};

const CANON_DIR = 1; // el arte mira a la derecha

export class Duck {
  constructor(root, canvas, groundOffset = 0, skinId = 'normal', metadatos = null) {
    this.skinId = skinId;
    // { <id>: {frameW, frameH, animations} } — uno por diseño.
    this.metadatos = metadatos || {};
    this.el = root;              // #duck
    this.canvas = canvas;        // #duckCanvas
    this.x = 200;
    this.ground = groundOffset;  // altura del suelo desde el borde inferior
    this.y = groundOffset;
    this.facing = 1;             // 1 derecha (canónico), -1 izquierda
    this.tilt = 0;               // inclinación en grados (al volar)
    this.margenFuera = 0;        // ver setMargenFuera
    this.state = 'idle';
    this.medir();
    this.animator = null;
    this.ready = false;
    this._generacionSheet = 0;

    this._loadSheet();
    this._apply();
  }

  /**
   * Relee el tamaño del pato en pantalla.
   *
   * El alto y el ancho salen del CSS (`--duck-scale`), y hay que refrescarlos
   * cuando ese tamaño cambia —el panel de la extensión ajusta la escala según el
   * hueco disponible— porque de ellos dependen los topes de posición.
   */
  medir() {
    this.width = this.el.offsetWidth || 96;
    this.height = this.el.offsetHeight || 104;
  }

  /** Metadatos del diseño puesto, o los de respaldo si no se conocen. */
  _sheet() {
    return this.metadatos[this.skinId] || SHEET_POR_DEFECTO;
  }

  /**
   * ¿El diseño puesto trae dibujada esa animación?
   *
   * No todos los sheets tienen las mismas filas: `regalo` es opcional. Quien
   * quiera enseñar algo que quizá no exista tiene que preguntar antes, porque
   * `setState` se limita a quedarse en la animación anterior —que es lo correcto
   * para el pato de casa, pero deja plantado a quien esperaba ver un gesto.
   */
  tieneAnimacion(anim) {
    return !!(anim && this._sheet().animations[anim]);
  }

  _loadSheet() {
    const meta = this._sheet();
    const skinId = this.skinId;
    // Cambiar de diseño dos veces seguidas lanza dos cargas; sólo vale la
    // última, así que las que lleguen tarde se descartan.
    const generacion = ++this._generacionSheet;

    cargarSheet(skinId).then((imagen) => {
      if (generacion !== this._generacionSheet) return;
      const sheet = { image: imagen, frameW: meta.frameW, frameH: meta.frameH,
                      animations: meta.animations };
      if (this.animator) this.animator.stop();
      this.animator = new SpriteAnimator(this.canvas, sheet);
      this.ready = true;
      this.animator.play(STATE_ANIM[this.state] || 'idle');
    }).catch(() => {
      if (generacion !== this._generacionSheet) return;
      console.warn(`[duck] no se pudo cargar el diseño "${skinId}"; usando emoji`);
      this._emojiFallback();
    });
  }

  /**
   * Para la animación y descarta lo que esté cargándose.
   *
   * El animador tiene su propio bucle de fotogramas, así que hay que pararlo
   * aparte: si no, al mudar el pato de pestaña quedaría uno dibujando por cada
   * sitio por el que ha pasado.
   */
  detener() {
    this._generacionSheet++;   // lo que llegue tarde ya no monta nada
    if (this.animator) this.animator.stop();
    this.ready = false;
  }

  /** Cambia el diseño del pato en caliente. */
  setSkin(skinId) {
    if (!skinId || skinId === this.skinId) return;
    this.skinId = skinId;
    this.ready = false;
    this._loadSheet();
  }

  _emojiFallback() {
    this.canvas.style.display = 'none';
    const span = document.createElement('div');
    span.className = 'duck-emoji';
    span.textContent = '🦆';
    this.el.appendChild(span);
  }

  /**
   * Cuánto se le deja asomar por fuera de la pantalla, en píxeles a cada lado.
   *
   * Normalmente cero: el pato vive dentro del cuadro y el tope evita perderlo al
   * lanzarlo contra un borde. Se abre a propósito y por un rato para las idas y
   * venidas —el pato que se marcha a llevar un recado, la visita que llega de
   * fuera—, donde salirse es justo la gracia. Ver core/visita/.
   */
  setMargenFuera(px) {
    this.margenFuera = Math.max(0, px || 0);
    this.setX(this.x);   // por si ya estaba fuera y ahora hay que meterlo
  }

  setX(x) {
    const fuera = this.margenFuera || 0;
    const max = window.innerWidth - this.width + fuera;
    this.x = Math.max(-fuera, Math.min(max, x));
    this.el.style.left = `${this.x}px`;
  }

  setY(y) {
    const max = window.innerHeight - this.height;
    this.y = Math.max(this.ground, Math.min(max, y));
    // El CSS resta el margen bajo los pies (ver .duck en styles.css).
    this.el.style.setProperty('--duck-y', `${this.y}px`);
  }

  toGround() { this.setY(this.ground); }

  /** Actualiza la línea del suelo (cambia con la barra de tareas / resolución). */
  setGround(g) {
    this.ground = Math.max(0, g || 0);
    if (this.y < this.ground) this.setY(this.ground);
  }

  onGround() { return this.y <= this.ground + 0.5; }

  /**
   * Cuerpo del pato para colisiones, en coordenadas de cliente: un círculo
   * centrado en el punto sobre el que gira al volar (el 50%/67% del lienzo,
   * o sea el centro del cuerpo, ver `transform-origin` en styles.css).
   *
   * Para esto NO sirve `hitTest`, por tres motivos: mira el alpha de un solo
   * píxel deshaciendo el volteo horizontal pero **no la rotación**, así que con
   * el pato inclinado en el aire mira el píxel equivocado; obliga a un
   * `getImageData` por consulta, que es una lectura de vuelta de la GPU; y un
   * test de punto deja que algo rápido —una paleta— atraviese al pato entre dos
   * fotogramas sin tocarlo nunca.
   *
   * @returns {{cx:number, cy:number, radio:number}}
   */
  cuerpo() {
    // El rect del CONTENEDOR, no el del lienzo: la inclinación se aplica al
    // lienzo, y el rectángulo de un elemento girado es su caja envolvente, que
    // crece con el giro. El contenedor no se transforma nunca, así que mide
    // igual con el pato de pie que dando vueltas por el aire.
    const r = this.el.getBoundingClientRect();
    return {
      cx: r.left + r.width / 2,
      cy: r.top + r.height * 0.67,
      radio: r.width * 0.29
    };
  }

  setDragTransition(on) {
    this.el.style.transition = on ? 'bottom 0.28s cubic-bezier(.34,1.2,.64,1)' : 'none';
  }

  setFacing(dir) {
    if (dir === 0) return;
    this.facing = dir < 0 ? -1 : 1;
    this.el.dataset.facing = this.facing === 1 ? 'right' : 'left';
    this._applyTransform();
  }

  /** Inclinación del sprite (grados). Se usa al volar por los aires. */
  setTilt(deg) {
    const t = Math.max(-70, Math.min(70, deg || 0));
    if (Math.abs(t - this.tilt) < 0.5) return;
    this.tilt = t;
    this._applyTransform();
  }

  _applyTransform() {
    // El volteo horizontal se combina con la inclinación; el signo del giro se
    // invierte al voltear para que la inclinación siga el sentido del vuelo.
    const flip = this.facing === CANON_DIR ? 1 : -1;
    const rot = this.tilt * flip;
    const parts = [];
    if (flip === -1) parts.push('scaleX(-1)');
    if (rot) parts.push(`rotate(${rot.toFixed(1)}deg)`);
    this.canvas.style.transform = parts.length ? parts.join(' ') : 'none';
  }

  setState(state) {
    if (this.state === state || !STATE_ANIM[state]) return;
    this.state = state;
    this.el.dataset.state = state;
    // Si el diseño no tiene esa animación, se queda en la que estuviera.
    const anim = STATE_ANIM[state];
    if (this.ready && this.animator && this._sheet().animations[anim]) {
      this.animator.play(anim);
    }
  }

  centerX() { return this.x + this.width / 2; }

  // Rect en coordenadas de cliente (para colocar menús junto al pato).
  rect() { return this.canvas.getBoundingClientRect(); }

  /**
   * Hit-test preciso: comprueba el alpha del píxel bajo el cursor, no el
   * rectángulo del lienzo. Sin esto, el sprite (que lleva mucho margen
   * transparente alrededor) capturaría clics destinados al escritorio.
   */
  hitTest(clientX, clientY) {
    const r = this.rect();
    if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) {
      return false;
    }
    if (!this.ready || !this.animator) return true; // respaldo emoji
    let u = (clientX - r.left) / r.width;
    const v = (clientY - r.top) / r.height;
    if (this.facing !== CANON_DIR) u = 1 - u;      // el lienzo está volteado
    const px = Math.floor(u * this.canvas.width);
    const py = Math.floor(v * this.canvas.height);
    try {
      const d = this.animator.ctx.getImageData(px, py, 1, 1).data;
      return d[3] > 24;
    } catch {
      return true;
    }
  }

  _apply() {
    this.el.dataset.state = this.state;
    this.el.dataset.facing = this.facing === 1 ? 'right' : 'left';
    this.el.style.left = `${this.x}px`;
    this.el.style.setProperty('--duck-y', `${this.y}px`);
  }
}
