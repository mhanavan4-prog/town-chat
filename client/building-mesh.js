// ---------------------------------------------------------------------------
// Building exterior mesh (Tier 3.4 Phase C). buildBuildingMesh renders each town/
// wilds building's outside: a KayKit model auto-aligned + stair-measured to the
// door when one fits (kkAutoAlign/kkMeasureStairs), otherwise a hand-built box
// with wood-siding walls, a shingle roof, a hanging sign, and a lock overlay.
// The KayKit box/stair tables + wall/door/window helpers + textures are injected;
// the camera-blocker list (built later) and the locked-rooms set via getters.
// ---------------------------------------------------------------------------
export default function createBuildingMesh({ KK, KK_BLD_BOXES, KK_STAIR_ZONES, WALL_HEIGHT, buildWallsForOne, getDoorSide, getDoorWorldPos, isVisuallyLocked, makeRectWindow, makeShingleTexture, makeSignSprite, makeWoodSidingTexture, lockVisuals, getKkCamBlockers, getLockedRooms }) {
function kkAutoAlign(kkBld, b, w) {
  const kside = getDoorSide(b);
  const dp = getDoorWorldPos(b);
  const out = kside === 'south' ? [0, 1] : kside === 'north' ? [0, -1] : kside === 'east' ? [1, 0] : [-1, 0];
  const along = [out[1], out[0]];
  const sideRot = kside === 'south' ? 0 : kside === 'north' ? Math.PI : kside === 'east' ? Math.PI / 2 : -Math.PI / 2;
  const cx = b.x + b.w / 2, cz = b.y + b.h / 2;
  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const origin = new THREE.Vector3();
  const MAX_STAIR_H = 40;

  function stairMassAt(lateralOffset) {
    // structure height just outside the wall (4 depths — 44 reaches the
    // detached porches some models carry, e.g. the gold church), below cap
    let mass = 0;
    for (const d of [8, 20, 32, 44]) {
      origin.set(dp.x + out[0] * d + along[0] * lateralOffset, 60, dp.y + out[1] * d + along[1] * lateralOffset);
      ray.set(origin, down);
      const hits = ray.intersectObject(kkBld, true);
      for (const hit of hits) {
        if (hit.point.y <= MAX_STAIR_H) { mass += hit.point.y; break; }
      }
    }
    return mass;
  }

  // Flush the model's door face to the footprint's door wall for the
  // CURRENT rotation — needed both per-rotation (scoring a centered,
  // recessed model finds nothing outside the wall: that's why the tavern's
  // stoop never got centered on its door before) and as the final fit.
  function flushToWall() {
    const bb = new THREE.Box3().setFromObject(kkBld);
    const wallPlane = kside === 'south' ? b.y + b.h : kside === 'north' ? b.y : kside === 'east' ? b.x + b.w : b.x;
    const modelFront = kside === 'south' ? bb.max.z : kside === 'north' ? bb.min.z : kside === 'east' ? bb.max.x : bb.min.x;
    const delta = (wallPlane + (kside === 'south' || kside === 'east' ? 12 : -12)) - modelFront;
    kkBld.position.x += out[0] * delta;
    kkBld.position.z += out[1] * delta;
    kkBld.updateMatrixWorld(true);
  }

  let bestRot = 0, bestScore = -1;
  for (const extra of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    kkBld.rotation.y = sideRot + extra;
    kkBld.position.set(cx, 0, cz);
    kkBld.updateMatrixWorld(true);
    flushToWall(); // score what a player would actually meet outside the wall
    let score = 0;
    for (const lat of [-w.doorWidth, -w.doorWidth / 2, 0, w.doorWidth / 2, w.doorWidth]) score += stairMassAt(lat);
    if (score > bestScore + 0.5) { bestScore = score; bestRot = extra; }
  }
  kkBld.rotation.y = sideRot + bestRot;
  kkBld.position.set(cx, 0, cz);
  kkBld.updateMatrixWorld(true);

  // Fit-to-footprint: with the best rotation known, measure the model's
  // real extents along the door axis (depth) and across it (width), and
  // shrink until the depth genuinely fits the collision footprint (small
  // rear lip allowed) and the width bulge stays modest. The castle was
  // deeper than the Town Hall's footprint at any centered scale — players
  // could walk the camera inside its rear towers.
  {
    let bb = new THREE.Box3().setFromObject(kkBld);
    const alongDoor = (kside === 'south' || kside === 'north');
    const depthExtent = alongDoor ? (bb.max.z - bb.min.z) : (bb.max.x - bb.min.x);
    const widthExtent = alongDoor ? (bb.max.x - bb.min.x) : (bb.max.z - bb.min.z);
    const footDepth = alongDoor ? b.h : b.w;
    const footWidth = alongDoor ? b.w : b.h;
    const shrink = Math.min(1, (footDepth + 52) / Math.max(1, depthExtent), (footWidth * 1.18) / Math.max(1, widthExtent));
    if (shrink < 1) {
      kkBld.scale.multiplyScalar(shrink);
      kkBld.userData.kkHeight *= shrink;
      kkBld.updateMatrixWorld(true);
    }
    // Flush-to-door-wall: door face sits just past the footprint's door
    // wall; the (now small) rear lip tucks behind the building line.
    flushToWall();
  }

  // Center the detected steps on the door gap (skip flush-door models).
  // The gate score is measured fresh HERE, after the final flush — the old
  // code gated on the rotation-pass score, which was taken while the model
  // was still centered/recessed and often read ~0, silently skipping this
  // pass and leaving stoops ~50 units off the door (the tavern & arcade —
  // players got ramped into thin air at the actual door line).
  // Two passes: the first shift can expose more steps to the sampler.
  for (let pass = 0; pass < 2; pass++) {
    let postScore = 0;
    for (const lat of [-w.doorWidth, -w.doorWidth / 2, 0, w.doorWidth / 2, w.doorWidth]) postScore += stairMassAt(lat);
    const span = Math.max(b.w, b.h) * 0.42;
    let num = 0, den = 0;
    for (let lat = -span; lat <= span; lat += 12) {
      const m = stairMassAt(lat);
      num += m * lat; den += m;
    }
    if (postScore <= 4 && den <= 0) break;
    if (den > 0) {
      const centroid = num / den;
      if (Math.abs(centroid) < 2) break; // already centered
      const shift = Math.max(-span * 0.7, Math.min(span * 0.7, -centroid));
      kkBld.position.x += along[0] * shift;
      kkBld.position.z += along[1] * shift;
      kkBld.updateMatrixWorld(true);
    } else break;
  }
}

function kkMeasureStairs(kkBld, b, w) {
  const side = getDoorSide(b);
  const dp = getDoorWorldPos(b);
  const out = side === 'south' ? [0, 1] : side === 'north' ? [0, -1] : side === 'east' ? [1, 0] : [-1, 0];
  const along = [out[1], out[0]];
  kkBld.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const origin = new THREE.Vector3();
  const STEP = 6, MAX_DEPTH = 120, MAX_STAIR_H = 40, PRESENT = 1.5;

  function heightAt(d, lat) {
    origin.set(dp.x + out[0] * d + along[0] * lat, 60, dp.y + out[1] * d + along[1] * lat);
    ray.set(origin, down);
    const hits = ray.intersectObject(kkBld, true);
    for (const hit of hits) { if (hit.point.y <= MAX_STAIR_H) return hit.point.y; }
    return 0;
  }

  // 1) Raw profile: widest/highest structure at each outward depth, sampled
  //    across the whole door corridor. The scan runs the FULL depth — the
  //    old version stopped at the first flat sample, which is exactly how
  //    the bank church's detached porch (a 26-unit slab ~30 units out, with
  //    flat ground between it and the wall) went unmeasured and walk-through.
  const lats = [-1, -0.66, -0.33, 0, 0.33, 0.66, 1].map(f => f * w.doorWidth);
  const raw = [];
  let lastSolid = -1;
  let latNum = 0, latDen = 0;
  for (let d = 0, i = 0; d <= MAX_DEPTH; d += STEP, i++) {
    let h = 0;
    for (const lat of lats) {
      const hh = heightAt(d, lat);
      h = Math.max(h, hh);
      if (hh >= PRESENT) { latNum += lat; latDen++; }
    }
    raw.push(h);
    if (h >= PRESENT) lastSolid = i;
  }
  if (lastSolid < 0 || Math.max.apply(null, raw) < 2) return; // flush door — no zone needed
  const solidDepth = Math.min(MAX_DEPTH, (lastSolid + 1) * STEP);

  // Where the stoop actually sits laterally (≈0 once kkAutoAlign has
  // centered it; kept as a safety net so the ramp always hugs the geometry
  // rather than lifting players on air beside it).
  const latCenter = latDen > 0 ? Math.max(-w.doorWidth, Math.min(w.doorWidth, latNum / latDen)) : 0;

  // 2) Lateral reach of the stoop — flood outward from its center and stop
  //    at the first gap, so a CONNECTED stoop sets the band width while
  //    detached side dressing (the bank's flanking pillars) can't inflate
  //    it and leave players ramped up on thin air beside the real steps.
  const latStep = Math.max(6, w.doorWidth * 0.15);
  let reach = 0;
  for (const sign of [1, -1]) {
    for (let lat = latStep; lat <= w.doorWidth * 1.5; lat += latStep) {
      let solid = false;
      for (let d = 0; d <= solidDepth && !solid; d += STEP) {
        if (heightAt(d, latCenter + sign * lat) >= PRESENT) solid = true;
      }
      if (!solid) break;
      reach = Math.max(reach, lat);
    }
  }
  const stoopHalf = Math.max(w.doorWidth * 0.4, reach + 10);

  // 3) Walkable profile: monotone envelope of the geometry (never sink INTO
  //    a step; plateaus like porches survive), then a run-out long enough
  //    that the climb is a stroll, not a pop — slope capped ~1:3. The raw
  //    step-function this used to ship as is what read as "clunky": your Y
  //    snapped up half a body height across a couple of frames at the door.
  const mono = raw.slice(0, lastSolid + 2 <= raw.length ? lastSolid + 2 : raw.length);
  for (let i = mono.length - 2; i >= 0; i--) mono[i] = Math.max(mono[i], mono[i + 1]);
  const sill = mono[0];
  const MAX_SLOPE = 0.34;
  // The descent starts where the envelope leaves its door-level plateau
  // (porches hold the sill height for a stretch — the bank's holds ~36u),
  // so the gentle-slope budget is measured from THERE, not from the wall.
  let plateauEnd = 0;
  while (plateauEnd + 1 < mono.length && mono[plateauEnd + 1] > sill - 2) plateauEnd++;
  const rampLen = Math.min(168, Math.max(solidDepth, plateauEnd * STEP + Math.ceil((sill / MAX_SLOPE) / STEP) * STEP));
  const n = Math.floor(rampLen / STEP) + 1;
  const plateauD = plateauEnd * STEP;
  const profile = [];
  for (let i = 0; i < n; i++) {
    const d = i * STEP;
    const geom = i < mono.length ? mono[i] : 0;
    const ramp = d <= plateauD ? sill : sill * Math.max(0, 1 - (d - plateauD) / Math.max(STEP, rampLen - plateauD));
    profile.push(Math.max(geom, ramp));
  }
  profile[n - 1] = 0;
  // two gentle smoothing passes round the knees; the door end stays pinned
  // at the sill so there's no dip right where you cross the threshold
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < n - 1; i++) {
      profile[i] = Math.max((i < mono.length ? mono[i] : 0), profile[i - 1] * 0.25 + profile[i] * 0.5 + profile[i + 1] * 0.25);
    }
    profile[0] = sill;
  }

  KK_STAIR_ZONES.push({
    side, cx: dp.x + along[0] * latCenter, cz: dp.y + along[1] * latCenter, out, step: STEP,
    depth: rampLen, halfWidth: stoopHalf,
    // taller stoops fade out over a wider side band, so crossing the band's
    // edge stays a glide at any height (the Y-chase smooths the remainder)
    fade: Math.max(16, sill * 0.9), profile
  });
}

function buildBuildingMesh(b, w) {
  const group = new THREE.Group();
  // The Rooftop Lounge gets a taller exterior shell to read as two stories,
  // matching its two-story interior (see buildLoungeStructure()/getFloorHeight()).
  const wallH = b.id === 'lounge' ? WALL_HEIGHT * 1.8 : WALL_HEIGHT;
  const wallRects = buildWallsForOne(b, w);
  // Tier-3: a KayKit medieval building stands in for the box shell when its
  // model loaded. Collision stays on the same footprint rects either way.
  // Geometric-mean fit: pure max-dimension fit made models on elongated
  // footprints bulge far past their collision rect (you could walk the
  // camera inside the castle). The mean keeps big footprints imposing
  // without the walkable-overlap.
  const kkBld = KK.staticInstance('bld_' + b.id, Math.sqrt(b.w * b.h) * 1.16, 'fit');
  const useKK = !!kkBld;
  if (useKK) {
    kkAutoAlign(kkBld, b, w);
    group.add(kkBld);
    kkMeasureStairs(kkBld, b, w);
    // remember the placed model's ground box so dressing can stay clear of it
    kkBld.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(kkBld);
    KK_BLD_BOXES[b.id] = bb;
    // camera blocker: the COLLISION footprint (player can never be inside
    // it, unlike the model box whose stoop/bulge the player can stand in)
    // up to just under the model's roofline
    getKkCamBlockers().push({ minX: b.x, minZ: b.y, maxX: b.x + b.w, maxZ: b.y + b.h, maxY: Math.max(60, bb.max.y * 0.96) });
  }
  // One siding texture per building, cloned per wall segment so each gets
  // its own repeat tuned to its own size — same pattern buildPathSegment()
  // uses for road tiles. White-based texture multiplies with b.color, so
  // every building keeps its own tint instead of one shared flat material.
  const sidingBase = useKK ? null : makeWoodSidingTexture();
  for (const r of (useKK ? [] : wallRects)) {
    if (r.w <= 0 || r.h <= 0) continue;
    const tex = sidingBase.clone();
    tex.needsUpdate = true;
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(Math.max(1, r.w / 40), Math.max(1, wallH / 40));
    const geo = new THREE.BoxGeometry(r.w, wallH, r.h);
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, color: b.color }));
    mesh.position.set(r.x + r.w / 2, wallH / 2, r.y + r.h / 2);
    group.add(mesh);
  }

  if (!useKK) {
  // foundation plinth — a low, dark base so the building looks grounded
  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(b.w + 14, 6, b.h + 14),
    new THREE.MeshLambertMaterial({ color: 0x4a4a4a })
  );
  foundation.position.set(b.x + b.w / 2, 3, b.y + b.h / 2);
  group.add(foundation);
  }

  // A second-story floor band — a darker trim strip wrapping the perimeter
  // partway up — plus an extra row of windows above it, so the Lounge reads
  // as two distinct stories rather than just one tall building.
  if (!useKK && b.id === 'lounge') {
    const bandY = wallH * 0.52;
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(b.w + 6, 8, b.h + 6),
      new THREE.MeshLambertMaterial({ color: 0x3c2616 })
    );
    band.position.set(b.x + b.w / 2, bandY, b.y + b.h / 2);
    group.add(band);

    const upperWinMat = new THREE.MeshBasicMaterial({ color: 0xfff1b0 });
    const upperWinY = wallH * 0.78;
    const side2 = getDoorSide(b);
    if (side2 !== 'north') group.add(makeRectWindow(upperWinMat, 26, 22, b.x + b.w / 2, upperWinY, b.y - 0.6, false));
    if (side2 !== 'south') group.add(makeRectWindow(upperWinMat, 26, 22, b.x + b.w / 2, upperWinY, b.y + b.h + 0.6, false));
    if (side2 !== 'west') group.add(makeRectWindow(upperWinMat, 26, 22, b.x - 0.6, upperWinY, b.y + b.h / 2, true));
    if (side2 !== 'east') group.add(makeRectWindow(upperWinMat, 26, 22, b.x + b.w + 0.6, upperWinY, b.y + b.h / 2, true));
  }

  // hip/pyramid roof — a 4-sided cone whose flat faces need to line up with
  // the building's walls, then get scaled non-uniformly to match the
  // rectangular footprint (with a little overhang past the eaves).
  //
  // The 45° alignment rotation used to live on the MESH (roof.rotation.y),
  // applied *after* the non-uniform scale in Three.js's fixed scale→
  // rotate→translate transform order. Scaling a shape unevenly and then
  // rotating it distorts it — the roof only came out aligned for a
  // perfectly square building (b.w === b.h), which none of these are, so
  // every roof sat skewed relative to its own walls. Baking the rotation
  // into the geometry itself instead means the non-uniform scale (applied
  // via mesh.scale, still local-space) now runs on already-diagonal
  // vertices, landing on an actual axis-aligned rectangle every time.
  const overhang = 14, roofHeight = 58;
  if (!useKK) {
  const apothem = Math.cos(Math.PI / 4);
  const roofGeo = new THREE.ConeGeometry(1, roofHeight, 4);
  roofGeo.rotateY(Math.PI / 4);
  const roofTex = makeShingleTexture();
  roofTex.repeat.set(Math.max(1, b.w / 60), Math.max(1, b.h / 60));
  const roof = new THREE.Mesh(
    roofGeo,
    new THREE.MeshLambertMaterial({ map: roofTex, color: 0x7a3c2c })
  );
  roof.scale.set((b.w / 2 + overhang) / apothem, 1, (b.h / 2 + overhang) / apothem);
  roof.position.set(b.x + b.w / 2, wallH + roofHeight / 2, b.y + b.h / 2);
  group.add(roof);
  }

  // a visible door slab filling the gap in whichever wall faces the door —
  // locked buildings get a barred reddish door; the free building and
  // unlocked ones get a normal wooden door (kept in sync via
  // refreshBuildingLockVisuals()). Full wall height (not a fixed 72, which
  // left a gap above the door you could see clean through into the
  // building) so the door slab actually covers the whole door-shaped hole
  // in the wall, floor to eaves.
  const t = w.wallThickness, doorH = wallH;
  const locked = isVisuallyLocked(b);
  const side = getDoorSide(b);
  const doorMat = new THREE.MeshLambertMaterial({ color: locked ? 0x5a1f1f : 0x3c2616 });
  let doorGeo, doorX, doorZ;
  if (side === 'east') {
    doorGeo = new THREE.BoxGeometry(t * 0.7, doorH, w.doorWidth - 6);
    doorX = b.x + b.w - t / 2; doorZ = b.y + b.h / 2;
  } else if (side === 'west') {
    doorGeo = new THREE.BoxGeometry(t * 0.7, doorH, w.doorWidth - 6);
    doorX = b.x + t / 2; doorZ = b.y + b.h / 2;
  } else if (side === 'north') {
    doorGeo = new THREE.BoxGeometry(w.doorWidth - 6, doorH, t * 0.7);
    doorX = b.x + b.w / 2; doorZ = b.y + t / 2;
  } else {
    doorGeo = new THREE.BoxGeometry(w.doorWidth - 6, doorH, t * 0.7);
    doorX = b.x + b.w / 2; doorZ = b.y + b.h - t / 2;
  }
  const door = new THREE.Mesh(doorGeo, doorMat);
  door.position.set(doorX, doorH / 2, doorZ);
  group.add(door);
  if (useKK) door.visible = false; // the model brings its own door; lock state shows via the signs

  // glowing windows on the three walls that don't have the door
  const winMat = new THREE.MeshBasicMaterial({ color: 0xfff1b0 });
  if (!useKK) {
  const winY = wallH * (b.id === 'lounge' ? 0.32 : 0.56);
  if (side !== 'north') {
    const win = new THREE.Mesh(new THREE.BoxGeometry(26, 22, 2), winMat);
    win.position.set(b.x + b.w / 2, winY, b.y - 0.6);
    group.add(win);
  }
  if (side !== 'south') {
    const win = new THREE.Mesh(new THREE.BoxGeometry(26, 22, 2), winMat);
    win.position.set(b.x + b.w / 2, winY, b.y + b.h + 0.6);
    group.add(win);
  }
  if (side !== 'west') {
    const win = new THREE.Mesh(new THREE.BoxGeometry(2, 22, 26), winMat);
    win.position.set(b.x - 0.6, winY, b.y + b.h / 2);
    group.add(win);
  }
  if (side !== 'east') {
    const win = new THREE.Mesh(new THREE.BoxGeometry(2, 22, 26), winMat);
    win.position.set(b.x + b.w + 0.6, winY, b.y + b.h / 2);
    group.add(win);
  }
  } // end !useKK windows

  // floating sign with the building name, billboarded each frame
  const signY = useKK ? kkBld.userData.kkHeight + 26 : wallH + roofHeight + 22;
  const sign = makeSignSprite(b.name);
  sign.position.set(b.x + b.w / 2, signY, b.y + b.h / 2);
  group.add(sign);

  // a second sign disclosing free-vs-pass status. Both variants are built
  // up front and toggled by refreshBuildingLockVisuals(), so buying a
  // Town Pass mid-session flips every sign live — no rebuild needed.
  const lockedTag = makeSignSprite('🔒 Town Pass building');
  const freeTag = makeSignSprite('✓ Free to enter');
  for (const tag of [lockedTag, freeTag]) {
    tag.position.set(b.x + b.w / 2, signY - 26, b.y + b.h / 2);
    group.add(tag);
  }
  lockedTag.visible = locked;
  freeTag.visible = !locked;

  lockVisuals[b.id] = { door, lockSign: lockedTag, freeSign: freeTag, isPassBuilding: getLockedRooms().has(b.id) };

  return group;
}

  return { buildBuildingMesh };
}
