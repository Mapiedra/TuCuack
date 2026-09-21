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
 *
 * ---- Quién manda aquí -----------------------------------------------------
 *
 * Desde que hay monedero en el servidor, esto NO es el libro mayor: es el
 * espejo. La cifra de verdad vive en Supabase (ver `supabase/cuacks.sql`, que es
 * lectura previa para tocar nada de aquí) y lo que hay en el disco es una copia
 * para poder enseñar algo sin conexión.
 *
 * El motivo es el que se ve venir: un fichero JSON con `"saldo": 12` es un
 * fichero JSON con `"saldo": 999999` en cuanto alguien lo abre, y en cuanto haya
 * premios o cupones eso deja de dar igual. Lo que NO se arregla moviendo la
 * cifra a la nube es que el cliente la declare, y por eso el reparto de trabajo
 * es éste: **el pato dice qué ha jugado y el servidor dice cuánto vale**.
 *
 * ---- Por qué sigue habiendo cuentas aquí ----------------------------------
 *
 * Porque el número tiene que salir EN CUANTO termina la partida, y una petición
 * de red tarda. Así que se paga en el acto de forma provisional y la partida se
 * queda apuntada en `pendientes` hasta que el servidor la confirma. Lo que se
 * enseña es «lo último que dijo el servidor, más lo que todavía no ha
 * contestado»: nunca se cuenta dos veces y nunca hay que esperar.
 *
 * Eso mismo es lo que hace que se pueda jugar sin conexión: lo pendiente se
 * queda en el disco y sale solo al volver. Como cada partida va con su
 * identificador y el servidor no paga dos veces la misma (ver
 * `apuntar_partida_cuacks`), reintentar no tiene ningún riesgo.
 *
 * Comprar es lo único que NO se puede hacer sin conexión, y es a propósito: una
 * compra que se apunta en una cola es una compra que puede fallar después de que
 * el jugador ya esté jugando a lo que creía suyo. Mejor decir que hace falta
 * conexión.
 *
 * ---- Y sin servidor ------------------------------------------------------
 *
 * Donde no hay monedero en el servidor —el banco de pruebas— todo esto sigue
 * funcionando contra el disco, exactamente como antes. El juego no se queda sin
 * moneda por no haber a quién preguntar.
 */
export class Cartera {
  /**
   * @param {object} [guardado]  lo que había en `estado.cuacks`
   * @param {{partidas:number, yaAbiertos:string[]}} [estreno]
   *   Sólo se mira si la cartera NO existía: `partidas` son las de
   *   ProgresoJuegos y `yaAbiertos` los ids de los juegos que el nivel de este
   *   pato ya tenía desbloqueados. Los segundos se regalan; ver arriba.
   * @param {import('../platform.js').Plataforma['monedero']} [monedero]
   *   Con quién se habla para que el servidor lleve la cuenta. Sin él, la
   *   cartera va contra el disco y se acabó.
   */
  constructor(guardado, estreno, monedero) {
    const g = guardado && typeof guardado === 'object' ? guardado : null;
    const e = estreno && typeof estreno === 'object' ? estreno : {};

    /**
     * Lo último que dijo el servidor (o, sin servidor, lo que hay en el disco).
     *
     * Nunca se lee directamente desde fuera: lo que se enseña es `saldo`, que le
     * suma lo que aún está en la cola.
     */
    this._base = {
      saldo: g ? entero(g.saldo) : bienvenida(e.partidas),
      ganado: g ? entero(g.ganado) : 0
    };
    if (!g) this._base.ganado = this._base.saldo;

    /** Si la cartera se acaba de estrenar, y con qué. Para poder decirlo. */
    this.estrenada = !g;
    this.deBienvenida = g ? 0 : this._base.saldo;

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

    /**
     * Partidas jugadas que el servidor todavía no ha confirmado.
     *
     * Sobreviven al apagado porque van en `toJSON`: jugar sin conexión, cerrar
     * el pato y abrirlo mañana tiene que acabar cobrando igual.
     *
     * @type {{id:string, juego:string, resultado:string, enRed:boolean, cuacks:number}[]}
     */
    this.pendientes = g && Array.isArray(g.pendientes)
      ? g.pendientes.filter(apunteValido).slice(0, TOPE_PENDIENTES)
      : [];

    this.monedero = monedero || null;
    /** Si lo que se enseña lo ha confirmado el servidor alguna vez. */
    this.confirmada = false;
    /** Si hay un envío de pendientes en marcha, para no lanzar dos. */
    this._enviando = false;
    this._alCambiar = () => {};
  }

  /**
   * Avisa cada vez que cambia algo que haya que pintar o guardar.
   *
   * Hace falta porque con el monedero en el servidor las cosas ya no pasan
   * cuando el pato las pide: pasan cuando contesta la red, que puede ser un
   * segundo después o mañana, al recuperar la cola.
   */
  alCambiar(cb) { this._alCambiar = typeof cb === 'function' ? cb : () => {}; }

  /** ¿Lleva la cuenta el servidor? */
  enServidor() { return !!this.monedero; }

  /** Lo que se enseña: lo confirmado más lo que aún está en la cola. */
  get saldo() {
    return this._base.saldo + this.pendientes.reduce((n, p) => n + p.cuacks, 0);
  }

  get ganado() {
    return this._base.ganado + this.pendientes.reduce((n, p) => n + p.cuacks, 0);
  }

  /**
   * Se pone al día con el servidor. Se llama al arrancar.
   *
   * Tres pasos, y el orden importa:
   *
   *   1. Preguntar. Si el monedero ya existe, eso es la verdad y pisa al disco.
   *   2. Si NO existe, estrenarlo con lo que hubiera en el disco — que es lo que
   *      hace que nadie pierda lo que llevaba ganado. Se manda siempre que el
   *      servidor diga que no existe, no «la primera vez»: una bandera de «ya lo
   *      estrené» es justo lo que se queda mal puesta cuando algo falla a
   *      medias, y el servidor ya sabe decir «ya estaba».
   *   3. Soltar la cola, si quedaba algo de una sesión sin conexión.
   *
   * Sin servidor no hace nada y no es un fallo: es el camino del banco de
   * pruebas.
   */
  async sincronizar() {
    if (!this.monedero) return false;

    const res = await this.monedero.mios();
    if (!res || !res.ok || !res.datos) {
      // Sin respuesta se sigue con lo del disco. No se toca nada: el saldo que
      // se enseñaba sigue siendo el mejor que se tiene.
      await this._soltarLaCola();
      return false;
    }

    if (res.datos.existe) {
      this._aplicar(res.datos);
      // El monedero ya estaba, así que no hay estreno que contar: el cartel de
      // bienvenida es de la primera vez y sólo de la primera vez.
      this.estrenada = false;
      this.deBienvenida = 0;
      this.regalados = 0;
    } else {
      const nacido = await this.monedero.estrenar({
        saldo: this._base.saldo,
        ganado: this._base.ganado,
        comprados: [...this._comprados],
        diaDeLaBroma: this.diaDeLaBroma
      });
      if (nacido && nacido.ok && nacido.datos) this._aplicar(nacido.datos);
    }

    await this._soltarLaCola();
    return this.confirmada;
  }

  /**
   * Una partida terminada: paga en el acto y deja que el servidor lo confirme.
   *
   * Devuelve lo que se ha pagado para poder enseñarlo ya. El `id` es lo que
   * hace que reintentarla no la cobre dos veces, así que tiene que ser el mismo
   * en cada reintento — lo pone quien llama, que es quien sabe de qué partida
   * viene (ver `anotarPartida` en core/app.js).
   *
   * @param {import('./minijuegos/index.js').Minijuego} juego
   * @param {'victoria'|'derrota'|'empate'} resultado
   * @param {{enRed?:boolean, id?:string}} [opciones]
   * @returns {number} los cuacks de esta partida
   */
  apuntarPartida(juego, resultado, opciones) {
    const o = opciones && typeof opciones === 'object' ? opciones : {};
    const cuacks = pagoDePartida(juego, resultado, { enRed: !!o.enRed });

    if (!this.monedero) {
      // Sin servidor, como toda la vida.
      this.ingresar(cuacks);
      return cuacks;
    }

    const id = String(o.id || '').slice(0, 80);
    if (!id) {
      // Sin identificador no se puede apuntar: reintentarla cobraría otra vez.
      // Se paga en local y se dice en voz alta, porque es un fallo de quien
      // llama y no una condición de red.
      console.warn('[cuacks] partida sin identificador: se paga en local y no sube');
      this.ingresar(cuacks);
      return cuacks;
    }

    this.pendientes.push({
      id, juego: juego && juego.id ? String(juego.id) : '',
      resultado, enRed: !!o.enRed, cuacks
    });
    // Con la cola llena se suelta lo más viejo. Llegar aquí significa semanas
    // sin conexión, y de lo que se trata es de que el fichero no crezca sin fin.
    while (this.pendientes.length > TOPE_PENDIENTES) this.pendientes.shift();

    this._alCambiar();
    // Sin esperar: quien llama está enseñando el resultado de la partida.
    this._soltarLaCola();
    return cuacks;
  }

  /**
   * Mete cuacks a mano. Devuelve lo ingresado.
   *
   * Con monedero en el servidor esto NO sube nada: sólo mueve el espejo, y a la
   * primera respuesta del servidor se deshace. Se queda porque es lo que usan
   * las sondas de desarrollo (`api.darCuacks`), y ahí es exactamente lo que se
   * quiere — probar la tienda sin jugar cuarenta partidas.
   */
  ingresar(cantidad) {
    const n = entero(cantidad);
    if (!n) return 0;
    this._base.saldo += n;
    this._base.ganado += n;
    this._alCambiar();
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
   * Con servidor, quien cobra es él: el precio sale de SU catálogo, no del
   * descriptor que traiga el pato. Y si no contesta, no se compra — una compra
   * no se apunta en una cola (ver arriba).
   *
   * Comprueba el saldo antes aunque el panel ya lo haya mirado, y el servidor lo
   * comprueba otra vez: quien pinta un botón y quien cobra no son el mismo, y de
   * los dos el que no puede equivocarse es el que cobra.
   *
   * @returns {Promise<{hecho:boolean, motivo:string}>}
   */
  async comprar(juego) {
    if (!juego || this.tiene(juego)) return { hecho: false, motivo: 'ya-lo-tienes' };
    const precio = precioDeJuego(juego);
    if (this.saldo < precio) return { hecho: false, motivo: 'no-llega' };

    if (!this.monedero) {
      this._base.saldo -= precio;
      this._comprados.add(juego.id);
      this._alCambiar();
      return { hecho: true, motivo: 'comprado' };
    }

    // Lo pendiente primero: si no, el servidor puede decir «no llega» por unos
    // cuacks que están ganados pero todavía no han subido.
    await this._soltarLaCola();

    const res = await this.monedero.comprar(juego.id);
    if (!res || !res.ok || !res.datos) return { hecho: false, motivo: 'sin-conexion' };
    this._aplicar(res.datos);
    const motivo = String(res.datos.motivo || '');
    return { hecho: motivo === 'comprado' || motivo === 'ya-lo-tienes', motivo };
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
   *
   * A diferencia de una partida, esto NO se puede apuntar en la cola: no lleva
   * identificador —es «una vez al día», no «esta vez»— y reintentarlo al día
   * siguiente lo cobraría otra vez. Así que sin conexión no se cobra, y se dice.
   *
   * @returns {Promise<{cuacks:number, yaCobrado:boolean, sinConexion?:boolean}>}
   */
  async cobrarLaBroma(nivel) {
    const info = this.bromaPendiente(nivel);
    if (info.yaCobrado) return { cuacks: 0, yaCobrado: true };

    if (!this.monedero) {
      this.diaDeLaBroma = hoy();
      this.ingresar(info.cuacks);
      return { cuacks: info.cuacks, yaCobrado: false };
    }

    const res = await this.monedero.broma(nivel);
    if (!res || !res.ok || !res.datos) {
      return { cuacks: 0, yaCobrado: false, sinConexion: true };
    }
    this._aplicar(res.datos);
    // El servidor puede decir que ya se cobró hoy aunque el disco no lo supiera:
    // pasa con dos patos del mismo dueño, o tras reinstalar. Manda él.
    if (String(res.datos.motivo) === 'ya-cobrada') return { cuacks: 0, yaCobrado: true };
    return { cuacks: entero(res.datos.cuacks), yaCobrado: false };
  }

  toJSON() {
    return {
      saldo: this._base.saldo,
      ganado: this._base.ganado,
      comprados: [...this._comprados],
      diaDeLaBroma: this.diaDeLaBroma,
      // La cola tiene que sobrevivir al apagado: lo jugado sin conexión se cobra
      // cuando vuelva, aunque sea mañana.
      pendientes: this.pendientes
    };
  }

  // ---- Por dentro ---------------------------------------------------------

  /**
   * Manda lo pendiente, de lo más viejo a lo más nuevo.
   *
   * Se para en el primer fallo de red y deja el resto para la próxima: seguir
   * intentándolo cuando ya se sabe que no hay línea sólo sirve para llenar la
   * consola. Lo que el servidor rechace por motivo —una partida que ya estaba,
   * un juego que su catálogo no conoce— sí se quita, porque reintentarlo va a
   * dar lo mismo mañana.
   */
  async _soltarLaCola() {
    if (!this.monedero || this._enviando || !this.pendientes.length) return;
    this._enviando = true;
    try {
      while (this.pendientes.length) {
        const apunte = this.pendientes[0];
        const res = await this.monedero.partida({
          id: apunte.id,
          juego: apunte.juego,
          resultado: apunte.resultado,
          enRed: apunte.enRed
        });
        // No se ha podido hablar con el servidor: se queda para la próxima.
        if (!res || !res.ok || !res.datos) break;

        if (String(res.datos.motivo) === 'demasiadas') {
          // El tope por hora. No es un rechazo definitivo: mañana entra. Pero
          // insistir ahora no sirve de nada, así que se deja la cola quieta.
          break;
        }

        // Aceptada, repetida o rechazada por motivo: en los tres casos deja de
        // estar pendiente. El saldo que vale es el que acaba de decir él.
        this.pendientes.shift();
        this._aplicar(res.datos);
      }
    } finally {
      this._enviando = false;
      this._alCambiar();
    }
  }

  /** Se queda con lo que dice el servidor. Es él quien lleva la cuenta. */
  _aplicar(estado) {
    if (!estado || typeof estado !== 'object') return;
    this._base.saldo = entero(estado.saldo);
    this._base.ganado = Math.max(entero(estado.ganado), this._base.saldo);
    this._comprados = new Set(
      Array.isArray(estado.comprados)
        ? estado.comprados.filter((x) => typeof x === 'string')
        : []
    );
    this.diaDeLaBroma = typeof estado.diaDeLaBroma === 'string' ? estado.diaDeLaBroma : '';
    this.confirmada = true;
    this._alCambiar();
  }
}

/** Cuántas partidas sin confirmar se guardan. Semanas sin conexión. */
const TOPE_PENDIENTES = 300;

/** Un apunte de la cola leído del disco, que puede venir de cualquier manera. */
function apunteValido(p) {
  return p && typeof p === 'object'
    && typeof p.id === 'string' && p.id.length > 0 && p.id.length <= 80
    && typeof p.juego === 'string'
    && ['victoria', 'derrota', 'empate'].includes(p.resultado)
    && Number.isFinite(Number(p.cuacks)) && Number(p.cuacks) > 0;
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
