// Quest waypoint (playtest P2): the story objective's `goal` resolves to the
// right point from wherever the player stands, and the screen placement clamps
// off-screen / behind-camera targets to an edge arrow. Also checks the server
// ships a resolvable goal for every talk_npc / visit_room objective.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-wp-');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

(async () => {
  const { waypointTarget, screenPlacement } = await import('../client/waypoint.js');

  const ctx = {
    buildings: [{ id: 'library', name: '📚 The Library', x: 100, y: 100, w: 200, h: 100 }],
    getDoorWorldPos: (b) => ({ x: b.x + b.w / 2, y: b.y + b.h }),
    townNpcs: [{ id: 'npc_lyra', name: 'Scholar Lyra', x: 2230, y: 1180 }],
    portalInTown: { x: 1850, y: 600 },
    wildsReturn: { x: 5000, z: 9000 },
    caveMouth: { x: 2000, z: 2000 },
  };
  const lyra = { kind: 'npc', npcId: 'npc_lyra', room: 'outside' };
  const scholar = { kind: 'npc', npcId: 'npc_scholar', room: 'library' };
  const wilds = { kind: 'room', room: 'wilds' };
  const cave = { kind: 'room', room: 'witch_cave' };

  // ── Resolution ──────────────────────────────────────────────────────────
  let t = waypointTarget(lyra, 'outside', ctx);
  check('an outdoor NPC is pointed at directly', t && t.x === 2230 && t.z === 1180 && t.label === 'Scholar Lyra', t);
  t = waypointTarget(lyra, 'wilds', ctx);
  check('from the Wilds, a town NPC points to the portal home', t && t.x === 5000 && t.z === 9000, t);
  t = waypointTarget(scholar, 'outside', ctx);
  check('an NPC inside a building points to that building’s door', t && t.x === 200 && t.z === 200 && /Library/.test(t.label), t);
  check('once inside the target building there is no pin', waypointTarget(scholar, 'library', ctx) === null);
  t = waypointTarget(wilds, 'outside', ctx);
  check('a Wilds objective from town points to the Wilds portal', t && t.x === 1850 && t.z === 600, t);
  check('already in the Wilds, a Wilds objective needs no pin', waypointTarget(wilds, 'wilds', ctx) === null);
  t = waypointTarget(cave, 'outside', ctx);
  check('the cave from town routes via the Wilds portal', t && t.x === 1850, t);
  t = waypointTarget(cave, 'wilds', ctx);
  check('the cave from the Wilds points at the cave mouth', t && t.x === 2000 && t.z === 2000, t);
  check('from some other building, step outside first (no pin)', waypointTarget(lyra, 'cafe', ctx) === null);
  check('no goal → no pin', waypointTarget(null, 'outside', ctx) === null);

  // ── Screen placement ────────────────────────────────────────────────────
  const W = 1000, H = 600, M = 56;
  let p = screenPlacement({ x: 0, y: 0 }, false, W, H, M);
  check('a centred target is on screen at the centre', p.onScreen && p.x === 500 && p.y === 300, p);
  p = screenPlacement({ x: 3, y: 0 }, false, W, H, M);
  check('far to the right clamps to the right edge, arrow pointing right', !p.onScreen && Math.abs(p.x - (W - M)) < 1 && Math.abs(p.angle) < 1e-6, p);
  p = screenPlacement({ x: 0, y: 3 }, false, W, H, M);
  check('far above clamps to the top edge, arrow pointing up', !p.onScreen && Math.abs(p.y - M) < 1 && Math.abs(p.angle + Math.PI / 2) < 1e-6, p);
  // Behind the camera the perspective divide mirrors the projection, so a raw
  // ndc.x of +0.5 means the target is really behind-LEFT: the arrow must flip.
  p = screenPlacement({ x: 0.5, y: 0 }, true, W, H, M);
  check('a target behind the camera is never shown as on screen', !p.onScreen, p);
  check('…and its arrow is flipped to the true side (left here)', Math.cos(p.angle) < -0.9, p);
  p = screenPlacement({ x: 0, y: 0 }, true, W, H, M);
  check('dead behind points down (turn around)', !p.onScreen && Math.abs(p.angle - Math.PI / 2) < 1e-6, p);

  // ── Server goals resolve for every objective that has a place ───────────
  require('../server.js');
  await new Promise((r) => setTimeout(r, 400));
  const h = global.__testHooks;
  const ids = new Set(['outside', 'wilds', 'witch_cave', ...h.WORLD.buildings.map((b) => b.id)]);
  const bad = [];
  for (const line of Object.values(h.STORYLINES)) {
    for (const ch of line.chapters) {
      const o = ch.objective;
      if (o.type !== 'talk_npc' && o.type !== 'visit_room') continue;
      const s = makePayloadGoal(h, o);
      if (!s || !ids.has(s.room)) bad.push(o.type + ':' + (o.npcId || o.room) + '→' + JSON.stringify(s));
    }
  }
  check('every talk/visit objective gets a goal in a known room', bad.length === 0, bad);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

// The payload's goal, via the exported storyStatePayload on a stub player.
function makePayloadGoal(h, obj) {
  return h.objectiveGoal ? h.objectiveGoal(obj) : null;
}
