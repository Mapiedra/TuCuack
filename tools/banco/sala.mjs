// Una sala de mentira que une DOS partidas de verdad.
//
// Es lo único que hace falta para jugar en red sin red: `salas.js` le entrega a
// cada juego tres funciones —`enviar`, `alRecibir`, `alIrseUnJugador`— y nada
// más. Aquí se cumplen esas tres, con un buzón por lado.
//
// Los mensajes **no se entregan dentro de `enviar`**: se encolan y se sueltan al
// principio del paso siguiente. Entregarlos en el acto sería reentrar en mitad
// de la jugada de quien los manda, que es algo que la sala de verdad no hace
// nunca y que taparía justo los fallos de orden que se buscan aquí.
//
// Y se copian con `JSON.parse(JSON.stringify(...))`, también a propósito: por el
// canal viaja JSON, así que un juego que mandara un objeto vivo y lo siguiera
// tocando funcionaría aquí y fallaría en la vida real.

/**
 * @returns {{a:Object, b:Object, repartir:() => number}}
 *   `a` y `b` son las dos salas, una para cada partida; `repartir` entrega lo
 *   que haya en los buzones y devuelve cuántos mensajes ha soltado.
 */
export function crearSalaDeMentira() {
  const buzon = { a: [], b: [] };
  const oyentes = { a: [], b: [] };
  const idos = { a: [], b: [] };

  const lado = (mio, suyo) => ({
    enviar(m) { buzon[suyo].push(JSON.parse(JSON.stringify(m))); },
    alRecibir(cb) {
      oyentes[mio].push(cb);
      return () => { oyentes[mio] = oyentes[mio].filter((f) => f !== cb); };
    },
    alIrseUnJugador(cb) {
      idos[mio].push(cb);
      return () => { idos[mio] = idos[mio].filter((f) => f !== cb); };
    }
  });

  return {
    a: lado('a', 'b'),
    b: lado('b', 'a'),
    repartir() {
      let n = 0;
      for (const cual of ['a', 'b']) {
        while (buzon[cual].length) {
          const m = buzon[cual].shift();
          n++;
          // Sobre una copia de la lista: un juego puede darse de baja mientras
          // atiende un mensaje, y eso saltaría al oyente siguiente.
          for (const cb of oyentes[cual].slice()) cb(m, 'rival');
        }
      }
      return n;
    },
    /** Para probar qué hace un juego cuando el otro se va. */
    seVa(cual, quien) {
      for (const cb of idos[cual].slice()) cb(quien);
    }
  };
}
