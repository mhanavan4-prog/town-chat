// A server restart must not cost a player their place. lib/resumeCarry.js
// writes the resume stashes on the way down and reads them on the way up; this
// checks the module on its own and then the whole path through the real join
// handler, in the mock-socket style of resume.test.js.
process.env.PORT = '0';
const fs = require('fs');
const os = require('os');
const path = require('path');
process.env.DATA_DIR = fs.mkdtempSync(os.tmpdir() + '/tc-carry-test-');

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('PASS -', name); }
  else { fail++; console.log('FAIL -', name); }
}

// ── The module alone ─────────────────────────────────────────────────────
{
  const file = path.join(process.env.DATA_DIR, 'unit-carry.json');
  const carry = require('../lib/resumeCarry')({ fs, file });
  const players = new Map([
    [1, { liveResumeToken: 'tok-live', name: 'A' }],
    [2, { liveResumeToken: 'tok-bot', name: 'Bot', _synthetic: true }],
    [3, { name: 'no token yet' }],
  ]);
  const stashes = new Map([
    ['tok-parked', { expiresAt: Date.now() + 60000, stash: { name: 'Parked' } }],
    ['tok-old', { expiresAt: Date.now() - 1, stash: { name: 'Old' } }],
  ]);
  const n = carry.save(stashes, players, (p) => ({ name: p.name }), 60000);
  check('saves connected players and parked stashes, not bots or expired ones', n === 2);
  const back = new Map();
  check('loads what it saved', carry.load(back) === 2 && back.get('tok-live').stash.name === 'A' && back.get('tok-parked').stash.name === 'Parked');
  check('the file is gone once read, so a token cannot come back twice', !fs.existsSync(file));
  check('loading with no file is a quiet zero', carry.load(new Map()) === 0);
  fs.writeFileSync(file, '{not json');
  check('a damaged file is ignored and removed', carry.load(new Map()) === 0 && !fs.existsSync(file));
  check('saving an empty town leaves no file', carry.save(new Map(), new Map(), () => ({}), 1000) === 0 && !fs.existsSync(file));
}

function makeMockSocket() {
  return {
    OPEN: 1, readyState: 1, sent: [], closed: false, _handlers: {},
    on(event, cb) { this._handlers[event] = cb; },
    send(data) { this.sent.push(JSON.parse(data)); },
    close() { this.closed = true; }, terminate() { this.closed = true; }, ping() {},
    emit(event, ...args) { if (this._handlers[event]) this._handlers[event](...args); },
    lastOfType(type) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === type) return this.sent[i]; return null; },
  };
}

require('../server.js');

setTimeout(() => {
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const H = global.__testHooks;

  // A guest walks somewhere; the server goes down with them still connected.
  const a1 = makeMockSocket();
  connHandler(a1);
  a1.emit('message', JSON.stringify({ type: 'join', name: 'Carried' }));
  const init1 = a1.lastOfType('init');
  a1.emit('message', JSON.stringify({ type: 'move', x: 900, y: 1900, room: 'outside' }));
  check('the shutdown save writes the connected player', H.saveResumeCarry() >= 1);
  check('the carry file is on disk', fs.existsSync(path.join(process.env.DATA_DIR, 'resumeCarry.json')));

  // The restart: memory is gone (the old socket and its player with it), the
  // file is all that is left.
  a1.emit('close');
  H.resumeStashes.clear();
  check('the next boot reads them back', H.resumeCarry.load(H.resumeStashes) >= 1);

  const a2 = makeMockSocket();
  connHandler(a2);
  a2.emit('message', JSON.stringify({ type: 'join', resumeToken: init1.resumeToken }));
  const init2 = a2.lastOfType('init');
  check('the reconnect after a restart is a resume, not a fresh join', !!init2 && init2.resumed === true);
  const me = init2 && init2.players.find((p) => p.id === init2.id);
  check('same name, same spot', !!me && me.name === 'Carried' && me.x === 900 && me.y === 1900);
  check('exactly one copy of the character', !!init2 && init2.players.filter((p) => p.name === 'Carried').length === 1);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 1500);
