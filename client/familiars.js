// ---------------------------------------------------------------------------
// Familiars (Tier 3.5) — the witch's bonded companion, rendered as a small
// low-poly follower that trails behind its owner. Purely cosmetic and derived
// client-side: the familiar's id rides each player's publicPlayer broadcast,
// and every nearby client trails the matching creature behind that player's
// rendered position (read from the shared `visuals` map). The gameplay perk is
// applied server-side; nothing here touches the simulation.
//
// Same chibi language as client/creatures.js — Lambert bodies, a couple of
// distinguishing shapes, small unlit "glow" eyes.
// ---------------------------------------------------------------------------
export default function createFamiliars({ getPlayers, getVisuals, getMe, getSkinHex }) {
  let pool = {}; // playerId -> { group, type, skin, x, y, z, phase }

  function glow(color, r) { return new THREE.Mesh(new THREE.SphereGeometry(r, 6, 6), new THREE.MeshBasicMaterial({ color })); }
  // A bonded coat recolors only the PRIMARY body material of each familiar
  // (fur/feather/skin) — beaks, eyes, mouths and accents keep their own color.
  // `coat` is a numeric hex (from the owner's familiarSkin) or null for natural.
  function coatColor(coat, natural) { return (coat != null) ? coat : natural; }

  function makeCat(coat) {
    const g = new THREE.Group();
    const fur = new THREE.MeshLambertMaterial({ color: coatColor(coat, 0x1a1620) });
    const body = new THREE.Mesh(new THREE.SphereGeometry(3.4, 8, 8), fur); body.scale.set(1, 0.85, 1.5); body.position.y = 4.2; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(2.4, 8, 8), fur); head.position.set(0, 6, 3.4); g.add(head);
    for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(1, 2.2, 4), fur); ear.position.set(s * 1.3, 8, 3.4); g.add(ear); const e = glow(0x8cff7a, 0.5); e.position.set(s * 0.9, 6.2, 5.2); g.add(e); }
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.3, 6, 5), fur); tail.position.set(0, 5.5, -4); tail.rotation.x = 1.1; g.add(tail);
    return g;
  }
  function makeRaven(coat) {
    const g = new THREE.Group();
    const feather = new THREE.MeshLambertMaterial({ color: coatColor(coat, 0x14141c) });
    const body = new THREE.Mesh(new THREE.SphereGeometry(3, 8, 8), feather); body.scale.set(1, 1, 1.7); body.position.y = 7; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 8), feather); head.position.set(0, 9, 3.6); g.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.4, 5), new THREE.MeshLambertMaterial({ color: 0x3a2a12 })); beak.position.set(0, 9, 6); beak.rotation.x = Math.PI / 2; g.add(beak);
    for (const s of [-1, 1]) { const wing = new THREE.Mesh(new THREE.SphereGeometry(3.2, 7, 7), feather); wing.scale.set(0.25, 1, 1.6); wing.position.set(s * 2.6, 7, 0); g.add(wing); const e = glow(0xaad4ff, 0.45); e.position.set(s * 0.8, 9.2, 5); g.add(e); }
    return g;
  }
  function makeToad(coat) {
    const g = new THREE.Group();
    const skin = new THREE.MeshLambertMaterial({ color: coatColor(coat, 0x3c5a28) });
    const body = new THREE.Mesh(new THREE.SphereGeometry(3.6, 8, 8), skin); body.scale.set(1.4, 0.8, 1.2); body.position.y = 3; g.add(body);
    for (const s of [-1, 1]) { const bump = new THREE.Mesh(new THREE.SphereGeometry(1.4, 6, 6), skin); bump.position.set(s * 1.6, 5, 2); g.add(bump); const e = glow(0xffe06a, 0.7); e.position.set(s * 1.6, 5.6, 2.6); g.add(e); }
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 0.4), new THREE.MeshLambertMaterial({ color: 0x24381a })); mouth.position.set(0, 3, 4); g.add(mouth);
    return g;
  }
  function makeHare(coat) {
    const g = new THREE.Group();
    const fur = new THREE.MeshLambertMaterial({ color: coatColor(coat, 0x9a8468) });
    const pale = new THREE.MeshLambertMaterial({ color: 0xd8c8ad });
    const body = new THREE.Mesh(new THREE.SphereGeometry(3.2, 8, 8), fur); body.scale.set(1, 1.1, 1.3); body.position.y = 4.5; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(2.1, 8, 8), fur); head.position.set(0, 7.5, 2.4); g.add(head);
    for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.5, 6, 5), fur); ear.position.set(s * 1, 11, 2); ear.rotation.z = s * 0.2; g.add(ear); const e = glow(0xffd0d0, 0.45); e.position.set(s * 0.9, 7.7, 4); g.add(e); }
    const tail = new THREE.Mesh(new THREE.SphereGeometry(1.2, 6, 6), pale); tail.position.set(0, 4.5, -3.4); g.add(tail);
    return g;
  }
  const BUILDERS = { cat: makeCat, raven: makeRaven, toad: makeToad, hare: makeHare };

  function removeRec(id) {
    const r = pool[id];
    if (r && r.group && r.group.parent) r.group.parent.remove(r.group);
    delete pool[id];
  }

  // Trail each present player's familiar behind their rendered body. Called each
  // frame from the main loop with the frame delta.
  function updateFamiliars(dt) {
    const players = getPlayers() || {};
    const visuals = getVisuals() || {};
    const me = getMe();
    const f = 1 - Math.exp(-dt * 4); // lag factor — a trailing, not rigid, follow
    // Drop familiars whose owner left, dropped the familiar, or left the scene.
    for (const id in pool) {
      const p = players[id]; const v = visuals[id];
      if (!p || !p.familiar || !v || !v.group || !v.group.parent || (v.group.visible === false)) removeRec(id);
    }
    for (const id in players) {
      const p = players[id];
      if (!p.familiar || !BUILDERS[p.familiar]) continue;
      const v = visuals[id];
      if (!v || !v.group || !v.group.parent || v.group.visible === false) continue;
      const gp = v.group.position;
      const skin = p.familiarSkin || null; // the owner's bonded coat (cosmetic)
      let r = pool[id];
      // Rebuild when the familiar OR its coat changes.
      if (r && (r.type !== p.familiar || r.skin !== skin)) { removeRec(id); r = null; }
      if (!r) {
        const coat = (typeof getSkinHex === 'function') ? getSkinHex(skin) : null;
        const group = BUILDERS[p.familiar](coat);
        group.scale.setScalar(me && me.id === id ? 1.0 : 1.0);
        v.group.parent.add(group);
        r = pool[id] = { group, type: p.familiar, skin, x: gp.x, y: gp.y, z: gp.z, phase: Math.random() * 6 };
      } else if (r.group.parent !== v.group.parent) {
        // The owner changed scenes — re-parent into their current one.
        if (r.group.parent) r.group.parent.remove(r.group);
        v.group.parent.add(r.group);
      }
      // Trail to a point just behind-left of the owner (behind = -facing a touch;
      // simplest stable offset is a fixed world nudge, since the familiar lags).
      const tx = gp.x - 10, tz = gp.z - 6;
      r.x += (tx - r.x) * f;
      r.z += (tz - r.z) * f;
      r.y += (gp.y - r.y) * f;
      r.phase += dt * 6;
      const hop = p.familiar === 'hare' ? Math.abs(Math.sin(r.phase)) * 3 : p.familiar === 'raven' ? 6 + Math.sin(r.phase) * 1.5 : Math.abs(Math.sin(r.phase)) * 1.2;
      r.group.position.set(r.x, r.y + hop, r.z);
      // Face the way it's heading.
      const dx = gp.x - r.x, dz = gp.z - r.z;
      if (Math.hypot(dx, dz) > 0.5) r.group.rotation.y = Math.atan2(dx, dz);
    }
  }

  function destroyAll() { for (const id in pool) removeRec(id); }

  return { updateFamiliars, destroyAll };
}
