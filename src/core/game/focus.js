// Modo concentración — Pomodoro. Máquina de estados pura: no toca DOM ni IPC,
// solo lleva la cuenta de en qué fase está y cuánto queda. Quien la escucha
// (app.js) decide qué hacer con cada cambio: esconder al pato, avisar, etc.

export const FASE = {
  IDLE: 'idle',
  FOCUSING: 'focusing',
  SHORT_BREAK: 'shortBreak',
  LONG_BREAK: 'longBreak',
  AWAITING: 'awaitingResumeConfirmation'
};

export class FocusManager {
  /** @param {() => {work:number, shortBreak:number, longBreak:number, cyclesToLong:number}} getDuraciones minutos, leídos en cada transición para que un cambio en Ajustes se note en el siguiente tramo */
  constructor(getDuraciones) {
    this._getDuraciones = getDuraciones;
    this.fase = FASE.IDLE;
    this.cicloActual = 0;
    this.endsAt = 0;
    this._listeners = { fase: [], tick: [] };
  }

  on(evt, cb) { (this._listeners[evt] || (this._listeners[evt] = [])).push(cb); }
  off(evt, cb) {
    const lista = this._listeners[evt];
    if (lista) this._listeners[evt] = lista.filter((f) => f !== cb);
  }
  _emit(evt, data) { (this._listeners[evt] || []).forEach((cb) => cb(data)); }

  /** Mientras esto sea cierto no hace falta comer, limpiarse ni jugar, y el chat público calla. */
  get pausaNecesidades() {
    return this.fase === FASE.FOCUSING || this.fase === FASE.SHORT_BREAK || this.fase === FASE.LONG_BREAK;
  }

  _ir(fase, minutos, extra) {
    const anterior = this.fase;
    this.fase = fase;
    this.endsAt = minutos != null ? Date.now() + minutos * 60000 : 0;
    this._emit('fase', { fase, anterior, cicloActual: this.cicloActual, ...extra });
  }

  /** Empieza (o reanuda tras un descanso) un ciclo de concentración. */
  iniciar() {
    if (this.fase !== FASE.IDLE) return;
    this.cicloActual += 1;
    this._ir(FASE.FOCUSING, this._getDuraciones().work);
  }

  /** El descanso ha terminado y el usuario confirma que vuelve a concentrarse. */
  confirmarVolver() {
    if (this.fase !== FASE.AWAITING) return;
    this.cicloActual += 1;
    this._ir(FASE.FOCUSING, this._getDuraciones().work);
  }

  /** Corta el modo concentración desde cualquier fase, sea cual sea. */
  cancelar() {
    if (this.fase === FASE.IDLE) return;
    this.cicloActual = 0;
    this._ir(FASE.IDLE, null);
  }

  /** Un segundo más. No hace nada si está en reposo. */
  tick() {
    if (this.fase === FASE.IDLE) return;
    const remainingMs = Math.max(0, this.endsAt - Date.now());
    this._emit('tick', { fase: this.fase, remainingMs, cicloActual: this.cicloActual });
    if (remainingMs > 0) return;

    if (this.fase === FASE.FOCUSING) {
      const d = this._getDuraciones();
      const descansoLargo = this.cicloActual % d.cyclesToLong === 0;
      this._ir(descansoLargo ? FASE.LONG_BREAK : FASE.SHORT_BREAK,
        descansoLargo ? d.longBreak : d.shortBreak, { resumen: true });
    } else if (this.fase === FASE.SHORT_BREAK || this.fase === FASE.LONG_BREAK) {
      this._ir(FASE.AWAITING, null);
    }
  }
}
