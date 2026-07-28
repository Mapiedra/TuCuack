"""
Reordena el arte del pato duro al formato estándar de 9 filas.

El arte original venía con 11 filas repartidas de forma irregular, tres de ellas
sin usar. Este script lo reescribe con una acción por fila, en el orden que
describe docs/DISENOS.md, para que sirva de referencia al generar los demás
diseños y para que el proyecto tenga un único formato.

Qué hace con cada fila:
  - copia las celdas tal cual (no reescala ni retoca el dibujo),
  - voltea la fila de andar, que en el original mira a la izquierda,
  - compone la fila de jugar ordenando las poses de "chulesco" por el ángulo
    del bate, de menos a más y vuelta: es el swing que el empaquetador venía
    generando al vuelo, pero ya resuelto en el arte.

Uso:  python tools/migrate_source_layout.py [entrada.webp] [salida.webp]
"""

import os
import sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pack_sprites import FW, FH, bat_angle, normalize  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FUENTES = os.path.join(ROOT, 'assets', 'sprites', 'fuentes')

COLS = 8

# Fila de destino -> (fila de origen, nº de frames, voltear)
# El orden es el de docs/DISENOS.md.
MAPA = [
    ('idle',  0,  7, False),
    ('walk',  1,  8, True),    # el original mira a la izquierda
    ('eat',   9,  8, False),
    ('play',  7,  6, False),   # se recompone como swing (ver abajo)
    ('sleep', 10, 8, False),
    ('happy', 3,  4, False),
    ('talk',  6,  6, False),
    ('sad',   8,  6, False),
    ('cool',  7,  6, False),
]


def celda(img, fila, col):
    return img.crop((col * FW, fila * FH, (col + 1) * FW, (fila + 1) * FH))


def orden_swing(img, fila, n):
    """Índices de la fila ordenados por ángulo del bate, ida y vuelta."""
    angulos = []
    for c in range(n):
        # El ángulo se mide sobre el frame normalizado, que es donde el bate
        # queda aislado de forma fiable.
        a = bat_angle(normalize(celda(img, fila, c)))
        if a is not None:
            angulos.append((a, c))
    if len(angulos) < 3:
        return list(range(n))
    angulos.sort()
    subida = [c for _a, c in angulos]
    # Vuelta sin repetir los extremos, hasta llenar las columnas disponibles.
    bajada = subida[-2:0:-1]
    return (subida + bajada)[:COLS]


def main():
    entrada = sys.argv[1] if len(sys.argv) > 1 else os.path.join(FUENTES, 'duro.webp')
    salida = sys.argv[2] if len(sys.argv) > 2 else entrada
    img = Image.open(entrada).convert('RGBA')

    out = Image.new('RGBA', (FW * COLS, FH * len(MAPA)), (0, 0, 0, 0))
    print(f'{os.path.basename(entrada)} -> formato estándar de {len(MAPA)} filas\n')

    for destino, (nombre, origen, n, voltear) in enumerate(MAPA):
        if nombre == 'play':
            indices = orden_swing(img, origen, n)
            detalle = f'fila {origen + 1} ordenada por el ángulo del bate'
        else:
            indices = list(range(n))
            detalle = f'fila {origen + 1}' + (' (volteada)' if voltear else '')

        for col, src_col in enumerate(indices):
            cel = celda(img, origen, src_col)
            if voltear:
                cel = cel.transpose(Image.FLIP_LEFT_RIGHT)
            out.paste(cel, (col * FW, destino * FH), cel)

        print(f'  fila {destino + 1}  {nombre:6s} {len(indices)} frames   <- {detalle}')

    out.save(salida, lossless=True)
    print(f'\nGuardado: {salida}  ({out.width}x{out.height})')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
