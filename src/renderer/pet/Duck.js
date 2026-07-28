// Duck — el pato en pantalla: posición, dirección y estado de animación.
// Renderiza el sprite sheet (assets/sprites/duck.png) sobre un <canvas> mediante
// SpriteAnimator. Si el sprite no carga, cae a un emoji como respaldo.

import { SpriteAnimator } from './SpriteAnimator.js';

// Metadatos del sprite sheet empaquetado por tools/pack_sprites.py
// (ver assets/sprites/duck.json). Todas las animaciones miran a la DERECHA.
const SHEET = {
  frameW: 232,
  frameH: 240,
  animations: {
    idle:  { row: 0,  frames: 7,  fps: 6,  loop: true },
    walk:  { row: 1,  frames: 8,  fps: 12, loop: true },
    play:  { row: 2,  frames: 11, fps: 15, loop: true },
    eat:   { row: 3,  frames: 8,  fps: 10, loop: true },
    sleep: { row: 4,  frames: 8,  fps: 5,  loop: true },
    happy: { row: 5,  frames: 4,  fps: 8,  loop: true },
    talk:  { row: 6,  frames: 6,  fps: 8,  loop: true },
    cool:  { row: 7,  frames: 6,  fps: 8,  loop: true },
    sad:   { row: 8,  frames: 6,  fps: 5,  loop: true },
    flap:  { row: 9,  frames: 6,  fps: 14, loop: true },
    drag:  { row: 10, frames: 6,  fps: 10, loop: true }
  }
};

// Estado lógico → animación del sheet.
const STATE_ANIM = {
  idle: 'idle', walk: 'walk', sleep: 'sleep', happy: 'happy', sad: 'sad',
  eat: 'eat', play: 'play', talk: 'talk', cool: 'cool',
  drag: 'drag', fall: 'flap'
};

const CANON_DIR = 1; // el arte mira a la derecha

export class Duck {
  constructor(root, canvas, groundOffset = 0, skinId = 'normal') {
    this.skinId = skinId;
    this.el = root;              // #duck
    this.canvas = canvas;        // #duckCanvas
    this.x = 200;
    this.ground = groundOffset;  // altura del suelo desde el borde inferior
    this.y = groundOffset;
    this.facing = 1;             // 1 derecha (canónico), -1 izquierda
    this.tilt = 0;               // inclinación en grados (al volar)
    this.state = 'idle';
    this.width = this.el.offsetWidth || 96;
    this.height = this.el.offsetHeight || 104;
    this.animator = null;
    this.ready = false;

    this._loadSheet();
    this._apply();
  }

  _loadSheet() {
    const img = new Image();
    img.onload = () => {
      const sheet = { image: img, frameW: SHEET.frameW, frameH: SHEET.frameH, animations: SHEET.animations };
      if (this.animator) this.animator.stop();
      this.animator = new SpriteAnimator(this.canvas, sheet);
      this.ready = true;
      this.animator.play(STATE_ANIM[this.state] || 'idle');
    };
    img.onerror = () => {
      console.warn(`[duck] no se pudo cargar el diseño "${this.skinId}"; usando emoji`);
      this._emojiFallback();
    };
    // Ruta relativa al documento (src/renderer/index.html).
    img.src = `../../assets/sprites/duck-${this.skinId}.png`;
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

  setX(x) {
    const max = window.innerWidth - this.width;
    this.x = Math.max(0, Math.min(max, x));
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
    if (this.ready && this.animator) this.animator.play(STATE_ANIM[state]);
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
