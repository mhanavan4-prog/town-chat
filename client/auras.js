// ---------------------------------------------------------------------------
// Auras (cosmetic) — a soft glowing disc + ring at a player's feet, tinted by
// their chosen aura color. Purely cosmetic and derived client-side: the aura
// id rides each player's publicPlayer broadcast, and every nearby client draws
// the matching glow under that player's rendered body (attached to the player's
// visual group so it follows automatically). Nothing here touches the sim.
//
// Same approach as client/familiars.js / client/guises.js: a small pool keyed
// by player id, rebuilt when the aura changes, cleaned up when it's cleared.
// ---------------------------------------------------------------------------
export default function createAuras({ getPlayers, getVisuals, getAuraHex }) {
  const pool = {}; // playerId -> { mesh, aura }

  function removeRec(id) {
    const r = pool[id];
    if (r && r.mesh) {
      if (r.mesh.parent) r.mesh.parent.remove(r.mesh);
      r.mesh.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    }
    delete pool[id];
  }

  // A faint filled disc under a brighter ring, both laid flat on the ground and
  // additively blended so they read as light, not paint.
  function makeAura(hex) {
    const g = new THREE.Group();
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(9, 28),
      new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.20, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.5; g.add(disc);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(8, 10, 28),
      new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.6; g.add(ring);
    return g;
  }

  // Called each frame from the main loop (after syncVisuals).
  function updateAuras(dt) {
    const players = getPlayers() || {};
    const visuals = getVisuals() || {};
    // Drop auras whose owner left, cleared it, or left the scene.
    for (const id in pool) {
      const p = players[id]; const v = visuals[id];
      if (!p || !p.aura || p.aura === 'none' || !v || !v.group || v.group.visible === false) removeRec(id);
    }
    for (const id in players) {
      const p = players[id];
      if (!p.aura || p.aura === 'none') continue;
      const v = visuals[id];
      if (!v || !v.group || v.group.visible === false) continue;
      let r = pool[id];
      if (r && r.aura !== p.aura) { removeRec(id); r = null; }
      if (!r) {
        const hex = (typeof getAuraHex === 'function') ? getAuraHex(p.aura) : null;
        if (hex == null) continue; // unknown / natural → nothing to draw
        const mesh = makeAura(hex);
        v.group.add(mesh);
        r = pool[id] = { mesh, aura: p.aura };
      } else if (r.mesh.parent !== v.group) {
        if (r.mesh.parent) r.mesh.parent.remove(r.mesh);
        v.group.add(r.mesh);
      }
      // A slow spin + gentle breathe so it reads as living light.
      r.mesh.rotation.y += dt * 0.6;
      const s = 1 + Math.sin(Date.now() * 0.003) * 0.06;
      r.mesh.scale.set(s, 1, s);
    }
  }

  function destroyAll() { for (const id in pool) removeRec(id); }

  return { updateAuras, destroyAll };
}
