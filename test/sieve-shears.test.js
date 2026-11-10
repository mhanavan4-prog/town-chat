// The sieve and shears: a seventh reading kind, worked right on the Town Board
// by naming a caller's suspects until the sieve turns at one.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-sieve-');
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

const c = CALLERS.find((x) => x.id === 'silver_spoons');
check('the sieve is a reading kind', READING_KINDS.includes('sieve'));
check('Mistress Hale brings the silver spoons, with three named suspects', c && c.steps[0].kind === 'sieve' && c.steps[0].suspects.length === 3);
check('the lore quotes Jonson exactly and cites Keith Thomas', c && /searching for things lost, with a sieve and shears/.test(c.lore) && /Alchemist \(1610\)/.test(c.source) && /Thomas, Religion and the Decline of Magic \(1971\)/.test(c.source) && c.tier === 'record');
check('the resolution accuses nobody on the sieve\'s word', c && /don't hand anyone to the constable/.test(c.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Turner'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Turner', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'turner'; h.accounts.turner = {}; h.playerProgress.turner = { level: 1, xp: 0 };
  const say = (m) => s.emit('message', JSON.stringify(m));
  const suspects = c.steps[0].suspects;

  say({ type: 'sieve_turn', name: suspects[0] });
  check('no working in hand, no sieve', /no working in hand/.test((s.lastOfType('caller_error') || {}).message || ''));

  h.callers.stateOf(p); // make the state
  h.accounts.turner.callers.active = { id: 'silver_spoons', done: {} };
  const view = () => h.callers.callersStatePayload(p).active.steps[0];
  check('the Board shows the suspects to name', JSON.stringify(view().suspects) === JSON.stringify(suspects));

  say({ type: 'sieve_turn', name: 'the vicar' });
  check('a name the caller didn\'t give is refused', /Name one of those/.test((s.lastOfType('caller_error') || {}).message || ''));

  // Name them in order until it turns.
  let turned = null, still = [];
  for (const n of suspects) {
    if (turned) break;
    const before = s.sent.length;
    say({ type: 'sieve_turn', name: n });
    if (view().done) turned = n;
    else { still.push(n); check(`naming ${n}: the sieve hangs still`, s.sent.slice(before).some((m) => m.type === 'toast' && /hangs still/.test(m.message)) && view().tried.includes(n)); }
  }
  check('the sieve turns at exactly one name', !!turned);
  check('the step records whose name it turned at', view().note === `The sieve turned at the name of ${turned}.`, view().note);
  check('…and the Board crosses off the names that left it still', JSON.stringify(view().tried) === JSON.stringify(still));

  // The same working again for the same account turns at the same name.
  h.accounts.turner.callers.active = { id: 'silver_spoons', done: {} };
  for (const n of suspects) { if (!view().done) say({ type: 'sieve_turn', name: n }); }
  check('it turns at the same name for the same account (no fishing for another answer)', view().note === `The sieve turned at the name of ${turned}.`);

  // Naming a name twice does nothing new.
  h.accounts.turner.callers.active = { id: 'silver_spoons', done: {} };
  const first = suspects.find((n) => n !== turned);
  say({ type: 'sieve_turn', name: first });
  const n1 = s.sent.length;
  say({ type: 'sieve_turn', name: first });
  check('naming the same suspect twice changes nothing', !s.sent.slice(n1).some((m) => m.type === 'toast') && view().tried.length === 1);

  // Another account may see it turn elsewhere — it's per account.
  const others = new Set();
  for (let k = 0; k < 12; k++) {
    const key = 'turner' + k;
    p.accountKey = key; h.accounts[key] = {}; h.callers.stateOf(p);
    h.accounts[key].callers.active = { id: 'silver_spoons', done: {} };
    for (const n of suspects) { if (!h.callers.callersStatePayload(p).active.steps[0].done) say({ type: 'sieve_turn', name: n }); }
    others.add(h.callers.callersStatePayload(p).active.steps[0].note);
  }
  check('across accounts the sieve does not always accuse the same one', others.size > 1, [...others]);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
