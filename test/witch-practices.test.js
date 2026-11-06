// The Witch Paths' practices — Green, Lunar, Hedge, Kitchen get verbs.
//
// Holds each practice to its rule and its path bonus: a herb harvested in its
// Culpeper ruler's hour yields more (more again for a Green Witch) and never
// in another hour; drawing down the moon needs night and the open sky, once a
// night, and its XP is real (skillXpMult); riding the hedge needs night, the
// Wilds and a trance draught, consumes the draught and brings back hedge
// herbs (two for a Hedge Witch); the crossed loaf is baked only at your own
// hearth, once a day (twice for a Kitchen Witch).
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-practice-');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
  };
}

const PR = require('../data/practices');
const PH = require('../data/planetaryHours');
const { HEDGE_SEED_DROPS } = require('../data/gameConstants');
const { WITCH_PATHS } = require('../data/paths');
const CYCLE = 40 * 60000, DAYLEN = 20 * 60000;

check('the four remaining paths each have a practice', ['green', 'lunar', 'hedge', 'kitchen'].every((p) => PR.PRACTICES.some((x) => x.path === p)) && ['green', 'lunar', 'hedge', 'kitchen'].every((p) => WITCH_PATHS[p]));
check('every practice names its tier and a source', PR.PRACTICES.every((p) => ['record', 'folk', 'revival'].includes(p.tier) && p.source && p.lore.length > 100));
check('the hedge brings back real hedge herbs', HEDGE_SEED_DROPS.length > 0);

require('../server.js');
setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const say = (s, m) => s.emit('message', JSON.stringify(m));
  function join(tag, key, path) {
    const s = makeMockSocket(tag); connHandler(s);
    say(s, { type: 'join', name: tag, charId: 0 });
    const p = h.players.get(s.lastOfType('init').id);
    p.accountKey = key; h.accounts[key] = path ? { witchPath: path } : {};
    return { s, p };
  }
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  // A night moment and a day moment near now.
  const base = Math.floor(realNow() / CYCLE) * CYCLE;
  const NIGHT = base + DAYLEN + 60000, DAY = base + 60000, NEXT_NIGHT = NIGHT + CYCLE;

  // ── 🌿 Green: harvest in the ruler's hour ────────────────────────────────
  // Find a Venus hour and a Saturn hour (yarrow is Venus's).
  const hrs = PH.planetaryHourSchedule(realNow(), 30);
  const venus = hrs.find((x) => x.planetDay === 5), saturn = hrs.find((x) => x.planetDay === 6);
  const g = join('Green', 'pr_green', null), gw = join('GreenWitch', 'pr_gw', 'green');
  check('yarrow is Venus\'s herb (Culpeper)', PR.CULPEPER_RULERS.yarrow === 5);
  check('in Venus\'s hour, yarrow yields more', at(venus.start + 1000, () => h.greenHourBonus(g.p, 'yarrow')) === PR.GREEN_HOUR_BONUS);
  check('…more again for a Green Witch', at(venus.start + 1000, () => h.greenHourBonus(gw.p, 'yarrow')) === PR.GREEN_HOUR_BONUS_PATH);
  check('…and nothing extra in Saturn\'s hour', at(saturn.start + 1000, () => h.greenHourBonus(gw.p, 'yarrow')) === 0);
  check('a herb with no ruler never gets the bonus', at(venus.start + 1000, () => h.greenHourBonus(gw.p, 'datura')) === 0);
  // Through the real harvest handler.
  const ginv = h.getInventory(g.p);
  h.accounts.pr_green.garden = null;
  h.addItemToAccount(ginv, 'yarrow', 1);
  at(venus.start + 1000, () => say(g.s, { type: 'garden_plant', plotIndex: 0, herb: 'yarrow' }));
  const before = h.countItemQty(ginv, 'yarrow');
  at(venus.start + 1000 + 3600001 > venus.end ? venus.start + 2000 : venus.start + 2000, () => {
    // mature the bed, then harvest inside the hour
    const plots = h.gardenOf ? h.gardenOf('pr_green', 4) : null;
    if (plots && plots[0]) plots[0].plantedAt -= 2 * 3600000;
    say(g.s, { type: 'garden_harvest', plotIndex: 0 });
  });
  const toast = g.s.lastOfType('toast');
  check('the harvest handler pays the hour bonus, and says so', h.countItemQty(ginv, 'yarrow') > before && toast && /planet's hour/.test(toast.message), { got: h.countItemQty(ginv, 'yarrow') - before, toast: toast && toast.message });

  // ── 🌕 Lunar: drawing down the moon ──────────────────────────────────────
  const l = join('Lunar', 'pr_lunar', 'lunar');
  l.p.room = 'outside';
  at(DAY, () => { l.s.sent.length = 0; say(l.s, { type: 'practice_do', id: 'lunar' }); });
  check('not by day', !!l.s.lastOfType('practice_error') && !h.accounts.pr_lunar.moonBuff);
  l.p.room = 'cottage'; l.p.instance = 'home_pr_lunar';
  at(NIGHT, () => { l.s.sent.length = 0; say(l.s, { type: 'practice_do', id: 'lunar' }); });
  check('not under a roof', !!l.s.lastOfType('practice_error') && !h.accounts.pr_lunar.moonBuff);
  l.p.room = 'outside'; l.p.instance = '';
  const xp0 = h.skillXpMult(l.p);
  at(NIGHT, () => say(l.s, { type: 'practice_do', id: 'lunar' }));
  const mb = h.accounts.pr_lunar.moonBuff;
  check('at night under the sky, the moon comes down', mb && mb.stat === 'xp' && mb.amount >= PR.DRAW_DOWN.xpPath);
  check('…and you really learn faster', h.skillXpMult(l.p) > xp0, { before: xp0, after: h.skillXpMult(l.p) });
  at(NIGHT + 60000, () => { l.s.sent.length = 0; say(l.s, { type: 'practice_do', id: 'lunar' }); });
  check('once a night', !!l.s.lastOfType('practice_error'));
  at(NEXT_NIGHT, () => { l.s.sent.length = 0; say(l.s, { type: 'practice_do', id: 'lunar' }); });
  check('…and again the next night', !l.s.lastOfType('practice_error'));

  // ── 🦉 Hedge: riding the hedge ───────────────────────────────────────────
  const hedgeIds = new Set(HEDGE_SEED_DROPS.map((d) => d.itemId));
  const countHedge = (inv) => [...hedgeIds].reduce((n, id) => n + h.countItemQty(inv, id), 0);
  const x = join('Rider', 'pr_hedge', null), hw = join('HedgeWitch', 'pr_hw', 'hedge');
  const xinv = h.getInventory(x.p), hinv = h.getInventory(hw.p);
  x.p.room = 'wilds'; hw.p.room = 'wilds';
  at(NIGHT, () => { x.s.sent.length = 0; say(x.s, { type: 'practice_do', id: 'hedge' }); });
  check('no draught, no crossing', !!x.s.lastOfType('practice_error') && countHedge(xinv) === 0);
  h.addItemToAccount(xinv, 'mugwort_draught', 1);
  x.p.room = 'outside';
  at(NIGHT, () => { x.s.sent.length = 0; say(x.s, { type: 'practice_do', id: 'hedge' }); });
  check('the hedge is out in the Wilds, not in town', !!x.s.lastOfType('practice_error') && h.countItemQty(xinv, 'mugwort_draught') === 1);
  x.p.room = 'wilds';
  at(DAY, () => { x.s.sent.length = 0; say(x.s, { type: 'practice_do', id: 'hedge' }); });
  check('not by day', !!x.s.lastOfType('practice_error'));
  at(NIGHT, () => say(x.s, { type: 'practice_do', id: 'hedge' }));
  check('at night in the Wilds, the draught is drunk and a cutting comes back', h.countItemQty(xinv, 'mugwort_draught') === 0 && countHedge(xinv) === PR.HEDGE_GIFTS, countHedge(xinv));
  h.addItemToAccount(xinv, 'mugwort_draught', 1);
  at(NIGHT + 60000, () => { x.s.sent.length = 0; say(x.s, { type: 'practice_do', id: 'hedge' }); });
  check('once a night', !!x.s.lastOfType('practice_error') && h.countItemQty(xinv, 'mugwort_draught') === 1);
  h.addItemToAccount(hinv, 'flying_ointment', 1);
  at(NIGHT, () => say(hw.s, { type: 'practice_do', id: 'hedge' }));
  check('a Hedge Witch crosses on flying ointment and brings back two', h.countItemQty(hinv, 'flying_ointment') === 0 && countHedge(hinv) === PR.HEDGE_GIFTS_PATH, countHedge(hinv));

  // ── 🍞 Kitchen: the crossed loaf ─────────────────────────────────────────
  const k = join('Baker', 'pr_bake', null), kw = join('KitchenWitch', 'pr_kw', 'kitchen');
  const kinv = h.getInventory(k.p), kwinv = h.getInventory(kw.p);
  k.p.room = 'outside';
  k.s.sent.length = 0; say(k.s, { type: 'practice_do', id: 'kitchen' });
  check('a loaf is baked at your own hearth, not in the square', !!k.s.lastOfType('practice_error') && h.countItemQty(kinv, 'hearth_loaf') === 0);
  k.p.room = 'cottage'; k.p.instance = 'home_pr_bake';
  say(k.s, { type: 'practice_do', id: 'kitchen' });
  check('at home, a Hearth Loaf', h.countItemQty(kinv, 'hearth_loaf') === 1);
  k.s.sent.length = 0; say(k.s, { type: 'practice_do', id: 'kitchen' });
  check(`${PR.LOAVES_PER_DAY} a day`, !!k.s.lastOfType('practice_error') && h.countItemQty(kinv, 'hearth_loaf') === 1);
  kw.p.room = 'cottage'; kw.p.instance = 'home_pr_kw';
  for (let i = 0; i < 3; i++) say(kw.s, { type: 'practice_do', id: 'kitchen' });
  check(`a Kitchen Witch bakes ${PR.LOAVES_PER_DAY_PATH}`, h.countItemQty(kwinv, 'hearth_loaf') === PR.LOAVES_PER_DAY_PATH);
  check('the loaf heals', h.ITEM_CATALOG.hearth_loaf && (require('../data/world').PLANT_CATALOG.hearth_loaf || {}).effect === 'heal');
  const wild = new Set((h.WORLD2.natureDecor || []).map((d) => d.type));
  check('loaves do not grow in the Wilds', !wild.has('hearth_loaf'));

  // ── The panel ─────────────────────────────────────────────────────────────
  say(kw.s, { type: 'practice_state' });
  const ps = kw.s.lastOfType('practice_state');
  check('the panel lists all four, and marks your own path', ps && ps.practices.length === 4 && ps.practices.find((p) => p.id === 'kitchen').onPath === true && ps.practices.filter((p) => p.onPath).length === 1);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 700);
