// New-player funnel gaps: the welcome-card choice, Chapter 1 STARTS (not just
// completions), and a first trip to the Wilds. Drives the real ws handlers and
// reads the day's analytics counters.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-funnel-');

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

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const A = h.analytics;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const g = (m) => (A.data[A.day()] && A.data[A.day()][m]) || 0;
  function join(tag, ip) {
    const s = makeMockSocket(tag); connHandler(s); s._ip = ip;
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: 0 }));
    return { s, p: h.players.get(s.lastOfType('init').id) };
  }
  const send = (s, m) => s.emit('message', JSON.stringify(m));

  // ── Welcome choice: counted once per session, junk ignored ──
  const a = join('Newbie', '10.1.0.1');
  send(a.s, { type: 'welcome_choice', choice: 'begin' });
  send(a.s, { type: 'welcome_choice', choice: 'begin' });
  send(a.s, { type: 'welcome_choice', choice: 'explore' });
  check('welcome begin counted once', g('welcome.begin') === 1, g('welcome.begin'));
  check('a second choice in the same session is ignored', g('welcome.explore') === 0, g('welcome.explore'));
  const b = join('Wanderer', '10.1.0.2');
  send(b.s, { type: 'welcome_choice', choice: 'nonsense' });
  check('an unknown choice is not counted', !Object.keys(A.data[A.day()] || {}).includes('welcome.nonsense'));
  send(b.s, { type: 'welcome_choice', choice: 'explore' });
  check('explore counted', g('welcome.explore') === 1, g('welcome.explore'));

  // ── Chapter 1 start ──
  const startBefore = g('chapter.begin');
  send(a.s, { type: 'story_begin' });
  check('story_begin bumps chapter.begin', g('chapter.begin') === startBefore + 1, g('chapter.begin'));
  check('a guest starting Chapter 1 records guest.began1', g('guest.began1') === 1, g('guest.began1'));
  send(a.s, { type: 'story_begin' }); // already active → no new start
  check('re-sending story_begin while active does not double count', g('guest.began1') === 1 && g('chapter.begin') === startBefore + 1);

  // ── First trip to the Wilds ──
  const W = h.WORLD2 || { width: 2000, height: 2000 };
  send(b.s, { type: 'move', room: 'wilds', x: (W.width || 2000) / 2, y: (W.height || 2000) / 2, facing: 0 });
  check('entering the Wilds records guest.wilds', g('guest.wilds') === 1, { wilds: g('guest.wilds'), room: b.p.room });
  send(b.s, { type: 'move', room: 'outside', x: 500, y: 500, facing: 0 });
  send(b.s, { type: 'move', room: 'wilds', x: (W.width || 2000) / 2, y: (W.height || 2000) / 2, facing: 0 });
  check('a second Wilds trip in the session is not recounted', g('guest.wilds') === 1, g('guest.wilds'));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
