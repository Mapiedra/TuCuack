"""
Genera diseños PROVISIONALES de pato a partir de uno ya empaquetado.

Son un apaño para poder probar el sistema de niveles y desbloqueos mientras no
exista el arte de verdad: se limitan a teñir el sheet base, así que el pato
sigue llevando las mismas gafas y el mismo bate. En cuanto haya arte propio para
un diseño, se deja en assets/sprites/fuentes/<id>.webp, se ejecuta
`npm run sprites` y este script deja de tocarlo.

Uso:  python tools/make_placeholder_skins.py
"""

import json
import os
import shutil
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPRITES = os.path.join(ROOT, 'assets', 'sprites')
FUENTES = os.path.join(SPRITES, 'fuentes')
BASE = 'duro'

# (id, desplazamiento de tono, saturación, brillo)
VARIANTES = [
    ('normal', 8, 0.55, 1.12),    # amarillo pálido, sin estridencias
    ('hembra', -52, 0.65, 1.10),  # rosado
    ('ganster', 190, 0.45, 0.80), # azul apagado, tonos de traje
    ('capo', -6, 1.10, 0.62),     # dorado oscuro, casi bronce
]


def tenir(im, giro_tono, sat, brillo):
    """Tiñe conservando la transparencia y las zonas casi negras (contornos)."""
    a = np.array(im).astype(np.float32)
    rgb = a[:, :, :3]
    alpha = a[:, :, 3:4]

    hsv = np.array(Image.fromarray(a[:, :, :3].astype(np.uint8), 'RGB').convert('HSV')).astype(np.float32)
    h, s, v = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]

    # Los contornos y las gafas (muy oscuros) se dejan como están: si se tiñen,
    # el dibujo pierde su definición.
    oscuro = v < 60

    h2 = (h + giro_tono * 255.0 / 360.0) % 255.0
    s2 = np.clip(s * sat, 0, 255)
    v2 = np.clip(v * brillo, 0, 255)
    h2 = np.where(oscuro, h, h2)
    s2 = np.where(oscuro, s, s2)
    v2 = np.where(oscuro, v, v2)

    nuevo = np.stack([h2, s2, v2], axis=2).astype(np.uint8)
    rgb2 = np.array(Image.fromarray(nuevo, 'HSV').convert('RGB')).astype(np.float32)
    out = np.concatenate([rgb2, alpha], axis=2).astype(np.uint8)
    return Image.fromarray(out)


def main():
    base_png = os.path.join(SPRITES, f'duck-{BASE}.png')
    base_json = os.path.join(SPRITES, f'duck-{BASE}.json')
    if not os.path.exists(base_png):
        print(f'Falta {base_png}: ejecuta antes `npm run sprites`.')
        return 1

    im = Image.open(base_png).convert('RGBA')
    hechos = []
    for ident, tono, sat, brillo in VARIANTES:
        # Si ya hay arte propio para ese diseño, no se pisa.
        propio = [f'{ident}.webp', f'{ident}.png']
        if any(os.path.exists(os.path.join(FUENTES, p)) for p in propio):
            print(f'  {ident}: tiene arte propio, no se toca')
            continue
        tenir(im, tono, sat, brillo).save(os.path.join(SPRITES, f'duck-{ident}.png'))
        shutil.copyfile(base_json, os.path.join(SPRITES, f'duck-{ident}.json'))
        hechos.append(ident)
        print(f'  {ident}: provisional generado (teñido de "{BASE}")')

    if hechos:
        print(f'\n{len(hechos)} diseño(s) provisional(es). Sustitúyelos dejando su arte '
              f'en assets/sprites/fuentes/<id>.webp y ejecutando `npm run sprites`.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
