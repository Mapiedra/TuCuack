// Aleatoriedad reproducible para los juegos.
//
// No se usa `Math.random` porque en una partida por red los dos lados tienen que
// poder llegar a lo mismo: con la misma semilla —la que reparte el anfitrión en
// `ctx.semilla`— sale la misma secuencia en los dos sitios. Y de paso, una
// partida se puede repetir tal cual para depurarla.

/**
 * @param {number} semilla
 * @returns {() => number} el siguiente número de 0 a 1
 */
export function sembrar(semilla) {
  // xorshift32: cuatro operaciones y suficiente para barajar cartas o elegir
  // una piedra. No pretende ser criptográfico y no lo necesita.
  let s = (Number(semilla) || 1) >>> 0;
  return function siguiente() {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/** Uno de la lista, al azar. */
export function unoDe(lista, azar) {
  return lista[Math.floor(azar() * lista.length)];
}
