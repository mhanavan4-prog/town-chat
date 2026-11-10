// The house and the hive: telling the bees, silver water for the evil eye,
// rowan and red thread, the hagstone, and the customs of a death in the house,
// each worked for a caller, each told honestly.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-house-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { HOUSEHOLD_RITES: R } = require('../data/household.js');
const { HALLOWEEN_RITES } = require('../data/halloween.js');
const { YULE_RITES } = require('../data/yule.js');
const { WHEEL_RITES } = require('../data/wheelRites.js');
const { CALLERS } = require('../data/callers.js');
const { buildCharmBook } = require('../lib/charmBook.js');
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
const rites = Object.values(R);
check('at least the five first household rites, none clashing with a seasonal rite', rites.length >= 5 && rites.every((r) => !HALLOWEEN_RITES[r.key] && !YULE_RITES[r.key] && !WHEEL_RITES[r.key]));
check('every rite is badged, sourced, says how and has three signs that fit the Board', rites.every((r) => /^(record|folk)$/.test(r.tier) && r.source && r.how && r.lore && r.outcomes.length === 3 && r.outcomes.every((o) => `${r.icon} ${r.name}: ${o}`.length <= 140)));
check('telling the bees is Chambers\'s Suffolk custom, with crape and the funeral', /formally impart the fact to the bees/.test(R.telling_bees.lore) && /crape/.test(R.telling_bees.how) && /Book of Days \(1864\)/.test(R.telling_bees.source));
check('silver water is Campbell\'s sixpence test, the bowl turned over, then Carmichael\'s sprinkling over head and backbone (Barra\'s three times were for a cow)', /silver sixpence/.test(R.silver_water.how) && /turn the bowl quickly upside down/.test(R.silver_water.how) && /head and backbone/.test(R.silver_water.how) && !/three times/.test(R.silver_water.how) && /3 times on the cow/.test(R.silver_water.lore) && /Campbell/.test(R.silver_water.source) && /Carmina Gadelica/.test(R.silver_water.source));
check('rowan and red thread, and "scoring above the breath" called a crime', /Rowan-tree and red thread/.test(R.rowan_thread.lore) && /was a crime/.test(R.rowan_thread.lore));
check('the hagstone is the Pitt Rivers stone; the unsourced witch-ball date left out', /Pitt Rivers/.test(R.hagstone.lore) && !/1930s/.test(R.hagstone.lore));
check('clocks and mirrors are dated as they are recorded, with Napier, Henderson and Gregor (1879–81), not "from the 1890s"; the soul-catching glass is Frazer\'s', /"The clock was stopped, the looking-glass was covered with a cloth"/.test(R.death_house.lore) && !/from the 1890s/.test(R.death_house.lore) && /Frazer\'s, in 1890/.test(R.death_house.lore));
// The first five, in order (the practical-half checks below index them); then every
// other caller that works a household rite. Counts come from the data, so a new
// household rite only needs its own test.
const FIRST = ['tell_the_bees', 'overlooked_child', 'byre_rowan', 'hagridden', 'death_in_house'];
const ids = [...FIRST, ...CALLERS.filter((c) => !FIRST.includes(c.id) && c.steps.some((s) => s.kind === 'rite' && R[s.rite])).map((c) => c.id)];
const callers = ids.map((id) => CALLERS.find((c) => c.id === id));
check('every household rite has its caller, any time of year', callers.every((c) => c && !c.season && c.steps.some((s) => s.kind === 'rite' && R[s.rite])) && new Set(callers.flatMap((c) => c.steps.filter((s) => s.kind === 'rite').map((s) => s.rite))).size === rites.length);

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Wise'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Wise', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'wise'; h.accounts.wise = {}; h.playerProgress.wise = { level: 1, xp: 0 };
  h.callers.stateOf(p);
  for (const c of callers) {
    h.accounts.wise.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
    const idx = c.steps.findIndex((st) => st.kind === 'rite');
    const step = h.callers.callersStatePayload(p).active.steps[idx];
    const r = R[c.steps[idx].rite];
    if (!(step.done && r.outcomes.some((o) => step.note.endsWith(o)))) check(`${c.id}: the rite gives one of its signs`, false, step);
  }
  const ch = buildCharmBook({ acct: h.accounts.wise, prog: {}, seasonKey: null }).chapters.find((c) => c.key === 'household');
  const home = rites.filter((r) => !r.against).length;
  check('the Charm Book\'s House and the Hive chapter: every rite of the house written in (and the hearth\'s two to come)', ch && ch.total === home + 2 && ch.met === home);
  const ag = buildCharmBook({ acct: h.accounts.wise, prog: {}, seasonKey: null }).chapters.find((c) => c.key === 'against');
  check('…and the counter-magic in Against the Witch, every one written in', ag && ag.total === rites.length - home && ag.met === ag.total);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
