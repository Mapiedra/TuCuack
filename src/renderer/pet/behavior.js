// Behavior — IA autónoma del pato: decide caminar / estar quieto / dormir /
// entristecerse según el ánimo del Tamagotchi, y mueve al pato por el overlay.

export class Behavior {
  constructor(duck, tam) {
    this.duck = duck;
    this.tam = tam;
    this.activity = 'idle';
    this.timeLeft = 1.2;
    this.speed = 46;          // px/s
    this.locked = false;      // control externo (arrastre)
    this.override = null;     // acción manual temporal (comer/jugar)
  }

  lock() { this.locked = true; this.duck.setState('drag'); }
  unlock() { this.locked = false; this.override = null; this._startIdle(0.4); }

  // Reproduce un estado durante `dur` segundos y luego vuelve al ciclo normal.
  playOnce(state, dur) {
    this.tam.setSleeping(false);
    this.override = { state, timeLeft: dur };
    this.duck.setState(state);
  }

  update(dt) {
    if (this.override) {
      this.override.timeLeft -= dt;
      if (this.override.timeLeft <= 0) { this.override = null; this._startIdle(0.3); }
      else return;
    }
    if (this.locked) return;

    this.timeLeft -= dt;
    if (this.timeLeft <= 0) this._decide();
    this._act(dt);
  }

  /** Fuerza una decisión inmediata (p. ej. tras mandarlo a dormir a mano). */
  refresh() { this.timeLeft = 0; this.override = null; }

  _decide() {
    const mood = this.tam.mood();

    // Si ya está durmiendo (por cansancio o porque se lo han mandado), sigue
    // durmiendo hasta reponerse; no se le despierta a mitad.
    if (this.tam.sleeping) {
      if (this.tam.stats.energy < 96) {
        this.activity = 'sleep';
        this.timeLeft = 3 + Math.random() * 3;
        this.duck.setState('sleep');
        return;
      }
      this.tam.setSleeping(false);
    }

    if (this.tam.stats.energy < 22 || mood === 'cansado') {
      this.activity = 'sleep';
      this.timeLeft = 6 + Math.random() * 6;
      this.tam.setSleeping(true);
      this.duck.setState('sleep');
      return;
    }

    if (mood === 'triste') {
      this.activity = 'sad';
      this.timeLeft = 3 + Math.random() * 3;
      this.duck.setState('sad');
      return;
    }

    if (Math.random() < 0.55) {
      this.activity = 'walk';
      this.timeLeft = 2 + Math.random() * 4;
      if (Math.random() < 0.5) this.duck.setFacing(-this.duck.facing);
      this.duck.setState('walk');
    } else {
      this.activity = 'idle';
      this.timeLeft = 2 + Math.random() * 3;
      this.duck.setState('idle');
    }
  }

  _act(dt) {
    if (this.activity !== 'walk') return;
    let nx = this.duck.x + this.duck.facing * this.speed * dt;
    const max = window.innerWidth - this.duck.width;
    if (nx <= 0) { nx = 0; this.duck.setFacing(1); }
    else if (nx >= max) { nx = max; this.duck.setFacing(-1); }
    this.duck.setX(nx);
  }

  _startIdle(t) {
    this.activity = 'idle';
    this.timeLeft = t;
    this.duck.setState('idle');
  }
}
