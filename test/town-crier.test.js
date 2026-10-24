// Town Crier: real-player milestones become a persisted, broadcast highlight
// reel. Drives the real noteMilestone / townfeedPush path and asserts the feed
// captures the marquee milestones, dedupes, and goes out to connected players.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-crier-');

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
    countOfType(t) { return this.sent.filter(m => m.type === t).length; },
  };
}
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  function join(tag, charId) {
    const s = makeMockSocket(tag); connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: charId || 0 }));
    const p = h.players.get(s.lastOfType('init').id);
    return { s, p };
  }

  try {
    check('townfeed is exposed', h.townfeed && typeof h.townfeed.recent === 'function');

    // An account-backed player who reaches a milestone should shout to the feed.
    const a = join('Mordra');
    a.p.accountKey = 'mordra';
    h.accounts['mordra'] = h.accounts['mordra'] || { miles: {} };

    // A second connected player to receive the live broadcast.
    const watcher = join('Thistle');
    watcher.s.sent.length = 0;

    h.noteMilestone(a.p, 'lvl5');
    let top = h.townfeed.recent(5)[0];
    check('lvl5 milestone lands in the feed', top && /Mordra reached level 5/.test(top.text), top);
    check('feed add is broadcast to other players', !!watcher.s.lastOfType('town_feed_add'), watcher.s.countOfType('town_feed_add'));

    // Once-ever: firing the same milestone again must NOT duplicate the shout.
    const before = h.townfeed.recent(40).length;
    h.noteMilestone(a.p, 'lvl5');
    check('repeat milestone does not duplicate', h.townfeed.recent(40).length === before, { before, after: h.townfeed.recent(40).length });

    // A chapter milestone is captured with its number.
    h.noteMilestone(a.p, 'chapter3');
    top = h.townfeed.recent(5)[0];
    check('chapter milestone lands with its number', top && /Mordra completed chapter 3/.test(top.text), top);

    // A minor milestone (lvl2) must NOT reach the feed (noise control).
    const n1 = h.townfeed.recent(40).length;
    h.noteMilestone(a.p, 'lvl2');
    check('lvl2 is not shouted', h.townfeed.recent(40).length === n1, { n1, after: h.townfeed.recent(40).length });

    // A fresh join receives the feed history in its init.
    const late = join('Bram');
    check('init carries townFeed history', Array.isArray(late.s.lastOfType('init').townFeed) && late.s.lastOfType('init').townFeed.length >= 2, late.s.lastOfType('init').townFeed);

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}, 300);
