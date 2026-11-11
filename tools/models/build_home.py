"""Wildflower patches for the town and the gardens, and the cottage's own
furniture (box bed, stone hearth, candle stand, witch ball), as the real
things. Writes public/kk/home/*.glb.

    sh tools/models/build.sh home [name ...]

Furniture is built at 1 unit = 100 world units, its back to the wall at +Y
(three.js -Z), so the game can place the hearth's fire and the candle's flame
where the model has them.
"""
import math, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from trlib import *  # noqa

OUT = os.path.join(os.path.dirname(__file__), '../../public/kk/home')


def box(sx, sy, sz, colors, c=(0, 0, 0), jitter=0.0, seed=0):
    """An axis-aligned box (t runs bottom to top)."""
    x0, y0, z0 = -sx / 2, -sy / 2, 0
    v = [(x0 + sx * i, y0 + sy * j, z0 + sz * k) for k in (0, 1) for j in (0, 1) for i in (0, 1)]
    if jitter:
        r = np.random.default_rng(seed)
        v = [(x + r.uniform(-jitter, jitter) * sx, y + r.uniform(-jitter, jitter) * sy, z + (r.uniform(-jitter, jitter) * sz if z else 0)) for (x, y, z) in v]
    f = [(0, 2, 3, 1), (4, 5, 7, 6), (0, 1, 5, 4), (2, 6, 7, 3), (0, 4, 6, 2), (1, 3, 7, 5)]
    t = [0, 0, 0, 0, 1, 1, 1, 1]
    p = Part(v, f, t, colors, smooth=False)
    return p.xf(None, c)


GRASS = ('#2e5a24', '#6a9a40')


def tuft(m, x, y, n=5, h=0.25, seed=0):
    r = np.random.default_rng(seed)
    for k in range(n):
        m.add(blade(h * r.uniform(0.7, 1.1), 0.04, linear, segs=2, cols=3, fold=0.3, rise=1.25, droop=0.9, colors=GRASS).xf(rz(r.uniform(0, TAU)), (x, y, 0)))


def stalk(m, base, top, r=0.012, colors=('#3a6a2a', '#6a9a3a')):
    m.add(tube([base, (np.asarray(base) + np.asarray(top)) / 2 + [0, 0, 0.02], top], r, sides=4, colors=colors))


# ── Wildflower patches ─────────────────────────────────────────────────────
def foxgloves():
    """Digitalis purpurea, folk's-glove: rosettes of soft leaves and tall spikes of spotted pink bells, all to one side."""
    m = Model('fp_foxglove')
    r = np.random.default_rng(41)
    for (x, y, h) in ((0.0, 0.0, 1.0), (0.22, 0.12, 0.8), (-0.18, 0.16, 0.7)):
        for k in range(7):
            m.add(blade(0.26, 0.12, ovate, segs=3, cols=3, fold=0.2, rise=0.35, droop=0.6, colors=('#3a6a34', '#8ab070')).xf(rz(TAU * k / 7 + x * 5), (x, y, 0.01)))
        stalk(m, (x, y, 0), (x, y, h), 0.018)
        face = r.uniform(0, TAU)
        for j in range(12):
            s = j / 11
            z = h * (0.45 + 0.52 * s)
            size = 0.065 * (1 - 0.55 * s)
            a = face + 0.5 * math.sin(j * 1.7)
            p = np.array([x + 0.03 * math.cos(a), y + 0.03 * math.sin(a), z])
            if s > 0.85:
                m.add(blob(size * 0.5, size * 0.5, size * 0.8, seg=5, rings=3, colors=('#8a4a7a', '#c07aa8')).xf(None, p))
                continue
            bell = lathe([(size * 0.25, 0), (size * 0.45, size * 0.6), (size * 0.6, size * 1.3), (size * 0.7, size * 1.45)], sides=7, colors=('#a0306a', '#f090c0'), close_top=False)
            m.add(bell.xf(rz(a) @ ry(math.pi * 0.62), p))
    for k in range(4):
        tuft(m, r.uniform(-0.35, 0.35), r.uniform(-0.3, 0.3), 4, 0.2, k)
    return m, None


def meadow():
    """A scrap of old meadow: ox-eye daisies, buttercups and red clover in the grass."""
    m = Model('fp_meadow')
    r = np.random.default_rng(42)
    for k in range(7):
        tuft(m, r.uniform(-0.4, 0.4), r.uniform(-0.4, 0.4), 5, 0.24, k)
    for k in range(6):  # ox-eye daisies
        a = r.uniform(0, TAU); d = r.uniform(0.05, 0.35); h = r.uniform(0.38, 0.55)
        top = np.array([d * math.cos(a), d * math.sin(a), h])
        stalk(m, top * [1, 1, 0], top)
        up = look_rot((math.cos(a) * 0.3, math.sin(a) * 0.3, 1)) @ ry(-math.pi / 2)
        for j in range(13):
            m.add(blade(0.07, 0.022, linear, segs=1, cols=3, fold=0, rise=0.1, droop=0.15, colors=('#e8e4dc', '#ffffff')).xf(up @ rz(TAU * j / 13), top))
        m.add(blob(0.028, 0.028, 0.016, seg=6, rings=3, colors=('#e0a010', '#ffd83a')).xf(up, top + up @ [0, 0, 0.006]))
    for k in range(7):  # buttercups: five glossy cupped petals
        a = r.uniform(0, TAU); d = r.uniform(0.0, 0.4); h = r.uniform(0.28, 0.42)
        top = np.array([d * math.cos(a), d * math.sin(a), h])
        stalk(m, top * [1, 1, 0], top, 0.009)
        for j in range(5):
            m.add(blade(0.04, 0.035, round_, segs=2, cols=3, fold=0.05, cup=0.2, rise=0.7, droop=0.2, colors=('#e0a000', '#fff040')).xf(rz(TAU * j / 5), top))
    for k in range(4):  # red clover
        a = r.uniform(0, TAU); d = r.uniform(0.0, 0.35); h = r.uniform(0.2, 0.3)
        top = np.array([d * math.cos(a), d * math.sin(a), h])
        stalk(m, top * [1, 1, 0], top, 0.01)
        m.add(blob(0.045, 0.045, 0.05, seg=6, rings=4, colors=('#a03a6a', '#e080b0'), jitter=0.15, seed=k).xf(None, top + [0, 0, 0.03]))
        for j in range(3):
            m.add(blade(0.06, 0.05, spoon, segs=2, cols=3, fold=0.1, rise=0.1, droop=0.2, colors=GRASS).xf(rz(TAU * j / 3 + a), top - [0, 0, 0.06]))
    return m, None


def harebells():
    """Campanula rotundifolia, the harebell or witches' thimble: blue bells nodding on hair-fine stems."""
    m = Model('fp_harebell')
    r = np.random.default_rng(43)
    for k in range(6):
        tuft(m, r.uniform(-0.35, 0.35), r.uniform(-0.35, 0.35), 5, 0.22, k + 10)
    for k in range(11):
        a = r.uniform(0, TAU); d = r.uniform(0.0, 0.38); h = r.uniform(0.4, 0.6)
        top = np.array([d * math.cos(a), d * math.sin(a), h])
        bend = top + [0.06 * math.cos(a), 0.06 * math.sin(a), -0.03]
        m.add(tube([top * [1, 1, 0], top * [1, 1, 0.6], top, bend], 0.007, sides=3, colors=('#4a6a3a', '#7a9a5a')))
        bell = lathe([(0.012, 0), (0.035, 0.03), (0.045, 0.07), (0.055, 0.085)], sides=8, colors=('#3a4ab0', '#8aa0ff'), close_top=False)
        for i in range(len(bell.v)):  # five little flared points
            if i >= 8 * 3:
                kk = i % 8
                bell.v[i][:2] *= 1 + 0.15 * math.cos(5 * TAU * kk / 8)
        m.add(bell.xf(rz(a) @ ry(math.pi * 0.85), bend))
    return m, None


def campion():
    """Red campion and bluebells under the hedge: pink notched stars on hairy stems, and the bluebells' nodding one-sided spikes."""
    m = Model('fp_campion')
    r = np.random.default_rng(44)
    for k in range(5):
        tuft(m, r.uniform(-0.35, 0.35), r.uniform(-0.35, 0.35), 4, 0.2, k + 20)
    notched = lambda s: math.sin(math.pi * min(1, s)) ** 0.5 * (1 - 0.5 * max(0, s - 0.8) / 0.2)
    for k in range(6):  # red campion
        a = r.uniform(0, TAU); d = r.uniform(0.0, 0.35); h = r.uniform(0.45, 0.6)
        top = np.array([d * math.cos(a), d * math.sin(a), h])
        stalk(m, top * [1, 1, 0], top, 0.011, ('#5a4a3a', '#7a6a4a'))
        for sgn in (-1, 1):
            m.add(blade(0.1, 0.04, lanceolate, segs=2, cols=3, fold=0.2, rise=0.3, droop=0.4, colors=('#3a6a34', '#7aa860')).xf(rz(a + sgn * 1.5), top * [1, 1, 0.5]))
        up = look_rot((math.cos(a) * 0.4, math.sin(a) * 0.4, 1)) @ ry(-math.pi / 2)
        m.add(lathe([(0.012, -0.04), (0.02, 0.0)], sides=6, colors=('#6a2a3a', '#9a4a5a'), close_top=False).xf(up, top))  # the calyx
        for j in range(5):
            m.add(blade(0.05, 0.035, notched, segs=2, cols=3, fold=0.05, rise=0.15, droop=0.1, colors=('#c02a6a', '#ff7ab0')).xf(up @ rz(TAU * j / 5), top))
    for k in range(5):  # bluebells
        a = r.uniform(0, TAU); d = r.uniform(0.05, 0.35); h = r.uniform(0.35, 0.45)
        base = np.array([d * math.cos(a), d * math.sin(a), 0])
        for j in range(3):
            m.add(blade(0.3, 0.05, linear, segs=3, cols=3, fold=0.3, rise=0.9, droop=1.0, colors=('#2e6a34', '#6aa850')).xf(rz(a + j * 2), base))
        top = base + [0.08 * math.cos(a), 0.08 * math.sin(a), h]
        m.add(tube([base, base + [0, 0, h * 0.7], top], 0.01, sides=4, colors=('#3a6a3a', '#5a8a4a')))
        for j in range(6):
            s = j / 5
            p = base + (top - base) * (0.55 + 0.45 * s) + [0.03 * math.cos(a), 0.03 * math.sin(a), -0.03]
            bell = lathe([(0.008, 0), (0.02, 0.03), (0.024, 0.055)], sides=6, colors=('#3a3aa0', '#8a7aff'), close_top=False)
            m.add(bell.xf(rz(a) @ ry(math.pi * 0.8), p))
    return m, None


# ── The cottage ────────────────────────────────────────────────────────────
OAK = ('#4a2e1a', '#8a5a34')
OAK_DK = ('#2e1a10', '#5a3a20')


def box_bed():
    """A carved oak box bed, its headboard cut with a crescent moon, made up with a patchwork quilt, pillows and a rolled wool blanket."""
    m = Model('bed')
    W, L = 1.5, 1.85                         # across, head-to-foot (head at +Y)
    for sx in (-1, 1):                       # the four posts, turned
        for sy, ph in ((1, 0.95), (-1, 0.5)):
            x, y = sx * (W / 2 - 0.05), sy * (L / 2 - 0.05)
            m.add(lathe([(0.055, 0), (0.06, 0.08), (0.045, 0.12), (0.05, ph * 0.5), (0.04, ph * 0.9), (0.06, ph * 0.95), (0.0, ph + 0.04)], sides=8, colors=OAK).xf(None, (x, y, 0)))
    m.add(box(W - 0.06, L - 0.06, 0.12, OAK_DK).xf(None, (0, 0, 0.12)))           # the frame
    m.add(box(0.06, L - 0.1, 0.14, OAK).xf(None, (-W / 2 + 0.05, 0, 0.14)))
    m.add(box(0.06, L - 0.1, 0.14, OAK).xf(None, (W / 2 - 0.05, 0, 0.14)))
    head = box(W - 0.1, 0.06, 0.62, OAK).xf(None, (0, L / 2 - 0.05, 0.25))         # the headboard
    m.add(head)
    m.add(box(W - 0.1, 0.06, 0.24, OAK).xf(None, (0, -L / 2 + 0.05, 0.22)))         # the footboard
    moon = lathe([(0.0, 0), (0.16, 0)], sides=16, colors=('#e8d8a8', '#f8ecc8'), close_top=False)  # the crescent, inlaid
    m.add(moon.xf(rx(math.pi / 2), (0, L / 2 - 0.085, 0.66)))
    m.add(lathe([(0.0, 0), (0.135, 0)], sides=16, colors=OAK, close_top=False).xf(rx(math.pi / 2), (0.06, L / 2 - 0.09, 0.69)))
    m.add(box(W - 0.12, L - 0.14, 0.14, ('#d8ccb4', '#efe6d4')).xf(None, (0, -0.02, 0.24)))  # the mattress
    # the patchwork quilt: squares in old reds, ochres, plum and moss
    cols = ['#8a2a2a', '#c8902a', '#5a3a6a', '#4a6a3a', '#a85a3a', '#2a3a5a', '#d8c8a0', '#7a4a6a']
    nx, ny = 6, 7
    qw, ql = (W - 0.08) / nx, (L - 0.62) / ny
    r = np.random.default_rng(45)
    for i in range(nx):
        for j in range(ny):
            c = cols[(i * 3 + j * 5 + int(r.integers(0, 3))) % len(cols)]
            x = -W / 2 + 0.04 + qw * (i + 0.5); y = -L / 2 + 0.07 + ql * (j + 0.5)
            m.add(box(qw * 0.98, ql * 0.98, 0.03, (c, c)).xf(None, (x, y, 0.38)))
    for sx in (-1, 1):  # the quilt's fall over the sides
        m.add(box(0.03, L - 0.6, 0.16, ('#5a2a2a', '#8a3a3a')).xf(None, (sx * (W / 2 - 0.02), -0.27, 0.24)))
    m.add(blob(W * 0.46, 0.09, 0.07, seg=10, rings=5, colors=('#7a6a4a', '#b8a070')).xf(None, (0, L / 2 - 0.5, 0.43)))  # the rolled blanket
    for sx in (-0.33, 0.33):  # pillows
        m.add(blob(0.28, 0.15, 0.08, seg=9, rings=5, colors=('#d8d0c0', '#fffaf0')).xf(None, (sx, L / 2 - 0.22, 0.44)))
    return m, None


def hearth():
    """A rough stone hearth with an oak mantle beam: a crane and a black kettle-pot over the logs, herbs drying from the beam, a candle and jars on it."""
    m = Model('hearth')
    W, D = 1.9, 0.42                          # wide, deep (back at +Y)
    r = np.random.default_rng(46)
    STONE = [('#4a4640', '#8a847a'), ('#5a5248', '#9a9080'), ('#3e3a36', '#7a746a')]
    # the surround, laid in rough courses, with the opening left
    z = 0.0
    while z < 1.06:
        h = r.uniform(0.11, 0.15)
        x = -W / 2
        while x < W / 2 - 0.01:
            w = min(r.uniform(0.18, 0.3), W / 2 - x)
            cx = x + w / 2
            if not (abs(cx) < 0.42 and z < 0.66):  # leave the firebox
                m.add(box(w * 0.97, D, h * 0.95, STONE[int(r.integers(0, 3))], jitter=0.03, seed=int(r.integers(1e6))).xf(None, (cx, 0, z)))
            x += w
        z += h
    m.add(box(0.86, 0.06, 0.66, ('#141010', '#2a2220')).xf(None, (0, D / 2 - 0.05, 0)))   # the sooty back
    for sx in (-1, 1):
        m.add(box(0.06, D - 0.04, 0.66, ('#1a1614', '#3a3430')).xf(None, (sx * 0.43, 0.0, 0)))
    m.add(box(0.95, D * 0.9, 0.1, ('#1e1816', '#2e2624')).xf(None, (0, 0.0, 0.62)))       # the lintel's shadow
    m.add(box(W + 0.16, D + 0.12, 0.13, OAK).xf(None, (0, -0.04, 1.06)))                    # the oak mantle beam
    m.add(box(1.0, 0.5, 0.05, ('#5a524a', '#8a8278')).xf(None, (0, -0.42, 0)))              # the hearthstone
    # fire-dogs and logs
    for sx in (-0.22, 0.22):
        m.add(box(0.04, 0.3, 0.04, ('#1a1a1a', '#3a3a3a')).xf(None, (sx, -0.02, 0.0)))
        m.add(tube([(sx, -0.16, 0.0), (sx, -0.16, 0.14)], 0.02, sides=6, colors=('#1a1a1a', '#3a3a3a')))
    for (y, z, a) in ((-0.02, 0.06, 0.1), (0.06, 0.08, -0.15), (0.0, 0.14, 0.05)):
        lg = tube([(-0.3, 0, 0), (0.3, 0, 0)], 0.055, sides=7, colors=('#3a2414', '#6a4a2a'))
        m.add(lg.xf(rz(a), (0, y, z)))
        for sx in (-0.3, 0.3):
            m.add(lathe([(0.0, 0), (0.05, 0)], sides=7, colors=('#a07a4a', '#c89a60'), close_top=False).xf(ry(math.pi / 2 * (1 if sx > 0 else -1)), (sx * math.cos(a), y + sx * math.sin(a), z)))
    # the crane and a black pot
    m.add(tube([(-0.36, 0.1, 0.05), (-0.36, 0.1, 0.56)], 0.015, sides=5, colors=('#1a1a1a', '#3a3a3a')))
    m.add(tube([(-0.36, 0.1, 0.52), (-0.05, -0.02, 0.52)], 0.013, sides=5, colors=('#1a1a1a', '#3a3a3a')))
    m.add(tube([(-0.05, -0.02, 0.52), (-0.05, -0.02, 0.42)], 0.006, sides=4, colors=('#2a2a2a', '#4a4a4a')))
    pot = lathe([(0.0, 0.0), (0.09, 0.02), (0.12, 0.08), (0.11, 0.15), (0.09, 0.17), (0.1, 0.18)], sides=12, colors=('#0e0e10', '#3a3a40'), close_top=False)
    m.add(pot.xf(None, (-0.05, -0.02, 0.24)))
    # herbs drying from the beam, and the things on the mantle
    for k, (x, col) in enumerate(((-0.75, ('#6a7a4a', '#a8b880')), (-0.6, ('#7a6a8a', '#b8a0d0')), (0.62, ('#8a8a4a', '#d8c870')), (0.78, ('#5a7a4a', '#90b070')))):
        m.add(tube([(x, -0.2, 1.06), (x, -0.2, 0.98)], 0.005, sides=3, colors=('#a08a5a', '#c8a870')))
        for j in range(6):
            a = TAU * j / 6
            m.add(blade(0.16, 0.035, lanceolate, segs=2, cols=3, fold=0.2, rise=-1.35, droop=0.0, colors=col).xf(rz(a), (x + 0.015 * math.cos(a), -0.2 + 0.015 * math.sin(a), 0.98)))
    for (x, h, rr, col) in ((-0.5, 0.14, 0.05, ('#3a5a4a', '#6a9a7a')), (-0.36, 0.1, 0.045, ('#6a3a2a', '#a86a4a')), (0.4, 0.12, 0.05, ('#2a3a5a', '#5a6a9a'))):
        m.add(lathe([(rr * 0.8, 0), (rr, 0.02), (rr, h * 0.8), (rr * 0.6, h), (rr * 0.65, h + 0.02)], sides=8, colors=col, close_bottom=True).xf(None, (x, -0.1, 1.19)))
    m.add(lathe([(0.03, 0), (0.03, 0.12)], sides=8, colors=('#e8dcc0', '#fff4dc'), close_bottom=True).xf(None, (0.15, -0.1, 1.19)))  # a candle stub
    m.add(lathe([(0.05, 0), (0.06, 0.01), (0.04, 0.02)], sides=8, colors=('#8a6a2a', '#c8a050'), close_top=True, close_bottom=True).xf(None, (0.15, -0.1, 1.19)))
    return m, None


def candle_stand():
    """A tall wrought-iron pricket stand on three curled feet, with a fat beeswax candle, drips and all."""
    m = Model('candle_stand')
    IRON = ('#141414', '#3e3c3a')
    for k in range(3):
        a = TAU * k / 3
        pts = [(0, 0, 0.12), (0.08 * math.cos(a), 0.08 * math.sin(a), 0.06), (0.16 * math.cos(a), 0.16 * math.sin(a), 0.01)]
        curl = [(0.16 * math.cos(a) + 0.03 * math.cos(a + u), 0.16 * math.sin(a) + 0.03 * math.sin(a + u), 0.025 + 0.025 * math.sin(u)) for u in np.linspace(0, math.pi * 1.4, 5)]
        m.add(tube(pts + curl, 0.014, sides=5, colors=IRON))
    m.add(tube([(0, 0, 0.1), (0, 0, 0.78)], 0.02, sides=6, colors=IRON))
    for z in (0.25, 0.55):
        m.add(lathe([(0.02, z - 0.02), (0.035, z), (0.02, z + 0.02)], sides=8, colors=IRON, close_top=False))
    m.add(lathe([(0.02, 0.76), (0.12, 0.78), (0.13, 0.8), (0.11, 0.8)], sides=10, colors=IRON, close_top=True))  # the drip pan
    m.add(lathe([(0.065, 0.8), (0.065, 0.97), (0.05, 0.985), (0.0, 0.99)], sides=10, colors=('#c8a050', '#f0d890'), close_bottom=False))  # beeswax
    r = np.random.default_rng(47)
    for k in range(5):  # drips
        a = r.uniform(0, TAU); L = r.uniform(0.04, 0.12)
        m.add(tube([(0.066 * math.cos(a), 0.066 * math.sin(a), 0.975), (0.068 * math.cos(a), 0.068 * math.sin(a), 0.975 - L)], lambda s: 0.012 * (1 - 0.3 * s), sides=4, colors=('#d8b060', '#f0d890')))
    m.add(tube([(0, 0, 0.98), (0, 0, 1.01)], 0.004, sides=3, colors=('#1a1410', '#2a2018')))  # the wick
    return m, None


def witch_ball():
    """A witch ball: a blown-glass globe silvered inside, hung by a ribbon from an iron hook."""
    m = Model('witch_ball')
    m.add(tube([(0, 0.0, 0.42), (0, -0.05, 0.42), (0, -0.05, 0.38)], 0.008, sides=4, colors=('#1a1a1a', '#3a3a3a')))  # the hook, from the wall
    m.add(box(0.06, 0.012, 0.06, ('#1a1a1a', '#3a3a3a')).xf(None, (0, 0.0, 0.39)))
    m.add(tube([(0, -0.05, 0.38), (0, -0.05, 0.3)], 0.006, sides=4, colors=('#6a2a4a', '#a04a70')))  # ribbon
    m.add(blade(0.05, 0.035, round_, segs=2, cols=3, fold=0.1, rise=-0.6, droop=0.1, colors=('#6a2a4a', '#a04a70')).xf(rz(-0.6), (0, -0.05, 0.37)))
    m.add(blade(0.05, 0.035, round_, segs=2, cols=3, fold=0.1, rise=-0.6, droop=0.1, colors=('#6a2a4a', '#a04a70')).xf(rz(math.pi + 0.6), (0, -0.05, 0.37)))
    m.add(lathe([(0.018, 0.27), (0.022, 0.3)], sides=8, colors=('#8a7a5a', '#c8b890'), close_top=True))  # the neck
    ball = blob(0.14, 0.14, 0.14, seg=14, rings=10, colors=('#1a3a6a', '#7ad0e0'))
    for i, v in enumerate(ball.v):  # an iridescent sheen, blue-green going violet round the sides
        ang = math.atan2(v[1], v[0])
        ball.t[i] = 0.5 + 0.5 * math.sin(ang * 2 + v[2] * 10)
    m.add(glowing(ball).xf(None, (0, -0.05, 0.14)))
    m.add(blob(0.03, 0.02, 0.04, seg=6, rings=4, colors=('#ffffff', '#ffffff')).xf(None, (0.06, -0.17, 0.2)))  # a window's highlight
    return m, '#5ab0d0'


def altar_candle():
    """A stub of beeswax candle on a little pewter saucer, run with drips."""
    m = Model('altar_candle')
    m.add(lathe([(0.0, 0), (0.3, 0.0), (0.34, 0.04), (0.3, 0.05), (0.12, 0.05)], sides=10, colors=('#5a5a60', '#a8a8b0'), close_top=False))
    m.add(lathe([(0.17, 0.05), (0.17, 0.85), (0.13, 0.9), (0.0, 0.88)], sides=10, colors=('#c89a48', '#f4dc98')))
    r = np.random.default_rng(81)
    for k in range(5):
        a = r.uniform(0, TAU); L = r.uniform(0.2, 0.6)
        m.add(tube([(0.175 * math.cos(a), 0.175 * math.sin(a), 0.86), (0.18 * math.cos(a), 0.18 * math.sin(a), 0.86 - L)], lambda s_: 0.035 * (1 - 0.3 * s_), sides=4, colors=('#d8b060', '#f4dc98')))
    m.add(blob(0.2, 0.16, 0.03, seg=6, rings=3, colors=('#d8b060', '#f0d48a'), jitter=0.3).xf(None, (0.1, 0.05, 0.06)))  # a pool of wax
    m.add(tube([(0, 0, 0.88), (0.01, 0, 1.0)], 0.012, sides=3, colors=('#1a1410', '#2a2018')))
    return m, None


def athame():
    """A black-hafted knife: a plain double-edged steel blade, a brass guard and pommel, the haft bound with cord."""
    m = Model('athame')
    # lying flat along +X, edge-on to the ground
    blade_ = lathe([(0.0, 0.0), (0.075, 0.12), (0.085, 0.5), (0.08, 0.62)], sides=4, colors=('#8a909a', '#e4e8f0'), close_top=False, phase=math.pi / 4)
    blade_.v[:, 0] *= 0.22  # flatten the diamond section
    m.add(blade_.xf(ry(-math.pi / 2), (0.64, 0, 0.025)))
    m.add(box(0.05, 0.26, 0.05, ('#8a6a2a', '#d8b050')).xf(None, (0.0, 0, 0.0)))  # the guard
    m.add(lathe([(0.035, 0), (0.042, 0.1), (0.04, 0.24), (0.035, 0.3)], sides=8, colors=('#0e0c0c', '#2e2a2a'), close_top=False).xf(ry(-math.pi / 2), (-0.02, 0, 0.025)))
    for k in range(4):
        m.add(lathe([(0.044, 0), (0.046, 0.012), (0.044, 0.024)], sides=8, colors=('#3a2a1a', '#6a4a2a'), close_top=False).xf(ry(-math.pi / 2), (-0.07 - 0.06 * k, 0, 0.025)))
    m.add(blob(0.05, 0.05, 0.05, seg=7, rings=5, colors=('#8a6a2a', '#e0b858')).xf(None, (-0.36, 0, 0.03)))
    return m, None


def censer():
    """A little brass bowl on three feet, full of ash, a cone of incense smouldering in it."""
    m = Model('censer')
    BRASS = ('#6a4a1a', '#d8a848')
    m.add(lathe([(0.0, 0.1), (0.2, 0.1), (0.36, 0.2), (0.42, 0.36), (0.4, 0.42), (0.36, 0.4)], sides=12, colors=BRASS, close_top=False))
    m.add(lathe([(0.42, 0.34), (0.45, 0.37), (0.42, 0.4)], sides=12, colors=BRASS, close_top=False))
    for k in range(3):
        a = TAU * k / 3
        m.add(tube([(0.24 * math.cos(a), 0.24 * math.sin(a), 0.14), (0.3 * math.cos(a), 0.3 * math.sin(a), 0.0)], lambda s_: 0.05 * (1 - 0.3 * s_), sides=5, colors=BRASS))
    m.add(lathe([(0.0, 0.36), (0.36, 0.37)], sides=12, colors=('#3a3632', '#8a8680'), close_top=False))  # ash
    cone = lathe([(0.06, 0.37), (0.0, 0.56)], sides=6, colors=('#2a1a14', '#5a3a2a'), close_top=False)
    m.add(cone)
    m.add(glowing(blob(0.025, 0.025, 0.025, seg=5, rings=3, colors=('#ff5a1a', '#ffb060'))).xf(None, (0, 0, 0.56)))  # the ember at its tip
    return m, '#ff7a2a'


# ── The halls: what stands in the tavern, the library, the great hall. Fronts
# face -Y (three.js +Z); 1 unit = 100 world units unless the game sizes it. ──
IRON = ('#141414', '#3e3c3a')


def trim(p):
    p.trim = True
    return p


def trimtube(*a, **k):
    return trim(tube(*a, **k))


def hall_table():
    """An oak trestle table: a thick plank top on two A-frame trestles and a stretcher, set with a jug, bowls and a candle."""
    m = Model('hall_table')
    W, D, H = 1.0, 0.6, 0.58
    for k in range(4):  # planks, a little uneven
        m.add(box(W, D / 4 * 0.97, 0.06, OAK, jitter=0.01, seed=k).xf(None, (0, -D / 2 + D / 8 + k * D / 4, H - 0.06)))
    for sx in (-0.36, 0.36):
        for sy in (-1, 1):
            m.add(tube([(sx, sy * 0.24, 0), (sx, sy * 0.06, H - 0.06)], 0.035, sides=6, colors=OAK_DK))
        m.add(box(0.07, 0.5, 0.05, OAK_DK).xf(None, (sx, 0, H - 0.11)))
    m.add(box(0.74, 0.05, 0.05, OAK_DK).xf(None, (0, 0, 0.22)))
    m.add(lathe([(0.04, 0), (0.06, 0.04), (0.055, 0.1), (0.035, 0.14), (0.04, 0.16)], sides=8, colors=('#6a5a4a', '#b8a890'), close_bottom=True).xf(None, (0.28, 0.08, H)))  # a stoneware jug
    for (x, y) in ((-0.1, -0.12), (0.12, 0.14)):
        m.add(lathe([(0.03, 0), (0.07, 0.03), (0.075, 0.035)], sides=8, colors=('#5a3a20', '#9a7044'), close_bottom=True, close_top=False).xf(None, (x, y, H)))  # wooden bowls
    m.add(lathe([(0.02, 0), (0.02, 0.09)], sides=6, colors=('#d8c890', '#f4ecc8'), close_bottom=True).xf(None, (-0.32, 0.1, H)))
    return m, None


def hall_bench():
    """A plank bench on splayed legs."""
    m = Model('hall_bench')
    m.add(box(1.0, 0.28, 0.06, OAK).xf(None, (0, 0, 0.32)))
    for sx in (-0.38, 0.38):
        for sy in (-1, 1):
            m.add(tube([(sx * 1.08, sy * 0.14, 0), (sx, sy * 0.08, 0.32)], 0.03, sides=5, colors=OAK_DK))
    m.add(box(0.7, 0.04, 0.04, OAK_DK).xf(None, (0, 0, 0.14)))
    return m, None


def bookcase():
    """A tall oak bookcase: leather-bound books upright and slumped, a skull, jars, a candle stub."""
    m = Model('bookcase')
    W, H, D = 0.72, 1.4, 0.26
    m.add(box(W, 0.03, H, OAK_DK).xf(None, (0, D / 2 - 0.015, 0)))  # back
    for sx in (-1, 1):
        m.add(box(0.045, D, H, OAK).xf(None, (sx * (W / 2 - 0.022), 0, 0)))
    shelves = [0.0, 0.34, 0.68, 1.02, H - 0.04]
    for z in shelves:
        m.add(box(W, D, 0.04, OAK).xf(None, (0, 0, z)))
    m.add(box(W + 0.06, D + 0.04, 0.05, OAK).xf(None, (0, -0.01, H)))
    r = np.random.default_rng(101)
    cols = ['#6a1a1a', '#1a3a5a', '#2a4a2a', '#5a4a1a', '#3a1a4a', '#4a2a1a', '#1a1a1a']
    for si, z in enumerate(shelves[:-1]):
        x = -W / 2 + 0.06
        while x < W / 2 - 0.1:
            if si == 1 and 0.0 < x < 0.2:  # a skull between the books
                m.add(blob(0.06, 0.07, 0.06, seg=7, rings=5, colors=('#b8ac90', '#f0e8d4')).xf(None, (0.1, -0.02, z + 0.1)))
                for sgn in (-1, 1):
                    m.add(blob(0.016, 0.01, 0.018, seg=4, rings=3, colors=('#000000', '#101010')).xf(None, (0.1 + sgn * 0.025, -0.085, z + 0.11)))
                x = 0.22; continue
            if si == 2 and x > 0.1:  # jars
                m.add(lathe([(0.04, 0), (0.045, 0.02), (0.045, 0.12), (0.03, 0.15), (0.032, 0.17)], sides=8, colors=('#3a5a4a', '#7aa890'), close_bottom=True).xf(None, (x + 0.03, -0.02, z + 0.04)))
                x += 0.12; continue
            w = r.uniform(0.035, 0.06); h = r.uniform(0.2, 0.27)
            c = cols[int(r.integers(0, len(cols)))]
            lean = 0.25 if r.uniform() < 0.12 else 0
            b = box(w, D * 0.7, h, (c, c)).xf(ry(lean), (x + w / 2, -0.02, z + 0.04))
            m.add(b)
            m.add(box(w * 1.02, 0.01, 0.02, ('#b89a40', '#e0c060')).xf(ry(lean), (x + w / 2, -0.02 - D * 0.35, z + 0.04 + h * 0.75)))  # a gilt band on the spine
            x += w + 0.006
    m.add(lathe([(0.025, 0), (0.025, 0.08)], sides=6, colors=('#d8c890', '#f4ecc8'), close_bottom=True).xf(None, (-0.2, -0.02, H + 0.05)))
    m.add(box(0.2, 0.15, 0.04, ('#3a1a1a', '#5a2a2a')).xf(rz(0.3), (0.12, -0.02, H + 0.05)))  # a book left lying on top
    return m, None


def hall_banner():
    """A cloth banner on a pole: swallow-tailed, hemmed, hanging in slow folds. The cloth is pale: the game dyes it."""
    m = Model('hall_banner')
    W, H = 0.56, 1.0
    n = 8
    v, f, t = [], [], []
    for i in range(n + 1):
        zz = H - H * i / n
        for j in range(5):
            u = -1 + j / 2
            fold = 0.035 * math.sin(u * 3.2 + i * 0.35) * (i / n)
            cut = 0.16 * H * (1 - abs(u)) if i == n else 0  # the swallow tail
            v.append((u * W / 2, fold, zz + cut)); t.append(0.35 + 0.65 * (1 - i / n))
    for i in range(n):
        for j in range(4):
            a = i * 5 + j
            f.append((a, a + 1, a + 6, a + 5))
    m.add(Part(v, f, t, ('#8a8a8a', '#ffffff')))
    m.add(trim(tube([(-W / 2 - 0.05, 0, H + 0.01), (W / 2 + 0.05, 0, H + 0.01)], 0.022, sides=6, colors=OAK)))
    for sx in (-1, 1):
        m.add(trim(blob(0.035, 0.035, 0.035, seg=6, rings=4, colors=('#8a6a2a', '#e0b858'))).xf(None, (sx * (W / 2 + 0.07), 0, H + 0.01)))
    m.add(trim(box(W * 0.98, 0.012, 0.035, ('#8a6a2a', '#d8b050'))).xf(None, (0, -0.004, H - 0.12)))  # a gold band under the pole
    return m, None


def high_seat():
    """A carved oak high seat: a tall panelled back with finials, boxed arms, a worn red cushion."""
    m = Model('high_seat')
    m.add(box(0.72, 0.62, 0.42, OAK_DK).xf(None, (0, 0, 0)))
    m.add(box(0.76, 0.66, 0.05, OAK).xf(None, (0, -0.01, 0.42)))
    m.add(blob(0.3, 0.26, 0.05, seg=8, rings=3, colors=('#5a1414', '#a82a2a')).xf(None, (0, -0.03, 0.5)))
    m.add(box(0.72, 0.09, 1.2, OAK).xf(None, (0, 0.27, 0.42)))
    m.add(box(0.5, 0.02, 0.5, OAK_DK).xf(None, (0, 0.22, 0.9)))  # the sunk panel
    m.add(lathe([(0.0, 0), (0.16, 0)], sides=12, colors=('#8a6a2a', '#d8b050'), close_top=False).xf(rx(math.pi / 2), (0, 0.205, 1.38)))  # a brass boss
    for sx in (-1, 1):
        m.add(box(0.1, 0.56, 0.24, OAK).xf(None, (sx * 0.33, -0.03, 0.47)))
        m.add(lathe([(0.05, 0), (0.07, 0.05), (0.03, 0.1), (0.05, 0.16), (0.0, 0.24)], sides=8, colors=OAK).xf(None, (sx * 0.31, 0.27, 1.62)))
        m.add(blob(0.06, 0.07, 0.05, seg=6, rings=4, colors=OAK).xf(None, (sx * 0.33, -0.3, 0.72)))
    return m, None


def chandelier():
    """A wrought-iron wheel on three chains, ringed with beeswax candles in their cups."""
    m = Model('chandelier')
    R = 0.5
    m.add(lathe([(R - 0.03, -0.02), (R + 0.03, -0.02), (R + 0.03, 0.03), (R - 0.03, 0.03), (R - 0.03, -0.02)], sides=16, colors=IRON, close_top=False))
    for k in range(3):
        a = TAU * k / 3
        m.add(tube([(R * math.cos(a), R * math.sin(a), 0.02), (0.04 * math.cos(a), 0.04 * math.sin(a), 0.62)], 0.012, sides=4, colors=IRON))
        m.add(tube([(0, 0, 0), (R * math.cos(a), R * math.sin(a), 0)], 0.015, sides=4, colors=IRON))
    m.add(tube([(0, 0, 0.6), (0, 0, 0.8)], 0.016, sides=5, colors=IRON))
    m.add(blob(0.05, 0.05, 0.05, seg=6, rings=4, colors=IRON).xf(None, (0, 0, 0.0)))
    for k in range(6):
        a = TAU * k / 6
        x, y = R * math.cos(a), R * math.sin(a)
        m.add(lathe([(0.02, 0.03), (0.065, 0.045), (0.07, 0.06)], sides=8, colors=IRON, close_top=False).xf(None, (x, y, 0)))
        m.add(lathe([(0.035, 0.05), (0.035, 0.2), (0.0, 0.21)], sides=7, colors=('#c8a050', '#f4dc98')).xf(None, (x, y, 0)))
    return m, None


def wall_shield():
    """A heater shield: a pale field for the game to paint, an iron rim and boss, a painted chevron."""
    m = Model('wall_shield')
    outline = lambda s: (1.0 if s < 0.45 else math.cos((s - 0.45) / 0.55 * math.pi / 2) ** 0.7)
    v, f, t = [], [], []
    n = 8
    for i in range(n + 1):
        s_ = i / n
        hw = 0.4 * outline(s_)
        for j in range(5):
            u = -1 + j / 2
            v.append((u * hw, -0.05 * (1 - u * u), 1.0 - s_)); t.append(0.4 + 0.6 * (1 - s_))
    for i in range(n):
        for j in range(4):
            a = i * 5 + j
            f.append((a, a + 1, a + 6, a + 5))
    m.add(Part(v, f, t, ('#8a8a8a', '#ffffff')))
    m.add(trim(blob(0.09, 0.05, 0.09, seg=8, rings=5, colors=('#4a4a50', '#c8c8d0'))).xf(None, (0, -0.07, 0.62)))
    rim = [(-0.4, 0, 1.0), (0.4, 0, 1.0)]
    m.add(trim(tube(rim, 0.02, sides=4, colors=('#4a4a50', '#a8a8b0'))))
    for sx in (-1, 1):
        pts = [(sx * 0.4 * outline(i / n), 0, 1.0 - i / n) for i in range(n + 1)]
        m.add(trim(tube(pts, 0.018, sides=4, colors=('#4a4a50', '#a8a8b0'))))
        m.add(trim(tube([(0, -0.045, 0.36), (sx * 0.3, -0.02, 0.56)], 0.022, sides=4, colors=('#d8c890', '#fff4d0'))))  # the chevron
    return m, None


def standing_torch():
    """An iron cresset on a tall stand: a basket of pitch-soaked wood for the flame to sit in."""
    m = Model('standing_torch')
    for k in range(3):
        a = TAU * k / 3
        m.add(tube([(0, 0, 0.14), (0.16 * math.cos(a), 0.16 * math.sin(a), 0.0)], 0.014, sides=4, colors=IRON))
    m.add(tube([(0, 0, 0.1), (0, 0, 0.84)], 0.02, sides=6, colors=IRON))
    for z in (0.3, 0.6):
        m.add(lathe([(0.02, z - 0.015), (0.032, z), (0.02, z + 0.015)], sides=6, colors=IRON, close_top=False))
    m.add(lathe([(0.03, 0.84), (0.09, 0.9), (0.1, 1.0)], sides=8, colors=IRON, close_top=False))  # the basket
    for k in range(8):
        a = TAU * k / 8
        m.add(tube([(0.05 * math.cos(a), 0.05 * math.sin(a), 0.86), (0.105 * math.cos(a), 0.105 * math.sin(a), 1.02)], 0.008, sides=3, colors=IRON))
    for k in range(4):
        a = TAU * k / 4 + 0.4
        m.add(tube([(0.03 * math.cos(a), 0.03 * math.sin(a), 0.9), (0.05 * math.cos(a + 1), 0.05 * math.sin(a + 1), 1.04)], 0.02, sides=5, colors=('#2a1a10', '#5a3a20')))
    return m, None


# ── The witch's shelves: small things, 1 unit tall or so; the game sizes them.
# Glass, wax, covers and caps are pale where the game dyes them. ────────────
PALEG = ('#9a9a9a', '#ffffff')


def cave_potion():
    """A stoppered glass bottle: a round belly, a narrow neck, a cork tied down with twine, the liquor showing through."""
    m = Model('cave_potion')
    m.add(lathe([(0.0, 0), (0.2, 0.0), (0.3, 0.1), (0.32, 0.3), (0.24, 0.52), (0.1, 0.62), (0.09, 0.8), (0.12, 0.82)], sides=10, colors=PALEG, close_top=False))
    m.add(trim(lathe([(0.085, 0.78), (0.1, 0.9), (0.08, 0.94), (0.0, 0.94)], sides=8, colors=('#6a4a2a', '#b08a58'), close_top=False)))
    m.add(trim(lathe([(0.1, 0.7), (0.115, 0.72), (0.1, 0.74)], sides=8, colors=('#8a7a5a', '#c8b890'), close_top=False)))
    m.add(trim(blob(0.07, 0.02, 0.1, seg=5, rings=3, colors=('#ffffff', '#ffffff'))).xf(None, (0.2, -0.24, 0.34)))  # a glint on the glass
    return m, None


def cave_candle():
    """A fat candle burnt down unevenly, run with drips, on a little iron dish. The wax is pale: the game dyes it black, red or bone."""
    m = Model('cave_candle')
    m.add(trim(lathe([(0.0, 0), (0.3, 0.0), (0.34, 0.04), (0.3, 0.05)], sides=9, colors=IRON, close_top=False)))
    m.add(lathe([(0.2, 0.04), (0.19, 0.86), (0.16, 0.94), (0.06, 0.9), (0.0, 0.9)], sides=9, colors=PALEG, close_top=False))
    r = np.random.default_rng(111)
    for k in range(6):
        a = r.uniform(0, TAU); L = r.uniform(0.15, 0.6)
        m.add(tube([(0.2 * math.cos(a), 0.2 * math.sin(a), 0.9), (0.21 * math.cos(a), 0.21 * math.sin(a), 0.9 - L)], lambda s_: 0.04 * (1 - 0.3 * s_), sides=4, colors=PALEG))
    m.add(trim(tube([(0, 0, 0.9), (0.01, 0, 1.0)], 0.012, sides=3, colors=('#1a1410', '#2a2018'))))
    return m, None


def cave_crystal():
    """A scrying ball on a turned stand with three claws."""
    m = Model('cave_crystal')
    m.add(trim(lathe([(0.0, 0), (0.3, 0.0), (0.32, 0.05), (0.16, 0.1), (0.12, 0.2), (0.2, 0.26)], sides=10, colors=('#1e0e30', '#5a3a7a'), close_top=False)))
    for k in range(3):
        a = TAU * k / 3
        m.add(trim(tube([(0.18 * math.cos(a), 0.18 * math.sin(a), 0.24), (0.3 * math.cos(a), 0.3 * math.sin(a), 0.4), (0.26 * math.cos(a), 0.26 * math.sin(a), 0.52)], 0.025, sides=4, colors=('#8a6a2a', '#e0b858'))))
    ball = blob(0.36, 0.36, 0.36, seg=12, rings=9, colors=PALEG)
    m.add(ball.xf(None, (0, 0, 0.62)))
    m.add(trim(blob(0.08, 0.03, 0.11, seg=5, rings=3, colors=('#ffffff', '#ffffff'))).xf(None, (0.16, -0.3, 0.76)))
    return m, None


def cave_book():
    """A grimoire stood on a shelf: a thick leather cover the game dyes, raised bands on the spine, brass corners and a clasp, deckled pages."""
    m = Model('cave_book')
    m.add(box(0.75, 0.37, 1.0, PALEG).xf(None, (0, 0, 0)))
    m.add(trim(box(0.68, 0.31, 0.94, ('#b8a878', '#efe4c0'))).xf(None, (0.06, 0, 0.03)))  # pages, proud at the fore-edge
    for z in (0.2, 0.5, 0.8):
        m.add(box(0.05, 0.39, 0.035, PALEG).xf(None, (-0.36, 0, z)))
    for z in (0.02, 0.9):
        for sy in (-1, 1):
            m.add(trim(box(0.14, 0.02, 0.1, ('#8a6a2a', '#e0b858'))).xf(None, (0.3, sy * 0.185, z)))
    m.add(trim(box(0.05, 0.4, 0.09, ('#8a6a2a', '#e0b858'))).xf(None, (0.37, 0, 0.46)))
    return m, None


def cave_hourglass():
    """An hourglass in a turned wooden frame, the sand half run."""
    m = Model('cave_hourglass')
    for z in (0.0, 0.94):
        m.add(lathe([(0.0, z), (0.26, z), (0.28, z + 0.03), (0.26, z + 0.06), (0.0, z + 0.06)], sides=10, colors=OAK, close_top=False))
    for k in range(3):
        a = TAU * k / 3
        m.add(lathe([(0.022, 0.06), (0.03, 0.3), (0.018, 0.5), (0.03, 0.7), (0.022, 0.94)], sides=5, colors=OAK_DK, close_top=False).xf(None, (0.22 * math.cos(a), 0.22 * math.sin(a), 0)))
    glass = ('#5a7a8a', '#c8e0ea')
    m.add(lathe([(0.0, 0.07), (0.17, 0.09), (0.18, 0.3), (0.03, 0.5), (0.18, 0.7), (0.17, 0.91), (0.0, 0.93)], sides=10, colors=glass, close_top=False))
    m.add(lathe([(0.0, 0.065), (0.175, 0.085), (0.185, 0.2), (0.0, 0.34)], sides=10, colors=('#b88a2a', '#f0cc60'), close_top=False))  # the sand that has fallen
    m.add(lathe([(0.03, 0.5), (0.12, 0.6), (0.0, 0.62)], sides=8, colors=('#b88a2a', '#f0cc60'), close_top=False))  # and what is left
    return m, None


def cave_eyejar():
    """A specimen jar, its lid tied down with cloth and cord, and an eye floating in it that looks back."""
    m = Model('cave_eyejar')
    m.add(lathe([(0.0, 0), (0.3, 0.0), (0.32, 0.06), (0.32, 0.7), (0.26, 0.78)], sides=11, colors=('#2a4a3a', '#8ab8a0'), close_top=False))
    m.add(trim(lathe([(0.26, 0.76), (0.3, 0.8), (0.31, 0.9), (0.2, 0.96), (0.0, 0.97)], sides=11, colors=('#8a7a5a', '#d8c8a0'), close_top=False)))
    m.add(trim(lathe([(0.3, 0.79), (0.33, 0.81), (0.3, 0.83)], sides=11, colors=('#4a3a2a', '#8a6a4a'), close_top=False)))
    m.add(trim(blob(0.2, 0.2, 0.2, seg=10, rings=7, colors=('#d8d0c0', '#ffffff'))).xf(None, (0, -0.04, 0.4)))
    m.add(glowing(blob(0.1, 0.05, 0.1, seg=8, rings=5, colors=('#6a0a0a', '#e02a1a'))).xf(None, (0, -0.21, 0.4)))
    m.add(trim(blob(0.045, 0.03, 0.045, seg=6, rings=4, colors=('#000000', '#0a0a0a'))).xf(None, (0, -0.25, 0.4)))
    for k in range(4):
        a = 0.6 + k * 1.5
        m.add(trimtube([(0.12 * math.cos(a), 0.1, 0.4 + 0.12 * math.sin(a)), (0.2 * math.cos(a), 0.2, 0.4 + 0.24 * math.sin(a))], 0.012, sides=3, colors=('#a02a2a', '#d86a6a')))  # trailing nerves
    return m, '#ff3a2a'


def cave_jar():
    """A lidded stoneware crock the game glazes, a paper label pasted on, the lid tied with twine."""
    m = Model('cave_jar')
    m.add(lathe([(0.0, 0), (0.26, 0.0), (0.34, 0.12), (0.36, 0.45), (0.3, 0.66), (0.2, 0.74), (0.22, 0.8)], sides=11, colors=PALEG, close_top=False))
    m.add(trim(lathe([(0.24, 0.78), (0.26, 0.84), (0.1, 0.92), (0.06, 0.98), (0.0, 0.99)], sides=11, colors=('#3a2a1a', '#7a5a3a'), close_top=False)))
    m.add(trim(lathe([(0.21, 0.73), (0.235, 0.75), (0.21, 0.77)], sides=11, colors=('#a89868', '#d8c8a0'), close_top=False)))
    m.add(trim(box(0.26, 0.012, 0.2, ('#c8b888', '#f0e4c0'))).xf(None, (0, -0.355, 0.26)))
    for z in (0.3, 0.36, 0.42):
        m.add(trim(box(0.18, 0.006, 0.015, ('#2a1a10', '#2a1a10'))).xf(None, (0, -0.365, z)))
    return m, None


def cave_moon():
    """A brass crescent moon on a stand, with two little stars on wires."""
    m = Model('cave_moon')
    BRASS = ('#7a5a1a', '#f0cc60')
    m.add(lathe([(0.0, 0), (0.22, 0.0), (0.24, 0.04), (0.06, 0.08), (0.04, 0.4)], sides=9, colors=IRON, close_top=False))
    outer = [(0.3 * math.cos(a), 0.3 * math.sin(a)) for a in np.linspace(-1.9, 1.9, 13)]
    inner = [(0.14 + 0.25 * math.cos(a), 0.25 * math.sin(a)) for a in np.linspace(-1.55, 1.55, 13)]
    v, f, t = [], [], []
    for (ox, oz), (ix, iz) in zip(outer, inner):
        for y in (-0.03, 0.03):
            v.append((-ox, y, 0.68 + oz)); t.append(0.5 + oz); v.append((-ix + 0.0, y, 0.68 + iz)); t.append(0.5 + iz)
    for i in range(12):
        a = i * 4
        f += [(a, a + 4, a + 5, a + 1), (a + 2, a + 3, a + 7, a + 6), (a, a + 2, a + 6, a + 4), (a + 1, a + 5, a + 7, a + 3)]
    crescent = Part(v, f, t, BRASS, smooth=False); crescent.glow = True
    m.add(crescent)
    for (x, z, r_) in ((0.3, 0.86, 0.05), (0.18, 0.98, 0.035)):
        m.add(tube([(0.0, 0, 0.4), (x, 0, z)], 0.006, sides=3, colors=IRON))
        st = blob(r_, r_ * 0.5, r_, seg=4, rings=2, colors=BRASS); st.glow = True
        m.add(st.xf(None, (x, 0, z)))
    return m, '#e8c860'


def cave_mushroom():
    """A dried toadstool kept on the shelf: a wrinkled cap the game colours, pale gills and a bent stem."""
    m = Model('cave_mushroom')
    m.add(trim(tube([(0.05, 0, 0), (0.0, 0, 0.3), (0.03, 0, 0.6)], lambda s_: 0.1 - 0.03 * s_, sides=7, colors=('#b8a888', '#efe4cc'))))
    m.add(trim(lathe([(0.08, 0.56), (0.4, 0.58)], sides=11, colors=('#d8c8a8', '#efe4cc'), close_top=False)).xf(None, (0.03, 0, 0)))
    cap = lathe([(0.42, 0.58), (0.4, 0.7), (0.3, 0.84), (0.14, 0.94), (0.0, 0.97)], sides=11, colors=PALEG, close_top=False)
    m.add(cap.xf(None, (0.03, 0, 0)))
    for k in range(6):
        a = TAU * k / 6 + 0.3
        m.add(trim(blob(0.05, 0.045, 0.02, seg=5, rings=3, colors=('#efe8da', '#ffffff'))).xf(None, (0.03 + 0.24 * math.cos(a), 0.24 * math.sin(a), 0.82)))
    return m, None


def cave_feathers():
    """A bunch of long feathers (crow, jay, owl) bound at the quills with red thread."""
    m = Model('cave_feathers')
    cols = [('#14141e', '#3a3a5a'), ('#2a4a7a', '#6a9ad0'), ('#5a4630', '#c8a878'), ('#1a1a1a', '#4a4a4a'), ('#6a5a48', '#e8dcc0')]
    for k in range(5):
        a = TAU * k / 5
        lean = 0.22
        R = rz(a) @ ry(-(math.pi / 2 - lean))
        m.add(blade(0.95, 0.2, lambda s_: math.sin(math.pi * min(1, s_ * 0.9 + 0.1)) ** 0.5 * (0.5 + 0.5 * s_) if s_ < 1 else 0, segs=5, cols=3, fold=0.12, rise=0, droop=-0.25, colors=cols[k]).xf(R, (0.03 * math.cos(a), 0.03 * math.sin(a), 0.05)))
        m.add(tube([(0.03 * math.cos(a), 0.03 * math.sin(a), 0.0), (0.03 * math.cos(a) + 0.07 * math.cos(a), 0.03 * math.sin(a) + 0.07 * math.sin(a), 0.4)], 0.008, sides=3, colors=('#d8d0c0', '#ffffff')))
    m.add(lathe([(0.06, 0.06), (0.065, 0.1), (0.06, 0.2)], sides=7, colors=('#8a1414', '#d83a2a'), close_top=False))
    return m, None


def glowing(p):
    p.glow = True
    return p


HOME = {'fp_foxglove': foxgloves, 'fp_meadow': meadow, 'fp_harebell': harebells, 'fp_campion': campion,
        'bed': box_bed, 'hearth': hearth, 'candle_stand': candle_stand, 'witch_ball': witch_ball,
        'altar_candle': altar_candle, 'athame': athame, 'censer': censer,
        'hall_table': hall_table, 'hall_bench': hall_bench, 'bookcase': bookcase, 'hall_banner': hall_banner, 'high_seat': high_seat,
        'chandelier': chandelier, 'wall_shield': wall_shield, 'standing_torch': standing_torch,
        'cave_potion': cave_potion, 'cave_candle': cave_candle, 'cave_crystal': cave_crystal, 'cave_book': cave_book, 'cave_hourglass': cave_hourglass,
        'cave_eyejar': cave_eyejar, 'cave_jar': cave_jar, 'cave_moon': cave_moon, 'cave_mushroom': cave_mushroom, 'cave_feathers': cave_feathers}

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for n in (sys.argv[1:] or list(HOME)):
        m, glow = HOME[n]()
        path = os.path.abspath(os.path.join(OUT, n + '.glb'))
        m.export(path, glow_color=glow or '#ffffff', glow_strength=0.35)
        print(n, m.tris(), 'tris', os.path.getsize(path), 'bytes')
