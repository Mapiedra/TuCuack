// Inercia del cursor: a qué velocidad se está moviendo el ratón ahora mismo.
//
// Es lo que convierte un "soltar" en un lanzamiento con fuerza, y lo que
// permitirá que un toque de paleta lleve efecto. No se mide entre dos
// fotogramas seguidos —saldría un número nervioso, lleno de picos— sino
// promediando las muestras de una ventana corta: lo justo para que un gesto
// rápido cuente y un temblor de mano no.
//
// Vive aparte de app.js porque el arrastre del pato y los minijuegos de
// escenario necesitan exactamente lo mismo, y dos copias de esto se separarían
// a la primera de cambio.

/** Milisegundos sobre los que se promedia. Menos, y tiembla; más, y va tarde. */
export const VENTANA_POR_DEFECTO = 90;

/**
 * @param {number} [ventanaMs]
 */
export function crearInercia(ventanaMs = VENTANA_POR_DEFECTO) {
  /** @type {Array<{x:number, y:number, t:number}>} */
  const muestras = [];

  return {
    /** Anota dónde está el cursor. Se llama en cada `mousemove`. */
    anotar(x, y) {
      const ahora = performance.now();
      muestras.push({ x, y, t: ahora });
      // Siempre se guardan al menos dos: con una sola no hay velocidad que medir.
      while (muestras.length > 2 && ahora - muestras[0].t > ventanaMs) muestras.shift();
    },

    /**
     * Velocidad del cursor en px/s.
     * El eje Y del pato crece hacia arriba y el del cursor hacia abajo, así que
     * la vertical sale invertida: quien llama ya recibe el convenio del pato.
     * @returns {{vx:number, vy:number}}
     */
    velocidad() {
      if (muestras.length < 2) return { vx: 0, vy: 0 };
      const a = muestras[0];
      const b = muestras[muestras.length - 1];
      const dt = (b.t - a.t) / 1000;
      if (dt <= 0.001) return { vx: 0, vy: 0 };
      return { vx: (b.x - a.x) / dt, vy: -(b.y - a.y) / dt };
    },

    /**
     * Cuánto se ha desplazado en horizontal dentro de la ventana. Sirve para
     * decidir hacia dónde mira el pato mientras se le arrastra, que es una
     * pregunta distinta de "a qué velocidad va".
     * @returns {number} 0 si aún no hay suficientes muestras
     */
    avanceX() {
      if (muestras.length < 2) return 0;
      return muestras[muestras.length - 1].x - muestras[0].x;
    },

    limpiar() { muestras.length = 0; }
  };
}
