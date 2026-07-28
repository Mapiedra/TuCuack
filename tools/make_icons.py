"""
Genera los iconos de la aplicación a partir del sprite del pato.

Salida:
  assets/icons/tucuack.ico  icono de app e instalador (varios tamaños)
  assets/icons/tray.png     icono de la bandeja del sistema

Uso:  python tools/make_icons.py
"""

import json
import os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEET = os.path.join(ROOT, 'assets', 'sprites', 'duck.png')
META = os.path.join(ROOT, 'assets', 'sprites', 'duck.json')
ICON_DIR = os.path.join(ROOT, 'assets', 'icons')

ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]


def pick_frame():
    """Toma el primer frame de 'idle' del sprite ya empaquetado."""
    meta = json.load(open(META, encoding='utf8'))
    w, h = meta['frameW'], meta['frameH']
    row = meta['animations']['idle']['row']
    sheet = Image.open(SHEET).convert('RGBA')
    return sheet.crop((0, row * h, w, (row + 1) * h))


def trimmed_square(im, pad_ratio=0.06):
    """Recorta al contenido y lo centra en un lienzo cuadrado con margen."""
    a = np.array(im)
    ys, xs = np.where(a[:, :, 3] > 20)
    im = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    side = int(max(im.size) * (1 + pad_ratio * 2))
    out = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    out.paste(im, ((side - im.width) // 2, (side - im.height) // 2), im)
    return out


def main():
    os.makedirs(ICON_DIR, exist_ok=True)
    base = trimmed_square(pick_frame())

    ico_path = os.path.join(ICON_DIR, 'tucuack.ico')
    base.resize((256, 256), Image.LANCZOS).save(
        ico_path, format='ICO', sizes=[(s, s) for s in ICO_SIZES]
    )

    tray_path = os.path.join(ICON_DIR, 'tray.png')
    base.resize((32, 32), Image.LANCZOS).save(tray_path)

    png_path = os.path.join(ICON_DIR, 'tucuack.png')
    base.resize((512, 512), Image.LANCZOS).save(png_path)

    print(f'{ico_path}  ({", ".join(str(s) for s in ICO_SIZES)})')
    print(f'{tray_path}  (32x32)')
    print(f'{png_path}  (512x512)')


if __name__ == '__main__':
    main()
