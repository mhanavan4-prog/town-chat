"""The harmless creatures of the town and the Wilds, as the real animals they
are drawn from, with their joints as named nodes so the game can move them:
legs at the hip, wings at the shoulder, the head at the neck, the tail at its
root. Each is built facing +X and turned on export to face the game's forward.
Writes public/kk/critters/*.glb.

    sh tools/models/build.sh critters [name ...]
"""
import math, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from trlib import *  # noqa

OUT = os.path.join(os.path.dirname(__file__), '../../public/kk/critters')


def glowing(p):
    p.glow = True
    return p


def eye(m, p, r, iris=('#0a0808', '#2a2020'), shine=True, look=(1, 0, 0)):
    m.add(blob(r, r, r, seg=7, rings=5, colors=iris).xf(None, p))
    if shine:
        d = np.asarray(look, float); d = d / np.linalg.norm(d)
        m.add(blob(r * 0.32, r * 0.32, r * 0.32, seg=5, rings=3, colors=('#ffffff', '#ffffff')).xf(None, np.asarray(p) + d * r * 0.7 + [0, 0, r * 0.45]))


def leg(path, r0, r1, colors, sides=6):
    return tube(path, lambda s: r0 + (r1 - r0) * s, sides=sides, colors=colors)


# ── European rabbit ────────────────────────────────────────────────────────
def rabbit():
    """Oryctolagus cuniculus: agouti brown above, pale beneath, long ears, the white scut."""
    m = Model('rabbit', forward_x=True)
    FUR = ('#e6d8c2', '#8a6a48')   # pale belly up to the brown back
    m.add(blob(0.36, 0.26, 0.26, seg=10, rings=7, colors=FUR).xf(ry(0.15), (-0.05, 0, 0.3)))   # the body
    m.add(blob(0.24, 0.27, 0.27, seg=9, rings=6, colors=FUR).xf(None, (-0.24, 0, 0.27)))         # the round haunches
    with m.node('head', (0.24, 0, 0.46)):
        m.add(blob(0.17, 0.15, 0.15, seg=9, rings=6, colors=FUR).xf(ry(-0.2), (0.34, 0, 0.55)))
        m.add(blob(0.09, 0.09, 0.08, seg=7, rings=5, colors=('#eadfcf', '#b89a78')).xf(None, (0.47, 0, 0.5)))  # muzzle
        m.add(blob(0.022, 0.03, 0.02, seg=5, rings=3, colors=('#c88a8a', '#e8a8a8')).xf(None, (0.555, 0, 0.53)))  # nose
        for sgn in (-1, 1):
            eye(m, (0.42, sgn * 0.11, 0.6), 0.035, look=(0.4, sgn, 0))
    for sgn, nm in ((-1, 'ear_R'), (1, 'ear_L')):
        with m.node(nm, (0.3, sgn * 0.06, 0.68)):
            ear = blob(0.06, 0.025, 0.2, seg=7, rings=5, colors=('#8a6a48', '#a88a66'))
            m.add(ear.xf(rx(sgn * -0.18) @ ry(-0.35), (0.27, sgn * 0.08, 0.86)))
            m.add(blob(0.045, 0.01, 0.15, seg=6, rings=4, colors=('#d8a8a0', '#e8c0b8')).xf(rx(sgn * -0.18) @ ry(-0.35), (0.285, sgn * 0.065, 0.86)))
    for sgn, nm in ((-1, 'leg_BR'), (1, 'leg_BL')):
        with m.node(nm, (-0.24, sgn * 0.16, 0.24)):
            m.add(blob(0.15, 0.08, 0.15, seg=8, rings=5, colors=FUR).xf(None, (-0.22, sgn * 0.17, 0.2)))  # thigh
            m.add(blob(0.15, 0.05, 0.04, seg=7, rings=4, colors=('#d8cbb6', '#b89a78')).xf(None, (-0.12, sgn * 0.17, 0.04)))  # the long foot
    for sgn, nm in ((-1, 'leg_FR'), (1, 'leg_FL')):
        with m.node(nm, (0.16, sgn * 0.1, 0.22)):
            m.add(leg([(0.16, sgn * 0.1, 0.22), (0.2, sgn * 0.1, 0.1), (0.23, sgn * 0.1, 0.02)], 0.04, 0.032, ('#d8cbb6', '#a88a66')))
            m.add(blob(0.05, 0.035, 0.025, seg=6, rings=3, colors=('#e6dccb', '#c8b8a0')).xf(None, (0.25, sgn * 0.1, 0.02)))
    with m.node('tail', (-0.42, 0, 0.36)):
        m.add(blob(0.075, 0.08, 0.08, seg=7, rings=5, colors=('#ffffff', '#f2ede4'), jitter=0.1).xf(None, (-0.47, 0, 0.4)))
    return m, None


# ── Garden tiger moth ──────────────────────────────────────────────────────
def embermoth():
    """Arctia caja, the garden tiger: chocolate forewings broken with cream, orange hindwings spotted blue-black."""
    m = Model('embermoth', forward_x=True)
    m.add(blob(0.13, 0.11, 0.11, seg=8, rings=6, colors=('#4a2a1a', '#8a4a2a')).xf(None, (0.05, 0, 0.5)))  # fuzzy thorax
    ab = lathe([(0.0, 0), (0.07, 0.04), (0.095, 0.14), (0.085, 0.28), (0.05, 0.38), (0.0, 0.42)], sides=8, colors=('#3a1a10', '#e06a20'), close_top=False)
    for idx in range(len(ab.v)):  # banded: alternate rings dark
        ring = idx // 8
        if ring in (2, 4):
            ab.t[idx] = 0.15
    m.add(ab.xf(ry(-math.pi / 2 - 0.15), (-0.03, 0, 0.5)))  # the abdomen, banded orange and black
    m.add(blob(0.075, 0.08, 0.075, seg=7, rings=5, colors=('#3a2216', '#6a3a22')).xf(None, (0.2, 0, 0.52)))  # head
    m.add(blob(0.07, 0.11, 0.03, seg=6, rings=3, colors=('#c02a1a', '#ff5a2a')).xf(None, (0.13, 0, 0.6)))  # the red collar
    for sgn in (-1, 1):
        eye(m, (0.25, sgn * 0.045, 0.54), 0.03, iris=('#0a0a0a', '#1a1a1a'), look=(1, sgn * 0.5, 0))
        pts = [(0.25, sgn * 0.03, 0.58), (0.33, sgn * 0.09, 0.72), (0.38, sgn * 0.16, 0.8)]
        m.add(tube(pts, 0.008, sides=3, colors=('#2a1a10', '#4a3020')))  # feathery antennae
        for k in range(5):
            q = np.array(pts[1]) * (1 - k / 5) + np.array(pts[2]) * (k / 5)
            m.add(blade(0.05, 0.012, linear, segs=1, cols=3, fold=0, rise=0.3, droop=0, colors=('#3a2418', '#5a3a26')).xf(rz(sgn * 1.6), q))
    for sgn, nm in ((1, 'wing_L'), (-1, 'wing_R')):
        with m.node(nm, (0.05, sgn * 0.08, 0.55)):
            R = rz(sgn * math.pi / 2)
            fore = blade(0.62, 0.36, lambda s: math.sin(math.pi * min(1, s * 0.9 + 0.08)) ** 0.5 * (0.7 + 0.5 * s), segs=6, cols=5, fold=0.02, rise=0.1, droop=0.15, colors=('#3a2214', '#6a4024'))
            m.add(fore.xf(rz(sgn * 0.45) @ R @ rx(0), (0.06, sgn * 0.06, 0.56)))
            # the cream lacing over the chocolate
            for (u, w, r_) in ((0.15, 0.06, 0.05), (0.3, -0.05, 0.06), (0.45, 0.08, 0.05), (0.5, -0.1, 0.045), (0.28, 0.14, 0.04)):
                p = np.array([0.06, sgn * 0.06, 0.575]) + rz(sgn * 0.45) @ (R @ np.array([u * 0.62, w * 0.62, 0.02 + 0.05 * u]))
                m.add(blob(r_, r_ * 0.8, 0.008, seg=6, rings=3, colors=('#e8dcc0', '#fff6e0')).xf(rz(sgn * 0.45) @ R, p))
            hind = blade(0.45, 0.36, round_, segs=5, cols=5, fold=0.02, rise=0.05, droop=0.1, colors=('#c0400a', '#ff8a2a'))
            hind.glow = True
            m.add(hind.xf(rz(sgn * 1.3) @ R, (-0.02, sgn * 0.06, 0.53)))
            for (u, w) in ((0.45, 0.0), (0.7, 0.15), (0.65, -0.18)):
                p = np.array([-0.02, sgn * 0.06, 0.545]) + rz(sgn * 1.3) @ (R @ np.array([u * 0.45, w * 0.45, 0.02 + 0.03 * u]))
                m.add(blob(0.045, 0.04, 0.008, seg=6, rings=3, colors=('#14142a', '#2a2a5a')).xf(rz(sgn * 1.3) @ R, p))
    for k, x in enumerate((0.1, 0.03, -0.04)):  # six little legs tucked under
        for sgn in (-1, 1):
            with m.node('leg_%s%d' % ('L' if sgn > 0 else 'R', k), (x, sgn * 0.05, 0.44)):
                m.add(tube([(x, sgn * 0.05, 0.44), (x + 0.03, sgn * 0.12, 0.36), (x + 0.05, sgn * 0.14, 0.3)], 0.01, sides=3, colors=('#2a1a10', '#4a2a18')))
    return m, '#ff7a1a'


# ── Hedgehog ───────────────────────────────────────────────────────────────
def hedgehog():
    """Erinaceus europaeus: a hump of cream-tipped spines, a pointed face, a wet black nose."""
    m = Model('thistlehog', forward_x=True)
    m.add(blob(0.36, 0.27, 0.2, seg=10, rings=6, colors=('#c8a888', '#8a6a4a')).xf(None, (0, 0, 0.2)))  # the body under the spines
    r = np.random.default_rng(31)
    # spines: rows over the dome, pointing back and out
    for i in range(9):
        th = 0.15 + 1.35 * i / 8                  # from the crown down the flanks
        n = 9 + i * 2
        for k in range(n):
            ph = math.pi * (0.06 + 0.88 * k / max(1, n - 1)) - math.pi / 2  # back half-dome, front stays bare
            # point on an ellipsoid shell (front half kept for the face)
            x = -0.36 * math.sin(th) * math.cos(ph) * 0.95 + 0.06
            y = 0.3 * math.sin(th) * math.sin(ph)
            z = 0.2 + 0.24 * math.cos(th)
            if x > 0.2:
                continue
            nrm = np.array([x / 0.36, y / 0.3, (z - 0.2) / 0.24]); nrm /= np.linalg.norm(nrm)
            d = nrm + np.array([-0.9, 0, 0.25]); d /= np.linalg.norm(d)
            L = r.uniform(0.13, 0.17)
            sp = lathe([(0.022, 0.0), (0.012, L * 0.7), (0.0, L)], sides=3, colors=('#3a2a1a', '#efe2c8'), close_top=False, phase=r.uniform(0, 1))
            m.add(sp.xf(look_rot(d, up=(0, 0, 1)) @ ry(-math.pi / 2), (x, y, z)))
    with m.node('head', (0.24, 0, 0.18)):
        m.add(blob(0.16, 0.13, 0.12, seg=9, rings=6, colors=('#d8bfa0', '#a07c58')).xf(ry(0.25), (0.33, 0, 0.16)))
        m.add(lathe([(0.075, 0), (0.05, 0.08), (0.02, 0.14)], sides=8, colors=('#a07c58', '#c8a888'), close_top=False).xf(ry(math.pi / 2 + 0.25), (0.42, 0, 0.13)))  # the snout
        m.add(blob(0.03, 0.035, 0.028, seg=6, rings=4, colors=('#050505', '#2a2a2a')).xf(None, (0.555, 0, 0.1)))  # the nose
        for sgn in (-1, 1):
            eye(m, (0.43, sgn * 0.075, 0.2), 0.028, look=(0.6, sgn, 0))
            m.add(blob(0.035, 0.012, 0.035, seg=6, rings=4, colors=('#8a6a4a', '#b89474')).xf(None, (0.33, sgn * 0.11, 0.27)))  # round ears
    for sgn, side in ((1, 'L'), (-1, 'R')):
        for fb, x in (('F', 0.18), ('B', -0.2)):
            with m.node('leg_' + fb + side, (x, sgn * 0.15, 0.08)):
                m.add(leg([(x, sgn * 0.15, 0.09), (x + 0.02, sgn * 0.17, 0.0)], 0.035, 0.03, ('#6a4a30', '#8a6a4a')))
                m.add(blob(0.04, 0.03, 0.015, seg=6, rings=3, colors=('#4a3020', '#6a4a30')).xf(None, (x + 0.03, sgn * 0.17, 0.01)))
    return m, None


# ── Roe deer fawn ──────────────────────────────────────────────────────────
def fawn():
    """Capreolus capreolus, a roe fawn: russet with rows of white spots, long legs, big ears and a black nose."""
    m = Model('duskfawn', forward_x=True)
    COAT = ('#e8d4b4', '#a8643a')
    m.add(blob(0.36, 0.17, 0.2, seg=10, rings=7, colors=COAT).xf(ry(0.05), (0, 0, 0.62)))   # the barrel
    m.add(blob(0.16, 0.16, 0.18, seg=8, rings=6, colors=COAT).xf(None, (-0.24, 0, 0.62)))   # rump
    m.add(blob(0.08, 0.13, 0.12, seg=7, rings=5, colors=('#ffffff', '#f2e8d8')).xf(None, (-0.36, 0, 0.66)))  # the pale rump patch
    for row, (yy, zz, n) in enumerate(((0.06, 0.8, 6), (0.12, 0.74, 6), (0.15, 0.66, 5))):  # the dappling, both flanks
        for k in range(n):
            x = -0.26 + 0.5 * k / max(1, n - 1) + 0.04 * (row % 2)
            for sgn in (-1, 1):
                m.add(blob(0.028, 0.008, 0.022, seg=6, rings=3, colors=('#fff8ec', '#ffffff')).xf(rz(0), (x, sgn * (yy + 0.03), zz + 0.02)))
    with m.node('head', (0.28, 0, 0.72)):
        m.add(tube([(0.26, 0, 0.7), (0.36, 0, 0.86), (0.42, 0, 0.98)], lambda s: 0.09 - 0.03 * s, sides=8, colors=('#c88a5a', '#a8643a')))  # neck
        m.add(blob(0.13, 0.095, 0.1, seg=9, rings=6, colors=('#c88a5a', '#a8643a')).xf(ry(0.35), (0.48, 0, 1.02)))
        m.add(blob(0.07, 0.06, 0.06, seg=7, rings=5, colors=('#d8b898', '#a87a58')).xf(ry(0.6), (0.59, 0, 0.96)))  # muzzle
        m.add(blob(0.035, 0.04, 0.03, seg=6, rings=4, colors=('#050505', '#2a2a2a')).xf(None, (0.645, 0, 0.955)))  # the black nose
        for sgn in (-1, 1):
            eye(m, (0.53, sgn * 0.075, 1.05), 0.032, look=(0.5, sgn, 0))
            ear = blob(0.05, 0.02, 0.13, seg=7, rings=5, colors=('#a8643a', '#c88a5a'))
            m.add(ear.xf(rx(sgn * -0.6) @ ry(-0.2), (0.43, sgn * 0.11, 1.15)))
            m.add(blob(0.035, 0.008, 0.09, seg=6, rings=4, colors=('#f2e2cc', '#ffffff')).xf(rx(sgn * -0.6) @ ry(-0.2), (0.44, sgn * 0.1, 1.15)))
    for sgn, side in ((1, 'L'), (-1, 'R')):
        for fb, x in (('F', 0.24), ('B', -0.24)):
            with m.node('leg_' + fb + side, (x, sgn * 0.09, 0.56)):
                knee = (x + (-0.04 if fb == 'B' else 0.01), sgn * 0.09, 0.28)
                m.add(leg([(x, sgn * 0.09, 0.58), knee, (x + 0.02, sgn * 0.09, 0.04)], 0.055 if fb == 'B' else 0.045, 0.025, ('#6a4028', '#a8643a')))
                m.add(lathe([(0.032, 0), (0.028, 0.05)], sides=6, colors=('#1a1410', '#3a2a20'), close_bottom=True, close_top=False).xf(None, (x + 0.02, sgn * 0.09, 0.0)))  # hooves
    with m.node('tail', (-0.36, 0, 0.75)):
        m.add(blob(0.04, 0.035, 0.05, seg=6, rings=4, colors=('#f2e8d8', '#a8643a')).xf(None, (-0.39, 0, 0.74)))
    return m, None


# ── Moorhen ────────────────────────────────────────────────────────────────
def moorhen():
    """Gallinula chloropus: slate body, olive-brown back, a white line on the flank, red shield and yellow-tipped bill, green legs."""
    m = Model('mirefowl', forward_x=True)
    m.add(blob(0.3, 0.19, 0.2, seg=10, rings=7, colors=('#2a2e3a', '#4a4a4a')).xf(ry(0.15), (0, 0, 0.42)))  # body
    for sgn in (-1, 1):
        m.add(tube([(0.12, sgn * 0.18, 0.44), (-0.05, sgn * 0.2, 0.42), (-0.2, sgn * 0.17, 0.44)], 0.014, sides=4, colors=('#f2f2ee', '#ffffff')))  # the white flank line
    with m.node('wing_L', (0.08, 0.15, 0.5)):
        m.add(blob(0.24, 0.05, 0.12, seg=8, rings=5, colors=('#4a4030', '#6a5a3a')).xf(ry(0.2), (-0.04, 0.16, 0.5)))
    with m.node('wing_R', (0.08, -0.15, 0.5)):
        m.add(blob(0.24, 0.05, 0.12, seg=8, rings=5, colors=('#4a4030', '#6a5a3a')).xf(ry(0.2), (-0.04, -0.16, 0.5)))
    with m.node('tail', (-0.24, 0, 0.5)):
        m.add(blade(0.16, 0.16, round_, segs=3, cols=3, fold=0.1, rise=0.7, droop=0.2, colors=('#1a1a22', '#2a2a32')).xf(rz(math.pi), (-0.24, 0, 0.5)))
        for sgn in (-1, 1):  # the white undertail, flicked up
            m.add(blob(0.06, 0.035, 0.05, seg=6, rings=4, colors=('#ffffff', '#f2f2ee')).xf(None, (-0.3, sgn * 0.04, 0.58)))
    with m.node('head', (0.2, 0, 0.56)):
        m.add(tube([(0.18, 0, 0.5), (0.26, 0, 0.62), (0.3, 0, 0.7)], lambda s: 0.07 - 0.015 * s, sides=8, colors=('#2a2e3a', '#3a3e4a')))
        m.add(blob(0.09, 0.075, 0.08, seg=8, rings=6, colors=('#22252e', '#3a3d48')).xf(None, (0.33, 0, 0.74)))
        m.add(blob(0.04, 0.03, 0.05, seg=6, rings=4, colors=('#b01a10', '#e83a20')).xf(ry(-0.3), (0.41, 0, 0.77)))  # frontal shield
        bill = lathe([(0.03, 0), (0.022, 0.06), (0.0, 0.1)], sides=6, colors=('#c8201a', '#ffd23a'), close_bottom=True, close_top=False)
        m.add(bill.xf(ry(math.pi / 2 + 0.2), (0.41, 0, 0.72)))
        for sgn in (-1, 1):
            eye(m, (0.37, sgn * 0.06, 0.77), 0.022, iris=('#8a0a0a', '#c82a1a'), look=(0.6, sgn, 0))
    for sgn, nm in ((1, 'leg_L'), (-1, 'leg_R')):
        with m.node(nm, (0.0, sgn * 0.08, 0.3)):
            m.add(leg([(0.0, sgn * 0.08, 0.3), (-0.02, sgn * 0.09, 0.16), (0.02, sgn * 0.09, 0.02)], 0.025, 0.016, ('#8aa02a', '#c8d040')))
            for a in (-0.5, 0, 0.5, math.pi):  # long toes
                L = 0.07 if a == math.pi else 0.14
                m.add(tube([(0.02, sgn * 0.09, 0.015), (0.02 + L * math.cos(a), sgn * 0.09 + L * math.sin(a), 0.01)], 0.01, sides=3, colors=('#8aa02a', '#a8b830')))
    return m, None


# ── Wild boar ──────────────────────────────────────────────────────────────
def boar():
    """Sus scrofa: high bristled shoulders, a long wedge of a head, the snout disc, small tusks, a tufted tail."""
    m = Model('bramble_boar', forward_x=True)
    HIDE = ('#3a3028', '#86705a')
    m.add(blob(0.44, 0.22, 0.25, seg=11, rings=7, colors=HIDE, jitter=0.04, seed=1).xf(ry(0.12), (-0.04, 0, 0.5)))
    m.add(blob(0.24, 0.23, 0.28, seg=9, rings=6, colors=HIDE, jitter=0.05, seed=2).xf(None, (0.2, 0, 0.56)))  # the shoulders
    r = np.random.default_rng(32)
    for k in range(18):  # the bristly mane down the spine
        x = 0.32 - 0.6 * k / 17
        h = 0.79 - 0.12 * (k / 17) ** 1.5
        for sgn in (-1, 1):
            m.add(blade(0.1 + r.uniform(0, 0.05), 0.04, linear, segs=2, cols=3, fold=0.2, rise=1.2, droop=0.8, colors=('#2a221a', '#8a7660')).xf(rz(math.pi + sgn * 0.5), (x, sgn * 0.02, h - 0.03)))
    with m.node('head', (0.36, 0, 0.56)):
        hd = lathe([(0.17, 0.0), (0.16, 0.12), (0.12, 0.26), (0.08, 0.38), (0.07, 0.42)], sides=9, colors=('#6a5a48', '#3a3028'), close_bottom=True, close_top=False)
        m.add(hd.xf(ry(math.pi / 2 + 0.35), (0.36, 0, 0.58)))
        m.add(lathe([(0.075, 0), (0.07, 0.03)], sides=9, colors=('#6a4a40', '#8a6a5a'), close_top=True).xf(ry(math.pi / 2 + 0.35), (0.36 + 0.42 * math.cos(0.35), 0, 0.58 - 0.42 * math.sin(0.35))))  # the snout disc
        for sgn in (-1, 1):
            eye(m, (0.5, sgn * 0.11, 0.6), 0.024, look=(0.6, sgn, 0.1))
            m.add(blob(0.04, 0.02, 0.09, seg=6, rings=4, colors=('#2a241e', '#4a3e32')).xf(rx(sgn * -0.4), (0.4, sgn * 0.12, 0.78)))  # pointed ears
            tusk = lathe([(0.016, 0), (0.0, 0.08)], sides=5, colors=('#d8d0b8', '#fff8e8'), close_bottom=True, close_top=False)
            m.add(tusk.xf(rx(sgn * 0.5) @ ry(-0.5), (0.68, sgn * 0.06, 0.4)))
    for sgn, side in ((1, 'L'), (-1, 'R')):
        for fb, x in (('F', 0.24), ('B', -0.3)):
            with m.node('leg_' + fb + side, (x, sgn * 0.12, 0.4)):
                m.add(leg([(x, sgn * 0.12, 0.42), (x + (0.02 if fb == 'F' else -0.03), sgn * 0.12, 0.2), (x + 0.02, sgn * 0.12, 0.04)], 0.07, 0.035, ('#1a1612', '#3a3028')))
                m.add(lathe([(0.04, 0), (0.036, 0.05)], sides=6, colors=('#0a0806', '#2a2420'), close_bottom=True, close_top=False).xf(None, (x + 0.02, sgn * 0.12, 0.0)))
    with m.node('tail', (-0.46, 0, 0.6)):
        m.add(tube([(-0.46, 0, 0.6), (-0.52, 0, 0.5), (-0.53, 0, 0.42)], 0.014, sides=4, colors=('#2a241e', '#3a3028')))
        m.add(blob(0.025, 0.025, 0.05, seg=5, rings=3, colors=('#1a1612', '#2a241e')).xf(None, (-0.53, 0, 0.4)))
    return m, None


# ── The mossback tortoise ──────────────────────────────────────────────────
def tortoise():
    """A tortoise old enough to have a garden on its back: a domed, plated shell grown over with moss, a fern and a toadstool."""
    m = Model('mossback_tortoise', forward_x=True)
    shell = lathe([(0.46, 0.12), (0.46, 0.16), (0.42, 0.3), (0.32, 0.42), (0.18, 0.49), (0.0, 0.51)], sides=14, colors=('#3a3020', '#7a6a3a'))
    m.add(shell.xf(None, (0, 0, 0)))
    m.add(lathe([(0.44, 0.08), (0.48, 0.12), (0.46, 0.14)], sides=14, colors=('#5a4a2a', '#8a7a4a'), close_top=False))  # the rim
    m.add(lathe([(0.0, 0.08), (0.44, 0.09)], sides=14, colors=('#c8b078', '#d8c088'), close_top=False).xf(rx(math.pi), (0, 0, 0.17)))  # the plastron
    for k, (a, rr) in enumerate([(0, 0)] + [(TAU * i / 6, 0.26) for i in range(6)]):  # raised scutes
        p = np.array([rr * math.cos(a), rr * math.sin(a), 0.0])
        z = 0.5 - 0.2 * (rr / 0.46) ** 2 * 1.8
        m.add(blob(0.11, 0.11, 0.035, seg=6, rings=3, colors=('#4a3e24', '#8a7a48')).xf(rz(a), p + [0, 0, z]))
    r = np.random.default_rng(33)
    for k in range(9):  # moss in cushions
        a = r.uniform(0, TAU); rr = r.uniform(0.0, 0.3)
        z = 0.51 - 0.32 * (rr / 0.46) ** 2 * 1.6
        m.add(blob(r.uniform(0.07, 0.12), r.uniform(0.07, 0.12), 0.04, seg=7, rings=3, colors=('#3a6a2a', '#8ac050'), jitter=0.2, seed=k).xf(None, (rr * math.cos(a), rr * math.sin(a), z + 0.02)))
    for k in range(5):  # a little fern
        m.add(blade(0.16, 0.05, lanceolate, segs=3, cols=3, fold=0.3, rise=1.0, droop=1.2, colors=('#3a7a34', '#8fd06a')).xf(rz(TAU * k / 5), (-0.08, 0.06, 0.5)))
    m.add(lathe([(0.012, 0.0), (0.012, 0.06)], sides=6, colors=('#e8e0cc', '#fff8ec'), close_top=False).xf(None, (0.1, -0.08, 0.5)))  # a toadstool
    m.add(lathe([(0.05, 0.06), (0.04, 0.08), (0.0, 0.095)], sides=8, colors=('#a01a10', '#e84a2a'), close_top=False).xf(None, (0.1, -0.08, 0.5)))
    SKIN = ('#5a5a3a', '#8a8a5a')
    with m.node('head', (0.42, 0, 0.18)):
        m.add(tube([(0.38, 0, 0.17), (0.5, 0, 0.2), (0.56, 0, 0.24)], 0.06, sides=7, colors=SKIN))
        m.add(blob(0.09, 0.075, 0.07, seg=8, rings=5, colors=SKIN).xf(ry(0.2), (0.62, 0, 0.26)))
        m.add(blob(0.04, 0.05, 0.02, seg=6, rings=3, colors=('#3a3a24', '#5a5a3a')).xf(None, (0.69, 0, 0.23)))  # the beak-mouth
        for sgn in (-1, 1):
            eye(m, (0.66, sgn * 0.055, 0.29), 0.02, look=(0.5, sgn, 0.2))
    for sgn, side in ((1, 'L'), (-1, 'R')):
        for fb, x in (('F', 0.26), ('B', -0.26)):
            with m.node('leg_' + fb + side, (x, sgn * 0.3, 0.14)):
                m.add(leg([(x, sgn * 0.3, 0.16), (x + 0.04, sgn * 0.38, 0.04)], 0.07, 0.06, SKIN, sides=7))
                for t_ in (-0.03, 0, 0.03):
                    m.add(blob(0.018, 0.018, 0.014, seg=5, rings=3, colors=('#d8d0b8', '#efe8d4')).xf(None, (x + 0.08, sgn * 0.38 + t_, 0.02)))
    with m.node('tail', (-0.44, 0, 0.14)):
        m.add(lathe([(0.04, 0), (0.0, 0.1)], sides=6, colors=SKIN, close_bottom=True, close_top=False).xf(ry(-math.pi / 2 - 0.3), (-0.44, 0, 0.14)))
    return m, None


# ── Carrion crow ───────────────────────────────────────────────────────────
def crow():
    """Corvus corone: black all over with a blue-violet sheen, a stout black bill, a squared-off tail."""
    m = Model('gravewing_crow', forward_x=True)
    INK = ('#0e0e14', '#3a2e58')
    m.add(blob(0.26, 0.15, 0.17, seg=10, rings=7, colors=INK).xf(ry(0.45), (0, 0, 0.42)))
    with m.node('head', (0.18, 0, 0.56)):
        m.add(blob(0.11, 0.095, 0.1, seg=9, rings=6, colors=INK).xf(None, (0.25, 0, 0.64)))
        bill = lathe([(0.045, 0), (0.03, 0.08), (0.0, 0.15)], sides=6, colors=('#0a0a0e', '#2a2a32'), close_bottom=True, close_top=False)
        m.add(bill.xf(ry(math.pi / 2 + 0.12), (0.33, 0, 0.63)))
        for sgn in (-1, 1):
            eye(m, (0.3, sgn * 0.07, 0.67), 0.02, iris=('#1a1210', '#3a2a20'), look=(0.5, sgn, 0))
    for sgn, nm in ((1, 'wing_L'), (-1, 'wing_R')):
        with m.node(nm, (0.08, sgn * 0.13, 0.5)):
            w = blade(0.42, 0.2, lambda s: math.sin(math.pi * min(1, s * 0.85 + 0.12)) ** 0.6 * (1.1 - 0.4 * s), segs=5, cols=3, fold=0.08, rise=-0.25, droop=0.25, colors=('#1a1624', '#40345e'))
            m.add(w.xf(rz(math.pi) @ rx(sgn * -0.25), (0.1, sgn * 0.14, 0.52)))
            for k in range(4):  # primaries, splayed a little
                m.add(blade(0.18, 0.05, lanceolate, segs=2, cols=3, fold=0.1, rise=-0.3, droop=0.2, colors=('#14121c', '#3a2e58')).xf(rz(math.pi - sgn * 0.1 * k) @ rx(sgn * -0.25), (-0.22, sgn * (0.15 + 0.012 * k), 0.4 - 0.01 * k)))
    with m.node('tail', (-0.22, 0, 0.34)):
        m.add(blade(0.26, 0.15, lambda s: 0.55 + 0.45 * s if s < 1 else 0.0, segs=3, cols=5, fold=0.05, rise=-0.45, droop=0.1, colors=('#14121c', '#3a2e58')).xf(rz(math.pi), (-0.22, 0, 0.34)))
    for sgn, nm in ((1, 'leg_L'), (-1, 'leg_R')):
        with m.node(nm, (0.0, sgn * 0.06, 0.28)):
            m.add(leg([(0.0, sgn * 0.06, 0.3), (0.01, sgn * 0.06, 0.14), (0.02, sgn * 0.06, 0.02)], 0.022, 0.016, ('#0a0a0e', '#2a2a30')))
            for a in (-0.45, 0, 0.45, math.pi):
                L = 0.06 if a == math.pi else 0.09
                m.add(tube([(0.02, sgn * 0.06, 0.015), (0.02 + L * math.cos(a), sgn * 0.06 + L * math.sin(a), 0.008)], 0.009, sides=3, colors=('#0a0a0e', '#2a2a30')))
    return m, None


# ── The dark's own: bat, rat, the rat king, spider, beetle, centipede, slug, adder ──
def bat():
    """A horseshoe bat, Rhinolophus: a furry russet body, great membranous wings on long fingers, big ears, the nose-leaf."""
    m = Model('bat', forward_x=True)
    FUR = ('#4a3a30', '#8a6a52')
    m.add(blob(0.14, 0.1, 0.1, seg=9, rings=6, colors=FUR).xf(None, (0, 0, 0.5)))
    with m.node('head', (0.12, 0, 0.52)):
        m.add(blob(0.075, 0.07, 0.07, seg=8, rings=5, colors=FUR).xf(None, (0.17, 0, 0.53)))
        m.add(blob(0.03, 0.035, 0.035, seg=6, rings=3, colors=('#6a4a40', '#a07a6a')).xf(None, (0.235, 0, 0.52)))  # the horseshoe nose-leaf
        for sgn in (-1, 1):
            m.add(blob(0.03, 0.012, 0.075, seg=6, rings=4, colors=('#4a3430', '#7a5a50')).xf(rx(sgn * -0.5) @ ry(-0.3), (0.15, sgn * 0.05, 0.62)))
            m.add(blob(0.012, 0.012, 0.012, seg=5, rings=3, colors=('#7a0a0a', '#ff3a2a')).xf(None, (0.22, sgn * 0.035, 0.55)))  # eyes that catch the light
    memb = lambda s: math.sin(math.pi * min(1, s * 0.95 + 0.04)) ** 0.7 * (1.0 - 0.25 * abs(math.sin(s * math.pi * 3)))
    for sgn, nm in ((1, 'wing_L'), (-1, 'wing_R')):
        with m.node(nm, (0.02, sgn * 0.08, 0.53)):
            w = blade(0.55, 0.36, memb, segs=6, cols=5, fold=0.06, rise=0.05, droop=0.2, colors=('#1e1418', '#5a3a40'))
            m.add(w.xf(rz(sgn * math.pi / 2) @ rx(0), (0.02, sgn * 0.08, 0.53)))
            for k, a in enumerate((0.35, 0.0, -0.4)):  # the long finger-bones
                d = np.array([math.sin(a) * 0.2, sgn * math.cos(a), 0.0])
                m.add(tube([(0.02, sgn * 0.08, 0.54), (0.02 + 0.45 * d[0], sgn * 0.08 + 0.45 * d[1], 0.54 - 0.03 * k)], 0.008, sides=3, colors=('#2a1e20', '#4a3438')))
    with m.node('tail', (-0.12, 0, 0.48)):
        m.add(blade(0.18, 0.2, round_, segs=3, cols=3, fold=0.05, rise=-0.2, droop=0.1, colors=('#1e1418', '#4a3036')).xf(rz(math.pi), (-0.12, 0, 0.48)))
    for sgn, nm in ((1, 'leg_L'), (-1, 'leg_R')):
        with m.node(nm, (-0.08, sgn * 0.05, 0.44)):
            m.add(tube([(-0.08, sgn * 0.05, 0.44), (-0.13, sgn * 0.06, 0.38)], 0.01, sides=3, colors=('#2a1e20', '#4a3438')))
    return m, '#ff3a2a'


def rat_body(m, x0=0.0, y0=0.0, yaw=0.0, nodes=True, tail_to=None, seed=0, whiskers=True, lo=False):
    sg = (7, 4) if lo else (10, 6)
    R = rz(yaw)
    def P(p):
        return R @ np.asarray(p, float) + [x0, y0, 0]
    FUR = ('#8a7a66', '#5a4636')
    m.add(blob(0.24, 0.13, 0.13, seg=sg[0], rings=sg[1], colors=FUR).xf(R @ ry(0.1), P((0, 0, 0.16))))
    def head():
        m.add(blob(0.11, 0.08, 0.08, seg=sg[0] - 2, rings=sg[1] - 1, colors=FUR).xf(R @ ry(0.2), P((0.24, 0, 0.17))))
        m.add(lathe([(0.06, 0), (0.035, 0.07), (0.012, 0.1)], sides=7, colors=('#7a6a58', '#a89884'), close_top=False).xf(R @ ry(math.pi / 2 + 0.25), P((0.28, 0, 0.16))))
        m.add(blob(0.016, 0.016, 0.014, seg=5, rings=3, colors=('#c88a8a', '#e8a8a8')).xf(None, P((0.385, 0, 0.13))))
        for sgn in (-1, 1):
            m.add(blob(0.038, 0.012, 0.04, seg=6, rings=4, colors=('#b8988a', '#d8b8aa')).xf(R, P((0.22, sgn * 0.065, 0.25))))  # the thin pink ears
            m.add(blob(0.014, 0.014, 0.014, seg=5, rings=3, colors=('#0a0606', '#2a1a1a')).xf(None, P((0.31, sgn * 0.045, 0.2))))
            for k in range(3 if whiskers else 0):  # whiskers
                m.add(tube([P((0.36, sgn * 0.02, 0.15)), P((0.4, sgn * (0.09 + 0.02 * k), 0.15 + 0.012 * (k - 1)))], 0.0025, sides=3, colors=('#d8d0c8', '#ffffff')))
    if nodes:
        with m.node('head', P((0.18, 0, 0.18))):
            head()
    else:
        head()
    tail = tail_to if tail_to is not None else [P((-0.24, 0, 0.14)), P((-0.38, 0.04, 0.07)), P((-0.52, -0.03, 0.03)), P((-0.66, 0.05, 0.02))]
    if nodes:
        with m.node('tail', P((-0.22, 0, 0.14))):
            m.add(tube(tail, lambda s: 0.022 * (1 - 0.8 * s), sides=5, colors=('#c8a898', '#9a7a6a')))
    else:
        m.add(tube(tail, lambda s: 0.022 * (1 - 0.8 * s), sides=5, colors=('#c8a898', '#9a7a6a')))
    for sgn, side in ((1, 'L'), (-1, 'R')):
        for fb, x in (('F', 0.14), ('B', -0.12)):
            def lg():
                m.add(tube([P((x, sgn * 0.08, 0.1)), P((x + 0.02, sgn * 0.1, 0.0))], 0.022, sides=5, colors=('#c8a898', '#8a7a66')))
                m.add(blob(0.03, 0.02, 0.01, seg=5, rings=3, colors=('#d8b8a8', '#e8c8b8')).xf(R, P((x + 0.04, sgn * 0.1, 0.008))))
            if nodes:
                with m.node('leg_' + fb + side, P((x, sgn * 0.08, 0.1))):
                    lg()
            else:
                lg()


def rat():
    """Rattus norvegicus, the brown rat: a grizzled coat, pink ears and feet, the long scaly tail."""
    m = Model('rat', forward_x=True)
    rat_body(m)
    return m, None


def rat_king():
    """A rat king (Rattenkönig): rats whose tails have knotted together, facing out from the knot."""
    m = Model('rat_king', forward_x=True)
    knot = np.array([0.0, 0.0, 0.05])
    for k in range(6):
        a = TAU * k / 6
        x0, y0 = 0.38 * math.cos(a) - 0.0, 0.38 * math.sin(a)
        R = rz(a)
        # the tail runs from this rat's rump back into the knot
        rump = R @ np.array([-0.22, 0, 0.14]) + [x0, y0, 0]
        tail = [rump, (rump + knot) / 2 + [0, 0, 0.02], knot + R @ np.array([0.05, 0.03 * (k % 2), 0.02 * (k % 3)])]
        rat_body(m, x0, y0, a, nodes=False, tail_to=tail, seed=k, whiskers=False, lo=True)
    m.add(blob(0.09, 0.09, 0.06, seg=8, rings=5, colors=('#9a7a6a', '#c8a898'), jitter=0.3).xf(None, knot + [0, 0, 0.02]))  # the knot itself
    return m, None


def spider():
    """A cave spider, Meta menardi: a glossy dark body on long banded legs, eight eyes catching the light."""
    m = Model('spider', forward_x=True)
    BODY = ('#1a1210', '#5a3a30')
    m.add(blob(0.2, 0.17, 0.15, seg=10, rings=7, colors=BODY).xf(None, (-0.18, 0, 0.24)))  # abdomen
    m.add(blob(0.12, 0.1, 0.07, seg=8, rings=5, colors=BODY).xf(None, (0.06, 0, 0.2)))     # cephalothorax
    for (x, y) in ((0.16, 0.025), (0.16, -0.025), (0.15, 0.06), (0.15, -0.06), (0.13, 0.04), (0.13, -0.04), (0.14, 0.0), (0.12, 0.0)):
        m.add(blob(0.012, 0.012, 0.012, seg=5, rings=3, colors=('#2a0a0a', '#ff4a4a')).xf(None, (x, y, 0.25)))
    for sgn in (-1, 1):  # the fangs
        m.add(lathe([(0.016, 0), (0.0, 0.05)], sides=4, colors=('#2a1a14', '#5a3a2a'), close_bottom=True, close_top=False).xf(ry(math.pi * 0.8), (0.17, sgn * 0.025, 0.17)))
    for sgn, side in ((1, 'L'), (-1, 'R')):
        for k in range(4):
            a = sgn * (0.5 + 0.38 * k)
            hip = np.array([0.06 - 0.03 * k, sgn * 0.06, 0.2])
            knee = hip + np.array([0.18 * math.cos(a), 0.22 * math.sin(a), 0.16])
            foot = hip + np.array([0.36 * math.cos(a), 0.4 * math.sin(a), -0.2])
            with m.node('leg_%s%d' % (side, k), hip):
                m.add(tube([hip, knee], 0.018, sides=5, colors=('#2a1a14', '#6a4a36')))
                m.add(tube([knee, foot], lambda s: 0.016 * (1 - 0.6 * s), sides=5, colors=('#6a4a36', '#2a1a14')))
    return m, '#ff4a4a'


def beetle():
    """A dor beetle, Geotrupes: a domed black-violet shell with a metal sheen, six spiny legs, clubbed antennae."""
    m = Model('beetle', forward_x=True)
    SHELL = ('#0e0e1a', '#4a3a8a')
    el = blob(0.24, 0.18, 0.13, seg=10, rings=7, colors=SHELL)
    m.add(el.xf(None, (-0.06, 0, 0.17)))
    m.add(tube([(0.18, 0, 0.27), (-0.3, 0, 0.27)], 0.006, sides=3, colors=('#000000', '#1a1a2a')))  # the line between the wing-cases
    m.add(blob(0.1, 0.13, 0.08, seg=8, rings=5, colors=SHELL).xf(None, (0.18, 0, 0.17)))  # pronotum
    with m.node('head', (0.26, 0, 0.14)):
        m.add(blob(0.06, 0.07, 0.045, seg=7, rings=4, colors=('#0e0e1a', '#2a2a4a')).xf(None, (0.3, 0, 0.13)))
        for sgn in (-1, 1):
            m.add(tube([(0.33, sgn * 0.04, 0.15), (0.4, sgn * 0.08, 0.2)], 0.005, sides=3, colors=('#1a1a2a', '#3a3a5a')))
            m.add(blob(0.02, 0.015, 0.015, seg=5, rings=3, colors=('#3a2a1a', '#8a6a3a')).xf(None, (0.41, sgn * 0.085, 0.205)))
    for sgn, side in ((1, 'L'), (-1, 'R')):
        for k in range(3):
            a = sgn * (0.7 + 0.8 * k)
            hip = np.array([0.12 - 0.12 * k, sgn * 0.08, 0.1])
            foot = hip + np.array([0.24 * math.cos(a) * (1 if k else 1.2), 0.26 * math.sin(a), -0.1])
            knee = (hip + foot) / 2 + [0, 0, 0.08]
            with m.node('leg_%s%d' % (side, k), hip):
                m.add(tube([hip, knee, foot], lambda s: 0.014 * (1 - 0.4 * s), sides=4, colors=('#0e0e1a', '#2a2a4a')))
    return m, None


def centipede():
    """A great centipede: a long run of flattened russet plates, a pair of legs to each, poison claws at the head."""
    m = Model('centipede', forward_x=True)
    n = 15
    pts = [(0.45 - 0.065 * i, 0.06 * math.sin(i * 0.7), 0.06) for i in range(n)]
    for i, p in enumerate(pts):
        w = 0.06 * (1 - 0.3 * abs(i - 4) / n)
        m.add(blob(0.04, w, 0.03, seg=7, rings=4, colors=('#5a2a14', '#c86a2a')).xf(None, p))
        for sgn in (-1, 1):
            leg = [p, (p[0] - 0.01, p[1] + sgn * 0.08, 0.05), (p[0] - 0.04, p[1] + sgn * 0.12, 0.0)]
            m.add(tube(leg, 0.007, sides=3, colors=('#c88a3a', '#e8b860')))
    with m.node('head', (0.48, 0, 0.06)):
        m.add(blob(0.05, 0.05, 0.03, seg=7, rings=4, colors=('#3a1a0a', '#8a4a1a')).xf(None, (0.51, 0, 0.06)))
        for sgn in (-1, 1):
            m.add(tube([(0.53, sgn * 0.03, 0.06), (0.62, sgn * 0.09, 0.08), (0.7, sgn * 0.12, 0.06)], 0.005, sides=3, colors=('#8a5a2a', '#c88a4a')))  # antennae
            m.add(tube([(0.53, sgn * 0.03, 0.04), (0.57, sgn * 0.04, 0.03), (0.58, 0, 0.03)], 0.01, sides=3, colors=('#1a0a0a', '#4a1a14')))  # forcipules
    with m.node('tail', (pts[-1][0], pts[-1][1], 0.06)):
        for sgn in (-1, 1):
            m.add(tube([pts[-1], (pts[-1][0] - 0.12, pts[-1][1] + sgn * 0.06, 0.04)], 0.007, sides=3, colors=('#c88a3a', '#e8b860')))
    return m, None


def slug():
    """Limax maximus, the leopard slug: a long soft body with a ridged keel and the mantle, two tall eye-stalks; a wet trail."""
    m = Model('slug', forward_x=True)
    prof = lathe([(0.0, 0), (0.07, 0.06), (0.09, 0.2), (0.085, 0.4), (0.06, 0.55), (0.0, 0.62)], sides=10, colors=('#3a3a2a', '#9a9a7a'), close_top=False)
    prof.v[:, 1] *= 1.0
    for i, v in enumerate(prof.v):  # flatten the underside onto the ground
        if v[0] < 0:
            prof.v[i][0] *= 0.6
    m.add(prof.xf(ry(math.pi / 2) @ rz(0), (-0.32, 0, 0.07)))
    m.add(blob(0.16, 0.085, 0.05, seg=8, rings=5, colors=('#4a4a36', '#a8a888')).xf(None, (0.12, 0, 0.13)))  # the mantle
    r = np.random.default_rng(51)
    for k in range(14):  # the leopard spots
        x = r.uniform(-0.3, 0.2); a = r.uniform(-1.2, 1.2)
        m.add(blob(0.02, 0.015, 0.006, seg=5, rings=3, colors=('#14140e', '#2a2a1e')).xf(None, (x, 0.075 * math.sin(a), 0.07 + 0.07 * math.cos(a))))
    with m.node('head', (0.22, 0, 0.1)):
        for sgn in (-1, 1):
            m.add(tube([(0.25, sgn * 0.03, 0.12), (0.31, sgn * 0.05, 0.24)], 0.011, sides=5, colors=('#5a5a46', '#8a8a6a')))
            m.add(blob(0.016, 0.016, 0.016, seg=5, rings=3, colors=('#1a1a14', '#3a3a2a')).xf(None, (0.31, sgn * 0.05, 0.245)))
    m.add(blob(0.3, 0.07, 0.002, seg=8, rings=3, colors=('#5a6a6a', '#8a9a9a')).xf(None, (-0.5, 0, 0.002)))  # the silver trail
    return m, None


def adder():
    """Vipera berus, the adder: a thick coiled body with the black zig-zag down its back, the head raised and the tongue out."""
    m = Model('adder', forward_x=True)
    pts = []
    for i in range(34):  # a loose coil rising to the neck
        u = i / 33
        a = u * TAU * 1.35
        rr = 0.3 - 0.16 * u
        pts.append((rr * math.cos(a) - 0.05, rr * math.sin(a), 0.05 + 0.08 * max(0, u - 0.75) / 0.25))
    body = tube(pts, lambda s: 0.06 * (1 - 0.55 * s ** 2) if s < 0.97 else 0.02, sides=8, colors=('#5a5038', '#c8b888'))
    m.add(body)
    for i in range(1, 32, 1):  # the zig-zag, a dark diamond on every turn of the back
        p = np.array(pts[i]); q = np.array(pts[i + 1])
        d = q - p; d /= np.linalg.norm(d)
        side = np.cross(d, [0, 0, 1]); side /= (np.linalg.norm(side) + 1e-9)
        off = side * 0.022 * (1 if i % 2 else -1)
        w = 0.05 * (1 - 0.5 * i / 33)
        m.add(blob(w * 0.7, w * 0.5, 0.012, seg=4, rings=2, colors=('#0a0a08', '#1a1a14')).xf(rz(math.atan2(d[1], d[0]) + 0.6 * (1 if i % 2 else -1)), p + off + [0, 0, 0.06 * (1 - 0.5 * i / 33)]))
    neck = np.array(pts[-1])
    with m.node('head', tuple(neck)):
        hp = neck + [0.04, 0.0, 0.12]
        m.add(tube([neck, neck + [0.0, 0, 0.07], hp], 0.03, sides=7, colors=('#7a6a48', '#c8b888')))
        m.add(blob(0.07, 0.05, 0.035, seg=8, rings=5, colors=('#6a5a3a', '#b8a878')).xf(None, hp + [0.05, 0, 0.0]))
        m.add(blob(0.03, 0.018, 0.01, seg=4, rings=2, colors=('#0a0a08', '#1a1a14')).xf(rz(0), hp + [0.03, 0, 0.034]))  # the V on the crown
        for sgn in (-1, 1):
            m.add(blob(0.012, 0.012, 0.012, seg=5, rings=3, colors=('#6a1a0a', '#e05a2a')).xf(None, hp + [0.08, sgn * 0.035, 0.012]))  # the red eye
            m.add(tube([hp + [0.12, 0, -0.01], hp + [0.17, sgn * 0.02, -0.015]], 0.003, sides=3, colors=('#8a1a2a', '#e83a5a')))  # the forked tongue
    return m, '#e05a2a'


def dragon():
    """A worm of the old kind, as the Lambton Worm and the Sockburn Worm were told: a long scaled body in coils, a horned head, a ridge of spines, and (for the chaos in it) a pair of ragged wings."""
    m = Model('dragon', forward_x=True)
    SCALE = ('#3a0a08', '#c8301a')
    pts = []
    for i in range(40):
        u = i / 39
        a = u * TAU * 1.5 + 0.6
        rr = 0.42 - 0.2 * u
        pts.append((rr * math.cos(a) - 0.08, rr * math.sin(a), 0.09 + 0.3 * max(0, u - 0.7) / 0.3))
    m.add(tube(pts, lambda s: (0.02 + 0.09 * math.sin(math.pi * min(1, s * 1.15 + 0.03)) ** 0.6) if s < 0.98 else 0.05, sides=8, colors=SCALE))
    for i in range(2, 38, 2):  # the ridge of spines along the back
        p = np.array(pts[i]); w = 0.02 + 0.09 * math.sin(math.pi * min(1, (i / 39) * 1.15 + 0.03)) ** 0.6
        m.add(lathe([(0.022, 0), (0.0, 0.08)], sides=4, colors=('#1a0606', '#5a1410'), close_top=False).xf(None, p + [0, 0, w * 0.9]))
    belly = [(x, y, z - 0.02) for (x, y, z) in pts[4:36]]
    m.add(tube(belly, lambda s: 0.07 * math.sin(math.pi * min(1, s + 0.05)) ** 0.6, sides=5, colors=('#c88a3a', '#f0c870')))  # the pale belly showing
    neck = np.array(pts[-1])
    with m.node('head', tuple(neck)):
        hp = neck + [0.1, 0.02, 0.16]
        m.add(tube([neck, neck + [0.02, 0.0, 0.1], hp], 0.055, sides=8, colors=SCALE))
        m.add(blob(0.11, 0.08, 0.07, seg=9, rings=6, colors=SCALE).xf(ry(0.15), hp + [0.06, 0, 0.0]))
        m.add(lathe([(0.065, 0), (0.05, 0.1), (0.03, 0.17)], sides=7, colors=('#5a1410', '#d84a2a'), close_top=True).xf(ry(math.pi / 2 + 0.1), hp + [0.1, 0, -0.01]))  # the snout
        for sgn in (-1, 1):
            m.add(lathe([(0.022, 0), (0.012, 0.1), (0.0, 0.18)], sides=5, colors=('#2a2420', '#d8d0b8'), close_top=False).xf(rx(sgn * -0.35) @ ry(-0.9), hp + [0.0, sgn * 0.05, 0.05]))  # horns
            m.add(glowing(blob(0.018, 0.018, 0.018, seg=5, rings=3, colors=('#ff7a00', '#ffe060'))).xf(None, hp + [0.12, sgn * 0.055, 0.03]))
            m.add(lathe([(0.01, 0), (0.0, 0.035)], sides=4, colors=('#d8d0b8', '#ffffff'), close_top=False).xf(rx(math.pi), hp + [0.22, sgn * 0.025, -0.02]))  # fangs
    web = lambda s: math.sin(math.pi * min(1, s * 0.95 + 0.04)) ** 0.6 * (1.0 - 0.3 * abs(math.sin(s * math.pi * 3)))
    for sgn, nm in ((1, 'wing_L'), (-1, 'wing_R')):
        root = np.array([-0.02, sgn * 0.1, 0.24])
        with m.node(nm, tuple(root)):
            m.add(blade(0.6, 0.4, web, segs=6, cols=5, fold=0.05, rise=0.5, droop=0.5, colors=('#2a0808', '#8a2a1a')).xf(rz(sgn * (math.pi / 2 + 0.3)), root))
            for a in (0.5, 0.1, -0.35):
                d = rz(sgn * (math.pi / 2 + 0.3)) @ np.array([math.cos(a) * 0.55, math.sin(a) * 0.55, 0.22])
                m.add(tube([root, root + d], lambda s_: 0.014 * (1 - 0.6 * s_), sides=4, colors=('#1a0606', '#4a1410')))
    with m.node('tail', tuple(pts[0])):
        m.add(lathe([(0.03, 0), (0.05, 0.03), (0.0, 0.12)], sides=4, colors=('#1a0606', '#5a1410'), close_top=False).xf(ry(math.pi / 2) @ rz(0), np.array(pts[0]) + [0.0, 0.03, 0.0]))  # the barb
    return m, '#ff8a10'


def black_dog():
    """The black dog of the lanes at night (Black Shuck, the Barguest, the Padfoot): big as a calf, shaggy, with eyes like coals."""
    m = Model('black_dog', forward_x=True)
    COAT = ('#0c0b10', '#3a3442')
    m.add(blob(0.4, 0.2, 0.24, seg=11, rings=7, colors=COAT, jitter=0.06, seed=1).xf(ry(0.08), (0, 0, 0.62)))      # barrel
    m.add(blob(0.24, 0.22, 0.28, seg=9, rings=6, colors=COAT, jitter=0.08, seed=2).xf(None, (0.24, 0, 0.68)))       # deep chest and withers
    m.add(blob(0.2, 0.18, 0.2, seg=8, rings=6, colors=COAT, jitter=0.06, seed=3).xf(None, (-0.3, 0, 0.6)))          # haunch
    r = np.random.default_rng(91)
    for k in range(16):  # the shag along the neck and back
        x = 0.4 - 0.7 * k / 15
        m.add(blade(0.12 + r.uniform(0, 0.05), 0.07, linear, segs=2, cols=3, fold=0.2, rise=0.9, droop=0.9, colors=('#0c0b10', '#4a4454')).xf(rz(math.pi + r.uniform(-0.5, 0.5)), (x, r.uniform(-0.05, 0.05), 0.86 - 0.08 * (k / 15))))
    with m.node('head', (0.4, 0, 0.82)):
        m.add(tube([(0.36, 0, 0.76), (0.46, 0, 0.88), (0.52, 0, 0.94)], lambda s: 0.14 - 0.03 * s, sides=8, colors=COAT))   # thick neck
        m.add(blob(0.16, 0.14, 0.14, seg=9, rings=6, colors=COAT).xf(ry(0.15), (0.58, 0, 0.98)))
        m.add(lathe([(0.1, 0), (0.075, 0.12), (0.055, 0.22)], sides=8, colors=('#14121a', '#2e2a36'), close_top=True).xf(ry(math.pi / 2 + 0.2), (0.64, 0, 0.95)))  # the long muzzle
        m.add(blob(0.035, 0.04, 0.03, seg=6, rings=4, colors=('#000000', '#1a1a1a')).xf(None, (0.86, 0, 0.92)))
        m.add(lathe([(0.07, 0), (0.05, 0.1), (0.035, 0.18)], sides=6, colors=('#2a0a0a', '#5a1a1a'), close_top=True).xf(ry(math.pi / 2 + 0.45), (0.66, 0, 0.9)))  # the lower jaw, a little open
        for sgn in (-1, 1):
            m.add(glowing(blob(0.03, 0.03, 0.03, seg=6, rings=4, colors=('#ff2a0a', '#ffb060'))).xf(None, (0.69, sgn * 0.085, 1.03)))  # eyes like coals
            m.add(blob(0.05, 0.02, 0.1, seg=6, rings=4, colors=COAT).xf(rx(sgn * -0.35) @ ry(-0.3), (0.52, sgn * 0.1, 1.14)))            # pricked ears
            for k in range(2):
                m.add(lathe([(0.012, 0), (0.0, 0.05)], sides=4, colors=('#d8d0b8', '#ffffff'), close_top=False).xf(rx(math.pi), (0.8 - 0.06 * k, sgn * 0.035, 0.9)))  # teeth
    for sgn, side in ((1, 'L'), (-1, 'R')):
        for fb, x in (('F', 0.26), ('B', -0.3)):
            with m.node('leg_' + fb + side, (x, sgn * 0.12, 0.54)):
                knee = (x + (-0.06 if fb == 'B' else 0.02), sgn * 0.12, 0.28)
                m.add(leg([(x, sgn * 0.12, 0.56), knee, (x + 0.02, sgn * 0.12, 0.04)], 0.085 if fb == 'B' else 0.07, 0.04, ('#08070a', '#2a2630')))
                m.add(blob(0.07, 0.055, 0.035, seg=7, rings=4, colors=('#08070a', '#1e1c24')).xf(None, (x + 0.05, sgn * 0.12, 0.03)))  # great paws
    with m.node('tail', (-0.46, 0, 0.66)):
        m.add(tube([(-0.44, 0, 0.66), (-0.6, 0, 0.6), (-0.74, 0, 0.44), (-0.8, 0, 0.3)], lambda s: 0.05 * (1 - 0.5 * s), sides=6, colors=COAT))
    return m, '#ff3a10'


CRITTERS = {'rabbit': rabbit, 'embermoth': embermoth, 'thistlehog': hedgehog, 'duskfawn': fawn, 'mirefowl': moorhen,
            'bramble_boar': boar, 'mossback_tortoise': tortoise, 'gravewing_crow': crow,
            'bat': bat, 'rat': rat, 'rat_king': rat_king, 'spider': spider, 'beetle': beetle, 'centipede': centipede, 'slug': slug, 'adder': adder, 'dragon': dragon, 'black_dog': black_dog}

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for n in (sys.argv[1:] or list(CRITTERS)):
        m, glow = CRITTERS[n]()
        path = os.path.abspath(os.path.join(OUT, n + '.glb'))
        m.export(path, glow_color=glow or '#ffffff')
        print(n, m.tris(), 'tris', os.path.getsize(path), 'bytes')
