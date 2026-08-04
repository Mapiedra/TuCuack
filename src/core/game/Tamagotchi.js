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

/**
 * Agotamiento: al quedarse sin energía el pato cae rendido y ya no hay quien lo
 * espabile hasta que repone un mínimo. Mientras dure no acepta cuidados ni se le
 * puede despertar: duerme y punto.
 *
 * El umbral de vuelta no es 0 a propósito. Si despertara en cuanto la energía
 * subiera de cero, volvería a desplomarse a los pocos segundos y el pato se
 * pasaría el rato entrando y saliendo del sueño.
 */
export const AGOTAMIENTO = {
  CAE: 0,         // energía a la que se desploma
  // Energía a la que vuelve a estar disponible. Es también el punto por debajo
  // del cual tiene sueño (ánimo "cansado"): si fueran dos números distintos, al
  // despertarlo justo al reponerse volvería a dormirse en el acto por cansado.
  DESPIERTA: 20
};

export class Tamagotchi {
  constructor(stats) {
    this.stats = { hunger: 80, energy: 80, hygiene: 80, happiness: 80, ...(stats || {}) };
    this.sleeping = false;
    this._listeners = { change: [], action: [] };
    this._lastActions = {};
    // Un pato que se guardó sin energía sigue agotado al volver a abrir la app.
    this._agotado = this.stats.energy <= AGOTAMIENTO.CAE;
    if (this._agotado) this.sleeping = true;
  }

  on(evt, cb) { (this._listeners[evt] || (this._listeners[evt] = [])).push(cb); }
  /** Deja de escuchar. Lo usan los paneles al cerrarse, que van y vienen. */
  off(evt, cb) {
    const lista = this._listeners[evt];
    if (lista) this._listeners[evt] = lista.filter((f) => f !== cb);
  }
  _emit(evt, data) { (this._listeners[evt] || []).forEach((cb) => cb(data)); }

  /** ¿Está fuera de combate por falta de energía? */
  get agotado() { return this._agotado; }

  setSleeping(v) {
    // Agotado no se despierta: la única salida es dormir hasta reponerse.
    this.sleeping = this._agotado ? true : !!v;
  }

  /**
   * Revisa si el pato entra o sale del agotamiento. Se llama después de tocar
   * la energía, y devuelve si el estado ha cambiado.
   */
  _revisarAgotamiento() {
    const antes = this._agotado;
    if (this._agotado) {
      if (this.stats.energy >= AGOTAMIENTO.DESPIERTA) this._agotado = false;
    } else if (this.stats.energy <= AGOTAMIENTO.CAE) {
      this._agotado = true;
    }
    if (this._agotado) this.sleeping = true;   // se duerme solo y sigue dormido
    return antes !== this._agotado;
  }

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
    // Al desplomarse se avisa como si le hubieran mandado dormir, para que el
    // pato se acueste en el acto en vez de esperar a su siguiente decisión.
    if (this._revisarAgotamiento() && this._agotado) this._emit('action', 'sleep');
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
    this._revisarAgotamiento();
    this._emit('change', this.stats);
  }

  _cooldown(name, ms) {
    const now = Date.now();
    if (this._lastActions[name] && now - this._lastActions[name] < ms) return false;
    this._lastActions[name] = now;
    return true;
  }

  feed() {
    if (this._agotado || !this._cooldown('feed', 800)) return false;
    this.stats.hunger = clamp(this.stats.hunger + 32);
    this.stats.happiness = clamp(this.stats.happiness + 4);
    this._emit('action', 'eat');
    this._emit('change', this.stats);
    return true;
  }

  play() {
    if (this._agotado || !this._cooldown('play', 800)) return false;
    this.stats.happiness = clamp(this.stats.happiness + 28);
    this.stats.energy = clamp(this.stats.energy - 10);
    this.stats.hunger = clamp(this.stats.hunger - 6);
    // Jugar gasta energía: puede ser justo lo que lo deje seco.
    if (this._revisarAgotamiento() && this._agotado) {
      this._emit('action', 'sleep');
      this._emit('change', this.stats);
      return true;
    }
    this._emit('action', 'play');
    this._emit('change', this.stats);
    return true;
  }

  /**
   * Manda al pato a dormir o lo despierta. A diferencia de las demás acciones
   * no es puntual: mientras duerme recupera energía (ver `tick`).
   */
  toggleSleep() {
    if (this._agotado || !this._cooldown('sleep', 600)) return false;
    this.setSleeping(!this.sleeping);
    this._emit('action', this.sleeping ? 'sleep' : 'wake');
    this._emit('change', this.stats);
    return true;
  }

  clean() {
    if (this._agotado || !this._cooldown('clean', 800)) return false;
    this.stats.hygiene = clamp(this.stats.hygiene + 45);
    this.stats.happiness = clamp(this.stats.happiness + 4);
    this._emit('action', 'happy');
    this._emit('change', this.stats);
    return true;
  }

  mood() {
    const s = this.stats;
    if (this._agotado) return 'agotado';
    if (s.energy < AGOTAMIENTO.DESPIERTA) return 'cansado';
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
