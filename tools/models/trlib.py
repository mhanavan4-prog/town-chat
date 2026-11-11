"""Thornreach model kit: small numpy mesh builders + a Blender (bpy) exporter.

Every model is built as plain vertex/face arrays (Z up, 1 unit ~ the model's
height), coloured per vertex with a two-stop gradient (light at the tip, dark
at the base, as the KayKit palette swatches are), then written out as a .glb
through Blender's glTF exporter. Colours are given as sRGB hex and stored
linear, so they come out of the game's linear pipeline the way a KayKit
texture does.

Build with:  sh tools/models/build.sh plants|critters [names...]
"""
import math
import numpy as np

TAU = math.tau


def hexrgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])


def srgb_to_lin(c):
    c = np.asarray(c, dtype=float)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


# ── rotations ──────────────────────────────────────────────────────────────
def rx(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])


def ry(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def rz(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def look_rot(direction, up=(0, 0, 1)):
    """Rotation taking local +X to `direction` (keeps local +Z as near `up` as it can)."""
    d = np.asarray(direction, float); d = d / np.linalg.norm(d)
    u = np.asarray(up, float)
    if abs(np.dot(d, u)) > 0.98:
        u = np.array([0, 1.0, 0]) if abs(d[1]) < 0.9 else np.array([1.0, 0, 0])
    y = np.cross(u, d); y /= np.linalg.norm(y)
    z = np.cross(d, y)
    return np.stack([d, y, z], axis=1)


class Part:
    """A piece of mesh: verts (N,3), faces (list of tuples), t (N,) in 0..1 for the gradient."""

    def __init__(self, v, f, t, colors, glow=False, smooth=True, node=None):
        self.node = node
        self.v = np.asarray(v, float)
        self.f = [tuple(int(i) for i in face) for face in f]
        self.t = np.clip(np.asarray(t, float), 0, 1)
        self.colors = colors  # (dark_hex, light_hex) or a single hex
        self.glow = glow
        self.smooth = smooth

    def xf(self, R=None, T=(0, 0, 0), S=1.0):
        v = self.v * np.asarray(S, float)
        if R is not None:
            v = v @ np.asarray(R).T
        self.v = v + np.asarray(T, float)
        return self

    def copy(self):
        return Part(self.v.copy(), list(self.f), self.t.copy(), self.colors, self.glow, self.smooth, self.node)

    def vcolor(self):
        c = self.colors
        if isinstance(c, str):
            a = b = hexrgb(c)
        else:
            a, b = hexrgb(c[0]), hexrgb(c[1])
        t = self.t[:, None]
        return srgb_to_lin(a * (1 - t) + b * t)


# ── generators ─────────────────────────────────────────────────────────────
def tube(path, radii, sides=6, colors=('#2f5a2a', '#4f8a3a'), cap_base=False, t_range=(0, 1), twist=0.0):
    """Sweep a ring along a polyline (parallel-transport frames). radii: scalar, list, or fn(s)."""
    P = np.asarray(path, float)
    n = len(P)
    s = np.linspace(0, 1, n)
    if callable(radii):
        R = np.array([radii(x) for x in s])
    else:
        R = np.broadcast_to(np.asarray(radii, float), (n,)).copy()
    T = np.gradient(P, axis=0)
    T /= np.linalg.norm(T, axis=1)[:, None]
    ref = np.array([0, 0, 1.0]) if abs(T[0][2]) < 0.9 else np.array([1.0, 0, 0])
    N = np.cross(T[0], ref); N /= np.linalg.norm(N)
    frames = []
    for i in range(n):
        if i > 0:
            N = N - np.dot(N, T[i]) * T[i]
            N /= np.linalg.norm(N)
        B = np.cross(T[i], N)
        frames.append((N.copy(), B))
    v, t = [], []
    for i in range(n):
        Nn, B = frames[i]
        for k in range(sides):
            a = TAU * k / sides + twist * s[i]
            v.append(P[i] + R[i] * (math.cos(a) * Nn + math.sin(a) * B))
            t.append(t_range[0] + (t_range[1] - t_range[0]) * s[i])
    f = []
    for i in range(n - 1):
        for k in range(sides):
            a, b = i * sides + k, i * sides + (k + 1) % sides
            f.append((a, b, b + sides, a + sides))
    if R[-1] < 1e-6:  # collapse the tip ring (degenerate quads are fine, but make it a fan)
        pass
    if cap_base:
        v.append(P[0]); t.append(t_range[0])
        c = len(v) - 1
        for k in range(sides):
            f.append((c, (k + 1) % sides, k))
    return Part(v, f, t, colors)


def lathe(profile, sides=10, colors=('#cccccc', '#ffffff'), t_of=None, close_top=True, close_bottom=False, phase=0.0):
    """Revolve [(r, z), ...] about Z. t defaults to the profile index."""
    prof = np.asarray(profile, float)
    m = len(prof)
    v, t = [], []
    for i, (r, z) in enumerate(prof):
        for k in range(sides):
            a = TAU * k / sides + phase
            v.append((r * math.cos(a), r * math.sin(a), z))
            t.append(t_of[i] if t_of is not None else i / max(1, m - 1))
    f = []
    for i in range(m - 1):
        for k in range(sides):
            a, b = i * sides + k, i * sides + (k + 1) % sides
            f.append((a, b, b + sides, a + sides))
    if close_top and prof[-1][0] > 1e-6:
        v.append((0, 0, prof[-1][1])); t.append(t[-1])
        c = len(v) - 1
        base = (m - 1) * sides
        for k in range(sides):
            f.append((base + k, base + (k + 1) % sides, c))
    if close_bottom and prof[0][0] > 1e-6:
        v.append((0, 0, prof[0][1])); t.append(t[0])
        c = len(v) - 1
        for k in range(sides):
            f.append(((k + 1) % sides, k, c))
    return Part(v, f, t, colors)


def blob(rx_, ry_, rz_, seg=8, rings=6, colors=('#333333', '#777777'), t_axis=2, jitter=0.0, seed=0):
    """Low-poly ellipsoid centred on the origin."""
    rng = np.random.default_rng(seed)
    v, t = [(0, 0, -rz_)], [0.0]
    for i in range(1, rings):
        th = math.pi * i / rings
        for k in range(seg):
            ph = TAU * k / seg + (0.5 * TAU / seg if i % 2 else 0)
            j = 1 + (rng.uniform(-jitter, jitter) if jitter else 0)
            p = (rx_ * math.sin(th) * math.cos(ph) * j, ry_ * math.sin(th) * math.sin(ph) * j, -rz_ * math.cos(th) * j)
            v.append(p); t.append(0.5 - 0.5 * math.cos(th))
    v.append((0, 0, rz_)); t.append(1.0)
    f = []
    for k in range(seg):
        f.append((0, 1 + (k + 1) % seg, 1 + k))
    for i in range(rings - 2):
        a0, b0 = 1 + i * seg, 1 + (i + 1) * seg
        for k in range(seg):
            k1 = (k + 1) % seg
            if i % 2 == 0:
                f.append((a0 + k, a0 + k1, b0 + k)); f.append((a0 + k1, b0 + k1, b0 + k))
            else:
                f.append((a0 + k, a0 + k1, b0 + k1)); f.append((a0 + k, b0 + k1, b0 + k))
    top = len(v) - 1
    last = 1 + (rings - 2) * seg
    for k in range(seg):
        f.append((last + k, last + (k + 1) % seg, top))
    P = Part(v, f, t, colors)
    if t_axis != 2:
        P.t = (P.v[:, t_axis] - P.v[:, t_axis].min()) / max(1e-9, np.ptp(P.v[:, t_axis]))
    return P


def blade(length, width, shape, segs=6, cols=5, fold=0.25, droop=0.6, rise=1.0, cup=0.0,
          colors=('#2f6a2a', '#6fae52'), tip_curl=0.0, wave=0.0, wave_n=3):
    """A leaf or petal lying along +X from the origin, face up (+Z).

    shape(s) -> half-width factor 0..1 at s (0 base, 1 tip). fold: V-crease
    depth (fraction of width) so the midrib sits low; cup: edges curl up.
    rise: starting pitch (radians up from horizontal); droop: how much the
    pitch falls by the tip. wave: wavy margin amplitude.
    """
    v, t = [], []
    # spine along an arc
    pts = [np.zeros(3)]
    ds = length / segs
    ang = []
    for i in range(segs + 1):
        s = i / segs
        a = rise - droop * s - tip_curl * s ** 3
        ang.append(a)
        if i > 0:
            pa = ang[i - 1]
            pts.append(pts[-1] + ds * np.array([math.cos(pa), 0, math.sin(pa)]))
    for i in range(segs + 1):
        s = i / segs
        hw = width * 0.5 * max(0.0, shape(s))
        a = ang[i]
        up = np.array([-math.sin(a), 0, math.cos(a)])
        side = np.array([0, 1.0, 0])
        for j in range(cols):
            u = -1 + 2 * j / (cols - 1)
            w = hw * u
            if wave:
                w *= 1 + wave * math.sin(s * math.pi * wave_n * 2) * abs(u)
            lift = fold * width * abs(u) + cup * width * u * u
            v.append(pts[i] + side * w + up * lift)
            t.append(s)
    f = []
    for i in range(segs):
        for j in range(cols - 1):
            a = i * cols + j
            f.append((a, a + 1, a + cols + 1, a + cols))
    return Part(v, f, t, colors)


# common outlines
def ovate(s):
    return math.sin(math.pi * min(1, s * 0.92 + 0.04)) ** 0.75 * (1.15 - 0.35 * s)


def lanceolate(s):
    return math.sin(math.pi * s) ** 0.9 * (1.1 - 0.4 * s) if s < 1 else 0.0


def linear(s):
    return (1 - s ** 3) * min(1, s * 6 + 0.25)


def heart(s):
    return (0.55 + 0.9 * math.sin(math.pi * min(1, s * 0.75 + 0.25)) ** 1.2) * (1 - s ** 2.2) if s < 1 else 0


def round_(s):
    return math.sin(math.pi * s) ** 0.6


def spoon(s):
    return (0.25 + 0.95 * s ** 0.8) * (1 - s ** 6) ** 0.5


# ── a model: list of parts → Blender mesh → .glb ───────────────────────────
class Model:
    """Parts in model space. Parts added inside `with m.node(name, pivot):` become a
    separate glTF node of that name, its origin at the pivot (a joint the game can
    turn: a leg at the hip, a wing at the shoulder). forward_x: the model is
    built facing +X and is turned on export to face the game's forward (+Z in
    three.js, which is Blender's -Y)."""

    def __init__(self, name, forward_x=False):
        self.name = name
        self.parts = []
        self.pivots = {}
        self._node = None
        self.forward_x = forward_x

    def node(self, name, pivot=(0, 0, 0)):
        model = self

        class _Ctx:
            def __enter__(self):
                model.pivots[name] = np.asarray(pivot, float)
                model._node = name
                return model

            def __exit__(self, *a):
                model._node = None
        return _Ctx()

    def add(self, *parts):
        for p in parts:
            if isinstance(p, (list, tuple)):
                self.add(*p)
            else:
                if self._node is not None and p.node is None:
                    p.node = self._node
                self.parts.append(p)
        return self

    def tris(self):
        return sum(len(p.f) for p in self.parts) * 2

    def export(self, path, glow_color='#ffffff', glow_strength=0.55):
        import bpy
        bpy.ops.wm.read_factory_settings(use_empty=True)
        turn = rz(-math.pi / 2) if self.forward_x else np.eye(3)
        mats = {}

        def material(glow):
            if glow in mats:
                return mats[glow]
            mat = bpy.data.materials.new('Glow' if glow else 'Plant')
            mat.use_nodes = True
            mat.use_backface_culling = False
            nt = mat.node_tree
            bsdf = nt.nodes.get('Principled BSDF')
            attr = nt.nodes.new('ShaderNodeVertexColor'); attr.layer_name = 'Col'
            nt.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
            bsdf.inputs['Roughness'].default_value = 0.8
            bsdf.inputs['Metallic'].default_value = 0.0
            if glow:
                gc = srgb_to_lin(hexrgb(glow_color)) * glow_strength
                bsdf.inputs['Emission Color'].default_value = (gc[0], gc[1], gc[2], 1.0)
                bsdf.inputs['Emission Strength'].default_value = 1.0
            mats[glow] = mat
            return mat

        root = None
        if self.pivots:
            root = bpy.data.objects.new(self.name, None)
            bpy.context.scene.collection.objects.link(root)
        node_names = [None] + list(self.pivots)
        objs = [root] if root else []
        for nn in node_names:
            pivot = self.pivots.get(nn, np.zeros(3))
            for glow in (False, True):
                ps = [p for p in self.parts if p.glow == glow and p.node == nn]
                if not ps:
                    continue
                V, F, C, S = [], [], [], []
                off = 0
                for p in ps:
                    V.append((p.v - pivot) @ turn.T); C.append(p.vcolor())
                    F.extend(tuple(i + off for i in face) for face in p.f)
                    S.extend([p.smooth] * len(p.f))
                    off += len(p.v)
                V = np.concatenate(V); C = np.concatenate(C)
                oname = (nn or (self.name if not root else 'body')) + ('_glow' if glow else '')
                me = bpy.data.meshes.new(oname)
                me.from_pydata(V.tolist(), [], F)
                me.update()
                for poly, sm in zip(me.polygons, S):
                    poly.use_smooth = sm
                ca = me.color_attributes.new(name='Col', type='FLOAT_COLOR', domain='POINT')
                rgba = np.ones((len(V), 4)); rgba[:, :3] = C
                ca.data.foreach_set('color', rgba.ravel())
                me.color_attributes.active_color = ca
                try:
                    me.set_sharp_from_angle(angle=math.radians(50))
                except Exception:
                    pass
                me.materials.append(material(glow))
                ob = bpy.data.objects.new(oname, me)
                bpy.context.scene.collection.objects.link(ob)
                if root:
                    ob.parent = root
                    ob.location = tuple(pivot @ turn.T)
                objs.append(ob)
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs:
            o.select_set(True)
        bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True,
                                  export_yup=True, export_normals=True, export_texcoords=False,
                                  export_vertex_color='ACTIVE', export_materials='EXPORT', export_animations=False)
        return path
