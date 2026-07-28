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
    # El arte original no tiene estas dos: se derivan del saludo (fila 4) con un
    # aleteo y un balanceo. Son un apaño para no dejar huecos en la referencia;
    # los diseños nuevos deben traerlas dibujadas, para que no compartan dibujo
    # con "contento".
    ('flap',  3,  4, False),
    ('drag',  3,  4, False),
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


def _mover(cel, dx=0, dy=0):
    out = Image.new('RGBA', cel.size, (0, 0, 0, 0))
    out.paste(cel, (dx, dy), cel)
    return out


def aletear(base, n=6):
    """Aleteo: el saludo con el cuerpo subiendo y bajando, como sosteniéndose.

    El recorrido es pequeño a propósito: el personaje ya llena casi la celda y
    con más amplitud se saldría por el borde.
    """
    seq = [0, 1, 2, 3, 2, 1]
    return [_mover(base[seq[i] % len(base)],
                   dy=int(round(-2 * np.sin(i / n * 2 * np.pi))))
            for i in range(n)]


def colgando(base, n=6):
    """Colgando del cursor: se balancea de lado a lado.

    Se mueve en horizontal en vez de girar: el personaje llega casi al borde
    superior de la celda y cualquier rotación le corta la cabeza.
    """
    return [_mover(base[i % len(base)],
                   dx=int(round(3 * np.sin(i / n * 2 * np.pi))))
            for i in range(n)]


def completar(entrada, salida):
    """Añade a un arte que ya está en formato estándar las filas que le falten.

    Se usa cuando el formato crece: el arte no hay que rehacerlo, sólo
    completarlo. Las filas nuevas se derivan de las que ya hay, con el aviso de
    que en un diseño nuevo deberían venir dibujadas.
    """
    from pack_sprites import LAYOUT_ESTANDAR
    img = Image.open(entrada).convert('RGBA')
    cols = img.width // FW
    tiene = img.height // FH
    faltan = [(f, n) for f, n, _fps, _fl in LAYOUT_ESTANDAR if f >= tiene]
    if not faltan:
        print(f'{os.path.basename(entrada)} ya tiene las {tiene} filas del formato.')
        return 0

    nombres = {n: f for f, n, _fps, _fl in LAYOUT_ESTANDAR}
    out = Image.new('RGBA', (FW * cols, FH * len(LAYOUT_ESTANDAR)), (0, 0, 0, 0))
    out.paste(img, (0, 0))
    base = [celda(img, nombres['happy'], c) for c in range(4)]

    print(f'{os.path.basename(entrada)}: {tiene} filas -> {len(LAYOUT_ESTANDAR)}\n')
    for fila, nombre in faltan:
        celdas = aletear(base) if nombre == 'flap' else colgando(base)
        for col, cel in enumerate(celdas):
            out.paste(cel, (col * FW, fila * FH), cel)
        print(f'  fila {fila + 1}  {nombre:6s} {len(celdas)} frames   '
              f'<- derivada de "contento" (en un diseño nuevo, dibújala aparte)')

    out.save(salida, lossless=True)
    print(f'\nGuardado: {salida}  ({out.width}x{out.height})')
    return 0


def main():
    if '--completar' in sys.argv:
        args = [a for a in sys.argv[1:] if not a.startswith('--')]
        entrada = args[0] if args else os.path.join(FUENTES, 'duro.webp')
        return completar(entrada, args[1] if len(args) > 1 else entrada)

    entrada = sys.argv[1] if len(sys.argv) > 1 else os.path.join(FUENTES, 'duro.webp')
    salida = sys.argv[2] if len(sys.argv) > 2 else entrada
    img = Image.open(entrada).convert('RGBA')

    out = Image.new('RGBA', (FW * COLS, FH * len(MAPA)), (0, 0, 0, 0))
    print(f'{os.path.basename(entrada)} -> formato estándar de {len(MAPA)} filas\n')

    for destino, (nombre, origen, n, voltear) in enumerate(MAPA):
        if nombre == 'play':
            indices = orden_swing(img, origen, n)
            detalle = f'fila {origen + 1} ordenada por el ángulo del bate'
        elif nombre in ('flap', 'drag'):
            indices = None            # se generan aparte, más abajo
            detalle = f'derivada de la fila {origen + 1}'
        else:
            indices = list(range(n))
            detalle = f'fila {origen + 1}' + (' (volteada)' if voltear else '')

        if indices is None:
            base = [celda(img, origen, c) for c in range(n)]
            celdas = (aletear(base) if nombre == 'flap' else colgando(base))
        else:
            celdas = []
            for src_col in indices:
                cel = celda(img, origen, src_col)
                if voltear:
                    cel = cel.transpose(Image.FLIP_LEFT_RIGHT)
                celdas.append(cel)

        for col, cel in enumerate(celdas):
            out.paste(cel, (col * FW, destino * FH), cel)

        print(f'  fila {destino + 1}  {nombre:6s} {len(celdas)} frames   <- {detalle}')

    out.save(salida, lossless=True)
    print(f'\nGuardado: {salida}  ({out.width}x{out.height})')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
