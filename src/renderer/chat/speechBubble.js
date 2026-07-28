// Bocadillo de cómic sobre el pato. Encola mensajes y los muestra por turnos.

export class SpeechBubbles {
  constructor(layer) {
    this.layer = layer;
    this.queue = [];
    this.active = false;
  }

  show(from, text, { self = false } = {}) {
    this.queue.push({ from, text, self });
    if (!this.active) this._next();
  }

  _next() {
    if (!this.queue.length) { this.active = false; return; }
    this.active = true;
    const { from, text, self } = this.queue.shift();

    const el = document.createElement('div');
    el.className = 'speech';
    if (!self && from) {
      const f = document.createElement('span');
      f.className = 'from';
      f.textContent = from;           // textContent evita inyección
      el.appendChild(f);
    }
    el.appendChild(document.createTextNode(text));
    this.layer.appendChild(el);

    const dur = Math.min(7000, 2200 + text.length * 45);
    setTimeout(() => {
      el.remove();
      this._next();
    }, dur);
  }
}
