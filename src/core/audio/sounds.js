// Sonidos del pato, sintetizados con Web Audio.
//
// Se generan por código en vez de cargar ficheros: pesan cero, no dependen de
// audio de terceros y se pueden afinar cambiando números.
//
// Todo pasa por un volumen general que se puede bajar o silenciar desde
// Ajustes, y hay un límite de repetición para que una ráfaga de mensajes no se
// convierta en una tortura.

let ctx = null;
let master = null;
let volumen = 0.5;
let silenciado = false;
const ultimaVez = {};

/** El contexto se crea perezosamente: antes de interactuar no hace falta. */
function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = silenciado ? 0 : volumen;
    master.connect(ctx.destination);
  }
  // Si el navegador lo suspendió (sin interacción previa), se reanuda.
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function setVolumen(v) {
  volumen = Math.max(0, Math.min(1, Number(v) || 0));
  if (master) master.gain.value = silenciado ? 0 : volumen;
}

export function setSilenciado(v) {
  silenciado = !!v;
  if (master) master.gain.value = silenciado ? 0 : volumen;
}

export function estaSilenciado() { return silenciado; }
export function getVolumen() { return volumen; }

/** Evita que un mismo sonido se dispare en ráfaga. */
function puedeSonar(nombre, msMinimo) {
  const ahora = performance.now();
  if (ultimaVez[nombre] && ahora - ultimaVez[nombre] < msMinimo) return false;
  ultimaVez[nombre] = ahora;
  return true;
}

/** Ruido blanco reutilizable, para el aleteo. */
let bufferRuido = null;
function ruido(c) {
  if (!bufferRuido) {
    const n = c.sampleRate * 0.4;
    bufferRuido = c.createBuffer(1, n, c.sampleRate);
    const d = bufferRuido.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }
  return bufferRuido;
}

/**
 * Cuack. Un graznido real tiene mucho armónico y una resonancia que cae, así
 * que se usa una onda de sierra con el tono bajando y un filtro de banda que
 * barre: eso es lo que le da el "aaa" nasal del pato.
 */
export function cuack({ agudo = 1 } = {}) {
  const c = audio();
  if (!c || !puedeSonar('cuack', 120)) return;
  grafoCuack(c, master, c.currentTime, agudo);
}

/** El grafo, aparte del disparo, para poder renderizarlo y medirlo. */
export function grafoCuack(c, destino, t, agudo = 1) {
  const dur = 0.19;

  const osc = c.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(360 * agudo, t);
  osc.frequency.exponentialRampToValueAtTime(190 * agudo, t + dur);

  // Vibrato rápido: sin él suena a pitido, no a bicho.
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = 42;
  lfoGain.gain.value = 28 * agudo;
  lfo.connect(lfoGain).connect(osc.frequency);

  const filtro = c.createBiquadFilter();
  filtro.type = 'bandpass';
  filtro.Q.value = 4.5;
  filtro.frequency.setValueAtTime(1500 * agudo, t);
  filtro.frequency.exponentialRampToValueAtTime(700 * agudo, t + dur);

  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(1.3, t + 0.015);   // el bandpass atenúa mucho
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  osc.connect(filtro).connect(g).connect(destino);
  osc.start(t); lfo.start(t);
  osc.stop(t + dur); lfo.stop(t + dur);
  return dur;
}

/**
 * Boing del rebote. El tono cae en picado y luego oscila, que es lo que da la
 * sensación de muelle; `fuerza` (0..1) lo hace más agudo y más largo.
 */
export function boing(fuerza = 1) {
  const c = audio();
  if (!c || !puedeSonar('boing', 90)) return;
  grafoBoing(c, master, c.currentTime, fuerza);
}

export function grafoBoing(c, destino, t, fuerza = 1) {
  const f = Math.max(0.15, Math.min(1, fuerza));
  const dur = 0.16 + 0.14 * f;

  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(180 + 480 * f, t);
  osc.frequency.exponentialRampToValueAtTime(70, t + dur);

  // El wobble del muelle.
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = 16;
  lfoGain.gain.value = 55 * f;
  lfo.connect(lfoGain).connect(osc.frequency);

  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.35 * (0.4 + 0.6 * f), t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  osc.connect(g).connect(destino);
  osc.start(t); lfo.start(t);
  osc.stop(t + dur); lfo.stop(t + dur);
  return dur;
}

/**
 * Aleteo: ráfagas cortas de ruido filtrado, una por batida de ala. Se llama
 * mientras el pato planea, y el propio límite de repetición marca el ritmo.
 */
export function aleteo() {
  const c = audio();
  if (!c || !puedeSonar('aleteo', 150)) return;
  grafoAleteo(c, master, c.currentTime);
}

export function grafoAleteo(c, destino, t) {
  const dur = 0.13;

  const src = c.createBufferSource();
  src.buffer = ruido(c);
  src.loop = true;

  const filtro = c.createBiquadFilter();
  filtro.type = 'bandpass';
  filtro.Q.value = 1.1;
  // El barrido hacia abajo imita el golpe de aire de la batida.
  filtro.frequency.setValueAtTime(900, t);
  filtro.frequency.exponentialRampToValueAtTime(320, t + dur);

  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.55, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  src.connect(filtro).connect(g).connect(destino);
  src.start(t);
  src.stop(t + dur);
  return dur;
}

/** Dos cuacks encadenados: para cuando sube de nivel. */
export function fanfarria() {
  const c = audio();
  if (!c) return;
  cuack({ agudo: 1 });
  setTimeout(() => { ultimaVez.cuack = 0; cuack({ agudo: 1.25 }); }, 140);
}

// ---- Minijuegos ---------------------------------------------------------
//
// Los dispara el marco de partida, así que cualquier juego nuevo los tiene sin
// pedirlos. Un juego puede además usar `nota` para lo suyo.

/**
 * Una nota suelta. Es el ladrillo de los sonidos de los juegos: lo que necesita
 * un Simón —cada color, una nota, y siempre la misma— y lo que compone la
 * victoria y la derrota.
 *
 * No lleva límite de repetición: quien la usa como instrumento la quiere
 * cuando la pide. Los sonidos de más arriba sí lo llevan porque los dispara la
 * física y podrían salir en ráfaga.
 */
export function nota(hz, dur = 0.14, tipo = 'triangle') {
  const c = audio();
  if (!c) return;
  grafoNota(c, master, c.currentTime, hz, dur, tipo);
}

export function grafoNota(c, destino, t, hz, dur = 0.14, tipo = 'triangle') {
  const osc = c.createOscillator();
  osc.type = tipo;
  osc.frequency.setValueAtTime(hz, t);

  const g = c.createGain();
  // Ataque corto y caída suave: sin la rampa de entrada, cada nota empieza con
  // un chasquido.
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.3, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  osc.connect(g).connect(destino);
  osc.start(t);
  osc.stop(t + dur);
  return dur;
}

/** Empieza la partida: dos notas subiendo, cortitas. */
export function empezarPartida() {
  const c = audio();
  if (!c || !puedeSonar('empezarPartida', 300)) return;
  grafoEmpezarPartida(c, master, c.currentTime);
}

export function grafoEmpezarPartida(c, destino, t) {
  grafoNota(c, destino, t, 520, 0.1);
  grafoNota(c, destino, t + 0.1, 780, 0.13);
  return 0.23;
}

/**
 * Victoria: arpegio ascendente y un cuack contento al final.
 *
 * Es distinto de `fanfarria`, que es de subir de nivel: ganar una partida está
 * bien, pero no es lo mismo, y confundirlos abarataría la subida de nivel.
 */
export function victoria() {
  const c = audio();
  if (!c || !puedeSonar('victoria', 600)) return;
  grafoVictoria(c, master, c.currentTime);
}

export function grafoVictoria(c, destino, t) {
  grafoNota(c, destino, t, 523, 0.12);
  grafoNota(c, destino, t + 0.11, 659, 0.12);
  grafoNota(c, destino, t + 0.22, 784, 0.18);
  grafoCuack(c, destino, t + 0.36, 1.15);
  return 0.55;
}

/** Derrota: dos notas cayendo. Sin dramatismo: es un juego. */
export function derrota() {
  const c = audio();
  if (!c || !puedeSonar('derrota', 600)) return;
  grafoDerrota(c, master, c.currentTime);
}

export function grafoDerrota(c, destino, t) {
  grafoNota(c, destino, t, 392, 0.16, 'sine');
  grafoNota(c, destino, t + 0.15, 262, 0.24, 'sine');
  return 0.39;
}

/**
 * Te toca.
 *
 * Suena en cada cambio de turno, así que es lo más discreto del fichero y lo
 * que lleva el límite más largo: en una partida por red los turnos se suceden, y
 * un pitido por turno es una tortura.
 */
export function turno() {
  const c = audio();
  if (!c || !puedeSonar('turno', 500)) return;
  grafoTurno(c, master, c.currentTime);
}

export function grafoTurno(c, destino, t) {
  return grafoNota(c, destino, t, 660, 0.09);
}
