// SpriteAnimator — reproductor de frames desacoplado del arte.
//
// Versión actual (placeholder): las animaciones de estado se resuelven por CSS
// a partir de `data-state` (ver styles.css), así que el pato funciona sin arte.
//
// Cuando existan sprite sheets reales, se activa la ruta de <canvas>: pásale una
// definición { image, frameW, frameH, animations: { walk: {row, frames, fps} } }
// y este módulo dibuja el frame correspondiente. Duck.js decide qué ruta usar.

export class SpriteAnimator {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ image: HTMLImageElement, frameW: number, frameH: number,
   *           animations: Record<string, {row:number, frames:number, fps:number, loop?:boolean}> }} sheet
   */
  constructor(canvas, sheet) {
    // willReadFrequently: el hit-test lee un píxel en cada mousemove.
    this.ctx = canvas.getContext('2d', { willReadFrequently: true });
    this.canvas = canvas;
    this.sheet = sheet;
    this.current = null;
    this.frame = 0;
    this.acc = 0;
    this.last = 0;
    this.raf = null;
  }

  play(name) {
    if (this.current === name) return;
    this.current = name;
    this.frame = 0;
    this.acc = 0;
    if (!this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame((t) => this._loop(t));
    }
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.current = null;
  }

  _loop(t) {
    const anim = this.sheet.animations[this.current];
    if (!anim) { this.raf = null; return; }
    const dt = (t - this.last) / 1000;
    this.last = t;
    this.acc += dt;
    const frameDur = 1 / anim.fps;
    while (this.acc >= frameDur) {
      this.acc -= frameDur;
      this.frame++;
      if (this.frame >= anim.frames) {
        this.frame = anim.loop === false ? anim.frames - 1 : 0;
      }
    }
    this._draw(anim);
    this.raf = requestAnimationFrame((tt) => this._loop(tt));
  }

  _draw(anim) {
    const { image, frameW, frameH } = this.sheet;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(
      image,
      this.frame * frameW, anim.row * frameH, frameW, frameH,
      0, 0, this.canvas.width, this.canvas.height
    );
  }
}
