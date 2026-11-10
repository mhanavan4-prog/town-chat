// St Clement's Day: Old Clem, the blacksmiths' saint (Hone, 1826; Hills,
// after Sawyer, 1884; the Illustrated London News, 1857), a caller dated by
// the Commonplace Book's own entry (23 November, and the 24th), first at the
// door, and the Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-clement-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { CLEMENT_RITES } = require('../data/stClement.js');
const { CALLERS } = require('../data/callers.js');
const { OLD_CALENDAR } = require('../data/oldCalendar.js');
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

const R = CLEMENT_RITES.old_clem;
check('Old Clem: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Hone (vol. I, 1826): the patron of blacksmiths, and the Woolwich apprentices\' Old Clem', /"St\. Clement is the patron of blacksmiths,"/.test(R.lore) && /"to serve as old Clem"/.test(R.lore) && /"an oakham wig"/.test(R.lore) && /"a long white beard"/.test(R.lore) && /"a large wooden chair"/.test(R.lore) && /"stopping and refreshing at nearly every public house"/.test(R.lore) && /"as good a supper as the money collected will allow"/.test(R.lore) && /Hone, The Every-Day Book, vol\. I \(1826\), 23 November/.test(R.source));
check('…his speech, and the anchor told as legend', /"I am the real St\. Clement, the first founder of brass, iron, and steel, from the ore\."/.test(R.lore) && /he was said to have been thrown into the sea with an anchor/.test(R.lore));
check('…the Sussex toasts as Hills gives Sawyer: "Checked shirts", not "check"', /"True hearts and sound bottoms, \/ Checked shirts and leather aprons"/.test(R.lore) && /"To the memory of Old Clem"/.test(R.lore) && /Hills, "Notes on Some Blacksmiths' Legends/.test(R.source) && /Sawyer, "'Old Clem' Celebrations and Blacksmiths' Lore", Folk-Lore Journal II \(1884\)/.test(R.source));
check('…the anvil fired, and the children Clemening (ILN, 1857)', /gunpowder on the anvil/.test(R.lore) && /Hursley before 1860/.test(R.lore) && /"the children go the round of the parish begging apples"/.test(R.lore) && /Illustrated London News \(1857\)/.test(R.source));
check('…and no unfound "Clemany" rhyme', !/Clemany/.test(R.lore));
const c = CALLERS.find((x) => x.id === 'old_clem_smiths');
check('Tom Ashby, dated by the old calendar\'s Old Clem, for two days', c && c.when && c.when.calendar === 'old_clem' && c.when.days === 2 && OLD_CALENDAR.some((e) => e.key === 'old_clem' && e.month === 11 && e.day === 23) && c.steps[0].rite === 'old_clem');
check('the practical half: eyes, nothing that melts, leather boots, assume it\'s hot, no gloved hand in the slack tub, ventilation and a CO alarm, twenty minutes under cool running water, no gunpowder', /wear something over them at the anvil/.test(c.resolution) && /Wear nothing at the fire that melts, and keep good leather boots on/.test(c.resolution) && /carbon monoxide alarm/.test(c.resolution) && /treat everything on or near the forge as hot/.test(c.resolution) && /steam inside the glove/.test(c.resolution) && /Keep the door open while the coal burns/.test(c.resolution) && /cool running water for twenty minutes, never ice/.test(c.resolution) && /no gunpowder on the anvil/.test(c.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Smith'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Smith', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'smith'; h.accounts.smith = {}; h.playerProgress.smith = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const days = [23, 24].map((d) => offered(Date.UTC(2027, 10, d, 12)));
  const season = at(Date.UTC(2027, 10, 23, 12), () => h.calendarPublicState().season.key);
  check('on St Clement\'s Day he comes first, a caller of the season after him', days.every((o) => o[0] === 'old_clem_smiths' && o.length === 3 && CALLERS.find((x) => x.id === o[1]).season === season), [season, days]);
  const outside = [Date.UTC(2027, 10, 22, 12), Date.UTC(2027, 10, 25, 12), Date.UTC(2027, 4, 23, 12)].map(offered);
  check('on other days he never comes (and on St Catherine\'s the lacemakers do)', outside.every((o) => !o.includes('old_clem_smiths') && o.length === 3) && outside[1][0] === 'cattern_lacemakers', outside);
  at(Date.UTC(2027, 10, 23, 12), () => {
    h.accounts.smith.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.smith, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'old_clem');
  check('…and writes Old Clem into The Turning Year', e && e.met && /· St Clement's Day$/.test(e.title) && ch.entries.findIndex((x) => x.id === 'old_clem') >= 12);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
