// The key and Bible: the other old ordeal for finding a thief, worked on the
// Board like the sieve — the suspects named until the key turns at one.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-keybible-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { CALLERS, READING_KINDS } = require('../data/callers.js');
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

const c = CALLERS.find((x) => x.id === 'cheese_and_herrings');
check('the key is a reading kind', READING_KINDS.includes('key'));
check('Rab Ferguson brings the stolen sack, with three named suspects', c && c.steps[0].kind === 'key' && c.steps[0].suspects.length === 3);
check('the lore quotes Psalm 50:18 (KJV) exactly', c && /When thou sawest a thief, then thou consentedst with him/.test(c.lore));
check('…cites Tylor 1871 and Brewer, and the 1697 Cummertrees case', c && /Tylor, Primitive Culture \(1871\)/.test(c.source) && /Brewer/.test(c.source) && /1697 Cummertrees/.test(c.source) && /William M'Kinnell only/.test(c.lore) && c.tier === 'record');
check('the resolution accuses nobody on the key\'s word', c && /don't take the key's word/.test(c.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Reader'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Reader', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'reader'; h.accounts.reader = {}; h.playerProgress.reader = { level: 1, xp: 0 };
  const say = (m) => s.emit('message', JSON.stringify(m));
  const suspects = c.steps[0].suspects;
  h.callers.stateOf(p);
  h.accounts.reader.callers.active = { id: 'cheese_and_herrings', done: {} };
  const view = () => h.callers.callersStatePayload(p).active.steps[0];
  check('the Board shows the suspects for the key', JSON.stringify(view().suspects) === JSON.stringify(suspects));

  say({ type: 'sieve_turn', name: suspects[0] });
  check('a sieve can\'t be turned for a key-and-Bible working', /no sieve/.test((s.lastOfType('caller_error') || {}).message || '') && !view().done);

  let turned = null;
  for (const n of suspects) {
    if (turned) break;
    const before = s.sent.length;
    say({ type: 'key_turn', name: n });
    if (view().done) turned = n;
    else check(`naming ${n}: the key hangs still, and the psalm is read`, s.sent.slice(before).some((m) => m.type === 'toast' && /When thou sawest a thief/.test(m.message) && /hangs still/.test(m.message)));
  }
  check('the key turns at exactly one name, recorded on the step', !!turned && view().note === `The key turned in the Bible at the name of ${turned}.`, view().note);

  h.accounts.reader.callers.active = { id: 'cheese_and_herrings', done: {} };
  for (const n of suspects) { if (!view().done) say({ type: 'key_turn', name: n }); }
  check('the same account, the same name again', view().note === `The key turned in the Bible at the name of ${turned}.`);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
