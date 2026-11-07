// The second sight: a seer who saw a shroud, read by Martin's rule (1703),
// with the practical half: no one has shown it foretells anything.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-sight-');
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

const R = HOUSEHOLD_RITES.second_sight;
check('the second sight is a household rite, badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Martin\'s definition, word for word', /"is a singular faculty of seeing an otherwise invisible object, without any previous means used by the person that sees it"/.test(R.lore) && /Account of the Second-Sight/.test(R.source));
check('…and his rule of the shroud: below the middle a year, toward the head days', /"When a shroud is perceived about one, it is a sure prognostic of death"/.test(R.lore) && /below the middle/.test(R.how) && /within days/.test(R.how));
check('not hereditary, not passed on (Martin); seers wanted rid of it (Kirk)', /did not run in families/.test(R.lore) && /taibhsear/.test(R.lore) && /hideous Spectacles/.test(R.lore) && /Kirk, The Secret Common-Wealth \(1691\)/.test(R.source));
check('Johnson\'s verdict of 1773: "only willing to believe"', /"came away at last only willing to believe\."/.test(R.lore) && /Johnson, A Journey to the Western Islands of Scotland \(1775\)/.test(R.source));
const c = CALLERS.find((x) => x.id === 'second_sight_shroud');
check('a seer comes to the door, any time of year', c && !c.season && c.steps.some((s) => s.kind === 'rite' && s.rite === 'second_sight'));
check('the practical half: nothing shown to foretell; don\'t frighten the household; visit him; she needn\'t carry it alone', /nobody has ever shown the sight foretelling anything/.test(c.resolution) && /frighten a household for nothing/.test(c.resolution) && /seen the doctor/.test(c.resolution) && /needn't carry it alone/.test(c.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Seer'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Seer', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'seer'; h.accounts.seer = {}; h.playerProgress.seer = { level: 1, xp: 0 };
  h.callers.stateOf(p);
  h.accounts.seer.callers.active = { id: c.id, done: {} };
  s.emit('message', JSON.stringify({ type: 'rite_do' }));
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('reading it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.seer, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'household');
  check('…and writes The Second Sight into The House and the Hive', ch.entries.find((e) => e.id === 'second_sight').met);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
