// ws-handler coverage for the divination + altar message handlers (roadmap #5).
// These had only data-level tests (omens/pendulum/observances) — this drives the
// real websocket handlers so their gating + side effects are locked at the
// boundary before the handler switch is refactored: the Scrying Bowl (scry +
// the moon-water deep reading), the Pendulum, and the Ancestor Altar offering.
// TC_SEASON pins the season so the altar + thin-veil behavior are deterministic.
process.env.PORT = '0';
process.env.TC_SEASON = 'samhain';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-divh-');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
    countOfType(t) { return this.sent.filter((m) => m.type === t).length; },
    clear() { this.sent.length = 0; },
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
  const give = (p, id, n) => { const inv = h.getInventory(p); for (let i = 0; i < n; i++) h.addItemToAccount(inv, id, 1); };
  const qty = (p, id) => h.countItemQty(h.getInventory(p), id);

  // ── Scrying Bowl: free, no account needed (a wanderer may scry) ────────────
  const wanderer = join('Wanderer', null);
  wanderer.s.emit('message', JSON.stringify({ type: 'scry' }));
  const scry = wanderer.s.lastOfType('scry_reading');
  check('scry returns a reading with moon, wheel + an omen', !!(scry && scry.moon && scry.wheel && typeof scry.omen === 'string' && scry.omen.length), scry && { moon: !!scry.moon, wheel: !!scry.wheel, omen: scry.omen });
  check('scry reports the thin veil under Samhain', scry.samhain === true);
  check('a guest shows zero moon water on the deep-reading gauge', scry.moonWater === 0);

  // ── Deep reading (scry_deep): account + a vial of moon water, consumed ─────
  const guest = join('GuestSeer', null);
  guest.s.emit('message', JSON.stringify({ type: 'scry_deep' }));
  check('a guest cannot pour the deep reading', guest.s.lastOfType('scry_deep_reading') === null && guest.s.lastOfType('toast') !== null);

  const seer = join('Seer', 'dh_seer');
  seer.s.emit('message', JSON.stringify({ type: 'scry_deep' }));
  check('an account with no moon water is turned away', seer.s.lastOfType('scry_deep_reading') === null && /moon water/i.test((seer.s.lastOfType('toast') || {}).message || ''));
  give(seer.p, 'moon_water', 2);
  seer.s.clear();
  seer.s.emit('message', JSON.stringify({ type: 'scry_deep' }));
  const deep = seer.s.lastOfType('scry_deep_reading');
  check('a vial of moon water buys a three-fold deep reading', !!(deep && Array.isArray(deep.lines) && deep.lines.length === 3), deep && deep.lines);
  check('the deep reading consumes exactly one moon water', qty(seer.p, 'moon_water') === 1, qty(seer.p, 'moon_water'));
  check('the deep reading reports the remaining moon water', deep.moonWater === 1, deep.moonWater);

  // ── Pendulum: free; empty question refused; day-stable per question ────────
  const asker = join('Asker', 'dh_asker');
  asker.s.emit('message', JSON.stringify({ type: 'pendulum_ask', question: '   ' }));
  check('an empty pendulum question is refused', asker.s.lastOfType('pendulum_reading') === null && asker.s.lastOfType('toast') !== null);
  asker.s.emit('message', JSON.stringify({ type: 'pendulum_ask', question: 'Will the harvest keep?' }));
  const pen1 = asker.s.lastOfType('pendulum_reading');
  check('a real question swings to a verdict + a line', !!(pen1 && ['yes', 'no', 'unclear'].includes(pen1.verdict) && pen1.line), pen1 && { v: pen1.verdict, line: !!pen1.line });
  asker.s.emit('message', JSON.stringify({ type: 'pendulum_ask', question: 'Will the harvest keep?' }));
  const pen2 = asker.s.lastOfType('pendulum_reading');
  check('the same question answers the same all day (day-stable)', pen2.verdict === pen1.verdict && pen2.line === pen1.line, { a: pen1.verdict, b: pen2.verdict });
  check('under the thin veil the thread never reads unclear', pen1.verdict !== 'unclear', pen1.verdict);

  // ── Ancestor Altar offering: account + a valid virtue + a held offering ────
  const g2 = join('AltarGuest', null);
  g2.s.emit('message', JSON.stringify({ type: 'ancestor_offering', virtueId: 'x', offeringId: 'y' }));
  check('a guest cannot keep the rite', g2.s.lastOfType('ancestor_error') !== null);

  const keeper = join('Keeper', 'dh_keeper');
  keeper.s.emit('message', JSON.stringify({ type: 'ancestor_state' }));
  const altar = keeper.s.lastOfType('ancestor_state');
  const virtueId = altar.virtues[0].id;
  const offeringId = altar.offerings[0].id;
  check('the altar is awake and offers virtues + offerings during a sabbat', !!(virtueId && offeringId), { virtueId, offeringId });

  keeper.s.emit('message', JSON.stringify({ type: 'ancestor_offering', virtueId: 'not_a_virtue', offeringId }));
  check('an unknown virtue is refused', keeper.s.lastOfType('ancestor_error') !== null);

  // No offering item yet → refused for the lack, not the virtue.
  keeper.s.clear();
  keeper.s.emit('message', JSON.stringify({ type: 'ancestor_offering', virtueId, offeringId }));
  check('without the offering in hand the rite is refused', keeper.s.lastOfType('ancestor_error') !== null && keeper.s.lastOfType('ancestor_state') === null);

  // Give the offering, keep the rite → blessing applied, item consumed, no error.
  give(keeper.p, offeringId, 1);
  keeper.s.clear();
  keeper.s.emit('message', JSON.stringify({ type: 'ancestor_offering', virtueId, offeringId, rememberName: 'Nana' }));
  check('keeping the rite raises no error', keeper.s.lastOfType('ancestor_error') === null);
  check('the offering is consumed', qty(keeper.p, offeringId) === 0, qty(keeper.p, offeringId));
  const buff = h.accounts['dh_keeper'].ancestorBuff;
  check('a timed ancestor blessing is set on the account', !!(buff && buff.until > Date.now() && buff.stat && typeof buff.amount === 'number'), buff);
  check('the remembered name is kept', h.accounts['dh_keeper'].lastAncestorName === 'Nana');
  check('a confirming toast is sent', keeper.s.lastOfType('toast') !== null);

  // Second offering the same UTC day → refused as already kept.
  give(keeper.p, offeringId, 1);
  keeper.s.clear();
  keeper.s.emit('message', JSON.stringify({ type: 'ancestor_offering', virtueId, offeringId }));
  check('only one rite a day — a second offering is refused', /already/i.test((keeper.s.lastOfType('ancestor_error') || {}).message || ''));
  check('the refused second offering is not consumed', qty(keeper.p, offeringId) === 1, qty(keeper.p, offeringId));

  delete process.env.TC_SEASON;
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
