// The toadman's bone: East Anglian horsemen's magic and the Scots Horseman's
// Word, badged folk (gathered from the last horsemen), with the practical half
// for a mare galled by her collar.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-toadbone-');
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

const R = HOUSEHOLD_RITES.toad_bone;
check('the toadman\'s bone is a household rite, badged folk, three signs that fit the Board', R && R.tier === 'folk' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('the stream at midnight and Rolfe\'s words on the bone that swims up stream', /running stream at midnight/.test(R.lore) && /"All will sink but one single bone and that will swim up stream"/.test(R.lore) && /Rolfe, I Walked by Night, ed\. L\. Rider Haggard \(1935\)/.test(R.source));
check('the Horseman\'s Word: "Both in One", at Martinmas, and the Devil\'s hand', /"Both in One"/.test(R.lore) && /Martinmas/.test(R.lore) && /stick covered with hairy skin/.test(R.lore) && /Elphinstone Institute/.test(R.source));
check('Evans is the source, and the working secret is put down to the horse\'s nose', /Evans, The Pattern Under the Plough \(1966\)/.test(R.source) && /horse's nose/.test(R.lore));
check('the rite itself kills nothing: the bone was left to the boy', /the old horseman left/.test(R.how) && !/kill/i.test(R.how));
const c = CALLERS.find((x) => x.id === 'toad_bone_mare');
check('a caller any time of year, working the rite', c && !c.season && !c.when && c.steps.some((s) => s.kind === 'rite' && s.rite === 'toad_bone'));
check('the practical half: a galled shoulder under a bad collar, rest, the saddler', /raw place on her shoulder/.test(c.resolution) && /galls a horse/.test(c.resolution) && /saddler/.test(c.resolution) && /Axe/.test(c.source));
check('…and a quiet hand, because a horse smells fear', /a horse has a keen nose and smells a nervous hand/.test(c.resolution) && /nervous hand/.test(c.resolution));
check('the caller is badged folk too', c.tier === 'folk');

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Stable'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Stable', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'stable'; h.accounts.stable = {}; h.playerProgress.stable = { level: 1, xp: 0 };
  h.callers.stateOf(p);
  h.accounts.stable.callers.active = { id: c.id, done: {} };
  s.emit('message', JSON.stringify({ type: 'rite_do' }));
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.stable, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'household');
  const e = ch.entries.find((x) => x.id === 'toad_bone');
  check('…and writes the Toadman\'s Bone into The House and the Hive, badged folk', e && e.met && e.tier === 'folk');
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
