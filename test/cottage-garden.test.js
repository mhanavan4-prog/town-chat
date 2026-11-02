// The Cottage Garden — housing ↔ gardening cross-feed. Herb beds that live in
// your own cottage, tendable only while you stand in it, whose harvest comes in
// one richer (the hearth's blessing). Covers the location gate (own cottage
// only), the shared garden engine on the home beds, the +1 yield over the wild
// garden, and the rush path.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-cottgard-');

const { GARDEN_GROW_MS, GARDEN_RUSH_MS_COST } = require('../data/garden.js');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
  };
}

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];

  function join(tag, key) {
    const s = makeMockSocket(tag); connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: 0 }));
    const p = h.players.get(s.lastOfType('init').id);
    if (key) { p.accountKey = key; if (!h.accounts[key]) h.accounts[key] = {}; }
    return { s, p };
  }
  const invCount = (p, id) => { const inv = h.getInventory(p); let n = 0; for (const it of (inv.slots || inv)) if (it && it.itemId === id) n += (it.qty || 1); return n; };
  const atHome = (p) => { p.room = 'cottage'; p.instance = 'home_' + p.accountKey; };
  const HERB = 'chamomile';

  const g = join('Gardener', 'cottgard');
  // Finish the Green Path so questline rewards don't perturb the yield checks.
  h.getProgress(g.p).greenPath = { chapter: h.GREEN_PATH.length, progress: 0 };
  h.grantLoot([{ kind: 'item', itemId: HERB, qty: 20 }], g.p);

  // ── The location gate ──────────────────────────────────────────────────────
  g.p.room = 'outside'; g.p.instance = '';
  check('out of the cottage, the home garden is not tendable', h.homeGardenStateBody(g.p).canTend === false);
  g.s.emit('message', JSON.stringify({ type: 'garden_plant', where: 'home', plotIndex: 0, herb: HERB }));
  check('planting a home bed from outside is refused', !!g.s.lastOfType('garden_error'));
  check('nothing was sown while outside', h.homeGardenOf('cottgard')[0] == null);

  atHome(g.p);
  check('inside your own cottage, the home garden is tendable', h.homeGardenStateBody(g.p).canTend === true);
  check('the cottage garden has its own beds', h.homeGardenStateBody(g.p).plots.length === h.COTTAGE_GARDEN_PLOTS);

  // ── Sow + harvest a home bed (with the hearth's blessing) ───────────────────
  const before = invCount(g.p, HERB);
  g.s.emit('message', JSON.stringify({ type: 'garden_plant', where: 'home', plotIndex: 0, herb: HERB }));
  check('sowing a home bed consumes one herb', invCount(g.p, HERB) === before - 1 && h.homeGardenOf('cottgard')[0] && h.homeGardenOf('cottgard')[0].herb === HERB);
  // Mature it, then read the bed's advertised yield (base + hearth bonus).
  h.homeGardenOf('cottgard')[0].plantedAt = Date.now() - GARDEN_GROW_MS - 1000;
  const homeYield = h.homeGardenStateBody(g.p).plots[0].yield;
  const beforeHarvest = invCount(g.p, HERB);
  g.s.emit('message', JSON.stringify({ type: 'garden_harvest', where: 'home', plotIndex: 0 }));
  check('a home harvest yields the advertised amount', invCount(g.p, HERB) === beforeHarvest + homeYield, { got: invCount(g.p, HERB) - beforeHarvest, homeYield });
  check('the home bed is cleared after harvest', h.homeGardenOf('cottgard')[0] == null);
  check('the harvest toast names the hearth\'s blessing', /hearth/i.test((g.s.lastOfType('toast') || {}).message || ''));

  // ── The +1 vs the wild garden (same moon tier → base is identical) ──────────
  g.s.emit('message', JSON.stringify({ type: 'garden_plant', where: 'home', plotIndex: 1, herb: HERB }));
  g.s.emit('message', JSON.stringify({ type: 'garden_plant', plotIndex: 0, herb: HERB })); // wild bed
  const homeBedYield = h.homeGardenStateBody(g.p).plots[1].yield;
  const wildBedYield = h.gardenStateBody(g.p).plots[0].yield;
  check('a home bed out-yields the wild bed by exactly the bonus', homeBedYield === wildBedYield + h.HOME_GARDEN_YIELD_BONUS, { homeBedYield, wildBedYield, bonus: h.HOME_GARDEN_YIELD_BONUS });

  // ── Rush a home bed with Moonstones ─────────────────────────────────────────
  h.msAdjust('cottgard', GARDEN_RUSH_MS_COST + 5);
  g.s.emit('message', JSON.stringify({ type: 'garden_rush', where: 'home', plotIndex: 1 }));
  check('rushing a home bed matures it', h.homeGardenStateBody(g.p).plots[1].ready === true);

  // ── Visiting someone else's cottage can't tend your home beds ───────────────
  g.p.room = 'cottage'; g.p.instance = 'home_someone_else';
  check('a visitor cannot tend the home garden', h.homeGardenStateBody(g.p).canTend === false);
  const sownBefore = h.homeGardenOf('cottgard').filter(Boolean).length;
  g.s.emit('message', JSON.stringify({ type: 'garden_plant', where: 'home', plotIndex: 2, herb: HERB }));
  check('planting a home bed while visiting elsewhere is refused', h.homeGardenOf('cottgard').filter(Boolean).length === sownBefore);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
