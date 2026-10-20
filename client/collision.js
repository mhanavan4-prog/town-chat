// ---------------------------------------------------------------------------
// Collision & room predicates (Tier 3.4 Phase C, Milestone 2). Extracted from
// the client monolith as a DI factory (same shape as audio.js and the server
// lib/ modules). Reads four reassigned/late globals via injected getters; the
// wall-GEOMETRY builders (buildWalls/getDoorSide/getDoorWorldPos) stay in main
// for now since interior code shares them.
// ---------------------------------------------------------------------------
export default function createCollision({ getWorld, getWalls, getDungeonLore, getDelveState }) {
function rectOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

const PLAYER_R = 14;
function collides(x, y) {
  const hw = PLAYER_R, hh = PLAYER_R;
  for (const wall of getWalls()) {
    if (rectOverlap(x - hw, y - hh, hw * 2, hh * 2, wall.x, wall.y, wall.w, wall.h)) return true;
  }
  return false;
}

function collidesIndoor(x, y, wallsLocal) {
  const hw = PLAYER_R, hh = PLAYER_R;
  for (const wall of wallsLocal) {
    if (rectOverlap(x - hw, y - hh, hw * 2, hh * 2, wall.x, wall.y, wall.w, wall.h)) return true;
  }
  return false;
}

function roomAt(x, y) {
  for (const b of getWorld().buildings) {
    // Use the fitted collider footprint (b._fit, set by refitBuildingColliders)
    // when present, NOT the raw data rect. The collider was shrunk to the placed
    // model, so the data rect has unwalled strips of open grass beside/behind the
    // building; keying room-entry off the data rect teleported players inside the
    // moment they stepped onto that grass. Keying off the real footprint means the
    // door is the only way in again — matching what the walls actually block.
    const f = b._fit || b;
    if (x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + f.h) return b.id;
  }
  return 'outside';
}

// The location pill ("Town Square" etc.) used to sit on screen forever —
// now it shows for a few seconds after every room change, then fades
// (user request, Session I). Any poke brings it back.
let roomTagFadeTimer = null;
function pokeRoomTag() {
  const tag = document.getElementById('roomTag');
  if (!tag) return;
  tag.classList.remove('tagFaded');
  clearTimeout(roomTagFadeTimer);
  roomTagFadeTimer = setTimeout(() => tag.classList.add('tagFaded'), 5000);
}

function roomLabel(roomId) {
  if (roomId === 'outside') return '📍 Town Square';
  if (roomId === 'wilds') return '🌲 The Wilds';
  if (roomId === 'ember_wastes') return '🔥 The Ember Wastes';
  if (roomId === 'ember_refuge') return '⛺ The Ember Refuge';
  if (roomId === 'manor') return '🏚️ The Coven Manor';
  // The named dungeons (Session L) — lore ships in init; the tier ranges
  // stay in the label so the gate is still legible at a glance.
  const dm = /^dungeon_t([1-4])$/.exec(roomId || '');
  if (dm) {
    const tier = Number(dm[1]);
    const _dl = getDungeonLore(); const lore = _dl && _dl[tier];
    const range = ['1–5', '6–10', '11–15', '16–20'][tier - 1];
    return lore ? `🕳️ ${lore.name} (Lv ${range})` : `⚔️ Dungeon — Tier ${tier} (Lv ${range})`;
  }
  if (typeof roomId === 'string' && roomId.startsWith('dungeon_delve_')) {
    const _ds = getDelveState(); return _ds && _ds.inRun ? `🕳️ The Delve — Floor ${_ds.floor}` : '🕳️ The Delve';
  }
  const _w = getWorld(); const b = _w && _w.buildings.find(x => x.id === roomId);
  return b ? b.name : roomId;
}

  return { PLAYER_R, collides, collidesIndoor, roomAt, pokeRoomTag, roomLabel };
}
