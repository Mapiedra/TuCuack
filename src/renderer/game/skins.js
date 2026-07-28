// Catálogo de diseños de pato.
//
// Cada diseño es un sprite sheet propio, generado por tools/pack_sprites.py a
// partir de su arte fuente. Todos comparten la MISMA estructura de animaciones
// (mismas filas y número de frames), así que el resto del código no necesita
// saber cuál está puesto.
//
// Para añadir uno nuevo: deja su arte en assets/sprites/fuentes/<id>.webp con la
// rejilla que describe el README, ejecuta `npm run sprites` y añade su entrada
// aquí.

export const SKINS = [
  {
    id: 'normal',
    nombre: 'Patito',
    descripcion: 'Un pato corriente y sin pretensiones.',
    nivel: 1
  },
  {
    id: 'hembra',
    nombre: 'Patita',
    descripcion: 'Con su lazo y su actitud.',
    nivel: 3
  },
  {
    id: 'duro',
    nombre: 'Pato duro',
    descripcion: 'Gafas de sol, cadena de oro y un bate con pinchos.',
    nivel: 6
  },
  {
    id: 'ganster',
    nombre: 'Pato gánster',
    descripcion: 'Traje, sombrero y muy malas pulgas.',
    nivel: 10
  },
  {
    id: 'capo',
    nombre: 'Capo de la mafia',
    descripcion: 'El que da las órdenes. Nadie discute con el capo.',
    nivel: 15
  }
];

/**
 * Diseño de partida: tiene que ser uno de nivel 1, o al empezar no habría
 * ninguno disponible. El pato duro pasa a ser una recompensa de nivel 6.
 */
export const SKIN_POR_DEFECTO = 'normal';

export function skinPorId(id) {
  return SKINS.find((s) => s.id === id) || null;
}

export function estaDesbloqueada(skin, nivel) {
  return nivel >= skin.nivel;
}

/** Ruta del sheet de un diseño, relativa al documento del renderer. */
export function rutaSheet(id) {
  return `../../assets/sprites/duck-${id}.png`;
}
