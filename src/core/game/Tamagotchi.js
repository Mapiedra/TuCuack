// Tamagotchi — modelo de necesidades del pato.
// Stats 0..100 donde MÁS = MEJOR (hunger 100 = saciado, energy 100 = descansado).

const DECAY = {          // caída por segundo en estado normal
  hunger: 0.055,
  energy: 0.035,
  hygiene: 0.028,
  happiness: 0.045
};
const SLEEP_ENERGY_REGEN = 0.6;   // energía recuperada por segundo durmiendo
const OFFLINE_CAP_SECONDS = 8 * 3600; // tope de decaimiento offline (8 h)

export class Tamagotchi {
  constructor(stats) {
    this.stats = { hunger: 80, energy: 80, hygiene: 80, happiness: 80, ...(stats || {}) };
    this.sleeping = false;
    this._listeners = { change: [], action: [] };
    this._lastActions = {};
  }

  on(evt, cb) { (this._listeners[evt] || (this._listeners[evt] = [])).push(cb); }
  _emit(evt, data) { (this._listeners[evt] || []).forEach((cb) => cb(data)); }

  setSleeping(v) { this.sleeping = !!v; }

  // Avance del tiempo (dt en segundos).
  tick(dt) {
    const s = this.stats;
    if (this.sleeping) {
      s.energy = clamp(s.energy + SLEEP_ENERGY_REGEN * dt);
      s.hunger = clamp(s.hunger - DECAY.hunger * 0.5 * dt);
      s.hygiene = clamp(s.hygiene - DECAY.hygiene * 0.5 * dt);
    } else {
      s.energy = clamp(s.energy - DECAY.energy * dt);
      s.hunger = clamp(s.hunger - DECAY.hunger * dt);
      s.hygiene = clamp(s.hygiene - DECAY.hygiene * dt);
    }
    // La felicidad cae más rápido si otras necesidades están bajas.
    let hapDecay = DECAY.happiness;
    if (s.hunger < 30 || s.hygiene < 30 || s.energy < 20) hapDecay *= 2.2;
    s.happiness = clamp(s.happiness - hapDecay * dt);
    this._emit('change', this.stats);
  }

  // Decaimiento por el tiempo que la app estuvo cerrada.
  applyOfflineDecay(savedAt) {
    if (!savedAt) return;
    const elapsed = Math.min((Date.now() - savedAt) / 1000, OFFLINE_CAP_SECONDS);
    if (elapsed <= 0) return;
    const s = this.stats;
    s.hunger = clamp(s.hunger - DECAY.hunger * elapsed);
    s.hygiene = clamp(s.hygiene - DECAY.hygiene * elapsed);
    s.happiness = clamp(s.happiness - DECAY.happiness * elapsed);
    // La energía se recupera algo estando "fuera" (como si descansara).
    s.energy = clamp(s.energy + DECAY.energy * elapsed * 0.4);
    this._emit('change', this.stats);
  }

  _cooldown(name, ms) {
    const now = Date.now();
    if (this._lastActions[name] && now - this._lastActions[name] < ms) return false;
    this._lastActions[name] = now;
    return true;
  }

  feed() {
    if (!this._cooldown('feed', 800)) return false;
    this.stats.hunger = clamp(this.stats.hunger + 32);
    this.stats.happiness = clamp(this.stats.happiness + 4);
    this._emit('action', 'eat');
    this._emit('change', this.stats);
    return true;
  }

  play() {
    if (!this._cooldown('play', 800)) return false;
    this.stats.happiness = clamp(this.stats.happiness + 28);
    this.stats.energy = clamp(this.stats.energy - 10);
    this.stats.hunger = clamp(this.stats.hunger - 6);
    this._emit('action', 'play');
    this._emit('change', this.stats);
    return true;
  }

  /**
   * Manda al pato a dormir o lo despierta. A diferencia de las demás acciones
   * no es puntual: mientras duerme recupera energía (ver `tick`).
   */
  toggleSleep() {
    if (!this._cooldown('sleep', 600)) return false;
    this.setSleeping(!this.sleeping);
    this._emit('action', this.sleeping ? 'sleep' : 'wake');
    this._emit('change', this.stats);
    return true;
  }

  clean() {
    if (!this._cooldown('clean', 800)) return false;
    this.stats.hygiene = clamp(this.stats.hygiene + 45);
    this.stats.happiness = clamp(this.stats.happiness + 4);
    this._emit('action', 'happy');
    this._emit('change', this.stats);
    return true;
  }

  mood() {
    const s = this.stats;
    if (s.energy < 22) return 'cansado';
    if (Math.min(s.hunger, s.hygiene, s.happiness) < 20) return 'triste';
    if (s.hunger < 35) return 'hambriento';
    if (s.hygiene < 35) return 'sucio';
    if (s.happiness < 35) return 'aburrido';
    return 'contento';
  }

  toJSON() {
    return { stats: this.stats };
  }
}

function clamp(v) {
  return Math.max(0, Math.min(100, v));
}
