// The Nine-and-Twenty: a stone circle in the Wilds that, the record says, no
// one counts the same twice. You count it by eye, twice; the server knows the
// true number (it does not cheat) and says whether your counts agree and are
// right. The belief is record (Sidney, Carew, Fiennes); the bakers and the
// illness are later folk tales; the Long Meg "true count wakes the coven"
// story is left out, undated.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-count-');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });
function makeMockSocket(tag) {
  return { OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag, on(e, cb) { this._handlers[e] = cb; }, send(d) { this.sent.push(JSON.parse(d)); }, emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); }, lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; } };
}
const fs = require('fs');
const C = require('../data/countlessStones');
const N = C.COUNTLESS_N;
check('the ring has a fixed number of stones, and it is not twenty-nine', N === C.COUNTLESS_STONES.length && N !== 29);
check('standing, fallen and low stones, so counting by eye is honest work', ['s', 'f', 'l'].every((k) => C.COUNTLESS_STONES.some(([, t]) => t === k)));
check('the stones go round the ring once, no two in the same place', C.COUNTLESS_STONES.every(([d], i, a) => d >= 0 && d < 360 && (i === 0 || d > a[i - 1][0])));
check('two different counts: never twice alike, in Carew\'s words', C.countlessVerdict(30, 32).key === 'unlike' && /'a redoubled numbring neuer eueneth with the first'/.test(C.countlessVerdict(30, 32).text));
check('twice alike but wrong: told to look again, the number not given away', C.countlessVerdict(29, 29).key === 'alike_wrong' && !new RegExp('\\b' + N + '\\b').test(C.countlessVerdict(29, 29).text));
check('twice alike and right: the record beaten, in Sidney\'s words', C.countlessVerdict(N, N).key === 'beaten' && /'Can count them just'/.test(C.countlessVerdict(N, N).text));
check('lore: Sidney, Carew (the Hurlers, and men turned to stone for hurling on the Sabbath), Fiennes at Stonehenge and Long Meg 1698', /'neither any eye \/ Can count them just'/.test(C.COUNTLESS_LORE) && /'once they were men, and for their hurling vpon the Sabboth, so metamorphosed'/.test(C.COUNTLESS_LORE) && /'none Can Count them twice alike'/.test(C.COUNTLESS_LORE) && /'they affirme they Cannot be Counted twice alike as is the story of Stonidge'/.test(C.COUNTLESS_LORE));
check('the later tales are dated as such: the baker in Folk-Lore 1902, Stanton Drew via English Heritage', /'placing a loaf on each stone' \(Folk-Lore, 1902\)/.test(C.COUNTLESS_LORE) && /recorded by John Wood in 1749/.test(C.COUNTLESS_LORE));
check('no coven woken by a true count: that story is undated, so it is not here', !/coven|Michael Scot/i.test(C.COUNTLESS_LORE));
check('one plain line, folded under the count: protected, don\'t climb, take nothing; the sources still name Historic England and English Heritage', /protected monuments/.test(C.COUNTLESS_NOTE) && /don't climb/.test(C.COUNTLESS_NOTE) && /take a chip away/.test(C.COUNTLESS_NOTE) && C.COUNTLESS_NOTE.split(/\s+/).length <= 25 && !('COUNTLESS_PRACTICAL' in C) && /Historic England/.test(C.COUNTLESS_SOURCE));
const X = C.COUNTLESS.x, Y = C.COUNTLESS.y, R = C.COUNTLESS.radius;
check('clear of the clootie well, the Crick-stone, the Shepherd\'s Race and the portal, and inside the ring no tree is scattered into', Math.hypot(X - 4400, Y - 8200) > R + 200 && Math.hypot(X - 5100, Y - 7800) > R + 300 && Math.hypot(X - 5600, Y - 8400) > R + 445 && Math.hypot(X - 5000, Y - 8800) + R < 1300);
const scene = fs.readFileSync(__dirname + '/../client/wilds-scene.js', 'utf8'), main = fs.readFileSync(__dirname + '/../client/main.js', 'utf8');
check('the Wilds draws the ring and puts the counting stone outside it', /makeCountlessRing\(w2\.countless, WILDS_WALLS(, KK)?\)/.test(scene) && /npc: 'count_stones'/.test(scene) && /kiosk\.npc === 'count_stones'\) \{ _countStones\.open/.test(main));

require('../server.js');
setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const say = (s, m) => s.emit('message', JSON.stringify(m));
  const init = (() => { const s = makeMockSocket('g'); connHandler(s); say(s, { type: 'join', name: 'g', charId: 0 }); return s.lastOfType('init'); })();
  check('the Wilds the client is sent carries the ring and its lore', init.world2 && init.world2.countless && init.world2.countless.stones.length === N && /Carew/.test(init.world2.countless.lore));
  const s = makeMockSocket('Counter'); connHandler(s);
  say(s, { type: 'join', name: 'Counter', charId: 0 });
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'count_a'; h.accounts.count_a = {};
  say(s, { type: 'count_stones', n: 30 });
  check('counting from the town is refused', /at the ring itself/.test(s.lastOfType('count_stones_result').text));
  p.room = 'wilds'; p.x = X; p.y = Y + R + 50;
  say(s, { type: 'count_stones', n: 30 });
  check('a first count is taken, and you are sent round again', s.lastOfType('count_stones_result').stage === 'first' && /count them again/.test(s.lastOfType('count_stones_result').text));
  say(s, { type: 'count_stones', n: 32 });
  check('a second that differs: never twice alike', s.lastOfType('count_stones_result').verdict === 'unlike');
  say(s, { type: 'count_stones', n: N }); say(s, { type: 'count_stones', n: N });
  const r = s.lastOfType('count_stones_result');
  check('twice alike and right: beaten, XP once today, counted', r.verdict === 'beaten' && r.xp === 30 && h.accounts.count_a.countless.beaten === 1);
  say(s, { type: 'count_stones', n: N }); say(s, { type: 'count_stones', n: N });
  check('…a second time the same day counts but pays nothing more', s.lastOfType('count_stones_result').xp === 0 && h.accounts.count_a.countless.beaten === 2);
  say(s, { type: 'count_stones', n: 'lots' });
  check('nonsense is refused', /as a number/.test(s.lastOfType('count_stones_result').text));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
