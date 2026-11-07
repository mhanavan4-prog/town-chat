// Valentine's Eve: the bay leaves and the salted egg (The Connoisseur, 1755,
// as Hone reprinted it; Pepys, 1662), a caller who comes only on 13 and 14
// February, first at the door, and the Charm Book; the practical half is
// thirst, broken sleep, and having a word with Dick's sister.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-valentine-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { VALENTINE_RITES, VALENTINE_WHEN } = require('../data/valentine.js');
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

const R = VALENTINE_RITES.valentine_bay;
check('the bay leaves: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('The Connoisseur\'s letter: five bay leaves, four corners and the middle', /"the night before, I got five bay-leaves"/.test(R.lore) && /"pinned four of them to the four corners of my pillow, and the fifth to the middle;"/.test(R.lore) && /The Connoisseur, No\. 56 \(20 February 1755\)/.test(R.source) && /Hone/.test(R.source));
check('…the salted egg, eaten "shell and all, without speaking or drinking after it"', /"I boiled an egg hard, and took out the yolk, and filled it with salt;"/.test(R.lore) && /"ate it, shell and all, without speaking or drinking after it\."/.test(R.lore));
check('…the names in clay in the water, and the first seen in the morning', /"the first that rose up was to be our valentine\."/.test(R.lore) && /"lay a-bed and shut my eyes all the morning, till he came to our house"/.test(R.lore));
check('Pepys, 1662: "because I would not have his daughter to be my Valentine"', /"because I would not have his daughter to be my Valentine"/.test(R.lore) && /Pepys, Diary, 14 February 1662/.test(R.source));
check('the 13th and the 14th', VALENTINE_WHEN.month === 2 && VALENTINE_WHEN.from === 13 && VALENTINE_WHEN.to === 14 && VALENTINE_WHEN.label === "Valentine's Eve");
const c = CALLERS.find((x) => x.id === 'valentines_eve');
check('Kitty Ash: the bay leaves, on her night', c && c.when === VALENTINE_WHEN && c.steps.length === 1 && c.steps[0].rite === 'valentine_bay');
check('the practical half: thirst and broken sleep, leave the shell, water by the bed, a word with his sister', /thirsty, broken night/.test(c.resolution) && /Leave the shell/.test(c.resolution) && /cup of water by the bed/.test(c.resolution) && /his sister/.test(c.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Kitty'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Kitty', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'kitty'; h.accounts.kitty = {}; h.playerProgress.kitty = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const days = [13, 14].map((d) => offered(Date.UTC(2027, 1, d, 12)));
  check('on Valentine\'s Eve she comes first at the door', days.every((o) => o[0] === 'valentines_eve' && o.length === 3), days);
  const outside = [Date.UTC(2027, 1, 12, 12), Date.UTC(2027, 1, 15, 12), Date.UTC(2027, 7, 13, 12)].map(offered);
  check('on other days she never comes', outside.every((o) => !o.includes('valentines_eve') && o.length === 3), outside);
  at(Date.UTC(2027, 1, 13, 12), () => {
    h.accounts.kitty.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.kitty, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'valentine_bay');
  check('…and writes the Bay Leaves into The Turning Year', e && e.met && /· Valentine's Eve$/.test(e.title) && ch.entries[ch.entries.length - 1].id === 'valentine_bay');
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
