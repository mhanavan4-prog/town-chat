"""The hundred legendaries (data/legendaryCatalog.js), a model each, to the same measure and the same seats as
build_gear.py (which builds them: `sh tools/models/build.sh gear lg_...`). Each is drawn from the item's own
name and the line the catalogue gives it."""
import math
import numpy as np
from trlib import *  # noqa
from build_home import blk, trim, glowing, KK_STONE, KK_STONE_DK, KK_STONE_LT, KK_WOOD, KK_WOOD_DK, KK_WOOD_CHAR, KK_IRON, KK_MOSS, KK_BONE  # noqa
from build_gear import (G, cyl, hoop, shell, _dome, _mantle, _boot, _band, STEEL, STEEL_DK, GOLD, LEATHER, LEATHER_DK, CLOTH_RED,
                        CLOTH_VIOLET, CLOTH_GREEN, CLOTH_BLUE, CLOTH_BLACK, SILVER, SHADOW)

COPPER = ('#8a4a22', '#e0935a'); BRASS = ('#7a5a1a', '#f0cc60'); RUST = ('#4a2a1c', '#9a5a34'); THORN = ('#1e2a18', '#4c6a34')
WAX = ('#d8c690', '#fbf3d2'); CREAM = ('#cdbf9c', '#f7f0dc'); ICE = ('#7fb4d8', '#e8f6ff'); NIGHT = ('#10142e', '#2c3a78')
FLAME = ('#ff9a1e', '#fff0a0'); WISP = ('#2fd0a8', '#d8fff0'); MOON = ('#bcd0ff', '#ffffff'); EMBER = ('#e0401a', '#ffc060')
ROSE = ('#8a1430', '#e04a6a'); FEATHER = ('#0e0e16', '#2a3050'); WILLOW = ('#6a7a2a', '#b8c85a'); PLUM = ('#2c1426', '#6a3458')
HONEY = ('#b87a14', '#f6cf5a'); TEAL = ('#124a4e', '#3aa8a0'); WHITE = ('#c8ccd4', '#ffffff'); FUR_GREY = ('#4a4e58', '#a8aeb8')


def cone(r, h, colors, at=(0, 0, 0), sides=4, R=None, phase=0.0):
    return lathe([(r, 0.0), (0.0, h)], sides=sides, colors=colors, phase=phase).xf(R, at)


def ball(r, colors, at=(0, 0, 0), seg=6, rings=4, sq=1.0):
    return blob(r, r, r * sq, seg=seg, rings=rings, colors=colors).xf(None, at)


def disc(r, h, colors, at=(0, 0, 0), sides=8, R=None):
    return cyl(r, h, colors, at, sides, R=R)


def flame(at, s=1.0, colors=FLAME):
    """A small flame standing at `at`."""
    return glowing(lathe([(0.0, 0.0), (0.06 * s, 0.05 * s), (0.045 * s, 0.12 * s), (0.0, 0.24 * s)], sides=5, colors=colors).xf(None, at))


def candle(m, at, h=0.22, r=0.045, lit=True, colors=WAX, s=1.0):
    m.add(cyl(r, h, colors, at, 6))
    if lit:
        m.add(flame((at[0], at[1], at[2] + h), s))


def _grip(m, colors=LEATHER, pommel=STEEL_DK, r=0.05, z0=-0.18, h=0.26):
    m.add(cyl(r, h, colors, (0, 0, z0), 6))
    if pommel:
        m.add(cyl(r * 1.7, 0.07, pommel, (0, 0, z0 - 0.07), 8))


def _pole(m, colors, length=2.2, z0=-0.75, r=0.05):
    m.add(cyl(r, length, colors, (0, 0, z0), 6, r_top=r * 0.85))


# ── weapons: the grip at the origin, the business end up +Z ───────────────────
def lg_thornreach_fang():
    """A thorn off the town wall, long as a forearm, carried as a dagger: black-green, curved, with lesser thorns
    down its back and a grip of bound vine."""
    m = G('lg_thornreach_fang')
    m.add(tube([(0, 0, 0.1), (0.02, 0, 0.5), (0.12, 0, 0.9), (0.34, 0, 1.25)], [0.14, 0.12, 0.08, 0.012], sides=6, colors=THORN, cap_base=True))
    for (x, z, a) in ((-0.1, 0.4, -0.9), (-0.06, 0.7, -0.8), (0.0, 0.95, -0.6)):
        m.add(cone(0.05, 0.22, THORN, (x, 0, z), 4, ry(a)))
    m.add(cyl(0.17, 0.08, KK_WOOD_DK, (0, 0, 0.04), 7))
    m.add(cyl(0.055, 0.28, KK_WOOD, (0, 0, -0.22), 6))
    for z in (-0.16, -0.06):
        m.add(hoop(0.065, 0.02, WILLOW, (0, 0, z), 6))
    m.add(glowing(ball(0.035, ('#b01020', '#ff5060'), (0.34, 0, 1.25), 5, 3)))          # it never quite stopped bleeding
    return m, '#ff4050'


def lg_lantern_saber():
    """A curved sabre forged round a wick: a warm light runs up the fuller, and a little lantern is the guard."""
    m = G('lg_lantern_saber')
    pts = [(0, 0.18), (0.03, 0.5), (0.1, 0.82), (0.22, 1.12), (0.4, 1.38)]
    for k in range(len(pts) - 1):
        (x0, z0), (x1, z1) = pts[k], pts[k + 1]
        a = math.atan2(x1 - x0, z1 - z0); ln = math.hypot(x1 - x0, z1 - z0) + 0.03
        w = 0.2 - 0.035 * k
        m.add(blk(w, 0.055, ln, STEEL, (x0, 0, z0), ry(a)))
        m.add(glowing(blk(w * 0.3, 0.07, ln, FLAME, (x0, 0, z0), ry(a))))
    m.add(cyl(0.13, 0.16, BRASS, (0, 0, 0.04), 6))                                  # the lantern at the guard
    m.add(glowing(cyl(0.09, 0.1, FLAME, (0, 0, 0.07), 6)))
    m.add(cone(0.15, 0.08, BRASS, (0, 0, 0.2), 6))
    m.add(tube([(0.12, 0, 0.06), (0.26, 0, -0.06), (0.2, 0, -0.22), (0.05, 0, -0.26)], 0.025, sides=4, colors=BRASS))   # knuckle-bow
    _grip(m, LEATHER_DK, BRASS)
    return m, '#ffc050'


def lg_bogiron_cleaver():
    """A cleaver pulled whole from the marsh: a broad square blade of brown bog-iron, pitted, mossed, a hole at
    the corner to hang it by."""
    m = G('lg_bogiron_cleaver')
    m.add(blk(0.62, 0.07, 0.95, RUST, (0.2, 0, 0.2)))
    m.add(blk(0.1, 0.09, 1.0, KK_IRON, (-0.1, 0, 0.18)))                             # the thick back
    m.add(trim(disc(0.07, 0.09, CLOTH_BLACK, (0.38, 0.045, 1.0), 6, rx(math.pi / 2))))   # the hole
    for (x, z, r, sd) in ((0.3, 0.3, 0.13, 1), (0.08, 0.8, 0.1, 2), (0.42, 0.62, 0.08, 3)):
        m.add(blob(r, 0.05, r, seg=6, rings=3, colors=KK_MOSS, jitter=0.1, seed=sd).xf(None, (x, -0.03, z)))
    m.add(cyl(0.065, 0.36, KK_WOOD_DK, (-0.1, 0, -0.22), 6))
    m.add(hoop(0.075, 0.025, KK_IRON, (-0.1, 0, 0.1), 6))
    return m, None


def lg_vesper_rod():
    """A slender rod tuned to the minute of dusk: a two-pronged fork at its head, the last light of the day held
    between the prongs."""
    m = G('lg_vesper_rod', 0.008)
    DUSK = ('#3a2450', '#8a5aa8')
    m.add(cyl(0.04, 1.35, DUSK, (0, 0, -0.3), 6))
    for sx in (-1, 1):
        m.add(tube([(0, 0, 1.03), (sx * 0.13, 0, 1.12), (sx * 0.13, 0, 1.62)], 0.032, sides=5, colors=SILVER))
    m.add(glowing(ball(0.085, ('#ff7a2a', '#ffd9a0'), (0, 0, 1.38), 7, 5)))
    for z in (-0.05, 0.2, 0.95):
        m.add(hoop(0.05, 0.02, GOLD, (0, 0, z), 6))
    m.add(cone(0.05, 0.12, GOLD, (0, 0, -0.3), 5, rx(math.pi)))
    return m, '#ff9040'


def lg_pallbearer_maul():
    """A long-hafted maul whose head is a small coffin, lid on, with the brass handles it was carried by."""
    m = G('lg_pallbearer_maul')
    _pole(m, KK_WOOD_CHAR, 1.75, -0.45, 0.055)
    BOX = ('#241812', '#5a3a26')
    R = ry(math.pi / 2)
    m.add(lathe([(0.0, 0.0), (0.2, 0.0), (0.3, 0.26), (0.19, 0.9), (0.0, 0.9)], sides=6, colors=BOX).xf(R, (-0.45, 0, 1.38)))   # the coffin, lying across
    m.add(blk(0.78, 0.04, 0.06, BRASS, (0, -0.27, 1.35)))
    m.add(trim(blk(0.06, 0.03, 0.3, SILVER, (0.05, -0.29, 1.23))))                    # the cross on the lid
    m.add(trim(blk(0.2, 0.03, 0.06, SILVER, (0.05, -0.29, 1.4))))
    for x in (-0.25, 0.22):
        m.add(tube([(x, 0.26, 1.3), (x, 0.36, 1.38), (x, 0.26, 1.46)], 0.02, sides=4, colors=BRASS))
    m.add(hoop(0.07, 0.025, KK_IRON, (0, 0, 1.08), 6))
    return m, None


def lg_hedgewitch_switch():
    """A willow switch, long and whippy, bent with use, a few leaves left on it and a red thread tied in a bow."""
    m = G('lg_hedgewitch_switch', 0.006)
    m.add(tube([(0, 0, -0.2), (0, 0, 0.3), (0.04, 0, 0.8), (0.16, 0, 1.25), (0.4, 0, 1.6)], [0.045, 0.04, 0.03, 0.02, 0.008], sides=5, colors=WILLOW, cap_base=True))
    for (x, z, a) in ((0.03, 0.7, 0.9), (0.1, 1.05, -0.7), (0.2, 1.32, 1.0), (0.3, 1.48, -0.5)):
        m.add(lathe([(0.0, 0.0), (0.045, 0.1), (0.0, 0.26)], sides=4, colors=('#4a7a2a', '#a8d060')).xf(ry(a), (x, 0, z)))
    for sx in (-1, 1):
        m.add(lathe([(0.0, 0.0), (0.07, 0.12), (0.0, 0.16)], sides=4, colors=CLOTH_RED).xf(ry(sx * 1.3), (0, 0, 0.12)))
    m.add(hoop(0.05, 0.022, CLOTH_RED, (0, 0, 0.12), 6))
    return m, None


def lg_ratcatcher_pike():
    """A long pike with a hook under the head, and the day's tails hanging from it on a cord."""
    m = G('lg_ratcatcher_pike')
    _pole(m, KK_WOOD, 2.1, -0.75, 0.05)
    m.add(lathe([(0.0, 0.0), (0.1, 0.06), (0.07, 0.2), (0.0, 0.6)], sides=4, colors=STEEL).xf(None, (0, 0, 1.35)))
    m.add(tube([(0.0, 0, 1.3), (0.2, 0, 1.3), (0.26, 0, 1.18), (0.16, 0, 1.1)], [0.035, 0.035, 0.03, 0.01], sides=4, colors=STEEL_DK))   # the hook
    m.add(cyl(0.065, 0.12, STEEL_DK, (0, 0, 1.24), 6))
    TAIL = ('#8a5a5a', '#d8a0a0')
    for k, (x, ln) in enumerate(((-0.07, 0.42), (-0.13, 0.34), (-0.19, 0.46))):
        m.add(tube([(x, 0, 1.2), (x - 0.02, 0.02, 1.2 - ln * 0.5), (x + 0.03, 0, 1.2 - ln)], [0.022, 0.018, 0.005], sides=4, colors=TAIL))
    m.add(tube([(0, 0, 1.22), (-0.22, 0, 1.2)], 0.012, sides=4, colors=LEATHER_DK))
    return m, None


def lg_candlewax_kris():
    """A wavy dagger of cold iron under a skin of candle wax, run in drips at the guard, a wick alight at the point."""
    m = G('lg_candlewax_kris')
    zs = np.linspace(0.14, 1.05, 6)
    for k in range(5):
        x0 = 0.07 * (1 if k % 2 else -1); x1 = -x0
        a = math.atan2(x1 - x0, zs[k + 1] - zs[k]); ln = math.hypot(x1 - x0, zs[k + 1] - zs[k]) + 0.04
        w = 0.19 - 0.025 * k
        m.add(blk(w, 0.07, ln, WAX, (x0, 0, zs[k]), ry(a)))
        m.add(blk(w + 0.05, 0.03, ln, KK_IRON, (x0, 0, zs[k]), ry(a)))                # the iron showing at the edges
    m.add(flame((0.07, 0, 1.06), 0.9))
    m.add(blk(0.46, 0.13, 0.1, WAX, (0, 0, 0.06)))
    for (x, ln) in ((-0.18, 0.16), (0.02, 0.1), (0.17, 0.2)):
        m.add(cone(0.035, ln, WAX, (x, -0.04, 0.06), 5, rx(math.pi)))                 # drips
    _grip(m, KK_IRON, KK_IRON)
    return m, '#ffc050'


def lg_gravewind_scythe():
    """A scythe on a bent snath, its long blade pale and cold at the edge, a tatter of shroud at the neck."""
    m = G('lg_gravewind_scythe')
    m.add(tube([(0, 0, -0.75), (0, 0, 0.6), (0.04, 0, 1.2), (0.0, 0, 1.6)], 0.05, sides=6, colors=KK_WOOD_CHAR, cap_base=True))
    pts = [(0.0, 1.58), (0.4, 1.74), (0.8, 1.66), (1.12, 1.4), (1.3, 1.05)]
    m.add(tube([(x, 0, z) for (x, z) in pts], [0.11, 0.1, 0.085, 0.06, 0.008], sides=4, colors=STEEL))
    m.add(glowing(tube([(x, 0, z - 0.07) for (x, z) in pts[1:]], [0.03, 0.03, 0.025, 0.005], sides=4, colors=('#8fe0c0', '#e8fff4'))))
    m.add(blk(0.05, 0.16, 0.05, KK_WOOD_CHAR, (0, -0.16, 0.5)))                       # the hand-grip
    m.add(tube([(0, 0.02, 1.5), (-0.05, 0.1, 1.2), (0.02, 0.14, 0.95)], [0.07, 0.06, 0.01], sides=4, colors=('#4a4a52', '#9a9aa4')))
    m.add(hoop(0.065, 0.025, KK_IRON, (0, 0, 1.52), 6))
    return m, '#a0f0d0'


def lg_stormcall_wand():
    """A thornwood wand with a stoppered bottle of thunder lashed to its end, and a fork of lightning out of the cork."""
    m = G('lg_stormcall_wand', 0.008)
    m.add(tube([(0, 0, -0.18), (0.015, 0, 0.3), (-0.02, 0, 0.62), (0.0, 0, 0.84)], [0.05, 0.045, 0.04, 0.035], sides=6, colors=KK_WOOD_DK, cap_base=True))
    for (z, a) in ((0.2, 1.0), (0.5, -1.1)):
        m.add(cone(0.03, 0.12, KK_WOOD_DK, (0, 0, z), 4, ry(a)))
    m.add(glowing(blob(0.13, 0.13, 0.17, seg=7, rings=5, colors=('#3a5ad0', '#c8dcff')).xf(None, (0, 0, 0.98))))   # the bottle
    m.add(cyl(0.055, 0.1, KK_WOOD, (0, 0, 1.13), 6))                                  # its cork
    for z in (0.86, 0.94):
        m.add(hoop(0.11, 0.018, LEATHER, (0, 0, z), 7))
    bolt = [(0, 1.22), (0.1, 1.36), (-0.03, 1.42), (0.09, 1.62)]
    m.add(glowing(tube([(x, 0, z) for (x, z) in bolt], [0.035, 0.03, 0.03, 0.006], sides=4, colors=('#ffe24a', '#ffffff'))))
    return m, '#ffe860'


def lg_moonlit_rapier():
    """A rapier as thin as a moonbeam, pale along its length, with a cup guard and a crescent for a pommel."""
    m = G('lg_moonlit_rapier', 0.008)
    m.add(glowing(lathe([(0.035, 0.0), (0.028, 1.2), (0.0, 1.55)], sides=4, colors=MOON).xf(None, (0, 0, 0.14))))
    m.add(lathe([(0.03, 0.0), (0.18, 0.05), (0.22, 0.16)], sides=8, colors=SILVER, close_top=False).xf(rx(math.pi), (0, 0, 0.18)))   # the cup, open toward the hand
    m.add(tube([(0.2, 0, 0.04), (0.24, 0, -0.1), (0.14, 0, -0.24), (0.02, 0, -0.26)], 0.02, sides=4, colors=SILVER))
    m.add(cyl(0.04, 0.26, CLOTH_BLUE, (0, 0, -0.2), 6))
    m.add(tube([(-0.09, 0, -0.2), (-0.11, 0, -0.3), (0.0, 0, -0.38), (0.11, 0, -0.3), (0.09, 0, -0.2)], [0.008, 0.03, 0.04, 0.03, 0.008], sides=4, colors=SILVER))   # the crescent
    return m, '#cfe0ff'


def lg_covenfire_staff():
    """A tall black staff crowned with an iron wheel of candles: some burn, three stand dark, still owed."""
    m = G('lg_covenfire_staff')
    _pole(m, KK_WOOD_CHAR, 2.1, -0.75, 0.055)
    m.add(disc(0.34, 0.05, KK_IRON, (0, 0, 1.36), 10))
    m.add(cone(0.12, 0.2, KK_IRON, (0, 0, 1.16), 6, rx(math.pi), 0))
    m.add(cyl(0.07, 0.2, KK_IRON, (0, 0, 1.16), 6))
    for k in range(7):
        a = k * TAU / 7
        candle(m, (0.27 * math.cos(a), 0.27 * math.sin(a), 1.41), 0.2 + 0.05 * (k % 3), 0.04, lit=(k not in (1, 3, 6)), colors=WAX if k not in (1, 3, 6) else ('#3a3440', '#6a6474'))
    candle(m, (0, 0, 1.41), 0.42, 0.06, True, ('#7a1a2a', '#c84a4a'), 1.4)
    m.add(cyl(0.07, 0.07, KK_IRON, (0, 0, -0.75), 6))
    return m, '#ffb040'


def lg_briarheart_bow():
    """A bow of briar, strung with the vine that held the orchard gate: thorned limbs, a rose where the hand goes."""
    m = G('lg_briarheart_bow', 0.008)
    limb = [(0.0, -1.05), (0.26, -0.7), (0.34, -0.3), (0.3, 0.0), (0.34, 0.3), (0.26, 0.7), (0.0, 1.05)]
    m.add(tube([(x - 0.3, 0, z) for (x, z) in limb], [0.02, 0.045, 0.06, 0.065, 0.06, 0.045, 0.02], sides=5, colors=THORN))
    m.add(tube([(-0.3, 0, -1.05), (-0.3, 0, 1.05)], 0.012, sides=4, colors=WILLOW))    # the string
    for (x, z, a) in ((0.0, -0.55, 1.9), (0.03, 0.4, 1.3), (-0.06, 0.8, 1.0), (-0.07, -0.85, 2.2)):
        m.add(cone(0.035, 0.14, THORN, (x, 0, z), 4, ry(a)))
    m.add(ball(0.1, ROSE, (0.04, -0.05, 0.0), 6, 4, 0.8))                              # the rose
    m.add(glowing(ball(0.04, ('#ff6a8a', '#ffd0dc'), (0.04, -0.12, 0.0), 5, 3)))
    for z in (-0.14, 0.14):
        m.add(hoop(0.075, 0.02, WILLOW, (0, 0, z), 6))
    return m, '#ff7090'


def lg_howlback_axe():
    """A broad axe whose blade is cut like a wolf's open jaw, toothed along the bite, its haft bound in grey fur."""
    m = G('lg_howlback_axe')
    _pole(m, KK_WOOD_DK, 1.7, -0.5, 0.055)
    m.add(blk(0.2, 0.12, 0.3, STEEL_DK, (0, 0, 0.82)))                                # the eye
    m.add(tube([(0.08, 0, 1.12), (0.4, 0, 1.3), (0.7, 0, 1.22)], [0.11, 0.1, 0.02], sides=4, colors=STEEL))      # upper jaw
    m.add(tube([(0.08, 0, 0.84), (0.4, 0, 0.64), (0.7, 0, 0.72)], [0.11, 0.1, 0.02], sides=4, colors=STEEL))     # lower jaw
    m.add(blk(0.3, 0.08, 0.34, STEEL, (0.2, 0, 0.8)))
    for x in (0.34, 0.46, 0.58):
        m.add(cone(0.035, 0.12, KK_BONE, (x, 0, 1.19 - (x - 0.34) * 0.2), 4, rx(math.pi)))
        m.add(cone(0.035, 0.12, KK_BONE, (x, 0, 0.75 + (x - 0.34) * 0.2), 4))
    for sy in (-1, 1):
        m.add(cone(0.07, 0.2, STEEL_DK, (-0.06, sy * 0.05, 1.1), 4, ry(-0.4)))           # ears
    m.add(glowing(ball(0.035, ('#ffb020', '#fff0b0'), (0.14, -0.07, 1.04), 5, 3)))
    m.add(blob(0.09, 0.09, 0.2, seg=7, rings=4, colors=FUR_GREY, jitter=0.03, seed=2).xf(None, (0, 0, 0.0)))
    return m, '#ffc040'


def lg_riddlebone_cane():
    """A cane of knuckled bone whose handle hooks over like a question; a small stone sits where the dot would."""
    m = G('lg_riddlebone_cane')
    m.add(cyl(0.05, 1.3, KK_BONE, (0, 0, -0.6), 6, r_top=0.045))
    for z in (-0.3, 0.05, 0.4):
        m.add(ball(0.07, KK_BONE, (0, 0, z), 6, 4, 0.7))
    m.add(tube([(0, 0, 0.7), (0.0, 0, 0.9), (0.14, 0, 1.08), (0.32, 0, 1.0), (0.34, 0, 0.82), (0.22, 0, 0.72)], [0.05, 0.05, 0.05, 0.045, 0.04, 0.025], sides=6, colors=KK_BONE))
    m.add(glowing(ball(0.05, ('#70c8ff', '#e0f6ff'), (0.2, 0, 0.56), 5, 3)))
    m.add(cone(0.05, 0.1, KK_IRON, (0, 0, -0.6), 5, rx(math.pi)))
    return m, '#80d0ff'


def lg_eclipse_blade():
    """A black sword quenched mid-eclipse: on the blade above the cross sits a dark disc ringed with fire."""
    m = G('lg_eclipse_blade')
    BLK = ('#101018', '#34344a')
    m.add(blk(0.24, 0.06, 1.3, BLK, (0, 0, 0.16)))
    m.add(cone(0.12, 0.24, BLK, (0, 0, 1.46), 4, None, math.pi / 4))
    m.add(glowing(disc(0.24, 0.05, ('#ff9a1e', '#fff0a0'), (0, 0.025, 0.42), 12, rx(math.pi / 2))))   # the corona
    m.add(trim(disc(0.19, 0.09, ('#06060a', '#14141c'), (0, 0.045, 0.42), 12, rx(math.pi / 2))))      # the dark of the moon
    m.add(tube([(-0.36, 0, 0.16), (-0.2, 0, 0.08), (0.2, 0, 0.08), (0.36, 0, 0.16)], [0.02, 0.05, 0.05, 0.02], sides=4, colors=GOLD))
    _grip(m, CLOTH_BLACK, GOLD)
    return m, '#ffb030'


def lg_wispfire_scepter():
    """A short scepter with an open cage for a head, a marsh-light living in it and two smaller ones in tow."""
    m = G('lg_wispfire_scepter', 0.008)
    m.add(cyl(0.045, 0.9, ('#2a3a34', '#5a7a6a'), (0, 0, -0.25), 6))
    for k in range(4):
        a = k * TAU / 4
        c, s_ = math.cos(a), math.sin(a)
        m.add(tube([(0.06 * c, 0.06 * s_, 0.65), (0.2 * c, 0.2 * s_, 0.85), (0.16 * c, 0.16 * s_, 1.08), (0.0, 0.0, 1.2)], 0.022, sides=4, colors=COPPER))
    m.add(glowing(blob(0.11, 0.11, 0.15, seg=6, rings=5, colors=WISP).xf(None, (0, 0, 0.92))))
    for (x, y, z, r) in ((0.3, 0.05, 1.25, 0.05), (-0.26, -0.08, 1.05, 0.04)):
        m.add(glowing(ball(r, WISP, (x, y, z), 5, 3)))
    m.add(hoop(0.07, 0.025, COPPER, (0, 0, 0.64), 6))
    m.add(ball(0.07, COPPER, (0, 0, -0.27), 6, 4))
    return m, '#60ffd0'


def lg_thornqueen_glaive():
    """The twelfth glaive of the Thorn Queen's guard: a long curved blade on a green haft, a gold crown at its
    neck and a red tassel."""
    m = G('lg_thornqueen_glaive')
    _pole(m, ('#1c3a22', '#3f6a3a'), 2.0, -0.75, 0.05)
    m.add(tube([(0, 0, 1.3), (0.06, 0, 1.6), (0.2, 0, 1.92), (0.42, 0, 2.15)], [0.13, 0.14, 0.1, 0.01], sides=4, colors=STEEL))
    m.add(cone(0.05, 0.2, STEEL, (-0.08, 0, 1.5), 4, ry(-1.1)))                       # the back-spike
    m.add(cyl(0.09, 0.1, GOLD, (0, 0, 1.2), 8, r_top=0.12))
    for k in range(5):
        a = k * TAU / 5
        m.add(cone(0.03, 0.1, GOLD, (0.11 * math.cos(a), 0.11 * math.sin(a), 1.3), 4))
    m.add(tube([(0.06, 0, 1.18), (0.16, 0, 1.05), (0.14, 0, 0.82)], [0.03, 0.05, 0.01], sides=5, colors=CLOTH_RED))
    for (z, a) in ((0.5, 1.1), (0.85, -1.0)):
        m.add(cone(0.03, 0.12, THORN, (0, 0, z), 4, ry(a)))
    return m, None


def lg_severance_shard():
    """An edge broken off the night the Wilds tore loose: a jagged shard, town-stone pale on one face and
    Wilds-green on the other, light in the break between them; a rag for a grip."""
    m = G('lg_severance_shard')
    m.add(lathe([(0.0, 0.0), (0.2, 0.1), (0.26, 0.5), (0.14, 1.0), (0.0, 1.5)], sides=5, colors=KK_STONE_LT).xf(None, (-0.045, 0, 0.1)))
    m.add(lathe([(0.0, 0.0), (0.18, 0.14), (0.22, 0.56), (0.1, 0.9), (0.0, 1.3)], sides=5, colors=('#1c4a2c', '#5aa860'), phase=0.6).xf(None, (0.07, 0, 0.1)))
    m.add(glowing(blk(0.035, 0.3, 1.15, ('#9af0ff', '#ffffff'), (0.015, 0, 0.16))))
    m.add(cyl(0.065, 0.32, ('#6a5a48', '#b8a888'), (0, 0, -0.2), 6))
    for z in (-0.14, -0.04, 0.06):
        m.add(hoop(0.072, 0.018, LEATHER_DK, (0, 0, z), 6))
    m.add(tube([(0.05, 0, -0.2), (0.12, 0.02, -0.36), (0.08, 0, -0.5)], [0.03, 0.03, 0.008], sides=4, colors=('#6a5a48', '#b8a888')))
    return m, '#a0f0ff'


def lg_first_lantern():
    """The lantern Lanternside Bay is named for, carried on a short crook: iron frame, horn panes, a steady gold light."""
    m = G('lg_first_lantern')
    m.add(tube([(0, 0, -0.3), (0, 0, 0.75), (0.1, 0, 0.98), (0.3, 0, 1.02), (0.4, 0, 0.9)], 0.045, sides=6, colors=KK_WOOD_DK, cap_base=True))
    m.add(tube([(0.4, 0, 0.9), (0.4, 0, 0.78)], 0.015, sides=4, colors=KK_IRON))
    m.add(cone(0.2, 0.14, KK_IRON, (0.4, 0, 0.66), 6))                                 # the cap
    m.add(glowing(cyl(0.13, 0.3, ('#ffb428', '#fff4b8'), (0.4, 0, 0.36), 6)))
    m.add(disc(0.17, 0.05, KK_IRON, (0.4, 0, 0.31), 6))
    for k in range(6):
        a = k * TAU / 6
        m.add(blk(0.025, 0.025, 0.32, KK_IRON, (0.4 + 0.15 * math.cos(a), 0.15 * math.sin(a), 0.35)))
    m.add(hoop(0.05, 0.015, KK_IRON, (0.4, 0, 0.8), 6, rx(math.pi / 2)))
    return m, '#ffc840'


# ── heads: the origin at the crown; the head a ball about 1.0 across the radius, its middle 0.55 below; face -Y ──
def _round(n, r, z, a0=0.0, span=TAU):
    """n places round the head at radius r, height z: (x, y, z, angle), the first at the brow."""
    out = []
    for k in range(n):
        a = a0 + span * k / n
        out.append((r * math.sin(a), -r * math.cos(a), z, a))
    return out


def lg_owlfeather_hood():
    """A hood of barred brown feathers with two ear-tufts, great round eye-rings and a beak at the brow."""
    m = G('lg_owlfeather_hood')
    OWL = ('#4a3420', '#b08a5a'); PALE = ('#b8a078', '#f0e2c0')
    m.add(shell([(1.22, -1.4), (1.2, -0.4), (1.1, 0.1)], OWL, gap=1.8))
    m.add(_dome(OWL, r=1.12, z0=0.08, top=0.82))
    for sx in (-1, 1):
        m.add(cone(0.2, 0.62, OWL, (sx * 0.72, -0.3, 0.46), 4, ry(sx * 0.4)))             # ear-tufts
        m.add(disc(0.34, 0.07, PALE, (sx * 0.52, -1.0, 0.02), 8, rx(math.pi / 2 + 0.3)))  # eye-rings on the brow
        m.add(trim(disc(0.16, 0.09, ('#e0a020', '#ffd860'), (sx * 0.52, -1.03, 0.02), 6, rx(math.pi / 2 + 0.3))))
    m.add(cone(0.12, 0.3, ('#3a3020', '#8a7a50'), (0, -1.12, -0.1), 4, rx(math.pi * 0.75)))  # the beak
    for (x, y, z, a) in _round(7, 1.24, -1.1, a0=1.2, span=TAU - 2.4):
        m.add(lathe([(0.0, 0.0), (0.16, 0.12), (0.0, 0.42)], sides=4, colors=PALE).xf(rx(math.pi), (x, y, z + 0.3)))   # feather-ends
    return m, None


def lg_stargazer_circlet():
    """A copper circlet bent into a constellation: five stars on wires over the brow, joined star to star."""
    m = G('lg_stargazer_circlet', 0.008)
    m.add(hoop(1.04, 0.07, COPPER, (0, 0, -0.15), 14))
    stars = [(-0.7, -0.9, 0.34), (-0.34, -1.06, 0.74), (0.06, -1.1, 0.42), (0.44, -1.02, 0.9), (0.8, -0.8, 0.5)]
    for k, (x, y, z) in enumerate(stars):
        m.add(tube([(x, y * 0.96, -0.14), (x, y, z)], 0.025, sides=4, colors=COPPER))
        m.add(glowing(lathe([(0.0, -0.17), (0.12, 0.0), (0.0, 0.17)], sides=4, colors=('#fff0a0', '#ffffff')).xf(None, (x, y, z))))
        if k:
            m.add(tube([stars[k - 1], (x, y, z)], 0.02, sides=4, colors=COPPER))
    return m, '#fff0b0'


def lg_mourning_veil():
    """A small black hat pinned with a black rose, and a long veil falling from it behind and down both sides."""
    m = G('lg_mourning_veil')
    m.add(cyl(0.7, 0.34, CLOTH_BLACK, (0, 0.05, 0.36), 10, r_top=0.62))
    m.add(cyl(0.92, 0.06, CLOTH_BLACK, (0, 0.05, 0.34), 10))
    m.add(shell([(1.3, -2.3), (1.24, -1.1), (1.14, -0.2), (0.86, 0.38)], ('#1a1820', '#4a4658'), gap=2.5, sides=10, thick=0.04))
    m.add(shell([(1.2, -0.02), (1.16, 0.12), (0.88, 0.38)], ('#1a1820', '#4a4658'), gap=0.0, sides=12, thick=0.03))   # the veil's edge, lifted off the brow
    m.add(ball(0.2, ('#0c0a10', '#3a2a3a'), (0.56, -0.44, 0.56), 6, 4, 0.7))
    m.add(lathe([(0.0, 0.0), (0.1, 0.1), (0.0, 0.32)], sides=4, colors=('#18301c', '#3a5a34')).xf(ry(1.2), (0.68, -0.44, 0.54)))
    return m, None


def lg_hearthkeeper_bonnet():
    """A soft cream bonnet, gathered full on the crown, a frill framing the face, an ember-red ribbon tied under."""
    m = G('lg_hearthkeeper_bonnet')
    m.add(blob(1.16, 1.2, 0.8, seg=10, rings=5, colors=CREAM).xf(None, (0, 0.18, 0.0)))
    m.add(shell([(1.3, -0.95), (1.34, -0.1), (1.22, 0.3)], WHITE, gap=1.9, sides=12, thick=0.08).xf(None, (0, -0.06, 0)))   # the frill
    m.add(hoop(1.14, 0.06, ('#a02a1a', '#e8603a'), (0, 0.12, -0.02), 12))
    for sx in (-1, 1):
        m.add(tube([(sx * 1.0, -0.5, -0.9), (sx * 0.6, -0.9, -1.5), (sx * 0.12, -1.0, -1.72)], 0.05, sides=4, colors=('#a02a1a', '#e8603a')))
        m.add(lathe([(0.0, 0.0), (0.14, 0.16), (0.0, 0.24)], sides=4, colors=('#a02a1a', '#e8603a')).xf(ry(sx * 1.9), (sx * 0.1, -1.02, -1.74)))
    return m, None


def lg_toadstool_cap():
    """A red toadstool for a hat, spotted white, pale gills showing under its rim."""
    m = G('lg_toadstool_cap')
    RED = ('#8a1414', '#e23a2a')
    m.add(lathe([(1.62, -0.2), (1.5, 0.16), (1.02, 0.6), (0.0, 0.82)], sides=12, colors=RED, close_top=False))
    m.add(lathe([(0.9, -0.34), (1.6, -0.2)], sides=12, colors=CREAM, close_top=False))    # the gills
    for (a, r, z, s) in ((0.2, 1.3, 0.36, 0.2), (1.5, 1.18, 0.5, 0.16), (2.9, 1.34, 0.32, 0.22), (4.2, 1.1, 0.56, 0.15), (5.3, 1.36, 0.3, 0.18), (3.6, 0.5, 0.76, 0.17), (0.9, 0.6, 0.74, 0.14)):
        m.add(blob(s, s, 0.06, seg=6, rings=3, colors=WHITE).xf(None, (r * math.sin(a), -r * math.cos(a), z)))
    return m, None


def lg_ferryman_tricorn():
    """A salt-stiff navy tricorn, its three sides cocked up and edged in tarnished gold, a brass coin for a cockade."""
    m = G('lg_ferryman_tricorn')
    NAVY = ('#141c34', '#34487a')
    m.add(cyl(1.02, 0.6, NAVY, (0, 0, 0.1), 10, r_top=0.86))
    ph = -math.pi / 2                                    # a corner to the front
    m.add(lathe([(0.9, 0.12), (2.0, 0.1), (1.72, 0.74), (1.62, 0.74), (1.0, 0.22)], sides=3, colors=NAVY, close_top=False, phase=ph))
    m.add(lathe([(1.74, 0.7), (1.72, 0.8), (1.6, 0.8), (1.6, 0.7)], sides=3, colors=GOLD, close_top=False, phase=ph))
    m.add(trim(disc(0.16, 0.06, BRASS, (-0.52, -0.56, 0.62), 8, rz(-math.pi / 3) @ rx(math.pi / 2 + 0.4))))
    return m, None


def lg_candlecrown():
    """A gold circlet set with nine candles, each alight, the wax run down a little way and stopped."""
    m = G('lg_candlecrown')
    m.add(lathe([(1.0, -0.26), (1.06, -0.02), (1.0, 0.0)], sides=14, colors=GOLD, close_top=False))
    for k, (x, y, z, a) in enumerate(_round(9, 1.03, 0.0)):
        h = 0.3 + 0.1 * ((k * 5) % 3)
        candle(m, (x, y, z), h, 0.075, True, WAX, 1.5)
        m.add(disc(0.11, 0.03, GOLD, (x, y, z - 0.01), 6))
    return m, '#ffc050'


def lg_briar_diadem():
    """Two briars plaited into a crown, the thorns turned inward and upward, one red rose at the brow."""
    m = G('lg_briar_diadem', 0.008)
    m.add(hoop(1.03, 0.07, THORN, (0, 0, -0.18), 14))
    m.add(hoop(1.03, 0.055, ('#3a2416', '#6a4a2a'), (0, 0, -0.06), 14, rx(0.08)))
    for k, (x, y, z, a) in enumerate(_round(11, 1.03, -0.1, a0=0.28)):
        m.add(cone(0.05, 0.3 if k % 2 else 0.2, THORN, (x, y, z), 4, rz(a) @ rx(0.5 if k % 2 else -0.3)))
    m.add(ball(0.17, ROSE, (0, -1.1, -0.1), 6, 4, 0.8))
    m.add(trim(ball(0.08, ('#5a0a1c', '#a02040'), (0, -1.2, -0.1), 5, 3)))
    for sx in (-1, 1):
        m.add(lathe([(0.0, 0.0), (0.08, 0.1), (0.0, 0.26)], sides=4, colors=('#2a5a24', '#6aa84a')).xf(ry(sx * 1.6), (sx * 0.12, -1.08, -0.12)))
    return m, None


def lg_frostwarden_helm():
    """An open helm of blue-white steel with a nasal bar, a crest of icicles and a rim of white fur."""
    m = G('lg_frostwarden_helm')
    m.add(_dome(ICE, r=1.14, z0=0.0, top=0.8))
    m.add(shell([(1.2, -1.2), (1.2, -0.3), (1.14, 0.02)], ICE, gap=1.9, thick=0.08))
    m.add(blk(0.14, 0.1, 0.9, ICE, (0, -1.16, -0.86)))                                    # the nasal
    m.add(hoop(1.2, 0.1, WHITE, (0, 0, 0.0), 12))   # fur
    for k, (y, h) in enumerate(((-0.5, 0.4), (-0.2, 0.62), (0.12, 0.8), (0.44, 0.6), (0.72, 0.4))):
        m.add(glowing(cone(0.15, h + 0.2, ('#9ad8ff', '#ffffff'), (0, y, 0.6 - 0.16 * abs(k - 2)), 4)))
    return m, '#a8e0ff'


def lg_augur_blindfold():
    """A grey cloth bound over the eyes, knotted behind with the ends hanging, an open eye worked on it in light."""
    m = G('lg_augur_blindfold')
    CLOTH = ('#3a3a48', '#8a8a9c')
    m.add(lathe([(1.03, -0.72), (1.07, -0.5), (1.03, -0.28)], sides=14, colors=CLOTH, close_top=False))
    m.add(ball(0.13, CLOTH, (0, 1.08, -0.5), 6, 4))
    for sx in (-1, 1):
        m.add(tube([(sx * 0.05, 1.1, -0.52), (sx * 0.2, 1.22, -1.0), (sx * 0.16, 1.16, -1.6)], [0.09, 0.08, 0.03], sides=4, colors=CLOTH))
    m.add(glowing(lathe([(0.0, 0.0), (0.24, 0.0), (0.24, 0.04), (0.0, 0.04)], sides=8, colors=('#ffd95a', '#fff6c8')).xf(rx(math.pi / 2), (0, -1.04, -0.5), 1.0)))
    m.add(trim(disc(0.1, 0.07, ('#1a1420', '#3a3044'), (0, -1.05, -0.5), 6, rx(math.pi / 2))))
    for sx in (-1, 1):
        m.add(glowing(cone(0.06, 0.2, ('#ffd95a', '#fff6c8'), (sx * 0.24, -1.06, -0.5), 4, ry(sx * math.pi / 2))))
    return m, '#ffe070'


def lg_swarm_keeper_net():
    """A wide straw hat with a net let down all round, hooped at the hem, and the bees that voted sitting on it."""
    m = G('lg_swarm_keeper_net', 0.0)
    STRAW = ('#a8862e', '#f0d880')
    m.add(lathe([(1.7, -0.02), (1.66, 0.06), (0.92, 0.1), (0.8, 0.5), (0.0, 0.56)], sides=12, colors=STRAW, close_top=False))
    m.add(hoop(0.9, 0.05, CLOTH_BLACK, (0, 0, 0.14), 12))
    m.add(hoop(1.5, 0.035, STRAW, (0, 0, -1.5), 12))
    for (x, y, z, a) in _round(8, 1.6, 0.0, a0=TAU / 16):
        m.add(tube([(x, y, 0.0), (x * 0.94, y * 0.94, -1.5)], 0.014, sides=3, colors=('#d8d0b0', '#f8f4e0')))
    m.add(hoop(1.56, 0.014, ('#d8d0b0', '#f8f4e0'), (0, 0, -0.75), 12))
    for (x, y, z) in ((0.5, -0.7, 0.2), (-0.9, 0.2, 0.16), (0.2, 0.5, 0.6), (1.5, -0.4, -0.6)):
        m.add(blob(0.09, 0.13, 0.09, seg=6, rings=4, colors=('#e0a010', '#ffe060')).xf(None, (x, y, z)))
        m.add(trim(disc(0.095, 0.04, CLOTH_BLACK, (x, y + 0.02, z - 0.02), 6, rx(math.pi / 2))))
        for sx in (-1, 1):
            m.add(blob(0.07, 0.04, 0.02, seg=5, rings=3, colors=WHITE).xf(None, (x + sx * 0.09, y, z + 0.09)))
    return m, None


def lg_wolfmoon_casque():
    """A casque beaten from shield-brass: a wolf's brow and ears, cheek-plates, a full moon riveted on the forehead."""
    m = G('lg_wolfmoon_casque')
    m.add(_dome(BRASS, r=1.14, z0=0.0, top=0.8))
    m.add(shell([(1.2, -1.35), (1.21, -0.4), (1.14, 0.02)], BRASS, gap=1.7, thick=0.08))
    m.add(lathe([(0.0, 0.0), (0.42, 0.0), (0.2, 0.5), (0.0, 0.56)], sides=6, colors=BRASS).xf(rx(math.pi / 2 + 0.25), (0, -0.9, -0.08)))   # the muzzle over the brow
    m.add(trim(ball(0.1, CLOTH_BLACK, (0, -1.44, -0.26), 5, 3)))
    for sx in (-1, 1):
        m.add(cone(0.26, 0.6, BRASS, (sx * 0.66, -0.1, 0.5), 4, ry(sx * 0.3)))
        m.add(cone(0.05, 0.2, KK_BONE, (sx * 0.2, -1.28, -0.3), 4, rx(math.pi)))
    m.add(glowing(disc(0.2, 0.05, MOON, (0, -0.98, 0.5), 10, rx(math.pi / 2 - 0.6))))
    return m, '#d8e4ff'


def lg_pumpkin_regalia():
    """The prize gourd worn as a crown: ribbed orange, a crooked stem, a face cut in it that is lit from inside."""
    m = G('lg_pumpkin_regalia')
    PUMP = ('#b8500c', '#ff9a2a')
    m.add(lathe([(1.14, -0.5), (1.3, -0.1), (1.22, 0.5), (0.7, 0.86), (0.0, 0.9)], sides=12, colors=PUMP, close_top=False))
    for (x, y, z, a) in _round(8, 1.18, -0.42, a0=TAU / 16):
        m.add(blob(0.34, 0.34, 0.7, seg=6, rings=4, colors=PUMP).xf(None, (x, y, z + 0.6)))     # the ribs
    m.add(tube([(0, 0, 0.86), (0.05, 0.02, 1.12), (0.22, 0.0, 1.26)], [0.14, 0.1, 0.07], sides=5, colors=('#2f4a1c', '#6a8a3a')))
    GL = ('#ffb41e', '#fff0a0')
    for sx in (-1, 1):
        m.add(glowing(lathe([(0.0, 0.0), (0.17, 0.0), (0.0, 0.26)], sides=3, colors=GL).xf(rx(math.pi / 2), (sx * 0.4, -1.3, 0.34))))
    for k, x in enumerate((-0.42, -0.21, 0.0, 0.21, 0.42)):
        m.add(glowing(blk(0.16, 0.08, 0.14 if k % 2 else 0.2, GL, (x, -1.36 + 0.05 * abs(k - 2), -0.12))))
    return m, '#ffb030'


def lg_silence_cowl():
    """A deep grey cowl drawn far forward, its peak fallen over, with a short cape on the shoulders."""
    m = G('lg_silence_cowl')
    GREY = ('#2c2c38', '#6c6c80')
    m.add(shell([(1.3, -1.5), (1.26, -0.4), (1.12, 0.14)], GREY, gap=1.7))
    m.add(_dome(GREY, r=1.14, z0=0.12, top=0.86))
    m.add(shell([(1.34, -0.3), (1.36, 0.1), (1.2, 0.5)], GREY, gap=1.2, sides=10, thick=0.1).xf(None, (0, -0.3, 0)))   # the hood drawn forward over the brow
    m.add(tube([(0, 0.3, 0.6), (0, 0.9, 0.66), (0, 1.4, 0.3), (0, 1.56, -0.3)], [0.4, 0.3, 0.18, 0.03], sides=6, colors=GREY))
    m.add(lathe([(1.2, -1.42), (1.66, -1.9), (1.6, -1.94)], sides=10, colors=GREY, close_top=False))
    m.add(trim(blk(0.3, 0.05, 0.05, ('#8a8aa0', '#d0d0e0'), (0, -1.42, -1.72))))             # a mouth, stitched shut
    return m, None


def lg_comet_chaplet():
    """A band of black fallen stone with one bright piece of it at the temple, its tail drawn right round the head."""
    m = G('lg_comet_chaplet', 0.008)
    m.add(hoop(1.03, 0.06, ('#1a1a22', '#4a4a5a'), (0, 0, -0.15), 14))
    pts = [(1.2 * math.sin(a), -1.2 * math.cos(a), -0.02 + 0.22 * (1 - k / 9)) for k, a in enumerate(np.linspace(0.9, 0.9 + 4.6, 10))]
    m.add(glowing(tube(pts, list(np.linspace(0.13, 0.008, 10)), sides=5, colors=('#4aa8ff', '#f0faff'))))
    m.add(glowing(lathe([(0.0, -0.2), (0.18, 0.0), (0.0, 0.2)], sides=5, colors=('#a8dcff', '#ffffff')).xf(None, pts[0])))
    for (a, z) in ((2.0, 0.34), (3.1, 0.28), (4.4, 0.2)):
        m.add(glowing(ball(0.035, ('#a8dcff', '#ffffff'), (1.34 * math.sin(a), -1.34 * math.cos(a), z), 4, 3)))
    return m, '#80c8ff'


def lg_deepwood_antlers():
    """A band of moss and bark carrying a great pair of antlers, four tines to a side."""
    m = G('lg_deepwood_antlers')
    HORN = ('#5a4630', '#d8c8a0')
    m.add(lathe([(1.0, -0.3), (1.06, -0.04), (1.0, 0.0)], sides=12, colors=KK_WOOD_DK, close_top=False))
    m.add(blob(1.08, 1.08, 0.1, seg=10, rings=3, colors=KK_MOSS, jitter=0.06, seed=7).xf(None, (0, 0, -0.04)))
    for sx in (-1, 1):
        beam = [(sx * 0.95, 0.0, -0.1), (sx * 1.35, 0.1, 0.7), (sx * 1.8, 0.12, 1.3), (sx * 2.0, 0.0, 2.0)]
        m.add(tube(beam, [0.2, 0.17, 0.13, 0.02], sides=6, colors=HORN))
        for (b, dx, dy, dz) in ((beam[1], 0.1, -0.5, 0.4), (beam[2], -0.3, -0.36, 0.5), (beam[2], 0.4, 0.1, 0.36), (beam[1], -0.3, 0.2, 0.44)):
            m.add(tube([b, (b[0] + sx * dx * 1.3, b[1] + dy * 1.3, b[2] + dz * 1.3)], [0.12, 0.015], sides=5, colors=HORN))
    return m, None


def lg_midnight_mitre():
    """The night-abbot's mitre: two tall peaked plates of midnight blue, front and back, banded in silver, stars
    pricked on the front, two lappets hanging behind."""
    m = G('lg_midnight_mitre')
    m.add(cyl(1.1, 0.26, SILVER, (0, 0, -0.1), 12, r_top=1.12))
    for sy in (-1, 1):
        m.add(lathe([(0.0, 0.0), (1.12, 0.0), (1.12, 0.5), (0.0, 1.7)], sides=4, colors=NIGHT, phase=0.0).xf(None, (0, 0, 0.0), 1.0).xf(None, (0, sy * 0.5, 0.12)))
    m.add(blk(0.14, 0.08, 1.5, SILVER, (0, -1.3, 0.14), rx(-0.5)))
    for (x, z) in ((-0.34, 0.5), (0.32, 0.44), (-0.16, 0.95), (0.18, 0.9)):
        m.add(glowing(lathe([(0.0, -0.12), (0.09, 0.0), (0.0, 0.12)], sides=4, colors=('#fff0a0', '#ffffff')).xf(None, (x, -1.38 + 0.52 * z, z + 0.14))))
    for sx in (-1, 1):
        m.add(blk(0.26, 0.06, 1.4, NIGHT, (sx * 0.34, 1.2, -1.5)))
        m.add(blk(0.28, 0.07, 0.16, SILVER, (sx * 0.34, 1.2, -1.5)))
    return m, '#fff0b0'


def lg_banshee_garland():
    """A garland of pale grave-flowers, each with a cold light at its heart, two long trails of them hanging behind."""
    m = G('lg_banshee_garland', 0.008)
    PETAL = ('#a8b8d8', '#f4f8ff')
    m.add(hoop(1.03, 0.05, ('#3a5a3a', '#7aa87a'), (0, 0, -0.14), 14))
    for k, (x, y, z, a) in enumerate(_round(10, 1.08, -0.12)):
        s = 0.2 if k % 2 else 0.15
        m.add(lathe([(0.0, 0.0), (s, 0.04), (s * 0.9, 0.1), (0.0, 0.06)], sides=6, colors=PETAL).xf(rz(a) @ rx(math.pi / 2), (x, y, z)))
        m.add(glowing(ball(s * 0.36, ('#8ad0ff', '#e8f8ff'), (x * 1.08, y * 1.08, z), 5, 3)))
    for sx in (-1, 1):
        for j in range(4):
            m.add(lathe([(0.0, 0.0), (0.12, 0.03), (0.0, 0.07)], sides=5, colors=PETAL).xf(rx(-math.pi / 2), (sx * (0.3 + 0.05 * j), 1.1 + 0.03 * j, -0.5 - 0.36 * j)))
        m.add(tube([(sx * 0.3, 1.04, -0.14), (sx * 0.46, 1.2, -1.7)], 0.02, sides=4, colors=('#3a5a3a', '#7aa87a')))
    return m, '#a0d8ff'


def lg_crown_of_hollows():
    """A heavy old gold crown of five points, the setting in each one empty and dark."""
    m = G('lg_crown_of_hollows')
    OLD = ('#6a4a12', '#d8a838')
    m.add(lathe([(1.0, -0.34), (1.08, -0.06), (1.04, 0.14), (0.98, 0.14)], sides=14, colors=OLD, close_top=False))
    for (x, y, z, a) in _round(5, 1.04, 0.1):
        R = rz(a)
        m.add(lathe([(0.0, 0.0), (0.3, 0.0), (0.24, 0.3), (0.0, 0.86)], sides=4, colors=OLD, phase=math.pi / 4).xf(R, (x, y, z)))
        m.add(trim(disc(0.13, 0.1, ('#06060a', '#1a1a24'), (x * 1.2, y * 1.2, z + 0.26), 6, R @ rx(math.pi / 2))))   # the empty setting
        m.add(hoop(0.15, 0.03, OLD, (x * 1.2, y * 1.2, z + 0.26), 6, R @ rx(math.pi / 2)))
    return m, None


def lg_auditor_plume():
    """A close black cap with a gold coin at the temple, and a single raven tail-feather, very long, swept back."""
    m = G('lg_auditor_plume')
    m.add(_dome(CLOTH_BLACK, r=1.12, z0=-0.12, top=0.8))
    m.add(hoop(1.12, 0.05, GOLD, (0, 0, -0.12), 14))
    m.add(trim(disc(0.17, 0.06, GOLD, (-0.86, -0.76, 0.06), 8, rz(-0.84) @ rx(math.pi / 2))))
    quill = [(-0.82, -0.66, 0.1), (-0.9, -0.1, 0.9), (-0.7, 0.8, 1.6), (-0.3, 1.7, 1.75)]
    m.add(tube(quill, [0.05, 0.05, 0.04, 0.015], sides=4, colors=KK_BONE))
    for k in range(1, 4):
        (x0, y0, z0), (x1, y1, z1) = quill[k - 1], quill[k]
        mid = ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
        ln = math.dist(quill[k - 1], quill[k])
        m.add(blk(0.1, ln * 1.02, 0.7 - 0.12 * k, FEATHER, (mid[0], mid[1], mid[2] - 0.32 + 0.06 * k), rx(math.atan2(z1 - z0, y1 - y0))))
    return m, None


# ── chests: the origin at the breastbone; +Z up, the front toward -Y; the shoulders near x = ±0.95, z = 0.4 ─────
def _cuirass(m, colors, sides=8, r=(0.7, 0.86, 0.84, 0.62), at=(0, 0.02, 0)):
    m.add(lathe([(r[0], -0.6), (r[1], -0.1), (r[2], 0.3), (r[3], 0.42)], sides=sides, colors=colors, close_top=False).xf(None, at))


def _pauldrons(m, colors, r=0.4, h=0.26, z=0.4, x=0.98, seg=7):
    for sx in (-1, 1):
        m.add(blob(r, r, h, seg=seg, rings=4, colors=colors).xf(None, (sx * x, 0.0, z)))


def _back(m, colors, w=1.4, ln=1.8, y=0.98, top=-0.1, thick=0.08):
    """A fall of cloth down the back from just under the shoulders."""
    m.add(blk(w, thick, ln, colors, (0, y, top - ln)))


def _front(a, r=0.86):
    """A point on the breast, `a` radians round from straight ahead: (x, y)."""
    return (r * math.sin(a), -r * math.cos(a))


def lg_thornwood_brigandine():
    """A coat of plum-dark heartwood plates in rows, each studded with a thorn, on wooden shoulders."""
    m = G('lg_thornwood_brigandine', 0.006)
    _cuirass(m, ('#1c0e1a', '#4a2842'))
    for row, z in enumerate((0.16, -0.1, -0.36)):
        for k in range(8):
            a = k * TAU / 8 + (TAU / 16 if row % 2 else 0)
            x, y = _front(a, 0.84 - 0.03 * row)
            m.add(blk(0.42, 0.08, 0.24, PLUM, (x, y + 0.02, z), rz(a)))
            m.add(cone(0.04, 0.14, THORN, (x * 1.06, y * 1.06 + 0.02, z + 0.12), 4, rz(a) @ rx(math.pi / 2)))
    _pauldrons(m, PLUM, 0.42, 0.24)
    for sx in (-1, 1):
        m.add(cone(0.07, 0.3, THORN, (sx * 1.1, 0, 0.56), 4, ry(sx * 0.6)))
    return m, None


def lg_festival_doublet():
    """A fair-day doublet, red one side and gold the other, with striped puffed shoulders, a white ruff and
    confetti still in the seams."""
    m = G('lg_festival_doublet')
    RED = ('#8a1420', '#e03a3a'); YEL = ('#b8860e', '#ffd84a')
    m.add(shell([(0.7, -0.6), (0.87, -0.1), (0.85, 0.3), (0.62, 0.42)], RED, gap=math.pi, sides=6, thick=0.2).xf(rz(-math.pi / 2), (0, 0.02, 0)))
    m.add(shell([(0.7, -0.6), (0.87, -0.1), (0.85, 0.3), (0.62, 0.42)], YEL, gap=math.pi, sides=6, thick=0.2).xf(rz(math.pi / 2), (0, 0.02, 0)))
    for sx in (-1, 1):
        m.add(blob(0.46, 0.46, 0.34, seg=8, rings=4, colors=YEL if sx < 0 else RED).xf(None, (sx * 1.0, 0, 0.36)))
        for a in (0.0, 1.05, 2.1):
            m.add(hoop(0.47, 0.035, RED if sx < 0 else YEL, (sx * 1.0, 0, 0.36), 8, rx(math.pi / 2) @ ry(a)))
    m.add(lathe([(0.56, 0.0), (0.86, 0.08), (0.56, 0.16)], sides=12, colors=WHITE, close_top=False).xf(None, (0, 0.03, 0.4)))   # the ruff
    for k, col in enumerate((('#2f8ae0', '#8ad0ff'), ('#2fb85a', '#a8ffb8'), ('#e040a0', '#ffa8dc'), ('#ffffff', '#ffffff'), ('#2f8ae0', '#8ad0ff'), ('#e040a0', '#ffa8dc'))):
        x, y = _front(-0.9 + 0.36 * k, 0.9)
        m.add(trim(blk(0.07, 0.04, 0.07, col, (x, y, 0.1 - 0.12 * (k % 3)), rz(k))))
    for z in (0.2, 0.0, -0.2):
        m.add(trim(ball(0.05, GOLD, (0, -0.9, z), 5, 3)))
    return m, None


def lg_bogshroud():
    """A shroud of marsh-linen over the shoulders, ragged at the hem, hung with moss and tied with a reed."""
    m = G('lg_bogshroud')
    BOG = ('#3a4228', '#8a8e5a')
    _mantle(m, BOG, r1=1.1, drop=0.7)
    for k in range(9):
        a = k * TAU / 9
        x, y = _front(a, 1.04)
        m.add(cone(0.16, 0.36 + 0.14 * (k % 3), BOG, (x, y + 0.05, -0.26), 4, rx(math.pi)))     # the ragged hem
    for (a, ln) in ((0.5, 0.5), (2.2, 0.7), (3.6, 0.6), (5.2, 0.44)):
        x, y = _front(a, 0.98)
        m.add(tube([(x, y + 0.05, 0.0), (x * 1.03, y * 1.03 + 0.05, -ln)], [0.07, 0.015], sides=4, colors=KK_MOSS))
    m.add(hoop(0.66, 0.04, ('#8a7a3a', '#d8c880'), (0, 0.05, 0.36), 10))
    m.add(tube([(0.1, -0.64, 0.36), (0.2, -0.74, 0.1), (0.14, -0.72, -0.14)], [0.03, 0.03, 0.01], sides=4, colors=('#8a7a3a', '#d8c880')))
    _back(m, BOG, 1.3, 1.5, 0.96, -0.2)
    return m, None


def lg_beekeeper_habit():
    """A honey-yellow habit to the shoulders, honeycomb worked on the breast, a little straw skep on one shoulder
    and a bee or two that would not leave."""
    m = G('lg_beekeeper_habit')
    _mantle(m, HONEY, r1=1.06, drop=0.62)
    for (dx, dz) in ((0, 0), (0.24, 0.13), (-0.24, 0.13), (0, 0.27), (0.24, -0.13), (-0.24, -0.13)):
        m.add(trim(disc(0.13, 0.05, ('#7a4a08', '#d89a20'), (dx, -0.84 - 0.03 * abs(dx) * 4, -0.02 + dz), 6, rx(math.pi / 2))))
    m.add(lathe([(0.3, 0.0), (0.32, 0.16), (0.24, 0.34), (0.0, 0.44)], sides=8, colors=('#a8862e', '#f0d880')).xf(None, (0.95, 0.0, 0.36)))    # the skep
    for z in (0.46, 0.58, 0.7):
        m.add(hoop(0.3 - (z - 0.46) * 0.5, 0.025, ('#7a5a1a', '#c8a850'), (0.95, 0, z), 8))
    m.add(trim(blk(0.1, 0.05, 0.1, CLOTH_BLACK, (0.95, -0.3, 0.38))))
    for (x, y, z) in ((0.6, -0.62, 0.5), (-0.5, -0.8, 0.2), (-0.9, 0.2, 0.5)):
        m.add(blob(0.07, 0.1, 0.07, seg=5, rings=3, colors=('#e0a010', '#ffe060')).xf(None, (x, y, z)))
        m.add(trim(disc(0.075, 0.03, CLOTH_BLACK, (x, y + 0.015, z - 0.015), 5, rx(math.pi / 2))))
    m.add(hoop(1.0, 0.035, ('#7a4a08', '#d89a20'), (0, 0.05, -0.18), 10))
    return m, None


def lg_gravedigger_coat():
    """A long earth-brown greatcoat with a turned-up collar and deep pockets, buttoned down the front (the third
    button gold), a spade slung across the back."""
    m = G('lg_gravedigger_coat')
    COAT = ('#2a2018', '#5e4a36')
    _cuirass(m, COAT, r=(0.78, 0.9, 0.86, 0.64))
    m.add(lathe([(0.66, 0.0), (0.84, 0.44)], sides=10, colors=COAT, close_top=False).xf(None, (0, 0.06, 0.38)))
    _back(m, COAT, 1.5, 1.9, 0.9, -0.5)
    for sx in (-1, 1):
        m.add(blk(0.36, 0.1, 0.34, ('#1e1610', '#4a3a2a'), (sx * 0.5, -0.74, -0.62), rz(sx * -0.5)))
        m.add(blob(0.36, 0.36, 0.24, seg=6, rings=3, colors=COAT).xf(None, (sx * 0.96, 0, 0.38)))
    for k, z in enumerate((0.24, 0.04, -0.16, -0.36)):
        m.add(trim(ball(0.055, GOLD if k == 2 else KK_BONE, (0, -0.9 + 0.01 * k, z), 5, 3)))
    m.add(cyl(0.035, 1.5, KK_WOOD, (-0.7, 1.04, -0.9), 5, R=ry(0.5)))                       # the spade
    m.add(blk(0.34, 0.05, 0.42, KK_IRON, (0.06, 1.04, 0.36), ry(0.5)))
    return m, None


def lg_stormcloak():
    """A cloak cut from a grey sail, blown out behind, roped at the throat, with a seam of lightning down it."""
    m = G('lg_stormcloak')
    SAIL = ('#5a6878', '#c8d4e0')
    _mantle(m, SAIL, r1=1.08, drop=0.5)
    m.add(blk(1.6, 0.08, 1.1, SAIL, (0, 0.96, -1.1), rx(0.3)))
    m.add(blk(1.5, 0.08, 1.0, SAIL, (0, 1.3, -1.95), rx(0.55)))                             # the lower fall, blown back
    m.add(hoop(0.66, 0.06, ('#8a7448', '#d8c490'), (0, 0.05, 0.38), 10))
    m.add(ball(0.1, ('#8a7448', '#d8c490'), (0, -0.66, 0.36), 5, 3))
    bolt = [(0.2, 0.98, -0.2), (-0.1, 1.08, -0.7), (0.16, 1.2, -1.0), (-0.14, 1.48, -1.5), (0.1, 1.74, -1.9)]
    m.add(glowing(tube([(x, y + 0.07, z) for (x, y, z) in bolt], [0.05, 0.045, 0.04, 0.035, 0.01], sides=4, colors=('#ffe24a', '#ffffff'))))
    return m, '#ffe860'


def lg_patchwork_wards():
    """A shoulder-cape of patches, no two the same cloth, each sewn on with big pale stitches."""
    m = G('lg_patchwork_wards')
    _mantle(m, ('#3a3040', '#6a5a74'), r1=1.04, drop=0.6)
    cols = (CLOTH_RED, CLOTH_GREEN, CLOTH_BLUE, HONEY, CLOTH_VIOLET, TEAL, ROSE, CREAM, ('#b8500c', '#ff9a2a'))
    for k in range(9):
        a = k * TAU / 9
        for row in (0, 1):
            r = 0.8 + 0.2 * row; z = 0.2 - 0.3 * row
            x, y = _front(a + (0.35 if row else 0), r)
            m.add(blk(0.4 + 0.06 * (k % 2), 0.07, 0.3, cols[(k * 2 + row * 4) % 9], (x, y + 0.05, z - 0.1), rz(a + (0.35 if row else 0)) @ rx(-0.62)))
            m.add(trim(blk(0.2, 0.04, 0.03, WHITE, (x * 1.04, y * 1.04 + 0.05, z + 0.16 - 0.06 * row), rz(a + (0.35 if row else 0)) @ rx(-0.62))))
    m.add(hoop(0.66, 0.05, CREAM, (0, 0.05, 0.4), 10))
    return m, None


def lg_ashen_apron():
    """A baker's apron grey with ash and flour: a bib and skirt on tapes, a pocket with the rolling pin in it."""
    m = G('lg_ashen_apron')
    ASH = ('#8a8680', '#e8e4dc')
    m.add(blk(0.9, 0.08, 0.7, ASH, (0, -0.88, -0.2)))                                       # the bib
    m.add(blk(1.3, 0.08, 1.0, ASH, (0, -0.86, -1.2)))                                       # the skirt
    m.add(hoop(0.62, 0.035, CREAM, (0, 0.03, 0.42), 10))                                    # the neck tape
    m.add(hoop(0.86, 0.04, CREAM, (0, 0.02, -0.22), 10))                                    # the waist tape
    for sx in (-1, 1):
        m.add(lathe([(0.0, 0.0), (0.16, 0.14), (0.0, 0.26)], sides=4, colors=CREAM).xf(ry(sx * 1.9), (0, 0.9, -0.24)))   # the bow behind
        m.add(tube([(sx * 0.4, -0.84, 0.48), (sx * 0.5, -0.4, 0.5)], 0.03, sides=4, colors=CREAM))
    m.add(blk(0.5, 0.06, 0.3, ('#6a6660', '#b8b4ac'), (0.2, -0.93, -0.8)))                  # the pocket
    m.add(cyl(0.07, 0.6, KK_WOOD, (0.0, -0.98, -0.62), 6, R=ry(0.6)))
    for (x, z, r) in ((-0.3, 0.2, 0.12), (0.3, -0.1, 0.09), (-0.4, -0.9, 0.14)):
        m.add(trim(disc(r, 0.03, WHITE, (x, -0.92, z), 6, rx(math.pi / 2))))                # flour
    return m, None


def lg_moonsilk_mantle():
    """A mantle of silver spider-silk, webbed from a crescent clasp, and so light it stands off the shoulders."""
    m = G('lg_moonsilk_mantle', 0.008)
    SILK = ('#a8b4d0', '#f4f8ff')
    m.add(lathe([(0.64, 0.42), (1.16, 0.2), (1.3, -0.4), (1.24, -0.42)], sides=12, colors=SILK, close_top=False).xf(None, (0, 0.05, 0)))
    for k in range(8):
        x, y = _front(k * TAU / 8, 1.0)
        m.add(glowing(tube([(x * 0.66, y * 0.66 + 0.05, 0.44), (x * 1.19, y * 1.19 + 0.05, 0.22), (x * 1.33, y * 1.33 + 0.05, -0.4)], 0.022, sides=3, colors=MOON)))
    for (r, z) in ((0.94, 0.33), (1.26, -0.1)):
        m.add(hoop(r, 0.018, SILVER, (0, 0.05, z), 12))
    m.add(tube([(-0.16, -0.66, 0.5), (-0.2, -0.74, 0.36), (0.0, -0.8, 0.24), (0.2, -0.74, 0.36), (0.16, -0.66, 0.5)], [0.01, 0.04, 0.06, 0.04, 0.01], sides=4, colors=SILVER))
    _back(m, SILK, 1.5, 1.6, 1.2, -0.4, 0.04)
    return m, '#dce6ff'


def lg_ironbark_cuirass():
    """A breast of iron-grey bark, deep-furrowed, strapped with iron, a green shoot still growing from one shoulder."""
    m = G('lg_ironbark_cuirass')
    BARK = ('#2a2622', '#6a625a')
    _cuirass(m, BARK, sides=10)
    for k in range(10):
        x, y = _front(k * TAU / 10 + 0.3, 0.84)
        m.add(blk(0.16, 0.14, 0.9, BARK, (x, y + 0.02, -0.56), rz(k * TAU / 10 + 0.3 + 0.2 * (k % 3))))
    for z in (0.22, -0.36):
        m.add(hoop(0.9 if z > 0 else 0.84, 0.05, KK_IRON, (0, 0.02, z), 10))
    for sx in (-1, 1):
        m.add(blob(0.42, 0.42, 0.28, seg=7, rings=4, colors=BARK, jitter=0.1, seed=3 + sx).xf(None, (sx * 0.98, 0, 0.4)))
    m.add(tube([(-0.98, 0, 0.6), (-1.04, -0.04, 0.9), (-0.94, -0.1, 1.1)], 0.03, sides=4, colors=('#2f5a24', '#7ab84c')))
    for a in (0.6, -0.9):
        m.add(lathe([(0.0, 0.0), (0.1, 0.12), (0.0, 0.3)], sides=4, colors=('#3f7a2a', '#a8e060')).xf(ry(a), (-0.96, -0.08, 1.06)))
    return m, None


def lg_wisplight_robe():
    """A teal robe to the shoulders, its hem hung all round with little bottles of marsh-light."""
    m = G('lg_wisplight_robe')
    _mantle(m, TEAL, r1=1.08, drop=0.62)
    m.add(lathe([(0.64, 0.0), (0.74, 0.3)], sides=10, colors=TEAL, close_top=False).xf(None, (0, 0.05, 0.4)))
    for k in range(8):
        x, y = _front(k * TAU / 8 + 0.2, 1.08)
        m.add(tube([(x, y + 0.05, -0.2), (x, y + 0.05, -0.34)], 0.012, sides=3, colors=COPPER))
        m.add(glowing(blob(0.08, 0.08, 0.11, seg=5, rings=4, colors=WISP).xf(None, (x, y + 0.05, -0.46))))
        m.add(cyl(0.035, 0.05, KK_WOOD, (x, y + 0.05, -0.37), 5))
    m.add(hoop(1.08, 0.035, COPPER, (0, 0.05, -0.2), 10))
    _back(m, TEAL, 1.3, 1.5, 0.98, -0.2)
    return m, '#60ffd0'


def lg_howlhide_mantle():
    """A shed wolf-hide, charcoal, across the shoulders: the forepaws crossed on the breast, the tail down the back."""
    m = G('lg_howlhide_mantle')
    FUR = ('#22242a', '#6a6e7a')
    m.add(blob(1.1, 0.9, 0.36, seg=10, rings=4, colors=FUR, jitter=0.07, seed=12).xf(None, (0, 0.1, 0.2)))
    for sx in (-1, 1):
        m.add(tube([(sx * 0.7, -0.5, 0.3), (sx * 0.3, -0.84, 0.05), (-sx * 0.16, -0.9, -0.2)], [0.16, 0.13, 0.11], sides=5, colors=FUR))
        for j in (-1, 0, 1):
            m.add(cone(0.03, 0.12, KK_BONE, (-sx * 0.16 + j * 0.07, -0.94, -0.26), 4, rx(math.pi)))
    m.add(blk(1.1, 0.1, 0.8, FUR, (0, 0.92, -0.7)))
    m.add(tube([(0, 0.98, -0.6), (0.1, 1.2, -1.3), (0.0, 1.16, -2.0)], [0.2, 0.24, 0.04], sides=6, colors=FUR))     # the tail
    m.add(cone(0.1, 0.2, WHITE, (0.0, 1.16, -1.86), 5, rx(math.pi)))
    return m, None


def lg_vaultkeeper_vest():
    """A banker's vest of green baize faced with old lockplates, keyholes and all, and the keys on a ring at the hip."""
    m = G('lg_vaultkeeper_vest')
    BAIZE = ('#153a26', '#3a7a52')
    _cuirass(m, BAIZE)
    for (a, z) in ((-0.42, 0.14), (0.42, 0.14), (-0.4, -0.26), (0.4, -0.26)):
        x, y = _front(a, 0.87)
        m.add(blk(0.3, 0.06, 0.3, BRASS, (x, y + 0.02, z - 0.15), rz(a)))
        m.add(trim(disc(0.05, 0.08, CLOTH_BLACK, (x * 1.03, y * 1.03 + 0.02, z + 0.04), 6, rz(a) @ rx(math.pi / 2))))
        m.add(trim(blk(0.04, 0.08, 0.1, CLOTH_BLACK, (x * 1.03, y * 1.03 + 0.02, z - 0.1), rz(a))))
    m.add(blk(0.08, 0.06, 0.9, GOLD, (0, -0.88, -0.56)))
    m.add(hoop(0.74, 0.05, GOLD, (0, 0.02, -0.56), 8))
    m.add(hoop(0.14, 0.02, KK_IRON, (0.72, -0.4, -0.7), 8, ry(math.pi / 2)))
    for k, dz in enumerate((0.0, -0.06, 0.04)):
        m.add(blk(0.035, 0.035, 0.3, BRASS, (0.74, -0.46 + 0.07 * k, -1.14 + dz)))
        m.add(blk(0.035, 0.1, 0.05, BRASS, (0.74, -0.42 + 0.07 * k, -1.14 + dz)))
    return m, None


def lg_corvid_feathercoat():
    """A coat of black feathers laid in three rows, blue where the light takes them, pinned with a raven's skull."""
    m = G('lg_corvid_feathercoat', 0.0)
    for row, (r, z, n, ln) in enumerate(((0.78, 0.3, 9, 0.5), (0.96, 0.08, 11, 0.56), (1.08, -0.16, 13, 0.62))):
        for k in range(n):
            a = k * TAU / n + row * 0.2
            x, y = _front(a, r)
            m.add(lathe([(0.0, 0.0), (0.17, 0.14), (0.0, ln)], sides=4, colors=FEATHER if (k + row) % 3 else ('#141c3a', '#3a5aa8')).xf(rz(a) @ rx(math.pi - 0.5), (x, y + 0.05, z + 0.14)))
    m.add(lathe([(0.62, 0.42), (0.8, 0.3), (0.74, 0.28)], sides=10, colors=FEATHER, close_top=False).xf(None, (0, 0.05, 0)))
    m.add(blob(0.12, 0.15, 0.11, seg=6, rings=4, colors=KK_BONE).xf(None, (0, -0.76, 0.3)))
    m.add(cone(0.05, 0.26, ('#2a2a30', '#5a5a64'), (0, -0.86, 0.28), 4, rx(math.pi * 0.62)))
    _back(m, FEATHER, 1.2, 1.3, 0.98, -0.5)
    for k in range(5):
        m.add(lathe([(0.0, 0.0), (0.16, 0.14), (0.0, 0.6)], sides=4, colors=FEATHER).xf(rx(math.pi), (-0.5 + 0.25 * k, 1.0, -1.7)))
    return m, None


def lg_emberforged_plate():
    """Black plate out of the Wastes, cracked across the breast, the cracks still red; a vent glowing at each shoulder."""
    m = G('lg_emberforged_plate')
    BLK = ('#16120f', '#4a3c34')
    _cuirass(m, BLK)
    _pauldrons(m, BLK, 0.44, 0.3)
    for crack in ([(-0.5, 0.28), (-0.2, 0.1), (-0.26, -0.16), (0.02, -0.4)], [(-0.2, 0.1), (0.2, 0.16), (0.46, -0.06)], [(0.2, 0.16), (0.3, 0.36)]):
        pts = []
        for (a, z) in crack:
            x, y = _front(a, 0.88 - 0.1 * max(0.0, z - 0.2)); pts.append((x, y + 0.02, z))
        m.add(glowing(tube(pts, 0.035, sides=4, colors=EMBER)))
    for sx in (-1, 1):
        m.add(glowing(disc(0.16, 0.06, EMBER, (sx * 1.0, -0.3, 0.44), 6, rx(math.pi / 2))))
        m.add(hoop(0.18, 0.04, KK_IRON, (sx * 1.0, -0.3, 0.44), 6, rx(math.pi / 2)))
        m.add(cone(0.09, 0.3, BLK, (sx * 1.16, 0, 0.6), 4, ry(sx * 0.6)))
    m.add(hoop(0.74, 0.06, KK_IRON, (0, 0.02, -0.55), 8))
    return m, '#ff6a20'


def lg_tidebound_scale():
    """Scalemail the green of deep water, row over row, with a scallop shell on one shoulder and a hem like a wave."""
    m = G('lg_tidebound_scale', 0.0)
    SEA = ('#0e3a44', '#3fb8a8')
    _cuirass(m, ('#0a2a32', '#1e6a6a'))
    for row, z in enumerate((0.26, 0.06, -0.14, -0.34, -0.52)):
        n = 9
        for k in range(n):
            a = k * TAU / n + (TAU / (2 * n) if row % 2 else 0)
            x, y = _front(a, 0.88 - 0.035 * row + (0.0 if row else -0.03))
            m.add(lathe([(0.0, -0.16), (0.2, 0.0), (0.0, 0.1)], sides=4, colors=SEA).xf(rz(a) @ rx(math.pi / 2) @ rz(math.pi / 4), (x, y + 0.02, z)).xf(None, (0, 0, 0)))
    m.add(lathe([(0.0, 0.0), (0.44, 0.1), (0.5, 0.3), (0.0, 0.2)], sides=7, colors=('#c8a8a0', '#fff0e8')).xf(ry(0.5), (0.86, 0, 0.36)))   # the scallop
    m.add(blob(0.36, 0.36, 0.22, seg=6, rings=3, colors=SEA).xf(None, (-0.96, 0, 0.4)))
    for k in range(8):
        x, y = _front(k * TAU / 8, 0.76)
        m.add(ball(0.09, WHITE, (x, y + 0.02, -0.62), 5, 3))                                 # the foam at the hem
    return m, None


def lg_starfall_chasuble():
    """A chasuble of night-blue, a panel before and behind, a gold band down the middle of each and stars set in it."""
    m = G('lg_starfall_chasuble')
    m.add(lathe([(0.62, 0.42), (1.0, 0.24), (1.04, 0.0), (0.98, -0.02)], sides=10, colors=NIGHT, close_top=False).xf(None, (0, 0.05, 0)))
    for sy in (-1, 1):
        y = sy * 0.9 + 0.04
        m.add(blk(1.3, 0.08, 1.5, NIGHT, (0, y, -1.5)))
        m.add(lathe([(0.0, 0.0), (0.65, 0.0), (0.65, 0.08), (0.0, 0.08)], sides=3, colors=NIGHT, phase=-math.pi / 2).xf(rx(sy * -math.pi / 2), (0, y + sy * 0.04, -1.5)))
        m.add(blk(0.2, 0.1, 1.5, GOLD, (0, y, -1.5)))
        for (x, z) in ((-0.4, -0.3), (0.42, -0.6), (-0.36, -1.0), (0.38, -1.24), (0, -1.8)):
            m.add(glowing(lathe([(0.0, -0.09), (0.07, 0.0), (0.0, 0.09)], sides=4, colors=('#fff0a0', '#ffffff')).xf(None, (x, y + sy * 0.06, z))))
    return m, '#fff0b0'


def lg_shroud_of_names():
    """A pale winding-sheet wound over one shoulder and knotted, every fold of it sewn with small dark names."""
    m = G('lg_shroud_of_names')
    LINEN = ('#9a9484', '#f0ecdc')
    band = [(-0.86, 0.0, 0.5), (-0.6, -0.62, 0.4), (0.0, -0.9, 0.0), (0.6, -0.66, -0.4), (0.84, 0.0, -0.56), (0.5, 0.7, -0.4), (-0.1, 0.92, 0.0), (-0.7, 0.6, 0.4), (-0.86, 0.0, 0.5)]
    m.add(tube(band, 0.2, sides=5, colors=LINEN))
    m.add(tube([(x * 0.98, y * 0.98, z - 0.3) for (x, y, z) in band[1:5]], 0.19, sides=5, colors=('#8a8474', '#e0dccc')))
    m.add(ball(0.24, LINEN, (-0.9, 0.0, 0.56), 6, 4))                                       # the knot
    for sx in (-1, 1):
        m.add(tube([(-0.9, 0, 0.5), (-1.1 + 0.1 * sx, 0.1 * sx, 0.1), (-1.04, 0.2 * sx, -0.4)], [0.12, 0.1, 0.03], sides=4, colors=LINEN))
    for k in range(7):
        t = k / 6
        x = -0.5 + 1.0 * t; z = 0.33 - 0.66 * t
        y = -0.9 + 0.4 * abs(t - 0.5) ** 1.5
        m.add(trim(blk(0.1, 0.42, 0.03, ('#2a2630', '#4a4654'), (x, y - 0.0, z + 0.04), ry(0.6))))
    return m, None


def lg_severance_raiment():
    """A garment of two halves that do not meet: town stone and gold on the right hand, bark and leaf on the left,
    and light in the seam between."""
    m = G('lg_severance_raiment')
    half = [(0.7, -0.6), (0.86, -0.1), (0.84, 0.3), (0.62, 0.42)]
    m.add(shell(half, KK_STONE_LT, gap=math.pi + 0.16, sides=6, thick=0.2).xf(rz(-math.pi / 2), (0.03, 0.02, 0)))
    m.add(shell(half, ('#243a1c', '#5a8a3a'), gap=math.pi + 0.16, sides=6, thick=0.2).xf(rz(math.pi / 2), (-0.03, 0.02, 0)))
    m.add(glowing(blk(0.06, 1.74, 1.0, ('#9af0ff', '#ffffff'), (0, 0.02, -0.58))))
    m.add(blk(0.56, 0.5, 0.2, KK_STONE, (0.98, 0, 0.36)))                                    # a stone shoulder
    m.add(blk(0.6, 0.54, 0.07, GOLD, (0.98, 0, 0.54)))
    m.add(blob(0.42, 0.42, 0.28, seg=7, rings=4, colors=KK_WOOD_DK, jitter=0.1, seed=4).xf(None, (-0.98, 0, 0.4)))
    for a in (0.5, -0.4, 1.4):
        m.add(lathe([(0.0, 0.0), (0.11, 0.14), (0.0, 0.36)], sides=4, colors=('#3f7a2a', '#a8e060')).xf(ry(a - 0.8), (-1.0, 0.0, 0.6)))
    m.add(hoop(0.75, 0.05, GOLD, (0.0, 0.02, -0.5), 8))
    return m, '#a0f0ff'


def lg_dawnkeeper_aegis():
    """The torchkeepers' first vestment: white and gold, a rising sun on the breast with its rays, a flame standing
    on each shoulder."""
    m = G('lg_dawnkeeper_aegis')
    _cuirass(m, WHITE)
    m.add(glowing(disc(0.3, 0.07, ('#ffb428', '#fff4b8'), (0, -0.86, -0.08), 10, rx(math.pi / 2))))
    m.add(blk(0.9, 0.12, 0.34, WHITE, (0, -0.84, -0.44)))                                    # the horizon the sun stands on
    for a in np.linspace(-1.25, 1.25, 7):
        m.add(glowing(cone(0.05, 0.3, ('#ffb428', '#fff4b8'), (0.36 * math.sin(a), -0.9, -0.08 + 0.36 * math.cos(a)), 4, ry(a))))
    _pauldrons(m, GOLD, 0.42, 0.24)
    for sx in (-1, 1):
        m.add(flame((sx * 0.98, 0, 0.58), 1.7))
    for z in (0.32, -0.55):
        m.add(hoop(0.86 if z > 0 else 0.74, 0.05, GOLD, (0, 0.02, z), 8))
    _back(m, WHITE, 1.3, 1.3, 0.94, -0.3)
    m.add(blk(1.3, 0.09, 0.16, GOLD, (0, 0.94, -1.6)))
    return m, '#ffc840'


# ── feet: one boot, the origin at the ankle, the toe toward -Y; the sole is at z = -0.42, the leg rises to 0.4 ────
def _cuff(m, colors, r=0.29, h=0.12, z=0.36, sides=8):
    m.add(cyl(r, h, colors, (0, 0.08, z), sides))


def _greave(m, colors, sole, h=0.62):
    """An armoured boot: a plated foot and a shin-plate standing up the front of the leg."""
    m.add(blk(0.46, 0.8, 0.12, sole, (0, -0.16, -0.42)))
    m.add(blk(0.44, 0.44, 0.26, colors, (0, -0.02, -0.3)))
    m.add(lathe([(0.0, 0.0), (0.2, 0.0), (0.12, 0.3), (0.0, 0.36)], sides=4, colors=colors, phase=math.pi / 4).xf(rx(math.pi / 2), (0, -0.22, -0.22)))   # the toe
    m.add(cyl(0.27, h, colors, (0, 0.08, -0.1), 8, r_top=0.3))


def lg_cobblestep_boots():
    """A grey boot soled with three rounded stones out of the plaza."""
    m = G('lg_cobblestep_boots')
    _boot(m, ('#4a4a50', '#8e8e98'), KK_STONE_DK)
    for (y, r) in ((-0.42, 0.24), (-0.1, 0.26), (0.2, 0.23)):
        m.add(blob(r, r * 0.9, 0.13, seg=6, rings=3, colors=KK_STONE_LT, jitter=0.06, seed=int(r * 100)).xf(None, (0, y, -0.46)))
    _cuff(m, KK_STONE)
    m.add(trim(blk(0.16, 0.05, 0.12, STEEL, (0, -0.2, 0.2))))
    return m, None


def lg_mudlark_waders():
    """An olive wader to the thigh, its top rolled over, mud still on the foot."""
    m = G('lg_mudlark_waders')
    WAD = ('#3c4426', '#8a9454')
    _boot(m, WAD, LEATHER_DK, leg_h=1.05)
    m.add(lathe([(0.26, 0.0), (0.36, 0.06), (0.36, 0.2), (0.27, 0.22)], sides=8, colors=WAD, close_top=False).xf(None, (0, 0.08, 0.76)))
    for (x, y, z, r) in ((0.16, -0.4, -0.36, 0.16), (-0.18, 0.0, -0.4, 0.18), (0.1, 0.24, -0.2, 0.12)):
        m.add(blob(r, r, r * 0.6, seg=5, rings=3, colors=('#2a2014', '#5a4630'), jitter=0.1, seed=2).xf(None, (x, y, z)))
    m.add(tube([(0.26, 0.08, 0.86), (0.4, 0.08, 1.1), (0.32, 0.08, 1.3)], 0.025, sides=4, colors=LEATHER))   # the strap up to the belt
    return m, None


def lg_dancing_slippers():
    """A rose satin slipper with a ribbon crossed up the ankle and tied in a bow; it gives a little light as it steps."""
    m = G('lg_dancing_slippers', 0.008)
    m.add(blk(0.4, 0.8, 0.06, ('#5a1c2c', '#a84a60'), (0, -0.16, -0.42)))
    m.add(blob(0.24, 0.3, 0.16, seg=7, rings=4, colors=ROSE).xf(None, (0, -0.4, -0.3)))        # the toe
    m.add(shell([(0.25, -0.36), (0.26, -0.14)], ROSE, gap=2.2, sides=8, thick=0.05).xf(None, (0, 0.08, 0)))   # the heel-cup
    for k, z in enumerate((-0.1, 0.08, 0.26)):
        m.add(hoop(0.2, 0.022, ('#e0a8b8', '#ffe4ec'), (0, 0.08, z), 8, rx(0.3 if k % 2 else -0.3)))
    for sx in (-1, 1):
        m.add(lathe([(0.0, 0.0), (0.09, 0.1), (0.0, 0.18)], sides=4, colors=('#e0a8b8', '#ffe4ec')).xf(ry(sx * 1.8), (0, -0.14, 0.3)))
    m.add(glowing(blk(0.36, 0.76, 0.025, ('#ff9ac0', '#ffe8f0'), (0, -0.16, -0.45))))
    return m, '#ffa8c8'


def lg_lamplighter_treads():
    """A brown boot capped in brass at the toe, cleated for climbing, with a very small lantern hung at the ankle."""
    m = G('lg_lamplighter_treads')
    _boot(m, LEATHER, LEATHER_DK)
    m.add(blk(0.46, 0.24, 0.3, BRASS, (0, -0.44, -0.32)))
    for y in (-0.3, -0.05, 0.18):
        m.add(blk(0.5, 0.07, 0.05, KK_IRON, (0, y, -0.47)))
    _cuff(m, LEATHER_DK)
    m.add(cyl(0.08, 0.14, KK_IRON, (0.33, 0.08, 0.06), 6))
    m.add(glowing(cyl(0.06, 0.1, FLAME, (0.33, 0.08, 0.08), 6)))
    m.add(cone(0.1, 0.07, KK_IRON, (0.33, 0.08, 0.2), 6))
    m.add(tube([(0.28, 0.08, 0.38), (0.33, 0.08, 0.27)], 0.012, sides=3, colors=KK_IRON))
    return m, '#ffc050'


def lg_thistledown_socks():
    """A steel sabaton in lapped plates with a cuff of white down, and a thistle-head for a rosette."""
    m = G('lg_thistledown_socks')
    _greave(m, STEEL, STEEL_DK, 0.5)
    for k, y in enumerate((-0.36, -0.2, -0.04)):
        m.add(blk(0.48, 0.13, 0.05, STEEL_DK, (0, y, -0.06 + 0.0 * k), rx(-0.2)))
    m.add(blob(0.34, 0.34, 0.14, seg=8, rings=3, colors=WHITE, jitter=0.08, seed=5).xf(None, (0, 0.08, 0.42)))
    m.add(ball(0.09, ('#2f5a24', '#6aa84a'), (0, -0.24, 0.22), 5, 3))
    m.add(cone(0.1, 0.18, ('#6a2a8a', '#c87ae0'), (0, -0.3, 0.26), 6, rx(math.pi / 2 - 0.5)))
    return m, None


def lg_gravel_ghost_shoes():
    """A low pale shoe with gravel set in its sole, and a wisp of something trailing off the heel."""
    m = G('lg_gravel_ghost_shoes')
    PALE = ('#8a8e98', '#e4e8f0')
    m.add(blk(0.46, 0.8, 0.12, KK_STONE_DK, (0, -0.16, -0.42)))
    m.add(blk(0.42, 0.72, 0.24, PALE, (0, -0.14, -0.3)))
    m.add(cyl(0.25, 0.2, PALE, (0, 0.08, -0.1), 8))
    for k in range(7):
        m.add(trim(blk(0.08, 0.08, 0.05, KK_STONE_LT if k % 2 else KK_STONE, (0.2 * (1 if k % 2 else -1), -0.5 + 0.12 * k, -0.4), rz(k))))
    m.add(glowing(tube([(0, 0.3, -0.2), (0.06, 0.56, 0.0), (-0.06, 0.74, 0.26), (0.02, 0.8, 0.5)], [0.11, 0.09, 0.05, 0.008], sides=5, colors=('#a8d0e8', '#f4fbff'))))
    return m, '#c0e4ff'


def lg_ratline_climbers():
    """A navy deck-shoe on a sole of coiled rope, lashed twice round the ankle with the same rope."""
    m = G('lg_ratline_climbers')
    ROPE = ('#9a7e48', '#e8d49a')
    for k, y in enumerate((-0.48, -0.3, -0.12, 0.06, 0.22)):
        m.add(cyl(0.065, 0.48, ROPE, (-0.24, y, -0.4), 5, R=ry(math.pi / 2)))
    m.add(blk(0.42, 0.72, 0.26, ('#18223c', '#3c5488'), (0, -0.14, -0.33)))
    m.add(cyl(0.25, 0.4, ('#18223c', '#3c5488'), (0, 0.08, -0.1), 8))
    for z in (0.06, 0.2):
        m.add(hoop(0.27, 0.04, ROPE, (0, 0.08, z), 8))
    m.add(ball(0.07, ROPE, (0, -0.2, 0.14), 5, 3))
    for sx in (-1, 1):
        m.add(tube([(0, -0.2, 0.14), (sx * 0.1, -0.3, -0.02)], [0.03, 0.02], sides=4, colors=ROPE))
    return m, None


def lg_fernwalkers():
    """A boot bound in green leaves, a fern uncurling at either side of the ankle."""
    m = G('lg_fernwalkers')
    LEAF = ('#1e4a22', '#5aa848')
    _boot(m, LEAF, KK_WOOD_DK)
    for k in range(6):
        a = k * TAU / 6
        m.add(lathe([(0.0, 0.0), (0.16, 0.14), (0.0, 0.42)], sides=4, colors=('#2a5a24', '#7ac850') if k % 2 else LEAF).xf(rz(a) @ rx(0.35), (0.22 * math.sin(a), 0.08 - 0.22 * math.cos(a), 0.14)))
    for sx in (-1, 1):
        m.add(tube([(sx * 0.26, 0.08, 0.2), (sx * 0.42, 0.08, 0.5), (sx * 0.4, 0.08, 0.76), (sx * 0.26, 0.08, 0.8), (sx * 0.24, 0.08, 0.66)], [0.04, 0.035, 0.03, 0.025, 0.012], sides=4, colors=('#2a5a24', '#7ac850')))
    return m, None


def lg_frostgait_boots():
    """A pale blue boot with a thick cuff of white fur, shod with a row of ice."""
    m = G('lg_frostgait_boots')
    _boot(m, ICE, ('#4a6a8a', '#a8c8e0'))
    m.add(blob(0.36, 0.36, 0.18, seg=8, rings=3, colors=WHITE, jitter=0.08, seed=8).xf(None, (0, 0.08, 0.4)))
    for (x, y, h) in ((0.16, -0.48, 0.16), (-0.16, -0.3, 0.12), (0.16, -0.06, 0.14), (-0.16, 0.16, 0.12)):
        m.add(glowing(cone(0.06, h, ('#9ad8ff', '#ffffff'), (x, y, -0.42), 4, rx(math.pi))))
    m.add(glowing(lathe([(0.0, -0.12), (0.08, 0.0), (0.0, 0.12)], sides=4, colors=('#9ad8ff', '#ffffff')).xf(None, (0, -0.2, 0.16))))
    return m, '#a8e0ff'


def lg_wakewalkers():
    """A sea-boot of dark teal with a wide turned-down top, a curl of white water at the toe and a ring of ripple
    under the sole."""
    m = G('lg_wakewalkers')
    _boot(m, TEAL, ('#0a2a30', '#1e5a5a'), leg_h=0.56)
    m.add(lathe([(0.26, 0.2), (0.42, 0.14), (0.44, -0.06), (0.36, -0.08)], sides=8, colors=TEAL, close_top=False).xf(None, (0, 0.08, 0.3)))   # the bucket top
    m.add(tube([(0, -0.5, -0.34), (0, -0.74, -0.2), (0, -0.7, 0.0), (0, -0.56, 0.02)], [0.12, 0.1, 0.07, 0.02], sides=5, colors=WHITE))
    m.add(glowing(hoop(0.52, 0.03, ('#7ae0e8', '#f0ffff'), (0, -0.14, -0.46), 12)))
    return m, '#90f0f0'


def lg_howlrunner_paws():
    """A grey wolf's hind paw to run on: four toes, black claws, a dark pad, the hock wrapped for racing."""
    m = G('lg_howlrunner_paws')
    m.add(blob(0.26, 0.42, 0.2, seg=7, rings=4, colors=FUR_GREY).xf(None, (0, -0.16, -0.3)))
    for x in (-0.2, -0.07, 0.07, 0.2):
        m.add(blob(0.085, 0.14, 0.1, seg=5, rings=3, colors=FUR_GREY).xf(None, (x, -0.58 + 0.06 * abs(x) * 5, -0.36)))
        m.add(cone(0.035, 0.16, CLOTH_BLACK, (x, -0.68 + 0.06 * abs(x) * 5, -0.36), 4, rx(math.pi / 2 + 0.3)))
    m.add(cyl(0.2, 0.6, FUR_GREY, (0, 0.1, -0.16), 7, r_top=0.26))
    for z in (0.0, 0.12, 0.24):
        m.add(hoop(0.24 + z * 0.1, 0.035, CLOTH_RED, (0, 0.1, z), 7))
    m.add(blob(0.3, 0.3, 0.12, seg=7, rings=3, colors=('#7c8698', '#eef2f8'), jitter=0.08, seed=4).xf(None, (0, 0.1, 0.44)))
    return m, None


def lg_vesper_stalkers():
    """A soft boot of dusk-purple leather, a small bat's wing stitched at the outside of each ankle."""
    m = G('lg_vesper_stalkers')
    DUSK = ('#2a1c3c', '#6a4a8a')
    _boot(m, DUSK, CLOTH_BLACK)
    _cuff(m, CLOTH_BLACK, h=0.08)
    for sx in (-1, 1):
        root = (sx * 0.24, 0.12, 0.16)
        tips = ((sx * 0.5, 0.3, 0.62), (sx * 0.62, 0.42, 0.3), (sx * 0.56, 0.46, -0.02))
        for t in tips:
            m.add(tube([root, t], [0.03, 0.008], sides=4, colors=CLOTH_BLACK))
        for a, b in ((tips[0], tips[1]), (tips[1], tips[2])):
            v = [root, a, b]
            m.add(Part(v + v, [(0, 1, 2), (5, 4, 3)], [0, 1, 1, 0, 1, 1], DUSK))
    return m, None


def lg_emberstride_greaves():
    """A black iron greave with a hot sole and a line of fire down the shin."""
    m = G('lg_emberstride_greaves')
    _greave(m, ('#16120f', '#4a3c34'), KK_IRON)
    m.add(glowing(blk(0.5, 0.84, 0.05, EMBER, (0, -0.16, -0.47))))
    m.add(glowing(blk(0.07, 0.05, 0.5, EMBER, (0, -0.22, -0.02))))
    m.add(cone(0.1, 0.24, ('#16120f', '#4a3c34'), (0, -0.14, 0.5), 4))
    for (x, y, z) in ((0.2, 0.36, -0.3), (-0.1, 0.44, -0.16)):
        m.add(glowing(ball(0.035, EMBER, (x, y, z), 4, 3)))
    return m, '#ff6a20'


def lg_gallows_hoppers():
    """A boot striped black and bone with a hempen cuff knotted like a noose, and a spring under the heel."""
    m = G('lg_gallows_hoppers')
    m.add(blk(0.46, 0.8, 0.1, CLOTH_BLACK, (0, -0.16, -0.36)))
    m.add(blk(0.42, 0.72, 0.26, CLOTH_BLACK, (0, -0.14, -0.26)))
    for k in range(5):
        m.add(cyl(0.25 + (0.004 if k % 2 else 0), 0.1, KK_BONE if k % 2 else CLOTH_BLACK, (0, 0.08, -0.1 + 0.1 * k), 8))
    ROPE = ('#9a7e48', '#e8d49a')
    m.add(hoop(0.28, 0.045, ROPE, (0, 0.08, 0.42), 8))
    m.add(cyl(0.06, 0.2, ROPE, (0.3, 0.08, 0.24), 5))
    m.add(tube([(0.3, 0.08, 0.24), (0.34, 0.1, 0.04)], [0.03, 0.02], sides=4, colors=ROPE))
    pts = [(0.12 * math.cos(a), 0.2 + 0.12 * math.sin(a), -0.36 - 0.2 * a / (TAU * 2.5)) for a in np.linspace(0, TAU * 2.5, 16)]
    m.add(tube(pts, 0.022, sides=4, colors=STEEL))                                           # the spring
    m.add(disc(0.16, 0.035, STEEL_DK, (0, 0.2, -0.6), 8))
    return m, None


def lg_starstride_sandals():
    """A sandal of meteor-iron: a dark sole, straps laced up the shin, a star at each crossing."""
    m = G('lg_starstride_sandals', 0.008)
    IRON = ('#22242e', '#6a7088')
    m.add(blk(0.44, 0.84, 0.08, IRON, (0, -0.16, -0.42)))
    for y in (-0.42, -0.16):
        m.add(tube([(-0.22, y, -0.36), (0, y, -0.14), (0.22, y, -0.36)], 0.03, sides=4, colors=IRON))
    m.add(shell([(0.25, -0.34), (0.25, -0.2)], IRON, gap=2.4, sides=6, thick=0.04).xf(None, (0, 0.08, 0)))
    for k, z in enumerate((-0.02, 0.2, 0.42)):
        m.add(hoop(0.23, 0.025, IRON, (0, 0.08, z), 8, rx(0.25 if k % 2 else -0.25)))
        m.add(glowing(lathe([(0.0, -0.07), (0.05, 0.0), (0.0, 0.07)], sides=4, colors=('#fff0a0', '#ffffff')).xf(None, (0, -0.16, z))))
    m.add(glowing(lathe([(0.0, -0.07), (0.05, 0.0), (0.0, 0.07)], sides=4, colors=('#fff0a0', '#ffffff')).xf(None, (0, -0.42, -0.1))))
    return m, '#fff0b0'


def lg_shadowmoss_treads():
    """A black boot grown over with dark moss, three very small pale toadstools coming up out of it."""
    m = G('lg_shadowmoss_treads')
    DMOSS = ('#14261a', '#3a6a40')
    _boot(m, CLOTH_BLACK, CLOTH_BLACK)
    for (x, y, z, r, sd) in ((0.0, -0.42, -0.14, 0.2, 1), (0.2, -0.1, -0.1, 0.16, 2), (-0.2, 0.1, 0.1, 0.18, 3), (0.14, 0.16, 0.3, 0.16, 4), (-0.1, -0.1, 0.36, 0.15, 5)):
        m.add(blob(r, r, r * 0.6, seg=6, rings=3, colors=DMOSS, jitter=0.14, seed=sd).xf(None, (x, y, z)))
    for (x, y, z) in ((0.06, -0.44, 0.0), (-0.22, 0.1, 0.22), (0.2, 0.18, 0.42)):
        m.add(cyl(0.02, 0.1, CREAM, (x, y, z), 4))
        m.add(glowing(lathe([(0.07, 0.0), (0.05, 0.04), (0.0, 0.06)], sides=6, colors=('#c8e8d0', '#ffffff')).xf(None, (x, y, z + 0.1))))
    return m, '#d0ffe0'


def lg_briarleap_boots():
    """A tan boot with a rabbit's ears for a cuff and its white scut at the heel, a briar wound round the leg."""
    m = G('lg_briarleap_boots')
    TAN = ('#7a5a3a', '#c8a070')
    _boot(m, TAN, LEATHER_DK)
    for sx in (-1, 1):
        m.add(lathe([(0.0, 0.0), (0.1, 0.16), (0.07, 0.4), (0.0, 0.56)], sides=5, colors=TAN).xf(ry(sx * 0.25), (sx * 0.13, 0.2, 0.36)))
        m.add(trim(lathe([(0.0, 0.0), (0.05, 0.12), (0.0, 0.36)], sides=4, colors=('#e0a8a8', '#ffe0e0')).xf(ry(sx * 0.25), (sx * 0.14, 0.14, 0.44))))
    m.add(blob(0.14, 0.14, 0.14, seg=6, rings=4, colors=WHITE, jitter=0.1, seed=2).xf(None, (0, 0.36, -0.16)))
    pts = [(0.27 * math.cos(a), 0.08 + 0.27 * math.sin(a), -0.08 + 0.4 * a / (TAU * 1.5)) for a in np.linspace(0, TAU * 1.5, 12)]
    m.add(tube(pts, 0.025, sides=4, colors=THORN))
    for k in (2, 5, 8):
        m.add(cone(0.03, 0.1, THORN, pts[k], 4, rz(k) @ rx(math.pi / 2)))
    return m, None


def lg_moonshod_greaves():
    """A silver greave shod like a procession-horse: a crescent shoe under the toe, a crescent on the shin."""
    m = G('lg_moonshod_greaves')
    _greave(m, SILVER, STEEL_DK)
    shoe = [(0.24 * math.sin(a), -0.34 - 0.3 * math.cos(a), -0.46) for a in np.linspace(-2.2, 2.2, 9)]
    m.add(glowing(tube(shoe, 0.04, sides=4, colors=MOON)))
    cres = [(0.16 * math.sin(a), -0.24, 0.18 + 0.16 * math.cos(a)) for a in np.linspace(0.6, TAU - 0.6, 9)]
    m.add(glowing(tube(cres, [0.01, 0.03, 0.04, 0.045, 0.05, 0.045, 0.04, 0.03, 0.01], sides=4, colors=MOON)))
    m.add(hoop(0.31, 0.035, STEEL_DK, (0, 0.08, 0.5), 8))
    return m, '#d8e4ff'


def lg_severance_striders():
    """A boot of two halves, stone-grey and leaf-green, and beside it the pale outline of where else it is standing."""
    m = G('lg_severance_striders')
    _boot(m, KK_STONE_LT, KK_STONE_DK)
    m.add(blk(0.22, 0.74, 0.28, ('#243a1c', '#5a8a3a'), (-0.11, -0.14, -0.31)))
    m.add(shell([(0.26, -0.1), (0.26, 0.4)], ('#243a1c', '#5a8a3a'), gap=math.pi, sides=4, thick=0.03).xf(rz(math.pi / 2), (0, 0.08, 0)))
    m.add(glowing(blk(0.035, 0.84, 0.86, ('#9af0ff', '#ffffff'), (0, -0.14, -0.44))))
    GH = ('#9af0ff', '#ffffff')
    m.add(glowing(blk(0.44, 0.8, 0.03, GH, (0.42, 0.06, -0.44))))
    m.add(glowing(hoop(0.25, 0.02, GH, (0.42, 0.3, 0.3), 8)))
    for (dx, dy) in ((0.25, 0), (-0.25, 0), (0, 0.25), (0, -0.25)):
        m.add(glowing(blk(0.02, 0.02, 0.7, GH, (0.42 + dx, 0.3 + dy, -0.4))))
    return m, '#a0f0ff'


def lg_dawnchaser_boots():
    """A runner's boot the gold of first light, a sunrise on the toe-cap, and the ember it carries burning at the heel."""
    m = G('lg_dawnchaser_boots')
    DAWN = ('#c8741a', '#ffd070')
    _boot(m, DAWN, ('#7a2a1a', '#c8503a'))
    m.add(glowing(lathe([(0.0, 0.0), (0.2, 0.0), (0.2, 0.05), (0.0, 0.05)], sides=8, colors=('#ffb428', '#fff4b8')).xf(rx(math.pi / 2 - 0.9), (0, -0.46, -0.16))))
    for a in (-0.9, -0.45, 0.0, 0.45, 0.9):
        m.add(glowing(cone(0.03, 0.16, ('#ffb428', '#fff4b8'), (0.24 * math.sin(a), -0.4 + 0.05 * abs(a), -0.06 + 0.1 * math.cos(a)), 4, ry(a) @ rx(-0.6))))
    _cuff(m, WHITE, h=0.08)
    m.add(flame((0, 0.36, -0.2), 1.5, EMBER))
    m.add(flame((0, 0.5, -0.06), 1.0, FLAME))
    return m, '#ffc040'


# ── rings: the origin at the hand; worn large, to be seen; the stone stands up +Z ─────────────────────────────
def lg_moonstone_signet():
    """The peddler's own mark: a silver signet with a milky moonstone, their sign scratched across it."""
    m = G('lg_moonstone_signet', 0.008)
    _band(m, SILVER, 0.2, 0.06)
    m.add(cyl(0.15, 0.06, SILVER, (0, 0, 0.19), 8))
    m.add(glowing(blob(0.12, 0.12, 0.08, seg=7, rings=4, colors=('#a8c8ff', '#ffffff')).xf(None, (0, 0, 0.27))))
    m.add(trim(blk(0.2, 0.025, 0.02, STEEL_DK, (0, 0, 0.335), rz(0.7))))
    return m, '#cfe0ff'


def lg_toll_ring():
    """A ferry-coin beaten round into a ring, the hole it was strung by still in it."""
    m = G('lg_toll_ring', 0.008)
    _band(m, COPPER, 0.2, 0.05)
    m.add(cyl(0.17, 0.05, COPPER, (0, 0.025, 0.24), 10, R=rx(math.pi / 2 - 0.5)))
    m.add(trim(cyl(0.05, 0.07, CLOTH_BLACK, (0, 0.035, 0.24), 6, R=rx(math.pi / 2 - 0.5))))
    m.add(hoop(0.17, 0.02, BRASS, (0, 0.0, 0.25), 10, rx(-0.5)))
    return m, None


def lg_thornprick_band():
    """A band of black briar, thorns outward all round, a single red drop on the longest."""
    m = G('lg_thornprick_band', 0.008)
    _band(m, THORN, 0.2, 0.05)
    for k in range(7):
        a = k * TAU / 7
        m.add(cone(0.035, 0.22 if k == 0 else 0.13, THORN, (0.22 * math.sin(a), 0, 0.22 * math.cos(a)), 4, ry(a)))
    m.add(glowing(ball(0.04, ('#b01020', '#ff5060'), (0, 0, 0.45), 5, 3)))
    return m, '#ff4050'


def lg_hearthstone_loop():
    """A copper loop holding a plain grey pebble from under the first hearth, still warm underneath."""
    m = G('lg_hearthstone_loop', 0.008)
    _band(m, COPPER, 0.2, 0.055)
    m.add(glowing(disc(0.13, 0.04, EMBER, (0, 0, 0.19), 7)))
    m.add(blob(0.15, 0.13, 0.1, seg=6, rings=4, colors=KK_STONE, jitter=0.08, seed=3).xf(None, (0, 0, 0.3)))
    for a in (0.5, 2.6, 4.7):
        m.add(tube([(0.13 * math.cos(a), 0.13 * math.sin(a), 0.2), (0.1 * math.cos(a), 0.1 * math.sin(a), 0.36)], 0.018, sides=4, colors=COPPER))
    return m, '#ff8a40'


def lg_bogpearl_ring():
    """A band green with marsh-bronze and a dark pearl on it with a sheen like oil on water."""
    m = G('lg_bogpearl_ring', 0.008)
    _band(m, ('#3a5a34', '#8ab87a'), 0.2, 0.055)
    m.add(cyl(0.1, 0.05, ('#3a5a34', '#8ab87a'), (0, 0, 0.2), 6))
    m.add(glowing(ball(0.12, ('#143c44', '#8af0d8'), (0, 0, 0.33), 7, 5)))
    return m, '#70e0c8'


def lg_whisperknot_band():
    """A ribbon knotted once and dipped in silver, the two ends standing off the band."""
    m = G('lg_whisperknot_band', 0.008)
    _band(m, SILVER, 0.2, 0.045)
    m.add(ball(0.08, SILVER, (0, 0, 0.25), 6, 4))
    for sx in (-1, 1):
        m.add(tube([(0, 0, 0.25), (sx * 0.16, 0, 0.42), (sx * 0.26, 0, 0.3), (0, 0, 0.25)], 0.03, sides=4, colors=SILVER))
        m.add(tube([(0, 0, 0.25), (sx * 0.1, -0.06, 0.1), (sx * 0.16, -0.08, -0.04)], [0.03, 0.03, 0.01], sides=4, colors=SILVER))
    return m, None


def lg_acorn_promise():
    """An acorn in its cup, set upright on a copper band."""
    m = G('lg_acorn_promise', 0.008)
    _band(m, COPPER, 0.2, 0.05)
    m.add(blob(0.11, 0.11, 0.15, seg=7, rings=5, colors=('#7a5a1e', '#d8a848')).xf(None, (0, 0, 0.3)))
    m.add(lathe([(0.13, 0.0), (0.12, 0.06), (0.0, 0.1)], sides=7, colors=KK_WOOD_DK).xf(None, (0, 0, 0.36)))
    m.add(cyl(0.02, 0.07, KK_WOOD_DK, (0, 0, 0.45), 4))
    m.add(cone(0.03, 0.06, ('#7a5a1e', '#d8a848'), (0, 0, 0.16), 5, rx(math.pi)))
    return m, None


def lg_candlekeeper_band():
    """A brass band with a stub of candle standing on it, alight."""
    m = G('lg_candlekeeper_band', 0.008)
    _band(m, BRASS, 0.2, 0.055)
    m.add(disc(0.11, 0.03, BRASS, (0, 0, 0.2), 7))
    candle(m, (0, 0, 0.22), 0.16, 0.06, True, WAX, 1.1)
    m.add(cone(0.025, 0.07, WAX, (0.05, 0, 0.3), 4, rx(math.pi)))
    return m, '#ffc050'


def lg_stormglass_ring():
    """A ball of glass in silver claws with a grey cloud in it, and a thread of lightning in the cloud."""
    m = G('lg_stormglass_ring', 0.008)
    _band(m, SILVER, 0.2, 0.05)
    m.add(glowing(ball(0.15, ('#4a6088', '#c8dcf8'), (0, 0, 0.36), 7, 5)))
    for a in (0.3, 1.87, 3.44, 5.0):
        m.add(tube([(0.07 * math.cos(a), 0.07 * math.sin(a), 0.2), (0.16 * math.cos(a), 0.16 * math.sin(a), 0.3), (0.13 * math.cos(a), 0.13 * math.sin(a), 0.44)], 0.018, sides=4, colors=SILVER))
    m.add(glowing(tube([(0.05, -0.16, 0.44), (-0.03, -0.17, 0.37), (0.04, -0.17, 0.33), (-0.02, -0.15, 0.26)], 0.014, sides=3, colors=('#ffe24a', '#ffffff'))))
    return m, '#c0d8ff'


def lg_gravekeeper_seal():
    """An iron ring with a square seal: a lych-gate, shut, cut into black wax."""
    m = G('lg_gravekeeper_seal', 0.008)
    _band(m, KK_IRON, 0.2, 0.06)
    m.add(blk(0.3, 0.24, 0.08, KK_IRON, (0, 0, 0.2)))
    m.add(trim(blk(0.24, 0.18, 0.02, CLOTH_BLACK, (0, 0, 0.28))))
    for x in (-0.07, 0.0, 0.07):
        m.add(trim(blk(0.025, 0.14, 0.02, STEEL, (x, 0, 0.3))))
    m.add(trim(blk(0.2, 0.025, 0.02, STEEL, (0, 0.03, 0.31))))
    return m, None


def lg_foxfire_loop():
    """A copper loop with two small ears to its setting and a cold blue-green flame standing in it."""
    m = G('lg_foxfire_loop', 0.008)
    _band(m, COPPER, 0.2, 0.05)
    m.add(disc(0.1, 0.04, COPPER, (0, 0, 0.2), 6))
    for sx in (-1, 1):
        m.add(cone(0.05, 0.14, COPPER, (sx * 0.1, 0, 0.22), 4, ry(sx * 0.4)))
    m.add(flame((0, 0, 0.23), 1.5, ('#2fd0a8', '#e0fff4')))
    return m, '#60ffd0'


def lg_midnight_meridian():
    """A small dark dial on a band, a silver hand on it that points to wherever midnight is, a star at the top."""
    m = G('lg_midnight_meridian', 0.008)
    _band(m, SILVER, 0.2, 0.05)
    R = rx(math.pi / 2 - 0.5)
    m.add(cyl(0.19, 0.05, NIGHT, (0, 0.025, 0.28), 12, R=R))
    m.add(hoop(0.19, 0.022, SILVER, (0, 0.0, 0.29), 12, rx(-0.5)))
    m.add(trim(blk(0.025, 0.02, 0.15, SILVER, (0, -0.04, 0.27), rx(-0.5) @ ry(0.7))))
    m.add(glowing(lathe([(0.0, -0.05), (0.035, 0.0), (0.0, 0.05)], sides=4, colors=('#fff0a0', '#ffffff')).xf(None, (0, 0.05, 0.47))))
    return m, '#fff0b0'


def lg_wolfpact_band():
    """Iron and grey hair braided together, and on it a new moon: a black disc with the thinnest edge of light."""
    m = G('lg_wolfpact_band', 0.008)
    _band(m, KK_IRON, 0.2, 0.045)
    m.add(hoop(0.2, 0.035, FUR_GREY, (0, 0.04, 0), 10, rx(math.pi / 2) @ ry(0.25)))
    m.add(hoop(0.2, 0.035, FUR_GREY, (0, -0.04, 0), 10, rx(math.pi / 2) @ ry(-0.25)))
    m.add(glowing(disc(0.14, 0.03, MOON, (0.02, 0.015, 0.32), 10, rx(math.pi / 2))))
    m.add(trim(disc(0.135, 0.06, ('#06060a', '#14141c'), (0, 0.03, 0.32), 10, rx(math.pi / 2))))
    return m, '#d8e4ff'


def lg_beetlewing_ring():
    """A beetle's wing-cases, green shot with violet, closed over a band; the little head and horns at the front."""
    m = G('lg_beetlewing_ring', 0.008)
    _band(m, ('#1a3a2a', '#3a8a5a'), 0.2, 0.05)
    for sx in (-1, 1):
        m.add(glowing(blob(0.09, 0.17, 0.08, seg=6, rings=4, colors=('#0e6a4a', '#a8ffd0') if sx > 0 else ('#3a2a8a', '#c8a8ff')).xf(None, (sx * 0.075, 0.03, 0.27))))
    m.add(ball(0.06, CLOTH_BLACK, (0, -0.15, 0.26), 5, 3))
    for sx in (-1, 1):
        m.add(tube([(sx * 0.02, -0.18, 0.28), (sx * 0.08, -0.28, 0.34)], [0.015, 0.006], sides=3, colors=CLOTH_BLACK))
    return m, '#70f0b0'


def lg_sirens_knuckle():
    """A ring that is a small pink whelk, coiled, its mouth open to hum."""
    m = G('lg_sirens_knuckle', 0.008)
    SHELL = ('#c88a90', '#ffe8e0')
    _band(m, SHELL, 0.2, 0.05)
    pts = []; rad = []
    for k, a in enumerate(np.linspace(0, TAU * 2.2, 16)):
        r = 0.15 * (1 - k / 18)
        pts.append((r * math.cos(a), r * math.sin(a), 0.22 + 0.2 * k / 15)); rad.append(0.075 * (1 - k / 17))
    m.add(tube(pts, rad, sides=5, colors=SHELL))
    m.add(trim(ball(0.05, ('#8a3a50', '#d87a90'), (0.16, -0.03, 0.22), 5, 3)))
    return m, None


def lg_leyline_coil():
    """Silver wire wound five times round the finger, a blue current running in it."""
    m = G('lg_leyline_coil', 0.008)
    pts = [(0.2 * math.cos(a), -0.16 + 0.32 * a / (TAU * 5), 0.2 * math.sin(a)) for a in np.linspace(0, TAU * 5, 40)]
    m.add(tube(pts, 0.028, sides=4, colors=SILVER))
    m.add(glowing(tube([pts[k] for k in range(0, 40, 2)], 0.012, sides=3, colors=('#3a8aff', '#d0e8ff')).xf(None, (0, 0, 0), 1.12)))
    for (x, y, z) in (pts[0], pts[-1]):
        m.add(glowing(ball(0.045, ('#3a8aff', '#d0e8ff'), (x, y, z), 5, 3)))
    return m, '#60a0ff'


def lg_reliquary_ring():
    """A gold casket no bigger than a thumbnail, roofed and crossed, a lit window in its side, on a gold band."""
    m = G('lg_reliquary_ring', 0.008)
    _band(m, GOLD, 0.2, 0.055)
    m.add(blk(0.24, 0.18, 0.16, GOLD, (0, 0, 0.2)))
    m.add(lathe([(0.0, 0.0), (0.18, 0.0), (0.0, 0.12)], sides=4, colors=GOLD, phase=math.pi / 4).xf(None, (0, 0, 0.36), 1.0))
    m.add(glowing(blk(0.1, 0.2, 0.09, ('#ffb428', '#fff4b8'), (0, 0, 0.23))))
    m.add(trim(blk(0.02, 0.02, 0.1, GOLD, (0, 0, 0.47))))
    m.add(trim(blk(0.07, 0.02, 0.02, GOLD, (0, 0, 0.52))))
    return m, '#ffc840'


def lg_thirteenth_candle():
    """A black candle on a black band. It is not alight; there is a violet point at the wick all the same."""
    m = G('lg_thirteenth_candle', 0.008)
    BLKW = ('#16121c', '#4a4258')
    _band(m, BLKW, 0.2, 0.055)
    m.add(disc(0.12, 0.03, STEEL_DK, (0, 0, 0.2), 7))
    m.add(cyl(0.065, 0.26, BLKW, (0, 0, 0.22), 6))
    m.add(cone(0.03, 0.09, BLKW, (-0.055, 0, 0.36), 4, rx(math.pi)))
    m.add(cyl(0.012, 0.05, CLOTH_BLACK, (0, 0, 0.48), 3))
    m.add(glowing(ball(0.03, ('#8a4cff', '#e6d0ff'), (0, 0, 0.54), 4, 3)))
    return m, '#a070ff'


def lg_auditor_ledgerband():
    """A wide black band ruled in gold like a ledger, tallies cut in each column, a raven's quill laid across it."""
    m = G('lg_auditor_ledgerband', 0.008)
    m.add(tube([(0.2 * math.cos(a), 0, 0.2 * math.sin(a)) for a in np.linspace(0, TAU, 11)], 0.045, sides=4, colors=CLOTH_BLACK).xf(None, (0, 0, 0)))
    for y in (-0.07, 0.07):
        m.add(hoop(0.235, 0.018, GOLD, (0, y, 0), 10, rx(math.pi / 2)))
    for k in range(5):
        a = -0.6 + 0.3 * k
        m.add(trim(blk(0.02, 0.1, 0.02, GOLD, (0.25 * math.sin(a), 0, 0.25 * math.cos(a)), ry(a))))
    m.add(tube([(-0.2, 0.0, 0.26), (0.26, 0.0, 0.4)], [0.012, 0.006], sides=3, colors=KK_BONE))
    m.add(blk(0.3, 0.02, 0.1, FEATHER, (0.1, 0, 0.3), ry(1.28)))
    return m, None


def lg_severance_orbit():
    """A dark band with a splinter of sky set over it, and a thin pale ring going round the splinter, loose."""
    m = G('lg_severance_orbit', 0.008)
    _band(m, ('#1a1a2a', '#4a4a6a'), 0.2, 0.05)
    m.add(glowing(lathe([(0.0, -0.1), (0.07, 0.0), (0.0, 0.1)], sides=5, colors=('#9af0ff', '#ffffff')).xf(None, (0, 0, 0.42))))
    m.add(glowing(hoop(0.17, 0.014, ('#9af0ff', '#ffffff'), (0, 0, 0.42), 12, rx(0.5) @ ry(0.4))))
    m.add(hoop(0.2, 0.012, SILVER, (0, 0, 0.42), 12, rx(-0.9)))
    m.add(tube([(0, 0, 0.2), (0, 0, 0.3)], 0.014, sides=3, colors=SILVER))
    return m, '#a0f0ff'


LEGEND = {}
for _n, _f in list(globals().items()):
    if _n.startswith('lg_') and callable(_f):
        LEGEND[_n] = _f
