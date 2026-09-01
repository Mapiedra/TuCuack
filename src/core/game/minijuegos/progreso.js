// Progreso de los minijuegos: cuántas partidas, cuántas se ganaron y la mejor
// marca de cada uno.
//
// Va aparte del nivel porque no es lo mismo: la experiencia se gasta en subir y
// se olvida, y esto es el historial que el panel enseña y que da ganas de volver
// a jugar.

import { minijuegoPorId } from './index.js';

const VACIO = {
  partidas: 0, victorias: 0, derrotas: 0, empates: 0,
  mejor: null,     // la marca del juego, si tiene (ver `marca` en index.js)
  ultima: 0        // cuándo se jugó por última vez (ms)
};

export class ProgresoJuegos {
  /** @param {Record<string, object>} [guardado] lo que había en estado.minijuegos */
  constructor(guardado) {
    /** @type {Record<string, object>} */
    this._datos = {};
    if (guardado && typeof guardado === 'object') {
      for (const [id, v] of Object.entries(guardado)) {
        if (v && typeof v === 'object') this._datos[id] = { ...VACIO, ...v };
      }
    }
  }

  /**
   * Marcas de un juego. Siempre devuelve un objeto, nunca null: quien pinta el
   * panel no debería tener que distinguir "sin jugar" de "sin datos".
   * @param {string} id
   */
  de(id) {
    return { ...VACIO, ...(this._datos[id] || {}) };
  }

  /**
   * Anota una partida terminada.
   *
   * Qué cuenta como "mejor" marca lo dice el descriptor del juego y no quien
   * llama: en puntería gana el número más alto y en memoria el más bajo, y esa
   * decisión pertenece al juego, no al marco que la guarda.
   *
   * @param {string} id
   * @param {import('./index.js').ResultadoPartida} r
   */
  anotar(id, r) {
    if (!id || !r) return;
    const antes = this.de(id);
    const juego = minijuegoPorId(id);

    let mejor = antes.mejor;
    if (juego && juego.marca && typeof r.puntos === 'number' && Number.isFinite(r.puntos)) {
      if (mejor == null) mejor = r.puntos;
      else if (juego.marca.mejor === 'menos') mejor = Math.min(mejor, r.puntos);
      else mejor = Math.max(mejor, r.puntos);
    }

    this._datos[id] = {
      partidas: antes.partidas + 1,
      victorias: antes.victorias + (r.resultado === 'victoria' ? 1 : 0),
      derrotas: antes.derrotas + (r.resultado === 'derrota' ? 1 : 0),
      empates: antes.empates + (r.resultado === 'empate' ? 1 : 0),
      mejor,
      ultima: Date.now()
    };
  }

  /** Totales de todo, para la cabecera del panel. */
  totales() {
    let partidas = 0, victorias = 0;
    for (const v of Object.values(this._datos)) {
      partidas += v.partidas || 0;
      victorias += v.victorias || 0;
    }
    return { partidas, victorias };
  }

  /**
   * No se filtra por los ids que hoy están en el catálogo: un juego retirado un
   * tiempo —o volver a una versión anterior— no debe borrarle a nadie sus
   * récords. Lo que cuesta es un puñado de bytes muertos en el peor caso.
   */
  toJSON() {
    return { ...this._datos };
  }
}
