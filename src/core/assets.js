// Recursos del pato: cómo se llega hasta ellos y cómo se cargan.
//
// Los sprites viven en `assets/sprites/`, pero cómo se llega hasta ahí depende
// de quién aloje al pato: en Electron es una ruta relativa al documento, y en
// una extensión de Chrome hay que pasar por `chrome.runtime.getURL`. En vez de
// esparcir rutas relativas por el código (que se rompen en cuanto el HTML cambia
// de sitio), todo pasa por aquí y la plataforma decide.

let resolver = (rel) => `assets/${rel}`;
let cargador = null;

/** La instala `arrancarPato` a partir de `plataforma.urlAsset`. */
export function configurarAssets(fn) {
  if (typeof fn === 'function') resolver = fn;
}

/**
 * Instala una forma alternativa de traer el sheet de sprites.
 *
 * Hace falta cuando el pato vive sobre una página ajena: cargarlo como imagen
 * del documento lo somete al `img-src` de ese sitio, y un CSP estricto lo
 * bloquearía dejando al pato hecho un emoji. El content script lo baja con
 * `fetch` —que se rige por el CSP de la extensión, no de la página— y lo
 * convierte en algo que el canvas pueda pintar.
 *
 * @param {(url: string) => Promise<CanvasImageSource>} fn
 */
export function configurarCargadorSheet(fn) {
  if (typeof fn === 'function') cargador = fn;
}

/** @param {string} rel ruta dentro de `assets/`, p. ej. `sprites/duck-normal.png` */
export function urlAsset(rel) {
  return resolver(rel);
}

/** Sheet de sprites de un diseño. */
export function urlSheet(skinId) {
  return urlAsset(`sprites/duck-${skinId}.png`);
}

/**
 * Trae el sheet de un diseño listo para pintar en un canvas.
 * @returns {Promise<CanvasImageSource>}
 */
export function cargarSheet(skinId) {
  const url = urlSheet(skinId);
  if (cargador) return cargador(url);

  // Por defecto, una imagen normal: es lo que quiere el escritorio.
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`no se pudo cargar ${url}`));
    img.src = url;
  });
}
