// Caerdroia, the Walls of Troy, drawn on the Board wall by wall: the
// classical seven-circuit labyrinth from its seed. The server takes each join
// only if it is the next wall of the true figure, turning either way, and
// refuses an out-of-order one with the reason. The caller's lore is Roberts
// (1815) as Matthews (1922) gives him; the practical half is Historic
// England's on scheduled monuments.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-troy-');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });
function makeMockSocket(tag) {
  return { OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag, on(e, cb) { this._handlers[e] = cb; }, send(d) { this.sent.push(JSON.parse(d)); }, emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); }, lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; } };
}
const { TROY_ENDS, TROY_SEED, TROY_PATH, troyProblem, troyJoinProblem, troyHand } = require('../data/troy');
const { CALLERS, READING_KINDS } = require('../data/callers');
const c = CALLERS.find((x) => x.id === 'caerdroia');

// ── The seed and its ends ────────────────────────────────────────────────────
const key = (p) => p.join(',');
const strokeEnds = new Set();
for (const [a, b] of TROY_SEED.lines) for (const p of [a, b]) if (!(Math.abs(p[0]) === 1 && Math.abs(p[1]) === 1) && !(p[0] === 0 && p[1] === 0)) strokeEnds.add(key(p));
for (const d of TROY_SEED.dots) strokeEnds.add(key(d));
check('sixteen loose ends: the cross\'s four arms, the corners\' eight, the four dots', TROY_ENDS.length === 16 && new Set(TROY_ENDS.map(key)).size === 16 && TROY_ENDS.every((e) => strokeEnds.has(key(e))) && strokeEnds.size === 16);
check('numbered clockwise from the foot of the cross', key(TROY_ENDS[0]) === '0,-2' && key(TROY_ENDS[4]) === '-2,0' && key(TROY_ENDS[8]) === '0,2' && key(TROY_ENDS[12]) === '2,0');

// ── The joining order ────────────────────────────────────────────────────────
const right = Array.from({ length: 8 }, (_, k) => [8 - k, (9 + k) % 16]);
const left = Array.from({ length: 8 }, (_, k) => [7 - k, (8 + k) % 16]);
check('turning right from the top of the cross, (8−k, 9+k), is the true figure', troyProblem(right) === null && troyHand(right) === 'right');
check('its mirror image, (7−k, 8+k), is too', troyProblem(left) === null && troyHand(left) === 'left');
check('either end of a wall may be joined first', troyProblem(right.map(([a, b]) => [b, a])) === null);
check('the path runs 3-2-1-4-7-6-5 and then the centre', TROY_PATH.join('-') === '3-2-1-4-7-6-5');
check('a first wall away from the top of the cross is refused', /Begin at the top of the cross/.test(troyJoinProblem([], 4, 12) || ''));
const swapped = right.slice(); [swapped[2], swapped[3]] = [swapped[3], swapped[2]];
check('two walls out of order are refused', /over the top of the last/.test(troyProblem(swapped) || ''));
check('mixing the two hands is refused', troyProblem([right[0], left[1], ...right.slice(2)]) !== null);
check('an end can carry one wall', /already joined/.test(troyJoinProblem([[8, 9]], 9, 10) || ''));
check('nonsense is refused', troyJoinProblem([], 'x', 3) !== null && troyJoinProblem([], 3, 3) !== null && troyJoinProblem([], 3, 99) !== null && troyProblem(right.slice(0, 7)) !== null);

// ── The caller and the lore ──────────────────────────────────────────────────
check('the caller asks for Caerdroia, a reading the server credits', c && c.steps[0].kind === 'troy' && READING_KINDS.includes('troy'));
check('lore: Roberts via Matthews, shepherd boys, a puzzle "in drawing the plan", seven walls', /'sometimes cut out in the turf by shepherd boys whilst they are tending their flocks on the mountains of Wales'/.test(c.lore) && /'or in drawing the plan'/.test(c.lore) && /'that the city of Troy was defended by seven walls'/.test(c.lore) && /'no means of losing the way into the citadel'/.test(c.lore));
check('lore: the English names, Alkborough\'s "running it in and out", and that Alkborough and Wing are another pattern', /'Mizmaze,' 'Julian's Bower,' 'Troy Town,' or 'Shepherd's Race'/.test(c.lore) && /'running it in and out'/.test(c.lore) && /not this seven-circuit one/.test(c.lore));
check('lore: St Agnes 1729 is local tradition only', /local tradition says a lighthouse keeper, Amor Clarke/.test(c.lore));
check('no wind-trapping: that is a modern hypothesis, not lore', !/wind/i.test(c.lore + c.resolution));
check('record tier; Matthews, Roberts, Kraft and the list entries cited', c.tier === 'record' && /Matthews/.test(c.source) && /Roberts/.test(c.source) && /Kraft/.test(c.source) && /1015697/.test(c.source));

// ── Through the game's own handler ───────────────────────────────────────────
require('../server.js');
setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const say = (s, m) => s.emit('message', JSON.stringify(m));
  const s = makeMockSocket('Drawer'); connHandler(s);
  say(s, { type: 'join', name: 'Drawer', charId: 0 });
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'troy_a'; h.accounts.troy_a = {};
  h.accounts.troy_a.callers = { day: Math.floor(Date.now() / 86400000), served: [], active: { id: 'caerdroia', done: {} }, total: 0, byId: {} };
  const view = () => { say(s, { type: 'callers_state' }); return s.lastOfType('callers_state').active.steps[0]; };
  const v0 = view();
  check('the board gets the seed, the ends by name, and no walls yet', v0.troy && v0.troy.ends.length === 16 && v0.troy.names.length === 16 && v0.troy.joins.length === 0 && !v0.done);
  s.sent.length = 0;
  say(s, { type: 'troy_join', a: 4, b: 12 });
  check('a wrong first wall: the server says why, and the reason stays on the step', /Begin at the top of the cross/.test((s.lastOfType('caller_error') || {}).message || '') && /Begin at the top/.test(view().troy.note) && view().troy.joins.length === 0);
  for (const [a, b] of left.slice(0, 3)) say(s, { type: 'troy_join', a, b });
  check('three walls turning left are kept, and the hand is known', view().troy.joins.length === 3 && view().troy.hand === 'left' && view().troy.note === '');
  say(s, { type: 'troy_join', a: right[3][0], b: right[3][1] });
  check('a right-hand wall on a left-hand drawing is refused', view().troy.joins.length === 3);
  say(s, { type: 'troy_join', clear: true });
  check('rubbing it out starts again', view().troy.joins.length === 0 && view().troy.hand === null);
  for (const [a, b] of right) say(s, { type: 'troy_join', a, b });
  const v1 = view();
  check('eight walls in order: the step is done, with its note', v1.done && /Caerdroia drawn/.test(v1.note) && /3-2-1-4-7-6-5/.test(v1.note), v1);
  s.sent.length = 0;
  say(s, { type: 'caller_finish' });
  check('and Dafydd pays', !!s.lastOfType('caller_result'), s.lastOfType('caller_error'));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
