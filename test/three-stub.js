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
    distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
    lerp(v, t) { this.x += (v.x - this.x) * t; this.y += (v.y - this.y) * t; this.z += (v.z - this.z) * t; return this; }
    setScalar(s) { this.x = s; this.y = s; this.z = s; return this; }
    addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
    crossVectors() { return this; } setFromMatrixPosition() { return this; } applyMatrix4() { return this; }
    applyQuaternion() { return this; }
    // Fake projection: map a few thousand world units into NDC so label
    // math yields on-screen-ish positions and z<1 (visible).
    project() { this.x = Math.max(-0.9, Math.min(0.9, this.x / 3000)); this.y = Math.max(-0.9, Math.min(0.9, this.y / 3000)); this.z = 0.5; return this; }
  }
  class Color {
    constructor(c) { this.value = c; }
    set(c) { this.value = c; return this; }
    setHSL() { return this; }
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
    constructor() { this.ray = {}; }
    setFromCamera() {}
    intersectObjects() { return []; }
    intersectObject() { return []; }
  }
  class Fog { constructor(c, n, f) { this.color = new Color(c); this.near = n; this.far = f; } }

  const named = {
    Vector3, Color, Euler, Object3D, Group: class extends Object3D {}, Mesh, Sprite, Scene, Fog,
    PerspectiveCamera: Camera, OrthographicCamera: Camera, WebGLRenderer, CanvasTexture, Texture: CanvasTexture,
    Raycaster, DoubleSide: 2, FrontSide: 0, BackSide: 1, PCFSoftShadowMap: 1, sRGBEncoding: 3001,
    MathUtils: { lerp: (a, b, t) => a + (b - a) * t, clamp: (v, a, b) => Math.max(a, Math.min(b, v)), degToRad: (d) => d * Math.PI / 180 },
    AdditiveBlending: 2, NormalBlending: 1
  };

  // Everything else (BoxGeometry, MeshLambertMaterial, PointLight, …) is
  // pattern-matched: *Geometry → Geometry, *Material → Material, *Light /
  // anything else object-ish → Object3D subclass. Constructor args ignored.
  window.THREE = new Proxy(named, {
    get(target, prop) {
      if (prop in target) return target[prop];
      const name = String(prop);
      let cls;
      if (/Geometry$/.test(name)) cls = class extends Geometry { constructor() { super(); } };
      else if (/Material$/.test(name)) cls = class extends Material { constructor(p) { super(p); } };
      else if (/(Light|Helper)$/.test(name)) cls = class extends Object3D { constructor(c, i) { super(); this.intensity = i; this.color = new Color(c); this.castShadow = false; this.target = new Object3D(); this.shadow = { mapSize: {}, camera: {}, bias: 0 }; } };
      else cls = class extends Object3D {};
      target[prop] = cls; // cache so instanceof stays consistent
      return cls;
    }
  });
})();
