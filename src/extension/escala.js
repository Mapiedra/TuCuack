// Tamaño de referencia del pato dentro del panel lateral.
//
// El panel es estrecho y el usuario puede cambiarle el ancho, así que una escala
// fija se queda corta o desborda. Aquí se calcula a partir del hueco real.
//
// Esto es sólo la escala BASE, el "100 %". Encima se aplica el porcentaje que el
// usuario elija en Ajustes, que gestiona `core/scale.js`. La base se deja con
// margen por arriba a propósito: si al 100 % el pato ya llenara el panel, subir
// el ajuste no haría nada y el control quedaría a medias.

import { fijarEscalaBase, fijarLimiteEscala } from './core/scale.js';

// Fracción del panel que ocupa el pato al 100 %.
const FRACCION_ANCHO = 0.62;
const FRACCION_ALTO = 0.5;

// Tope absoluto: por muy arriba que se suba el ajuste, el pato tiene que caber
// entero y dejar algo de sitio para andar.
const TOPE_ANCHO = 0.92;
const TOPE_ALTO = 0.8;

const MINIMA = 0.3;
const MAXIMA = 2.4;

let ultima = null;

/** Tamaño del sprite según el CSS, para no repetir aquí las medidas. */
function medidaSprite(nombre, respaldo) {
  const valor = getComputedStyle(document.documentElement).getPropertyValue(nombre);
  const px = parseFloat(valor);
  return Number.isFinite(px) && px > 0 ? px : respaldo;
}

function hueco() {
  const raiz = document.documentElement;
  return {
    ancho: raiz.clientWidth || window.innerWidth,
    alto: raiz.clientHeight || window.innerHeight,
    spriteW: medidaSprite('--sprite-w', 248),
    spriteH: medidaSprite('--sprite-h', 268)
  };
}

export function ajustarEscala() {
  const { ancho, alto, spriteW, spriteH } = hueco();
  // El documento puede no tener medidas todavía (aún sin maquetar, o el panel
  // arranca oculto). No se inventa nada: el observador volverá a llamar cuando
  // el panel tenga tamaño de verdad.
  if (!ancho || !alto) return;

  const escala = Math.min(
    MAXIMA,
    Math.max(
      MINIMA,
      Math.min((ancho * FRACCION_ANCHO) / spriteW, (alto * FRACCION_ALTO) / spriteH)
    )
  ).toFixed(4);

  if (escala === ultima) return;
  ultima = escala;
  // Quien la combina con el ajuste del usuario y la aplica es core/scale.js.
  fijarEscalaBase(Number(escala));
}

/**
 * Ajusta ahora y cada vez que el panel cambie de tamaño.
 *
 * Se usa ResizeObserver y no sólo el evento `resize` porque también avisa cuando
 * el documento pasa de no tener medidas a tenerlas, que es justo el momento en
 * que hace falta el primer cálculo.
 */
export function vigilarEscala() {
  // Que el pato nunca acabe más ancho que su panel, suba el usuario lo que suba.
  fijarLimiteEscala((pedida) => {
    const { ancho, alto, spriteW, spriteH } = hueco();
    if (!ancho || !alto) return pedida;
    return Math.min(pedida, (ancho * TOPE_ANCHO) / spriteW, (alto * TOPE_ALTO) / spriteH);
  });

  ajustarEscala();

  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(() => ajustarEscala()).observe(document.documentElement);
  } else {
    window.addEventListener('resize', ajustarEscala);
  }
}
