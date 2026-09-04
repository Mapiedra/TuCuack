// La moneda: los cuacks.
//
// Se ganan jugando y se gastan en comprar juegos. La idea, en una frase: el
// nivel te ABRE un juego y los cuacks te lo COMPRAN, así que subir de nivel deja
// de ser lo único que hay que hacer.
//
// ---- Por qué paga lo que paga ---------------------------------------------
//
// El requisito de fondo era que no se pudiera comprar el juego más caro a base
// de machacar el más tonto contra la máquina. Eso se consigue con dos cosas:
//
//   1. **Lo que paga una partida sube con el nivel del juego.** Ganar al tres en
//      raya y ganar a The Hole no valen lo mismo, porque no cuestan lo mismo.
//
//   2. **Lo que limita cuánto se gana no es el reloj, es la mascota.** Cada
//      partida gasta diez de energía (`Tamagotchi.play`), así que de ochenta se
//      juegan ocho y a dormir. El cuello de botella son las PARTIDAS, no los
//      minutos —y por eso el pago va por partida y no por tiempo—. Si fuera por
//      tiempo, «piedra, papel o tijera» pagaría más por minuto que The Hole
//      sólo por durar quince segundos, que es justo lo contrario de lo que se
//      quiere.
//
// No hay tope diario de cuacks, y es a propósito: el tope ya lo pone el
// cansancio de la mascota, y dos frenos para lo mismo sólo sirven para que el
// segundo parezca un fallo. La experiencia sí lo lleva, porque ahí no hay nada
// más que la pare (ver Level.js).
//
// ---- Lo que YA se tenía no se cobra ---------------------------------------
//
// Todos los juegos llevan precio menos el de nivel 1 —que es la puerta—, pero
// **nadie paga por lo que ya había conseguido**: al estrenar el monedero se
// regalan de golpe todos los juegos que el nivel del pato ya tenía abiertos.
//
// Las dos cosas a la vez, y no es contradictorio: quien lleva meses jugando se
// queda exactamente como estaba, y quien entra hoy se los va comprando. La
// diferencia no es el juego, es CUÁNDO se abrió: lo que estaba abierto el día
// que apareció la moneda estaba conseguido, y eso no se quita.
//
// Ojo con la consecuencia, que es deliberada: los juegos que aún NO se habían
// abierto por nivel sí se pagan, también para quien ya venía jugando. Un juego
// que todavía no tenías no es tuyo, y ahí no se le quita nada a nadie.

/** El símbolo, en un solo sitio: sale en el panel, en el pie y en los carteles. */
export const CUACK = '🪙';

/**
 * Lo que vale una partida de un juego, antes de mirar cómo acabó.
 *
 * Lineal con el nivel y con un suelo, para que el primero pague algo: el nivel
 * es la medida de dificultad que ya usa el catálogo, y no hacía falta inventar
 * otra al lado que se quedara desfasada.
 */
export function valorDePartida(juego) {
  const nivel = juego && Number.isFinite(juego.nivel) ? juego.nivel : 1;
  return SUELO + nivel * POR_NIVEL;
}

const SUELO = 5;
const POR_NIVEL = 3;

/**
 * Cuánto multiplica cada final.
 *
 * Perder paga poco, pero paga: si no pagara nada, los juegos de marca —donde se
 * pierde casi siempre, porque «ganar» es batir tu récord— no darían nunca nada
 * y nadie los tocaría, que son justo los más caros de jugar.
 */
const POR_RESULTADO = { victoria: 1, empate: 0.6, derrota: 0.3 };

/**
 * Jugar contra otra mascota paga el doble.
 *
 * Contra la máquina se juega cuando uno quiere; contra otra persona hay que
 * cuadrar dos agendas, y encima no se puede amañar el resultado.
 */
const POR_RED = 2;

/**
 * Lo que se lleva una partida terminada.
 *
 * OJO con lo que significa «victoria» aquí: en los juegos de marca —The Hole,
 * el Runner, el Flappy— los propios juegos declaran victoria **sólo cuando se
 * bate el récord** (mira el `esRecord` de cualquiera de ellos). O sea que el
 * premio por batir tu marca no es un bonus aparte: ES el ×2 de ganar, y por eso
 * no se suma otro encima. Un solo multiplicador, sin dobles cuentas.
 *
 * @param {import('./minijuegos/index.js').Minijuego} juego
 * @param {'victoria'|'derrota'|'empate'} resultado
 * @param {{enRed?:boolean}} [opciones]
 * @returns {number} cuacks, siempre entero y siempre ≥ 1
 */
export function pagoDePartida(juego, resultado, opciones) {
  const mult = POR_RESULTADO[resultado] != null ? POR_RESULTADO[resultado] : POR_RESULTADO.derrota;
  const red = opciones && opciones.enRed ? POR_RED : 1;
  // Nunca cero: terminar una partida y que no caiga nada se lee como que algo
  // ha fallado, no como que no tocaba.
  return Math.max(1, Math.round(valorDePartida(juego) * mult * red));
}

/**
 * Lo que debería costar un juego que se desbloquea en tal nivel.
 *
 * Es una recomendación para quien añada el siguiente, no una ley: el precio
 * viaja en el descriptor. Está calibrado para que comprar el juego nuevo salga
 * por unas cuarenta partidas del último que tengas, y por bastantes más si te
 * empeñas en jugar a los de abajo. Redondeado a veinticinco, que un precio de
 * 1 237 no lo pone nadie.
 */
export function precioSugerido(nivel) {
  return Math.round((nivel * 45) / 25) * 25;
}

/** Lo que paga el peaje del «No tocar», si se pasa. Ver game/broma.js. */
export const BROMA_SUELO = 120;
export const BROMA_POR_NIVEL = 10;

/**
 * El premio de la broma, que sube con el nivel.
 *
 * Sube porque la broma no es más difícil para nadie —las diez cuentas son las
 * mismas— pero a un pato de nivel 40 le compensa menos que a uno de nivel 3, y
 * la gracia es que compense siempre lo justo para dudar.
 */
export function premioDeLaBroma(nivel) {
  return BROMA_SUELO + Math.max(0, Number(nivel) || 0) * BROMA_POR_NIVEL;
}

/**
 * El saldo con el que arranca quien ya venía jugando.
 *
 * Los juegos que ya tenía abiertos se le regalan (ver `Cartera`), así que esto
 * no es por lo de atrás: es para lo de delante. Un pato de nivel 10 va a
 * encontrarse con que los tres juegos que le quedan por abrir ahora se compran,
 * y llegar a ese punto sin un cuack sería un cambio de reglas a mitad de
 * partida. Se calcula con las partidas que ya están guardadas —dato real, no un
 * número inventado— y se topa, que tampoco es un cheque en blanco.
 *
 * Se paga UNA vez: en cuanto la cartera existe en el disco, esto no se vuelve a
 * mirar nunca.
 */
const ESTRENO_POR_PARTIDA = 5;
const ESTRENO_TOPE = 500;

function bienvenida(partidas) {
  const n = Math.max(0, Number(partidas) || 0);
  return Math.min(ESTRENO_TOPE, n * ESTRENO_POR_PARTIDA);
}

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

function entero(v) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * El monedero.
 *
 * Guarda el saldo, lo ganado en total —que es lo que se enseña como historial— y
 * qué juegos están comprados. Los comprados van en una lista de ids y no en un
 * campo del catálogo por lo de siempre: un juego que desaparezca un tiempo del
 * catálogo no puede hacer que nadie pierda lo que pagó por él.
 */
export class Cartera {
  /**
   * @param {object} [guardado]  lo que había en `estado.cuacks`
   * @param {{partidas:number, yaAbiertos:string[]}} [estreno]
   *   Sólo se mira si la cartera NO existía: `partidas` son las de
   *   ProgresoJuegos y `yaAbiertos` los ids de los juegos que el nivel de este
   *   pato ya tenía desbloqueados. Los segundos se regalan; ver arriba.
   */
  constructor(guardado, estreno) {
    const g = guardado && typeof guardado === 'object' ? guardado : null;
    const e = estreno && typeof estreno === 'object' ? estreno : {};

    this.saldo = g ? entero(g.saldo) : bienvenida(e.partidas);
    this.ganado = g ? entero(g.ganado) : this.saldo;
    /** Si la cartera se acaba de estrenar, y con qué. Para poder decirlo. */
    this.estrenada = !g;
    this.deBienvenida = g ? 0 : this.saldo;

    this._comprados = new Set(
      g && Array.isArray(g.comprados)
        ? g.comprados.filter((x) => typeof x === 'string')
        // El regalo de estreno: lo que el nivel ya había abierto pasa a estar
        // comprado, y a partir de ahí es una compra más. No hace falta guardar
        // que fue un regalo —una vez tuyo, da igual cómo llegó—.
        : (Array.isArray(e.yaAbiertos) ? e.yaAbiertos.filter((x) => typeof x === 'string') : [])
    );
    /** Cuántos se regalaron al estrenar. Sólo para poder contarlo en el panel. */
    this.regalados = g ? 0 : this._comprados.size;
    /** Último día que se cobró el peaje del «No tocar». */
    this.diaDeLaBroma = g && typeof g.diaDeLaBroma === 'string' ? g.diaDeLaBroma : '';
  }

  /** Mete cuacks. Devuelve lo ingresado, para poder enseñarlo sin recalcularlo. */
  ingresar(cantidad) {
    const n = entero(cantidad);
    if (!n) return 0;
    this.saldo += n;
    this.ganado += n;
    return n;
  }

  /** ¿Está comprado este juego? Los que valen 0 no hace falta comprarlos. */
  tiene(juego) {
    if (!juego) return false;
    if (!precioDeJuego(juego)) return true;
    return this._comprados.has(juego.id);
  }

  /** ¿Llega el saldo? Sin comprar nada: lo usa el panel para pintar el botón. */
  puedeComprar(juego) {
    return !this.tiene(juego) && this.saldo >= precioDeJuego(juego);
  }

  /**
   * Compra un juego. Devuelve si se ha comprado ahora.
   *
   * Comprueba otra vez el saldo aunque el panel ya lo haya mirado: quien pinta un
   * botón y quien cobra no tienen por qué ser el mismo, y de los dos el que no
   * puede equivocarse es el que cobra.
   */
  comprar(juego) {
    if (!juego || this.tiene(juego)) return false;
    const precio = precioDeJuego(juego);
    if (this.saldo < precio) return false;
    this.saldo -= precio;
    this._comprados.add(juego.id);
    return true;
  }

  /**
   * El premio de la broma tal y como está ahora mismo: cuánto, y si ya se cobró
   * hoy. No cobra nada.
   *
   * Hace falta como consulta porque el aviso del botón lo dice ANTES de que
   * nadie lo pulse: es el cebo, y un cebo que mienta no vale.
   */
  bromaPendiente(nivel) {
    return { cuacks: premioDeLaBroma(nivel), yaCobrado: this.diaDeLaBroma === hoy() };
  }

  /**
   * Cobra el peaje de la broma. Una vez al día.
   *
   * Una al día y no una por partida porque el peaje se puede repetir: fallar
   * devuelve a la primera pregunta, pero pasarlo dos veces seguidas es cuestión
   * de paciencia, y entonces la broma sería una máquina de hacer cuacks.
   */
  cobrarLaBroma(nivel) {
    const info = this.bromaPendiente(nivel);
    if (info.yaCobrado) return { cuacks: 0, yaCobrado: true };
    this.diaDeLaBroma = hoy();
    this.ingresar(info.cuacks);
    return { cuacks: info.cuacks, yaCobrado: false };
  }

  toJSON() {
    return {
      saldo: this.saldo,
      ganado: this.ganado,
      comprados: [...this._comprados],
      diaDeLaBroma: this.diaDeLaBroma
    };
  }
}

/**
 * El precio de un juego, tolerando descriptores viejos.
 *
 * Vive aquí y no en el catálogo para que la cartera no dependa de él: así se
 * puede probar con juegos de mentira.
 */
function precioDeJuego(juego) {
  return Math.max(0, Number(juego && juego.precio) || 0);
}
