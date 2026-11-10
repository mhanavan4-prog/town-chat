// The ABRACADABRA slip, written by the player: the ague caller's step is no
// longer only told — you write the word, then each line beneath it with the
// last letter taken off, as Serenus set it down ("detrahe summam … donec in
// angustum redigatur littera conum"), and the server checks every line.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-abra-');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
  };
}

const { SCRIBINGS } = require('../data/charms');
const { CALLERS, READING_KINDS } = require('../data/callers');
const S = SCRIBINGS.abracadabra;
check('eleven lines, from the whole word down to A', S.lines.length === 11 && S.lines[0] === 'ABRACADABRA' && S.lines[10] === 'A');
check('each line is the one above with its last letter taken off', S.lines.every((l, i) => i === 0 || l === S.lines[i - 1].slice(0, -1)));
const ague = CALLERS.find((c) => c.id === 'ague');
check('the ague caller asks you to write it', ague.steps.some((s) => s.kind === 'scribe' && s.charm === 'abracadabra') && READING_KINDS.includes('scribe'));
check('…and the lore has Defoe on the plague-year triangles', /'the word Abracadabra, formed in triangle or pyramid'/.test(ague.lore) && /'with these hellish charms and trumpery hanging about their necks'/.test(ague.lore) && /Journal of the Plague Year \(1722\)/.test(ague.source));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const say = (s, m) => s.emit('message', JSON.stringify(m));
  const s = makeMockSocket('Scribe'); connHandler(s);
  say(s, { type: 'join', name: 'Scribe', charId: 0 });
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'abra_a'; h.accounts.abra_a = {};
  h.accounts.abra_a.callers = { day: Math.floor(Date.now() / 86400000), served: [], active: { id: 'ague', done: {} }, total: 0, byId: {} };
  const idx = ague.steps.findIndex((x) => x.kind === 'scribe');
  const view = () => { say(s, { type: 'callers_state' }); const st = s.lastOfType('callers_state'); return st && st.active && st.active.steps[idx]; };
  let v = view();
  check('the board shows the slip to write, nothing yet written', v && v.kind === 'scribe' && v.written === 0 && v.scribe.lines.length === 11 && !v.done);

  s.sent.length = 0;
  say(s, { type: 'scribe_line', text: 'ABRACADAB' });
  check('you begin with the whole word', /whole word/.test((s.lastOfType('caller_error') || {}).message || '') && view().written === 0);
  say(s, { type: 'scribe_line', text: 'abracadabra' });
  check('…in any case, any spacing', view().written === 1);
  s.sent.length = 0;
  say(s, { type: 'scribe_line', text: 'BRACADABRA' });
  check('dropping the first letter is not Serenus\'s way', /last letter taken off/.test((s.lastOfType('caller_error') || {}).message || '') && view().written === 1);
  for (const ln of S.lines.slice(1)) say(s, { type: 'scribe_line', text: ln.split('').join(' ') });
  v = view();
  check('eleven lines and the step is done, bound with linen', v.done && /linen/.test(v.note), v);
  check('the account remembers the charm', (h.accounts.abra_a.charmsSaid || []).includes('abracadabra'));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
