// Found in a live playtest: finishing the Bath tablet or Caerdroia put the
// step's one-line note in place of the work, so the player never saw the
// finished labyrinth or the tablet as written. The step now keeps them: the
// server keeps the tablet's lines, the joins were kept already, and the Board
// draws both when the step is done.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-fin-');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });
function makeMockSocket(tag) {
  return { OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag, on(e, cb) { this._handlers[e] = cb; }, send(d) { this.sent.push(JSON.parse(d)); }, emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); }, lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; } };
}
const fs = require('fs');
const board = fs.readFileSync(__dirname + '/../client/board.js', 'utf8'), troy = fs.readFileSync(__dirname + '/../client/troy.js', 'utf8');
check('the Board draws a done Caerdroia and a done tablet, before the plain note', board.indexOf("s.done && s.kind === 'troy'") > 0 && board.indexOf("s.done && s.kind === 'tablet'") > 0 && board.indexOf("s.done && s.kind === 'troy'") < board.indexOf('} else if (s.done && s.note) {'));
check('a finished labyrinth has no loose ends to tap, no key panel, and says so', /if \(used\.has\(i\) \|\| done\) return/.test(troy) && /if \(!done\) \{\n    const kb/.test(troy) && /All eight walls drawn/.test(troy));

require('../server.js');
setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const say = (s, m) => s.emit('message', JSON.stringify(m));
  function as(key, id) {
    const s = makeMockSocket(key); connHandler(s);
    say(s, { type: 'join', name: key, charId: 0 });
    const p = h.players.get(s.lastOfType('init').id);
    p.accountKey = key; h.accounts[key] = { callers: { day: Math.floor(Date.now() / 86400000), served: [], active: { id, done: {} }, total: 0, byId: {} } };
    return { s, view: () => { say(s, { type: 'callers_state' }); return s.lastOfType('callers_state').active.steps[0]; } };
  }
  const t = as('fin_t', 'bath_cloak');
  check('before it is written, the tablet has no finished text', t.view().tablet.written === null);
  say(t.s, { type: 'tablet_write', parts: ['suli_minervae', 'name', 'dono', 'sanitatem', 'si_vir', 'nissi'], backwards: 'lines' });
  const tv = t.view();
  check('written, the step keeps the tablet\'s six lines as written (each line backwards)', tv.done && Array.isArray(tv.tablet.written) && tv.tablet.written.length === 6 && tv.tablet.written[0] === 'eavreniM iluS eaed', tv.tablet);
  const r = as('fin_r', 'caerdroia');
  for (let k = 0; k < 8; k++) say(r.s, { type: 'troy_join', a: 8 - k, b: (9 + k) % 16 });
  const rv = r.view();
  check('drawn, the step keeps all eight walls and the hand they turn', rv.done && rv.troy.joins.length === 8 && rv.troy.hand === 'right');
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
