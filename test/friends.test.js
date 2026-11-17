// lib/friends.js: friends need both to agree, blocking is one-sided and quiet.
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const fs = require('fs'), path = require('path');

function world() {
  const accounts = { ada: { username: 'Ada' }, bea: { username: 'Bea' }, cyd: { username: 'Cyd' } };
  const players = new Map(); const sent = [];
  const mk = (id, name, key) => { const p = { id, name, accountKey: key || null, ws: { id } }; players.set(id, p); return p; };
  let saves = 0;
  const F = require('../lib/friends')({ accounts, players, send: (ws, m) => sent.push([ws.id, m]), placeOf: () => 'in town', levelOf: () => 7, save: () => { saves++; } });
  return { accounts, players, sent, mk, F, saves: () => saves, last: (id) => [...sent].reverse().find((e) => e[0] === id) };
}

{
  const w = world(); const ada = w.mk('1', 'Ada', 'ada'), bea = w.mk('2', 'Bea', 'bea'), guest = w.mk('3', 'Wren');
  check('a guest cannot keep friends', !!w.F.ask(guest, '1').error);
  check('nor be kept as one', /guest/.test(w.F.ask(ada, '3').error || ''));
  check('you cannot ask yourself', !!w.F.ask(ada, '1').error);
  const r = w.F.ask(ada, '2');
  check('asking does not make a friend yet', r.ok && !r.now && w.F.state(ada).friends.length === 0);
  check('the one asked is told, and sees the request', w.last('2')[1].asked === 'Ada' && w.F.state(bea).requests.join() === 'Ada');
  w.F.ask(ada, '2');
  check('asking twice leaves one request', w.F.state(bea).requests.length === 1);
  check('accepting makes it mutual', w.F.accept(bea, 'Ada').ok && w.F.state(ada).friends[0].name === 'Bea' && w.F.state(bea).friends[0].name === 'Ada' && w.F.state(bea).requests.length === 0);
  check('a friend who is in shows roughly where, not a spot', w.F.state(ada).friends[0].online === true && w.F.state(ada).friends[0].where === 'in town' && !('x' in w.F.state(ada).friends[0]));
  w.players.delete('2');
  check('a friend who is out shows as out', w.F.state(ada).friends[0].online === false && !w.F.state(ada).friends[0].where);
  check('asking by name finds an account that is not in', w.F.ask(ada, 'cyd').ok && w.accounts.cyd.social.asked.includes('ada'));
  check('removing is mutual', w.F.remove(ada, 'Bea').ok && w.F.state(ada).friends.length === 0 && w.accounts.bea.social.friends.length === 0);
  check('changes are saved', w.saves() >= 3);
}

{
  // each asks the other: the second ask is the answer
  const w = world(); const ada = w.mk('1', 'Ada', 'ada'), bea = w.mk('2', 'Bea', 'bea');
  w.F.ask(ada, '2'); const r = w.F.ask(bea, '1');
  check('asking someone who asked you makes you friends at once', r.now === true && w.F.state(ada).friends.length === 1);
  check('declining clears the request', (w.F.ask(w.mk('4', 'Cyd', 'cyd'), '1'), w.F.decline(ada, 'Cyd').ok) && w.F.state(ada).requests.length === 0);
}

{
  const w = world(); const ada = w.mk('1', 'Ada', 'ada'), bea = w.mk('2', 'Bea', 'bea'), guest = w.mk('3', 'Wren');
  w.F.ask(ada, '2'); w.F.accept(bea, 'Ada');
  check('blocking a friend ends the friendship', w.F.block(ada, '2').ok && w.F.state(ada).friends.length === 0 && w.F.state(bea).friends.length === 0);
  check('the blocker has blocked, the blocked has not', w.F.blocks(ada, bea) === true && w.F.blocks(bea, ada) === false);
  const n = w.sent.length; const r = w.F.ask(bea, '1');
  check('a request from someone blocked looks sent and goes nowhere', r.ok && !r.error && w.sent.length === n && w.F.state(ada).requests.length === 0);
  check('you must unblock before you can ask them', /Unblock/.test(w.F.ask(ada, '2').error || ''));
  check('the block list is by name, for the client to hide their chat', w.F.state(ada).blocked.join() === 'Bea');
  check('unblocking lifts it', w.F.unblock(ada, 'Bea').ok && w.F.blocks(ada, bea) === false);
  check('a guest can block for as long as she is in', w.F.block(guest, '1').ok && w.F.blocks(guest, ada) && w.F.state(guest).blocked.join() === 'Ada' && w.F.state(guest).account === false);
  check('a guest can be blocked, by name', w.F.block(ada, '3').ok && w.F.blocks(ada, guest) && !w.F.blocks(ada, bea));
  check('you cannot block yourself', !!w.F.block(ada, '1').error);
}

{
  const w = world(); const ada = w.mk('1', 'Ada', 'ada'), bea = w.mk('2', 'Bea', 'bea');
  w.F.ask(ada, '2'); w.F.accept(bea, 'Ada'); w.sent.length = 0;
  w.F.presence(bea, true);
  check('a friend coming in is told to her friends who are in', w.sent.length === 1 && w.sent[0][0] === '1' && /Bea has come in/.test(w.sent[0][1].note));
  w.sent.length = 0; w.F.presence(bea, false);
  check('and going out shows her as out', w.sent.length === 1 && w.sent[0][1].friends[0].online === false);
}

{
  const srv = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  check('a whisper to someone who blocked you is echoed to you and not delivered', /if \(wt && friends\.blocks\(wt, player\)\) \{[\s\S]{0,260}outgoing: true \}\);\s*return;/.test(srv));
  check('a party invite to someone who blocked you goes nowhere', /if \(friends\.blocks\(target, player\)\) return;\s*\/\/ blocked by them: the invite goes nowhere/.test(srv));
  check('a coven invite to someone who blocked you looks carried', /if \(friends\.blocks\(target, player\)\) \{ send\(ws, \{ type: 'coven_error', message: `Invitation carried to/.test(srv));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
