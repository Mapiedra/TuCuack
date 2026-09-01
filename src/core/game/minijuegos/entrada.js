// El ratón y el teclado de un minijuego de escenario.
//
// Se alimenta de los eventos que app.js le reenvía mientras hay partida, así que
// nunca compite con el arrastre del pato ni con el menú contextual:
// sencillamente, mientras se juega, esas cosas no existen.

import { crearInercia } from '../../pet/inercia.js';

export function crearEntrada() {
  const inercia = crearInercia();
  const teclas = new Set();

  const estado = {
    x: 0,
    y: 0,
    /** Velocidad del cursor en px/s, con el eje Y del pato (crece hacia arriba).
     *  Es lo que permite que un toque lleve efecto. */
    vx: 0,
    vy: 0,
    pulsado: false,

    mover(e) {
      estado.x = e.clientX;
      estado.y = e.clientY;
      inercia.anotar(e.clientX, e.clientY);
      const v = inercia.velocidad();
      estado.vx = v.vx;
      estado.vy = v.vy;
    },

    pulsar(e) {
      estado.pulsado = true;
      estado.mover(e);
    },

    soltar(e) {
      estado.pulsado = false;
      if (e) estado.mover(e);
    },

    tecla(e, abajo) {
      if (abajo) teclas.add(e.key);
      else teclas.delete(e.key);
    },

    pulsada(tecla) { return teclas.has(tecla); },

    /**
     * Se llama una vez por fotograma. Si el ratón lleva un rato quieto no llega
     * ningún `mousemove`, y sin esto la velocidad se quedaría clavada en el
     * último valor: una paleta parada seguiría "pegando" con efecto.
     */
    tic() {
      inercia.anotar(estado.x, estado.y);
      const v = inercia.velocidad();
      estado.vx = v.vx;
      estado.vy = v.vy;
    },

    limpiar() {
      teclas.clear();
      inercia.limpiar();
      estado.pulsado = false;
    }
  };

  return estado;
}
