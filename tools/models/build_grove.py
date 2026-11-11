"""The Wilds' own trees and bushes, the ogham grove, and the crotal stone, as
the real trees, shrubs and stones they stand for. Writes public/kk/grove/*.glb.

    sh tools/models/build.sh grove [name ...]
"""
import math, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from trlib import *  # noqa
from build_plants import pinnate, glowing  # noqa

OUT = os.path.join(os.path.dirname(__file__), '../../public/kk/grove')


def bough(m, pts, r0, r1, colors, sides=7):
    m.add(tube(pts, lambda s: r0 + (r1 - r0) * s, sides=sides, colors=colors))


def crown(m, centres, colors, seed=0, jitter=0.16, seg=7, rings=5):
    """KayKit-style foliage: faceted clumps, lighter on top."""
    r = np.random.default_rng(seed)
    for (x, y, z, rad) in centres:
        m.add(blob(rad * r.uniform(0.9, 1.1), rad * r.uniform(0.9, 1.1), rad * r.uniform(0.75, 0.9), seg=seg, rings=rings, colors=colors, jitter=jitter, seed=int(r.integers(1e6))).xf(rz(r.uniform(0, TAU)), (x, y, z)))


def dome_points(n, R, zc, rz_, seed, top_bias=0.3):
    """Points spread over a dome-shaped crown."""
    r = np.random.default_rng(seed)
    pts = []
    for i in range(n):
        th = math.acos(r.uniform(-top_bias, 1))
        ph = r.uniform(0, TAU)
        pts.append((R * math.sin(th) * math.cos(ph), R * math.sin(th) * math.sin(ph), zc + rz_ * math.cos(th)))
    return pts


def berries(m, pts, rad, colors, seg=5, rings=3):
    for p in pts:
        m.add(blob(rad, rad, rad, seg=seg, rings=rings, colors=colors).xf(None, p))


# ── The Wilds' own ─────────────────────────────────────────────────────────
def willow():
    """Salix, the weeping willow: a leaning, split trunk and curtains of narrow leaves hanging to the ground."""
    m = Model('mourning_willow')
    BARK = ('#3a3024', '#6a5a44')
    bough(m, [(0, 0, 0), (0.03, 0.01, 0.15), (0.08, 0.0, 0.3), (0.1, 0.02, 0.38)], 0.09, 0.07, BARK, sides=8)
    m.add(lathe([(0.14, 0), (0.1, 0.05), (0.09, 0.1)], sides=8, colors=BARK, close_top=False))  # root flare
    for a, L in ((0.3, 0.32), (2.3, 0.3), (4.2, 0.34)):
        bough(m, [(0.1, 0.02, 0.36), (0.1 + 0.12 * math.cos(a), 0.02 + 0.12 * math.sin(a), 0.5), (0.1 + L * math.cos(a), 0.02 + L * math.sin(a), 0.72)], 0.055, 0.03, BARK)
    crown(m, [(0.1 + 0.28 * math.cos(a), 0.28 * math.sin(a), 0.74 + 0.05 * math.sin(3 * a), 0.2) for a in np.linspace(0, TAU, 7, endpoint=False)] + [(0.1, 0, 0.86, 0.22)], ('#4a7a2a', '#b8d870'), seed=1)
    r = np.random.default_rng(2)
    for k in range(46):  # the hanging curtain
        a = TAU * k / 46 + r.uniform(-0.05, 0.05)
        rr = r.uniform(0.3, 0.46)
        top = np.array([0.1 + rr * math.cos(a), rr * math.sin(a), r.uniform(0.66, 0.8)])
        L = r.uniform(0.45, 0.6)
        strand = blade(L, 0.05, linear, segs=4, cols=3, fold=0.2, rise=-1.45, droop=0.1, colors=('#c0e080', '#5a8a30'))
        m.add(strand.xf(rz(a), top))
    return m, None


def capwood():
    """An old dead beech, snapped off, its grey trunk stepped with dryad's saddle brackets; shaggy ink caps at its foot."""
    m = Model('capwood')
    BARK = ('#5a5a54', '#a8a49a')
    m.add(lathe([(0.2, 0), (0.16, 0.06), (0.13, 0.16), (0.12, 0.5), (0.11, 0.8), (0.1, 0.92)], sides=10, colors=BARK, close_top=False, close_bottom=True))
    jag = lathe([(0.1, 0.92), (0.07, 0.96), (0.0, 0.94)], sides=10, colors=('#c8b8a0', '#e8d8c0'), close_top=False)
    for i in range(len(jag.v)):
        if i < 10 * 2:
            jag.v[i][2] += 0.06 * abs(math.sin(i * 1.7))
    m.add(jag)  # the snapped, splintered top
    bough(m, [(0.08, 0, 0.62), (0.2, 0.02, 0.72), (0.3, 0.0, 0.76)], 0.035, 0.015, BARK)
    for i, (z, a, w) in enumerate(((0.22, 0.4, 0.2), (0.36, 2.6, 0.17), (0.5, 4.4, 0.2), (0.64, 1.6, 0.15), (0.78, 3.6, 0.13))):
        # dryad's saddle: a fan-shaped shelf, cream with brown scales
        sh = lathe([(0.0, 0.0), (w * 0.5, 0.01), (w, -0.01)], sides=12, colors=('#c8a878', '#f0dcb0'), close_top=False)
        keep = [f for j, f in enumerate(sh.f) if (j % 12) in (0, 1, 2, 3, 4, 5, 6)]
        sh.f = keep
        sh.v[:, 2] *= 1
        R = rz(a - math.pi / 2 + 0.3)
        m.add(sh.xf(R, (0.1 * math.cos(a), 0.1 * math.sin(a), z)))
        m.add(lathe([(w * 0.95, -0.012), (w * 0.2, -0.02)], sides=12, colors=('#efe2c4', '#efe2c4'), close_top=False).xf(R, (0.1 * math.cos(a), 0.1 * math.sin(a), z)))
        for k in range(5):
            ka = (k / 4) * math.pi
            p = R @ np.array([w * 0.6 * math.cos(ka), w * 0.6 * math.sin(ka), 0.012])
            m.add(blob(0.018, 0.012, 0.006, seg=5, rings=3, colors=('#6a4a2a', '#8a6a42')).xf(None, p + (0.1 * math.cos(a), 0.1 * math.sin(a), z)))
    for (x, y, h) in ((0.26, 0.1, 0.14), (0.3, -0.04, 0.1), (0.22, 0.2, 0.08)):  # shaggy ink caps
        m.add(lathe([(0.012, 0), (0.012, h * 0.6)], sides=6, colors=('#e8e2d4', '#ffffff'), close_top=False).xf(None, (x, y, 0)))
        m.add(lathe([(0.03, h * 0.45), (0.034, h * 0.7), (0.025, h * 0.95), (0.0, h * 1.05)], sides=8, colors=('#3a3030', '#f2ece0'), close_top=False).xf(None, (x, y, 0)))
    return m, None


def bilberry():
    """Vaccinium myrtillus, bilberry or whortleberry: a low tangle of bright little leaves and dusky blue berries."""
    m = Model('nightberry')
    r = np.random.default_rng(3)
    for k in range(14):  # angular green stems
        a = r.uniform(0, TAU); lean = r.uniform(0.15, 0.4); h = r.uniform(0.55, 0.9)
        top = np.array([lean * math.cos(a), lean * math.sin(a), h])
        bough(m, [(0, 0, 0), top * [0.5, 0.5, 0.6], top], 0.025, 0.012, ('#3a6a2a', '#6aa040'), sides=4)
        for j in range(4):
            p = top * (0.4 + 0.16 * j)
            m.add(blade(0.16, 0.09, ovate, segs=2, cols=3, fold=0.15, rise=0.4, droop=0.5, colors=('#3a8a34', '#8ad060')).xf(rz(r.uniform(0, TAU)), p))
    crown(m, [(r.uniform(-0.3, 0.3), r.uniform(-0.3, 0.3), r.uniform(0.35, 0.6), r.uniform(0.18, 0.25)) for _ in range(6)], ('#2e6a2a', '#7ac050'), seed=4, jitter=0.25)
    berries(m, [(r.uniform(-0.45, 0.45), r.uniform(-0.45, 0.45), r.uniform(0.3, 0.75)) for _ in range(30)], 0.032, ('#1a1a3a', '#6a6aa8'), seg=5, rings=3)
    return m, None


def royal_fern():
    """Osmunda regalis, the royal fern of the fens: tall fronds, their tips turned to rusty spore-plumes."""
    m = Model('fenfern')
    r = np.random.default_rng(5)
    for i in range(9):
        a = TAU * i / 9 + r.uniform(-0.2, 0.2)
        pinnate(m, r.uniform(0.95, 1.1), 8, 0.28, 0.12, a, rise=1.35 + r.uniform(-0.1, 0.1), droop=1.0, colors=('#3a7a34', '#a0d870'), shape=ovate, stem_r=0.02, leaf_rise=0.15, taper=0.6)
    for i in range(4):  # the fertile tips, brown as rust
        a = TAU * i / 4 + 0.4
        top = np.array([0.18 * math.cos(a), 0.18 * math.sin(a), 0.95])
        bough(m, [(0, 0, 0.05), top * [0.5, 0.5, 0.6], top], 0.018, 0.01, ('#4a6a2a', '#7a8a3a'), sides=4)
        for k in range(6):
            p = top - [0, 0, 0.05 * k]
            m.add(blob(0.05 - 0.004 * k, 0.04, 0.035, seg=5, rings=3, colors=('#6a3a14', '#c8782a'), jitter=0.2, seed=k).xf(rz(a), p))
    return m, None


def fairy_ring():
    """A fairy ring: a circle of fairy-ring champignons in a ring of darker, lusher grass."""
    m = Model('toadring')
    r = np.random.default_rng(6)
    R = 0.45
    for k in range(70):  # the lush dark ring of grass
        a = TAU * k / 70 + r.uniform(-0.03, 0.03)
        rr = R + r.uniform(-0.05, 0.05)
        m.add(blade(r.uniform(0.07, 0.12), 0.03, linear, segs=2, cols=3, fold=0.3, rise=1.2, droop=0.6, colors=('#1f4a1e', '#4f8a3a')).xf(rz(r.uniform(0, TAU)), (rr * math.cos(a), rr * math.sin(a), 0)))
    for k in range(15):  # Marasmius oreades: tan caps with a raised boss
        a = TAU * k / 15 + r.uniform(-0.1, 0.1)
        rr = R + r.uniform(-0.03, 0.03)
        h = r.uniform(0.07, 0.11); cr = r.uniform(0.035, 0.05)
        x, y = rr * math.cos(a), rr * math.sin(a)
        m.add(lathe([(0.007, 0), (0.006, h)], sides=5, colors=('#c8a878', '#e8d0a8'), close_top=False).xf(None, (x, y, 0)))
        m.add(lathe([(cr, h - 0.005), (cr * 0.85, h + cr * 0.3), (cr * 0.4, h + cr * 0.55), (0.0, h + cr * 0.75)], sides=8, colors=('#b07a40', '#e8c890'), close_top=False).xf(None, (x, y, 0)))
    return m, None


# ── The ogham grove ────────────────────────────────────────────────────────
def alder():
    """Alnus glutinosa: a dark-barked waterside tree, its crown dark and rounded, hung with catkins and little black cones."""
    m = Model('alder')
    BARK = ('#2a2420', '#5a4e44')
    bough(m, [(0, 0, 0), (0.01, 0, 0.3), (0.0, 0.01, 0.6)], 0.06, 0.04, BARK, sides=8)
    m.add(lathe([(0.1, 0), (0.07, 0.04), (0.06, 0.08)], sides=8, colors=BARK, close_top=False))
    for a in (0.5, 2.5, 4.4):
        bough(m, [(0, 0, 0.4), (0.12 * math.cos(a), 0.12 * math.sin(a), 0.55), (0.2 * math.cos(a), 0.2 * math.sin(a), 0.68)], 0.03, 0.015, BARK)
    crown(m, [(x, y, z, 0.17) for (x, y, z) in dome_points(11, 0.2, 0.68, 0.24, 7)] + [(0, 0, 0.76, 0.24)], ('#1f4a24', '#5a9a48'), seed=7)
    r = np.random.default_rng(8)
    for (x, y, z) in dome_points(12, 0.36, 0.62, 0.2, 9, top_bias=0.6):
        m.add(lathe([(0.012, 0), (0.008, -0.07), (0.0, -0.09)], sides=4, colors=('#8a5a3a', '#c09060'), close_top=False).xf(None, (x, y, z)))  # catkins
        m.add(blob(0.018, 0.018, 0.024, seg=5, rings=3, colors=('#1a1410', '#3a2a20')).xf(None, (x + 0.02, y, z - 0.02)))  # last year's cones
    return m, None


def ash():
    """Fraxinus excelsior: tall, smooth pale-grey bark, an open crown of feathery leaves, bunches of hanging keys."""
    m = Model('ash_tree')
    BARK = ('#6a6a62', '#b8b8ae')
    bough(m, [(0, 0, 0), (0.01, 0, 0.35), (0.0, 0.01, 0.7)], 0.05, 0.035, BARK, sides=8)
    m.add(lathe([(0.08, 0), (0.06, 0.04), (0.05, 0.08)], sides=8, colors=BARK, close_top=False))
    for a, z in ((0.3, 0.45), (2.4, 0.52), (4.3, 0.6), (1.4, 0.66)):
        bough(m, [(0, 0, z), (0.12 * math.cos(a), 0.12 * math.sin(a), z + 0.12), (0.24 * math.cos(a), 0.24 * math.sin(a), z + 0.28)], 0.025, 0.012, BARK, sides=5)
    crown(m, [(x, y, z, 0.13) for (x, y, z) in dome_points(14, 0.24, 0.76, 0.2, 10)], ('#3a7a34', '#a8d878'), seed=10, jitter=0.22)
    r = np.random.default_rng(11)
    for (x, y, z) in dome_points(8, 0.36, 0.72, 0.18, 12, top_bias=0.4):  # feathery leaf sprays at the edge
        a = math.atan2(y, x)
        pinnate(m, 0.18, 4, 0.06, 0.025, a, rise=0.2, droop=0.6, colors=('#3a7a34', '#a8d878'), base=(x * 0.85, y * 0.85, z), stem_r=0.006, leaf_rise=0.1)
    for (x, y, z) in dome_points(7, 0.3, 0.6, 0.1, 13, top_bias=0.9):  # the keys
        for k in range(5):
            m.add(blade(0.06, 0.018, lanceolate, segs=2, cols=3, fold=0.1, rise=-1.3, droop=0.1, colors=('#8a7a4a', '#d8c890')).xf(rz(TAU * k / 5), (x, y, z)))
    return m, None


def hawthorn():
    """Crataegus monogyna, the may: a gnarled, thorny little tree, dense with small cut leaves and clusters of dark red haws."""
    m = Model('hawthorn')
    BARK = ('#3a2e26', '#6a5a4a')
    bough(m, [(0, 0, 0), (0.04, 0.02, 0.18), (0.0, 0.05, 0.32), (0.04, 0.06, 0.42)], 0.07, 0.04, BARK, sides=8)
    for a in (0.2, 1.9, 3.6, 5.1):
        bough(m, [(0.02, 0.04, 0.34), (0.15 * math.cos(a), 0.04 + 0.15 * math.sin(a), 0.45), (0.3 * math.cos(a), 0.04 + 0.3 * math.sin(a), 0.5)], 0.03, 0.012, BARK, sides=5)
    crown(m, [(x, y + 0.04, z, 0.17) for (x, y, z) in dome_points(12, 0.3, 0.55, 0.22, 14, top_bias=0.2)] + [(0, 0.04, 0.66, 0.22)], ('#24502a', '#6aa04a'), seed=14, jitter=0.24)
    r = np.random.default_rng(15)
    for (x, y, z) in dome_points(16, 0.44, 0.55, 0.28, 16, top_bias=0.3):
        for k in range(4):
            berries(m, [(x + 0.025 * math.cos(k * 1.7), y + 0.04 + 0.025 * math.sin(k * 1.7), z - 0.01 * k)], 0.024, ('#6a0a10', '#d0302a'))
    return m, None


def wild_apple():
    """Malus sylvestris, the crab apple: a low, spreading crown with little yellow-and-red crabs."""
    m = Model('wild_apple')
    BARK = ('#3a2e24', '#7a6450')
    bough(m, [(0, 0, 0), (0.02, 0, 0.18), (0.0, 0.02, 0.32)], 0.07, 0.05, BARK, sides=8)
    for a in (0.6, 2.2, 3.8, 5.4):
        bough(m, [(0, 0, 0.3), (0.18 * math.cos(a), 0.18 * math.sin(a), 0.42), (0.34 * math.cos(a), 0.34 * math.sin(a), 0.5)], 0.035, 0.015, BARK, sides=5)
    crown(m, [(x, y, z, 0.18) for (x, y, z) in dome_points(12, 0.36, 0.52, 0.18, 17, top_bias=0.1)] + [(0, 0, 0.66, 0.24)], ('#2e6a2a', '#8ac050'), seed=17, jitter=0.2)
    for (x, y, z) in dome_points(22, 0.48, 0.5, 0.2, 18, top_bias=0.2):
        m.add(blob(0.04, 0.04, 0.036, seg=6, rings=4, colors=('#c8a020', '#e85a2a')).xf(None, (x, y, z)))
    return m, None


def ivy_bank():
    """Hedera helix on an old stump and its bank: glossy dark lobed leaves smothering everything, and the black berry-heads."""
    m = Model('ivy_bank')
    m.add(blob(0.48, 0.42, 0.18, seg=10, rings=4, colors=('#3a2a1a', '#5a4a30'), jitter=0.1).xf(None, (0, 0, 0.05)))  # the bank
    m.add(lathe([(0.2, 0), (0.17, 0.3), (0.15, 0.62), (0.0, 0.66)], sides=9, colors=('#3a2e24', '#6a5a44')).xf(None, (0.05, 0.02, 0)))  # the stump
    crown(m, [(x, y, 0.12) + (0.13,) for (x, y) in ((-0.25, -0.15), (0.25, -0.2), (-0.2, 0.2), (0.28, 0.18), (0.0, -0.3), (-0.35, 0.02))] + [(0.05 + 0.15 * math.cos(a), 0.02 + 0.15 * math.sin(a), z, 0.09) for a, z in ((0.3, 0.2), (2.0, 0.35), (3.9, 0.15), (5.0, 0.48), (1.2, 0.58))], ('#183a1e', '#3f7a3a'), seed=33, jitter=0.25)
    ivy = lambda s: (0.7 + 0.35 * abs(math.sin(s * math.pi * 1.5))) * math.sin(math.pi * min(1, s * 0.85 + 0.12)) ** 0.7
    r = np.random.default_rng(19)
    pts = [(r.uniform(-0.45, 0.45), r.uniform(-0.4, 0.4), 0.0) for _ in range(60)]
    pts += [(0.05 + 0.17 * math.cos(a), 0.02 + 0.17 * math.sin(a), z) for a, z in zip(r.uniform(0, TAU, 50), r.uniform(0.05, 0.62, 50))]
    for (x, y, z) in pts:
        if z == 0.0:
            d = (x / 0.48) ** 2 + (y / 0.42) ** 2
            if d > 1:
                continue
            z = 0.05 + 0.18 * math.sqrt(max(0, 1 - d))
            rise, az = 0.3, r.uniform(0, TAU)
        else:
            rise, az = 0.6, math.atan2(y - 0.02, x - 0.05)
        m.add(blade(0.1, 0.1, ivy, segs=2, cols=3, fold=0.12, rise=rise, droop=0.4, colors=('#183a1e', '#3f7a3a')).xf(rz(az), (x, y, z)))
    for (x, y) in ((0.12, 0.1), (-0.05, 0.14), (0.15, -0.08)):  # the berry-heads, black as jet
        for k in range(6):
            m.add(blob(0.018, 0.018, 0.018, seg=5, rings=3, colors=('#0a0a10', '#3a3a4a')).xf(None, (x + 0.025 * math.cos(k), y + 0.025 * math.sin(k), 0.66 + 0.01 * (k % 2))))
    return m, None


def elder():
    """Sambucus nigra: several corky stems, leaves of five leaflets, and heavy flat sprays of black-purple berries hanging."""
    m = Model('elder')
    BARK = ('#5a4e3a', '#9a8a6a')
    for a, lean in ((0.4, 0.12), (2.5, 0.15), (4.3, 0.1)):
        bough(m, [(0.03 * math.cos(a), 0.03 * math.sin(a), 0), (lean * math.cos(a), lean * math.sin(a), 0.35), (lean * 1.6 * math.cos(a), lean * 1.6 * math.sin(a), 0.62)], 0.045, 0.025, BARK, sides=6)
    crown(m, [(x, y, z, 0.15) for (x, y, z) in dome_points(11, 0.3, 0.58, 0.2, 20, top_bias=0.2)], ('#2e5a2a', '#7ab050'), seed=20, jitter=0.22)
    for (x, y, z) in dome_points(7, 0.4, 0.55, 0.2, 21, top_bias=0.3):
        a = math.atan2(y, x)
        pinnate(m, 0.16, 2, 0.08, 0.04, a, rise=0.1, droop=0.4, colors=('#2e5a2a', '#7ab050'), shape=ovate, base=(x * 0.9, y * 0.9, z), stem_r=0.006, leaf_rise=0.2)
    r = np.random.default_rng(22)
    for (x, y, z) in dome_points(9, 0.42, 0.5, 0.15, 23, top_bias=0.5):  # drooping umbels of berries
        m.add(tube([(x, y, z + 0.04), (x, y, z)], 0.006, sides=3, colors=('#8a2a4a', '#b04a6a')))
        for k in range(7):
            ka = TAU * k / 7
            rr = 0.035 + 0.02 * (k % 2)
            m.add(blob(0.016, 0.016, 0.016, seg=4, rings=2, colors=('#14081a', '#4a2a5a')).xf(None, (x + rr * math.cos(ka), y + rr * math.sin(ka), z - 0.01)))
    return m, None


def gorse():
    """Ulex europaeus: a spiny, dark-green dome, gold with pea-flowers."""
    m = Model('gorse')
    r = np.random.default_rng(24)
    crown(m, [(r.uniform(-0.3, 0.3), r.uniform(-0.3, 0.3), r.uniform(0.25, 0.5), r.uniform(0.2, 0.28)) for _ in range(9)], ('#2a4a24', '#6a8a44'), seed=24, jitter=0.3)
    for (x, y, z) in dome_points(70, 0.5, 0.25, 0.42, 25, top_bias=0.1):  # spines
        d = np.array([x, y, z - 0.1]); d /= np.linalg.norm(d)
        sp = lathe([(0.012, 0), (0.0, 0.09)], sides=3, colors=('#2a4a24', '#6a8a4a'), close_top=False)
        m.add(sp.xf(look_rot(d) @ ry(-math.pi / 2), (x, y, z)))
    for (x, y, z) in dome_points(48, 0.5, 0.25, 0.42, 26, top_bias=0.0):  # the gold
        m.add(blob(0.035, 0.03, 0.03, seg=5, rings=3, colors=('#e0a010', '#ffe040')).xf(rz(r.uniform(0, TAU)), (x, y, z)))
    return m, None


def heather():
    """Calluna vulgaris, ling: a low cushion of fine wiry shoots, their tips crowded with tiny pink-purple bells."""
    m = Model('heather')
    r = np.random.default_rng(27)
    m.add(blob(0.5, 0.45, 0.12, seg=10, rings=4, colors=('#2a3a24', '#4a5a34'), jitter=0.2).xf(None, (0, 0, 0.06)))
    for k in range(28):
        a = r.uniform(0, TAU); rr = r.uniform(0, 0.45)
        base = np.array([rr * math.cos(a), rr * 0.9 * math.sin(a), 0.1 * math.sqrt(max(0, 1 - (rr / 0.5) ** 2))])
        h = r.uniform(0.18, 0.3)
        top = base + [r.uniform(-0.04, 0.04), r.uniform(-0.04, 0.04), h]
        bough(m, [base, top], 0.01, 0.006, ('#3a4a2a', '#5a6a3a'), sides=3)
        for j in range(4):
            m.add(blob(0.028, 0.028, 0.024, seg=4, rings=2, colors=('#a04a8a', '#e890d0')).xf(None, top - [0, 0, 0.03 * j] + [0.012 * math.cos(j * 2.4), 0.012 * math.sin(j * 2.4), 0]))
    return m, None


def aspen():
    """Populus tremula: tall and slender, pale bark marked with dark diamonds, loose clusters of round, trembling leaves."""
    m = Model('aspen')
    BARK = ('#9a9a8a', '#e6e6da')
    bough(m, [(0, 0, 0), (0.01, 0, 0.4), (0.0, 0.01, 0.82)], 0.04, 0.025, BARK, sides=8)
    for z in (0.12, 0.22, 0.33, 0.45, 0.56):  # the dark diamond lenticels
        for k in range(3):
            a = TAU * k / 3 + z * 7
            m.add(blob(0.012, 0.004, 0.02, seg=4, rings=3, colors=('#2a2a26', '#4a4a44')).xf(rz(a), (0.039 * math.cos(a), 0.039 * math.sin(a), z)))
    for a, z in ((0.4, 0.55), (2.6, 0.62), (4.5, 0.7)):
        bough(m, [(0, 0, z), (0.1 * math.cos(a), 0.1 * math.sin(a), z + 0.12)], 0.016, 0.008, BARK, sides=4)
    crown(m, [(x, y, z, 0.12) for (x, y, z) in dome_points(14, 0.2, 0.74, 0.22, 28)], ('#5a8a2a', '#d8e070'), seed=28, jitter=0.25)
    rnd = lambda s: math.sin(math.pi * s) ** 0.5
    for (x, y, z) in dome_points(36, 0.3, 0.74, 0.26, 29):
        m.add(blade(0.05, 0.05, rnd, segs=2, cols=3, fold=0.05, rise=0.2, droop=0.3, colors=('#8aa83a', '#f0e070')).xf(rz(math.atan2(y, x)), (x, y, z)))
    return m, None


def yew():
    """Taxus baccata: a broad, dark, dense evergreen on a fluted red-brown trunk, set with red arils."""
    m = Model('yew')
    BARK = ('#4a2418', '#9a5a3a')
    t = lathe([(0.15, 0), (0.12, 0.08), (0.11, 0.2), (0.1, 0.3)], sides=10, colors=BARK, close_top=False)
    for i in range(len(t.v)):  # fluting
        k = i % 10
        t.v[i][:2] *= 1 + 0.12 * math.cos(3 * TAU * k / 10)
    m.add(t)
    crown(m, [(x, y, z, 0.2) for (x, y, z) in dome_points(10, 0.26, 0.55, 0.32, 30, top_bias=0.1)] + [(0, 0, 0.82, 0.18), (0, 0, 0.45, 0.32)], ('#0e2414', '#2e5a34'), seed=30, jitter=0.18)
    for (x, y, z) in dome_points(26, 0.42, 0.52, 0.42, 31, top_bias=0.2):
        m.add(blob(0.022, 0.022, 0.026, seg=5, rings=3, colors=('#a00a14', '#ff3a3a')).xf(None, (x, y, z)))
    return m, None


def crotal_stone():
    """A grey boulder crusted with crotal (Parmelia saxatilis), the dye-lichen, and spotted with orange Xanthoria."""
    m = Model('crotal_stone')
    m.add(blob(0.5, 0.38, 0.3, seg=9, rings=6, colors=('#5a5a58', '#a8a69e'), jitter=0.18, seed=3).xf(rz(0.3), (0, 0, 0.26)))
    m.add(blob(0.24, 0.2, 0.17, seg=7, rings=5, colors=('#5a5a58', '#9a988e'), jitter=0.2, seed=4).xf(None, (0.36, 0.22, 0.12)))
    r = np.random.default_rng(32)
    for k in range(22):  # the crotal: grey-green rosettes
        th = r.uniform(0.1, 1.3); ph = r.uniform(0, TAU)
        p = np.array([0.5 * math.sin(th) * math.cos(ph), 0.38 * math.sin(th) * math.sin(ph), 0.26 + 0.3 * math.cos(th)])
        n = p - [0, 0, 0.26]; n /= np.linalg.norm(n)
        w = r.uniform(0.05, 0.1)
        m.add(blob(w, w * 0.9, 0.012, seg=7, rings=3, colors=('#7a8a72', '#b8c8a8'), jitter=0.3, seed=k).xf(look_rot(n) @ ry(-math.pi / 2), p * 1.01 + [0, 0, 0.003]))
    for k in range(7):  # Xanthoria
        th = r.uniform(0.2, 1.1); ph = r.uniform(0, TAU)
        p = np.array([0.5 * math.sin(th) * math.cos(ph), 0.38 * math.sin(th) * math.sin(ph), 0.26 + 0.3 * math.cos(th)])
        n = p - [0, 0, 0.26]; n /= np.linalg.norm(n)
        m.add(blob(0.035, 0.03, 0.01, seg=6, rings=3, colors=('#d0701a', '#ffa83a'), jitter=0.3, seed=k + 40).xf(look_rot(n) @ ry(-math.pi / 2), p * 1.02))
    return m, None


# ── The woods: the Wilds' named trees and the town's trees, bushes and grass ──
def scots_pine():
    """Pinus sylvestris: a tall bare trunk, orange and flaking above, with a flat-topped crown of blue-green needle-clumps."""
    m = Model('scots_pine')
    bough(m, [(0, 0, 0), (0.02, 0, 0.3), (0.0, 0.02, 0.62), (0.03, 0.0, 0.8)], 0.055, 0.03, ('#4a3428', '#c8743a'), sides=8)
    m.add(lathe([(0.09, 0), (0.06, 0.05), (0.055, 0.1)], sides=8, colors=('#3a2a22', '#5a4030'), close_top=False))
    for a, z, L in ((0.4, 0.6, 0.26), (2.5, 0.66, 0.24), (4.4, 0.7, 0.22), (1.4, 0.76, 0.18), (3.4, 0.8, 0.16)):
        bough(m, [(0.01, 0.01, z), (L * 0.5 * math.cos(a), L * 0.5 * math.sin(a), z + 0.04), (L * math.cos(a), L * math.sin(a), z + 0.1)], 0.02, 0.008, ('#8a5030', '#c8743a'), sides=5)
    for k, (a, z, L) in enumerate(((0.3, 0.42, 0.1), (3.3, 0.5, 0.08))):  # dead snags lower down
        bough(m, [(0.01, 0, z), (L * math.cos(a), L * math.sin(a), z + 0.02)], 0.012, 0.004, ('#4a3a30', '#6a5a4a'), sides=4)
    pts = [(0.26 * math.cos(a), 0.26 * math.sin(a), 0.74 + 0.03 * math.sin(a * 2), 0.15) for a in np.linspace(0, TAU, 6, endpoint=False)]
    pts += [(0.1 * math.cos(a), 0.1 * math.sin(a), 0.88, 0.15) for a in (0.5, 2.6, 4.7)] + [(0.02, 0, 0.95, 0.12)]
    crown(m, pts, ('#1e4a3a', '#5a9a7a'), seed=41, jitter=0.2)
    for (x, y, z) in dome_points(8, 0.3, 0.74, 0.1, 42, top_bias=0.9):
        m.add(lathe([(0.012, 0), (0.02, 0.025), (0.0, 0.05)], sides=5, colors=('#5a3a20', '#9a6a40'), close_top=False).xf(rx(math.pi), (x, y, z)))  # cones
    return m, None


def oak():
    """Quercus robur: a short, massive trunk, crooked spreading boughs, a broad domed crown, and acorns."""
    m = Model('oak')
    BARK = ('#3a2e22', '#7a6448')
    t = lathe([(0.16, 0), (0.11, 0.06), (0.095, 0.2), (0.09, 0.34)], sides=10, colors=BARK, close_top=False)
    for i in range(len(t.v)):
        t.v[i][:2] *= 1 + 0.08 * math.cos(4 * TAU * (i % 10) / 10)
    m.add(t)
    for a, L in ((0.3, 0.34), (1.7, 0.3), (3.0, 0.36), (4.5, 0.32), (5.5, 0.26)):
        bough(m, [(0, 0, 0.3), (L * 0.45 * math.cos(a), L * 0.45 * math.sin(a), 0.42), (L * 0.8 * math.cos(a + 0.3), L * 0.8 * math.sin(a + 0.3), 0.46), (L * math.cos(a), L * math.sin(a), 0.56)], 0.05, 0.018, BARK, sides=6)
    crown(m, [(x, y, z, 0.2) for (x, y, z) in dome_points(14, 0.34, 0.6, 0.26, 43, top_bias=0.1)] + [(0, 0, 0.78, 0.26), (0.1, -0.1, 0.62, 0.26)], ('#24542a', '#7ab04a'), seed=43, jitter=0.2)
    lobed = lambda s: (0.6 + 0.4 * abs(math.sin(s * math.pi * 3))) * math.sin(math.pi * min(1, s * 0.9 + 0.08)) ** 0.6
    for (x, y, z) in dome_points(22, 0.5, 0.6, 0.34, 44, top_bias=0.1):  # lobed leaves standing off the crown
        m.add(blade(0.09, 0.06, lobed, segs=3, cols=3, fold=0.1, rise=0.2, droop=0.4, colors=('#2e642e', '#8ac050')).xf(rz(math.atan2(y, x)), (x, y, z)))
    for (x, y, z) in dome_points(12, 0.5, 0.56, 0.28, 45, top_bias=0.4):  # acorns in their cups
        m.add(blob(0.014, 0.014, 0.02, seg=5, rings=3, colors=('#8a6a2a', '#c8a850')).xf(None, (x, y, z)))
        m.add(blob(0.016, 0.016, 0.01, seg=5, rings=3, colors=('#5a4a2a', '#7a6a40')).xf(None, (x, y, z + 0.016)))
    return m, None


def silver_birch():
    """Betula pendula: a slender white trunk barred with black, fine drooping twigs, small bright leaves, catkins."""
    m = Model('silver_birch')
    BARK = ('#b8b8b0', '#f4f4ee')
    bough(m, [(0, 0, 0), (0.02, 0, 0.35), (0.0, 0.02, 0.7), (0.02, 0, 0.9)], 0.04, 0.012, BARK, sides=8)
    m.add(lathe([(0.06, 0), (0.045, 0.04), (0.04, 0.1)], sides=8, colors=('#2a2a26', '#6a6a60'), close_top=False))  # the black, fissured foot
    r = np.random.default_rng(46)
    for z in np.linspace(0.14, 0.62, 9):  # the black bars
        a = r.uniform(0, TAU)
        m.add(blob(0.022, 0.006, 0.008, seg=5, rings=3, colors=('#14140f', '#2a2a24')).xf(rz(a + math.pi / 2), (0.036 * math.cos(a) + 0.01, 0.036 * math.sin(a), z)))
    for a, z in ((0.5, 0.5), (2.6, 0.58), (4.4, 0.66), (1.5, 0.74), (3.6, 0.8)):
        bough(m, [(0.01, 0.01, z), (0.14 * math.cos(a), 0.14 * math.sin(a), z + 0.12)], 0.014, 0.005, ('#5a4a40', '#8a7a6a'), sides=4)
    crown(m, [(x, y, z, 0.11) for (x, y, z) in dome_points(13, 0.2, 0.72, 0.2, 47)], ('#4a8a2a', '#b8e070'), seed=47, jitter=0.25)
    for (x, y, z) in dome_points(22, 0.28, 0.68, 0.2, 48, top_bias=0.6):  # weeping twigs
        m.add(blade(r.uniform(0.14, 0.24), 0.035, linear, segs=3, cols=3, fold=0.2, rise=-1.4, droop=0.1, colors=('#b8e070', '#5a9a30')).xf(rz(math.atan2(y, x)), (x, y, z)))
    return m, None


def bramble():
    """Rubus fruticosus: arching, thorny red-green canes, toothed leaves in threes and fives, blackberries ripening red to black."""
    m = Model('bramble')
    r = np.random.default_rng(49)
    crown(m, [(r.uniform(-0.3, 0.3), r.uniform(-0.3, 0.3), r.uniform(0.2, 0.42), r.uniform(0.2, 0.26)) for _ in range(7)], ('#24502a', '#6aa04a'), seed=49, jitter=0.28)
    for k in range(9):  # arching canes
        a = TAU * k / 9 + r.uniform(-0.2, 0.2); L = r.uniform(0.5, 0.75)
        pts = [(0.05 * math.cos(a), 0.05 * math.sin(a), 0.0)] + [(L * u * math.cos(a), L * u * math.sin(a), 0.7 * math.sin(math.pi * u * 0.8) * 0.75) for u in (0.3, 0.6, 0.85, 1.0)]
        bough(m, pts, 0.018, 0.008, ('#5a2a3a', '#8a5a4a'), sides=4)
        for j in (1, 2, 3):
            p = np.array(pts[j])
            for q in range(3):
                m.add(blade(0.11, 0.07, ovate, segs=2, cols=3, fold=0.15, rise=0.3, droop=0.4, colors=('#2e5a2a', '#7ab050'), wave=0.3, wave_n=3).xf(rz(a + (q - 1) * 0.9), p))
        tip = np.array(pts[-1])
        for q in range(3):  # a cluster of berries at the cane's end
            col = ('#14081a', '#4a2a5a') if (k + q) % 3 else ('#8a1420', '#d83a3a')
            m.add(blob(0.03, 0.03, 0.03, seg=6, rings=4, colors=col, jitter=0.2, seed=q).xf(None, tip + [0.03 * math.cos(q * 2.1), 0.03 * math.sin(q * 2.1), -0.02]))
    return m, None


def blackthorn():
    """Prunus spinosa: a dense, dark, spiny thicket of black twigs, set with blue-bloomed sloes."""
    m = Model('blackthorn')
    r = np.random.default_rng(50)
    for k in range(9):
        a = TAU * k / 9 + r.uniform(-0.2, 0.2); lean = r.uniform(0.15, 0.4); h = r.uniform(0.6, 1.0)
        top = np.array([lean * math.cos(a), lean * math.sin(a), h])
        mid = top * [0.4, 0.4, 0.5] + [0.05 * math.cos(a + 1.5), 0.05 * math.sin(a + 1.5), 0]
        bough(m, [(0.04 * math.cos(a), 0.04 * math.sin(a), 0), mid, top], 0.03, 0.01, ('#14100e', '#3a2e2a'), sides=5)
        for j in range(5):  # the long thorns
            p = mid + (top - mid) * (j / 4)
            d = np.array([math.cos(a + j * 2.4), math.sin(a + j * 2.4), 0.3]); d /= np.linalg.norm(d)
            m.add(lathe([(0.008, 0), (0.0, 0.1)], sides=3, colors=('#14100e', '#4a3a34'), close_top=False).xf(look_rot(d) @ ry(-math.pi / 2), p))
    crown(m, [(r.uniform(-0.28, 0.28), r.uniform(-0.28, 0.28), r.uniform(0.4, 0.8), r.uniform(0.14, 0.2)) for _ in range(8)], ('#1e3a22', '#4a7a40'), seed=50, jitter=0.3)
    for (x, y, z) in dome_points(26, 0.42, 0.5, 0.4, 51, top_bias=0.1):
        m.add(blob(0.028, 0.028, 0.028, seg=6, rings=4, colors=('#1a1a4a', '#6a7ac0')).xf(None, (x, y, max(0.12, z))))
    return m, None


def dead_tree(seed, lean):
    """A dead standing tree, bark gone grey and silver, boughs broken short: an oak that died on its feet."""
    def build():
        m = Model('dead_tree_%d' % seed)
        r = np.random.default_rng(60 + seed)
        BARK = ('#3a3632', '#a8a49c')
        top = np.array([lean, 0.02, 1.0])
        bough(m, [(0, 0, 0), top * [0.3, 0.3, 0.3], top * [0.8, 0.8, 0.7], top], 0.075, 0.012, BARK, sides=8)
        m.add(lathe([(0.12, 0), (0.085, 0.05), (0.075, 0.1)], sides=8, colors=BARK, close_top=False))
        for k in range(6):
            z = 0.35 + 0.1 * k + r.uniform(-0.03, 0.03)
            a = k * 2.3 + r.uniform(-0.3, 0.3); L = r.uniform(0.18, 0.36) * (1 - 0.08 * k)
            base = top * (z / 1.0) * [1, 1, 1]
            base[2] = z
            e1 = base + [L * 0.6 * math.cos(a), L * 0.6 * math.sin(a), 0.08]
            e2 = base + [L * math.cos(a + 0.4), L * math.sin(a + 0.4), 0.2 + r.uniform(0, 0.1)]
            bough(m, [base, e1, e2], 0.028 * (1 - 0.08 * k), 0.006, BARK, sides=5)
            if k % 2 == 0:
                bough(m, [e1, e1 + [0.1 * math.cos(a - 0.8), 0.1 * math.sin(a - 0.8), 0.1]], 0.012, 0.004, BARK, sides=4)
        m.add(blob(0.03, 0.02, 0.04, seg=6, rings=4, colors=('#14100e', '#2a2420')).xf(None, (0.06 + lean * 0.4, 0.03, 0.4)))  # a rot-hole
        for k in range(3):  # a few bracket fungi
            a = r.uniform(0, TAU); z = 0.15 + 0.1 * k
            m.add(blob(0.05, 0.04, 0.012, seg=6, rings=3, colors=('#8a6a4a', '#d8c098')).xf(rz(a), (0.075 * math.cos(a) + lean * z * 0.3, 0.075 * math.sin(a), z)))
        return m, None
    return build


def rowan():
    """Sorbus aucuparia, the rowan: smooth grey bark, feathered leaves, heavy bunches of scarlet berries."""
    m = Model('rowan')
    BARK = ('#5a5650', '#a8a498')
    bough(m, [(0, 0, 0), (0.02, 0.01, 0.25), (0.0, 0.0, 0.5)], 0.05, 0.03, BARK, sides=8)
    for a in (0.4, 2.4, 4.4):
        bough(m, [(0, 0, 0.4), (0.12 * math.cos(a), 0.12 * math.sin(a), 0.55), (0.22 * math.cos(a), 0.22 * math.sin(a), 0.7)], 0.028, 0.012, BARK, sides=5)
    crown(m, [(x, y, z, 0.16) for (x, y, z) in dome_points(12, 0.26, 0.68, 0.24, 52)] + [(0, 0, 0.8, 0.2)], ('#2e6a2e', '#8ac85a'), seed=52, jitter=0.22)
    for (x, y, z) in dome_points(5, 0.4, 0.68, 0.22, 53, top_bias=0.3):
        pinnate(m, 0.16, 3, 0.05, 0.022, math.atan2(y, x), rise=0.15, droop=0.6, colors=('#2e6a2e', '#8ac85a'), base=(x * 0.88, y * 0.88, z), stem_r=0.005, leaf_rise=0.1)
    for (x, y, z) in dome_points(12, 0.4, 0.64, 0.24, 54, top_bias=0.2):  # the berry bunches
        for k in range(5):
            m.add(blob(0.022, 0.022, 0.022, seg=4, rings=2, colors=('#a01410', '#ff4a2a')).xf(None, (x + 0.03 * math.cos(k * 1.1), y + 0.03 * math.sin(k * 1.1), z - 0.012 * (k % 3))))
    return m, None


def beech():
    """Fagus sylvatica: a tall smooth silver-grey bole and a great layered crown."""
    m = Model('beech')
    BARK = ('#6a6860', '#b8b6aa')
    bough(m, [(0, 0, 0), (0.01, 0, 0.3), (0.0, 0.01, 0.6)], 0.07, 0.045, BARK, sides=9)
    m.add(lathe([(0.12, 0), (0.085, 0.05), (0.07, 0.12)], sides=9, colors=BARK, close_top=False))
    for a, z in ((0.3, 0.42), (2.2, 0.48), (4.2, 0.52), (1.2, 0.58), (3.3, 0.6), (5.3, 0.56)):
        bough(m, [(0, 0, z), (0.16 * math.cos(a), 0.16 * math.sin(a), z + 0.1), (0.3 * math.cos(a), 0.3 * math.sin(a), z + 0.16)], 0.03, 0.01, BARK, sides=5)
    crown(m, [(x, y, z, 0.19) for (x, y, z) in dome_points(15, 0.3, 0.68, 0.26, 55, top_bias=0.15)] + [(0, 0, 0.86, 0.22), (0, 0, 0.66, 0.3)], ('#2a5a2a', '#9ac85a'), seed=55, jitter=0.18)
    return m, None


def hazel():
    """Corylus avellana: many straight rods from one stool, round soft leaves, clusters of nuts in their frills."""
    m = Model('hazel')
    r = np.random.default_rng(56)
    for k in range(8):
        a = TAU * k / 8 + r.uniform(-0.2, 0.2); lean = r.uniform(0.15, 0.4)
        bough(m, [(0.05 * math.cos(a), 0.05 * math.sin(a), 0), (lean * 0.5 * math.cos(a), lean * 0.5 * math.sin(a), 0.4), (lean * math.cos(a), lean * math.sin(a), 0.75)], 0.028, 0.012, ('#5a4632', '#9a8260'), sides=5)
    crown(m, [(x, y, z, 0.2) for (x, y, z) in dome_points(9, 0.3, 0.6, 0.26, 57, top_bias=0.2)] + [(0, 0, 0.74, 0.22)], ('#2e642a', '#8ac050'), seed=57, jitter=0.22)
    for (x, y, z) in dome_points(8, 0.42, 0.58, 0.22, 58, top_bias=0.3):
        for k in range(3):
            m.add(blob(0.022, 0.022, 0.026, seg=5, rings=3, colors=('#8a6a3a', '#c8a060')).xf(None, (x + 0.025 * math.cos(k * 2.1), y + 0.025 * math.sin(k * 2.1), z)))
            m.add(blob(0.026, 0.026, 0.014, seg=5, rings=3, colors=('#5a8a3a', '#9ac060')).xf(None, (x + 0.025 * math.cos(k * 2.1), y + 0.025 * math.sin(k * 2.1), z + 0.018)))
    return m, None


def holly():
    """Ilex aquifolium: a dense dark cone of glossy, spiny leaves, bright with berries."""
    m = Model('holly')
    bough(m, [(0, 0, 0), (0, 0, 0.4)], 0.04, 0.02, ('#3a3a34', '#6a6a60'), sides=6)
    crown(m, [(0.24 * math.cos(a), 0.24 * math.sin(a), 0.28, 0.2) for a in np.linspace(0, TAU, 6, endpoint=False)] + [(0.16 * math.cos(a), 0.16 * math.sin(a), 0.55, 0.18) for a in np.linspace(0.5, TAU + 0.5, 4, endpoint=False)] + [(0, 0, 0.8, 0.15)], ('#0e3a1e', '#2e7a3a'), seed=59, jitter=0.2)
    spiny = lambda s: (0.55 + 0.45 * abs(math.sin(s * math.pi * 3.5))) * math.sin(math.pi * min(1, s * 0.92 + 0.06)) ** 0.5
    for (x, y, z) in dome_points(30, 0.4, 0.3, 0.6, 60, top_bias=0.0):
        sc = 1 - 0.5 * max(0, z - 0.3) / 0.6
        m.add(blade(0.1, 0.06, spiny, segs=3, cols=3, fold=0.2, rise=0.3, droop=0.3, colors=('#14442a', '#3a8a48')).xf(rz(math.atan2(y, x)), (x * sc, y * sc, max(0.1, z))))
    for (x, y, z) in dome_points(14, 0.4, 0.3, 0.55, 61, top_bias=0.0):
        sc = 1 - 0.5 * max(0, z - 0.3) / 0.6
        for k in range(3):
            m.add(blob(0.022, 0.022, 0.022, seg=5, rings=3, colors=('#a00a10', '#ff3a2a')).xf(None, (x * sc + 0.02 * math.cos(k * 2.1), y * sc + 0.02 * math.sin(k * 2.1), max(0.1, z))))
    return m, None


def dog_rose():
    """Rosa canina: arching green stems, small leaves, flat pink five-petalled roses and scarlet hips."""
    m = Model('dog_rose')
    r = np.random.default_rng(62)
    crown(m, [(r.uniform(-0.26, 0.26), r.uniform(-0.26, 0.26), r.uniform(0.25, 0.5), r.uniform(0.18, 0.24)) for _ in range(7)], ('#2a5a2a', '#72b050'), seed=62, jitter=0.28)
    for k in range(7):
        a = TAU * k / 7 + r.uniform(-0.2, 0.2); L = r.uniform(0.4, 0.6)
        pts = [(0, 0, 0)] + [(L * u * math.cos(a), L * u * math.sin(a), 0.75 * math.sin(math.pi * u * 0.7)) for u in (0.35, 0.7, 1.0)]
        bough(m, pts, 0.014, 0.006, ('#3a6a2a', '#6a9a4a'), sides=4)
        tip = np.array(pts[-1])
        if k % 2 == 0:
            for j in range(5):
                m.add(blade(0.06, 0.055, heart, segs=2, cols=3, fold=0.05, cup=0.1, rise=0.25, droop=0.2, colors=('#ffd0e0', '#f080a8')).xf(rz(TAU * j / 5), tip))
            m.add(blob(0.018, 0.018, 0.012, seg=5, rings=3, colors=('#e0a010', '#ffe050')).xf(None, tip + [0, 0, 0.01]))
        else:
            for j in range(3):
                m.add(blob(0.022, 0.022, 0.032, seg=5, rings=3, colors=('#b01a10', '#ff5a2a')).xf(None, tip + [0.03 * math.cos(j * 2.1), 0.03 * math.sin(j * 2.1), -0.02]))
    return m, None


def grass_tuft(kind):
    """Ground cover, a few faces each: tussock grass, a rush clump, bracken, and a tuft with seed-heads."""
    def build():
        m = Model('grass_' + kind)
        r = np.random.default_rng(hash(kind) % 1000 if False else {'tussock': 1, 'rush': 2, 'bracken': 3, 'seeding': 4}[kind])
        if kind == 'bracken':
            for i in range(4):
                pinnate(m, r.uniform(0.8, 1.0), 4, 0.3, 0.14, TAU * i / 4 + r.uniform(-0.3, 0.3), rise=1.2, droop=1.5, colors=('#3a6a2a', '#9ab850'), stem_r=0.02, leaf_rise=0.1)
            return m, None
        n = {'tussock': 11, 'rush': 9, 'seeding': 8}[kind]
        for i in range(n):
            a = TAU * i / n + r.uniform(-0.3, 0.3)
            if kind == 'rush':
                m.add(blade(r.uniform(0.7, 1.0), 0.05, linear, segs=2, cols=3, fold=0.35, rise=1.45, droop=0.3, colors=('#2a4a2a', '#6a8a4a')).xf(rz(a), (0.03 * math.cos(a), 0.03 * math.sin(a), 0)))
            else:
                m.add(blade(r.uniform(0.5, 1.0), 0.09, linear, segs=2, cols=3, fold=0.3, rise=1.2, droop=1.3, colors=('#3a6a2a', '#a0c060')).xf(rz(a), (0.03 * math.cos(a), 0.03 * math.sin(a), 0)))
        if kind == 'seeding':
            for i in range(3):
                a = TAU * i / 3 + 0.5; top = (0.12 * math.cos(a), 0.12 * math.sin(a), 1.0)
                m.add(tube([(0, 0, 0), top], 0.012, sides=3, colors=('#7a8a4a', '#c8c080')))
                m.add(blob(0.03, 0.03, 0.09, seg=4, rings=3, colors=('#a89a5a', '#e0d090')).xf(None, top))
        if kind == 'rush':
            for i in range(3):
                a = TAU * i / 3; m.add(blob(0.03, 0.03, 0.04, seg=4, rings=2, colors=('#4a3420', '#7a5a34')).xf(None, (0.1 * math.cos(a), 0.1 * math.sin(a), 0.7)))
        return m, None
    return build


GROVE = {
    'mourning_willow': willow, 'capwood': capwood, 'nightberry': bilberry, 'fenfern': royal_fern, 'toadring': fairy_ring,
    'alder': alder, 'ash_tree': ash, 'hawthorn': hawthorn, 'wild_apple': wild_apple, 'ivy_bank': ivy_bank,
    'elder': elder, 'gorse': gorse, 'heather': heather, 'aspen': aspen, 'yew': yew, 'crotal_stone': crotal_stone,
    'scots_pine': scots_pine, 'oak': oak, 'silver_birch': silver_birch, 'bramble': bramble, 'blackthorn': blackthorn,
    'dead_tree_a': dead_tree(1, 0.1), 'dead_tree_b': dead_tree(2, -0.14), 'dead_tree_c': dead_tree(3, 0.04),
    'rowan': rowan, 'beech': beech, 'hazel': hazel, 'holly': holly, 'dog_rose': dog_rose,
    'grass_tussock': grass_tuft('tussock'), 'grass_rush': grass_tuft('rush'), 'grass_bracken': grass_tuft('bracken'), 'grass_seeding': grass_tuft('seeding'),
}

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for n in (sys.argv[1:] or list(GROVE)):
        m, glow = GROVE[n]()
        path = os.path.abspath(os.path.join(OUT, n + '.glb'))
        m.export(path, glow_color=glow or '#ffffff')
        print(n, m.tris(), 'tris', os.path.getsize(path), 'bytes')
