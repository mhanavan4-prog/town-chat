// A party outlives a dropped connection and a restart: the resume stash
// carries which party a player was in, and coming back puts them in it again.
process.env.PORT = '0';
const fs = require('fs');
const os = require('os');
process.env.DATA_DIR = fs.mkdtempSync(os.tmpdir() + '/tc-party-test-');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
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
  const join = (payload) => { const s = makeMockSocket(); connHandler(s); s.emit('message', JSON.stringify({ type: 'join', ...payload })); return s; };

  const a = join({ name: 'Leadwen' }), b = join({ name: 'Follwen' }), c = join({ name: 'Thirdwen' });
  const ia = a.lastOfType('init'), ib = b.lastOfType('init'), ic = c.lastOfType('init');
  a.emit('message', JSON.stringify({ type: 'party_invite', targetId: ib.id }));
  b.emit('message', JSON.stringify({ type: 'party_invite_accept' }));
  a.emit('message', JSON.stringify({ type: 'party_invite', targetId: ic.id }));
  c.emit('message', JSON.stringify({ type: 'party_invite_accept' }));
  const p0 = a.lastOfType('party_state');
  check('three in a party, led by the one who made it', !!p0 && p0.members.length === 3 && p0.leaderId === ia.id);

  // One drops and comes back: the others never stopped being a party.
  b.emit('close');
  check('the others see her go', a.lastOfType('party_state').members.length === 2);
  const b2 = join({ resumeToken: ib.resumeToken });
  const ib2 = b2.lastOfType('init');
  check('she resumes', !!ib2 && ib2.resumed === true);
  const p1 = a.lastOfType('party_state');
  check('and is back in the same party', p1.partyId === p0.partyId && p1.members.length === 3 && p1.members.some((m) => m.name === 'Follwen') && p1.leaderId === ia.id);
  check('she is told so too', !!b2.lastOfType('party_state') && b2.lastOfType('party_state').members.length === 3);

  // Everyone gone at once (a restart, or the whole party's connection dropping): the party is gone with them.
  check('the restart save carries the party', H.saveResumeCarry() >= 3 && /"party":\{"id":/.test(fs.readFileSync(process.env.DATA_DIR + '/resumeCarry.json', 'utf8')));
  a.emit('close'); b2.emit('close'); c.emit('close');
  const c2 = join({ resumeToken: ic.resumeToken });
  check('the first one back opens the party again, alone for now', !!c2.lastOfType('init') && c2.lastOfType('init').resumed === true && c2.lastOfType('party_state').members.length === 1);
  const a2 = join({ resumeToken: ia.resumeToken });
  const b3 = join({ resumeToken: ib2.resumeToken });
  const p2 = b3.lastOfType('party_state');
  check('the rest find it under its old id', !!p2 && p2.partyId === p0.partyId && p2.members.length === 3);
  check('and the one who led it leads it again', p2.leaderId === a2.lastOfType('init').id);

  // No party, nothing carried.
  const solo = join({ name: 'Onlywen' }); const is = solo.lastOfType('init');
  solo.emit('close');
  const solo2 = join({ resumeToken: is.resumeToken });
  check('someone in no party comes back in no party', solo2.lastOfType('init').resumed === true && !solo2.lastOfType('party_state'));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 1500);
