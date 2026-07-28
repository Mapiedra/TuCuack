"""
Empaqueta el sprite sheet del pato a partir del arte fuente.

Problemas del arte fuente que resuelve este script:
  * Cada frame tiene el pato a distinta escala y a distinta altura, de modo que
    al animar el pato "salta" y "cambia de tamaño".
  * El bate sobresale del frame y se corta en los bordes.

Solución: se segmenta el CUERPO del pato por color (amarillo/naranja, R>=190,
frente al marrón del bate), y con ese bbox se normaliza cada frame:
  - escala uniforme para que la altura del cuerpo sea constante,
  - alineación por los pies (base) y por el centro horizontal del cuerpo,
  - canvas de salida con padding para que el bate nunca se corte.

Además compone animaciones que el arte fuente no trae como tales:
  - dormir y aletear, a partir de frames base con transformaciones suaves,
  - el swing del bate, reordenando por ángulo los frames de una fila (medido
    con el eje principal de la máscara del bate).

Uso:  python tools/pack_sprites.py
Salida: assets/sprites/duck.png + assets/sprites/duck.json
"""

import json
import os
import sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'sprites', 'spritesheet-source.webp')
OUT_PNG = os.path.join(ROOT, 'assets', 'sprites', 'duck.png')
OUT_JSON = os.path.join(ROOT, 'assets', 'sprites', 'duck.json')

FW, FH = 192, 208          # rejilla del arte fuente

# Lienzo de salida. Con margen suficiente para que el bate, al rotar en el
# swing, no se salga por los bordes.
OUT_W, OUT_H = 232, 240
TARGET_BODY_H = 132        # altura constante del cuerpo (sin bate) en px
GROUND_Y = OUT_H - 14      # línea del suelo dentro del lienzo de salida

# Todas las filas del arte fuente miran a la DERECHA -> dirección canónica.
CANON_FACING = 'right'


def load_source():
    return Image.open(SRC).convert('RGBA')


def frame(img, row, col, flip=False):
    """Recorta un frame del arte fuente y le quita lo que no le pertenece.

    `flip` voltea las filas dibujadas mirando a la izquierda, para dejar todas
    las animaciones en la misma dirección canónica.
    """
    fr = img.crop((col * FW, row * FH, (col + 1) * FW, (row + 1) * FH))
    if flip:
        fr = fr.transpose(Image.FLIP_LEFT_RIGHT)
    return drop_intruders(fr)


def drop_intruders(im):
    """Quita el trozo del pato vecino que algunos frames traen pegado al borde.

    OJO: no vale con quedarse con el blob más grande. Al caminar, la pata
    levantada queda desconectada del cuerpo y es un blob propio: filtrarla
    dejaba al pato sin patas. El criterio correcto es descartar sólo los blobs
    que ENTRAN POR EL BORDE del frame (por donde invade el vecino); todo lo que
    queda dentro —patas, cola, punta del bate— se conserva.
    """
    a = np.array(im)
    al = a[:, :, 3] > 20
    if not al.any():
        return im
    h, w = al.shape
    labels, count = _label(al)
    if count <= 1:
        return im

    sizes = [int((labels == i).sum()) for i in range(1, count + 1)]
    main = int(np.argmax(sizes)) + 1

    out = a.copy()
    for i in range(1, count + 1):
        if i == main:
            continue
        comp = labels == i
        ys, xs = np.where(comp)
        touches_edge = (xs.min() == 0 or xs.max() == w - 1
                        or ys.min() == 0 or ys.max() == h - 1)
        if touches_edge:
            out[comp] = (0, 0, 0, 0)
    return Image.fromarray(out)


def _label(mask):
    """Etiquetado de componentes conexos (8-conectividad). -> (labels, count)"""
    from collections import deque
    h, w = mask.shape
    labels = np.zeros((h, w), dtype=np.int32)
    count = 0
    ys, xs = np.where(mask)
    for sy, sx in zip(ys, xs):
        if labels[sy, sx]:
            continue
        count += 1
        q = deque([(sy, sx)])
        labels[sy, sx] = count
        while q:
            y, x = q.popleft()
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not labels[ny, nx]:
                        labels[ny, nx] = count
                        q.append((ny, nx))
    return labels, count


def clip_info(im, min_flat=50):
    """Detecta si al frame le falta un trozo del cuerpo por el borde.

    Varios frames del arte fuente traen el pato recortado: el contorno, en vez
    de ser redondeado, es una línea vertical recta (el dibujo no cabía en su
    celda). Se mide cuántas filas arrancan en la misma columna; el bate, que es
    recto de por sí, produce ~30 y no cuenta como corte.

    -> (lado, x_corte) con lado en {'left','right'} o None si está sano.
    """
    a = np.array(im)
    al = a[:, :, 3] > 20
    rows = [y for y in range(al.shape[0]) if al[y].any()]
    if not rows:
        return None
    first = np.array([np.where(al[y])[0].min() for y in rows])
    last = np.array([np.where(al[y])[0].max() for y in rows])
    flat_l = int((first <= first.min() + 1).sum())
    flat_r = int((last >= last.max() - 1).sum())
    if flat_l >= min_flat and flat_l >= flat_r:
        return ('left', int(first.min()))
    if flat_r >= min_flat:
        return ('right', int(last.max()))
    return None


def _best_offset(target, ref, exclude_band):
    """Desplazamiento (dx, dy) que mejor encaja `ref` sobre `target`.

    El encaje se mide sólo en la zona sana del frame (fuera de `exclude_band`),
    para que el trozo que falta no sesgue la alineación.
    """
    t = np.array(target)[:, :, 3] > 20
    r = np.array(ref)[:, :, 3] > 20
    x0, x1 = exclude_band
    zone = np.zeros_like(t)
    zone[:, x1:] = True
    zone[:, :x0] = True
    best, best_score = (0, 0), -1
    for dy in range(-8, 9, 2):
        for dx in range(-14, 15, 2):
            shifted = np.roll(np.roll(r, dy, axis=0), dx, axis=1)
            inter = (shifted & t & zone).sum()
            union = ((shifted | t) & zone).sum()
            score = inter / union if union else 0
            if score > best_score:
                best_score, best = score, (dx, dy)
    return best


def repair_clipped(frames):
    """Completa los frames recortados usando uno sano de la misma animación.

    El pato apenas cambia de forma dentro de un ciclo (lo que se mueve son las
    patas), así que el frame sano sirve de plantilla para devolverle al recortado
    el trozo de cuerpo que le falta, con su arte real en vez de un parche liso.
    """
    infos = [clip_info(f) for f in frames]
    healthy = [i for i, inf in enumerate(infos) if inf is None]
    if not healthy or all(inf is None for inf in infos):
        return frames, []

    out = list(frames)
    repaired = []
    for i, inf in enumerate(infos):
        if inf is None:
            continue
        side, xcut = inf
        # Frame sano más cercano: la pose es más parecida.
        ref_idx = min(healthy, key=lambda h: abs(h - i))
        ref = frames[ref_idx]

        band = (max(0, xcut - 30), min(frames[0].width, xcut + 30))
        dx, dy = _best_offset(frames[i], ref, band)

        a = np.array(frames[i]).copy()
        r = np.array(ref)
        r = np.roll(np.roll(r, dy, axis=0), dx, axis=1)

        hole = (a[:, :, 3] <= 20) & (r[:, :, 3] > 20)
        cols = np.zeros(a.shape[1], dtype=bool)
        if side == 'left':
            cols[:xcut + 4] = True
        else:
            cols[max(0, xcut - 3):] = True
        hole &= cols[None, :]

        a[hole] = r[hole]
        out[i] = Image.fromarray(a)
        repaired.append((i, side, ref_idx))
    return out, repaired


def body_bbox(im):
    """bbox del cuerpo del pato (amarillo + naranja), excluyendo el bate marrón."""
    a = np.array(im)
    al = a[:, :, 3] > 30
    R = a[:, :, 0].astype(int)
    G = a[:, :, 1].astype(int)
    body = al & (R >= 190) & (G >= 60)
    ys, xs = np.where(body)
    if len(ys) == 0:
        return None
    return xs.min(), ys.min(), xs.max(), ys.max()


def normalize(im):
    """Escala y alinea un frame: cuerpo de altura fija, pies en GROUND_Y."""
    bb = body_bbox(im)
    if bb is None:
        return Image.new('RGBA', (OUT_W, OUT_H), (0, 0, 0, 0))
    x0, y0, x1, y1 = bb
    h = y1 - y0 + 1
    s = TARGET_BODY_H / h

    nw, nh = max(1, int(round(im.width * s))), max(1, int(round(im.height * s)))
    scaled = im.resize((nw, nh), Image.LANCZOS)

    bb2 = body_bbox(scaled)
    if bb2 is None:
        return Image.new('RGBA', (OUT_W, OUT_H), (0, 0, 0, 0))
    sx0, sy0, sx1, sy1 = bb2
    cx = (sx0 + sx1) / 2.0          # centro horizontal del cuerpo
    feet = sy1                       # base del cuerpo (pies)

    canvas = Image.new('RGBA', (OUT_W, OUT_H), (0, 0, 0, 0))
    dx = int(round(OUT_W / 2.0 - cx))
    dy = int(round(GROUND_Y - feet))
    canvas.paste(scaled, (dx, dy), scaled)
    return canvas


def bob(im, dy):
    """Desplaza verticalmente un frame ya normalizado (para dar vida sutil)."""
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    out.paste(im, (0, dy), im)
    return out


def scale_about_feet(im, fx, fy):
    """Escala un frame normalizado dejando fijos los pies (GROUND_Y) y el centro."""
    nw, nh = max(1, int(round(im.width * fx))), max(1, int(round(im.height * fy)))
    sc = im.resize((nw, nh), Image.LANCZOS)
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    # El punto (cx, GROUND_Y) debe seguir en el mismo sitio tras escalar.
    dx = int(round(im.width / 2.0 - (im.width / 2.0) * fx))
    dy = int(round(GROUND_Y - GROUND_Y * fy))
    out.paste(sc, (dx, dy), sc)
    return out


def rotate_about(im, angle, pivot):
    """Rota un frame alrededor de un punto (pivot) sin recortar."""
    px, py = pivot
    out = im.rotate(angle, resample=Image.BICUBIC, center=(px, py))
    return out


# --- Segmentación del bate y swing --------------------------------------

def _dilate(mask, r=1):
    out = mask.copy()
    for _ in range(r):
        acc = out.copy()
        acc[1:, :] |= out[:-1, :]
        acc[:-1, :] |= out[1:, :]
        acc[:, 1:] |= out[:, :-1]
        acc[:, :-1] |= out[:, 1:]
        out = acc
    return out


def _erode(mask, r=1):
    return ~_dilate(~mask, r)


def _largest_component(mask):
    """Mayor componente conexo (8-conectividad) de una máscara booleana."""
    from collections import deque
    h, w = mask.shape
    seen = np.zeros_like(mask)
    best = np.zeros_like(mask)
    best_n = 0
    ys, xs = np.where(mask)
    for sy, sx in zip(ys, xs):
        if seen[sy, sx]:
            continue
        cur = np.zeros_like(mask)
        q = deque([(sy, sx)])
        seen[sy, sx] = True
        cur[sy, sx] = True
        n = 1
        while q:
            y, x = q.popleft()
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        cur[ny, nx] = True
                        n += 1
                        q.append((ny, nx))
        if n > best_n:
            best_n = n
            best = cur
    return best


def bat_mask(im):
    """Aísla el bate (madera + pinchos + su contorno) por color y conectividad."""
    from collections import deque
    a = np.array(im)
    al = a[:, :, 3] > 30
    R = a[:, :, 0].astype(int)
    G = a[:, :, 1].astype(int)
    B = a[:, :, 2].astype(int)
    body = al & (R >= 190) & (G >= 60)
    brown = al & (R >= 60) & (R < 190) & (G <= 135) & (G < R)
    gray = al & (abs(R - G) < 40) & (abs(G - B) < 40) & (R > 90)
    cand = brown | gray
    if not cand.any():
        return None, body
    h, w = cand.shape
    # El bate es el componente conexo MÁS GRANDE de la máscara. (Tomar el más
    # alto fallaba: en varios frames el píxel superior es una mota aislada y la
    # máscara resultante se quedaba en unas decenas de píxeles.)
    comp = _largest_component(cand)
    # Incluir el contorno oscuro del bate (queda fuera del filtro de color).
    comp = comp | (_dilate(comp, 2) & al & ~body)

    # Los PINCHOS del bate son naranja brillante, idéntico al pico y las patas,
    # así que el filtro de color los toma por "cuerpo". Se distinguen porque
    # sobresalen AL AIRE, fuera de la silueta del pato: se cierra la silueta
    # (rellenando gafas, cadena y contornos interiores) y se suma al bate todo
    # lo que quede fuera de ella en el entorno del bate.
    silhouette = _erode(_dilate(body, 12), 12)
    near_bat = _dilate(comp, 8) & al & ~silhouette
    # Los pinchos que caen SOBRE el cuerpo no se distinguen por silueta, pero
    # están adosados a la madera: un cierre morfológico del bate los engloba.
    adjacent = _erode(_dilate(comp, 7), 7) & al
    comp = comp | near_bat | adjacent
    return comp, body


def bat_angle(im):
    """Ángulo del bate en grados (90 = vertical), por el eje principal de su
    máscara. Devuelve None si el bate no se detecta con fiabilidad."""
    comp, _ = bat_mask(im)
    if comp is None or comp.sum() < 1200:
        return None
    ys, xs = np.where(comp)
    y = -(ys - ys.mean())
    x = xs - xs.mean()
    cov = np.cov(np.vstack([x, y]))
    _, vecs = np.linalg.eigh(cov)
    vx, vy = vecs[:, -1]
    a = np.degrees(np.arctan2(vy, vx))
    return a + 180 if a < 0 else a


def swing_from_row(src, row, n):
    """Construye el swing con frames REALES del arte, ordenados por el ángulo
    del bate y recorridos en vaivén.

    Se intentó antes recortar el bate y rotarlo, pero en todos los frames el
    bate se solapa un 70-78 % con el cuerpo: al quitarlo dejaba un hueco que
    el relleno no sabía reconstruir y el pato aparecía con un corte diagonal.
    """
    frames = [normalize(frame(src, row, c)) for c in range(n)]
    angles = [bat_angle(f) for f in frames]
    pairs = [(a, f) for a, f in zip(angles, frames) if a is not None]
    if len(pairs) < 3:
        return frames
    pairs.sort(key=lambda p: p[0])
    ordered = [f for _, f in pairs]
    # Vaivén: sube el bate y lo vuelve a bajar, sin repetir los extremos.
    return ordered + ordered[-2:0:-1]



def main():
    src = load_source()

    # --- Animaciones tomadas del arte fuente -----------------------------
    # (nombre, fila, nº frames, fps, loop)
    # (nombre, fila, nº frames, fps, loop, voltear)
    # `voltear` es para las filas dibujadas mirando a la izquierda: el resto del
    # arte mira a la derecha, que es la dirección canónica.
    base = [
        ('idle',  0, 7,  6,  True,  False),
        # Ciclo de caminar: se usa la fila 1 y no la 2 porque en la 2 el pato no
        # cabe en su celda y varios frames vienen recortados en vertical por el
        # costado (pierde la cola). La fila 1 es el mismo ciclo, completo.
        ('walk',  1, 8,  12, True,  True),
        ('happy', 3, 4,  8,  True,  False),   # saluda con el ala
        ('talk',  6, 6,  8,  True,  False),
        ('cool',  7, 6,  8,  True,  False),
        ('sad',   8, 6,  5,  True,  False),
        ('eat',   9, 8,  10, True,  False),   # cabeza atrás, traga
        ('crouch', 10, 8, 6, True,  False),   # agachado (base para dormir)
    ]

    anims = {}   # nombre -> lista de PIL.Image ya normalizados
    for name, row, n, fps, loop, flip in base:
        raw = [frame(src, row, c, flip=flip) for c in range(n)]
        # El arte fuente trae algunos frames con el cuerpo recortado; se
        # completan antes de normalizar (si no, el pato pierde la cola).
        raw, fixed = repair_clipped(raw)
        if fixed:
            detail = ', '.join(f'f{i} ({side}, ref f{ref})' for i, side, ref in fixed)
            print(f'  [reparado] {name}: {detail}')
        frames = [normalize(f) for f in raw]
        anims[name] = {'frames': frames, 'fps': fps, 'loop': loop}

    # --- Animaciones sintetizadas ----------------------------------------
    build_synthetic(anims, src)

    # --- Empaquetado ------------------------------------------------------
    order = ['idle', 'walk', 'play', 'eat', 'sleep', 'happy', 'talk', 'cool',
             'sad', 'flap', 'drag']
    order = [k for k in order if k in anims]
    cols = max(len(anims[k]['frames']) for k in order)
    sheet = Image.new('RGBA', (OUT_W * cols, OUT_H * len(order)), (0, 0, 0, 0))
    meta = {'frameW': OUT_W, 'frameH': OUT_H, 'facing': CANON_FACING,
            'groundY': GROUND_Y, 'animations': {}}

    for r, name in enumerate(order):
        fr = anims[name]['frames']
        for c, f in enumerate(fr):
            sheet.paste(f, (c * OUT_W, r * OUT_H), f)
        meta['animations'][name] = {
            'row': r, 'frames': len(fr),
            'fps': anims[name]['fps'], 'loop': anims[name]['loop']
        }

    sheet.save(OUT_PNG)
    with open(OUT_JSON, 'w', encoding='utf8') as fh:
        json.dump(meta, fh, indent=2)

    print(f'sheet {sheet.size} -> {OUT_PNG}')
    for k in order:
        print(f'  {k:7s} {len(anims[k]["frames"])} frames @ {anims[k]["fps"]}fps')
    return verify(anims, order)


def verify(anims, order):
    """Comprueba que ninguna animación salta, cambia de tamaño ni se corta.

    'base var' es cuánto se mueve la línea de los pies entre frames (si no es 0
    el pato da saltos); 'alto var' cuánto cambia la altura del cuerpo (si crece
    parece que cambia de tamaño). En flap/drag el pato está en el aire y ahí sí
    se espera variación.
    """
    # En flap/drag el pato está en el aire (la base oscila a propósito). En play
    # los pinchos del bate son del mismo naranja que el cuerpo, así que al rotar
    # alteran la medida de altura sin que el pato cambie de tamaño.
    aerial = {'flap', 'drag'}
    bat_moving = {'play'}
    print('\n  verificación:')
    problems = 0
    for name in order:
        frames = anims[name]['frames']
        bases, heights, clipped = [], [], []
        for i, f in enumerate(frames):
            a = np.array(f)
            al = a[:, :, 3] > 30
            R = a[:, :, 0].astype(int)
            G = a[:, :, 1].astype(int)
            body = al & (R >= 190) & (G >= 60)
            ys, xs = np.where(body)
            if len(ys) == 0:
                continue
            bases.append(ys.max())
            heights.append(ys.max() - ys.min() + 1)
            ay, ax = np.where(al)
            if len(ay) and (ax.min() <= 0 or ax.max() >= OUT_W - 1
                            or ay.min() <= 0 or ay.max() >= OUT_H - 1):
                clipped.append(i)
        if not bases:
            continue
        bvar, hvar = max(bases) - min(bases), max(heights) - min(heights)
        bad = bool(clipped)
        if name not in aerial:
            bad = bad or bvar > 2
            if name not in bat_moving:
                bad = bad or hvar > 8
        if bad:
            problems += 1
        flag = '  <-- REVISAR' if bad else ''
        print(f'    {name:7s} base var={bvar:2d}  alto var={hvar:2d}  '
              f'cortados={clipped}{flag}')
    print('  OK' if not problems else f'  {problems} animación(es) a revisar')
    return problems


def build_synthetic(anims, src):
    """Crea dormir, aletear, swing del bate y arrastre a partir de frames base."""
    # -- DORMIR: el pato agachado respirando lentamente -------------------
    crouch = anims.pop('crouch')['frames']
    base = crouch[0]
    sleep = []
    for i in range(8):
        amp = np.sin(i / 8.0 * 2 * np.pi)
        # Respiración muy sutil: si se exagera parece que cambia de tamaño.
        sleep.append(scale_about_feet(base, 1.0 + 0.008 * amp, 1.0 + 0.014 * amp))
    anims['sleep'] = {'frames': sleep, 'fps': 5, 'loop': True}

    # -- JUGAR: swing del bate --------------------------------------------
    # Frames reales de la fila "cool" (la de mayor recorrido del bate: ~40°),
    # reordenados por ángulo y recorridos en vaivén.
    anims['play'] = {'frames': swing_from_row(src, 7, 6), 'fps': 12, 'loop': True}

    # -- ALETEAR: para la caída lenta -------------------------------------
    # El ala sube y baja (base: la fila del saludo) y el cuerpo se sostiene.
    hap = anims['happy']['frames']
    seq = [0, 1, 2, 3, 2, 1]
    flap = [bob(hap[idx % len(hap)], int(round(3 * np.sin(i / len(seq) * 2 * np.pi))))
            for i, idx in enumerate(seq)]
    anims['flap'] = {'frames': flap, 'fps': 14, 'loop': True}

    # -- ARRASTRE: colgando del cursor, se balancea ligeramente ------------
    drag = []
    for i in range(6):
        amp = np.sin(i / 6.0 * 2 * np.pi)
        drag.append(rotate_about(hap[i % len(hap)], 7 * amp, (OUT_W // 2, 30)))
    anims['drag'] = {'frames': drag, 'fps': 10, 'loop': True}


if __name__ == '__main__':
    # Código de salida distinto de 0 si alguna animación no pasa la
    # verificación, para que el CI lo detecte.
    sys.exit(1 if main() else 0)
