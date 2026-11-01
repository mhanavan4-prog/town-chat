// The Green Path — the account-wide gardening questline (data/greenPath.js +
// server's greenPathEvent / greenPathStateBody). Chapters auto-advance off the
// garden plant/harvest handlers; rewards (XP, gold, seeds) land in the account.
// Mirrors test/wardrobe.test.js: pure data checks, then a live loop via the
// mock-socket harness.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-greenpath-');

const { GREEN_PATH, GREEN_PATH_CATEGORIES } = require('../data/greenPath.js');

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
  };
}
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

// ── Pure data: the catalogue + chapters ──────────────────────────────────────
check('three witchcraft categories, power-ordered', (() => {
  return GREEN_PATH_CATEGORIES.length === 3 &&
    GREEN_PATH_CATEGORIES.map((c) => c.id).join(',') === 'cottage,hedge,baneful' &&
    GREEN_PATH_CATEGORIES.map((c) => c.band).join(',') === 'common,rare,mythic';
})());
check('the Poison Path is the baneful category', (() => {
  const b = GREEN_PATH_CATEGORIES.find((c) => c.id === 'baneful');
  const ids = b.plants.map((p) => p.id);
  return b.name === 'The Poison Path' && ids.includes('belladonna') && ids.includes('mandrake') && ids.includes('wolfsbane');
})());
check('every category plant has a real name and lore', GREEN_PATH_CATEGORIES.every((c) => c.plants.length && c.plants.every((p) => p.id && p.name && p.lore)));
check('cottage herbs cover the MVP grants', (() => {
  const ids = GREEN_PATH_CATEGORIES[0].plants.map((p) => p.id);
  return ids.includes('chamomile') && ids.includes('calendula');
})());
check('chapters grant real cottage herbs, not invented ones', (() => {
  const grants = GREEN_PATH.flatMap((c) => (c.itemRewards || []).map((r) => r.itemId));
  return grants.includes('chamomile') && grants.includes('calendula') &&
    !grants.includes('dawnpetal') && !grants.includes('mistroot');
})());
check('chapter objectives are plant, harvest, brew — level-gated 1/3/5', (() => {
  return GREEN_PATH[0].objective.type === 'garden_plant' && GREEN_PATH[0].requiresLevel === 1 &&
    GREEN_PATH[1].objective.type === 'garden_harvest' && GREEN_PATH[1].requiresLevel === 3 &&
    GREEN_PATH[2].objective.type === 'garden_brew' && GREEN_PATH[2].requiresLevel === 5;
})());
check('Chapter 3 completes the Cottage Garden (grants comfrey, lemon balm, feverfew, lavender)', (() => {
  const grants = (GREEN_PATH[2].itemRewards || []).map((r) => r.itemId);
  return ['comfrey', 'lemon_balm', 'feverfew', 'lavender'].every((id) => grants.includes(id));
})());
check('the Hedge band is chapters 4–6 (seed_found, harvest, brew — gated 8/11/14)', (() => {
  return GREEN_PATH[3].objective.type === 'seed_found' && GREEN_PATH[3].requiresLevel === 8 &&
    GREEN_PATH[4].objective.type === 'garden_harvest' && GREEN_PATH[4].requiresLevel === 11 &&
    GREEN_PATH[5].objective.type === 'garden_brew' && GREEN_PATH[5].requiresLevel === 14 &&
    GREEN_PATH.slice(3, 6).every((c) => c.band === 'hedge');
})());
check('the Hedge chapters grant the five remaining Hedge herbs', (() => {
  const grants = GREEN_PATH.slice(3, 6).flatMap((c) => (c.itemRewards || []).map((r) => r.itemId));
  return ['vervain', 'wormwood', 'rue', 'st_johns_wort', 'rowan_berry'].every((id) => grants.includes(id));
})());
check('the nine-chapter path ends with the baneful Poison Path (7–9)', (() => {
  return GREEN_PATH.length === 9 && GREEN_PATH.slice(6).every((c) => c.band === 'baneful') &&
    GREEN_PATH[6].requiresLevel === 17 && GREEN_PATH[8].requiresLevel === 20;
})());
check('the Poison Path grants all eight baneful herbs', (() => {
  const grants = GREEN_PATH.slice(6).flatMap((c) => (c.itemRewards || []).map((r) => r.itemId));
  return ['belladonna', 'henbane', 'mandrake', 'wolfsbane', 'datura', 'hemlock', 'foxglove', 'black_hellebore'].every((id) => grants.includes(id));
})());

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];

  function join(tag, charId) {
    const s = makeMockSocket(tag); connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: charId || 0 }));
    return { s, p: h.players.get(s.lastOfType('init').id) };
  }

  // ── A witch walks the Green Path ─────────────────────────────────────────────
  const g = join('Gardener', 0);
  g.p.accountKey = 'gardener';
  h.getProgress(g.p).level = 1;

  // State before anything: Chapter 1, zero progress.
  const s0 = h.greenPathStateBody(g.p);
  check('starts at Chapter 1 (index 0), not done', s0 && s0.done === false && s0.chapter === 0 && s0.title === 'A Handful of Earth', s0);
  check('total chapters reported matches the data', s0 && s0.total === GREEN_PATH.length, s0);

  const chamBefore = h.countItemQty(h.getInventory(g.p), 'chamomile');

  // Chapter 1 completes on a single plant (target 1).
  h.greenPathEvent(g.p, 'garden_plant');
  const s1 = h.greenPathStateBody(g.p);
  check('planting once advances past Chapter 1', s1 && s1.chapter === 1 && s1.title === 'The First Cutting', s1);
  check('Chapter 1 grants 3× chamomile into the account', h.countItemQty(h.getInventory(g.p), 'chamomile') === chamBefore + 3, { before: chamBefore, after: h.countItemQty(h.getInventory(g.p), 'chamomile') });

  // Chapter 2 is level-gated at 3 — a harvest at level 1 must NOT advance it.
  h.greenPathEvent(g.p, 'garden_harvest');
  const sGate = h.greenPathStateBody(g.p);
  check('Chapter 2 harvest is blocked below its level gate', sGate && sGate.chapter === 1 && sGate.progress === 0 && sGate.levelOk === false, sGate);

  // Meet the gate; now harvests count.
  h.getProgress(g.p).level = 3;
  const calBefore = h.countItemQty(h.getInventory(g.p), 'calendula');
  h.greenPathEvent(g.p, 'garden_harvest');
  h.greenPathEvent(g.p, 'garden_harvest');
  const sMid = h.greenPathStateBody(g.p);
  check('two of three harvests leaves Chapter 2 in progress', sMid && sMid.chapter === 1 && sMid.progress === 2, sMid);
  check('a plant event does not count toward a harvest objective', (() => {
    h.greenPathEvent(g.p, 'garden_plant');
    const s = h.greenPathStateBody(g.p);
    return s.chapter === 1 && s.progress === 2;
  })());

  h.greenPathEvent(g.p, 'garden_harvest'); // third harvest completes Chapter 2
  const s2 = h.greenPathStateBody(g.p);
  check('finishing Chapter 2 advances to Chapter 3 (Hearth and Healing)', s2 && s2.done === false && s2.chapter === 2 && s2.title === 'Hearth and Healing', s2);
  check('Chapter 2 grants 3× calendula', h.countItemQty(h.getInventory(g.p), 'calendula') === calBefore + 3, { before: calBefore, after: h.countItemQty(h.getInventory(g.p), 'calendula') });

  // ── Chapter 3: brew a remedy (level-gated at 5) ──────────────────────────────
  check('Chapter 3 objective is garden_brew', s2.label.includes('Brew'), s2);
  // Below the gate (still level 3), brewing must NOT advance it.
  h.greenPathEvent(g.p, 'garden_brew');
  check('Chapter 3 brew is blocked below level 5', h.greenPathStateBody(g.p).chapter === 2 && h.greenPathStateBody(g.p).progress === 0 && h.greenPathStateBody(g.p).levelOk === false);

  h.getProgress(g.p).level = 5;
  const comfreyBefore = h.countItemQty(h.getInventory(g.p), 'comfrey');
  // A garden plant/harvest must not count toward a brew objective.
  h.greenPathEvent(g.p, 'garden_harvest');
  check('a harvest does not count toward the brew objective', h.greenPathStateBody(g.p).chapter === 2 && h.greenPathStateBody(g.p).progress === 0);

  h.greenPathEvent(g.p, 'garden_brew'); // completes Chapter 3 → on to the Hedge band
  const s3 = h.greenPathStateBody(g.p);
  check('finishing Chapter 3 advances to Chapter 4 (Crossing the Hedge)', s3 && s3.done === false && s3.chapter === 3 && s3.title === 'Crossing the Hedge', s3);
  check('Chapter 3 grants the four Cottage herbs', (() => {
    const inv = h.getInventory(g.p);
    return h.countItemQty(inv, 'comfrey') === comfreyBefore + 3 && h.countItemQty(inv, 'lemon_balm') === 3 &&
      h.countItemQty(inv, 'feverfew') === 3 && h.countItemQty(inv, 'lavender') === 3;
  })());

  // ── Chapter 4: find a wild cutting (seed_found), level-gated at 8 ─────────────
  check('Chapter 4 objective is seed_found', s3.label.includes('Find'), s3);
  h.greenPathEvent(g.p, 'seed_found'); // level 5, below gate 8 → no advance
  check('Chapter 4 is blocked below level 8', h.greenPathStateBody(g.p).chapter === 3 && h.greenPathStateBody(g.p).levelOk === false);
  h.getProgress(g.p).level = 8;
  // The real path: looting a Wilds seed fires seed_found through grantLoot.
  h.grantLoot([{ kind: 'item', itemId: 'mugwort', qty: 1 }], g.p);
  const s4 = h.greenPathStateBody(g.p);
  check('looting a Wilds cutting completes Chapter 4', s4 && s4.chapter === 4 && s4.title === 'The Warding Herbs', s4);
  check('Chapter 4 grants 3× vervain', h.countItemQty(h.getInventory(g.p), 'vervain') === 3);

  // ── Chapter 5: harvest five times, level-gated at 11 ─────────────────────────
  h.getProgress(g.p).level = 11;
  for (let i = 0; i < 4; i++) h.greenPathEvent(g.p, 'garden_harvest');
  check('four of five harvests leaves Chapter 5 in progress', h.greenPathStateBody(g.p).chapter === 4 && h.greenPathStateBody(g.p).progress === 4);
  h.greenPathEvent(g.p, 'garden_harvest'); // fifth completes it
  const s5 = h.greenPathStateBody(g.p);
  check('Chapter 5 completes to Chapter 6 (Bitter Sight)', s5 && s5.chapter === 5 && s5.title === 'Bitter Sight', s5);
  check('Chapter 5 grants wormwood + rue', h.countItemQty(h.getInventory(g.p), 'wormwood') === 3 && h.countItemQty(h.getInventory(g.p), 'rue') === 3);

  // ── Chapter 6: brew a hedge remedy, level-gated at 14 → on to the Poison Path
  h.getProgress(g.p).level = 14;
  h.greenPathEvent(g.p, 'garden_brew');
  const s6 = h.greenPathStateBody(g.p);
  check('finishing Chapter 6 advances to Chapter 7 (The Beautiful Lady)', s6 && s6.done === false && s6.chapter === 6 && s6.title === 'The Beautiful Lady', s6);
  check('Chapter 6 grants st_johns_wort + rowan_berry', h.countItemQty(h.getInventory(g.p), 'st_johns_wort') === 3 && h.countItemQty(h.getInventory(g.p), 'rowan_berry') === 3);

  // ── Chapter 7: tend the dark beds — harvest 7×, level-gated at 17 ─────────────
  h.getProgress(g.p).level = 17;
  for (let i = 0; i < 6; i++) h.greenPathEvent(g.p, 'garden_harvest');
  check('six of seven harvests leaves Chapter 7 in progress', h.greenPathStateBody(g.p).chapter === 6 && h.greenPathStateBody(g.p).progress === 6);
  h.greenPathEvent(g.p, 'garden_harvest'); // seventh completes it
  const s7 = h.greenPathStateBody(g.p);
  check('Chapter 7 completes to Chapter 8 (The Screaming Root)', s7 && s7.chapter === 7 && s7.title === 'The Screaming Root', s7);
  check('Chapter 7 grants belladonna + henbane', h.countItemQty(h.getInventory(g.p), 'belladonna') === 3 && h.countItemQty(h.getInventory(g.p), 'henbane') === 3);

  // ── Chapter 8: sow a nightshade (garden_plant), level-gated at 19 ─────────────
  h.getProgress(g.p).level = 19;
  h.greenPathEvent(g.p, 'garden_plant');
  const s8 = h.greenPathStateBody(g.p);
  check('Chapter 8 completes to Chapter 9 (The Witch’s Garden)', s8 && s8.chapter === 8 && s8.title === "The Witch's Garden", s8);
  check('Chapter 8 grants mandrake + wolfsbane + datura', (() => {
    const inv = h.getInventory(g.p);
    return h.countItemQty(inv, 'mandrake') === 3 && h.countItemQty(inv, 'wolfsbane') === 3 && h.countItemQty(inv, 'datura') === 3;
  })());

  // ── Chapter 9: the final working (garden_brew), level-gated at 20 → completes all
  h.getProgress(g.p).level = 20;
  h.greenPathEvent(g.p, 'garden_brew');
  const s9 = h.greenPathStateBody(g.p);
  check('brewing completes Chapter 9 — the whole nine-chapter Green Path', s9 && s9.done === true && s9.chapter === GREEN_PATH.length && GREEN_PATH.length === 9, s9);
  check('Chapter 9 grants hemlock + foxglove + black_hellebore', (() => {
    const inv = h.getInventory(g.p);
    return h.countItemQty(inv, 'hemlock') === 3 && h.countItemQty(inv, 'foxglove') === 3 && h.countItemQty(inv, 'black_hellebore') === 3;
  })());

  // ── Capstone trophies: completing the path earns the Verdant aura + a 5th bed ─
  check('completing the path unlocks the earned Verdant aura', (h.getProgress(g.p).auraUnlocks || []).indexOf('verdant') !== -1, h.getProgress(g.p).auraUnlocks);
  check('completers get a permanent fifth garden bed', h.gardenPlotsFor(g.p) === 5, h.gardenPlotsFor(g.p));
  // A player still mid-path has the normal four beds.
  const mid = join('Sprout'); mid.p.accountKey = 'sprout';
  check('a mid-path player still has four beds', h.gardenPlotsFor(mid.p) === 4, h.gardenPlotsFor(mid.p));

  // Further events on a finished path are no-ops (no crash, no extra grants).
  const vervainFinal = h.countItemQty(h.getInventory(g.p), 'vervain');
  h.greenPathEvent(g.p, 'garden_plant');
  h.greenPathEvent(g.p, 'seed_found');
  h.greenPathEvent(g.p, 'garden_brew');
  check('a completed path ignores further events', h.greenPathStateBody(g.p).done === true && h.countItemQty(h.getInventory(g.p), 'vervain') === vervainFinal);

  // A guest with no account gets a null state (never throws).
  const guest = join('Passerby', 0);
  check('greenPathStateBody is null without an account', h.greenPathStateBody(guest.p) === null);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
