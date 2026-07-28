"""
Repara en el arte fuente los frames que vienen recortados.

Cuando el personaje no cabe en su celda, el dibujo sale con el contorno cortado
en recto y pierde un trozo (la cola, un ala). El empaquetador ya lo corrige al
vuelo, pero conviene arreglarlo en el propio arte: así la referencia que se le
pasa a quien genere los demás diseños está limpia, y el resultado no depende de
una reparación automática.

El trozo que falta se reconstruye copiándolo de un frame sano de la misma fila,
alineado por la parte que sí está bien. Como dentro de una animación el
personaje apenas cambia de forma, el parche es su propio dibujo y no un relleno
liso.

Uso:
    python tools/repair_source.py assets/sprites/fuentes/duro.webp
    python tools/repair_source.py entrada.webp salida.webp
"""

import os
import sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pack_sprites import FW, FH, clip_info, repair_clipped  # noqa: E402


def celda(img, fila, col):
    return img.crop((col * FW, fila * FH, (col + 1) * FW, (fila + 1) * FH))


def frames_de_fila(img, fila, cols):
    """Frames seguidos con dibujo en esa fila."""
    out = []
    for c in range(cols):
        cel = celda(img, fila, c)
        if (np.array(cel)[:, :, 3] > 20).sum() < 200:
            break
        out.append(cel)
    return out


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    entrada = sys.argv[1]
    salida = sys.argv[2] if len(sys.argv) > 2 else entrada
    if not os.path.exists(entrada):
        print(f'No existe: {entrada}')
        return 2

    img = Image.open(entrada).convert('RGBA')
    cols, filas = img.width // FW, img.height // FH
    out = img.copy()

    print(f'{os.path.basename(entrada)}  ({cols} columnas x {filas} filas)\n')
    total = 0
    for fila in range(filas):
        frames = frames_de_fila(img, fila, cols)
        if len(frames) < 2:
            continue
        rotos = [i for i, f in enumerate(frames) if clip_info(f) is not None]
        if not rotos:
            continue

        reparados, hechos = repair_clipped(frames)
        if not hechos:
            print(f'  fila {fila + 1}: {len(rotos)} recortado(s), pero no hay ningún '
                  'frame sano en la fila para usar de plantilla')
            continue

        for i, lado, ref in hechos:
            out.paste(reparados[i], (i * FW, fila * FH))
            print(f'  fila {fila + 1}, frame {i + 1}: reconstruido el lado '
                  f'{"izquierdo" if lado == "left" else "derecho"} '
                  f'(plantilla: frame {ref + 1})')
            total += 1

    if not total:
        print('  No hay frames recortados: el arte ya está limpio.')
        return 0

    out.save(salida, lossless=True)
    print(f'\n{total} frame(s) reparado(s) -> {salida}')
    print('Comprueba el resultado con:  npm run sprites:check -- ' + salida)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
