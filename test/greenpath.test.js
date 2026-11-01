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
check('chapter objectives are plant then harvest, level-gated', (() => {
  return GREEN_PATH[0].objective.type === 'garden_plant' && GREEN_PATH[0].requiresLevel === 1 &&
    GREEN_PATH[1].objective.type === 'garden_harvest' && GREEN_PATH[1].requiresLevel === 3;
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
  check('finishing Chapter 2 marks the whole path done', s2 && s2.done === true && s2.chapter === GREEN_PATH.length, s2);
  check('Chapter 2 grants 3× calendula', h.countItemQty(h.getInventory(g.p), 'calendula') === calBefore + 3, { before: calBefore, after: h.countItemQty(h.getInventory(g.p), 'calendula') });

  // Further events on a finished path are no-ops (no crash, no extra grants).
  const calFinal = h.countItemQty(h.getInventory(g.p), 'calendula');
  h.greenPathEvent(g.p, 'garden_plant');
  h.greenPathEvent(g.p, 'garden_harvest');
  check('a completed path ignores further garden events', h.greenPathStateBody(g.p).done === true && h.countItemQty(h.getInventory(g.p), 'calendula') === calFinal);

  // A guest with no account gets a null state (never throws).
  const guest = join('Passerby', 0);
  check('greenPathStateBody is null without an account', h.greenPathStateBody(guest.p) === null);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
