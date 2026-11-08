// The Mari Lwyd: the horse's skull at the door in south Wales between
// Christmas and Twelfth Night, and the pwnco, the contest of verses, before
// it is let in (Museum Wales; the Horniman; Trac Cymru; Evans, 1798). A Yule
// caller, and the Charm Book's Yuletide.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-mari-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { MARI_RITES } = require('../data/mariLwyd.js');
const { YULE_RITES } = require('../data/yule.js');
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

const R = MARI_RITES.pwnco;
check('the Mari Lwyd: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Museum Wales: the skull with ribbons and rosettes, the white cloth, the season and the counties', /"a real horse's skull, usually decorated with coloured ribbons and rosettes"/.test(R.lore) && /"A long white cloth is draped down the carrier which hides him from view"/.test(R.lore) && /"through to Twelfth Night and Hen Galan"/.test(R.lore) && /"especially popular in Glamorgan, Monmouthshire and Carmarthenshire"/.test(R.lore));
check('…the pwnco, in Museum Wales\'s words', /"an improvised rhyme and verse contest between the Mari party and the inhabitants of the house"/.test(R.lore));
check('…the first account, 1798 (Evans, 1800); "Grey Mare" most likely, "Holy Mary" as Peate once thought', /1798/.test(R.lore) && /Evans, A Tour Through Part of North Wales, in the Year 1798 \(1800\)/.test(R.source) && /"Grey Mare"/.test(R.lore) && /once thought it "Holy Mary"/.test(R.lore));
check('…Trac Cymru on the other horse customs; Llangynwyd kept it longest (not "unbroken", which the sources dispute)', /"only the Mari Lwyd has a poetry competition at its heart"/.test(R.lore) && /Llangynwyd has kept it longest/.test(R.lore) && !/unbroken|never stopped/.test(R.lore));
check('…and no pwnco verse quoted that could not be checked', !/\/ /.test(R.lore));
const c = CALLERS.find((x) => x.id === 'mari_lwyd');
check('Elin Rees, a Yule caller who works the pwnco', c && c.season === 'yule' && !c.when && c.steps[0].rite === 'pwnco' && !YULE_RITES.pwnco);
check('the practical half: a sober guide with a lantern for the blind carrier; frightened children shown it\'s bones and a neighbour; the door opens in the end', /someone sober walks beside him with a lantern/.test(c.resolution) && /let them see it's a horse's bones and a neighbour under a sheet/.test(c.resolution) && /the door opens in the end, and the party is fed/.test(c.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Elin'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Elin', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'elin'; h.accounts.elin = {}; h.playerProgress.elin = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const seen = new Set();
  for (let d = 0; d < 40; d++) { const ids = at(Date.UTC(2026, 11, 22, 12) + d * 86400000, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); }); if (ids.includes('mari_lwyd')) seen.add(d); }
  const summer = at(Date.UTC(2027, 6, 1, 12), () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  check('she comes in the Yule season, and not in summer', seen.size > 0 && !summer.includes('mari_lwyd'), [...seen]);
  at(Date.UTC(2026, 11, 28, 12), () => {
    h.accounts.elin.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.elin, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'yule');
  const e = ch.entries.find((x) => x.id === 'pwnco');
  check('…and writes the Mari Lwyd into Yuletide, after the three Yule rites and before Christmas Eve', e && e.met && ch.entries.findIndex((x) => x.id === 'pwnco') === 3 && ch.entries.findIndex((x) => x.id === 'midnight_oxen') === 4 && /the Mari Lwyd answered in verse at the door/.test(ch.intro));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
