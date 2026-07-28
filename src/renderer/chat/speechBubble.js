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

  /**
   * Aparta el globo si se saldría por un lado de la pantalla (pasa cuando el
   * pato anda cerca del borde) y desplaza la punta al revés, para que siga
   * señalándole.
   */
  _encajarEnPantalla(el, margen = 8) {
    // Se calcula a partir del ancho SIN transformar y del centro de la capa (que
    // sigue al pato): el rect del globo no sirve, porque mientras dura la
    // animación de entrada viene escalado y las medidas salen cortas.
    const centro = this.layer.getBoundingClientRect().left;
    const w = el.offsetWidth;
    const izq = centro - w / 2;
    const der = izq + w;

    let dx = 0;
    if (izq < margen) dx = margen - izq;
    else if (der > window.innerWidth - margen) dx = window.innerWidth - margen - der;
    if (!dx) return;

    // La punta no puede salirse del globo: se deja dentro, con holgura.
    const tope = Math.max(0, w / 2 - 16);
    el.style.setProperty('--dx', `${Math.round(dx)}px`);
    el.style.setProperty('--punta-x', `${Math.round(Math.max(-tope, Math.min(tope, -dx)))}px`);
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
    this._encajarEnPantalla(el);

    const dur = Math.min(7000, 2200 + text.length * 45);
    setTimeout(() => {
      el.remove();
      this._next();
    }, dur);
  }
}
