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
  CHAT: 5,            // por mensaje enviado (con tope diario)
  PARTIDA: 4,         // terminar un minijuego, se gane o no (con tope diario)
  VICTORIA: 8         // extra por ganarlo; el empate se lleva la mitad
};

const CHAT_TOPE_DIARIO = 10;   // mensajes que puntúan por día
// Partidas que puntúan por día. Un minijuego se puede repetir en bucle, así que
// sin tope sería, con diferencia, la forma más rápida de subir de nivel. Pasado
// el tope se sigue jugando —que es lo divertido—, pero deja de sumar.
export const JUEGOS_TOPE_DIARIO = 8;
const UMBRAL_CUIDADO = 50;     // por debajo de esto, atender da XP

// Rangos: cada uno abarca 5 niveles.
//
// La lista NO tiene techo de diseño: se alarga cuando la escalera de juegos
// llega más arriba, que es una línea. Llegó a acabarse en «Leyenda» al 20 —el
// techo de cuando lo único que se desbloqueaba eran diseños— y con la escalera
// pasando de ahí, media partida no cambiaba de rango ni una vez. El rango es lo
// único que se ve en la cabecera del panel de cuidados y en el aviso de subir de
// nivel, así que conviene que llegue siempre un poco más allá que el último
// juego.
export const RANGOS = [
  { desde: 1, nombre: 'Patito' },
  { desde: 5, nombre: 'Pato' },
  { desde: 10, nombre: 'Pato duro' },
  { desde: 15, nombre: 'Matón' },
  { desde: 20, nombre: 'Leyenda' },
  { desde: 25, nombre: 'Capo' },
  { desde: 30, nombre: 'Padrino' },
  { desde: 35, nombre: 'Intocable' },
  { desde: 40, nombre: 'Jefe de jefes' },
  { desde: 45, nombre: 'Mito' },
  { desde: 50, nombre: 'Cuack supremo' },
  { desde: 55, nombre: 'Cuack imperial' },
  { desde: 60, nombre: 'Reliquia' },
  { desde: 65, nombre: 'Ancestro' },
  { desde: 70, nombre: 'Cuack eterno' }
];

export function xpParaNivel(n) {
  if (n <= 1) return 0;
  return Math.round(BASE * Math.pow(n - 1, EXP));
}

/**
 * Tope técnico, no de diseño.
 *
 * La escalera de juegos no tiene techo: cada juego nuevo se coloca por encima
 * del anterior y los niveles se amplían con él. Esto sólo está para que el bucle
 * no pueda irse a infinito con una XP absurda; queda tan por encima de cualquier
 * partida real que nadie lo va a ver.
 */
const NIVEL_MAXIMO = 999;

export function nivelDesdeXp(xp) {
  let n = 1;
  while (n < NIVEL_MAXIMO && xp >= xpParaNivel(n + 1)) n++;
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
    this.diaDelJuego = g.diaDelJuego || '';  // último día que se contaron partidas
    this.juegosHoy = Number(g.juegosHoy) || 0;
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
    if (!this._cabeHoy('diaDelChat', 'chatHoy', CHAT_TOPE_DIARIO)) return false;
    this.chatHoy++;
    this._sumar(XP.CHAT, 'chat');
    return true;
  }

  /**
   * Partida de minijuego terminada.
   *
   * Devuelve la XP concedida —y no un booleano como `chat()`— porque el pie de
   * la partida la enseña: un "+12 XP" explica el sistema mejor que cualquier
   * ayuda, y un 0 con su motivo evita que el tope parezca un fallo.
   *
   * Abandonar no llega hasta aquí: cerrar el panel no es un resultado.
   *
   * No toca la racha a propósito. `_rachaDelDia` premia atender al pato, y
   * jugar con él no es cuidarlo.
   *
   * @param {'victoria'|'derrota'|'empate'} resultado
   * @returns {number} XP concedida, o 0 si ya se llegó al tope del día
   */
  minijuego(resultado) {
    if (!this._cabeHoy('diaDelJuego', 'juegosHoy', JUEGOS_TOPE_DIARIO)) return 0;
    this.juegosHoy++;
    const extra = resultado === 'victoria' ? XP.VICTORIA
      : resultado === 'empate' ? Math.round(XP.VICTORIA / 2)
        : 0;
    const total = XP.PARTIDA + extra;
    this._sumar(total, 'minijuego');
    return total;
  }

  /**
   * Contador diario con tope: pone el contador a cero si ha cambiado el día y
   * dice si aún queda cupo.
   *
   * Cada fuente lleva SU propio día. Compartir uno solo fue el fallo que hubo
   * que arreglar con el chat: el día de la racha sólo se marca al atender al
   * pato, así que quien únicamente chateaba no lo actualizaba nunca, el
   * contador se reiniciaba en cada mensaje y la experiencia por chat se quedaba
   * sin tope.
   *
   * @param {'diaDelChat'|'diaDelJuego'} campoDia
   * @param {'chatHoy'|'juegosHoy'} campoContador
   * @param {number} tope
   * @returns {boolean} si aún queda cupo hoy
   */
  _cabeHoy(campoDia, campoContador, tope) {
    const hoy = new Date().toISOString().slice(0, 10);
    if (this[campoDia] !== hoy) {
      this[campoDia] = hoy;
      this[campoContador] = 0;
    }
    return this[campoContador] < tope;
  }

  /**
   * Cuántas partidas han puntuado HOY, de las que caben.
   *
   * Se mira el día en vez de devolver el contador a secas: `juegosHoy` se pone a
   * cero al anotar la primera partida del día, no a medianoche, así que un
   * contador leído sin más diría «8 de 8» a alguien que acaba de empezar la
   * mañana. Esto sólo lee: no toca nada, que es lo que se espera de una
   * consulta que hace un panel al abrirse.
   */
  partidasQuePuntuanHoy() {
    const hoy = new Date().toISOString().slice(0, 10);
    return this.diaDelJuego === hoy ? Math.min(this.juegosHoy, JUEGOS_TOPE_DIARIO) : 0;
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
      diaDelChat: this.diaDelChat, chatHoy: this.chatHoy,
      diaDelJuego: this.diaDelJuego, juegosHoy: this.juegosHoy
    };
  }
}
