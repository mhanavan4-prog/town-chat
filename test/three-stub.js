// A minimal THREE.js r128 stand-in for HEADLESS UI TESTING ONLY.
// It renders nothing — it exists so client.js can fully evaluate (and the
// DOM HUD can be exercised/screenshot) in sandboxes where the real three.js
// CDN is unreachable. Served by test/mobile-shots.cjs via Playwright route
// interception; never shipped to real players.
(function () {
  class Vector3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    copy(v) { this.x = v.x || 0; this.y = v.y || 0; this.z = v.z || 0; return this; }
    clone() { return new Vector3(this.x, this.y, this.z); }
    add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
    sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
    multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
    normalize() { const l = Math.hypot(this.x, this.y, this.z) || 1; return this.multiplyScalar(1 / l); }
    length() { return Math.hypot(this.x, this.y, this.z); }
    lengthSq() { return this.x * this.x + this.y * this.y + this.z * this.z; }
    manhattanLength() { return Math.abs(this.x) + Math.abs(this.y) + Math.abs(this.z); }
    setLength(l) { return this.normalize().multiplyScalar(l); }
    distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
    distanceToSquared(v) { const dx = this.x - v.x, dy = this.y - v.y, dz = this.z - v.z; return dx * dx + dy * dy + dz * dz; }
    lerp(v, t) { this.x += (v.x - this.x) * t; this.y += (v.y - this.y) * t; this.z += (v.z - this.z) * t; return this; }
    lerpVectors(a, b, t) { this.x = a.x + (b.x - a.x) * t; this.y = a.y + (b.y - a.y) * t; this.z = a.z + (b.z - a.z) * t; return this; }
    setScalar(s) { this.x = s; this.y = s; this.z = s; return this; }
    addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
    addVectors(a, b) { this.x = a.x + b.x; this.y = a.y + b.y; this.z = a.z + b.z; return this; }
    subVectors(a, b) { this.x = a.x - b.x; this.y = a.y - b.y; this.z = a.z - b.z; return this; }
    multiply(v) { this.x *= v.x; this.y *= v.y; this.z *= v.z; return this; }
    multiplyScalarSafe(s) { return this.multiplyScalar(s); }
    divideScalar(s) { return this.multiplyScalar(1 / (s || 1)); }
    dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
    cross(v) { return this.crossVectors(this, v); }
    negate() { this.x = -this.x; this.y = -this.y; this.z = -this.z; return this; }
    min(v) { this.x = Math.min(this.x, v.x); this.y = Math.min(this.y, v.y); this.z = Math.min(this.z, v.z); return this; }
    max(v) { this.x = Math.max(this.x, v.x); this.y = Math.max(this.y, v.y); this.z = Math.max(this.z, v.z); return this; }
    clamp(a, b) { this.x = Math.max(a.x, Math.min(b.x, this.x)); this.y = Math.max(a.y, Math.min(b.y, this.y)); this.z = Math.max(a.z, Math.min(b.z, this.z)); return this; }
    round() { this.x = Math.round(this.x); this.y = Math.round(this.y); this.z = Math.round(this.z); return this; }
    floor() { this.x = Math.floor(this.x); this.y = Math.floor(this.y); this.z = Math.floor(this.z); return this; }
    ceil() { this.x = Math.ceil(this.x); this.y = Math.ceil(this.y); this.z = Math.ceil(this.z); return this; }
    angleTo(v) { const d = this.length() * (v.length ? v.length() : 1); return d ? Math.acos(Math.max(-1, Math.min(1, this.dot(v) / d))) : 0; }
    equals(v) { return this.x === v.x && this.y === v.y && this.z === v.z; }
    toArray() { return [this.x, this.y, this.z]; }
    fromArray(a, o = 0) { this.x = a[o]; this.y = a[o + 1]; this.z = a[o + 2]; return this; }
    setFromSpherical() { return this; }
    setFromMatrixColumn() { return this; }
    applyEuler() { return this; }
    projectOnVector() { return this; }
    reflect() { return this; }
    crossVectors(a, b) { const ax = a.x, ay = a.y, az = a.z, bx = b.x, by = b.y, bz = b.z; this.x = ay * bz - az * by; this.y = az * bx - ax * bz; this.z = ax * by - ay * bx; return this; }
    setFromMatrixPosition() { return this; } applyMatrix4() { return this; }
    applyQuaternion() { return this; } unproject() { return this; }
    // Fake projection: map a few thousand world units into NDC so label
    // math yields on-screen-ish positions and z<1 (visible).
    project() { this.x = Math.max(-0.9, Math.min(0.9, this.x / 3000)); this.y = Math.max(-0.9, Math.min(0.9, this.y / 3000)); this.z = 0.5; return this; }
  }
  class Color {
    constructor(c) { this.value = c; }
    set(c) { this.value = c; return this; }
    setHex(h) { this.value = h; return this; }
    getHex() { return typeof this.value === 'number' ? this.value : 0; }
    setHSL() { return this; }
    setRGB() { return this; }
    offsetHSL() { return this; }
    lerp() { return this; }
    copy() { return this; }
    clone() { return new Color(this.value); }
  }
  class Euler {
    constructor() { this.x = 0; this.y = 0; this.z = 0; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  }
  let _idc = 1;
  class Object3D {
    constructor() {
      this.id = _idc++;
      this.children = [];
      this.parent = null;
      this.position = new Vector3();
      this.rotation = new Euler();
      this.scale = new Vector3(1, 1, 1);
      this.visible = true;
      this.userData = {};
      this.material = null;
      this.geometry = null;
    }
    add(...objs) { for (const o of objs) { if (!o) continue; o.parent = this; this.children.push(o); } return this; }
    remove(...objs) { for (const o of objs) { const i = this.children.indexOf(o); if (i >= 0) { this.children.splice(i, 1); o.parent = null; } } return this; }
    traverse(fn) { fn(this); for (const c of this.children.slice()) c.traverse ? c.traverse(fn) : fn(c); }
    getWorldPosition(v) { v.set(this.position.x, this.position.y, this.position.z); return v; }
    getObjectByName(name) { let found = null; this.traverse(o => { if (!found && o.name === name) found = o; }); return found; }
    lookAt() { return this; }
    updateMatrixWorld() {}
    clone() { return new Object3D(); }
  }
  class Material {
    constructor(params) {
      Object.assign(this, params || {});
      if (!(this.color instanceof Color)) this.color = new Color(this.color);
      if (this.opacity === undefined) this.opacity = 1;
      if (this.transparent === undefined) this.transparent = false;
      this.map = this.map || null;
      if (!(this.emissive instanceof Color)) this.emissive = new Color(this.emissive || 0);
    }
    clone() { return new Material({ ...this, color: this.color && this.color.value }); }
    dispose() {}
  }
  class Geometry {
    constructor() { this.attributes = { position: { count: 0, array: [], setXYZ() {}, needsUpdate: false } }; this.parameters = {}; }
    dispose() {}
    clone() { return new Geometry(); }
    setAttribute() { return this; }
    rotateX() { return this; } rotateY() { return this; } rotateZ() { return this; }
    translate() { return this; } scale() { return this; } center() { return this; }
    computeVertexNormals() { return this; } setFromPoints() { return this; }
    setIndex() { return this; } toNonIndexed() { return this; }
  }
  class Mesh extends Object3D {
    constructor(geometry, material) { super(); this.geometry = geometry || new Geometry(); this.material = material || new Material(); this.isMesh = true; }
    clone() { const m = new Mesh(this.geometry, this.material); return m; }
  }
  class Sprite extends Object3D { constructor(material) { super(); this.material = material || new Material(); this.center = { set() {} }; } }
  // Points/Line/LineSegments take (geometry, material) like Mesh. The catch-all
  // proxy would otherwise make them bare Object3Ds with geometry===null, and
  // the fireflies' per-frame update reads pts.geometry.attributes.position —
  // a null-deref that threw inside the RAF loop every frame, aborting update()
  // before movement ran (so nothing could walk into a building headless).
  class Points extends Object3D { constructor(geometry, material) { super(); this.geometry = geometry || new Geometry(); this.material = material || new Material(); this.isPoints = true; } }
  class Line extends Object3D { constructor(geometry, material) { super(); this.geometry = geometry || new Geometry(); this.material = material || new Material(); this.isLine = true; } }
  class Camera extends Object3D {
    constructor() { super(); this.aspect = 1; this.fov = 60; this.near = 1; this.far = 4000; this.quaternion = {}; }
    updateProjectionMatrix() {}
  }
  class Scene extends Object3D { constructor() { super(); this.background = null; this.fog = null; } }
  class WebGLRenderer {
    constructor() {
      this.domElement = document.createElement('canvas');
      this.domElement.width = window.innerWidth; this.domElement.height = window.innerHeight;
      this.shadowMap = { enabled: false, type: 0 };
      this.outputEncoding = 0;
    }
    setSize(w, h) { this.domElement.width = w; this.domElement.height = h; }
    setPixelRatio() {}
    render() {}
    dispose() {}
  }
  class CanvasTexture {
    constructor(c) {
      this.image = c; this.needsUpdate = false;
      const v2 = () => ({ x: 0, y: 0, set() { return this; } });
      this.repeat = v2(); this.offset = v2(); this.center = v2();
      this.wrapS = 0; this.wrapT = 0; this.magFilter = 0; this.minFilter = 0;
      this.encoding = 0; this.rotation = 0; this.anisotropy = 1;
    }
    dispose() {}
    clone() { return new CanvasTexture(this.image); }
  }
  class Raycaster {
    constructor(origin, direction, near = 0, far = Infinity) {
      this.ray = { origin: origin || new Vector3(), direction: direction || new Vector3(), set(o, d) { this.origin = o; this.direction = d; } };
      this.near = near; this.far = far;
    }
    set(origin, direction) { this.ray.origin = origin; this.ray.direction = direction; return this; }
    setFromCamera() {}
    intersectObjects() { return []; }
    intersectObject() { return []; }
  }
  class Fog { constructor(c, n, f) { this.color = new Color(c); this.near = n; this.far = f; } }

  // Loader chain — enough for the REAL GLTFLoader.js/SkeletonUtils.js (loaded
  // as separate <script>s, not stubbed) to construct and run against this
  // THREE without throwing. client.js calls KK.load() at module-eval time,
  // which does `new THREE.GLTFLoader().load(...)`; the real loader reaches for
  // `this.manager.itemStart` and a `THREE.FileLoader`. Without these it threw
  // synchronously at the top level and aborted the ENTIRE client.js eval —
  // no join handlers, no window.__testDrive. We don't render assets in
  // headless, so every FileLoader.load just fails fast into the caller's
  // onError, and GLTFLoader falls back to procedural meshes exactly as it
  // does for a real player whose asset fetch 404s.
  class LoadingManager {
    itemStart() {} itemEnd() {} itemError() {} itemProgress() {}
    resolveURL(u) { return u; } setURLModifier() { return this; }
    onStart() {} onLoad() {} onProgress() {} onError() {}
  }
  const DefaultLoadingManager = new LoadingManager();
  class Loader {
    constructor(manager) {
      this.manager = manager !== undefined ? manager : DefaultLoadingManager;
      this.crossOrigin = 'anonymous'; this.withCredentials = false;
      this.path = ''; this.resourcePath = ''; this.requestHeader = {};
    }
    setPath() { return this; } setResourcePath() { return this; }
    setCrossOrigin() { return this; } setWithCredentials() { return this; }
    setRequestHeader() { return this; } setResponseType() { return this; }
    load() {}
  }
  class FileLoader extends Loader {
    load(url, onLoad, onProgress, onError) {
      // Nothing to fetch in headless — report failure so the caller (e.g.
      // GLTFLoader) takes its error/fallback path instead of hanging.
      if (onError) setTimeout(() => onError(new Error('three-stub: no asset fetch in headless')), 0);
    }
  }

  const named = {
    Vector3, Color, Euler, Object3D, Group: class extends Object3D {}, Mesh, Sprite, Scene, Fog,
    Points, Line, LineSegments: class extends Line {}, LineLoop: class extends Line {},
    PerspectiveCamera: Camera, OrthographicCamera: Camera, WebGLRenderer, CanvasTexture, Texture: CanvasTexture,
    Raycaster, DoubleSide: 2, FrontSide: 0, BackSide: 1, PCFSoftShadowMap: 1, sRGBEncoding: 3001,
    MathUtils: { lerp: (a, b, t) => a + (b - a) * t, clamp: (v, a, b) => Math.max(a, Math.min(b, v)), degToRad: (d) => d * Math.PI / 180 },
    AdditiveBlending: 2, NormalBlending: 1,
    Loader, FileLoader, LoadingManager, DefaultLoadingManager,
    LoaderUtils: {
      extractUrlBase(url) { const i = String(url).lastIndexOf('/'); return i === -1 ? './' : String(url).slice(0, i + 1); },
      resolveURL(u) { return u; },
      decodeText() { return ''; }
    }
  };

  // Post-processing is a no-op in headless. client.js gates its whole
  // EffectComposer/bloom pipeline on `typeof THREE.EffectComposer === 'function'`
  // (GFX.hasFX). The catch-all proxy below would make EVERY unknown name a
  // function, so that gate would pass and GFX.buildComposer() would run the
  // REAL fx.js passes — which call renderer.getSize() and a chain of GL that
  // this renderless stub can't honor, throwing mid-initScene and taking the
  // world (and the join flow) down with it. Reserve the post-processing names
  // as explicit `undefined` and refuse fx.js's attempts to overwrite them, so
  // hasFX() stays false and the client takes its plain renderer.render() path.
  const FX_BLOCKLIST = new Set(['EffectComposer', 'RenderPass', 'ShaderPass', 'UnrealBloomPass', 'FXAAShader', 'MaskPass', 'ClearMaskPass', 'CopyShader']);
  for (const k of FX_BLOCKLIST) named[k] = undefined;

  // Everything else (BoxGeometry, MeshLambertMaterial, PointLight, …) is
  // pattern-matched: *Geometry → Geometry, *Material → Material, *Light /
  // anything else object-ish → Object3D subclass. Constructor args ignored.
  window.THREE = new Proxy(named, {
    set(target, prop, value) {
      // Keep the post-processing names pinned to undefined even when fx.js
      // (loaded as a real <script> after this stub) assigns its classes onto
      // THREE — see FX_BLOCKLIST above.
      if (FX_BLOCKLIST.has(String(prop))) return true;
      target[prop] = value;
      return true;
    },
    get(target, prop) {
      if (prop in target) return target[prop];
      const name = String(prop);
      let cls;
      if (/Geometry$/.test(name)) cls = class extends Geometry { constructor() { super(); } };
      else if (/Material$/.test(name)) cls = class extends Material { constructor(p) { super(p); } };
      else if (/(Light|Helper)$/.test(name)) cls = class extends Object3D { constructor(c, i) { super(); this.intensity = i; this.color = new Color(c); this.castShadow = false; this.target = new Object3D(); this.shadow = { mapSize: { set() {}, x: 2048, y: 2048, width: 2048, height: 2048 }, camera: { updateProjectionMatrix() {}, left: 0, right: 0, top: 0, bottom: 0, near: 0, far: 0 }, bias: 0, radius: 1, normalBias: 0 }; } };
      else cls = class extends Object3D {};
      target[prop] = cls; // cache so instanceof stays consistent
      return cls;
    }
  });
})();
