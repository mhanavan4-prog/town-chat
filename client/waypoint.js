// Quest waypoint — the on-screen "go here" pin for the current story objective.
//
// The server attaches a structured `goal` to each chapter objective
// ({ kind:'npc', npcId, room } or { kind:'room', room }). This resolves it to a
// point in whichever map the player is standing in — the NPC itself, the door
// of the building they're in, the Wilds portal, or the portal back to town —
// and draws a pin over it. The target is projected through the live camera, so
// when it's on screen the pin sits right over it, and when it's off screen (or
// behind you) a rotated arrow clamps to the screen edge pointing the way. No
// hand-rolled yaw math, so it can't come out mirrored.
//
// Pure lookup helpers are exported for tests; createWaypoint() owns the DOM.

// Where the goal is, from where the player is. `ctx` carries the map data the
// client already has. Returns { x, z, label } in the CURRENT map's coordinates,
// or null when there is nowhere single to point (already in the target room,
// or somewhere that has to be exited first).
export function waypointTarget(goal, here, ctx) {
  if (!goal) return null;
  here = here || 'outside';
  const room = goal.room;
  const townPortal = () => (ctx.portalInTown ? { x: ctx.portalInTown.x, z: ctx.portalInTown.y, label: '🌀 Wilds portal' } : null);
  const backToTown = () => (ctx.wildsReturn ? { x: ctx.wildsReturn.x, z: ctx.wildsReturn.z, label: '🌀 Back to town' } : null);
  const door = (id) => {
    const b = (ctx.buildings || []).find((x) => x.id === id);
    if (!b || !ctx.getDoorWorldPos) return null;
    const d = ctx.getDoorWorldPos(b);
    return { x: d.x, z: d.y, label: b.name };
  };

  if (here === room) {
    // Same map: point at the NPC if they stand in the open square. Inside a
    // building (rooms are small) or out in the Wilds (the objective is the
    // whole map) there's nothing single to point at.
    if (room === 'outside' && goal.kind === 'npc') {
      const n = (ctx.townNpcs || []).find((x) => x.id === goal.npcId);
      return n ? { x: n.x, z: n.y, label: n.name } : null;
    }
    return null;
  }
  if (room === 'witch_cave') {
    if (here === 'wilds') return ctx.caveMouth ? { x: ctx.caveMouth.x, z: ctx.caveMouth.z, label: '🕳️ The witch’s cave' } : null;
    if (here === 'outside') return townPortal();
    return null;
  }
  if (room === 'wilds') return here === 'outside' ? townPortal() : null;
  if (here === 'wilds') return backToTown();       // the goal is somewhere in town
  if (here === 'outside') return door(room);       // a building, or an NPC inside one
  return null;                                     // in another room — step outside first
}

// Map a world point to a screen position. `ndc` is the camera-projected point
// (x,y in -1..1), `behind` whether it's behind the camera. Returns where to
// draw the pin and, if it had to be clamped to the edge, the arrow angle
// (radians, 0 = pointing right, screen y down).
export function screenPlacement(ndc, behind, W, H, margin) {
  let sx = (ndc.x * 0.5 + 0.5) * W;
  let sy = (-ndc.y * 0.5 + 0.5) * H;
  if (behind) { sx = W - sx; sy = H - sy; } // a point behind you projects mirrored — flip it back
  const onScreen = !behind && sx >= margin && sx <= W - margin && sy >= margin && sy <= H - margin;
  if (onScreen) return { x: sx, y: sy, onScreen: true, angle: Math.PI / 2 };
  const cx = W / 2, cy = H / 2;
  let dx = sx - cx, dy = sy - cy;
  if (Math.abs(dx) < 1e-3 && Math.abs(dy) < 1e-3) dy = 1; // dead behind: point down (turn around)
  const angle = Math.atan2(dy, dx);
  const rx = (W / 2 - margin) / Math.max(1e-6, Math.abs(Math.cos(angle)));
  const ry = (H / 2 - margin) / Math.max(1e-6, Math.abs(Math.sin(angle)));
  const r = Math.min(rx, ry);
  return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r, onScreen: false, angle };
}

export default function createWaypoint({ getMe, getStoryState, getCamera, getCtx }) {
  const el = document.getElementById('waypointPin');
  const arrow = el && el.querySelector('.wpArrow');
  const label = el && el.querySelector('.wpLabel');
  const v = new THREE.Vector3();
  const vc = new THREE.Vector3();
  let lastLabel = '';
  let lastTarget = null; // last resolved target (any distance) — the map draws it too
  const ARRIVE = 110; // world units — close enough that the pin gets out of the way
  const UNITS_PER_M = 48; // a KayKit body is ~86 units ≈ 1.8 m

  function hide() { if (el && !el.classList.contains('hidden')) el.classList.add('hidden'); }

  function update() {
    if (!el) return;
    const me = getMe(); const st = getStoryState(); const cam = getCamera();
    const ch = st && st.chapter;
    if (!me || !cam || !st || !st.active || !ch || ch.levelOk === false || !ch.goal) { lastTarget = null; return hide(); }
    const t = waypointTarget(ch.goal, me.room, getCtx());
    lastTarget = t;
    if (!t) return hide();
    const dist = Math.hypot(t.x - me.x, t.z - me.y);
    if (dist < ARRIVE) return hide();
    v.set(t.x, 70, t.z).project(cam);
    vc.set(t.x, 70, t.z).applyMatrix4(cam.matrixWorldInverse);
    const p = screenPlacement(v, vc.z > 0, window.innerWidth, window.innerHeight, 56);
    el.classList.remove('hidden');
    el.classList.toggle('edge', !p.onScreen);
    el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -50%)`;
    // The glyph points right at rest; on screen it points down at the target.
    arrow.style.transform = `rotate(${p.angle.toFixed(3)}rad)`;
    const text = `${t.label} · ${Math.max(1, Math.round(dist / UNITS_PER_M))}m`;
    if (text !== lastLabel) { label.textContent = text; lastLabel = text; }
  }

  return { update, current: () => lastTarget };
}
