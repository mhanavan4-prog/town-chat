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


# ── The Wilds' fires and stones, and what a witch sets on her own altar ─────
STONE = [('#4a4640', '#8a847a'), ('#5a5248', '#9a9080'), ('#3e3a36', '#7a746a')]


def campfire():
    """A camp fire: a ring of field stones, split logs stacked to a point over a bed of embers and ash."""
    m = Model('campfire')
    r = np.random.default_rng(121)
    for k in range(9):
        a = TAU * k / 9 + r.uniform(-0.1, 0.1)
        m.add(blob(r.uniform(0.1, 0.14), r.uniform(0.08, 0.11), r.uniform(0.06, 0.09), seg=6, rings=4, colors=STONE[k % 3], jitter=0.25, seed=k).xf(rz(a), (0.42 * math.cos(a), 0.42 * math.sin(a), 0.05)))
    m.add(lathe([(0.0, 0.02), (0.34, 0.0)], sides=10, colors=('#1a1614', '#4a4440'), close_top=False))  # ash
    for k in range(7):
        a = r.uniform(0, TAU); d = r.uniform(0, 0.2)
        e = blob(0.05, 0.04, 0.025, seg=5, rings=3, colors=('#c82a0a', '#ffb040'), jitter=0.3, seed=k); e.glow = True
        m.add(e.xf(None, (d * math.cos(a), d * math.sin(a), 0.03)))
    for k in range(5):
        a = TAU * k / 5 + 0.3
        base = np.array([0.3 * math.cos(a), 0.3 * math.sin(a), 0.03]); top = np.array([-0.03 * math.cos(a), -0.03 * math.sin(a), 0.42])
        m.add(tube([base, top], lambda s_: 0.055 - 0.01 * s_, sides=6, colors=('#2a1a10', '#6a4a2a')))
        m.add(lathe([(0.0, 0), (0.052, 0)], sides=6, colors=('#b08a58', '#d8b888'), close_top=False).xf(look_rot(base - top) @ ry(math.pi / 2), base))
    return m, '#ff8a2a'


def waymarker():
    """A waymarker: a tall, leaning standing stone, weathered and lichened, set in a ring of packing stones, its face cut with a column of marks."""
    m = Model('waymarker')
    st = lathe([(0.16, 0.0), (0.17, 0.2), (0.15, 0.55), (0.12, 0.85), (0.07, 0.98), (0.0, 1.0)], sides=7, colors=('#55554e', '#a8a69e'))
    r = np.random.default_rng(122)
    for i in range(len(st.v)):
        st.v[i][:2] *= 1 + r.uniform(-0.1, 0.1)
        st.v[i][1] *= 0.7  # a slab, not a post
    m.add(st.xf(ry(0.06), (0, 0, 0)))
    for k in range(7):
        a = TAU * k / 7
        m.add(blob(r.uniform(0.07, 0.1), r.uniform(0.06, 0.09), 0.05, seg=6, rings=3, colors=STONE[k % 3], jitter=0.25, seed=k).xf(None, (0.22 * math.cos(a), 0.19 * math.sin(a), 0.03)))
    for k in range(9):  # lichen
        z = r.uniform(0.1, 0.9); a = r.uniform(0, TAU)
        rad = 0.15 * (1 - 0.5 * z)
        m.add(blob(0.04, 0.035, 0.008, seg=5, rings=3, colors=('#7a8a72', '#b8c8a8') if k % 3 else ('#d0701a', '#ffa83a'), jitter=0.3, seed=k).xf(rz(a) @ ry(math.pi / 2), (rad * math.cos(a) * 1.02, rad * 0.7 * math.sin(a) * 1.02, z)))
    for k in range(5):  # the marks cut down its face (they glow)
        z = 0.72 - 0.12 * k
        w = 0.13 * (1 - 0.5 * z)
        mk = box(0.07, 0.012, 0.016, ('#b37ae0', '#e0c0ff')); mk.glow = True
        m.add(mk.xf(ry((k % 2 * 2 - 1) * 0.5), (0.0, -w * 0.72 - 0.004, z)))
        if k % 2:
            mk2 = box(0.016, 0.012, 0.06, ('#b37ae0', '#e0c0ff')); mk2.glow = True
            m.add(mk2.xf(None, (0.0, -w * 0.72 - 0.004, z - 0.02)))
    return m, '#b37ae0'


def chalice():
    """A pewter chalice with a knopped stem, dark wine in the bowl."""
    m = Model('chalice')
    PEW = ('#5a5a62', '#d0d0d8')
    m.add(lathe([(0.0, 0), (0.22, 0.0), (0.24, 0.03), (0.06, 0.1), (0.04, 0.3), (0.08, 0.36), (0.04, 0.42), (0.06, 0.5), (0.22, 0.62), (0.26, 0.9), (0.24, 0.9), (0.2, 0.66), (0.0, 0.56)], sides=11, colors=PEW, close_top=False))
    m.add(lathe([(0.0, 0.84), (0.235, 0.84)], sides=11, colors=('#3a0a14', '#7a1a2a'), close_top=False))
    return m, None


def hand_bell():
    """A brass hand bell with a turned wooden handle."""
    m = Model('hand_bell')
    BR = ('#7a5a1a', '#f0cc60')
    m.add(lathe([(0.3, 0.0), (0.28, 0.06), (0.2, 0.3), (0.14, 0.46), (0.06, 0.52), (0.0, 0.53)], sides=11, colors=BR, close_top=False))
    m.add(lathe([(0.29, 0.0), (0.31, 0.02), (0.29, 0.04)], sides=11, colors=BR, close_top=False))
    m.add(lathe([(0.04, 0.52), (0.06, 0.6), (0.045, 0.75), (0.065, 0.9), (0.0, 0.97)], sides=8, colors=OAK, close_top=False))
    m.add(blob(0.05, 0.05, 0.05, seg=6, rings=4, colors=IRON).xf(None, (0.06, 0, 0.04)))  # the clapper
    return m, None


def rune_stones():
    """A scatter of river pebbles, each cut with a mark, on a square of cloth."""
    m = Model('rune_stones')
    m.add(box(0.9, 0.9, 0.012, ('#3a1a4a', '#6a3a7a')).xf(rz(0.2), (0, 0, 0)))
    r = np.random.default_rng(123)
    for k in range(7):
        a = TAU * k / 7 + r.uniform(-0.3, 0.3); d = r.uniform(0.08, 0.34)
        x, y = d * math.cos(a), d * math.sin(a)
        m.add(blob(0.1, 0.08, 0.04, seg=7, rings=4, colors=('#8a8a84', '#d8d6cc'), jitter=0.12, seed=k).xf(rz(a), (x, y, 0.045)))
        mk = box(0.012, 0.07, 0.008, ('#b37ae0', '#e0c0ff')); mk.glow = True
        m.add(mk.xf(rz(a + (k % 3) * 0.6), (x, y, 0.086)))
        if k % 2:
            mk2 = box(0.05, 0.012, 0.008, ('#b37ae0', '#e0c0ff')); mk2.glow = True
            m.add(mk2.xf(rz(a + 0.5), (x, y + 0.01, 0.086)))
    return m, '#b37ae0'


def scrying_mirror():
    """A black scrying mirror: a disc of polished obsidian in a carved frame on a little easel."""
    m = Model('scrying_mirror')
    tilt = rx(-0.25)
    m.add(lathe([(0.0, 0.0), (0.34, 0.0)], sides=16, colors=('#06060c', '#2a2a4a'), close_top=False).xf(tilt @ rx(math.pi / 2), (0, 0, 0.5)))
    m.add(lathe([(0.34, -0.03), (0.42, -0.03), (0.44, 0.0), (0.42, 0.04), (0.34, 0.04)], sides=16, colors=('#7a5a1a', '#e8c058'), close_top=False).xf(tilt @ rx(math.pi / 2), (0, 0, 0.5)))
    m.add(blob(0.1, 0.02, 0.16, seg=5, rings=3, colors=('#9a9ad0', '#e0e0ff')).xf(tilt, (0.1, -0.03, 0.62)))  # a gleam in the glass
    for sx in (-1, 1):
        m.add(tube([(sx * 0.2, 0.0, 0.14), (sx * 0.28, -0.08, 0.0)], 0.02, sides=4, colors=OAK_DK))
    m.add(tube([(0, 0.08, 0.5), (0, 0.34, 0.0)], 0.02, sides=4, colors=OAK_DK))
    return m, None


def pentacle_plaque():
    """A round wooden plaque inlaid with a brass pentacle in its ring."""
    m = Model('pentacle_plaque')
    m.add(lathe([(0.0, 0.0), (0.46, 0.0), (0.5, 0.02), (0.5, 0.05), (0.46, 0.07), (0.0, 0.07)], sides=18, colors=OAK, close_top=False))
    BR = ('#8a6a2a', '#f0cc60')
    ring = lathe([(0.4, 0.07), (0.4, 0.085), (0.37, 0.085), (0.37, 0.07)], sides=18, colors=BR, close_top=False); ring.glow = True
    m.add(ring)
    pts = [(0.385 * math.sin(TAU * k / 5), 0.385 * math.cos(TAU * k / 5), 0.085) for k in range(5)]
    for k in range(5):
        seg = tube([pts[k], pts[(k + 2) % 5]], 0.012, sides=4, colors=BR); seg.glow = True
        m.add(seg)
    return m, '#e8c058'


def crystal_cluster():
    """A cluster of quartz points on their matrix, clear at the tips and violet at the root."""
    m = Model('crystal_cluster')
    m.add(blob(0.36, 0.3, 0.1, seg=8, rings=4, colors=STONE[0], jitter=0.25, seed=5).xf(None, (0, 0, 0.06)))
    r = np.random.default_rng(124)
    for k in range(8):
        a = r.uniform(0, TAU); d = r.uniform(0, 0.22); h = r.uniform(0.35, 0.9) * (1 - d)
        lean = np.array([math.cos(a) * d * 1.2, math.sin(a) * d * 1.2, 1.0]); lean /= np.linalg.norm(lean)
        w = r.uniform(0.05, 0.085)
        c = lathe([(w, 0), (w, h * 0.75), (0.0, h)], sides=6, colors=('#6a3ab0', '#f0e4ff'), close_top=False)
        c.glow = True; c.smooth = False
        m.add(c.xf(look_rot(lean) @ ry(math.pi / 2), (d * math.cos(a), d * math.sin(a), 0.08)))
    return m, '#b890ff'


def open_grimoire():
    """A grimoire lying open: the pages fanned from the gutter, a ribbon marker, a sigil inked on the leaf."""
    m = Model('open_grimoire')
    m.add(box(1.0, 0.7, 0.05, ('#3a1418', '#7a2a30')).xf(None, (0, 0, 0)))
    for sx in (-1, 1):
        pg = blade(0.46, 0.64, lambda s_: 1.0 if s_ < 1 else 1.0, segs=4, cols=3, fold=0.0, rise=0.35, droop=0.5, colors=('#c8b888', '#f4ecd0'))
        m.add(pg.xf(rz(0 if sx > 0 else math.pi), (sx * 0.01, 0, 0.055)))
        for k in range(4):
            m.add(box(0.3, 0.012, 0.004, ('#3a2a1a', '#3a2a1a')).xf(None, (sx * 0.24, 0.2 - 0.09 * k, 0.12)))
    sig = lathe([(0.07, 0.0), (0.085, 0.0)], sides=10, colors=('#6a1a8a', '#b060e0'), close_top=False); sig.glow = True
    m.add(sig.xf(None, (0.24, -0.16, 0.125)))
    m.add(tube([(0.0, 0.3, 0.07), (0.02, 0.0, 0.1), (0.03, -0.42, 0.04)], 0.012, sides=3, colors=('#8a1414', '#d83a2a')))
    return m, '#b060e0'


def glowing(p):
    p.glow = True
    return p


# ── The rooms of the town: bar, rugs, cabinets, pedestals and their relics ──
BRASS = ('#7a5a1a', '#f0cc60')
PEWTER = ('#5a5a62', '#d0d0d8')
SILVER = ('#7a8090', '#f0f4ff')
WAXEN = ('#c89a48', '#f4dc98')


def bottle(h, rr, col, cork=True):
    """A hand-blown bottle: shouldered, a long neck, a cork."""
    parts = [lathe([(rr * 0.85, 0), (rr, h * 0.06), (rr, h * 0.5), (rr * 0.35, h * 0.68), (rr * 0.3, h * 0.92), (rr * 0.4, h * 0.94), (rr * 0.38, h)], sides=7, colors=col, close_bottom=True)]
    if cork:
        parts.append(lathe([(rr * 0.3, h), (rr * 0.32, h * 1.07)], sides=5, colors=('#8a6a3a', '#c8a060')))
    return parts


def bar_counter():
    """An oak bar: a panelled front on a kick-board, a thick worn top with a brass rail, and behind it a back-bar of bottles, tankards and a tapped cask."""
    m = Model('bar_counter')
    L, D, H = 1.6, 0.22, 0.34
    m.add(box(L, D, H, OAK).xf(None, (0, 0, 0)))
    m.add(box(L + 0.02, D - 0.04, 0.05, OAK_DK).xf(None, (0, 0.02, 0)))
    n = 6
    for k in range(n):  # raised panels between stiles
        x = -L / 2 + (k + 0.5) * L / n
        m.add(box(L / n * 0.74, 0.02, H * 0.58, ('#5a3a20', '#9a6a3e')).xf(None, (x, -D / 2 - 0.006, H * 0.2)))
        m.add(box(0.03, 0.03, H * 0.9, OAK_DK).xf(None, (x - L / n / 2, -D / 2 - 0.006, 0.02)))
    m.add(box(0.03, 0.03, H * 0.9, OAK_DK).xf(None, (L / 2 - 0.015, -D / 2 - 0.006, 0.02)))
    for k in range(3):  # the top, three long boards
        m.add(box(L + 0.06, 0.09, 0.035, ('#3a2414', '#6a4426'), jitter=0.004, seed=k).xf(None, (0, -0.09 + k * 0.09, H)))
    m.add(trimtube([(-L / 2, -D / 2 - 0.05, 0.09), (L / 2, -D / 2 - 0.05, 0.09)], 0.012, sides=6, colors=BRASS))  # the foot rail
    for k in range(5):
        x = -L / 2 + 0.05 + k * (L - 0.1) / 4
        m.add(trimtube([(x, -D / 2, 0.09), (x, -D / 2 - 0.05, 0.09)], 0.009, sides=5, colors=BRASS))
    # things left on the top
    for (x, y) in ((-0.5, -0.02), (0.1, 0.03), (0.55, -0.04)):
        m.add(trim(lathe([(0.022, 0), (0.026, 0.005), (0.024, 0.05), (0.027, 0.055), (0.022, 0.055), (0.02, 0.01)], sides=8, colors=PEWTER, close_top=False)).xf(None, (x, y, H + 0.035)))
        m.add(trimtube([(x + 0.024, y, H + 0.08), (x + 0.045, y, H + 0.07), (x + 0.045, y, H + 0.05), (x + 0.025, y, H + 0.045)], 0.004, sides=4, colors=PEWTER))
    m.add(trim(box(0.12, 0.08, 0.008, ('#b0a890', '#e8e0c8'))).xf(rz(0.2), (-0.2, 0.0, H + 0.035)))  # a bar cloth
    # the back-bar: uprights, three shelves, a plank back
    BY, BH, BD = 0.185, 0.62, 0.1
    m.add(box(L * 0.9, 0.02, BH, OAK_DK).xf(None, (0, BY + BD / 2, 0)))
    for sx in (-1, 0, 1):
        m.add(box(0.035, BD, BH, OAK).xf(None, (sx * L * 0.44, BY, 0)))
    shelves = (0.16, 0.34, 0.5)
    for z in shelves:
        m.add(box(L * 0.9, BD, 0.022, OAK).xf(None, (0, BY, z)))
    m.add(box(L * 0.94, BD + 0.03, 0.035, OAK).xf(None, (0, BY - 0.01, BH)))
    r = np.random.default_rng(301)
    GLASS = [('#1e4a24', '#5a9a50'), ('#5a1a1a', '#b0443a'), ('#1a3050', '#4a80b0'), ('#4a3414', '#a8803a'), ('#3a1a4a', '#8a5ab0'), ('#2a4a4a', '#6ab0a8')]
    for si, z in enumerate(shelves[1:]):
        x = -L * 0.42
        while x < L * 0.42:
            if abs(x) < 0.05 or abs(abs(x) - L * 0.44) < 0.04:
                x += 0.05; continue
            h = r.uniform(0.075, 0.12); rr = r.uniform(0.016, 0.024)
            for pt in bottle(h, rr, GLASS[int(r.integers(0, len(GLASS)))]):
                m.add(trim(pt).xf(None, (x, BY - 0.005, z + 0.022)))
            x += rr * 2 + r.uniform(0.012, 0.04)
    for k in range(5):  # tankards hung in a row under the low shelf
        x = -0.6 + k * 0.11
        m.add(trim(lathe([(0.022, 0), (0.024, 0.05), (0.02, 0.05), (0.018, 0.004)], sides=7, colors=PEWTER, close_top=False)).xf(None, (x, BY - 0.02, shelves[0] + 0.03)))
    # a tapped cask on its cradle
    cask = lathe([(0.0, -0.11), (0.07, -0.11), (0.09, -0.05), (0.095, 0.0), (0.09, 0.05), (0.07, 0.11), (0.0, 0.11)], sides=10, colors=('#5a3a1e', '#a0703e'), close_top=False)
    m.add(cask.xf(ry(math.pi / 2), (0.42, BY, shelves[0] + 0.07), 0.48))
    for dx in (-0.034, 0.034):
        m.add(trim(lathe([(0.088, -0.008), (0.094, 0.0), (0.088, 0.008)], sides=10, colors=IRON, close_top=False)).xf(ry(math.pi / 2), (0.42 + dx, BY, shelves[0] + 0.07), 0.48))
    m.add(trimtube([(0.474, BY, shelves[0] + 0.05), (0.49, BY, shelves[0] + 0.05), (0.49, BY, shelves[0] + 0.035)], 0.004, sides=5, colors=BRASS))
    return m, None


def rug():
    """A hand-knotted rug: a dyed field inside two borders, a lozenge medallion, a knotted fringe at each end."""
    m = Model('rug')
    W, D, T = 1.0, 1.0, 0.012
    PALE = ('#b8b0a8', '#ffffff')
    GOLD = ('#7a6238', '#b0915a')
    UMBER = ('#241a14', '#40302a')
    m.add(box(W, D, T, PALE).xf(None, (0, 0, 0)))
    def band(w, d, t, col):
        for (bx, by, sx, sy) in ((0, d / 2, w + t, t), (0, -d / 2, w + t, t), (w / 2, 0, t, d + t), (-w / 2, 0, t, d + t)):
            m.add(trim(box(sx, sy, 0.004, col)).xf(None, (bx, by, T - 0.001)))
    band(0.94, 0.94, 0.03, GOLD)
    band(0.84, 0.84, 0.012, UMBER)
    band(0.78, 0.78, 0.008, GOLD)
    for (rr, col) in ((0.26, GOLD), (0.2, UMBER), (0.1, GOLD)):
        m.add(trim(lathe([(rr - 0.025, T + 0.002), (rr, T + 0.002)], sides=4, colors=col, close_top=False)))
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.add(trim(lathe([(0.0, T + 0.002), (0.05, T + 0.002)], sides=4, colors=GOLD, close_top=False)).xf(None, (sx * 0.3, sy * 0.3, 0)))
    n = 110
    r = np.random.default_rng(5)
    for sx in (-1, 1):  # the fringe: fine, short, a little unruly
        for k in range(n):
            y = -D / 2 + (k + 0.5) * D / n
            m.add(trimtube([(sx * W / 2, y, T * 0.6), (sx * (W / 2 + r.uniform(0.008, 0.013)), y + r.uniform(-0.003, 0.003), 0.003)], 0.0016, sides=3, colors=('#8a7c60', '#c0b08a')))
    return m, None


def arcade_cabinet():
    """An enchanted cabinet: a night-blue case with silver edging, a hooded screen, a control deck with a crystal lever and studs, runes down the front, a crown of quartz."""
    m = Model('arcade_cabinet')
    NIGHT = ('#0a1228', '#22366a')
    W, D = 0.30, 0.26
    m.add(trim(box(W, D, 0.3, NIGHT)).xf(None, (0, 0, 0)))            # the lower case
    m.add(trim(box(W + 0.02, D + 0.02, 0.03, ('#060a18', '#141f3d'))).xf(None, (0, 0, 0)))
    m.add(trim(box(W, D, 0.34, NIGHT)).xf(None, (0, 0, 0.3)))                # the upper case
    deck = trim(box(W, D * 0.46, 0.03, ('#1a2a52', '#3a56a0')))
    m.add(deck.xf(rx(0.32), (0, -D / 2 - 0.045, 0.285)))                      # the control deck, tilted to the hands
    for sx in (-1, 1):                                                # cheek boards
        m.add(trim(box(0.018, D, 0.66, ('#101a38', '#2a4080'))).xf(None, (sx * (W / 2 + 0.006), 0, 0)))
        m.add(trimtube([(sx * (W / 2 + 0.016), -D / 2, 0.02), (sx * (W / 2 + 0.016), -D / 2, 0.66)], 0.006, sides=4, colors=SILVER))
    m.add(trim(box(W + 0.04, D * 0.5, 0.05, NIGHT)).xf(rx(-0.25), (0, -D / 2 + 0.03, 0.59)))   # the hood over the screen
    # the screen's silver frame; the game lays the lit screen inside it
    for (bx, bz, sx, sz) in ((0, 0.345, 0.22, 0.014), (0, 0.535, 0.22, 0.014), (-0.105, 0.44, 0.014, 0.2), (0.105, 0.44, 0.014, 0.2)):
        m.add(trim(box(sx, 0.012, sz, SILVER)).xf(None, (bx, -D / 2 + 0.004, bz - sz / 2)))
    # the lever and studs
    m.add(trimtube([(-0.07, -0.19, 0.32), (-0.075, -0.2, 0.37)], 0.005, sides=5, colors=SILVER))
    m.add(glowing(blob(0.014, 0.014, 0.014, seg=6, rings=4, colors=('#5ad0ff', '#d8f6ff'))).xf(None, (-0.075, -0.2, 0.38)))
    for k, col in enumerate((('#ff5a8a', '#ffc0d8'), ('#5affc0', '#d8fff0'), ('#ffd45a', '#fff4c8'))):
        m.add(glowing(lathe([(0.012, 0), (0.012, 0.008), (0.0, 0.012)], sides=7, colors=col)).xf(rx(0.32), (0.02 + k * 0.035, -0.19 + 0.004 * k, 0.318 - 0.001 * k)))
    # runes cut down the front panel
    r = np.random.default_rng(88)
    for k in range(5):
        x = -0.1 + k * 0.05
        z = 0.2 - (k % 2) * 0.05
        m.add(glowing(box(0.008, 0.006, 0.05, ('#3a8aff', '#bfe4ff'))).xf(None, (x, -D / 2 - 0.002, z - 0.025)))
        m.add(glowing(box(0.024, 0.006, 0.007, ('#3a8aff', '#bfe4ff'))).xf(ry(r.uniform(-0.7, 0.7)), (x, -D / 2 - 0.002, z + r.uniform(-0.012, 0.012))))
    m.add(glowing(lathe([(0.03, 0.0), (0.04, 0.0)], sides=12, colors=('#3a8aff', '#bfe4ff'), close_top=False)).xf(rx(math.pi / 2), (0, -D / 2 - 0.003, 0.08)))  # a coin-moon
    # the crown: a silver cornice and quartz points
    m.add(trim(box(W + 0.05, D + 0.03, 0.025, SILVER)).xf(None, (0, 0, 0.64)))
    for (x, y, h, a) in ((-0.12, 0.04, 0.11, -0.25), (0.12, 0.04, 0.11, 0.25), (0.0, 0.05, 0.15, 0.0), (-0.06, 0.07, 0.08, -0.12), (0.06, 0.07, 0.08, 0.12)):
        m.add(glowing(lathe([(0.0, 0), (0.022, 0.0), (0.026, h * 0.7), (0.0, h)], sides=6, colors=('#3a7ae0', '#d8f0ff'))).xf(ry(a), (x, y, 0.66)))
    return m, '#6ab8ff'


def pedestal():
    """A turned stone pedestal for a thing under glass: a stepped foot, a waisted shaft, a moulded cap with a brass collar for the dome."""
    m = Model('pedestal')
    PALE = ('#8a8a8a', '#ffffff')
    m.add(lathe([(0.15, 0), (0.15, 0.025), (0.135, 0.03), (0.135, 0.05), (0.11, 0.07), (0.095, 0.13), (0.1, 0.2), (0.12, 0.225), (0.14, 0.235), (0.145, 0.26), (0.13, 0.27)], sides=12, colors=PALE, close_top=True, close_bottom=True))
    for z in (0.085, 0.2):
        m.add(lathe([(0.1, z - 0.008), (0.112, z), (0.1, z + 0.008)], sides=12, colors=PALE, close_top=False))
    m.add(trim(lathe([(0.128, 0.27), (0.134, 0.275), (0.128, 0.285), (0.12, 0.285)], sides=14, colors=BRASS, close_top=False)))
    m.add(trim(box(0.09, 0.008, 0.035, BRASS)).xf(None, (0, -0.105, 0.14)))  # the label plate
    return m, None


def relic_orb_stand():
    """Three brass claws on a ring foot, to hold a scrying ball."""
    m = Model('relic_orb_stand')
    m.add(trim(lathe([(0.0, 0), (0.07, 0.0), (0.075, 0.012), (0.05, 0.02), (0.03, 0.03), (0.0, 0.03)], sides=10, colors=BRASS, close_top=False)))
    for k in range(3):
        a = TAU * k / 3 + 0.5
        c, s_ = math.cos(a), math.sin(a)
        m.add(trimtube([(0.03 * c, 0.03 * s_, 0.025), (0.06 * c, 0.06 * s_, 0.045), (0.07 * c, 0.07 * s_, 0.075), (0.068 * c, 0.068 * s_, 0.1)], lambda u: 0.009 * (1 - 0.5 * u), sides=5, colors=BRASS))
    return m, None


def relic_blade():
    """A starforged short sword, point down in a block of dark stone: a fullered blade, a crescent guard, a wrapped grip and a star-stone pommel."""
    m = Model('relic_blade')
    m.add(trim(box(0.11, 0.09, 0.035, ('#1a2238', '#3a4a70'), jitter=0.04, seed=3)).xf(None, (0, 0, 0)))
    bl = lathe([(0.0, 0.0), (0.014, 0.05), (0.02, 0.22), (0.02, 0.235)], sides=4, colors=('#8aa8e0', '#f4f8ff'), close_top=True)
    bl.v[:, 1] *= 0.28
    m.add(glowing(bl).xf(None, (0, 0, 0.02)))
    m.add(trim(box(0.004, 0.012, 0.16, ('#5a78c0', '#a8c0f0'))).xf(None, (0, 0, 0.08)))   # the fuller
    m.add(trimtube([(-0.05, 0, 0.245), (-0.03, 0, 0.258), (0, 0, 0.262), (0.03, 0, 0.258), (0.05, 0, 0.245)], lambda u: 0.007 + 0.004 * math.sin(u * math.pi), sides=5, colors=SILVER))
    m.add(trimtube([(0, 0, 0.262), (0, 0, 0.33)], 0.008, sides=6, colors=('#1a2a52', '#3a56a0')))
    for k in range(4):
        m.add(trim(lathe([(0.0095, 0.272 + k * 0.015), (0.0095, 0.277 + k * 0.015)], sides=6, colors=SILVER, close_top=False)))
    st = lathe([(0.0, 0.0), (0.016, 0.014), (0.0, 0.03)], sides=6, colors=('#5ab0ff', '#e8f8ff'))
    m.add(glowing(st).xf(None, (0, 0, 0.33)))
    return m, '#8ac0ff'


def relic_crescent():
    """A silver crescent moon on a slender stand, two star-motes on wires beside it."""
    m = Model('relic_crescent')
    m.add(trim(lathe([(0.0, 0), (0.045, 0.0), (0.05, 0.008), (0.012, 0.02), (0.008, 0.06), (0.0, 0.06)], sides=9, colors=SILVER, close_top=False)))
    pts_o, pts_i = [], []
    n = 14
    for k in range(n + 1):
        a = math.radians(-125 + 250 * k / n)
        pts_o.append((0.065 * math.cos(a), 0.065 * math.sin(a)))
        pts_i.append((0.022 + 0.055 * math.cos(a) * 0.9, 0.058 * math.sin(a)))
    v, f, t = [], [], []
    for side in (-1, 1):
        for k in range(n + 1):
            w = math.sin(math.pi * k / n)
            xo, zo = pts_o[k]; xi, zi = pts_i[k]
            v.append((-xo, side * 0.012 * w, zo)); v.append((-xi, side * 0.006 * w, zi))
            t += [0.3 + 0.7 * w, 1.0]
    off = 2 * (n + 1)
    for k in range(n):
        a = 2 * k
        f.append((a, a + 2, a + 3, a + 1))
        f.append((off + a, off + a + 1, off + a + 3, off + a + 2))
        f.append((a, off + a, off + a + 2, a + 2))
        f.append((a + 1, a + 3, off + a + 3, off + a + 1))
    moon = Part(v, f, t, ('#8a94d0', '#f4f6ff'), smooth=False)
    m.add(glowing(moon).xf(None, (0.005, 0, 0.125)))
    for (x, z, rr) in ((0.06, 0.15, 0.011), (0.04, 0.19, 0.007)):
        m.add(trimtube([(0.0, 0, 0.06), (x * 0.6, 0, z * 0.7), (x, 0, z)], 0.0018, sides=3, colors=SILVER))
        m.add(glowing(lathe([(0.0, -rr), (rr, 0.0), (0.0, rr)], sides=4, colors=('#c8d0ff', '#ffffff'))).xf(None, (x, 0, z)))
    return m, '#aab4ff'


def relic_lantern():
    """A wrought-iron lantern: a footed base, four barred sides, a pierced cap and a carrying ring. The game sets the flame inside."""
    m = Model('relic_lantern')
    m.add(trim(lathe([(0.0, 0), (0.06, 0.0), (0.065, 0.012), (0.055, 0.02), (0.0, 0.02)], sides=8, colors=IRON, close_top=False, phase=TAU / 16)))
    for k in range(8):
        a = TAU * k / 8 + TAU / 16
        rr = 0.0045 if k % 2 == 0 else 0.0028
        m.add(trimtube([(0.052 * math.cos(a), 0.052 * math.sin(a), 0.02), (0.052 * math.cos(a), 0.052 * math.sin(a), 0.155)], rr, sides=4, colors=IRON))
    for z in (0.065, 0.11):
        m.add(trim(lathe([(0.05, z - 0.003), (0.054, z), (0.05, z + 0.003)], sides=8, colors=IRON, close_top=False, phase=TAU / 16)))
    m.add(trim(lathe([(0.062, 0.155), (0.058, 0.165), (0.03, 0.195), (0.015, 0.2), (0.012, 0.215), (0.0, 0.215)], sides=8, colors=IRON, close_top=False, phase=TAU / 16)))
    ring = [(0.02 * math.cos(u), 0, 0.235 + 0.02 * math.sin(u)) for u in np.linspace(-math.pi / 2, math.pi * 1.5, 9)]
    m.add(trimtube(ring, 0.004, sides=4, colors=IRON))
    m.add(trim(lathe([(0.0, 0.02), (0.018, 0.02), (0.02, 0.03), (0.0, 0.032)], sides=6, colors=('#3a3a36', '#6a6a60'))))  # the candle cup
    return m, None


def relic_jar():
    """The furniture of a spirit jar: an iron foot, a waxed-cloth lid bound with cord, a lead seal, a paper ward. The game sets the glass and what is in it."""
    m = Model('relic_jar')
    m.add(trim(lathe([(0.0, 0), (0.06, 0.0), (0.062, 0.012), (0.05, 0.016)], sides=10, colors=IRON)))
    m.add(trim(lathe([(0.058, 0.135), (0.062, 0.14), (0.062, 0.155), (0.05, 0.17), (0.0, 0.175)], sides=10, colors=('#4a3a2a', '#9a8060'))))
    m.add(trim(lathe([(0.064, 0.14), (0.068, 0.146), (0.064, 0.152)], sides=10, colors=('#a08a5a', '#d8c090'), close_top=False)))
    for k in range(7):  # the cloth's skirt, below the cord
        a = TAU * k / 7
        m.add(trim(blade(0.035, 0.04, round_, segs=2, cols=3, fold=0.05, rise=-1.2, droop=0.2, colors=('#4a3a2a', '#8a7050'))).xf(rz(a), (0.058 * math.cos(a), 0.058 * math.sin(a), 0.14)))
    m.add(trim(lathe([(0.0, 0.0), (0.018, 0.0), (0.016, 0.008), (0.0, 0.01)], sides=7, colors=('#5a5a60', '#a0a0a8'))).xf(None, (0, 0, 0.175)))
    m.add(trim(box(0.035, 0.002, 0.07, ('#c8b888', '#f0e4c0'))).xf(None, (0, -0.058, 0.05)))  # the ward, pasted on the glass
    m.add(glowing(lathe([(0.007, 0.0), (0.011, 0.0)], sides=8, colors=('#8a1a1a', '#e04a3a'), close_top=False)).xf(rx(math.pi / 2), (0, -0.0595, 0.1)))  # a binding mark in red ink
    for (dx, a_) in ((-0.006, 0.5), (0.006, -0.5), (0.0, 0.0)):
        m.add(glowing(box(0.003, 0.003, 0.04, ('#8a1a1a', '#e04a3a'))).xf(ry(a_), (dx, -0.06, 0.055)))
    return m, '#e04a3a'


def relic_planchette():
    """A heart-shaped planchette of dark wood on three bone pegs, a glass eye set in it, lying on a scrap of talking board."""
    m = Model('relic_planchette')
    m.add(trim(box(0.24, 0.17, 0.008, ('#3a2a1a', '#7a5a34'))).xf(rz(0.25), (0, 0, 0)))
    for k in range(5):
        m.add(trim(box(0.012, 0.016, 0.002, ('#1a1008', '#1a1008'))).xf(rz(0.25), (-0.08 + k * 0.04, 0.05 - 0.004 * k, 0.008)))
    pts = []
    n = 16
    for k in range(n):
        u = TAU * k / n
        x = 16 * math.sin(u) ** 3
        y = 13 * math.cos(u) - 5 * math.cos(2 * u) - 2 * math.cos(3 * u) - math.cos(4 * u)
        pts.append((x * 0.0056, -y * 0.0056 - 0.012))
    v, f, t = [], [], []
    for z in (0.03, 0.04):
        for (x, y) in pts:
            v.append((x, y, z)); t.append(0.3 if z < 0.035 else 0.9)
    v.append((0, -0.01, 0.03)); t.append(0.3); cb = len(v) - 1
    v.append((0, -0.01, 0.041)); t.append(1.0); ct = len(v) - 1
    for k in range(n):
        k1 = (k + 1) % n
        f.append((k, k1, n + k1, n + k)); f.append((cb, k1, k)); f.append((ct, n + k, n + k1))
    m.add(trim(Part(v, f, t, ('#2a1a10', '#6a4426'), smooth=False)).xf(rz(-0.3), (0.0, 0.0, 0)))
    m.add(glowing(lathe([(0.0, 0.0), (0.016, 0.0), (0.012, 0.006), (0.0, 0.008)], sides=9, colors=('#6affc0', '#e0fff0'))).xf(None, (0.0, 0.005, 0.04)))
    m.add(trim(lathe([(0.016, 0.0), (0.02, 0.0), (0.02, 0.003)], sides=9, colors=BRASS, close_top=False)).xf(None, (0.0, 0.005, 0.04)))
    for (x, y) in ((-0.045, 0.035), (0.045, 0.035), (0.02, -0.06)):
        m.add(trim(lathe([(0.004, 0.008), (0.006, 0.03)], sides=5, colors=('#c8bca0', '#f0e8d4'), close_top=False)).xf(None, (x, y, 0)))
    return m, '#6affc0'


def herb_bundle():
    """Herbs tied to dry, hung heads-down on a length of twine: lavender, sage and rosemary, bound with a twist of cord."""
    m = Model('herb_bundle')
    TW = ('#8a6a3a', '#c8a468')
    m.add(tube([(0, 0, 0.46), (0, 0, 0.26)], 0.004, sides=3, colors=TW))
    m.add(lathe([(0.02, 0.235), (0.024, 0.245), (0.02, 0.255)], sides=7, colors=TW, close_top=False))
    r = np.random.default_rng(64)
    for k in range(13):
        a = r.uniform(0, TAU); sp = r.uniform(0.02, 0.075); L = r.uniform(0.17, 0.24)
        tip = (sp * math.cos(a), sp * math.sin(a), 0.25 - L)
        kind = k % 3
        scol = (('#5a6a3a', '#8a9a5a'), ('#6a7a5a', '#a8b890'), ('#3a4a2a', '#6a7a4a'))[kind]
        m.add(tube([(0.008 * math.cos(a), 0.008 * math.sin(a), 0.3), (0.012 * math.cos(a), 0.012 * math.sin(a), 0.24), tip], 0.0035, sides=3, colors=scol))
        if kind == 0:  # lavender: a spike of dried buds
            for j in range(5):
                u = 0.62 + 0.09 * j
                p = (tip[0] * u, tip[1] * u, 0.25 - L * u)
                m.add(blob(0.008, 0.008, 0.011, seg=5, rings=3, colors=('#5a4a7a', '#a890d0')).xf(None, p))
        elif kind == 1:  # sage: grey felted leaves
            for j in range(4):
                u = 0.35 + 0.18 * j
                p = (tip[0] * u, tip[1] * u, 0.25 - L * u)
                m.add(blade(0.06, 0.024, lanceolate, segs=2, cols=3, fold=0.2, rise=-1.1, droop=0.3, colors=('#6a7a5a', '#b0c098')).xf(rz(a + (1.2 if j % 2 else -1.2)), p))
        else:  # rosemary: needles up the stem
            for j in range(8):
                u = 0.3 + 0.085 * j
                p = (tip[0] * u, tip[1] * u, 0.25 - L * u)
                m.add(blade(0.028, 0.006, linear, segs=1, cols=2, fold=0.0, rise=-0.7, droop=0.0, colors=('#2e4a2a', '#5a7a4a')).xf(rz(a + j * 2.4), p))
    return m, None


def pumpkin():
    """A ribbed field pumpkin with a corky stem and a curl of vine."""
    m = Model('pumpkin')
    ribs, per = 9, 4
    prof = [(0.0, 0.03), (0.2, 0.0), (0.4, 0.08), (0.5, 0.24), (0.52, 0.38), (0.46, 0.54), (0.3, 0.66), (0.12, 0.69), (0.0, 0.66)]
    body = lathe(prof, sides=ribs * per, colors=('#8a3a10', '#f09030'), close_top=False)
    for i, v in enumerate(body.v):
        ang = math.atan2(v[1], v[0])
        crease = abs(math.cos(ang * ribs / 2)) ** 0.6      # 1 on a rib's crown, 0 in the groove
        k = 0.86 + 0.14 * crease
        v[0] *= k; v[1] *= k
        body.t[i] = 0.25 + 0.75 * crease * (0.5 + 0.5 * min(1.0, v[2] / 0.5))
    m.add(body)
    m.add(tube([(0, 0, 0.66), (0.01, 0.0, 0.76), (0.06, 0.02, 0.84)], lambda u: 0.06 * (1 - 0.45 * u), sides=6, colors=('#4a4a20', '#8a8a4a')))
    curl = [(0.03 + 0.07 * u + 0.03 * math.cos(u * 9), 0.03 * math.sin(u * 9), 0.7 + 0.03 * u) for u in np.linspace(0, 1.6, 12)]
    m.add(tube(curl, 0.008, sides=3, colors=('#3a5a2a', '#6a9a4a')))
    m.add(blade(0.22, 0.2, heart, segs=3, cols=5, fold=0.12, rise=0.2, droop=0.5, colors=('#2e5a24', '#5a8a3a')).xf(rz(2.4), (-0.02, 0.03, 0.69)))
    return m, None


def lectern():
    """A locked lectern: a carved oak column on a stepped foot, a sloped desk with a lip, and a great chained book on it, its clasp and sigil burning."""
    m = Model('lectern')
    DARK = ('#1e1428', '#4a3a6a')
    m.add(trim(box(0.3, 0.26, 0.04, DARK)).xf(None, (0, 0, 0)))
    m.add(trim(box(0.22, 0.19, 0.035, DARK)).xf(None, (0, 0, 0.04)))
    m.add(trim(lathe([(0.075, 0.075), (0.085, 0.09), (0.055, 0.14), (0.05, 0.3), (0.07, 0.34), (0.05, 0.38), (0.06, 0.44), (0.09, 0.47)], sides=8, colors=DARK, close_top=True)))
    desk = trim(box(0.36, 0.26, 0.035, ('#2a1e3a', '#5a4880')))
    m.add(desk.xf(rx(0.5), (0, 0.0, 0.44)))
    m.add(trim(box(0.36, 0.03, 0.04, DARK)).xf(rx(0.5), (0, -0.115, 0.4)))
    # the book, lying shut on the slope
    R = rx(0.5)
    def on(p, c):
        return p.xf(R, tuple(np.asarray(R) @ np.asarray(c) + np.array([0, 0, 0.44])))
    m.add(on(trim(box(0.27, 0.19, 0.05, ('#120a22', '#2e1e50'))), (0, 0.005, 0.035)))
    m.add(on(trim(box(0.25, 0.175, 0.036, ('#b8a878', '#e8dcb8'))), (0.008, 0.005, 0.042)))
    for sx in (-0.11, 0.11):
        m.add(on(trim(box(0.02, 0.2, 0.054, BRASS)), (sx, 0.005, 0.033)))
    m.add(on(glowing(lathe([(0.03, 0.0), (0.042, 0.0)], sides=10, colors=('#7a4acc', '#d0a8ff'), close_top=False)), (0, 0.005, 0.087)))
    m.add(on(glowing(lathe([(0.0, 0.0), (0.012, 0.0)], sides=5, colors=('#7a4acc', '#e8d0ff'), close_top=False)), (0, 0.005, 0.087)))
    m.add(on(trim(box(0.03, 0.03, 0.02, IRON)), (0.14, 0.005, 0.05)))   # the lock
    ch = [(0.15, -0.02, 0.5), (0.2, -0.03, 0.36), (0.16, 0.0, 0.2), (0.09, 0.02, 0.1)]
    m.add(trimtube(ch, 0.006, sides=4, colors=IRON))
    return m, '#9a6aee'


def vigil_candle():
    """A black pillar candle in an iron dish, guttered and run with wax."""
    m = Model('vigil_candle')
    m.add(trim(lathe([(0.0, 0), (0.3, 0.0), (0.36, 0.06), (0.33, 0.08), (0.14, 0.05)], sides=10, colors=('#141c18', '#3a4a42'), close_top=False)))
    BLACK = ('#1c1a1a', '#5a5650')
    m.add(trim(lathe([(0.15, 0.05), (0.155, 0.9), (0.13, 0.96), (0.06, 0.93), (0.0, 0.92)], sides=10, colors=BLACK)))
    r = np.random.default_rng(13)
    for k in range(7):
        a = r.uniform(0, TAU); L = r.uniform(0.2, 0.7)
        m.add(trimtube([(0.155 * math.cos(a), 0.155 * math.sin(a), 0.93), (0.165 * math.cos(a), 0.165 * math.sin(a), 0.93 - L)], lambda u: 0.03 * (1 - 0.3 * u), sides=4, colors=BLACK))
    m.add(trim(blob(0.2, 0.17, 0.025, seg=6, rings=3, colors=BLACK, jitter=0.3)).xf(None, (0.08, -0.05, 0.07)))
    m.add(trimtube([(0, 0, 0.92), (0.01, 0, 1.0)], 0.01, sides=3, colors=('#3a3028', '#5a5048')))
    return m, None


def marble_perch():
    """A veined marble column with an iron T-perch, for a bird that watches."""
    m = Model('marble_perch')
    MAR = ('#8a8a94', '#f0f0f4')
    col = lathe([(0.11, 0), (0.11, 0.03), (0.09, 0.05), (0.075, 0.08), (0.07, 0.34), (0.085, 0.37), (0.095, 0.4), (0.08, 0.42)], sides=12, colors=MAR, close_top=True, close_bottom=True)
    for i, v in enumerate(col.v):
        col.t[i] = min(1.0, max(0.0, col.t[i] * 0.5 + 0.35 + 0.3 * math.sin(v[2] * 31 + math.atan2(v[1], v[0]) * 2)))
    m.add(trim(col))
    return m, None


# ── The Thornwarden scouts' camp in the Wilds ──────────────────────────────
CANVAS = ('#6a5430', '#c8ac74')
ROPE = ('#7a6238', '#c0a060')


def camp_tent():
    """A ridge tent of waxed canvas: two poles and a ridge, the walls pegged out on guy ropes, one door flap tied back, a bedroll and a lantern inside."""
    m = Model('camp_tent')
    L, W, H = 1.1, 0.9, 0.82
    # the two slopes, sagging a little between ridge and eave
    for sy in (-1, 1):
        v, f, t = [], [], []
        nx, ny = 6, 5
        for i in range(nx + 1):
            for j in range(ny + 1):
                u, w_ = i / nx, j / ny
                x = -L / 2 + L * u
                y = sy * (W / 2) * w_
                z = H * (1 - w_) - 0.045 * math.sin(math.pi * w_) * (0.6 + 0.4 * math.sin(math.pi * u)) + 0.03 * w_
                v.append((x, y, z)); t.append(1 - 0.75 * w_ + 0.08 * math.sin(u * 17 + w_ * 5))
        for i in range(nx):
            for j in range(ny):
                a = i * (ny + 1) + j
                f.append((a, a + 1, a + ny + 2, a + ny + 1) if sy > 0 else (a, a + ny + 1, a + ny + 2, a + 1))
        m.add(trim(Part(v, f, [min(1, max(0, x)) for x in t], CANVAS)))
    # the back wall, and the front with one flap tied back
    def gable(x, open_):
        v = [(x, -W / 2, 0.03), (x, W / 2, 0.03), (x, 0, H)]
        if not open_:
            return trim(Part(v, [(0, 1, 2)] if x < 0 else [(0, 2, 1)], [0.2, 0.2, 0.8], ('#584624', '#a89060'), smooth=False))
        v = [(x, -W / 2, 0.03), (x, -0.02, 0.03), (x, 0, H), (x, W / 2, 0.03), (x, W * 0.3, 0.03), (x + 0.05, W * 0.36, 0.42)]
        return trim(Part(v, [(0, 2, 1), (3, 4, 5), (3, 5, 2)], [0.2, 0.3, 0.8, 0.2, 0.3, 0.6], ('#584624', '#a89060'), smooth=False))
    m.add(gable(-L / 2, False)); m.add(gable(L / 2, True))
    m.add(trim(box(0.02, 0.5, 0.6, ('#0c0a08', '#1a1612'))).xf(None, (L / 2 - 0.05, 0.02, 0.02)))   # the dark inside
    for x in (-L / 2 - 0.02, L / 2 + 0.02):
        m.add(tube([(x, 0, 0), (x, 0, H + 0.06)], 0.022, sides=6, colors=OAK_DK))
    m.add(tube([(-L / 2 - 0.05, 0, H + 0.01), (L / 2 + 0.05, 0, H + 0.01)], 0.018, sides=5, colors=OAK_DK))
    for sx in (-1, 0, 1):
        for sy in (-1, 1):
            ex, ey = sx * L * 0.45, sy * W / 2
            px, py = ex * 1.08, sy * (W / 2 + 0.26)
            m.add(trimtube([(ex, ey, 0.06), (px, py, 0.02)], 0.006, sides=3, colors=ROPE))
            m.add(tube([(px, py + sy * 0.03, 0.0), (px, py - sy * 0.02, 0.08)], 0.012, sides=4, colors=OAK))
    for x in (-L / 2 - 0.02, L / 2 + 0.02):
        sx = 1 if x > 0 else -1
        m.add(trimtube([(x, 0, H + 0.04), (x + sx * 0.4, 0, 0.02)], 0.006, sides=3, colors=ROPE))
        m.add(tube([(x + sx * 0.42, 0, 0.0), (x + sx * 0.38, 0, 0.08)], 0.012, sides=4, colors=OAK))
    roll = lathe([(0.0, -0.2), (0.06, -0.2), (0.065, 0.0), (0.06, 0.2), (0.0, 0.2)], sides=8, colors=('#3a4a2a', '#7a8a5a'), close_top=False)
    m.add(trim(roll).xf(rx(math.pi / 2), (L / 2 + 0.1, -0.2, 0.065)))
    for dy in (-0.1, 0.1):
        m.add(trim(lathe([(0.066, -0.01), (0.068, 0.0), (0.066, 0.01)], sides=8, colors=ROPE, close_top=False)).xf(rx(math.pi / 2), (L / 2 + 0.1, -0.2 + dy, 0.065)))
    return m, None


def palisade_stake():
    """A palisade stake: a barked trunk hewn to a point, the cut pale."""
    m = Model('palisade_stake')
    BARK = ('#1e140a', '#4a3620')
    prof = [(0.09, 0), (0.08, 0.3), (0.075, 0.74), (0.07, 0.8)]
    trunk = lathe(prof, sides=7, colors=BARK, close_top=False, close_bottom=True)
    r = np.random.default_rng(9)
    for i in range(len(trunk.v)):
        trunk.v[i][0] *= 1 + r.uniform(-0.08, 0.08); trunk.v[i][1] *= 1 + r.uniform(-0.08, 0.08)
    m.add(trunk)
    m.add(trim(lathe([(0.07, 0.8), (0.035, 0.92), (0.0, 1.0)], sides=7, colors=('#8a6a40', '#d8b888'))))
    m.add(trim(lathe([(0.082, 0.55), (0.088, 0.57), (0.082, 0.59)], sides=7, colors=ROPE, close_top=False)))  # the lashing to the rail
    return m, None


def watchtower():
    """A scouts' watchtower: four splayed legs cross-braced, a plank deck with a railing, a ladder, and a thatched cap on four posts."""
    m = Model('watchtower')
    S, T, H = 0.28, 0.2, 1.3
    legs = [(sx, sy) for sx in (-1, 1) for sy in (-1, 1)]
    for sx, sy in legs:
        m.add(tube([(sx * S, sy * S, 0), (sx * T, sy * T, H)], lambda u: 0.04 - 0.008 * u, sides=6, colors=OAK_DK))
    for k, (a, b) in enumerate((((-1, -1), (1, -1)), ((1, -1), (1, 1)), ((1, 1), (-1, 1)), ((-1, 1), (-1, -1)))):
        for (z0, z1) in ((0.15, 0.6), (0.7, 1.15)):
            w0 = S + (T - S) * z0 / H; w1 = S + (T - S) * z1 / H
            p, q = (a, b) if (k + int(z0 > 0.5)) % 2 == 0 else (b, a)
            if k == 0 and z0 < 0.5:
                continue  # the ladder's side stays open below
            m.add(tube([(p[0] * w0, p[1] * w0, z0), (q[0] * w1, q[1] * w1, z1)], 0.018, sides=4, colors=OAK))
        wz = S + (T - S) * 0.65 / H
        m.add(tube([(a[0] * wz, a[1] * wz, 0.65), (b[0] * wz, b[1] * wz, 0.65)], 0.02, sides=4, colors=OAK_DK))
    D = 0.42
    for k in range(6):  # the deck
        m.add(box(2 * D, 2 * D / 6 * 0.95, 0.04, OAK, jitter=0.01, seed=k).xf(None, (0, -D + D / 6 + k * D / 3, H)))
    for sx, sy in legs:  # rail posts, carrying on up to hold the cap
        m.add(tube([(sx * (D - 0.03), sy * (D - 0.03), H), (sx * (D - 0.03), sy * (D - 0.03), H + 0.62)], 0.022, sides=5, colors=OAK_DK))
    for (a, b) in (((-1, -1), (1, -1)), ((1, -1), (1, 1)), ((1, 1), (-1, 1)), ((-1, 1), (-1, -1))):
        for z in (H + 0.14, H + 0.26):
            if a == (-1, -1) and b == (1, -1) and z < H + 0.2:
                continue
            m.add(tube([(a[0] * (D - 0.03), a[1] * (D - 0.03), z), (b[0] * (D - 0.03), b[1] * (D - 0.03), z)], 0.014, sides=4, colors=OAK))
    # the ladder, up the front
    for sx in (-0.09, 0.09):
        m.add(tube([(sx, -S - 0.16, 0), (sx, -D - 0.01, H + 0.1)], 0.014, sides=4, colors=OAK))
    for k in range(9):
        u = (k + 0.5) / 9.5
        y = (-S - 0.16) + ((-D - 0.01) - (-S - 0.16)) * u
        m.add(tube([(-0.09, y, (H + 0.1) * u), (0.09, y, (H + 0.1) * u)], 0.011, sides=4, colors=OAK_DK))
    # the thatch cap
    cap = lathe([(0.66, H + 0.56), (0.5, H + 0.68), (0.25, H + 0.84), (0.0, H + 0.94)], sides=4, colors=('#6a5a2a', '#c8b060'), phase=TAU / 8)
    m.add(trim(cap))
    m.add(trim(lathe([(0.68, H + 0.54), (0.66, H + 0.56), (0.6, H + 0.56)], sides=4, colors=('#4a3e1c', '#8a7a40'), close_top=False, phase=TAU / 8)))
    # a horn hung on a post, a lantern on the rail
    m.add(trim(tube([(D - 0.06, -D + 0.03, H + 0.4), (D - 0.1, -D - 0.02, H + 0.33), (D - 0.18, -D - 0.04, H + 0.3)], lambda u: 0.012 + 0.02 * u, sides=6, colors=('#c8b890', '#f0e4c8'))))
    return m, None


def weapon_rack():
    """A rack of two forked posts and rails, with boar spears, a billhook, two swords in their scabbards and a round shield leant against it."""
    m = Model('weapon_rack')
    for sx in (-0.42, 0.42):
        m.add(tube([(sx, 0.08, 0), (sx, 0, 0.74)], 0.03, sides=6, colors=OAK_DK))
        m.add(tube([(sx, -0.14, 0), (sx, 0, 0.4)], 0.022, sides=5, colors=OAK_DK))
    for z in (0.3, 0.68):
        m.add(tube([(-0.5, 0, z), (0.5, 0, z)], 0.022, sides=5, colors=OAK))
    STEEL = ('#5a5e68', '#d8dce4')
    for k, x in enumerate((-0.3, -0.17)):  # spears
        top = (x + 0.02, 0.03, 1.12 + 0.05 * k)
        m.add(tube([(x, -0.12, 0), top], 0.012, sides=5, colors=('#5a4020', '#a07840')))
        hd = lathe([(0.0, 0.0), (0.03, 0.05), (0.0, 0.2)], sides=4, colors=STEEL); hd.v[:, 1] *= 0.3
        m.add(trim(hd).xf(None, top))
        m.add(trimtube([(top[0] - 0.035, top[1], top[2] + 0.01), (top[0] + 0.035, top[1], top[2] + 0.01)], 0.006, sides=4, colors=STEEL))
    top = (-0.03, 0.03, 1.0)   # a billhook
    m.add(tube([(-0.05, -0.12, 0), top], 0.012, sides=5, colors=('#5a4020', '#a07840')))
    hook = [(top[0], top[1], top[2]), (top[0], top[1], top[2] + 0.14), (top[0] + 0.05, top[1], top[2] + 0.2), (top[0] + 0.1, top[1], top[2] + 0.16)]
    hk = tube(hook, lambda u: 0.022 * (1 - 0.6 * u), sides=4, colors=STEEL); hk.v[:, 1] = top[1] + (hk.v[:, 1] - top[1]) * 0.25
    m.add(trim(hk))
    for k, x in enumerate((0.12, 0.25)):  # swords hung by their belts
        m.add(trim(box(0.045, 0.014, 0.42, ('#3a2414', '#7a5030'))).xf(ry(0.08 * (1 if k else -1)), (x, -0.03, 0.22)))
        m.add(trimtube([(x - 0.06, -0.03, 0.65), (x + 0.06, -0.03, 0.65)], 0.01, sides=4, colors=BRASS))
        m.add(trimtube([(x, -0.03, 0.65), (x, -0.03, 0.77)], 0.012, sides=5, colors=('#2a1a10', '#5a3a20')))
        m.add(trim(blob(0.02, 0.02, 0.02, seg=6, rings=4, colors=BRASS)).xf(None, (x, -0.03, 0.79)))
    sh = lathe([(0.0, 0.05), (0.06, 0.045), (0.07, 0.02), (0.2, 0.0), (0.21, 0.0)], sides=12, colors=('#5a1a1a', '#b03a30'))
    m.add(trim(sh).xf(rx(math.pi / 2 - 0.25), (0.36, -0.2, 0.22)))
    m.add(trim(lathe([(0.2, 0.0), (0.215, 0.008), (0.2, 0.016)], sides=12, colors=STEEL, close_top=False)).xf(rx(math.pi / 2 - 0.25), (0.36, -0.2, 0.22)))
    return m, None


def pennant_pole():
    """A peeled ash pole with a long swallow-tailed pennant, stirring; the field takes a dye."""
    m = Model('pennant_pole')
    m.add(trim(tube([(0, 0, 0), (0, 0, 1.4)], lambda u: 0.022 - 0.008 * u, sides=6, colors=('#6a5a40', '#c8b890'))))
    m.add(trim(lathe([(0.0, 0.0), (0.02, 0.02), (0.0, 0.07)], sides=5, colors=BRASS)).xf(None, (0, 0, 1.4)))
    v, f, t = [], [], []
    nx = 10
    for i in range(nx + 1):
        u = i / nx
        x = 0.02 + 0.6 * u
        half = 0.15 * (1 - 0.35 * u)
        y = 0.05 * math.sin(u * 7.5) * u
        zc = 1.2 - 0.07 * u * u
        notch = 0.1 * max(0.0, (u - 0.7) / 0.3)
        v += [(x, y, zc + half), (x - notch, y, zc), (x, y, zc - half)]
        t += [0.9, 0.5 + 0.3 * math.sin(u * 9), 0.3]
    for i in range(nx):
        a = i * 3
        f += [(a, a + 3, a + 4, a + 1), (a + 1, a + 4, a + 5, a + 2)]
    m.add(Part(v, f, t, ('#8a8a8a', '#ffffff')))
    for z in (1.33, 1.08):
        m.add(trimtube([(0, 0, z), (0.03, 0, z - 0.01)], 0.005, sides=3, colors=ROPE))
    return m, None


def headstone():
    """A round-headed memorial stone on a plinth: weathered, lichened, lines of names cut in the face, two candle stubs at the foot."""
    m = Model('headstone')
    ST = ('#5a5852', '#a8a59c')
    W, T, H = 0.34, 0.08, 0.5
    v, f, t = [], [], []
    n = 10
    outline = [(-W / 2, 0.06), (-W / 2, H - 0.01)] + [(-(W / 2) * math.cos(math.pi * k / n), H - 0.01 + (W / 2) * 0.75 * math.sin(math.pi * k / n)) for k in range(1, n)] + [(W / 2, H - 0.01), (W / 2, 0.06)]
    r = np.random.default_rng(31)
    outline = [(x + r.uniform(-0.006, 0.006), z + r.uniform(-0.006, 0.006)) for (x, z) in outline]
    N = len(outline)
    for y in (-T / 2, T / 2):
        for (x, z) in outline:
            v.append((x, y, z)); t.append(min(1.0, 0.25 + z * 1.1 + r.uniform(-0.08, 0.08)))
    cf = len(v); v.append((0, -T / 2, 0.3)); t.append(0.7)
    cb = len(v); v.append((0, T / 2, 0.3)); t.append(0.5)
    for k in range(N):
        k1 = (k + 1) % N
        f.append((k, k1, N + k1, N + k)); f.append((cf, k1, k)); f.append((cb, N + k, N + k1))
    m.add(trim(Part(v, f, t, ST, smooth=False)))
    m.add(trim(box(0.46, 0.2, 0.06, ('#4a4844', '#807c74'), jitter=0.02, seed=4)).xf(None, (0, 0, 0)))
    for i in range(6):  # the names
        m.add(trim(box(0.18 if i == 0 else 0.24 - 0.02 * (i % 2), 0.006, 0.012, ('#2e2c2a', '#3a3836'))).xf(None, (0.01 * (i % 3 - 1), -T / 2 - 0.002, 0.47 - i * 0.06)))
    for (x, z, rr) in ((-0.11, 0.56, 0.035), (0.13, 0.3, 0.03), (-0.14, 0.16, 0.025), (0.06, 0.6, 0.02)):  # lichen
        m.add(trim(blob(rr, 0.006, rr * 0.8, seg=6, rings=3, colors=('#7a8a4a', '#c8c880'), jitter=0.25, seed=int(abs(x) * 100))).xf(None, (x, -T / 2 - 0.002, z)))
    m.add(trim(blob(0.12, 0.05, 0.03, seg=7, rings=3, colors=('#2e4a24', '#5a7a3a'), jitter=0.2)).xf(None, (0.02, 0.0, H + 0.115)))  # moss on the head
    for dx in (-0.14, 0.14):
        m.add(trim(lathe([(0.016, 0.06), (0.016, 0.125), (0.0, 0.13)], sides=7, colors=WAXEN)).xf(None, (dx, -0.08, 0)))
        m.add(trim(blob(0.028, 0.024, 0.006, seg=6, rings=3, colors=WAXEN, jitter=0.3)).xf(None, (dx + 0.005, -0.08, 0.062)))
    return m, None


def notice_board():
    """A town board: two oak posts, a plank panel that takes a dye, a little shingled pentice over it, and pages pinned up, one gilt."""
    m = Model('notice_board')
    for sx in (-0.33, 0.33):
        m.add(trim(tube([(sx, 0, 0), (sx, 0, 0.66)], lambda u: 0.032 - 0.006 * u, sides=6, colors=OAK_DK)))
        m.add(trim(tube([(sx, -0.1, 0.0), (sx, 0, 0.16)], 0.016, sides=4, colors=OAK_DK)))
    for k in range(5):
        m.add(box(0.76, 0.035, 0.44 / 5 * 0.97, ('#9a9a9a', '#ffffff'), jitter=0.006, seed=k).xf(None, (0, 0, 0.18 + k * 0.088)))
    for (bx, bz, sx, sz) in ((0, 0.17, 0.8, 0.025), (0, 0.615, 0.8, 0.025)):
        m.add(trim(box(sx, 0.05, sz, OAK)).xf(None, (bx, 0, bz)))
    for sy, a in ((-1, 0.5), (1, -0.5)):  # the pentice, two courses of shingles a side
        for c in range(2):
            for k in range(7):
                x = -0.42 + k * 0.14 + (0.07 if c else 0)
                m.add(trim(box(0.135, 0.085, 0.012, ('#3a2a1c', '#7a5a3a'), jitter=0.03, seed=k + c * 9 + (5 if sy > 0 else 0))).xf(rx(a), (x, sy * (0.035 + 0.06 * c), 0.71 - 0.033 * c)))
    m.add(trim(tube([(-0.47, 0, 0.725), (0.5, 0, 0.725)], 0.014, sides=4, colors=OAK_DK)))
    r = np.random.default_rng(12)
    pages = [(-0.24, 0.46, '#d8ccb8'), (-0.02, 0.42, '#d8ccb8'), (0.2, 0.45, '#ffd9a0'), (0.1, 0.3, '#cfc3e8'), (-0.16, 0.29, '#d8ccb8'), (0.27, 0.3, '#d8ccb8')]
    for (x, z, col) in pages:
        w, h = r.uniform(0.11, 0.15), r.uniform(0.1, 0.14)
        pg = blade(h, w, lambda s_: 1.0, segs=3, cols=2, fold=0.0, rise=-math.pi / 2 + 0.06, droop=-0.12, colors=(col, col))
        m.add(trim(pg).xf(rz(-math.pi / 2) @ ry(r.uniform(-0.08, 0.08)), (x, -0.022, z + h / 2)))
        for k in range(3):
            m.add(trim(box(w * 0.7, 0.002, 0.006, ('#4a3a2a', '#4a3a2a'))).xf(None, (x, -0.03 - 0.004 * k, z + h / 2 - 0.03 - 0.025 * k)))
        m.add(trim(blob(0.008, 0.008, 0.008, seg=5, rings=3, colors=BRASS)).xf(None, (x, -0.026, z + h / 2 - 0.008)))
    return m, None


HOME = {'fp_foxglove': foxgloves, 'fp_meadow': meadow, 'fp_harebell': harebells, 'fp_campion': campion,
        'bed': box_bed, 'hearth': hearth, 'candle_stand': candle_stand, 'witch_ball': witch_ball,
        'altar_candle': altar_candle, 'athame': athame, 'censer': censer,
        'hall_table': hall_table, 'hall_bench': hall_bench, 'bookcase': bookcase, 'hall_banner': hall_banner, 'high_seat': high_seat,
        'chandelier': chandelier, 'wall_shield': wall_shield, 'standing_torch': standing_torch,
        'cave_potion': cave_potion, 'cave_candle': cave_candle, 'cave_crystal': cave_crystal, 'cave_book': cave_book, 'cave_hourglass': cave_hourglass,
        'cave_eyejar': cave_eyejar, 'cave_jar': cave_jar, 'cave_moon': cave_moon, 'cave_mushroom': cave_mushroom, 'cave_feathers': cave_feathers,
        'campfire': campfire, 'waymarker': waymarker, 'chalice': chalice, 'hand_bell': hand_bell, 'rune_stones': rune_stones,
        'scrying_mirror': scrying_mirror, 'pentacle_plaque': pentacle_plaque, 'crystal_cluster': crystal_cluster, 'open_grimoire': open_grimoire,
        'bar_counter': bar_counter, 'rug': rug, 'arcade_cabinet': arcade_cabinet, 'pedestal': pedestal, 'relic_orb_stand': relic_orb_stand,
        'relic_blade': relic_blade, 'relic_crescent': relic_crescent, 'relic_lantern': relic_lantern, 'relic_jar': relic_jar,
        'relic_planchette': relic_planchette, 'herb_bundle': herb_bundle, 'pumpkin': pumpkin, 'lectern': lectern, 'vigil_candle': vigil_candle,
        'marble_perch': marble_perch,
        'camp_tent': camp_tent, 'palisade_stake': palisade_stake, 'watchtower': watchtower, 'weapon_rack': weapon_rack, 'pennant_pole': pennant_pole,
        'headstone': headstone, 'notice_board': notice_board}

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for n in (sys.argv[1:] or list(HOME)):
        m, glow = HOME[n]()
        path = os.path.abspath(os.path.join(OUT, n + '.glb'))
        m.export(path, glow_color=glow or '#ffffff', glow_strength=0.35)
        print(n, m.tris(), 'tris', os.path.getsize(path), 'bytes')
