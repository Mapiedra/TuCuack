// El lienzo y el marcador de un minijuego de escenario.
//
// El juego se pinta en un canvas y no en elementos del DOM porque pinta decenas
// de cosas por fotograma —la paleta, la estela, las dianas— y hacerlo con nodos
// sería crearlos y destruirlos a 60 Hz. El MARCADOR, en cambio, sí es DOM: es
// texto, reutiliza los estilos de los paneles y se escribe con `textContent`.

/** Tope del ratio de píxeles. Una ventana transparente siempre encima a 4K
 *  nativo se come la GPU sin que se note la diferencia. */
const DPR_MAX = 2;

/**
 * Un lienzo del tamaño del escenario, por detrás del pato.
 *
 * Las coordenadas son píxeles CSS y coinciden con las del ratón: el ratio de
 * píxeles ya va aplicado en la transformación del contexto, así que el juego no
 * tiene que saber que existe.
 */
export function crearLienzo() {
  const lienzo = document.createElement('canvas');
  lienzo.className = 'juego-lienzo hot';
  const pintor = lienzo.getContext('2d');

  function ajustar() {
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
    const ancho = window.innerWidth;
    const alto = window.innerHeight;
    lienzo.width = Math.round(ancho * dpr);
    lienzo.height = Math.round(alto * dpr);
    lienzo.style.width = `${ancho}px`;
    lienzo.style.height = `${alto}px`;
    pintor.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  ajustar();

  /**
   * Lo que el juego necesita saber del sitio donde juega.
   *
   * `patoAncho` es la unidad de referencia: dimensionar una paleta en píxeles
   * absolutos daría un juego distinto en el overlay de 1920 px y en el panel
   * lateral de 350.
   */
  function medir(pato) {
    return {
      ancho: window.innerWidth,
      alto: window.innerHeight,
      suelo: pato.ground,
      patoAncho: pato.width,
      patoAlto: pato.height
    };
  }

  return { lienzo, pintor, ajustar, medir };
}

/**
 * Dónde acaba el marcador, en píxeles desde el borde de arriba de la pantalla.
 *
 * Lo exporta este fichero porque es este el que crea el trasto: `.juego-hud` va
 * a 12 píxeles del borde y ocupa 51, así que su última fila es la 63. **Medido
 * en la app**, no calculado a ojo —a ojo salen 52 y se queda corto—.
 *
 * Lo necesita cualquier juego de escenario que pinte algo pegado arriba: el
 * marcador va POR ENCIMA del lienzo y le tapa lo que haya debajo. Le pasó a la
 * mesa de billar, donde se comía la tronera central, y al minigolf, donde
 * esconde la franja de arriba del campo.
 *
 * Si alguien toca `.juego-hud` en styles.css, este número hay que volver a
 * medirlo.
 */
export const MARCADOR_ABAJO = 63;

/** Y el aire que conviene dejarle debajo, para que no se toquen. */
export const AIRE_MARCADOR = 10;

/**
 * El marcador: el nombre del juego, un hueco para el tanteo y el botón de
 * salir. Va aparte del lienzo porque es texto y porque tiene que poder pulsarse.
 *
 * @param {string} titulo
 * @param {() => void} onSalir
 */
export function crearMarcador(titulo, onSalir) {
  const el = document.createElement('div');
  el.className = 'juego-hud hot';

  const nombre = document.createElement('span');
  nombre.textContent = titulo;

  const tanteo = document.createElement('span');
  tanteo.className = 'marcador';

  const salir = document.createElement('button');
  salir.className = 'btn';
  salir.type = 'button';
  salir.textContent = 'Salir';
  salir.title = 'Salir de la partida (Esc)';
  salir.addEventListener('click', () => onSalir());

  el.append(nombre, tanteo, salir);

  return {
    el,
    poner(texto) { tanteo.textContent = texto == null ? '' : String(texto); }
  };
}
