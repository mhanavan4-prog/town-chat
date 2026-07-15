// ---------------------------------------------------------------------------
// Ground traps (Tier 3.4 Phase C). The stumble-sigil hazards the server drops on
// the floor: a canvas sigil texture + its glowing ring mesh, plus apply/update of
// the groundTrapVisuals pool (build on first sight, pulse each frame, remove when
// gone). The pool is private to this module; getRenderPos + sceneForRoom are
// injected, the current world via getter.
// ---------------------------------------------------------------------------
export default function createGroundTraps({ getRenderPos, sceneForRoom, getWorld, getIndoorScale }) {
  let groundTrapVisuals = {}; // trapId -> { group, glow, radius }

function buildStumbleSigilTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const cx = c.getContext('2d');
  const mid = 128;
  cx.strokeStyle = 'rgba(178,90,255,0.95)';
  cx.lineWidth = 6;
  cx.beginPath(); cx.arc(mid, mid, 118, 0, Math.PI * 2); cx.stroke();
  cx.lineWidth = 3;
  cx.beginPath(); cx.arc(mid, mid, 96, 0, Math.PI * 2); cx.stroke();
  // Five-pointed star, the classic "hex circle" centerpiece.
  cx.beginPath();
  for (let i = 0; i <= 5; i++) {
    const ang = -Math.PI / 2 + i * (Math.PI * 4 / 5);
    const px = mid + Math.cos(ang) * 100, py = mid + Math.sin(ang) * 100;
    if (i === 0) cx.moveTo(px, py); else cx.lineTo(px, py);
  }
  cx.stroke();
  // Runic ticks ringing the outer edge.
  cx.lineWidth = 4;
  for (let i = 0; i < 10; i++) {
    const ang = i * (Math.PI * 2 / 10);
    cx.beginPath();
    cx.moveTo(mid + Math.cos(ang) * 106, mid + Math.sin(ang) * 106);
    cx.lineTo(mid + Math.cos(ang) * 124, mid + Math.sin(ang) * 124);
    cx.stroke();
  }
  return new THREE.CanvasTexture(c);
}
const STUMBLE_SIGIL_TEXTURE = buildStumbleSigilTexture();

function buildStumbleSigil(radius) {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 40),
    new THREE.MeshBasicMaterial({ map: STUMBLE_SIGIL_TEXTURE, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 1.5;
  g.add(disc);
  const glow = new THREE.PointLight(0xaa55ff, 1.0, radius * 3);
  glow.position.y = 24;
  g.add(glow);
  g.userData = { disc, glow, pulsePhase: Math.random() * Math.PI * 2 };
  return g;
}

function applyGroundTrapsState(list) {
  const seenIds = new Set();
  for (const t of list) {
    seenIds.add(t.id);
    if (groundTrapVisuals[t.id]) continue;
    const scene = sceneForRoom(t.room);
    if (!scene) continue;
    const b = getWorld() && getWorld().buildings.find(bb => bb.id === t.room);
    const scale = b ? getIndoorScale() : 1;
    const rp = getRenderPos({ room: t.room, x: t.x, y: t.y });
    const group = buildStumbleSigil(t.radius * scale);
    group.position.set(rp.x, 0, rp.z);
    scene.add(group);
    groundTrapVisuals[t.id] = group;
  }
  for (const id in groundTrapVisuals) {
    if (seenIds.has(id)) continue;
    const group = groundTrapVisuals[id];
    if (group.parent) group.parent.remove(group);
    delete groundTrapVisuals[id];
  }
}

function updateGroundTrapVisuals() {
  const now = performance.now();
  for (const id in groundTrapVisuals) {
    const v = groundTrapVisuals[id].userData;
    const pulse = 0.8 + Math.sin(now * 0.003 + v.pulsePhase) * 0.2;
    v.disc.material.opacity = 0.9 * pulse;
    v.glow.intensity = 1.0 * pulse;
  }
}

  return { applyGroundTrapsState, updateGroundTrapVisuals };
}
