// ---------------------------------------------------------------------------
// Collision & room predicates (Tier 3.4 Phase C, Milestone 2). Extracted from
// the client monolith as a DI factory (same shape as audio.js and the server
// lib/ modules). Reads four reassigned/late globals via injected getters; the
// wall-GEOMETRY builders (buildWalls/getDoorSide/getDoorWorldPos) stay in main
// for now since interior code shares them.
// ---------------------------------------------------------------------------
import { PERCH_STEP } from './perch.js';

export default function createCollision({ getWorld, getWalls, getDungeonLore, getDelveState, getVillageHouses = () => null }) {
function rectOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

const PLAYER_R = 14;
// feet: how high the body's feet are above the ground. A collider with a `top` no higher than that is not in the way
// (client/perch.js): it is something to stand on.
function collides(x, y, feet) {
  const hw = PLAYER_R, hh = PLAYER_R, f = feet || 0;
  for (const wall of getWalls()) {
    if (wall.top && f >= wall.top - PERCH_STEP) continue;
    if (rectOverlap(x - hw, y - hh, hw * 2, hh * 2, wall.x, wall.y, wall.w, wall.h)) return true;
  }
  return false;
}
// The top of whatever a body at (x, y) is standing over: the highest topped collider it overlaps, or 0.
function perchAt(x, y) {
  const hw = PLAYER_R;
  let top = 0;
  for (const wall of getWalls()) {
    if (wall.top && wall.top > top && rectOverlap(x - hw, y - hw, hw * 2, hw * 2, wall.x, wall.y, wall.w, wall.h)) top = wall.top;
  }
  return top;
}

function collidesIndoor(x, y, wallsLocal) {
  const hw = PLAYER_R, hh = PLAYER_R;
  for (const wall of wallsLocal) {
    if (rectOverlap(x - hw, y - hh, hw * 2, hh * 2, wall.x, wall.y, wall.w, wall.h)) return true;
  }
  return false;
}

// If (x, y) is overlapping any collider, eject it to the nearest clear edge and
// return the freed position; otherwise return null. Used as an auto-unstick so a
// body left inside an asset (e.g. standing where a new collider appeared, or
// clipped in on an older client before a collider shipped) is pushed out along
// the minimal-penetration axis rather than trapped. A few passes settle corners
// where two rects overlap. `wallsList` defaults to the active outdoor walls.
function resolveStuck(x, y, wallsList, feet) {
  const list = wallsList || getWalls();
  const hw = PLAYER_R, f = feet || 0;
  let moved = false;
  for (let iter = 0; iter < 4; iter++) {
    let any = false;
    for (const wall of list) {
      if (wall.top && f >= wall.top - PERCH_STEP) continue; // stood on, not stuck in
      const px0 = x - hw, px1 = x + hw, py0 = y - hw, py1 = y + hw;
      const wx0 = wall.x, wx1 = wall.x + wall.w, wy0 = wall.y, wy1 = wall.y + wall.h;
      if (px0 < wx1 && px1 > wx0 && py0 < wy1 && py1 > wy0) {
        const pushL = px1 - wx0, pushR = wx1 - px0;   // clear to the −x / +x side
        const pushU = py1 - wy0, pushD = wy1 - py0;   // clear to the −y / +y side
        const minX = Math.min(pushL, pushR), minY = Math.min(pushU, pushD);
        if (minX <= minY) x += (pushL < pushR ? -pushL : pushR);
        else y += (pushU < pushD ? -pushU : pushD);
        any = true; moved = true;
      }
    }
    if (!any) break;
  }
  return moved ? { x, y } : null;
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

// A room with no name of its own is never shown by its id ('vh_forge', 'witch_cave'): the id is made readable.
function plainRoomName(roomId) {
  const words = String(roomId || '').replace(/^vh_/, '').split('_').filter(Boolean);
  return words.length ? words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Room';
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
  if (b) return b.name;
  // a house in the Wilds' village (data/villageHouses.js) goes by its own name
  const _vh = getVillageHouses(); const h = _vh && Object.values(_vh).find((x) => x && x.room === roomId);
  if (h && h.name) return (h.icon ? h.icon + ' ' : '') + h.name;
  return plainRoomName(roomId);
}

  return { PLAYER_R, collides, collidesIndoor, resolveStuck, roomAt, pokeRoomTag, roomLabel, plainRoomName, perchAt };
}
