// The Crick-stone: a Mên-an-Tol in the Wilds, crawled through nine times
// against the sun (Hunt 1865, Bottrell 1873): through the hole from the south
// and back round the stones by the west. Back by the east is with the sun and
// starts the count again. Run through the game's own move handler.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-men-');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });
function makeMockSocket(tag) {
  return { OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag, on(e, cb) { this._handlers[e] = cb; }, send(d) { this.sent.push(JSON.parse(d)); }, emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); }, lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; } };
}
const fs = require('fs');
const M = require('../data/menAnTol');
const X = M.MEN_AN_TOL.x, Y = M.MEN_AN_TOL.y;
// A path through waypoints, a step every 10 units (a player sends a move about every 11).
const path = (wps) => { const out = []; for (let k = 1; k < wps.length; k++) { const [a, b] = [wps[k - 1], wps[k]]; const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 10); for (let s = 0; s < n; s++) out.push([a[0] + (b[0] - a[0]) * s / n, a[1] + (b[1] - a[1]) * s / n]); } out.push(wps[wps.length - 1]); return out; };
const W = (u, v) => [X + u, Y + v];
const loopWest = path([W(0, 80), W(0, -80), W(-260, -80), W(-260, 80), W(0, 80)]);
const loopEast = path([W(0, 80), W(0, -80), W(260, -80), W(260, 80), W(0, 80)]);
const run = (pts, st = null) => { const ev = []; for (const [x, y] of pts) { const r = M.menAnTolStep(st, x, y); st = r.st; if (r.event) ev.push(r.event); } return { st, ev }; };

// ── The count, against the sun ───────────────────────────────────────────────
let r = run(loopWest);
check('through from the south and back by the west: one', r.ev.join(',') === 'through' && r.st.count === 1);
let all = []; let st = null; for (let k = 0; k < 9; k++) { const q = run(loopWest, st); st = q.st; all.push(...q.ev); }
check('nine times round: eight throughs, then done', all.filter((e) => e === 'through').length === 8 && all[all.length - 1] === 'done');
r = run([...loopWest, ...loopWest, ...loopEast]);
check('back by the east is with the sun, and the count starts again', r.ev.join(',') === 'through,through,through,sunwise' && r.st.count === 0);
r = run(path([W(0, -80), W(0, 80)]), run(path([W(-260, -80)])).st);
check('through from the north is the wrong way, and counts nothing', r.ev.join(',') === 'wrongway' && r.st.count === 0);
r = run(path([W(0, 80), W(-260, 80), W(-260, -80), W(0, -80), W(0, 80)]));
check('round the stones without crawling through counts nothing', !r.ev.includes('through') && !r.ev.includes('done'));
check('walking off forgets the crawl', M.menAnTolStep({ side: 'S', count: 5, expect: 'through' }, X + 900, Y).st === null);
check('the hole is wide enough for a player (28 across), the stone is walled either side', M.MEN_HOLE * 2 > 28 + 8 && M.MEN_STONE > M.MEN_HOLE);

// ── The words ────────────────────────────────────────────────────────────────
check('Hunt\'s "nine times against the sun" and Bottrell\'s "crameing" and "backen a disease"', /'Through this the sufferer was drawn nine times against the sun—or, if a man, he was to crawl through the hole nine times\.'/.test(M.MEN_AN_TOL_LORE) && /crameing \(crawling on all fours\) nine times through the hole in the centre stone, going against the sun's course/.test(M.MEN_AN_TOL_LORE) && /'going against the sun will backen a disease'/.test(M.MEN_AN_TOL_LORE));
check('the count is not settled: Hunt 1903\'s "three times" is there too', /three times, and then drawn on the grass three times against the sun/.test(M.MEN_AN_TOL_LORE) && /the count is not settled/.test(M.MEN_AN_TOL_LORE));
check('the brass pins from Hunt 1903, and the game says the answer is chance', /'If two brass pins are carefully laid across each other/.test(M.MEN_AN_TOL_PINS) && /whether the pins stir is chance/.test(M.MEN_AN_TOL_PINS));
check('done, the stone keeps to its own lore (Bottrell, Borlase); one plain line, folded, says the real one is protected; no NHS, no symptoms', /Bottrell had it/.test(M.MEN_AN_TOL_DONE) && /'many persons who had crept through this hole'/.test(M.MEN_AN_TOL_DONE) && /protected monument/.test(M.MEN_AN_TOL_NOTE) && M.MEN_AN_TOL_NOTE.split(/\s+/).length <= 25 && !('MEN_AN_TOL_PRACTICAL' in M) && !/NHS|numbness|genital|vitamin/i.test(M.MEN_AN_TOL_DONE + M.MEN_AN_TOL_NOTE + M.MEN_AN_TOL_SOURCE));
const scene = fs.readFileSync(__dirname + '/../client/wilds-scene.js', 'utf8'), props = fs.readFileSync(__dirname + '/../client/props-menantol.js', 'utf8');
check('the Wilds draws it, walls the stone either side of the hole, and its lore stone reads like a waymarker', /makeMenAnTol\(w2\.menAnTol, WILDS_WALLS/.test(scene) && /markerId: 'men_an_tol'/.test(scene) && /walls\.push\(\{ x: geo\.x - geo\.stone/.test(props) && /walls\.push\(\{ x: geo\.x \+ geo\.hole/.test(props));
check('clear of the Shepherd\'s Race, the clootie well and the portal, and inside the ring no tree is scattered into', Math.hypot(X - 5600, Y - 8400) > 445 + 320 && Math.hypot(X - 4400, Y - 8200) > 500 && Math.hypot(X - 5000, Y - 8800) > 600 && Math.hypot(X - 5000, Y - 8800) + 300 < 1300 + 50);

require('../server.js');
setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const say = (s, m) => s.emit('message', JSON.stringify(m));
  const init = (() => { const s = makeMockSocket('g'); connHandler(s); say(s, { type: 'join', name: 'g', charId: 0 }); return s.lastOfType('init'); })();
  check('the Wilds the client is sent carries the stone', init.world2 && init.world2.menAnTol && init.world2.menAnTol.x === X && init.world2.menAnTol.hole === M.MEN_HOLE);
  const s = makeMockSocket('Crawler'); connHandler(s);
  say(s, { type: 'join', name: 'Crawler', charId: 0 });
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'men_a'; h.accounts.men_a = {}; p.room = 'wilds';
  for (let k = 0; k < 9; k++) for (const [x, y] of loopWest) say(s, { type: 'move', x, y, room: 'wilds' });
  const evs = s.sent.filter((m) => m.type === 'men_an_tol').map((m) => m.event);
  check('nine crawls through the real handler: done, XP once today, counted', evs.length === 9 && evs[8] === 'done' && s.lastOfType('men_an_tol').xp === 30 && h.accounts.men_a.menAnTol.crawls === 1);
  check('…and when it is done the stone says so in its own words, with the plain line folded under it', s.lastOfType('npc_hint_dialogue').message === M.MEN_AN_TOL_DONE && s.lastOfType('npc_hint_dialogue').note === M.MEN_AN_TOL_NOTE);
  for (let k = 0; k < 9; k++) for (const [x, y] of loopWest) say(s, { type: 'move', x, y, room: 'wilds' });
  check('a second nine the same day counts, but pays nothing more', h.accounts.men_a.menAnTol.crawls === 2 && s.lastOfType('men_an_tol').xp === 0);
  say(s, { type: 'read_waymarker', markerId: 'men_an_tol' });
  const d = s.lastOfType('npc_hint_dialogue');
  check('the stone reads out the lore, lays the brass pins, and cites its sources', /crick-stone/.test(d.message) && /the pins (stir|lie still)\./.test(d.message) && /Bottrell/.test(d.message));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
