// Charm Book notices: doing something that writes a new entry says so, once;
// what was already in the book when the account first arrived is noted quietly.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-charmtoast-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
  };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

require('../server.js');

setTimeout(async () => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Noter'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Noter', charId: 0 }));
  const init = s.sent.find((m) => m.type === 'init');
  const p = h.players.get(init.id);
  p.accountKey = 'noter';
  h.accounts.noter = { ogham: { carved: ['beith'] } }; // already in the book before the feature existed
  h.playerProgress.noter = { level: 1, xp: 0 };
  const say = (m) => s.emit('message', JSON.stringify(m));
  const bookToasts = () => s.sent.filter((m) => m.type === 'toast' && /Charm Book/.test(m.message || ''));

  // Arriving: what's already met is noted, silently.
  check('the first look notes the backlog without a word', h.charmBookNotice(p) === null && bookToasts().length === 0);
  check('…and remembers it', h.accounts.noter.charmNoted.includes('ogham:beith'), h.accounts.noter.charmNoted);

  // Tie a wind and loose a knot through the real handlers.
  const inv = h.getInventory(p);
  h.addItemToAccount(inv, 'hemp_cord', 1);
  p.room = 'outside';
  say({ type: 'tie_wind_cord' });
  await wait(600);
  check('tying a cord alone writes nothing new', bookToasts().length === 0, bookToasts());
  say({ type: 'untie_knot', knots: 3 });
  await wait(600);
  const t1 = bookToasts();
  check('loosing a knot writes it into the book, and says so', t1.length === 1 && /^📜 Written in your Charm Book: The first knot/.test(t1[0].message), t1.map((m) => m.message));
  check('notices are marked to show on screen whatever the notice setting', t1.length === 1 && t1[0].always === true);
  check('the first notice tells you where the book is', t1.length === 1 && /Menu → 📜 Charm Book/.test(t1[0].message), t1[0] && t1[0].message);

  // The same thing again: nothing new, no toast.
  say({ type: 'cords_state' });
  await wait(600);
  check('nothing new, no notice', bookToasts().length === 1);

  // A second new entry: noticed, without repeating where the book is.
  h.accounts.noter.leavesSeen = ['anchor'];
  say({ type: 'cords_state' });
  await wait(600);
  const t2 = bookToasts();
  check('a second new entry gets its own notice', t2.length === 2 && /An anchor/.test(t2[1].message), t2.map((m) => m.message));
  check('…without repeating the directions', t2.length === 2 && !/Menu →/.test(t2[1].message));

  // Several at once collapse into one line.
  h.accounts.noter.ogham.carved.push('luis', 'fearn', 'sail');
  say({ type: 'cords_state' });
  await wait(600);
  const t3 = bookToasts();
  check('several new entries make one notice, with a count', t3.length === 3 && /and 2 more/.test(t3[2].message), t3.map((m) => m.message));

  // Movement never triggers a check.
  const before = bookToasts().length;
  h.accounts.noter.leavesSeen.push('bell');
  say({ type: 'move', x: p.x, y: p.y });
  await wait(600);
  check('moving about doesn\'t check the book', bookToasts().length === before);

  // Guests never get notices.
  const g = makeMockSocket('Guest'); connHandler(g);
  g.emit('message', JSON.stringify({ type: 'join', name: 'Guest', charId: 0 }));
  g.emit('message', JSON.stringify({ type: 'cords_state' }));
  await wait(600);
  check('a guest gets no Charm Book notices', !g.sent.some((m) => m.type === 'toast' && /Charm Book/.test(m.message || '')));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
