// El escenario: dónde vive el pato dentro del documento que lo aloja.
//
// En el escritorio y en el panel de la extensión, el pato tiene el documento
// para él solo y su escenario es `document`. Pero cuando vive sobre una página
// ajena hay que meterlo en un Shadow DOM, porque si no el CSS del sitio le
// deforma los paneles y el suyo altera la página.
//
// Todo lo que dependa de eso pasa por aquí. Si nadie fija un escenario, se usa
// el documento entero: así el escritorio no necesita saber que esto existe.

let raizFijada = null;
let contenedorFijado = null;
let estiloFijado = null;

function laRaiz() {
  return raizFijada || document;
}

function elContenedor() {
  return contenedorFijado || document.body;
}

/**
 * @param {{raiz?: Document|ShadowRoot, contenedor?: Element|ShadowRoot,
 *          estilo?: Element}} escenario
 */
export function fijarEscenario(escenario = {}) {
  if (escenario.raiz) raizFijada = escenario.raiz;
  if (escenario.contenedor) contenedorFijado = escenario.contenedor;
  if (escenario.estilo) estiloFijado = escenario.estilo;
}

/** Elemento sobre el que se ponen las variables CSS del pato. */
export function elementoDeEstilo() {
  return estiloFijado || document.documentElement;
}

/**
 * Elemento al que se le puede aplicar estilo directo (el cursor, por ejemplo).
 * Un ShadowRoot no tiene `style`, así que en ese caso es su anfitrión.
 */
export function elementoVisible() {
  const c = elContenedor();
  return c.host || c;
}

export function porId(id) {
  return laRaiz().getElementById(id);
}

export function todos(selector) {
  return laRaiz().querySelectorAll(selector);
}

export function uno(selector) {
  return laRaiz().querySelector(selector);
}

/** Añade un panel, menú o cartel al escenario. */
export function montar(el) {
  elContenedor().appendChild(el);
}

/**
 * Añade algo POR DEBAJO del pato: el fondo de un minijuego de escenario.
 *
 * `montar` lo pone al final del contenedor, que es lo que quieren los paneles
 * —van por delante de todo— y justo lo contrario de lo que quiere un fondo. El
 * pato y el lienzo son hermanos sin z-index, así que ahí manda el orden del
 * documento.
 */
export function montarAlFondo(el) {
  const escenario = porId('stage');
  if (escenario) escenario.prepend(el);
  else elContenedor().prepend(el);
}

/**
 * Elemento sobre el que ocurrió de verdad un evento.
 *
 * Los eventos que salen de un Shadow DOM llegan al documento con `target`
 * cambiado por el anfitrión, de modo que preguntarle a un panel del pato si
 * contiene `e.target` daría siempre que no. El camino compuesto sí trae el
 * elemento real, y fuera de un shadow devuelve exactamente `e.target`.
 */
export function objetivoReal(e) {
  if (e && typeof e.composedPath === 'function') {
    const camino = e.composedPath();
    if (camino && camino.length) return camino[0];
  }
  return e ? e.target : null;
}
