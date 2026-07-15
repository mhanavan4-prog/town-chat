// ---------------------------------------------------------------------------
// Fireball FX (Tier 3.4 Phase C). The flung-orb spell effect: spawnFireballFx
// launches a glowing core + light from the caster toward the target on an arc
// (reused by Leech Hex with reverse:true and by weapon attack styles), and
// updateFireballs flies + fades them each frame over the private activeFireballs
// pool. Timing consts + render-pos/scene helpers injected; CHAR + players via getters.
// ---------------------------------------------------------------------------
export default function createFireballs({ FIREBALL_FLIGHT_MS, FIREBALL_IMPACT_MS, FIREBALL_ARC_HEIGHT, getRenderPos, mobRenderPos, sceneForRoom, getChar, getPlayers }) {
  let activeFireballs = [];

// opts: { reverse, coreColor, glowColor, lightColor } — Leech Hex reuses
// this with reverse:true (the orb flies target -> caster, stolen life
// returning home) and crimson colors instead of fire orange.
function spawnFireballFx(casterId, targetId, targetType, opts) {
  opts = opts || {};
  const caster = getPlayers()[casterId];
  if (!caster) return;
  const scene = sceneForRoom(caster.room);
  if (!scene) return;
  let from = getRenderPos(caster);
  let to;
  if (!targetType || targetType === 'player') {
    const target = getPlayers()[targetId];
    if (!target) return;
    to = getRenderPos(target);
  } else {
    to = mobRenderPos(targetType, targetId);
    if (!to) return;
  }
  if (opts.reverse) { const tmp = from; from = to; to = tmp; }

  const g = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(9, 10, 8),
    new THREE.MeshBasicMaterial({ color: opts.coreColor || 0xffdd66 })
  );
  g.add(core);
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(15, 10, 8),
    new THREE.MeshBasicMaterial({ color: opts.glowColor || 0xff5500, transparent: true, opacity: 0.55 })
  );
  g.add(glow);
  const light = new THREE.PointLight(opts.lightColor || 0xff6a00, 2.4, 260);
  g.add(light);
  g.position.set(from.x, getChar().shoulderY, from.z);
  scene.add(g);

  activeFireballs.push({
    group: g, core, glow, light, scene,
    fromX: from.x, fromZ: from.z, toX: to.x, toZ: to.z,
    startAt: performance.now(), phase: 'flight'
  });
}

function updateFireballs() {
  if (!activeFireballs.length) return;
  const now = performance.now();
  for (let i = activeFireballs.length - 1; i >= 0; i--) {
    const fb = activeFireballs[i];
    if (fb.phase === 'flight') {
      const t = Math.min(1, (now - fb.startAt) / FIREBALL_FLIGHT_MS);
      fb.group.position.x = fb.fromX + (fb.toX - fb.fromX) * t;
      fb.group.position.z = fb.fromZ + (fb.toZ - fb.fromZ) * t;
      fb.group.position.y = getChar().shoulderY + Math.sin(Math.PI * t) * FIREBALL_ARC_HEIGHT;
      fb.group.rotation.y += 0.3;
      fb.core.scale.setScalar(1 + Math.sin(now * 0.02) * 0.08);
      if (t >= 1) {
        fb.phase = 'impact';
        fb.impactStartAt = now;
        fb.core.visible = false;
      }
    } else {
      const t = (now - fb.impactStartAt) / FIREBALL_IMPACT_MS;
      if (t >= 1) {
        fb.scene.remove(fb.group);
        activeFireballs.splice(i, 1);
        continue;
      }
      fb.glow.scale.setScalar(1 + t * 3.2);
      fb.glow.material.opacity = 0.55 * (1 - t);
      fb.light.intensity = 2.4 * (1 - t);
    }
  }
}

  return { spawnFireballFx, updateFireballs };
}
