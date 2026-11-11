"""The sixteen Wilds plants and the cottage pots, each made to look like the
real plant it stands for. Writes public/kk/flora/*.glb.

    sh tools/models/build.sh plants [name ...]
"""
import math, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from trlib import *  # noqa

OUT = os.path.join(os.path.dirname(__file__), '../../public/kk/flora')
rng = np.random.default_rng(7)

STEM = ('#2c5a2a', '#5e9a44')
LEAF = ('#2f6a2e', '#74b450')
LEAF_DK = ('#1f4a2c', '#4f8a50')


def rosette(m, n, length, width, shape, colors=LEAF, rise=0.9, droop=1.0, seed=0, fold=0.22, jitter=0.25, **kw):
    r = np.random.default_rng(seed)
    for i in range(n):
        a = TAU * i / n + r.uniform(-jitter, jitter)
        L = length * r.uniform(0.8, 1.1)
        m.add(blade(L, width * r.uniform(0.85, 1.1), shape, rise=rise + r.uniform(-0.15, 0.15), droop=droop, fold=fold, colors=colors, **kw).xf(rz(a), (0, 0, 0.01)))


def glowing(p):
    p.glow = True
    return p


SOIL = ('#2e1d12', '#5a3c26')


def mound(m, r=0.22, h=0.05, seed=0):
    m.add(blob(r, r * 0.92, h, seg=8, rings=3, colors=SOIL, seed=seed, jitter=0.12).xf(None, (0, 0, h * 0.3)))


def fly_agaric():
    """Amanita muscaria: scarlet cap flecked with white warts, white stem with a skirt, bulbous base."""
    m = Model('toadstool')

    def shroom(h, capR, open_, x, y, lean, seed):
        R = ry(lean[0]) @ rx(lean[1])
        T = (x, y, 0)
        m.add(lathe([(capR * 0.42, 0), (capR * 0.48, h * 0.08), (capR * 0.34, h * 0.2), (capR * 0.27, h * 0.55), (capR * 0.23, h * 0.9)],
                    sides=9, colors=('#d6c9ae', '#fbf6ea'), close_bottom=True, close_top=False).xf(R, T))
        m.add(lathe([(capR * 0.45, h * 0.1), (capR * 0.55, h * 0.13), (capR * 0.4, h * 0.17)], sides=9, colors=('#e6dcc4', '#fbf6ea'), close_top=False).xf(R, T))
        m.add(lathe([(capR * 0.22, h * 0.8), (capR * 0.42, h * 0.74), (capR * 0.46, h * 0.66)], sides=10, colors=('#e4dac6', '#ffffff'), close_top=False).xf(R, T))
        dome = 0.8 - 0.4 * open_
        prof = [(capR * math.cos(th), h * 0.86 + capR * dome * math.sin(th)) for th in np.linspace(0, math.pi / 2, 7)]
        m.add(lathe([(capR * 0.22, h * 0.86), (capR * 0.97, h * 0.85)], sides=12, colors=('#efe4cc', '#efe4cc'), close_top=False).xf(R, T))
        m.add(lathe(prof, sides=12, colors=('#9e160c', '#f04a2a'), t_of=[0, .25, .5, .68, .82, .93, 1]).xf(R, T))
        r = np.random.default_rng(seed)
        n = int(5 + 9 * capR)
        for k in range(n):
            th = r.uniform(0.25, 1.3); ph = TAU * k / n + r.uniform(-0.3, 0.3)
            px, py = capR * math.cos(th) * math.cos(ph), capR * math.cos(th) * math.sin(ph)
            pz = h * 0.86 + capR * dome * math.sin(th)
            w = capR * r.uniform(0.09, 0.14)
            m.add(blob(w, w * 0.9, w * 0.45, seg=5, rings=3, colors=('#efe8da', '#ffffff')).xf(None, (px, py, pz)).xf(R, T))
    shroom(1.0, 0.6, 0.7, 0, 0, (0.05, -0.04), 1)
    shroom(0.55, 0.3, 0.15, 0.46, 0.2, (-0.25, 0.12), 2)
    shroom(0.3, 0.17, 0.0, -0.34, 0.3, (0.2, 0.25), 3)
    return m, None


def parasol():
    """Macrolepiota procera, the parasol: the giant of the field, a tall snakeskin stem under a broad scaly cap."""
    m = Model('giants_cap')
    H, R = 1.0, 0.55
    m.add(lathe([(0.11, 0), (0.12, 0.04), (0.075, 0.1), (0.06, 0.5), (0.05, H * 0.86)], sides=8, colors=('#8a6a4a', '#e8dcc4'), close_bottom=True, close_top=False))
    for z in (0.18, 0.32, 0.46, 0.6):  # the snakeskin bands
        m.add(lathe([(0.064, z - 0.02), (0.07, z), (0.06, z + 0.025)], sides=8, colors=('#6a4a30', '#8a6a48'), close_top=False))
    m.add(lathe([(0.055, 0.68), (0.11, 0.66), (0.12, 0.62), (0.07, 0.64)], sides=10, colors=('#e6dccb', '#fbf6ea'), close_top=False))  # the double ring
    m.add(lathe([(0.05, H * 0.85), (R * 0.98, H * 0.84)], sides=14, colors=('#efe6d2', '#f6efe0'), close_top=False))  # gills
    prof = [(R, H * 0.84), (R * 0.9, H * 0.88), (R * 0.65, H * 0.92), (R * 0.35, H * 0.95), (R * 0.15, H * 0.99), (0.0, H * 1.02)]
    m.add(lathe(prof, sides=14, colors=('#efe2c8', '#d8c09a'), t_of=[0, .2, .4, .6, .8, 1], close_top=False))
    m.add(blob(0.13, 0.13, 0.05, seg=8, rings=3, colors=('#5a3820', '#7a5030')).xf(None, (0, 0, H * 1.0)))  # the dark umbo
    r = np.random.default_rng(4)
    for ring, (rad, z, n) in enumerate([(0.2, 0.97, 7), (0.32, 0.94, 10), (0.44, 0.905, 13)]):
        for k in range(n):
            a = TAU * k / n + ring * 0.3 + r.uniform(-0.1, 0.1)
            w = 0.07 - ring * 0.008
            m.add(blob(w, w * 0.7, 0.012, seg=5, rings=3, colors=('#6e4a2c', '#8e6440')).xf(rz(a), (rad * math.cos(a), rad * math.sin(a), H * z)))
    # a young one, still a drumstick
    m.add(lathe([(0.05, 0), (0.055, 0.03), (0.03, 0.08), (0.025, 0.3)], sides=7, colors=('#8a6a4a', '#e8dcc4'), close_bottom=True, close_top=False).xf(None, (0.36, 0.14, 0)))
    m.add(blob(0.085, 0.085, 0.11, seg=7, rings=5, colors=('#d8c4a0', '#5a3820')).xf(None, (0.36, 0.14, 0.36)))
    return m, None


def monkshood():
    """Aconitum napellus, wolfsbane: a spike of hooded blue-violet flowers over deeply cut leaves."""
    m = Model('wolfsbane_bloom')
    H = 1.0
    m.add(tube([(0, 0, 0), (0.01, 0, H * 0.4), (0.02, 0.01, H * 0.8), (0.0, 0.02, H * 1.0)], lambda s: 0.035 * (1 - 0.5 * s), sides=6, colors=STEM))
    def palmate(scale, z, az, rise):
        for k in range(5):
            a = az + (k - 2) * 0.45
            m.add(blade(0.3 * scale * (1 - 0.15 * abs(k - 2)), 0.1 * scale, lanceolate, segs=4, cols=3, fold=0.3, rise=rise, droop=1.0,
                        colors=('#2a5a34', '#5f9a58'), wave=0.3, wave_n=2).xf(rz(a), (0, 0, z)))
    for i, (z, sc, rise) in enumerate([(0.02, 1.2, 0.35), (0.03, 1.1, 0.3), (0.04, 1.15, 0.4), (0.2, 0.95, 0.6), (0.34, 0.75, 0.7)]):
        palmate(sc, z, i * 2.2 + 0.3, rise)
    n = 10
    for i in range(n):
        s = i / (n - 1)
        z = H * (0.46 + 0.5 * s)
        a = i * 2.4
        size = 0.12 * (1 - 0.45 * s)
        out = 0.07 * (1 - 0.6 * s)
        px, py = out * math.cos(a), out * math.sin(a)
        if s > 0.8:
            m.add(blob(size * 0.5, size * 0.5, size * 0.75, seg=6, rings=4, colors=('#34348a', '#6a64d0')).xf(None, (px * 0.5, py * 0.5, z)))
            continue
        R = rz(a) @ ry(-0.3)
        m.add(glowing(blob(size * 0.62, size * 0.55, size * 0.9, seg=7, rings=5, colors=('#2e2e8c', '#8a82f0'))).xf(R, (px, py, z + size * 0.6)))  # the helm
        m.add(blob(size * 0.5, size * 0.6, size * 0.4, seg=6, rings=4, colors=('#2e2e8c', '#6e66dc')).xf(R, (px + 0.02 * math.cos(a), py + 0.02 * math.sin(a), z)))  # the face
    return m, '#8a82f0'


def violet():
    """Viola odorata, sweet violet: a low clump of heart-shaped leaves and nodding five-petalled flowers."""
    m = Model('shrinking_violet')
    r = np.random.default_rng(5)
    for i in range(9):
        a = TAU * i / 9 + r.uniform(-0.2, 0.2)
        L = r.uniform(0.32, 0.42)
        st = tube([(0, 0, 0), (L * 0.35 * math.cos(a), L * 0.35 * math.sin(a), L * 0.45), (L * 0.6 * math.cos(a), L * 0.6 * math.sin(a), L * 0.5)], 0.012, sides=4, colors=STEM)
        m.add(st)
        m.add(blade(0.34, 0.36, heart, segs=4, cols=5, fold=0.12, cup=0.08, rise=0.2, droop=0.5, colors=('#2c6a34', '#68b05a')).xf(rz(a), (L * 0.55 * math.cos(a), L * 0.55 * math.sin(a), L * 0.48)))
    for i in range(6):
        a = TAU * i / 6 + 0.4 + r.uniform(-0.2, 0.2)
        d = r.uniform(0.18, 0.3); h = r.uniform(0.55, 0.75)
        tip = np.array([d * math.cos(a), d * math.sin(a), h])
        m.add(tube([(0, 0, 0), tip * [0.5, 0.5, 0.75], tip, tip + [0.04 * math.cos(a), 0.04 * math.sin(a), -0.05]], 0.012, sides=4, colors=STEM))
        F = tip + [0.05 * math.cos(a), 0.05 * math.sin(a), -0.08]
        R = rz(a)
        # five petals facing outward: two up, two to the sides, one broad lower lip
        for pa, pl, pw in ((1.9, 0.16, 0.12), (1.25, 0.16, 0.12), (0.2, 0.14, 0.1), (-0.2, 0.14, 0.1), (-1.5, 0.17, 0.15)):
            P = blade(pl, pw, round_, segs=3, cols=3, fold=0.05, cup=0.1, rise=0, droop=0.3, colors=('#6a3ab0', '#c8a4ff'))
            m.add(P.xf(ry(-pa if False else 0) @ rx(0), (0, 0, 0)).xf(R @ ry(math.pi / 2) @ rz(pa), F))
        m.add(glowing(blob(0.03, 0.03, 0.03, seg=5, rings=3, colors=('#f4e8a0', '#ffffff'))).xf(None, F))
    return m, '#a87ae8'


def pinnate(m, length, n, leaflet_len, leaflet_w, az, rise, droop, colors, shape=lanceolate, z0=0.0, base=(0, 0, 0), leaf_rise=0.25, stem_r=0.012, taper=0.6):
    """A compound leaf (fern frond, carrot top): a rachis along an arc with paired leaflets."""
    pts = []
    p = np.array(base, float) + [0, 0, z0]
    ang = rise
    seg = length / 8
    for i in range(9):
        pts.append(p.copy())
        p = p + seg * np.array([math.cos(ang), 0, math.sin(ang)])
        ang -= droop / 8
    pts = np.array(pts)
    R = rz(az)
    m.add(tube(pts @ R.T, lambda s: stem_r * (1 - 0.7 * s), sides=4, colors=colors))
    for i in range(1, n + 1):
        s = i / (n + 1)
        idx = s * 8
        k = min(7, int(idx)); f = idx - k
        P = pts[k] * (1 - f) + pts[k + 1] * f
        d = pts[k + 1] - pts[k]; pitch = math.atan2(d[2], d[0])
        L = leaflet_len * (1 - taper * s ** 1.3)
        for sgn in (-1, 1):
            lf = blade(L, leaflet_w * (1 - 0.5 * s), shape, segs=3, cols=3, fold=0.2, rise=leaf_rise, droop=0.4, colors=colors)
            lf.xf(rz(sgn * 1.15) , (0, 0, 0))
            lf.xf(ry(-pitch * 0.5), (0, 0, 0))
            m.add(lf.xf(R, P @ R.T))


def carrot():
    """Daucus carota, the carrot: an orange shoulder at the soil and a fountain of feathery fronds."""
    m = Model('swift_root')
    mound(m, 0.26, 0.05, 1)
    # the root, its orange shoulder standing proud of the soil, ringed with little creases
    m.add(lathe([(0.0, -0.05), (0.09, 0.0), (0.13, 0.06), (0.135, 0.1), (0.1, 0.13), (0.04, 0.145)], sides=10, colors=('#c4520e', '#ff9a3c'), close_top=True))
    for z in (0.03, 0.07):
        m.add(lathe([(0.128, z - 0.006), (0.137, z), (0.128, z + 0.006)], sides=10, colors=('#c4520e', '#e0741e'), close_top=False))
    r = np.random.default_rng(6)
    for i in range(8):
        a = TAU * i / 8 + r.uniform(-0.25, 0.25)
        pinnate(m, r.uniform(0.75, 0.95), 7, 0.22, 0.11, a, rise=1.2 + r.uniform(-0.1, 0.15), droop=1.3, colors=('#3a7a30', '#8fd060'), shape=ovate, base=(0, 0, 0.13), stem_r=0.018, leaf_rise=0.5)
    return m, None


def fern():
    """Dryopteris filix-mas, the male fern: a shuttlecock of arching fronds and a crozier unrolling at the heart."""
    m = Model('featherleaf')
    r = np.random.default_rng(8)
    for i in range(8):
        a = TAU * i / 8 + r.uniform(-0.2, 0.2)
        pinnate(m, r.uniform(0.95, 1.1), 11, 0.3, 0.13, a, rise=1.4 + r.uniform(-0.1, 0.1), droop=1.5, colors=('#2e7034', '#9ad870'), shape=lanceolate, stem_r=0.02, leaf_rise=0.1, taper=0.8)
    # two croziers, the fiddleheads, curled tight (these are the ones that glow)
    for k, (a, h) in enumerate(((0.6, 0.42), (2.6, 0.32))):
        pts = [(0, 0, 0)]
        for j in range(1, 14):
            th = j / 13
            if th < 0.6:
                pts.append((0.0, 0.0, h * th / 0.6))
            else:
                u = (th - 0.6) / 0.4 * 1.6 * math.pi
                rr = 0.07 * (1 - 0.45 * (th - 0.6) / 0.4)
                pts.append((rr * math.sin(u), 0, h + rr * (1 - math.cos(u))))
        c = tube(np.array(pts) @ rz(a).T, lambda s: 0.022 * (1 - 0.35 * s), sides=5, colors=('#4f9a3a', '#c8ff8a'))
        c.glow = True
        m.add(c)
    return m, '#b6ff7a'


def pumpkin():
    """Cucurbita pepo: a sprawl of big lobed leaves, a trumpet flower, a curled tendril and a little pumpkin set."""
    m = Model('pumpkin_blossom')
    r = np.random.default_rng(9)
    lobed = lambda s: (0.7 + 0.35 * abs(math.sin(s * math.pi * 2.5))) * math.sin(math.pi * min(1, s * 0.9 + 0.1)) ** 0.6
    for i in range(5):
        a = TAU * i / 5 + r.uniform(-0.2, 0.2)
        L = r.uniform(0.25, 0.34)
        top = np.array([L * math.cos(a), L * math.sin(a), r.uniform(0.25, 0.4)])
        m.add(tube([(0, 0, 0.02), top * [0.4, 0.4, 0.9], top], 0.018, sides=5, colors=('#3a6a2a', '#6a9a3a')))
        m.add(blade(0.42, 0.5, lobed, segs=5, cols=5, fold=0.15, cup=0.06, rise=0.05, droop=0.45, colors=('#2e6a2a', '#78b84a'), wave=0.15, wave_n=3).xf(rz(a), top))
    # the flower: a five-pointed golden trumpet
    F = np.array([0.08, -0.12, 0.22])
    m.add(tube([(0, 0, 0.02), (0.05, -0.06, 0.12), F], 0.016, sides=5, colors=('#3a6a2a', '#6a9a3a')))
    star = lambda n, i: 1 + 0.18 * math.cos(n * i)
    prof = [(0.03, 0), (0.05, 0.08), (0.09, 0.18), (0.17, 0.27), (0.24, 0.31)]
    tr = lathe(prof, sides=10, colors=('#e07a10', '#ffd040'), close_top=False)
    for idx in range(len(tr.v)):
        ring = idx // 10; k = idx % 10
        if ring == len(prof) - 1:
            tr.v[idx][:2] *= 1 + 0.25 * math.cos(5 * TAU * k / 10)
    m.add(tr.xf(ry(0.55), F))
    m.add(blob(0.03, 0.03, 0.05, seg=5, rings=3, colors=('#e0a010', '#fff080')).xf(ry(0.55), F + [0.02, 0, 0.05]))
    # the little pumpkin that has already set
    pk = lathe([(0.0, 0.0)] + [(0.17 * math.sin(math.pi * u), 0.24 * u) for u in np.linspace(0.08, 0.92, 6)] + [(0.0, 0.24)], sides=16, colors=('#c85a10', '#ff9a30'), close_top=False)
    for idx in range(len(pk.v)):
        k = idx % 16
        pk.v[idx][:2] *= 1 - 0.1 * (k % 2)
    m.add(pk.xf(None, (-0.36, 0.26, 0.0)))
    m.add(tube([(-0.36, 0.26, 0.22), (-0.36, 0.26, 0.28), (-0.33, 0.25, 0.31)], 0.02, sides=5, colors=('#3a5a2a', '#6a8a3a')))
    # a corkscrew tendril
    pts = [(0.0 + 0.04 * math.cos(u * 3), 0.25 + 0.04 * math.sin(u * 3), 0.12 + 0.05 * u) for u in np.linspace(0, 4, 18)]
    m.add(tube(pts, 0.007, sides=4, colors=('#4a7a2a', '#8aba4a')))
    return m, None


def bat_flower():
    """Tacca chantrieri, the bat flower: two great purple-black wing bracts, a face of florets and long hanging whiskers."""
    m = Model('bats_breath')
    r = np.random.default_rng(10)
    for i in range(4):
        a = TAU * i / 4 + 0.4 + r.uniform(-0.2, 0.2)
        top = np.array([0.1 * math.cos(a), 0.1 * math.sin(a), 0.18])
        m.add(tube([(0, 0, 0.02), top], 0.015, sides=5, colors=('#2a4a2a', '#4a7a3a')))
        m.add(blade(0.5, 0.26, ovate, segs=5, cols=5, fold=0.25, rise=0.6, droop=1.1, colors=('#2a5a30', '#6aa85a'), wave=0.08).xf(rz(a), top))
    F = np.array([0.0, 0.0, 0.62])
    m.add(tube([(0, 0, 0.02), (0.02, 0, 0.3), F], 0.016, sides=5, colors=('#3a2a3a', '#5a3a5a')))
    wing = lambda s: math.sin(math.pi * min(1, s)) ** 0.5 * (0.65 + 0.35 * math.cos(s * 3.4))
    for sgn in (-1, 1):
        w = blade(0.46, 0.5, wing, segs=6, cols=5, fold=0.1, cup=-0.05, rise=0.5, droop=0.9, colors=('#3a1a48', '#a868c8'), wave=0.25, wave_n=2)
        m.add(w.xf(rz(sgn * math.pi / 2), F))
    for k in range(6):  # the florets, the "face"
        a = TAU * k / 6
        fl = blob(0.025, 0.025, 0.03, seg=5, rings=3, colors=('#2a1430', '#7a3a8a'))
        fl.glow = True
        m.add(fl.xf(None, F + [0.04 * math.cos(a), 0.04 * math.sin(a), -0.01]))
    for k in range(9):  # whiskers
        a = TAU * k / 9 + r.uniform(-0.2, 0.2)
        d = r.uniform(0.04, 0.12)
        pts = [F, F + [d * math.cos(a), d * math.sin(a), -0.04], F + [d * 1.4 * math.cos(a), d * 1.4 * math.sin(a), -r.uniform(0.25, 0.42)]]
        m.add(tube(pts, 0.006, sides=3, colors=('#2a1a2a', '#4a2a4a')))
    return m, '#b070d0'


def pansy_face(m, F, a, size, cols_top=('#4a2a8a', '#9a6ae0'), cols_side=('#8a7ac8', '#e6dcff'), cols_low=('#e0a010', '#ffe060'), tilt=0.5):
    """A flat pansy face looking out along azimuth a: two upper petals, two side petals, a broad lower lip."""
    face = rz(a) @ ry(-tilt)          # the face looks along local +X
    lay = rz(math.pi) @ ry(-math.pi / 2)  # a blade, made to grow up (+Z) with its face toward +X
    for ang, cols, pl, pw in ((0.45, cols_top, 1.0, 0.9), (-0.45, cols_top, 1.0, 0.9), (1.45, cols_side, 0.85, 0.7), (-1.45, cols_side, 0.85, 0.7), (math.pi, cols_low, 1.0, 1.05)):
        P = blade(size * pl, size * pw, round_, segs=3, cols=3, fold=0.03, cup=0.05, rise=0, droop=0.15, colors=cols)
        m.add(P.xf(face @ rx(ang) @ lay, F + face @ [-0.004 * (ang == math.pi), 0, 0]))
    m.add(glowing(blob(size * 0.16, size * 0.16, size * 0.1, seg=5, rings=3, colors=('#ffcf30', '#fff7a0'))).xf(face @ ry(math.pi / 2), F + face @ [0.01, 0, 0]))


def heartsease():
    """Viola tricolor, heartsease or love-in-idleness: a little tangle of leaves and three-coloured faces."""
    m = Model('rainbow_petal')
    r = np.random.default_rng(11)
    for i in range(11):
        a = TAU * i / 11 + r.uniform(-0.3, 0.3)
        z = r.uniform(0.04, 0.3)
        d = r.uniform(0.08, 0.2)
        m.add(blade(0.18, 0.09, ovate, segs=3, cols=3, fold=0.2, rise=0.35, droop=0.7, colors=('#2c6a34', '#72b85c'), wave=0.2).xf(rz(a), (d * 0.4 * math.cos(a), d * 0.4 * math.sin(a), z * 0.6)))
    palette = [(('#3a1a6a', '#8a5ad0'), ('#b8a8e8', '#fbf8ff'), ('#e0a010', '#ffe060')),
               (('#4a1a5a', '#a060c8'), ('#a080d8', '#e8dcff'), ('#d89010', '#ffd850')),
               (('#2a1a5a', '#6a50c0'), ('#e8d080', '#fff4c0'), ('#e0a010', '#ffe060'))]
    for i in range(7):
        a = TAU * i / 7 + r.uniform(-0.25, 0.25)
        d = r.uniform(0.12, 0.24); h = r.uniform(0.38, 0.6)
        F = np.array([d * math.cos(a), d * math.sin(a), h])
        m.add(tube([(0, 0, 0.02), F * [0.6, 0.6, 0.7], F + [0, 0, -0.02]], 0.01, sides=4, colors=STEM))
        pt, ps, pl = palette[i % 3]
        pansy_face(m, F, a, 0.13, pt, ps, pl, tilt=0.35)
    for p in m.parts[-0:]:
        pass
    return m, '#c8a0ff'


def hellebore():
    """Helleborus, the black hellebore of the old herbals: leathery fingered leaves and nodding plum-black flowers."""
    m = Model('ravens_feather_plant')
    r = np.random.default_rng(12)
    for i in range(5):
        a = TAU * i / 5 + r.uniform(-0.2, 0.2)
        top = np.array([0.14 * math.cos(a), 0.14 * math.sin(a), r.uniform(0.32, 0.42)])
        m.add(tube([(0, 0, 0.02), top * [0.5, 0.5, 0.8], top], 0.014, sides=5, colors=('#2a3a2a', '#3a5a3a')))
        for k in range(7):
            m.add(blade(0.3 * (1 - 0.1 * abs(k - 3)), 0.08, lanceolate, segs=4, cols=3, fold=0.3, rise=0.15, droop=0.7, colors=('#1a3a2a', '#3f6a4a'), wave=0.05).xf(rz(a + (k - 3) * 0.33), top))
    for i in range(5):
        a = TAU * i / 5 + 0.6 + r.uniform(-0.2, 0.2)
        d = r.uniform(0.14, 0.24); h = r.uniform(0.48, 0.62)
        F = np.array([d * math.cos(a), d * math.sin(a), h])
        m.add(tube([(0, 0, 0.02), F * [0.4, 0.4, 0.95], F + [0.03 * math.cos(a), 0.03 * math.sin(a), 0.02]], 0.014, sides=4, colors=('#2a1a2a', '#4a2a3a')))
        R = rz(a) @ ry(1.5)  # nodding: face turned out and down
        for k in range(5):
            P = blade(0.17, 0.16, round_, segs=3, cols=3, fold=0.05, cup=0.15, rise=0.7, droop=0.5, colors=('#2a0e24', '#8a3a6e'))
            m.add(P.xf(rz(TAU * k / 5), (0, 0, 0)).xf(R, F))
        m.add(blob(0.035, 0.035, 0.03, seg=6, rings=3, colors=('#c8c040', '#f0e870')).xf(R, F + R @ [0, 0, 0.03]))
    return m, None


def darnel():
    """Lolium temulentum, darnel, the "drunken" tare among the wheat: a tuft of blades and flat golden spikes."""
    m = Model('stumbleweed')
    r = np.random.default_rng(13)
    for i in range(13):
        a = TAU * i / 13 + r.uniform(-0.3, 0.3)
        m.add(blade(r.uniform(0.35, 0.55), 0.045, linear, segs=4, cols=3, fold=0.3, rise=1.25, droop=1.6, colors=('#6a7a2a', '#d8c060')).xf(rz(a), (0.02 * math.cos(a), 0.02 * math.sin(a), 0)))
    for i in range(6):
        a = TAU * i / 6 + r.uniform(-0.3, 0.3)
        lean = r.uniform(0.05, 0.22)
        H = r.uniform(0.8, 1.0)
        top = np.array([lean * math.cos(a), lean * math.sin(a), H])
        pts = [np.zeros(3), top * [0.3, 0.3, 0.45], top * [0.7, 0.7, 0.8], top]
        m.add(tube(pts, 0.01, sides=4, colors=('#8a8a3a', '#e8d070')))
        # spikelets set edge-on, alternating up the spike
        for k in range(7):
            s = 0.6 + 0.4 * k / 6
            P = np.array(top) * s
            sgn = 1 if k % 2 else -1
            sp = blob(0.022, 0.012, 0.05, seg=5, rings=3, colors=('#b89a30', '#f8e080'))
            m.add(sp.xf(rx(sgn * 0.5) @ rz(a), P + rz(a) @ [0, sgn * 0.02, 0]))
    return m, None


def mandrake():
    """Mandragora officinarum: a flat rosette of great wrinkled leaves, pale bells, golden "apples", and the forked root showing."""
    m = Model('gibberish_root')
    mound(m, 0.28, 0.05, 8)
    # the root: shoulders and two legs breaking the soil
    m.add(blob(0.11, 0.09, 0.09, seg=7, rings=5, colors=('#8a6a40', '#e8cfa0')).xf(None, (0, 0, 0.04)))
    for sgn in (-1, 1):
        m.add(tube([(sgn * 0.06, 0, 0.02), (sgn * 0.2, 0.05, 0.05), (sgn * 0.34, 0.06, 0.0)], lambda s: 0.05 * (1 - 0.6 * s), sides=5, colors=('#8a6a40', '#d8bf90')))
    r = np.random.default_rng(14)
    for i in range(8):
        a = TAU * i / 8 + r.uniform(-0.15, 0.15)
        m.add(blade(r.uniform(0.4, 0.5), 0.24, ovate, segs=6, cols=5, fold=0.15, rise=0.2, droop=0.5, colors=('#2e5a28', '#6aa848'), wave=0.3, wave_n=5).xf(rz(a), (0, 0, 0.05)))
    for i in range(5):
        a = TAU * i / 5 + r.uniform(-0.2, 0.2)
        F = np.array([0.06 * math.cos(a), 0.06 * math.sin(a), 0.14])
        bell = lathe([(0.015, 0), (0.05, 0.03), (0.065, 0.09), (0.09, 0.13)], sides=8, colors=('#9a7ad0', '#ece0ff'), close_top=False)
        m.add(bell.xf(ry(0.5) @ rz(a), F))
    for i in range(3):
        a = TAU * i / 3 + 1.0
        m.add(blob(0.07, 0.07, 0.066, seg=7, rings=5, colors=('#d08a10', '#ffd050')).xf(None, (0.17 * math.cos(a), 0.17 * math.sin(a), 0.13)))
    return m, None


def water_lily():
    """Nymphaea alba, the white water lily, on its own bit of dark pool: notched round pads and a cup of pointed petals."""
    m = Model('meditation_lotus')
    pool = lathe([(0.0, 0.0), (0.46, 0.0), (0.5, 0.01)], sides=18, colors=('#1a2a3a', '#2a4a5a'), close_top=False)
    m.add(pool)
    m.add(lathe([(0.48, -0.01), (0.54, 0.02), (0.5, 0.03)], sides=18, colors=('#3a3a2a', '#5a5a3a'), close_top=False))  # a muddy lip
    r = np.random.default_rng(15)
    for i, (d, a, rr) in enumerate(((0.22, 0.4, 0.17), (0.26, 2.3, 0.15), (0.2, 4.2, 0.14), (0.32, 5.4, 0.1))):
        pad = lathe([(0.0, 0.0)] + [(rr * u, 0.0) for u in (0.5, 1.0)], sides=14, colors=('#2a6a34', '#6ab05a'), close_top=False)
        keep = [k for k in range(len(pad.f))]
        pad.v[:, 2] = 0.015 + 0.01 * (np.hypot(pad.v[:, 0], pad.v[:, 1]) / rr)
        # the notch: drop the faces of one wedge
        pad.f = [f for j, f in enumerate(pad.f) if (j % 14) != 0]
        m.add(pad.xf(rz(a + 1.2), (d * math.cos(a), d * math.sin(a), 0)))
    F = np.array([0.02, -0.03, 0.04])
    for ring, (n, L, rise, cols) in enumerate(((8, 0.22, 0.35, ('#c8b8a8', '#ffffff')), (8, 0.19, 0.75, ('#e0c8d8', '#fff4fa')), (6, 0.15, 1.1, ('#f0c0d8', '#fff0f6')))):
        for k in range(n):
            a = TAU * k / n + ring * 0.4
            P = blade(L, 0.085, lanceolate, segs=3, cols=3, fold=0.2, cup=0.1, rise=rise, droop=0.25, colors=cols)
            P.glow = ring == 2
            m.add(P.xf(rz(a), F))
    m.add(blob(0.055, 0.055, 0.045, seg=6, rings=3, colors=('#e0a010', '#ffe060')).xf(None, F + [0, 0, 0.04]))
    return m, '#ffc8e0'


def self_heal():
    """Prunella vulgaris, self-heal or heal-all: a low mat of leaves and stubby heads of hooded purple flowers."""
    m = Model('healing_herb')
    r = np.random.default_rng(16)
    for i in range(10):
        a = TAU * i / 10 + r.uniform(-0.2, 0.2)
        m.add(blade(0.22, 0.11, ovate, segs=3, cols=3, fold=0.2, rise=0.15, droop=0.45, colors=('#2c6a34', '#6ab05a')).xf(rz(a), (0, 0, 0.03)))
    for i in range(5):
        a = TAU * i / 5 + r.uniform(-0.3, 0.3)
        d = r.uniform(0.06, 0.2); h = r.uniform(0.26, 0.38)
        top = np.array([d * math.cos(a), d * math.sin(a), h])
        m.add(tube([(0, 0, 0.02), top * [0.5, 0.5, 0.5], top], 0.016, sides=4, colors=('#3a5a2a', '#6a3a5a')))
        for sgn in (-1, 1):
            m.add(blade(0.12, 0.06, ovate, segs=2, cols=3, fold=0.2, rise=0.3, droop=0.4, colors=('#2c6a34', '#6ab05a')).xf(rz(a + sgn * 1.57), top * [0.5, 0.5, 0.5]))
        # the head: a squat cylinder of brownish bracts studded with purple hoods
        m.add(lathe([(0.03, 0), (0.045, 0.02), (0.045, 0.1), (0.03, 0.13)], sides=7, colors=('#5a3a3a', '#9a6a6a')).xf(None, top))
        for k in range(8):
            ka = TAU * k / 8 + (k % 2) * 0.4
            z = 0.02 + 0.09 * ((k % 4) / 3)
            m.add(blob(0.022, 0.018, 0.03, seg=5, rings=3, colors=('#6a4ab8', '#c8a8ff')).xf(ry(-0.6) @ rz(ka), top + [0.05 * math.cos(ka), 0.05 * math.sin(ka), z]))
    return m, None


def dandelion():
    """Taraxacum officinale: a rosette of toothed leaves, sunny heads on hollow stalks, and one clock gone to seed."""
    m = Model('regen_root')
    r = np.random.default_rng(17)
    toothed = lambda s: (0.45 + 0.55 * abs(math.sin(s * math.pi * 3.5))) * math.sin(math.pi * min(1, s * 0.85 + 0.12)) ** 0.7
    for i in range(9):
        a = TAU * i / 9 + r.uniform(-0.2, 0.2)
        m.add(blade(r.uniform(0.34, 0.42), 0.13, toothed, segs=6, cols=3, fold=0.18, rise=0.25, droop=0.5, colors=('#2e6a2a', '#78b84a')).xf(rz(a), (0, 0, 0.02)))
    heads = [(0.5, 0.05, 0.2), (2.6, 0.08, 0.27), (4.4, 0.1, 0.4)]
    for i, (a, d, h) in enumerate(heads):
        top = np.array([d * math.cos(a), d * math.sin(a), h])
        m.add(tube([(0, 0, 0.02), top * [0.5, 0.5, 0.6], top], 0.012, sides=4, colors=('#6a8a3a', '#c0d080')))
        if i == 2:  # the clock
            ck = blob(0.085, 0.085, 0.085, seg=9, rings=6, colors=('#d8d8d0', '#ffffff'))
            m.add(ck.xf(None, top + [0, 0, 0.06]))
            continue
        for k in range(14):  # ray florets in two rings
            ka = TAU * k / 14
            for ring, (L, rise) in enumerate(((0.07, 0.15), (0.05, 0.6))):
                P = blade(L, 0.022, linear, segs=2, cols=3, fold=0.0, rise=rise, droop=0.2, colors=('#e8a810', '#ffe040'))
                m.add(P.xf(rz(ka + ring * 0.22), top + [0, 0, 0.005 + 0.01 * ring]))
        m.add(lathe([(0.02, -0.03), (0.035, -0.005), (0.03, 0.005)], sides=7, colors=('#4a7a2a', '#7aaa4a'), close_top=False).xf(None, top))
    return m, None


def clover():
    """Trifolium repens, white clover: a patch of trefoils on stalks, round white heads, and one four-leaved."""
    m = Model('cleansing_clover')
    r = np.random.default_rng(18)
    for i in range(12):
        a = r.uniform(0, TAU)
        d = r.uniform(0.0, 0.2); h = r.uniform(0.14, 0.26)
        top = np.array([d * math.cos(a), d * math.sin(a), h])
        m.add(tube([(top[0] * 0.6, top[1] * 0.6, 0.01), top], 0.008, sides=3, colors=STEM))
        nleaf = 4 if i == 3 else 3
        spin = r.uniform(0, TAU)
        for k in range(nleaf):
            m.add(blade(0.09, 0.09, spoon, segs=3, cols=3, fold=0.12, rise=0.05, droop=0.15, colors=('#2e6a2a', '#7cc04f')).xf(rz(spin + TAU * k / nleaf), top))
    for i in range(4):
        a = TAU * i / 4 + r.uniform(-0.3, 0.3)
        d = r.uniform(0.06, 0.18); h = r.uniform(0.3, 0.38)
        top = np.array([d * math.cos(a), d * math.sin(a), h])
        m.add(tube([(top[0] * 0.5, top[1] * 0.5, 0.01), top], 0.009, sides=3, colors=STEM))
        m.add(blob(0.048, 0.048, 0.034, seg=7, rings=4, colors=('#d8b0b8', '#fff8f8'), jitter=0.2, seed=i).xf(None, top + [0, 0, 0.025]))
    return m, None


# ── The cottage pots ───────────────────────────────────────────────────────
POT_TOP = 0.34


def terracotta(m, r=0.2):
    """A chunky terracotta pot with a rolled rim and a disc of dark soil."""
    m.add(lathe([(r * 0.78, 0.0), (r * 0.82, 0.02), (r * 0.98, 0.27), (r * 1.0, 0.28)], sides=12, colors=('#8a4a30', '#d4906a'), close_bottom=True, close_top=False))
    m.add(lathe([(r * 1.0, 0.28), (r * 1.14, 0.285), (r * 1.16, 0.31), (r * 1.14, 0.345), (r * 1.0, 0.35), (r * 0.94, 0.34)], sides=12, colors=('#a85e3c', '#e8a47a'), close_top=False))
    m.add(lathe([(r * 0.94, POT_TOP), (0.0, POT_TOP - 0.005)], sides=12, colors=('#2a1a10', '#4a3020'), close_top=False))


def chamomile_flower(m, F, size, tilt_dir):
    """Matricaria: a ring of white rays round a raised golden dome."""
    R = look_rot(tilt_dir)
    up = R @ ry(-math.pi / 2)  # local +Z of the flower along tilt_dir
    for k in range(11):
        P = blade(size, size * 0.32, linear, segs=2, cols=3, fold=0.0, rise=-0.15, droop=0.35, colors=('#e8e2d4', '#ffffff'))
        m.add(P.xf(up @ rz(TAU * k / 11), F))
    m.add(blob(size * 0.38, size * 0.38, size * 0.34, seg=7, rings=4, colors=('#e09a10', '#ffd84a')).xf(up, F + up @ [0, 0, size * 0.08]))


def pot_chamomile():
    m = Model('pot_chamomile')
    terracotta(m)
    r = np.random.default_rng(21)
    for i in range(9):
        a = r.uniform(0, TAU); d = r.uniform(0.0, 0.12); h = r.uniform(0.75, 1.0)
        top = np.array([d * 1.4 * math.cos(a), d * 1.4 * math.sin(a), h])
        base = np.array([d * 0.5 * math.cos(a), d * 0.5 * math.sin(a), POT_TOP])
        mid = (base + top) / 2 + [0.02 * math.cos(a + 1), 0.02 * math.sin(a + 1), 0]
        m.add(tube([base, mid, top], 0.011, sides=4, colors=STEM))
        for k in range(4):  # thread-fine leaves
            z = POT_TOP + 0.05 + 0.1 * k
            if z > h - 0.1:
                break
            p = base + (top - base) * ((z - POT_TOP) / (h - POT_TOP))
            m.add(blade(0.12, 0.03, linear, segs=2, cols=3, fold=0.2, rise=0.5, droop=0.6, colors=('#4a8a3a', '#9ad070')).xf(rz(a + k * 2.1), p))
        chamomile_flower(m, top, 0.07, (math.cos(a) * 0.4, math.sin(a) * 0.4, 1))
    return m, None


def pot_lavender():
    m = Model('pot_lavender')
    terracotta(m)
    r = np.random.default_rng(22)
    for i in range(22):  # the grey-green mound of narrow leaves
        a = r.uniform(0, TAU)
        m.add(blade(r.uniform(0.18, 0.26), 0.035, linear, segs=3, cols=3, fold=0.3, rise=1.1, droop=1.0, colors=('#5a7a5a', '#a8c0a0')).xf(rz(a), (0.04 * math.cos(a), 0.04 * math.sin(a), POT_TOP)))
    for i in range(11):
        a = TAU * i / 11 + r.uniform(-0.2, 0.2); lean = r.uniform(0.08, 0.2); h = r.uniform(0.85, 1.02)
        top = np.array([lean * math.cos(a), lean * math.sin(a), h])
        base = np.array([0.02 * math.cos(a), 0.02 * math.sin(a), POT_TOP])
        m.add(tube([base, base + (top - base) * 0.5 + [0, 0, 0.02], top], 0.007, sides=3, colors=('#6a8a5a', '#9ab08a')))
        d = (top - base) / np.linalg.norm(top - base)
        for k in range(6):  # whorls of purple buds up the spike
            p = top - d * (0.025 * k)
            w = 0.028 * (1 - 0.08 * k)
            m.add(blob(w, w, w * 1.15, seg=5, rings=3, colors=('#6a3ab0', '#b890ff')).xf(None, p))
    return m, None


def pot_calendula():
    m = Model('pot_calendula')
    terracotta(m)
    r = np.random.default_rng(23)
    for i in range(9):
        a = TAU * i / 9 + r.uniform(-0.2, 0.2)
        m.add(blade(r.uniform(0.24, 0.3), 0.1, spoon, segs=4, cols=3, fold=0.2, rise=0.6, droop=0.9, colors=('#3a7a34', '#8ac860')).xf(rz(a), (0.03 * math.cos(a), 0.03 * math.sin(a), POT_TOP + 0.02)))
    for i in range(5):
        a = TAU * i / 5 + r.uniform(-0.3, 0.3); d = r.uniform(0.06, 0.15); h = r.uniform(0.62, 0.8)
        top = np.array([d * math.cos(a), d * math.sin(a), h])
        m.add(tube([(0, 0, POT_TOP), top * [0.5, 0.5, 1] + [0, 0, -0.15], top], 0.012, sides=4, colors=STEM))
        m.add(blade(0.12, 0.05, spoon, segs=2, cols=3, fold=0.2, rise=0.5, droop=0.6, colors=('#3a7a34', '#8ac860')).xf(rz(a + 1.3), top - [0, 0, 0.14]))
        up = look_rot((math.cos(a) * 0.35, math.sin(a) * 0.35, 1)) @ ry(-math.pi / 2)
        for ring, (n, L, rise, cols) in enumerate(((14, 0.1, -0.05, ('#e0601a', '#ff9a30')), (12, 0.08, 0.35, ('#e8701a', '#ffb040')), (9, 0.06, 0.8, ('#f08020', '#ffc050')))):
            for k in range(n):
                P = blade(L, 0.035, spoon, segs=2, cols=3, fold=0.05, rise=rise, droop=0.2, colors=cols)
                m.add(P.xf(up @ rz(TAU * k / n + ring * 0.3), top))
        m.add(blob(0.028, 0.028, 0.02, seg=6, rings=3, colors=('#7a3a10', '#b06020')).xf(up, top + up @ [0, 0, 0.02]))
    return m, None


def pot_mugwort():
    m = Model('pot_mugwort')
    terracotta(m)
    r = np.random.default_rng(24)
    cut = lambda s: (0.35 + 0.65 * abs(math.sin(s * math.pi * 2.5))) * math.sin(math.pi * min(1, s * 0.9 + 0.08)) ** 0.8
    for i in range(6):
        a = TAU * i / 6 + r.uniform(-0.2, 0.2); lean = r.uniform(0.04, 0.12); h = r.uniform(0.9, 1.05)
        top = np.array([lean * math.cos(a), lean * math.sin(a), h])
        base = np.array([0.02 * math.cos(a), 0.02 * math.sin(a), POT_TOP])
        m.add(tube([base, (base + top) / 2, top], 0.016, sides=4, colors=('#6a4a3a', '#9a7060')))  # mugwort's purplish stems
        for k in range(6):
            t_ = 0.08 + 0.14 * k
            p = base + (top - base) * t_
            m.add(blade(0.2 * (1 - 0.5 * t_), 0.1 * (1 - 0.4 * t_), cut, segs=4, cols=3, fold=0.2, rise=0.4, droop=0.9, colors=('#3a5a3a', '#b8c8b4')).xf(rz(a + k * 2.4), p))
        for k in range(10):  # the panicle of tiny buds
            p = top - [0, 0, 0.012 * k] + [0.03 * math.cos(k * 2.3), 0.03 * math.sin(k * 2.3), 0]
            m.add(blob(0.013, 0.013, 0.016, seg=5, rings=3, colors=('#9a7a5a', '#d8c0a0')).xf(None, p))
    return m, None


def pot_yarrow():
    """Achillea millefolium hung up to dry: a bunch tied with twine on a peg, the flat white heads hanging down."""
    m = Model('pot_yarrow')
    TOP = 1.0
    m.add(tube([(0, -0.05, TOP + 0.04), (0, 0.05, TOP + 0.04)], 0.018, sides=6, colors=('#4a3018', '#7a5430')))  # the peg
    loop = [(0.04 * math.sin(u), 0.0, TOP + 0.04 - 0.05 * (1 - math.cos(u)) * 0.6) for u in np.linspace(-math.pi, math.pi, 12)]
    m.add(tube(loop, 0.006, sides=4, colors=('#8a6a3a', '#c8a86a')))
    m.add(lathe([(0.045, TOP - 0.1), (0.05, TOP - 0.08), (0.05, TOP - 0.03), (0.045, TOP - 0.01)], sides=8, colors=('#8a6a3a', '#c8a86a'), close_top=False))  # the binding
    r = np.random.default_rng(25)
    for i in range(10):
        a = TAU * i / 10 + r.uniform(-0.2, 0.2); spread = r.uniform(0.08, 0.17); L = r.uniform(0.55, 0.7)
        p0 = np.array([0.02 * math.cos(a), 0.02 * math.sin(a), TOP + 0.04])
        end = np.array([spread * math.cos(a), spread * math.sin(a) * 0.6, TOP - L])
        m.add(tube([p0, p0 + (end - p0) * 0.4, end], 0.012, sides=4, colors=('#8a9a6a', '#6a7a4a')))
        for k in range(3):  # feathery dried leaves along the stem
            p = p0 + (end - p0) * (0.3 + 0.18 * k)
            m.add(blade(0.14, 0.05, lanceolate, segs=2, cols=3, fold=0.2, rise=-1.0, droop=0.4, colors=('#7a8a5a', '#aab88a'), wave=0.4, wave_n=3).xf(rz(a + k * 2), p))
        m.add(blob(0.06, 0.06, 0.022, seg=8, rings=3, colors=('#e8e2cc', '#c8c0a8')).xf(None, end - [0, 0, 0.012]))  # the flat head (corymb), face down
        for k in range(9):
            ka = TAU * k / 9
            q = end + [0.05 * math.cos(ka), 0.05 * math.sin(ka), -0.028]
            m.add(blob(0.018, 0.018, 0.012, seg=4, rings=2, colors=('#d8d2bc', '#fbf8ee')).xf(None, q))
    return m, None


def pot_belladonna():
    """Atropa belladonna: paired oval leaves, dull purple bells, and glossy black berries sat in green stars."""
    m = Model('pot_belladonna')
    terracotta(m)
    r = np.random.default_rng(26)
    for i in range(4):
        a = TAU * i / 4 + r.uniform(-0.3, 0.3); lean = r.uniform(0.1, 0.18); h = r.uniform(0.8, 0.95)
        top = np.array([lean * math.cos(a), lean * math.sin(a), h])
        base = np.array([0.02 * math.cos(a), 0.02 * math.sin(a), POT_TOP])
        m.add(tube([base, (base + top) / 2 + [0, 0, 0.03], top], 0.016, sides=5, colors=('#3a4a2a', '#6a5a3a')))
        for k in range(4):
            t_ = 0.25 + 0.2 * k
            p = base + (top - base) * t_
            for big, sgn in ((1.0, 1), (0.55, -1)):  # the big-and-little pairs belladonna is known by
                m.add(blade(0.24 * big, 0.13 * big, ovate, segs=4, cols=3, fold=0.18, rise=0.25, droop=0.7, colors=('#2a5a2a', '#6aa050')).xf(rz(a + sgn * 1.4 + k * 0.7), p))
            ka = a + k * 1.7
            q = p + [0.07 * math.cos(ka), 0.07 * math.sin(ka), -0.03]
            if k % 2 == 0:  # a nodding bell
                bell = lathe([(0.012, 0), (0.03, 0.02), (0.04, 0.06), (0.05, 0.075)], sides=8, colors=('#4a2030', '#9a5a6a'), close_top=False)
                m.add(bell.xf(ry(math.pi * 0.85) @ rz(ka), q + [0, 0, 0.06]))
            else:  # a berry in its star
                for j in range(5):
                    m.add(blade(0.045, 0.025, lanceolate, segs=2, cols=3, fold=0.1, rise=0.2, droop=0.3, colors=('#3a6a2a', '#7aaa4a')).xf(rz(TAU * j / 5), q))
                m.add(blob(0.034, 0.034, 0.032, seg=8, rings=5, colors=('#0a0610', '#4a3a5a')).xf(None, q + [0, 0, 0.03]))
    return m, None


def pot_rosemary():
    """The plain potted herb: rosemary, woody stems thick with needles and a few pale blue flowers."""
    m = Model('pot_herb')
    terracotta(m)
    r = np.random.default_rng(27)
    for i in range(9):
        a = TAU * i / 9 + r.uniform(-0.2, 0.2); lean = r.uniform(0.1, 0.24); h = r.uniform(0.75, 0.98)
        top = np.array([lean * math.cos(a), lean * math.sin(a), h])
        base = np.array([0.02 * math.cos(a), 0.02 * math.sin(a), POT_TOP])
        m.add(tube([base, (base + top) / 2, top], lambda s: 0.02 * (1 - 0.6 * s), sides=4, colors=('#5a4028', '#7a6a40')))
        for k in range(11):
            t_ = 0.12 + 0.08 * k
            p = base + (top - base) * t_
            for j in range(4):
                m.add(blade(0.09 * (1 - 0.3 * t_), 0.03, linear, segs=1, cols=3, fold=0.3, rise=0.75, droop=0.2, colors=('#2e5a3a', '#8ab89a')).xf(rz(a + k * 1.3 + TAU * j / 4), p))
            if k in (5, 8) and i % 2 == 0:
                m.add(blob(0.016, 0.016, 0.014, seg=5, rings=3, colors=('#6a8ad0', '#c0d0ff')).xf(None, p + [0.03 * math.cos(a + k), 0.03 * math.sin(a + k), 0]))
    return m, None


PLANTS = {
    'swift_root': carrot, 'featherleaf': fern, 'giants_cap': parasol, 'shrinking_violet': violet,
    'pumpkin_blossom': pumpkin, 'bats_breath': bat_flower, 'rainbow_petal': heartsease, 'ravens_feather_plant': hellebore,
    'stumbleweed': darnel, 'gibberish_root': mandrake, 'toadstool': fly_agaric, 'wolfsbane_bloom': monkshood,
    'meditation_lotus': water_lily, 'healing_herb': self_heal, 'regen_root': dandelion, 'cleansing_clover': clover,
    'pot_herb': pot_rosemary, 'pot_chamomile': pot_chamomile, 'pot_lavender': pot_lavender, 'pot_calendula': pot_calendula,
    'pot_mugwort': pot_mugwort, 'pot_yarrow': pot_yarrow, 'pot_belladonna': pot_belladonna,
}

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    names = sys.argv[1:] or list(PLANTS)
    for n in names:
        m, glow = PLANTS[n]()
        if glow:
            for p in m.parts:
                pass
        path = os.path.abspath(os.path.join(OUT, n + '.glb'))
        m.export(path, glow_color=glow or '#ffffff')
        print(n, m.tris(), 'tris', os.path.getsize(path), 'bytes')
