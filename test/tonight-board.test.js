// How tonight stands, on the moot board and from the look-out, against the
// real server; and word sent to the town when the round of fires is closed.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-tonight-test-');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); } }
function makeMockSocket(label) {
  return { label, OPEN: 1, readyState: 1, sent: [], _handlers: {},
    on(event, cb) { this._handlers[event] = cb; }, send(data) { this.sent.push(JSON.parse(data)); },
    emit(event, ...args) { if (this._handlers[event]) this._handlers[event](...args); },
    lastOfType(type) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === type) return this.sent[i]; return null; } };
}
const realNow = Date.now;
require('../server.js');
const { WARD } = require('../data/villageWard');
const { PACKMAN } = require('../data/packman');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const join = (name) => { const s = makeMockSocket(name); connHandler(s); s.emit('message', JSON.stringify({ type: 'join', name })); return [s, h.players.get(s.lastOfType('init').id)]; };
  const [sock, player] = join('Warder'), [townSock, townie] = join('Townie');
  const CYCLE = 40 * 60 * 1000; // twenty minutes of day, then twenty of night (server.js CYCLE_MS)
  const dusk = Math.ceil(realNow() / CYCLE) * CYCLE - 5 * 60 * 1000;
  let t = dusk - 20 * 60 * 1000; Date.now = () => t;
  const has = (lines, re) => lines.some((l) => re.test(l));

  let L = h.tonightLines(player, t);
  check('by day the board says what the night will offer', !h.isNightNow() && L.length === 2 && has(L, /^🔥 The bound stones are cold.*east, south, west, north/) && has(L, /^🎒 A packman stops at the stall on nights the round is closed/));
  t = dusk; L = h.tonightLines(player, t);
  check('at night with nothing done: the village lies open, the stall is shut, nobody is at the stones, no candle seen', h.isNightNow() && has(L, /^🔥 No bound fire is lit tonight/) && has(L, /^🎒 The stall is shuttered/) && has(L, /^💃 Nobody is at the dancing ground\. A reel wants 3/) && has(L, /^🕯️ Nothing has gone down the road south yet/));
  const light = (id) => { const s = WARD.stones.find((x) => x.id === id); Object.assign(player, { room: 'wilds', isDead: false, x: s.x + 20, y: s.y + 40 }); sock.emit('message', JSON.stringify({ type: 'ward_use', id })); };
  light('south'); light('west'); L = h.tonightLines(player, t);
  check('part-way round it says how many, and where the fire is wanted next', has(L, /^🔥 2 of 4 bound fires are lit\. The fire is wanted next at the north bound stone\./));
  townSock.sent.length = 0; townie.room = 'outside';
  light('north'); light('east'); L = h.tonightLines(player, t);
  check('closed: it says so, and names what is in the packman\'s pack tonight', h.villageWard.isWarded() && has(L, /^🔥 The round of bound fires is closed/) && has(L, new RegExp('^🎒 ' + PACKMAN.name + ' is at the stall till morning, with [a-z ,]+\\.$')) && L.find((l) => /^🎒/.test(l)).split(' with ')[1].split(',').length === PACKMAN.perNight);
  check('and word of it reaches someone in the town, but is not said twice to those who were there', townSock.sent.some((m) => m.type === 'toast' && /Word from the Wilds/.test(m.message)) && !sock.sent.some((m) => m.type === 'toast' && /Word from the Wilds/.test(m.message)));
  h.oldWays._reel.hands.set('x', {}); L = h.tonightLines(player, t);
  check('one at the stones is counted', has(L, /^💃 1 has taken hands at the stones.*wants 3/));
  h.oldWays._reel.hands.clear(); h.oldWays._reel.endsAt = t + 5000;
  check('a reel turning is said to be turning', has(h.tonightLines(player, t), /^💃 A reel is being danced/));
  h.oldWays._reel.endsAt = 0; player.candleDay = Math.floor(t / 86400000);
  check('her candle, once seen, is marked', has(h.tonightLines(player, t), /^🕯️ You have seen tonight's corpse candle/));
  const board = h.mootBoardLines(player);
  check('the moot board carries all of it under what it already said', has(board, /The moon:/) && has(board, /^🔥 The round of bound fires is closed/) && has(board, /^🎒/) && has(board, /^💃/));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
