// The changeling wife: the old question asked once and gently, the death of
// Bridget Cleary (1895) told plainly, and the practical half: she has a fever,
// send for the doctor. Nothing harmful is done in the game.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-changeling-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { HOUSEHOLD_RITES } = require('../data/household.js');
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

const R = HOUSEHOLD_RITES.changeling_wife;
check('asking her name is a household rite, badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('the rite is only a question, asked once, in daylight, with her mother there', /Ask once\. Nothing else is done\./.test(R.how) && /daylight/.test(R.how) && /her mother there/.test(R.how) && !/fire|herb|poker/i.test(R.how));
check('every sign is her answering as herself', R.outcomes.every((o) => /name|I'm Kathleen|laughs/.test(o)));
check('Bridget Cleary, as the Dictionary of Irish Biography and the 1901 account give it', /Ballyvadlea in Co\. Tipperary/.test(R.lore) && /bronchitis/.test(R.lore) && /"found her suffering from nervous excitement and a slight bronchitis"/.test(R.lore) && /"Are you Bridget Boland, wife of Michael Cleary, in the name of God\?"/.test(R.lore) && /"in the name of the Father, Son and Holy Ghost"/.test(R.lore) && /convicted of manslaughter and given twenty years/.test(R.lore) && /Dictionary of Irish Biography \(2009\)/.test(R.source) && /McCarthy, Five Years in Ireland/.test(R.source));
check('the rhyme, from the Schools\' Collection', /"are you a witch, or are you a fairy, or are you the wife of Michael Cleary\?"/.test(R.lore) && /Schools' Collection, vol\. 0583, p\. 161/.test(R.source));
const c = CALLERS.find((x) => x.id === 'changeling_wife');
check('a caller any time of year, working the rite', c && !c.season && !c.when && c.steps.some((s) => s.kind === 'rite' && s.rite === 'changeling_wife'));
check('the honest half: she is herself, and why it matters (Bridget Cleary); no fairy doctor', /She is herself/.test(c.resolution) && /Bridget Cleary/.test(c.resolution) && /man over the mountain is not sent for/.test(c.resolution));
check('the practical half: fever, the doctor today, warmth, drink, sleep', /fever makes anyone cross and strange/.test(c.resolution) && /doctor today/.test(c.resolution) && /plenty to drink/.test(c.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Bedside'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Bedside', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'bedside'; h.accounts.bedside = {}; h.playerProgress.bedside = { level: 1, xp: 0 };
  h.callers.stateOf(p);
  h.accounts.bedside.callers.active = { id: c.id, done: {} };
  s.emit('message', JSON.stringify({ type: 'rite_do' }));
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.bedside, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'against');
  check('…and writes it into Against the Witch', ch.entries.find((e) => e.id === 'changeling_wife').met);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
