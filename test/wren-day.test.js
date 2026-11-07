// Wren Day: hunting the wren on St Stephen's Day (Frazer; Moore, 1891), with a
// straw wren, a caller who comes only on the 26th (and the 27th, for evening
// players across the Atlantic), first at the door, and the Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-wrenday-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { WREN_RITES, WREN_WHEN } = require('../data/wrenDay.js');
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

const R = WREN_RITES.wren_hunt;
check('hunting the wren: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Frazer\'s words: the holly and ivy on a broomstick, and the rhyme', /"in the middle of a mass of holly and ivy on the top of a broomstick"/.test(R.lore) && /"The wren, the wren, the king of all birds, \/ St\. Stephen's Day was caught in the furze"/.test(R.lore) && /Frazer, The Golden Bough \(abridged 1922\), ch\. LIV/.test(R.source));
check('Moore on the Manx hunt: "cruel but curious", the feathers against witchcraft', /"the cruel but curious custom of Hunting the Wren"/.test(R.lore) && /"an effectual preservative against witchcraft"/.test(R.lore) && /Moore, The Folk-Lore of the Isle of Man \(1891\)/.test(R.source));
check('the straw costumes (RTÉ, 1964) and the Pembrokeshire wren house (Museum Wales)', /straw costumes/.test(R.lore) && /RTÉ Archives/.test(R.source) && /wren house/.test(R.lore) && /98\.333/.test(R.source));
check('the betrayal stories told as legend, and the wren a straw one now', /Legend says it betrayed St Stephen/.test(R.lore) && /protected bird now/.test(R.lore) && /straw wren/.test(R.how) && !/kill/i.test(R.how));
check('St Stephen\'s Day: the 26th, and the 27th for the evening across the Atlantic', WREN_WHEN.month === 12 && WREN_WHEN.from === 26 && WREN_WHEN.to === 27);
const c = CALLERS.find((x) => x.id === 'wren_boys');
check('the wren boys: ivy for the bush, then the round of the houses', c && c.when === WREN_WHEN && c.steps[0].item === 'ivy_leaf' && c.steps[1].rite === 'wren_hunt' && /Nobody kills the wren now/.test(c.plea));
check('the practical half: count the money fair, the lit road, crumbs and fat for the real wrens', /count the money out fair/.test(c.resolution) && /lit road/.test(c.resolution) && /crumbs and a bit of fat/.test(c.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Wren'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Wren', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'wren'; h.accounts.wren = {}; h.playerProgress.wren = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const days = [26, 27].map((d) => offered(Date.UTC(2026, 11, d, 12)));
  check('on St Stephen\'s Day the wren boys come first, a Yule caller after them', days.every((o) => o[0] === 'wren_boys' && o.length === 3 && CALLERS.find((x) => x.id === o[1]).season === 'yule'), days);
  const outside = [Date.UTC(2026, 11, 25, 12), Date.UTC(2026, 11, 28, 12), Date.UTC(2027, 5, 26, 12)].map(offered);
  check('on other days they never come', outside.every((o) => !o.includes('wren_boys') && o.length === 3), outside);
  at(Date.UTC(2026, 11, 26, 12), () => {
    h.accounts.wren.callers.active = { id: c.id, done: { 0: 'ivy' } };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[1];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.wren, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'yule');
  const e = ch.entries.find((x) => x.id === 'wren_hunt');
  check('…and writes Hunting the Wren into Yuletide, after the Yule rites', e && e.met && /· St Stephen's Day$/.test(e.title) && ch.entries[ch.entries.length - 1].id === 'wren_hunt' && /wren carried round on St Stephen's Day/.test(ch.intro));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
