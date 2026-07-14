process.env.PORT = '0';
process.env.DATA_DIR = require('os').tmpdir() + '/tc-password-test-' + process.pid;
require('fs').mkdirSync(process.env.DATA_DIR, { recursive: true });
process.env.TOWN_PASSWORD = 'secret123';

function makeMockSocket() {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {},
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i=this.sent.length-1;i>=0;i--) if (this.sent[i].type===t) return this.sent[i]; return null; }
  };
}
let pass=0, fail=0;
function check(name, cond){ if(cond){pass++;console.log('PASS -',name);} else {fail++;console.log('FAIL -',name);} }

require('../server.js');

setTimeout(() => {
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];

  const intruder = makeMockSocket();
  connHandler(intruder);
  intruder.emit('message', JSON.stringify({ type: 'join', name: 'Mallory', password: 'wrongpass' }));
  check('wrong passcode is rejected', !!intruder.lastOfType('join_error'));
  check('wrong passcode does not init a player', !intruder.lastOfType('init'));

  const friend = makeMockSocket();
  connHandler(friend);
  friend.emit('message', JSON.stringify({ type: 'join', name: 'Friend', password: 'secret123' }));
  check('correct passcode is accepted', !!friend.lastOfType('init'));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 150);
