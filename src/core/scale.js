// Tamaño del pato en pantalla.
//
// Se compone de dos cosas:
//
//   - La ESCALA BASE, que decide la carcasa: en el escritorio es la del CSS, y
//     en el panel de la extensión se calcula según el ancho disponible.
//   - El FACTOR que elige el usuario en Ajustes, en tanto por ciento.
//
// Así "100 %" significa lo mismo en todas partes —el tamaño normal del pato ahí
// donde viva— y el panel sigue adaptándose a su ancho aunque el usuario haya
// tocado el ajuste.

import { elementoDeEstilo } from './stage.js';

/** Rango del ajuste, en porcentaje. */
export const LIMITES = { MINIMO: 40, MAXIMO: 160, PASO: 5, POR_DEFECTO: 100 };

const BASE_DE_RESPALDO = 0.62;

let base = null;
let factor = LIMITES.POR_DEFECTO;
let limitar = (n) => n;

/** Escala que el CSS de la carcasa trae de fábrica; se lee una sola vez, antes
 *  de que nadie haya escrito el valor a mano. */
function baseInicial() {
  const css = getComputedStyle(elementoDeEstilo()).getPropertyValue('--duck-scale');
  const n = parseFloat(css);
  return Number.isFinite(n) && n > 0 ? n : BASE_DE_RESPALDO;
}

export function fijarEscalaBase(n) {
  if (!Number.isFinite(n) || n <= 0) return;
  base = n;
  aplicar();
}

/** @param {number} pct porcentaje elegido por el usuario */
export function fijarFactor(pct) {
  const n = Number(pct);
  if (!Number.isFinite(n)) return;
  factor = Math.min(LIMITES.MAXIMO, Math.max(LIMITES.MINIMO, Math.round(n)));
  aplicar();
}

export function factorActual() {
  return factor;
}

/**
 * Instala un tope que depende del sitio disponible.
 *
 * Lo usa el panel de la extensión: por muy arriba que el usuario suba el ajuste,
 * el pato no debe salirse del panel y quedar cortado. En el escritorio no hace
 * falta, porque la ventana ocupa la pantalla entera.
 *
 * @param {(escala:number) => number} fn
 */
export function fijarLimiteEscala(fn) {
  if (typeof fn !== 'function') return;
  limitar = fn;
  aplicar();
}

/** Normaliza un valor guardado, que puede venir de una versión anterior o de un
 *  fichero editado a mano. */
export function normalizarFactor(pct) {
  const n = Number(pct);
  if (!Number.isFinite(n)) return LIMITES.POR_DEFECTO;
  return Math.min(LIMITES.MAXIMO, Math.max(LIMITES.MINIMO, Math.round(n / LIMITES.PASO) * LIMITES.PASO));
}

function aplicar() {
  if (base == null) base = baseInicial();
  const pedida = base * (factor / 100);
  const escala = Math.max(0.05, limitar(pedida) || pedida);
  elementoDeEstilo().style.setProperty('--duck-scale', escala.toFixed(4));

  // El pato guarda su ancho y su alto para no salirse por los bordes, así que
  // hay que decirle que se vuelva a medir. `resize` es el aviso que ya escucha.
  window.dispatchEvent(new Event('resize'));
}
