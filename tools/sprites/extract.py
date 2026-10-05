"""
Découpe la planche de sprites (tools/sprites/ninja-sheet.png) en images pixel art
à la résolution du jeu, puis génère :
  - src/client/assets/ninja-jaune.png et ninja-bleu.png (atlas, une ligne par animation)
  - src/client/render/sprites/ninjaAtlas.ts (positions des images + points d'ancrage)

La planche est une image agrandie (~5,5 px par pixel) avec fond blanc : on retrouve
la grille de chaque image, on lit la couleur au centre de chaque case, puis on
réduit à une palette commune pour supprimer l'anticrénelage.

Usage : python3 tools/sprites/extract.py   (nécessite pillow, numpy, scipy)
"""
import colorsys
import json
import os

import numpy as np
from PIL import Image
from scipy.cluster.vq import kmeans2

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'tools/sprites/ninja-sheet.png')
OUT_IMG = os.path.join(ROOT, 'src/client/assets')
OUT_TS = os.path.join(ROOT, 'src/client/render/sprites/ninjaAtlas.ts')

# Hauteur cible du personnage debout (px du jeu). Les lignes dessinées plus petites
# sur la planche sont agrandies (plus proche voisin) pour garder une taille constante.
TARGET_H = 22

# Boîtes (y0, x0, y1, x1) relevées sur la planche, et hauteur « debout » de référence de la ligne.
ANIMS = {
    'idle':   ([(132, 41, 262, 123), (132, 140, 261, 221), (132, 238, 261, 318), (132, 338, 261, 419)], 22),
    'run':    ([(131, 532, 261, 613), (132, 637, 261, 719), (132, 754, 261, 838), (132, 867, 261, 950)], 22),
    'jump':   ([(387, 67, 503, 152), (334, 191, 465, 280), (386, 312, 502, 400)], 22),
    'light':  ([(397, 499, 507, 598), (399, 620, 509, 710), (401, 726, 509, 807), (401, 821, 509, 918)], 19),
    'light2': ([(397, 1008, 514, 1112), (398, 1125, 513, 1241), (395, 1251, 512, 1351), (394, 1376, 511, 1475)], 20),
    'medium': ([(628, 38, 744, 137), (628, 155, 744, 284), (628, 285, 745, 403), (628, 404, 746, 531)], 19),
    'guard':  ([(634, 624, 742, 696), (634, 711, 742, 782), (634, 798, 742, 872), (634, 888, 741, 960)], 18),
    'throw':  ([(636, 1016, 741, 1087), (639, 1106, 741, 1196), (639, 1200, 741, 1283), (634, 1406, 741, 1497)], 18),
    'fire':   ([(865, 1018, 973, 1094), (858, 1134, 973, 1210), (834, 1263, 973, 1350), (818, 1401, 974, 1490)], 18),
}

im = np.array(Image.open(SRC).convert('RGB')).astype(float)


def best_grid(c):
    """Pas et décalage de grille qui rendent chaque case la plus uniforme possible."""
    best = None
    for p in np.arange(5.3, 5.71, 0.1):
        for ox in np.arange(0, p, 0.5):
            for oy in np.arange(0, p, 0.5):
                tot, n, y = 0.0, 0, oy
                while y + p <= c.shape[0]:
                    x = ox
                    while x + p <= c.shape[1]:
                        blk = c[int(y + p * .2):int(y + p * .8) + 1, int(x + p * .2):int(x + p * .8) + 1].reshape(-1, 3)
                        tot += blk.std(axis=0).sum()
                        n += 1
                        x += p
                    y += p
                if best is None or tot / n < best[0]:
                    best = (tot / n, p, ox, oy)
    return best[1:]


def cut(box):
    y0, x0, y1, x1 = box
    c = im[y0 - 3:y1 + 3, x0 - 3:x1 + 3]
    p, ox, oy = best_grid(c)
    rows, y = [], oy
    while y + p <= c.shape[0]:
        row, x = [], ox
        while x + p <= c.shape[1]:
            blk = c[int(y + p * .25):int(y + p * .75) + 1, int(x + p * .25):int(x + p * .75) + 1].reshape(-1, 3)
            ink = blk[blk.min(axis=1) <= 205]
            row.append(list(np.median(ink, axis=0)) + [255] if len(ink) >= len(blk) * 0.5 else [0, 0, 0, 0])
            x += p
        rows.append(row)
        y += p
    a = np.array(rows, dtype=float)
    ys, xs = np.where(a[:, :, 3] > 0)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def upscale(f, k):
    if k <= 1.01:
        return f
    h, w = f.shape[:2]
    nh, nw = round(h * k), round(w * k)
    yi = np.minimum((np.arange(nh) / k).astype(int), h - 1)
    xi = np.minimum((np.arange(nw) / k).astype(int), w - 1)
    return f[yi][:, xi]


frames = {}
for name, (boxes, ref_h) in ANIMS.items():
    frames[name] = [upscale(cut(b), TARGET_H / ref_h) for b in boxes]

# Palette commune.
allpx = np.concatenate([f[f[:, :, 3] > 0][:, :3] for v in frames.values() for f in v])
cent, _ = kmeans2(allpx, 14, minit='++', seed=1)


def quantize(f):
    q = f.copy()
    m = q[:, :, 3] > 0
    px = q[m][:, :3]
    q[m, :3] = cent[((px[:, None, :] - cent[None, :, :]) ** 2).sum(-1).argmin(1)]
    return q.astype(np.uint8)


frames = {k: [quantize(f) for f in v] for k, v in frames.items()}


def to_blue(f):
    """Même personnage en bleu : les jaunes/ors deviennent bleus, la peau et le noir ne bougent pas."""
    out = f.copy()
    for y in range(f.shape[0]):
        for x in range(f.shape[1]):
            r, g, b, a = (int(v) for v in f[y, x])
            if not a:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if 0.085 <= h <= 0.17 and s >= 0.7:
                nr, ng, nb = colorsys.hsv_to_rgb(0.58, min(1, s * 0.85), min(1, v * 1.05))
                out[y, x, :3] = [round(nr * 255), round(ng * 255), round(nb * 255)]
    return out


# Atlas : une ligne par animation, chaque image dans une case de taille fixe.
CELL_W = max(f.shape[1] for v in frames.values() for f in v) + 2
CELL_H = max(f.shape[0] for v in frames.values() for f in v) + 2
ncols = max(len(v) for v in frames.values())
atlas_y = np.zeros((CELL_H * len(frames), CELL_W * ncols, 4), dtype=np.uint8)
atlas_b = atlas_y.copy()
meta = {}
for r, (name, v) in enumerate(frames.items()):
    meta[name] = []
    for i, f in enumerate(v):
        h, w = f.shape[:2]
        x0, y0 = i * CELL_W + 1, r * CELL_H + 1
        atlas_y[y0:y0 + h, x0:x0 + w] = f
        atlas_b[y0:y0 + h, x0:x0 + w] = to_blue(f)
        # Ancrage : pieds en bas, x = centre de la tête (stable même bras tendu).
        top = f[: min(6, h), :, 3] > 0
        ax = int(round(np.where(top)[1].mean())) if top.any() else w // 2
        meta[name].append({'x': x0, 'y': y0, 'w': w, 'h': h, 'ax': ax})

Image.fromarray(atlas_y, 'RGBA').save(os.path.join(OUT_IMG, 'ninja-jaune.png'))
Image.fromarray(atlas_b, 'RGBA').save(os.path.join(OUT_IMG, 'ninja-bleu.png'))

os.makedirs(os.path.dirname(OUT_TS), exist_ok=True)
with open(OUT_TS, 'w') as fh:
    fh.write('// Fichier généré par tools/sprites/extract.py : ne pas modifier à la main.\n\n')
    fh.write('export interface AtlasFrame {\n  x: number;\n  y: number;\n  w: number;\n  h: number;\n  /** Abscisse du centre du corps dans l\'image (les pieds sont en bas). */\n  ax: number;\n}\n\n')
    fh.write('export type NinjaAnim = ' + ' | '.join(f"'{k}'" for k in meta) + ';\n\n')
    fh.write('export const NINJA_ATLAS: Record<NinjaAnim, AtlasFrame[]> = ' + json.dumps(meta, indent=2).replace('"', "'") + ';\n')
print({k: len(v) for k, v in meta.items()}, 'cell', CELL_W, CELL_H)
