// The Moon Well (reagent economy) — draw moon water under the full moon. Covers
// the full-moon gate, the vial → moon water exchange, the blood-moon double draw,
// the nightly cap, and the state body shape. Drives the real ws handlers so the
// gating + inventory wiring are tested at the boundary. TC_MOON overrides the
// live phase (see lib/calendar.js).
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-moonwell-');

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
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];

  function join(tag, key) {
    const s = makeMockSocket(tag); connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: 0 }));
    const p = h.players.get(s.lastOfType('init').id);
    if (key) { p.accountKey = key; if (!h.accounts[key]) h.accounts[key] = {}; }
    return { s, p };
  }
  function giveVials(p, n) { const inv = h.getInventory(p); for (let i = 0; i < n; i++) h.addItemToAccount(inv, 'glass_vial', 1); }
  function waterOf(p) { return h.countItemQty(h.getInventory(p), 'moon_water'); }
  function vialsOf(p) { return h.countItemQty(h.getInventory(p), 'glass_vial'); }

  // ── Not the full moon: the well is closed, a draw yields nothing ───────────
  process.env.TC_MOON = 'new';
  const dark = join('Dark', 'mw_dark');
  giveVials(dark.p, 3);
  dark.s.emit('message', JSON.stringify({ type: 'moon_well_state' }));
  const stClosed = dark.s.lastOfType('moon_well_state');
  check('under a new moon the well is closed', stClosed.open === false && stClosed.canDraw === false, stClosed && { open: stClosed.open, canDraw: stClosed.canDraw });
  dark.s.emit('message', JSON.stringify({ type: 'moon_well_draw' }));
  check('a draw off the full moon takes no vial and gives no water', vialsOf(dark.p) === 3 && waterOf(dark.p) === 0, { vials: vialsOf(dark.p), water: waterOf(dark.p) });

  // ── Full moon: a draw trades one vial for one moon water ───────────────────
  process.env.TC_MOON = 'full';
  const seer = join('Seer', 'mw_seer');
  giveVials(seer.p, 2);
  seer.s.emit('message', JSON.stringify({ type: 'moon_well_state' }));
  const stOpen = seer.s.lastOfType('moon_well_state');
  check('under a full moon the well is open and drawable with a vial', stOpen.open === true && stOpen.isFull === true && stOpen.canDraw === true, { open: stOpen.open, canDraw: stOpen.canDraw });
  seer.s.emit('message', JSON.stringify({ type: 'moon_well_draw' }));
  check('a full-moon draw trades one vial for one moon water', vialsOf(seer.p) === 1 && waterOf(seer.p) === 1, { vials: vialsOf(seer.p), water: waterOf(seer.p) });

  // ── No vial: the well cannot be drawn ──────────────────────────────────────
  const empty = join('Empty', 'mw_empty');
  empty.s.emit('message', JSON.stringify({ type: 'moon_well_state' }));
  check('with no vial the well is open but not drawable', empty.s.lastOfType('moon_well_state').open === true && empty.s.lastOfType('moon_well_state').canDraw === false);
  empty.s.emit('message', JSON.stringify({ type: 'moon_well_draw' }));
  check('a vial-less draw yields nothing', waterOf(empty.p) === 0);

  // ── Nightly cap: draws stop at the cap, and the body reports it ────────────
  const cap = h.MOON_WELL_NIGHTLY_CAP;
  const grind = join('Grind', 'mw_grind');
  giveVials(grind.p, cap + 3);
  for (let i = 0; i < cap + 2; i++) grind.s.emit('message', JSON.stringify({ type: 'moon_well_draw' }));
  check('draws stop at the nightly cap', waterOf(grind.p) === cap, { water: waterOf(grind.p), cap });
  check('vials beyond the cap are not spent', vialsOf(grind.p) === 3, vialsOf(grind.p));
  check('the body reports no draws left at the cap', grind.s.lastOfType('moon_well_state').drawsLeft === 0);

  // ── Blood moon: a draw fills the vial twice over. Blood nights are purely
  // time-derived (no env override), so exercise it only if tonight is one;
  // otherwise assert the ordinary single-draw invariant. ───────────────────
  const bm = join('Blood', 'mw_blood');
  bm.s.emit('message', JSON.stringify({ type: 'moon_well_state' }));
  const stBlood = bm.s.lastOfType('moon_well_state');
  if (stBlood.isBlood) {
    giveVials(bm.p, 2);
    bm.s.emit('message', JSON.stringify({ type: 'moon_well_draw' }));
    check('a blood-moon draw yields two moon water for one vial', waterOf(bm.p) === 2 && vialsOf(bm.p) === 1, { water: waterOf(bm.p), vials: vialsOf(bm.p) });
    check('the blood-moon body advertises the double draw', stBlood.perDraw === 2);
  } else {
    check('perDraw is 1 on an ordinary full moon', stBlood.perDraw === 1);
  }
  delete process.env.TC_MOON;

  // ── drawsLeft helper is pure and honors the UTC-day reset ──────────────────
  check('moonWellDrawsLeft is full for a fresh day', h.moonWellDrawsLeft({ lastMoonDrawDay: 0, moonDrawsToday: cap }, 99999) === cap);
  check('moonWellDrawsLeft counts the same-day draws', h.moonWellDrawsLeft({ lastMoonDrawDay: 99999, moonDrawsToday: 2 }, 99999) === cap - 2);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
