// ---------------------------------------------------------------------------
// Ember Wastes resource nodes (client). Harvestable veins of Emberbloom and
// Cinder-Salt that feed the Artificer's Workshop. Positions + types arrive once
// in `ember_wastes_entered`; readiness (ready vs. freshly-harvested) rides the
// periodic wildlife_state. Each node is a small glowing cluster riding the
// scorched dunes, with a floating label and an interact kiosk; when spent it
// dims and sinks, re-blooming when the server says it's ready again.
// ---------------------------------------------------------------------------
export default function createEmberNodes({ getEmberScene, emberHeightAt, makeNpcNameSprite }) {
const groundY = (x, z) => (typeof emberHeightAt === 'function' ? emberHeightAt(x, z) : 0);
const NODE_STYLE = {
  emberbloom:  { color: 0xff5a7a, emissive: 0xff1a55, label: '🌺 Emberbloom',  shape: 'bloom' },
  cinder_salt: { color: 0xffe2a6, emissive: 0xffaa33, label: '🧂 Cinder-Salt', shape: 'crystal' },
};
let defs = [];
let visuals = {}; // id -> { group, ready }
let kiosks = [];

function buildGroup(def) {
  const style = NODE_STYLE[def.type] || NODE_STYLE.emberbloom;
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: style.color, emissive: style.emissive, emissiveIntensity: 0.9 });
  if (style.shape === 'crystal') {
    // A small cluster of amber shards.
    for (let i = 0; i < 5; i++) {
      const h = 16 + Math.random() * 20;
      const shard = new THREE.Mesh(new THREE.ConeGeometry(4 + Math.random() * 3, h, 5), mat);
      const a = (i / 5) * Math.PI * 2;
      shard.position.set(Math.cos(a) * 10, h / 2, Math.sin(a) * 10);
      shard.rotation.z = (Math.random() - 0.5) * 0.5;
      group.add(shard);
    }
  } else {
    // A low briar with glowing blooms.
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(2, 3, 22, 5), new THREE.MeshLambertMaterial({ color: 0x3a2018 }));
    stem.position.y = 11; group.add(stem);
    for (let i = 0; i < 4; i++) {
      const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(6 + Math.random() * 3, 0), mat);
      const a = (i / 4) * Math.PI * 2;
      bloom.position.set(Math.cos(a) * 9, 18 + Math.random() * 8, Math.sin(a) * 9);
      group.add(bloom);
    }
  }
  const label = makeNpcNameSprite(style.label);
  label.position.set(0, 52, 0);
  label.userData.isLabel = true;
  group.add(label);
  group.position.set(def.x, groundY(def.x, def.y), def.y);
  return group;
}

function clear() {
  const scene = getEmberScene();
  for (const id in visuals) if (scene && visuals[id].group.parent) scene.remove(visuals[id].group);
  visuals = {}; kiosks = [];
}

// Replace the node set from an `ember_wastes_entered` payload; returns the
// interact-kiosk list for the caller to fold into EMBER_KIOSKS.
function setNodeDefs(list) {
  clear();
  defs = list || [];
  const scene = getEmberScene();
  for (const def of defs) {
    const group = buildGroup(def);
    group.userData.kind = 'ember_node';
    if (scene) scene.add(group);
    visuals[def.id] = { group, ready: true, phase: Math.random() * 10 };
    kiosks.push({ x: def.x, z: def.y, node: 'ember_node', nodeId: def.id, radius: 150 });
  }
  return kiosks.slice();
}

function applyNodeStates(list) {
  for (const s of (list || [])) {
    const v = visuals[s.id];
    if (v) v.ready = !!s.ready;
  }
}

function updateNodeVisuals(dt) {
  for (const id in visuals) {
    const v = visuals[id];
    v.phase += dt;
    // Ready: full, gently pulsing and risen. Spent: dimmed and sunk.
    const target = v.ready ? 1 : 0;
    v.shown = v.shown === undefined ? target : v.shown + (target - v.shown) * (1 - Math.exp(-dt * 6));
    const pulse = v.ready ? 0.85 + Math.sin(v.phase * 2) * 0.15 : 0.1;
    v.group.scale.setScalar(0.35 + v.shown * 0.65);
    v.group.position.y = groundY(v.group.position.x, v.group.position.z) - (1 - v.shown) * 22;
    v.group.traverse(o => {
      if (o.isMesh && o.material && 'emissiveIntensity' in o.material) o.material.emissiveIntensity = pulse;
      if (o.userData && o.userData.isLabel) o.visible = v.ready;
    });
  }
}

function destroy() { clear(); defs = []; }

  return { setNodeDefs, applyNodeStates, updateNodeVisuals, getNodeKiosks: () => kiosks.slice(), destroyNodes: destroy };
}
