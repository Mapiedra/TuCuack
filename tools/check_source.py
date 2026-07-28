"""
Revisa un arte fuente antes de darlo por bueno.

Las IA de imagen respetan mal las rejillas: es normal que el personaje cambie de
tamaño entre celdas, que se salga por un borde o que falten filas. Este script lo
dice antes de empaquetar, para no descubrirlo cuando el pato ya está andando por
la pantalla sin cola.

Uso:
    python tools/check_source.py assets/sprites/fuentes/ganster.webp
    python tools/check_source.py ruta/al/arte.png --guardar-contacto
"""

import os
import sys
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pack_sprites import FW, FH, clip_info  # noqa: E402

# Filas que el juego necesita: (índice, frames, para qué)
REQUERIDAS = [
    (0, 7, 'quieto'),
    (1, 8, 'caminando (mirando a la izquierda)'),
    (3, 4, 'saludando con el ala'),
    (6, 6, 'hablando'),
    (7, 6, 'ajustándose las gafas'),
    (8, 6, 'triste'),
    (9, 8, 'comiendo'),
    (10, 8, 'agachado'),
]


def celda(img, fila, col):
    return img.crop((col * FW, fila * FH, (col + 1) * FW, (fila + 1) * FH))


def alto_cuerpo(im):
    """Alto del personaje en la celda, por su parte no transparente."""
    a = np.array(im)
    ys, xs = np.where(a[:, :, 3] > 20)
    if len(ys) == 0:
        return None
    return int(ys.max() - ys.min() + 1)


def toca_borde(im, margen=1):
    a = np.array(im)
    ys, xs = np.where(a[:, :, 3] > 20)
    if len(ys) == 0:
        return []
    lados = []
    if xs.min() <= margen: lados.append('izquierda')
    if xs.max() >= FW - 1 - margen: lados.append('derecha')
    if ys.min() <= margen: lados.append('arriba')
    if ys.max() >= FH - 1 - margen: lados.append('abajo')
    return lados


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    ruta = sys.argv[1]
    if not os.path.exists(ruta):
        print(f'No existe: {ruta}')
        return 2

    img = Image.open(ruta).convert('RGBA')
    W, H = img.size
    cols, filas = W // FW, H // FH
    print(f'Arte: {os.path.basename(ruta)}  ({W}x{H})')
    print(f'Rejilla de {FW}x{FH} -> {cols} columnas x {filas} filas')

    problemas, avisos = [], []
    if W % FW or H % FH:
        problemas.append(
            f'El tamaño no es múltiplo exacto de {FW}x{FH} '
            f'(sobran {W % FW}px de ancho y {H % FH}px de alto). '
            'La rejilla quedará descuadrada.')

    print('\nFilas que necesita el juego:')
    altos = []
    for fila, n, para_que in REQUERIDAS:
        if fila >= filas:
            problemas.append(f'Falta la fila {fila} ({para_que}).')
            print(f'  fila {fila:2d}  FALTA           {para_que}')
            continue

        vacias, cortadas, recortes = 0, [], []
        for c in range(n):
            if c >= cols:
                vacias += 1
                continue
            cel = celda(img, fila, c)
            h = alto_cuerpo(cel)
            if h is None:
                vacias += 1
                continue
            altos.append(h)
            lados = toca_borde(cel)
            if lados:
                cortadas.append(f'{c}({"/".join(lados)})')
            if clip_info(cel) is not None:
                recortes.append(str(c))

        estado = 'ok'
        if vacias:
            problemas.append(f'La fila {fila} ({para_que}) tiene {vacias} de {n} celdas vacías.')
            estado = f'{vacias} vacías'
        if cortadas:
            avisos.append(f'Fila {fila}: el dibujo toca el borde en {", ".join(cortadas)}.')
            estado = 'toca el borde'
        if recortes:
            avisos.append(f'Fila {fila}: el contorno sale plano en {", ".join(recortes)} '
                          '(al personaje le falta un trozo).')
            estado = 'recortado'
        print(f'  fila {fila:2d}  {estado:14s}  {para_que}')

    if altos:
        lo, hi = min(altos), max(altos)
        var = 100 * (hi - lo) / hi
        print(f'\nTamaño del personaje: entre {lo} y {hi} px ({var:.0f}% de diferencia)')
        if var > 25:
            avisos.append(f'El personaje cambia mucho de tamaño entre celdas ({var:.0f}%). '
                          'Se normaliza al empaquetar, pero si la diferencia es enorme '
                          'las poses no encajarán bien entre sí.')

    if '--guardar-contacto' in sys.argv:
        salida = os.path.splitext(ruta)[0] + '-contacto.png'
        hoja_contacto(img, cols, filas).save(salida)
        print(f'\nHoja de contacto: {salida}')

    print()
    for p in problemas:
        print(f'  [PROBLEMA] {p}')
    for a in avisos:
        print(f'  [aviso]    {a}')

    if problemas:
        print(f'\n{len(problemas)} problema(s): este arte no se puede usar tal cual.')
        return 1
    if avisos:
        print(f'\nSin problemas graves, {len(avisos)} aviso(s). El empaquetador intentará '
              'corregirlos, pero el resultado será mejor si se arreglan en origen.')
    else:
        print('\nTodo correcto: listo para `npm run sprites`.')
    return 0


def hoja_contacto(img, cols, filas, escala=0.3):
    fw, fh = int(FW * escala), int(FH * escala)
    out = Image.new('RGB', (30 + fw * cols, fh * filas), (40, 42, 52))
    d = ImageDraw.Draw(out)
    for r in range(filas):
        d.text((5, r * fh + fh // 2), str(r), fill=(255, 255, 255))
        for c in range(cols):
            out.paste(celda(img, r, c).resize((fw, fh)).convert('RGB'),
                      (30 + c * fw, r * fh))
    return out


if __name__ == '__main__':
    raise SystemExit(main())
