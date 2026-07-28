// Experiencia y niveles.
//
// La idea es premiar MANTENER al pato bien, no hacer clic mucho: el grueso de
// la experiencia viene de tenerlo contento con el tiempo, y las acciones sólo
// puntúan cuando de verdad hacían falta.

// XP necesaria para alcanzar el nivel N (acumulada desde 0).
const BASE = 100;
const EXP = 1.4;

export const XP = {
  CUIDADO: 10,        // atender una necesidad que estaba baja
  CONVIVENCIA: 1,     // por minuto con el pato contento
  RACHA: 50,          // primera atención del día
  CHAT: 5             // por mensaje enviado (con tope diario)
};

const CHAT_TOPE_DIARIO = 10;   // mensajes que puntúan por día
const UMBRAL_CUIDADO = 50;     // por debajo de esto, atender da XP

// Rangos: cada uno abarca 5 niveles.
export const RANGOS = [
  { desde: 1, nombre: 'Patito' },
  { desde: 5, nombre: 'Pato' },
  { desde: 10, nombre: 'Pato duro' },
  { desde: 15, nombre: 'Matón' },
  { desde: 20, nombre: 'Leyenda' }
];

export function xpParaNivel(n) {
  if (n <= 1) return 0;
  return Math.round(BASE * Math.pow(n - 1, EXP));
}

export function nivelDesdeXp(xp) {
  let n = 1;
  while (n < 99 && xp >= xpParaNivel(n + 1)) n++;
  return n;
}

export function rangoDe(nivel) {
  let r = RANGOS[0].nombre;
  for (const x of RANGOS) if (nivel >= x.desde) r = x.nombre;
  return r;
}

export class Level {
  /**
   * @param {{xp?:number, racha?:number, ultimoDia?:string, chatHoy?:number}} guardado
   */
  constructor(guardado) {
    const g = guardado || {};
    this.xp = Number(g.xp) || 0;
    this.racha = Number(g.racha) || 0;
    this.ultimoDia = g.ultimoDia || '';      // último día que se atendió al pato
    this.diaDelChat = g.diaDelChat || '';    // último día que se contaron mensajes
    this.chatHoy = Number(g.chatHoy) || 0;
    this._acumuladoMin = 0;
    this._listeners = { xp: [], nivel: [] };
  }

  on(evt, cb) { (this._listeners[evt] || (this._listeners[evt] = [])).push(cb); }
  _emit(evt, data) { (this._listeners[evt] || []).forEach((cb) => cb(data)); }

  get nivel() { return nivelDesdeXp(this.xp); }
  get rango() { return rangoDe(this.nivel); }

  /** Progreso dentro del nivel actual, de 0 a 1. */
  get progreso() {
    const n = this.nivel;
    const desde = xpParaNivel(n);
    const hasta = xpParaNivel(n + 1);
    if (hasta <= desde) return 1;
    return Math.max(0, Math.min(1, (this.xp - desde) / (hasta - desde)));
  }

  get xpNivelActual() { return this.xp - xpParaNivel(this.nivel); }
  get xpNivelSiguiente() { return xpParaNivel(this.nivel + 1) - xpParaNivel(this.nivel); }

  _sumar(cantidad, motivo) {
    if (cantidad <= 0) return;
    const antes = this.nivel;
    this.xp += cantidad;
    this._emit('xp', { cantidad, motivo, xp: this.xp });
    const ahora = this.nivel;
    if (ahora > antes) this._emit('nivel', { nivel: ahora, rango: this.rango });
  }

  /**
   * Atender una necesidad. Sólo puntúa si estaba baja de verdad: si no, bastaría
   * con machacar el botón para subir de nivel.
   */
  cuidado(valorPrevio) {
    if (valorPrevio >= UMBRAL_CUIDADO) return false;
    this._sumar(XP.CUIDADO, 'cuidado');
    this._rachaDelDia();
    return true;
  }

  /**
   * Tiempo de convivencia. Sólo cuenta con el pato contento y con la app
   * abierta: si contara el tiempo offline, se subiría de nivel con el ordenador
   * apagado.
   */
  convivencia(segundos, contento) {
    if (!contento) return;
    this._acumuladoMin += segundos / 60;
    if (this._acumuladoMin >= 1) {
      const minutos = Math.floor(this._acumuladoMin);
      this._acumuladoMin -= minutos;
      this._sumar(minutos * XP.CONVIVENCIA, 'convivencia');
    }
  }

  chat() {
    this._nuevoDia();
    if (this.chatHoy >= CHAT_TOPE_DIARIO) return false;
    this.chatHoy++;
    this._sumar(XP.CHAT, 'chat');
    return true;
  }

  /** Pone a cero el contador de mensajes cuando cambia el día. */
  _nuevoDia() {
    const hoy = new Date().toISOString().slice(0, 10);
    if (this.diaDelChat === hoy) return false;
    // Se lleva aparte del día de la racha: ese sólo se marca al atender al
    // pato, así que quien únicamente chatea nunca lo actualizaba y el contador
    // se reiniciaba en cada mensaje, dejando la experiencia por chat sin tope.
    this.diaDelChat = hoy;
    this.chatHoy = 0;
    return true;
  }

  _rachaDelDia() {
    const hoy = new Date().toISOString().slice(0, 10);
    if (this.ultimoDia === hoy) return;
    // Días seguidos suman racha; un hueco la reinicia.
    const ayer = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    this.racha = this.ultimoDia === ayer ? this.racha + 1 : 1;
    this.ultimoDia = hoy;
    this._sumar(XP.RACHA + Math.min(this.racha - 1, 5) * 10, 'racha');
  }

  toJSON() {
    return {
      xp: this.xp, racha: this.racha,
      ultimoDia: this.ultimoDia,
      diaDelChat: this.diaDelChat, chatHoy: this.chatHoy
    };
  }
}
