"""
Recupera un arte fuente exportado como JPG (o PNG sin transparencia).

Cuando el sheet se guarda en un formato sin canal alfa, el fondo transparente
acaba dibujado como un tablero de cuadros grises. Este script lo quita y deja la
imagen a la resolución de la rejilla.

Es un apaño: el JPG comprime con pérdida y los bordes del dibujo quedan sucios,
así que el resultado nunca será tan bueno como el PNG original. Sirve para ver
si un diseño encaja antes de pedir el fichero bueno.

Uso:
    python tools/import_source.py entrada.jpg salida.webp
    python tools/import_source.py entrada.jpg          (deja .webp al lado)
"""

import os
import sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pack_sprites import FW, FH  # noqa: E402

# El tablero de transparencia son dos grises. Se considera fondo lo que sea
# gris (sin color) y esté dentro de ese rango de claridad: los contornos del
# dibujo son más oscuros y los brillos más claros.
GRIS_MIN, GRIS_MAX = 55, 150
SATURACION_MAX = 22        # diferencia máxima entre canales para llamarlo gris


def quitar_tablero(im):
    a = np.array(im.convert('RGB')).astype(int)
    mx = a.max(axis=2)
    mn = a.min(axis=2)
    gris = (mx - mn) <= SATURACION_MAX
    en_rango = (mx >= GRIS_MIN) & (mx <= GRIS_MAX)
    fondo = gris & en_rango

    # Los huecos sueltos dentro del dibujo (un gris del sombreado) no son fondo:
    # sólo se quita lo que conecta con el borde de la imagen.
    fondo = _solo_desde_el_borde(fondo)

    out = np.dstack([a.astype(np.uint8),
                     np.where(fondo, 0, 255).astype(np.uint8)])
    return Image.fromarray(out, 'RGBA')


def _solo_desde_el_borde(mask):
    """Se queda con la parte de `mask` conectada con el borde de la imagen."""
    from collections import deque
    h, w = mask.shape
    fuera = np.zeros_like(mask)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if mask[y, x] and not fuera[y, x]:
                fuera[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if mask[y, x] and not fuera[y, x]:
                fuera[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not fuera[ny, nx]:
                fuera[ny, nx] = True
                q.append((ny, nx))
    return fuera


def limpiar_motas(a, minimo=400, alto_minimo=60):
    """Borra los restos sueltos que deja la exportación.

    Son de dos clases: motas diminutas de la compresión, y trozos de dibujo que
    quedan en celdas donde no hay personaje (marcas, sobras del render). Sin
    quitarlos, una celda vacía parece tener dibujo y las medidas del comprobador
    salen falseadas.

    Se descarta lo que sea muy pequeño de área o demasiado bajo para ser el
    personaje. Modifica `a` en el sitio y devuelve cuántos ha quitado.
    """
    from collections import deque
    al = a[:, :, 3] > 20
    h, w = al.shape
    visto = np.zeros_like(al)
    quitadas = 0
    ys, xs = np.where(al)
    for sy, sx in zip(ys, xs):
        if visto[sy, sx]:
            continue
        q = deque([(sy, sx)])
        visto[sy, sx] = True
        grupo = [(sy, sx)]
        while q:
            y, x = q.popleft()
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and al[ny, nx] and not visto[ny, nx]:
                        visto[ny, nx] = True
                        q.append((ny, nx))
                        grupo.append((ny, nx))
        gy = [p[0] for p in grupo]
        alto = max(gy) - min(gy) + 1
        if len(grupo) < minimo or alto < alto_minimo:
            for y, x in grupo:
                a[y, x] = (0, 0, 0, 0)
            quitadas += 1
    return quitadas


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    entrada = sys.argv[1]
    if not os.path.exists(entrada):
        print(f'No existe: {entrada}')
        return 2
    salida = sys.argv[2] if len(sys.argv) > 2 else os.path.splitext(entrada)[0] + '.webp'

    im = Image.open(entrada)
    print(f'{os.path.basename(entrada)}  {im.size[0]}x{im.size[1]}  ({im.mode})')

    if im.mode == 'RGBA' and np.array(im)[:, :, 3].min() < 255:
        print('  ya tiene transparencia: sólo se ajusta el tamaño')
        rgba = im.convert('RGBA')
    else:
        rgba = quitar_tablero(im)
        n = (np.array(rgba)[:, :, 3] == 0).sum()
        print(f'  fondo de cuadros eliminado ({100 * n / (im.size[0] * im.size[1]):.0f}% de la imagen)')

    # Se deduce la rejilla por proporción y se lleva al tamaño exacto de celda.
    cols = 8
    filas = round(rgba.height / (rgba.width / cols) * (FW / FH))
    destino = (FW * cols, FH * filas)
    print(f'  rejilla deducida: {cols} columnas x {filas} filas -> {destino[0]}x{destino[1]}')

    rgba = rgba.resize(destino, Image.LANCZOS)
    # El reescalado difumina el alfa; se vuelve a hacer binario para que el
    # empaquetador distinga bien dónde acaba el dibujo.
    a = np.array(rgba)
    a[:, :, 3] = np.where(a[:, :, 3] > 128, 255, 0)

    quitadas = limpiar_motas(a)
    if quitadas:
        print(f'  {quitadas} mota(s) de ruido eliminada(s)')

    Image.fromarray(a).save(salida, lossless=True)
    print(f'\nGuardado: {salida}')
    print('Compruébalo con:  npm run sprites:check -- ' + salida)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
