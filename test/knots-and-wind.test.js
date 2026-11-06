// Knots, and Selling the Wind — cord magic (blueprint proposal F).
//
// The one system that stores power for later. Holds: a wind is tied only under
// the open sky, from a cord the town sells, a limited number a day (more for a
// Sea Witch); the knots loose in order, each stronger, and the third costs a
// quarter of your health but never kills; the speed is real (skillSpeedMult)
// and stacks with a tea instead of overwriting it; and a skipper will buy a
// three-knot cord — the trade itself.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-cords-');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
  };
}

const { KNOTS, CORD_BY_KNOTS, CORD_MATERIAL, CORDS_PER_DAY, CORDS_PER_DAY_SEA } = require('../data/cords');
const { CALLERS } = require('../data/callers');

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const say = (s, m) => s.emit('message', JSON.stringify(m));
  function join(tag, key) {
    const s = makeMockSocket(tag); connHandler(s);
    say(s, { type: 'join', name: tag, charId: 0 });
    const p = h.players.get(s.lastOfType('init').id);
    p.accountKey = key; if (!h.accounts[key]) h.accounts[key] = {};
    return { s, p };
  }

  check('three knots, each stronger than the last', KNOTS.length === 3 && KNOTS[0].swift < KNOTS[1].swift && KNOTS[1].swift < KNOTS[2].swift);
  check('only the third has a price', !KNOTS[0].hpCostFrac && !KNOTS[1].hpCostFrac && KNOTS[2].hpCostFrac > 0);
  const shopItems = new Set();
  for (const shop of Object.values(h.NPC_SHOPS || {})) for (const it of shop.items) shopItems.add(it.id);
  check('hemp cord is sold in town', shopItems.has(CORD_MATERIAL));

  const a = join('Windseller', 'cord_a');
  const inv = h.getInventory(a.p);

  // ── Tying ────────────────────────────────────────────────────────────────
  a.p.room = 'outside';
  a.s.sent.length = 0;
  say(a.s, { type: 'tie_wind_cord' });
  check('no cord, no wind', !!a.s.lastOfType('cords_error') && h.countItemQty(inv, CORD_BY_KNOTS[3]) === 0);
  h.addItemToAccount(inv, CORD_MATERIAL, 3);
  a.p.room = 'cottage'; a.p.instance = 'home_cord_a';
  a.s.sent.length = 0;
  say(a.s, { type: 'tie_wind_cord' });
  check('a wind is not tied indoors', !!a.s.lastOfType('cords_error') && h.countItemQty(inv, CORD_BY_KNOTS[3]) === 0);
  a.p.room = 'outside'; a.p.instance = '';
  say(a.s, { type: 'tie_wind_cord' });
  check('under the open sky, the cord takes three knots', h.countItemQty(inv, CORD_BY_KNOTS[3]) === 1 && h.countItemQty(inv, CORD_MATERIAL) === 2);
  a.s.sent.length = 0;
  say(a.s, { type: 'tie_wind_cord' });
  check(`${CORDS_PER_DAY} wind a day`, !!a.s.lastOfType('cords_error') && h.countItemQty(inv, CORD_BY_KNOTS[3]) === 1);

  // ── Loosing the knots ────────────────────────────────────────────────────
  // A tea already warming you: the wind must not blow it away.
  h.accounts.cord_a.teaBuff = { stat: 'swift', amount: 0.10, until: Date.now() + 600000, id: 'vervain_tea' };
  const base = h.skillSpeedMult ? h.skillSpeedMult(a.p) : 1 + h.statContrib(a.p, 'swift');
  say(a.s, { type: 'untie_knot', knots: 3 });
  const s1 = h.statContrib(a.p, 'swift');
  check('the first knot: a breeze — and you are faster', h.countItemQty(inv, CORD_BY_KNOTS[2]) === 1 && h.countItemQty(inv, CORD_BY_KNOTS[3]) === 0 && Math.abs((1 + s1) - base - KNOTS[0].swift) < 1e-9, { s1, base });
  check('…and the tea still warms you (separate slot)', h.accounts.cord_a.teaBuff && h.accounts.cord_a.teaBuff.amount === 0.10);
  const ss = a.s.lastOfType('skill_state');
  check('the client is told its new speed', ss && Math.abs(ss.speedMult - (1 + s1)) < 1e-9, ss && ss.speedMult);
  say(a.s, { type: 'untie_knot', knots: 2 });
  check('the second knot: half a gale', h.countItemQty(inv, CORD_BY_KNOTS[1]) === 1 && h.accounts.cord_a.cordBuff.amount === KNOTS[1].swift);
  const max = h.playerMaxHealth(a.p);
  a.p.health = max;
  say(a.s, { type: 'untie_knot', knots: 1 });
  check('the third knot: a hurricane', h.accounts.cord_a.cordBuff.amount === KNOTS[2].swift && h.countItemQty(inv, CORD_BY_KNOTS[1]) === 0);
  check(`…which takes ${KNOTS[2].hpCostFrac * 100}% of your health`, a.p.health === max - Math.round(max * KNOTS[2].hpCostFrac), { hp: a.p.health, max });
  a.s.sent.length = 0;
  say(a.s, { type: 'untie_knot', knots: 1 });
  check('a spent cord has nothing left to loose', !!a.s.lastOfType('cords_error'));

  // The hurricane never kills.
  h.addItemToAccount(inv, CORD_BY_KNOTS[1], 1);
  a.p.health = 2;
  say(a.s, { type: 'untie_knot', knots: 1 });
  check('the third knot never kills — it leaves you standing', a.p.health === 1 && !a.p.isDead);

  // ── The Sea Witch's practice ─────────────────────────────────────────────
  const b = join('SeaWitch', 'cord_b');
  h.accounts.cord_b.witchPath = 'sea';
  const binv = h.getInventory(b.p);
  h.addItemToAccount(binv, CORD_MATERIAL, 3);
  b.p.room = 'wilds';
  for (let i = 0; i < 3; i++) say(b.s, { type: 'tie_wind_cord' });
  check(`a Sea Witch ties ${CORDS_PER_DAY_SEA} winds a day`, h.countItemQty(binv, CORD_BY_KNOTS[3]) === CORDS_PER_DAY_SEA);
  say(b.s, { type: 'untie_knot', knots: 3 });
  const dur = h.accounts.cord_b.cordBuff.until - Date.now();
  check('…and her knots blow longer', dur > KNOTS[0].ms + 1000, dur);

  // ── Selling the wind ─────────────────────────────────────────────────────
  const skipper = CALLERS.find((c) => c.steps.some((s) => s.kind === 'deliver' && s.item === CORD_BY_KNOTS[3]));
  check('a caller comes to buy a three-knot wind', !!skipper);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 700);
