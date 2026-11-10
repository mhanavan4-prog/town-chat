// The Board points a new witch to the old places in the Wilds: callers_state
// carries the four, where each is, what to do there, and whether this account
// has done it; the Board draws them as a card under the callers.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-wptr-');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });
function makeMockSocket(tag) {
  return { OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag, on(e, cb) { this._handlers[e] = cb; }, send(d) { this.sent.push(JSON.parse(d)); }, emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); }, lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; } };
}
const board = require('fs').readFileSync(__dirname + '/../client/board.js', 'utf8');
check('the Board draws the places as a card, and says where else to find them', /Out past the portal, in the Wilds/.test(board) && /on the map \(M\) in the Wilds, and in the Charm Book under Drawn & Walked/.test(board));
require('../server.js');
setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const say = (s, m) => s.emit('message', JSON.stringify(m));
  const s = makeMockSocket('Newcomer'); connHandler(s);
  say(s, { type: 'join', name: 'Newcomer', charId: 0 });
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'wptr_a'; h.accounts.wptr_a = {};
  say(s, { type: 'callers_state' });
  const pl = s.lastOfType('callers_state').places;
  check('four places, each with where and what, none done yet', Array.isArray(pl) && pl.length === 4 && pl.every((x) => x.where && x.what && x.done === false) && pl.map((x) => x.key).join() === 'shepherds_race,clootie,crick_stone,nine_and_twenty');
  check('where each is matches the Wilds', /east of the portal/.test(pl[0].where) && /west of the portal/.test(pl[1].where) && /north of the portal/.test(pl[2].where) && /north-west/.test(pl[3].where));
  Object.assign(h.accounts.wptr_a, { troyTown: { runs: 1 }, menAnTol: { crawls: 1 }, countless: { beaten: 1 } });
  h.accounts.wptr_a.callers = Object.assign(h.accounts.wptr_a.callers || {}, { byId: { clootie: 1 } });
  say(s, { type: 'callers_state' });
  check('done once the account has run, tied, crawled and counted', s.lastOfType('callers_state').places.every((x) => x.done), s.lastOfType('callers_state').places);
  const g = makeMockSocket('Guest'); connHandler(g);
  say(g, { type: 'join', name: 'Guest', charId: 0 });
  say(g, { type: 'callers_state' });
  check('a guest gets no card (the callers page is closed to guests anyway)', !g.lastOfType('callers_state').places);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
