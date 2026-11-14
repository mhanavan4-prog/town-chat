"""Worn gear, one model an item: what a character carries in the hand, wears on the head, over the chest, on
the feet and on the finger. Writes public/kk/gear/<itemId>.glb.

    sh tools/models/build.sh gear [itemId ...]

Each is built in the KayKit idiom (stout shapes, the wide chamfer, flat colour) and to the game's own measure:
1 unit = 10 game units, about the width of a character's head. The origin is where the thing is held or worn,
so the client sets it on the bone as it is, with no fitting:

    weapon   the grip at the origin, the business end up +Z
    head     the origin at the crown of the skull; +Z up, the face toward -Y
    chest    the origin at the breastbone; +Z up, the front toward -Y
    feet     one boot, the origin at the ankle; the toe toward -Y
    ring     the origin at the hand; worn large, to be seen
"""
import math, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from trlib import *  # noqa
from build_home import blk, trim, glowing, KK_STONE, KK_STONE_DK, KK_STONE_LT, KK_WOOD, KK_WOOD_DK, KK_WOOD_CHAR, KK_IRON, KK_MOSS, KK_BONE  # noqa

OUT = os.path.join(os.path.dirname(__file__), '../../public/kk/gear')

STEEL = ('#8a98a6', '#dfe8ee'); STEEL_DK = ('#4c5863', '#8492a0'); GOLD = ('#a8791e', '#f2cf63'); LEATHER = ('#5a3a22', '#96673c')
LEATHER_DK = ('#33211a', '#5c3d2a'); CLOTH_RED = ('#6a1420', '#c23a3a'); CLOTH_VIOLET = ('#2a1642', '#6c3fa8'); CLOTH_GREEN = ('#1f3d24', '#4f8a3f')
CLOTH_BLUE = ('#1a2c52', '#3f6cc0'); CLOTH_BLACK = ('#14121a', '#34303f'); SILVER = ('#b9c4d0', '#f4f8fb'); SHADOW = ('#1a1226', '#4a3570')


def G(name, bevel=0.012):
    m = Model(name); m.bevel = bevel
    return m


def cyl(r, h, colors, at=(0, 0, 0), sides=8, r_top=None, R=None):
    """An upright drum (or a taper to r_top), its base centred at `at`."""
    rt = r if r_top is None else r_top
    return lathe([(0.0, 0.0), (r, 0.0), (rt, h), (0.0, h)], sides=sides, colors=colors).xf(R, at)


def hoop(r, thick, colors, at=(0, 0, 0), sides=10, R=None):
    return tube([(r * math.cos(a), r * math.sin(a), 0) for a in np.linspace(0, TAU, sides + 1)], thick, sides=5, colors=colors).xf(R, at)


# ── weapons ──────────────────────────────────────────────────────────────────
def iron_sword():
    """A plain arming sword: a broad grey blade, a straight iron cross, a leather grip and a wheel pommel."""
    m = G('iron_sword')
    m.add(blk(0.2, 0.06, 1.25, STEEL, (0, 0, 0.16)))                       # the blade
    m.add(lathe([(0.1, 0.0), (0.0, 0.2)], sides=4, colors=STEEL, phase=math.pi / 4).xf(None, (0, 0, 1.41)))   # its point
    m.add(blk(0.56, 0.1, 0.09, STEEL_DK, (0, 0, 0.08)))                     # the cross
    m.add(cyl(0.05, 0.26, LEATHER, (0, 0, -0.18), 6))                      # the grip
    m.add(cyl(0.085, 0.07, STEEL_DK, (0, 0, -0.25), 8))                    # the pommel
    return m, None


def spell_tome():
    """A thick spellbook carried shut: violet boards, bone-pale pages, gold corners, a clasp and a lit sigil on the cover."""
    m = G('spell_tome')
    m.add(blk(0.56, 0.2, 0.72, CLOTH_VIOLET, (0, 0, 0.0)))
    m.add(blk(0.5, 0.15, 0.66, KK_BONE, (0.035, 0, 0.03)))                    # the pages
    for (x, z) in ((-0.22, 0.02), (0.2, 0.02), (-0.22, 0.6), (0.2, 0.6)):
        m.add(trim(blk(0.12, 0.22, 0.12, GOLD, (x, 0, z))))                  # gold corners
    m.add(trim(blk(0.1, 0.24, 0.1, GOLD, (0.25, 0, 0.31))))                   # the clasp
    m.add(glowing(cyl(0.12, 0.03, ('#b98aff', '#f0e0ff'), (0, -0.115, 0.36), 6, R=rx(math.pi / 2))))   # the sigil
    return m, '#c9a0ff'


def yew_wand():
    """A wand of red yew, a little crooked, bound in black thread, with a pale tip."""
    m = G('yew_wand', 0.008)
    YEW = ('#5a2418', '#a04a2c')
    m.add(tube([(0, 0, -0.18), (0.01, 0, 0.3), (-0.03, 0.01, 0.7), (0.02, 0, 1.05)], [0.055, 0.05, 0.042, 0.03], sides=6, colors=YEW, cap_base=True))
    m.add(cyl(0.065, 0.12, CLOTH_BLACK, (0, 0, 0.02), 6))
    m.add(glowing(blob(0.05, 0.05, 0.07, seg=6, rings=4, colors=('#f2ead0', '#ffffff')).xf(None, (0.02, 0, 1.09))))
    return m, '#fff0c0'


def cursed_blade():
    """A black blade, notched down one edge, with a red line burning along it and a barbed cross."""
    m = G('cursed_blade')
    BLK = ('#16131c', '#3a3446')
    m.add(blk(0.24, 0.07, 1.2, BLK, (0, 0, 0.16)))
    for k, z in enumerate((0.45, 0.75, 1.05)):
        m.add(blk(0.14, 0.07, 0.16, BLK, (0.14, 0, z), ry(0.7)))               # the notches, standing out
    m.add(lathe([(0.12, 0.0), (0.0, 0.26)], sides=4, colors=BLK, phase=math.pi / 4).xf(None, (0, 0, 1.36)))
    m.add(glowing(blk(0.05, 0.08, 1.05, ('#c01818', '#ff5a3a'), (0, 0, 0.22))))   # the red line
    m.add(blk(0.6, 0.1, 0.1, STEEL_DK, (0, 0, 0.07)))
    for sx in (-1, 1):
        m.add(lathe([(0.06, 0.0), (0.0, 0.2)], sides=4, colors=STEEL_DK).xf(None, (sx * 0.28, 0, 0.16)))
    m.add(cyl(0.05, 0.26, CLOTH_RED, (0, 0, -0.18), 6))
    m.add(lathe([(0.0, 0.0), (0.09, 0.06), (0.0, 0.14)], sides=4, colors=STEEL_DK).xf(rx(math.pi), (0, 0, -0.18)))
    return m, '#ff4030'


def shadow_staff():
    """A tall staff of black wood, its head a horned crescent holding a violet light."""
    m = G('shadow_staff')
    m.add(cyl(0.055, 2.2, SHADOW, (0, 0, -0.75), 6, r_top=0.045))
    for sx in (-1, 1):
        m.add(tube([(sx * 0.03, 0, 1.42), (sx * 0.26, 0, 1.55), (sx * 0.3, 0, 1.82), (sx * 0.14, 0, 2.02)], [0.05, 0.05, 0.04, 0.012], sides=5, colors=SHADOW))
    m.add(glowing(blob(0.13, 0.13, 0.13, seg=7, rings=5, colors=('#8a4cff', '#e6d0ff')).xf(None, (0, 0, 1.74))))
    m.add(cyl(0.075, 0.1, STEEL_DK, (0, 0, 1.36), 6))
    m.add(cyl(0.075, 0.06, STEEL_DK, (0, 0, -0.75), 6))
    return m, '#a070ff'


def void_staff():
    """A tall grey staff ending in an iron ring, with a shard of the dark hanging in the middle of it."""
    m = G('void_staff')
    m.add(cyl(0.055, 2.05, STEEL_DK, (0, 0, -0.75), 6))
    m.add(hoop(0.27, 0.05, KK_IRON, (0, 0, 1.58), 10, R=rx(math.pi / 2)))
    m.add(glowing(lathe([(0.0, 0.0), (0.1, 0.16), (0.0, 0.36)], sides=4, colors=('#1c2a80', '#6aa0ff')).xf(None, (0, 0, 1.4))))
    for k in range(3):
        m.add(blk(0.07, 0.07, 0.07, KK_IRON, (0.3 * math.cos(k * 2.1), 0, 1.58 + 0.3 * math.sin(k * 2.1)), ry(0.7)))
    return m, '#5080ff'


def alpha_fang():
    """The eye-tooth of a great wolf set as a dagger: a long curved fang, a grip bound in grey fur."""
    m = G('alpha_fang')
    m.add(tube([(0, 0, 0.12), (0.03, 0, 0.5), (0.14, 0, 0.85), (0.32, 0, 1.08)], [0.13, 0.115, 0.075, 0.012], sides=6, colors=KK_BONE, cap_base=True))
    m.add(cyl(0.16, 0.09, GOLD, (0, 0, 0.06), 8))
    m.add(blob(0.1, 0.1, 0.17, seg=7, rings=4, colors=('#6a6a70', '#b4b4ba'), jitter=0.02, seed=3).xf(None, (0, 0, -0.08)))
    m.add(lathe([(0.0, 0.0), (0.07, 0.05), (0.0, 0.16)], sides=5, colors=KK_BONE).xf(rx(math.pi), (0, 0, -0.22)))
    return m, None


# ── heads ────────────────────────────────────────────────────────────────────
# A head here is a ball about 1.0 across the radius, its middle 0.55 below the origin; the eyes are near z = -0.5
# and the face looks toward -Y. Anything that goes round the head is 0.95 to 1.15 out.
def shell(profile, colors, gap=1.5, sides=12, thick=0.07):
    """Part of a turned shape, left open across the face: the profile [(r, z), ...] swept round Z except for `gap`
    radians at the front (-Y), with a thickness, so it reads from inside and out."""
    prof = np.asarray(profile, float); m = len(prof)
    a0 = -math.pi / 2 + gap / 2; span = TAU - gap
    v, t, f = [], [], []
    for layer in (0, 1):
        for i, (r, z) in enumerate(prof):
            rr = max(0.0, r - (thick if layer else 0.0))
            for k in range(sides + 1):
                a = a0 + span * k / sides
                v.append((rr * math.cos(a), rr * math.sin(a), z)); t.append(i / max(1, m - 1))
    W = sides + 1; L = m * W
    for i in range(m - 1):
        for k in range(sides):
            a, b = i * W + k, i * W + k + 1
            f.append((a, b, b + W, a + W))                       # outside
            f.append((L + b, L + a, L + a + W, L + b + W))       # inside
    for i in range(m - 1):                                       # the two cut edges
        a, b = i * W, (i + 1) * W
        f.append((a, b, L + b, L + a))
        a, b = i * W + sides, (i + 1) * W + sides
        f.append((b, a, L + a, L + b))
    for k in range(sides):                                       # the lower rim
        f.append((k + 1, k, L + k, L + k + 1))
    return Part(v, f, t, colors)


def _dome(colors, r=1.07, z0=0.05, top=0.58, sides=12):
    return lathe([(r, z0), (r * 0.95, z0 + 0.14), (r * 0.66, top - 0.12), (0.0, top)], sides=sides, colors=colors, close_top=False)


def wizard_hat():
    """A tall crooked hat of midnight cloth with a wide brim, a buckled band and a bent point."""
    m = G('wizard_hat')
    m.add(cyl(1.5, 0.08, CLOTH_VIOLET, (0, 0, 0.0), 12, r_top=1.44))        # the brim
    m.add(lathe([(0.0, 0.0), (0.92, 0.0), (0.62, 0.6), (0.3, 1.15), (0.0, 1.15)], sides=10, colors=CLOTH_VIOLET).xf(None, (0, 0, 0.08)))
    m.add(lathe([(0.0, 0.0), (0.3, 0.0), (0.0, 0.66)], sides=8, colors=CLOTH_VIOLET).xf(rx(0.6), (0, 0.0, 1.2)))   # the bent point
    m.add(cyl(0.95, 0.16, CLOTH_BLACK, (0, 0, 0.09), 10, r_top=0.86))       # the band
    m.add(trim(blk(0.24, 0.06, 0.18, GOLD, (0, -0.92, 0.08))))              # its buckle
    return m, None


def bloodmoon_circlet():
    """A thin circlet of dark gold with a red crescent burning at the brow."""
    m = G('bloodmoon_circlet', 0.008)
    m.add(hoop(1.0, 0.055, ('#6a3a14', '#c88a3a'), (0, 0, -0.15), 14))
    m.add(glowing(lathe([(0.0, 0.0), (0.2, 0.0), (0.2, 0.06), (0.0, 0.06)], sides=8, colors=('#b01010', '#ff5038')).xf(rx(math.pi / 2), (0, -1.0, -0.13))))
    m.add(trim(cyl(0.14, 0.08, ('#2a0c10', '#4a1418'), (0.09, -1.04, -0.13), 8, R=rx(math.pi / 2))))   # the bite out of the moon
    for sx in (-1, 1):
        m.add(lathe([(0.05, 0.0), (0.0, 0.22)], sides=4, colors=GOLD).xf(None, (sx * 0.4, -0.92, -0.12)))
    return m, '#ff3020'


def beast_crown():
    """A band of hide set with teeth, and a pair of curling horns."""
    m = G('beast_crown')
    m.add(lathe([(1.0, -0.3), (1.04, -0.05), (0.98, 0.0)], sides=12, colors=LEATHER_DK, close_top=False))
    HORN = ('#5a4a34', '#d8cdb0')
    for sx in (-1, 1):
        m.add(tube([(sx * 0.9, 0, -0.1), (sx * 1.35, 0.05, 0.2), (sx * 1.48, 0.0, 0.7), (sx * 1.2, -0.14, 1.1)], [0.19, 0.16, 0.11, 0.02], sides=6, colors=HORN))
    for a in np.linspace(-1.0, 1.0, 5):
        m.add(lathe([(0.06, 0.0), (0.0, 0.2)], sides=4, colors=KK_BONE).xf(None, (1.02 * math.sin(a), -1.02 * math.cos(a), -0.02)))
    return m, None


def spirit_veil():
    """A silver fillet with a pale veil over the crown and down the back, and a blue light on the brow."""
    m = G('spirit_veil', 0.01)
    VEIL = ('#8fa6d8', '#e6eeff')
    m.add(hoop(1.0, 0.045, SILVER, (0, 0, -0.15), 14))
    m.add(_dome(VEIL, r=1.04, z0=-0.1, top=0.56))
    m.add(shell([(1.2, -2.0), (1.14, -1.0), (1.06, -0.1)], VEIL, gap=3.0, sides=8))        # down the back and sides
    m.add(glowing(lathe([(0.0, 0.0), (0.1, 0.12), (0.0, 0.3)], sides=4, colors=('#6aa8ff', '#e0f0ff')).xf(None, (0, -1.04, -0.28))))
    return m, '#9cc4ff'


def knights_helm():
    """A steel great helm: a round skull, a closed face with a dark sight and breathing-holes, a red plume."""
    m = G('knights_helm')
    m.add(lathe([(1.12, -1.4), (1.15, -0.35), (1.07, 0.1), (0.72, 0.46), (0.0, 0.58)], sides=12, colors=STEEL, close_top=False))
    m.add(blk(0.16, 0.14, 1.5, STEEL_DK, (0, -1.12, -1.4)))                                  # the ridge down the face
    for sx in (-1, 1):
        m.add(trim(blk(0.44, 0.1, 0.12, CLOTH_BLACK, (sx * 0.36, -1.1, -0.52))))             # the sight
        for z in (-0.9, -1.08):
            m.add(trim(blk(0.07, 0.08, 0.07, CLOTH_BLACK, (sx * 0.34, -1.08, z))))           # breathing-holes
    m.add(hoop(1.13, 0.06, STEEL_DK, (0, 0, -1.38), 12))
    m.add(tube([(0, 0.1, 0.55), (0, 0.4, 1.1), (0, 0.95, 1.05), (0, 1.25, 0.55)], [0.12, 0.2, 0.18, 0.05], sides=6, colors=CLOTH_RED))   # the plume
    return m, None


def travelers_hood():
    """A deep green hood, open at the face, with a long point hanging behind and a leather edge."""
    m = G('travelers_hood')
    m.add(shell([(1.2, -1.45), (1.2, -0.4), (1.1, 0.1)], CLOTH_GREEN, gap=1.7))
    m.add(_dome(CLOTH_GREEN, r=1.1, z0=0.08, top=0.66))
    m.add(tube([(0, 0.8, 0.45), (0, 1.45, 0.25), (0, 1.65, -0.5)], [0.36, 0.24, 0.03], sides=6, colors=CLOTH_GREEN))   # the point behind
    m.add(shell([(1.24, -1.45), (1.24, -1.33)], LEATHER, gap=1.7, thick=0.12))
    m.add(lathe([(1.12, 0.02), (1.14, 0.12)], sides=12, colors=LEATHER, close_top=False))
    return m, None


def dread_helm():
    """A black helm, closed, with two swept horns and a slit that glows red."""
    m = G('dread_helm')
    BLK = ('#14121a', '#3c3848')
    m.add(lathe([(1.12, -1.4), (1.16, -0.3), (1.05, 0.15), (0.6, 0.5), (0.0, 0.6)], sides=8, colors=BLK, close_top=False))
    m.add(glowing(blk(1.1, 0.1, 0.11, ('#c01010', '#ff5a30'), (0, -1.1, -0.55))))
    m.add(blk(0.14, 0.14, 0.8, BLK, (0, -1.12, -1.4)))
    for sx in (-1, 1):
        m.add(tube([(sx * 1.0, 0, 0.0), (sx * 1.6, 0.1, 0.25), (sx * 1.8, 0.05, 0.9), (sx * 1.5, -0.1, 1.45)], [0.22, 0.18, 0.12, 0.02], sides=6, colors=('#2a2430', '#8a8494')))
    m.add(lathe([(0.12, 0.0), (0.0, 0.46)], sides=4, colors=BLK).xf(None, (0, 0, 0.56)))
    return m, '#ff3018'


def shadow_crown():
    """A tall crown of black spires, a violet stone alight in each."""
    m = G('shadow_crown')
    m.add(lathe([(1.0, -0.3), (1.06, 0.0)], sides=12, colors=SHADOW, close_top=False))
    for k in range(6):
        a = k * TAU / 6 + TAU / 12
        h = 0.95 if k % 2 == 0 else 0.6
        m.add(lathe([(0.16, 0.0), (0.0, h)], sides=4, colors=SHADOW).xf(None, (0.98 * math.sin(a), -0.98 * math.cos(a), -0.02)))
        m.add(glowing(blob(0.075, 0.075, 0.075, seg=5, rings=3, colors=('#8a4cff', '#e6d0ff')).xf(None, (1.06 * math.sin(a), -1.06 * math.cos(a), -0.15))))
    return m, '#a070ff'


# ── chests ───────────────────────────────────────────────────────────────────
def _mantle(m, colors, r0=0.62, r1=1.02, top=0.42, drop=0.5, at=(0, 0.05, 0)):
    """A short cape over the shoulders: a cone open below, a hole at the neck."""
    m.add(lathe([(r0, top), (r0 + 0.12, top - 0.08), (r1, top - drop), (r1 - 0.06, top - drop)], sides=10, colors=colors, close_top=False).xf(None, at))


def steel_shield():
    """A round steel shield slung on the back, bossed and rimmed, on a strap across the chest."""
    m = G('steel_shield')
    R = rx(-math.pi / 2)
    m.add(cyl(0.9, 0.1, STEEL, (0, 1.0, -0.25), 12, R=R))
    m.add(cyl(0.3, 0.16, STEEL_DK, (0, 1.1, -0.25), 8, r_top=0.12, R=R))
    m.add(hoop(0.9, 0.06, STEEL_DK, (0, 1.05, -0.25), 12, R=R))
    for a in (0.0, TAU / 4, TAU / 2, 3 * TAU / 4):
        m.add(trim(blk(0.09, 0.05, 0.09, GOLD, (0.62 * math.cos(a), 1.12, -0.25 + 0.62 * math.sin(a) - 0.045))))
    m.add(tube([(-0.55, -0.6, 0.38), (0.0, -0.74, 0.0), (0.5, -0.6, -0.4)], 0.07, sides=4, colors=LEATHER))   # the strap, across the front
    return m, None


def witch_robe():
    """A violet shoulder-mantle with a high pointed collar and a star for a clasp."""
    m = G('witch_robe')
    _mantle(m, CLOTH_VIOLET)
    for sx in (-1, 1):
        m.add(lathe([(0.2, 0.0), (0.0, 0.62)], sides=4, colors=CLOTH_VIOLET).xf(ry(sx * 0.35), (sx * 0.55, 0.25, 0.36)))   # the collar's points
    m.add(blk(1.1, 0.1, 0.4, CLOTH_VIOLET, (0, 0.6, 0.3)))
    m.add(glowing(lathe([(0.0, 0.0), (0.13, 0.0), (0.13, 0.04), (0.0, 0.04)], sides=5, colors=('#ffd95a', '#fff6c8')).xf(rx(math.pi / 2), (0, -0.78, 0.22))))
    m.add(hoop(1.0, 0.035, GOLD, (0, 0.05, -0.08), 10))
    return m, '#ffe070'


def beast_hide():
    """A shaggy brown hide over the shoulders, pinned with a claw, a string of teeth across the chest."""
    m = G('beast_hide')
    FUR = ('#4a2c14', '#9a6a36')
    m.add(blob(1.08, 0.86, 0.34, seg=10, rings=4, colors=FUR, jitter=0.07, seed=5).xf(None, (0, 0.1, 0.2)))
    for sx in (-1, 1):
        m.add(blob(0.42, 0.42, 0.3, seg=7, rings=4, colors=FUR, jitter=0.06, seed=6 + sx).xf(None, (sx * 0.9, 0.05, 0.12)))
    for k, a in enumerate(np.linspace(-0.9, 0.9, 5)):
        m.add(lathe([(0.05, 0.0), (0.0, 0.18)], sides=4, colors=KK_BONE).xf(rx(math.pi), (0.62 * math.sin(a), -0.72 * math.cos(a) - 0.04, -0.02 - 0.1 * math.cos(a))))
    m.add(tube([(0.0, -0.8, 0.2), (0.12, -0.92, 0.1), (0.1, -0.9, -0.08)], [0.07, 0.05, 0.012], sides=5, colors=KK_BONE))
    return m, None


def spirit_robe():
    """A pale blue mantle with a wide flat collar and a lit rune hanging at the breast."""
    m = G('spirit_robe')
    PALE = ('#5a6aa8', '#c8d6ff')
    _mantle(m, PALE, r1=1.06, drop=0.6)
    m.add(cyl(0.95, 0.08, SILVER, (0, 0.05, 0.36), 10, r_top=0.7))
    m.add(glowing(cyl(0.17, 0.04, ('#7ab0ff', '#e6f2ff'), (0, -0.88, -0.05), 6, R=rx(math.pi / 2))))
    m.add(tube([(-0.3, -0.7, 0.34), (0, -0.86, 0.1), (0.3, -0.7, 0.34)], 0.022, sides=4, colors=SILVER))
    return m, '#9cc4ff'


def travelers_vest():
    """A traveller's harness: a bandolier with pouches, a rolled blanket across the back."""
    m = G('travelers_vest')
    m.add(tube([(-0.6, -0.55, 0.4), (0.0, -0.76, 0.02), (0.55, -0.62, -0.42), (0.5, 0.62, -0.4), (-0.1, 0.8, 0.05), (-0.6, 0.55, 0.4), (-0.6, -0.55, 0.4)], 0.085, sides=4, colors=LEATHER))
    for (x, y, z) in ((-0.28, -0.72, 0.14), (0.1, -0.8, -0.1), (0.42, -0.72, -0.34)):
        m.add(blk(0.24, 0.14, 0.24, LEATHER_DK, (x, y, z - 0.1)))
        m.add(trim(blk(0.08, 0.16, 0.06, GOLD, (x, y - 0.01, z + 0.02))))
    m.add(cyl(0.2, 1.3, CLOTH_GREEN, (-0.65, 1.0, -0.05), 8, R=ry(math.pi / 2)))            # the blanket roll
    for x in (-0.4, 0.4):
        m.add(hoop(0.21, 0.035, LEATHER_DK, (x, 1.0, -0.05), 8, R=ry(math.pi / 2)))
    return m, None


def bone_armor():
    """A breast of ribs lashed together, a spine down the back, a skull on one shoulder."""
    m = G('bone_armor')
    for k, z in enumerate((0.25, 0.05, -0.15, -0.35)):
        w = 0.74 - 0.05 * k
        m.add(tube([(-w, 0.0, z + 0.06), (-w * 0.8, -0.6, z), (0.0, -0.82, z - 0.05), (w * 0.8, -0.6, z), (w, 0.0, z + 0.06)], 0.06, sides=5, colors=KK_BONE))
    m.add(blk(0.14, 0.1, 0.8, KK_BONE, (0, -0.84, -0.5)))                                   # the breastbone
    for z in (0.25, 0.02, -0.21, -0.44):
        m.add(blk(0.2, 0.16, 0.16, KK_BONE, (0, 0.74, z)))                                  # the spine
    m.add(blob(0.3, 0.32, 0.28, seg=8, rings=5, colors=KK_BONE).xf(None, (0.95, 0.0, 0.42)))   # the skull
    for sx in (-1, 1):
        m.add(trim(blk(0.09, 0.05, 0.1, CLOTH_BLACK, (0.95 + sx * 0.1, -0.29, 0.4))))
    return m, None


def shadow_cloak():
    """A black cloak with a standing collar, falling long behind, held by a violet stone."""
    m = G('shadow_cloak')
    _mantle(m, CLOTH_BLACK, r1=1.08, drop=0.55)
    m.add(lathe([(0.66, 0.0), (0.8, 0.5)], sides=10, colors=CLOTH_BLACK, close_top=False).xf(None, (0, 0.1, 0.36)))    # the collar
    m.add(blk(1.5, 0.08, 1.9, CLOTH_BLACK, (0, 0.98, -2.0)))                                 # down the back
    m.add(blk(1.3, 0.08, 0.3, SHADOW, (0, 0.99, -2.2)))
    m.add(glowing(blob(0.11, 0.08, 0.11, seg=6, rings=4, colors=('#8a4cff', '#e6d0ff')).xf(None, (0, -0.8, 0.22))))
    return m, '#a070ff'


def abyssal_armor():
    """A cuirass of dark plate with spiked shoulders and a cold blue light in the breast."""
    m = G('abyssal_armor')
    DARK = ('#1a2030', '#4a5878')
    m.add(lathe([(0.7, -0.6), (0.86, -0.1), (0.84, 0.3), (0.62, 0.42)], sides=8, colors=DARK, close_top=False).xf(None, (0, 0.02, 0)))
    for sx in (-1, 1):
        m.add(blob(0.4, 0.4, 0.26, seg=7, rings=4, colors=DARK).xf(None, (sx * 0.98, 0.0, 0.4)))
        for (dx, dz, h) in ((0.0, 0.2, 0.42), (0.22, 0.1, 0.3)):
            m.add(lathe([(0.08, 0.0), (0.0, h)], sides=4, colors=STEEL_DK).xf(ry(sx * 0.5), (sx * (0.98 + dx), 0.0, 0.4 + dz)))
    m.add(glowing(lathe([(0.0, 0.0), (0.15, 0.0), (0.15, 0.05), (0.0, 0.05)], sides=6, colors=('#2a60ff', '#a0d0ff')).xf(rx(math.pi / 2), (0, -0.86, 0.08))))
    m.add(hoop(0.74, 0.05, STEEL_DK, (0, 0.02, -0.55), 8))
    return m, '#5090ff'


def moonhowl_pelt():
    """The silver pelt of a great wolf over the shoulders, its head on the right, eyes still alight."""
    m = G('moonhowl_pelt')
    FUR = ('#7c8698', '#eef2f8')
    m.add(blob(1.1, 0.88, 0.36, seg=10, rings=4, colors=FUR, jitter=0.07, seed=9).xf(None, (0, 0.1, 0.2)))
    m.add(blk(1.2, 0.1, 1.2, FUR, (0, 0.95, -1.1)))                                          # the back of the pelt
    m.add(blob(0.36, 0.44, 0.3, seg=8, rings=5, colors=FUR).xf(None, (0.95, -0.2, 0.45)))     # the head
    m.add(blob(0.18, 0.3, 0.16, seg=6, rings=4, colors=FUR).xf(None, (0.95, -0.62, 0.36)))    # the muzzle
    for sx in (-1, 1):
        m.add(lathe([(0.1, 0.0), (0.0, 0.26)], sides=4, colors=FUR).xf(None, (0.95 + sx * 0.2, 0.0, 0.66)))
        m.add(glowing(blob(0.05, 0.04, 0.05, seg=5, rings=3, colors=('#ffd95a', '#fff6c8')).xf(None, (0.95 + sx * 0.14, -0.5, 0.56))))
    m.add(trim(blob(0.07, 0.06, 0.06, seg=5, rings=3, colors=CLOTH_BLACK).xf(None, (0.95, -0.9, 0.38))))
    return m, '#ffe070'


# ── feet ─────────────────────────────────────────────────────────────────────
def _boot(m, upper, sole, leg_h=0.5, toe=0.8):
    m.add(blk(0.46, toe, 0.12, sole, (0, -toe / 2 + 0.24, -0.42)))
    m.add(blk(0.42, toe - 0.08, 0.26, upper, (0, -toe / 2 + 0.26, -0.3)))
    m.add(cyl(0.25, leg_h, upper, (0, 0.08, -0.1), 8))


def leather_boots():
    """A stout brown boot, turned over at the top, with a thick sole."""
    m = G('leather_boots')
    _boot(m, LEATHER, LEATHER_DK)
    m.add(cyl(0.29, 0.12, LEATHER_DK, (0, 0.08, 0.36), 8))
    return m, None


def hexed_boots():
    """A violet boot with a toe that curls up to a point, and a gold star on the instep."""
    m = G('hexed_boots')
    _boot(m, CLOTH_VIOLET, CLOTH_BLACK, toe=0.86)
    m.add(tube([(0, -0.55, -0.26), (0, -0.82, -0.2), (0, -0.92, 0.02), (0, -0.78, 0.14)], [0.14, 0.11, 0.07, 0.015], sides=5, colors=CLOTH_VIOLET))
    m.add(glowing(lathe([(0.0, 0.0), (0.1, 0.0), (0.1, 0.04), (0.0, 0.04)], sides=5, colors=('#ffd95a', '#fff6c8')).xf(None, (0, -0.3, -0.04))))
    m.add(cyl(0.28, 0.08, GOLD, (0, 0.08, 0.36), 8))
    return m, '#ffe070'


def paw_boots():
    """A boot of brown fur with three claws at the toe and a shaggy cuff."""
    m = G('paw_boots')
    FUR = ('#4a2c14', '#9a6a36')
    _boot(m, FUR, LEATHER_DK, leg_h=0.42)
    for sx in (-0.14, 0.0, 0.14):
        m.add(lathe([(0.05, 0.0), (0.0, 0.2)], sides=4, colors=KK_BONE).xf(rx(math.pi / 2), (sx, -0.56, -0.36)))
    m.add(blob(0.33, 0.33, 0.14, seg=8, rings=3, colors=FUR, jitter=0.05, seed=3).xf(None, (0, 0.08, 0.34)))
    return m, None


def soul_treads():
    """A pale grey boot with a little wing at the ankle and a sole that gives off a blue light."""
    m = G('soul_treads')
    PALE = ('#8a96b0', '#e8eef8')
    _boot(m, PALE, STEEL_DK)
    m.add(glowing(blk(0.5, 0.84, 0.05, ('#5aa0ff', '#d0e8ff'), (0, -0.16, -0.46))))
    for k, (dz, ln) in enumerate(((0.2, 0.4), (0.08, 0.32), (-0.04, 0.24))):
        m.add(blk(0.05, ln, 0.1, SILVER, (0.27, 0.2 + ln / 2, dz), rx(-0.4)))
    return m, '#80b8ff'


def wraith_treads():
    """A black boot bound in tattered wrappings, with iron spikes at the heel and toe."""
    m = G('wraith_treads')
    _boot(m, CLOTH_BLACK, KK_IRON, leg_h=0.6)
    for z in (0.0, 0.18, 0.36):
        m.add(hoop(0.27, 0.04, ('#3a3644', '#6a6478'), (0, 0.08, z), 8))
    m.add(lathe([(0.07, 0.0), (0.0, 0.24)], sides=4, colors=KK_IRON).xf(rx(math.pi / 2), (0, -0.56, -0.3)))
    m.add(lathe([(0.07, 0.0), (0.0, 0.22)], sides=4, colors=KK_IRON).xf(rx(-math.pi / 2), (0, 0.32, -0.3)))
    m.add(blk(0.05, 0.3, 0.36, CLOTH_BLACK, (-0.27, 0.2, 0.1), rx(0.3)))
    return m, None


def nightfang_boots():
    """A dark red boot capped at the toe with a fang, with a red light let into the cuff."""
    m = G('nightfang_boots')
    _boot(m, ('#3a0c12', '#8a1e26'), CLOTH_BLACK)
    m.add(blk(0.46, 0.26, 0.3, STEEL_DK, (0, -0.42, -0.32)))
    m.add(lathe([(0.08, 0.0), (0.0, 0.28)], sides=4, colors=KK_BONE).xf(rx(math.pi / 2 - 0.5), (0, -0.52, -0.1)))
    m.add(cyl(0.29, 0.1, CLOTH_BLACK, (0, 0.08, 0.36), 8))
    m.add(glowing(blk(0.12, 0.05, 0.08, ('#c01010', '#ff5a30'), (0, -0.2, 0.37))))
    return m, '#ff3018'


# ── rings (worn large, to be seen) ───────────────────────────────────────────
def _band(m, colors, r=0.2, thick=0.05):
    m.add(hoop(r, thick, colors, (0, 0, 0), 10, R=rx(math.pi / 2)))


def silver_ring():
    """A plain silver band with a small pale stone."""
    m = G('silver_ring', 0.008)
    _band(m, SILVER)
    m.add(glowing(blob(0.07, 0.07, 0.07, seg=6, rings=4, colors=('#bcd6ff', '#ffffff')).xf(None, (0, 0, 0.22))))
    return m, '#cfe0ff'


def hex_amulet():
    """A six-sided violet amulet on a short chain."""
    m = G('hex_amulet', 0.008)
    _band(m, STEEL_DK, 0.2, 0.035)
    m.add(tube([(0, 0, -0.2), (0, 0, -0.36)], 0.02, sides=4, colors=STEEL_DK))
    m.add(cyl(0.17, 0.07, GOLD, (0, -0.035, -0.53), 6, R=rx(-math.pi / 2)))
    m.add(glowing(cyl(0.11, 0.09, ('#7a30e0', '#d8b0ff'), (0, -0.045, -0.53), 6, R=rx(-math.pi / 2))))
    return m, '#a060ff'


def spirit_ring():
    """A pale band with a blue light standing over it, and a thin halo round the light."""
    m = G('spirit_ring', 0.008)
    _band(m, ('#8fa6d8', '#e6eeff'))
    m.add(glowing(blob(0.09, 0.09, 0.09, seg=6, rings=4, colors=('#5a9cff', '#e0f0ff')).xf(None, (0, 0, 0.3))))
    m.add(hoop(0.15, 0.015, SILVER, (0, 0, 0.3), 8))
    return m, '#80b8ff'


def order_signet():
    """A heavy gold signet, its square face cut with the Order's red cross."""
    m = G('order_signet', 0.008)
    _band(m, GOLD, 0.2, 0.06)
    m.add(blk(0.22, 0.2, 0.08, GOLD, (0, 0, 0.2)))
    m.add(trim(blk(0.16, 0.05, 0.02, CLOTH_RED, (0, 0, 0.28))))
    m.add(trim(blk(0.05, 0.15, 0.02, CLOTH_RED, (0, 0, 0.28))))
    return m, None


def trail_ring():
    """A ring plaited of green withies with a single leaf standing on it."""
    m = G('trail_ring', 0.008)
    WITHY = ('#2f5a24', '#7ab84c')
    _band(m, WITHY, 0.2, 0.045)
    m.add(hoop(0.2, 0.03, KK_WOOD, (0, 0.03, 0), 10, R=rx(math.pi / 2) @ ry(0.3)))
    m.add(lathe([(0.0, 0.0), (0.08, 0.1), (0.0, 0.26)], sides=4, colors=WITHY).xf(ry(0.3), (0.02, 0, 0.2)))
    return m, None


def witches_boon():
    """A black band with a green five-pointed stone that gives a little light."""
    m = G('witches_boon', 0.008)
    _band(m, CLOTH_BLACK, 0.2, 0.055)
    m.add(glowing(lathe([(0.0, 0.0), (0.12, 0.0), (0.12, 0.06), (0.0, 0.06)], sides=5, colors=('#2fb85a', '#c8ffd6')).xf(None, (0, 0, 0.2))))
    return m, '#60e088'


def death_ring():
    """A band of bone with a small skull for its stone."""
    m = G('death_ring', 0.008)
    _band(m, KK_BONE, 0.2, 0.055)
    m.add(blob(0.11, 0.12, 0.11, seg=7, rings=4, colors=KK_BONE).xf(None, (0, 0, 0.3)))
    for sx in (-1, 1):
        m.add(trim(blk(0.04, 0.03, 0.04, CLOTH_BLACK, (sx * 0.045, -0.105, 0.29))))
    m.add(blk(0.09, 0.08, 0.05, KK_BONE, (0, -0.03, 0.18)))
    return m, None


def packbound_ring():
    """An iron band set with a wolf's tooth and a drop of amber."""
    m = G('packbound_ring', 0.008)
    _band(m, KK_IRON, 0.2, 0.06)
    m.add(lathe([(0.06, 0.0), (0.0, 0.26)], sides=4, colors=KK_BONE).xf(ry(0.3), (0.03, 0, 0.2)))
    m.add(glowing(blob(0.06, 0.06, 0.06, seg=5, rings=3, colors=('#e08a1a', '#ffe0a0')).xf(None, (-0.1, 0, 0.21))))
    return m, '#ffb040'


GEAR = {
    'iron_sword': iron_sword,
    'spell_tome': spell_tome,
    'yew_wand': yew_wand,
    'cursed_blade': cursed_blade,
    'shadow_staff': shadow_staff,
    'void_staff': void_staff,
    'alpha_fang': alpha_fang,
    'wizard_hat': wizard_hat,
    'bloodmoon_circlet': bloodmoon_circlet,
    'beast_crown': beast_crown,
    'spirit_veil': spirit_veil,
    'knights_helm': knights_helm,
    'travelers_hood': travelers_hood,
    'dread_helm': dread_helm,
    'shadow_crown': shadow_crown,
    'steel_shield': steel_shield,
    'witch_robe': witch_robe,
    'beast_hide': beast_hide,
    'spirit_robe': spirit_robe,
    'travelers_vest': travelers_vest,
    'bone_armor': bone_armor,
    'shadow_cloak': shadow_cloak,
    'abyssal_armor': abyssal_armor,
    'moonhowl_pelt': moonhowl_pelt,
    'leather_boots': leather_boots,
    'hexed_boots': hexed_boots,
    'paw_boots': paw_boots,
    'soul_treads': soul_treads,
    'wraith_treads': wraith_treads,
    'nightfang_boots': nightfang_boots,
    'silver_ring': silver_ring,
    'hex_amulet': hex_amulet,
    'spirit_ring': spirit_ring,
    'order_signet': order_signet,
    'trail_ring': trail_ring,
    'witches_boon': witches_boon,
    'death_ring': death_ring,
    'packbound_ring': packbound_ring,
}

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for n in (sys.argv[1:] or list(GEAR)):
        m, glow = GEAR[n]()
        path = os.path.abspath(os.path.join(OUT, n + '.glb'))
        m.export(path, glow_color=glow or '#ffffff', glow_strength=0.5)
        print(n, m.tris(), 'tris', os.path.getsize(path), 'bytes')
