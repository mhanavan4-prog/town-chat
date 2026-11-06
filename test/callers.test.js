// Callers at the Door — townsfolk hire the player for a real cunning-folk
// working (docs/blueprints/folk-magic-deepening.md, proposal A).
//
// The promise this holds: every working can actually be done with the tools
// the game already has. A reading step has to be creditable by the real
// handler (pendulum / tarot / runes / scry), a hand-over step has to name an
// item the catalog knows and that some action produces, and finishing pays
// once, consumes what was handed over, and cannot be done early.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-callers-');

let pass = 0, fail = 0;
// A throw inside the timer would leave the server listening and hang the run.
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.message); process.exit(1); });
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

const { CALLERS, TIERS, CALLERS_PER_DAY, READING_KINDS } = require('../data/callers');
const { POTION_RECIPES } = require('../data/gameConstants');
const { GREEN_PATH_CATEGORIES } = require('../data/greenPath');

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const say = (s, m) => s.emit('message', JSON.stringify(m));
  // Work one step through the game's REAL handler — the one place every reading
  // kind is driven, for both today's callers and the every-caller sweep. (They
  // used to be two lists; a kind added to one and not the other made this test
  // fail only on days the town happened to offer that caller.)
  const { CHARMS } = require('../data/charms');
  function doStep(sock, inv, s) {
    if (s.kind === 'pendulum') say(sock, { type: 'pendulum_ask', question: s.ask || 'Well?' });
    else if (s.kind === 'tarot') say(sock, { type: 'tarot_draw' });
    else if (s.kind === 'runes') say(sock, { type: 'rune_cast' });
    else if (s.kind === 'scry') say(sock, { type: 'scry' });
    else if (s.kind === 'leaves') { h.addItemToAccount(inv, 'chamomile', 1); say(sock, { type: 'brew_tea', teaId: 'chamomile_tea' }); say(sock, { type: 'read_leaves' }); }
    else if (s.kind === 'charm') CHARMS[s.charm].lines.forEach((_, li) => say(sock, { type: 'charm_say', line: li }));
    else if (s.kind === 'sieve') { for (const n of s.suspects) say(sock, { type: 'sieve_turn', name: n }); } // name them all; it turns at one
    else if (s.kind === 'key') { for (const n of s.suspects) say(sock, { type: 'key_turn', name: n }); }
    else if (s.kind === 'rite') say(sock, { type: 'rite_do' });
    else if (s.kind === 'deliver') h.addItemToAccount(inv, s.item, s.qty);
    else throw new Error('callers.test: no driver for step kind ' + s.kind + ' — add it to doStep');
  }

  function join(tag, key) {
    const s = makeMockSocket(tag); connHandler(s);
    say(s, { type: 'join', name: tag, charId: 0 });
    const p = h.players.get(s.lastOfType('init').id);
    if (key) { p.accountKey = key; if (!h.accounts[key]) h.accounts[key] = {}; }
    return { s, p };
  }

  // ── The data is honest and complete ───────────────────────────────────────
  check(`there are more callers than fit at the door in a day (${CALLERS.length} > ${CALLERS_PER_DAY})`, CALLERS.length > CALLERS_PER_DAY);
  check('caller ids are unique', new Set(CALLERS.map((c) => c.id)).size === CALLERS.length);
  const brewed = new Set(POTION_RECIPES.map((r) => r.result));
  const grown = new Set();
  for (const cat of GREEN_PATH_CATEGORIES) for (const p of cat.plants) grown.add(p.id);
  const sold = new Set(['salt', 'wind_cord_3', 'wood']); // the apothecary's shelf, a wind you tie yourself, holly from the town trees
  // …and anything a Wilds tree drops (the ogham grove included).

  for (const c of CALLERS) {
    check(`${c.id}: names its provenance tier and a source`, !!TIERS[c.tier] && !!c.source && c.lore.length > 80, { tier: c.tier, source: c.source });
    check(`${c.id}: has a plea, a resolution and a reward`, !!c.plea && !!c.resolution && c.reward && c.reward.gold > 0);
    check(`${c.id}: needs at least one reading — the tools are the point`, c.steps.some((s) => READING_KINDS.includes(s.kind)));
    for (const s of c.steps) {
      if (s.kind === 'deliver') {
        check(`  ${c.id}: hands over ${s.item}, which the catalog knows`, !!h.ITEM_CATALOG[s.item], s.item);
        const wildTree = Object.values((global.__testHooks && global.__testHooks.WILDS_FLORA_HARVEST) || {}).includes(s.item);
        check(`  ${c.id}: and ${s.item} comes from somewhere (brewed, grown, sold, or a Wilds tree)`, brewed.has(s.item) || grown.has(s.item) || sold.has(s.item) || wildTree, s.item);
      } else {
        check(`  ${c.id}: step kind "${s.kind}" is a reading the server credits`, READING_KINDS.includes(s.kind), s.kind);
      }
    }
  }

  // ── Guests are told to log in ────────────────────────────────────────────
  const g = join('Wanderer', null);
  say(g.s, { type: 'callers_state' });
  check('a guest sees no callers, and why', g.s.lastOfType('callers_state') && g.s.lastOfType('callers_state').isGuest === true);

  // ── Three at the door, stable for the day ────────────────────────────────
  const w = join('Cunning', 'callers_a');
  say(w.s, { type: 'callers_state' });
  let st = w.s.lastOfType('callers_state');
  check(`${CALLERS_PER_DAY} callers wait at the door`, st && st.offered.length === CALLERS_PER_DAY, st && st.offered.map((o) => o.id));
  say(w.s, { type: 'callers_state' });
  check('…and the same three on a second look', JSON.stringify(w.s.lastOfType('callers_state').offered.map((o) => o.id)) === JSON.stringify(st.offered.map((o) => o.id)));

  // Not on today's doorstep → refused.
  const notToday = CALLERS.find((c) => !st.offered.some((o) => o.id === c.id));
  say(w.s, { type: 'caller_take', id: notToday.id });
  check('a caller not at the door today cannot be taken', w.s.lastOfType('caller_error') && !w.s.lastOfType('callers_state').active);

  // ── Work every one of today's callers through to the end ─────────────────
  const inv = h.getInventory(w.p);
  const goldBefore = h.ensureBankAccount(w.p.accountKey).balance;
  let paid = 0;
  for (const o of st.offered) {
    const c = CALLERS.find((x) => x.id === o.id);
    say(w.s, { type: 'caller_take', id: c.id });
    let cs = w.s.lastOfType('callers_state');
    check(`${c.id}: taken`, cs.active && cs.active.id === c.id, cs.active);

    // A second working is refused while this one is in hand.
    const other = st.offered.find((x) => x.id !== c.id && !(cs.offered.find((y) => y.id === x.id) || {}).served);
    if (other) {
      w.s.sent.length = 0;
      say(w.s, { type: 'caller_take', id: other.id });
      check(`${c.id}: one working at a time`, !!w.s.lastOfType('caller_error') && w.s.lastOfType('callers_state').active.id === c.id);
    }

    // Finishing early is refused and pays nothing.
    const balEarly = h.ensureBankAccount(w.p.accountKey).balance;
    w.s.sent.length = 0;
    say(w.s, { type: 'caller_finish' });
    check(`${c.id}: cannot be finished before the work is done`, !!w.s.lastOfType('caller_error') && !w.s.lastOfType('caller_result') && h.ensureBankAccount(w.p.accountKey).balance === balEarly);

    // Do each reading through the REAL handler.
    for (const s of c.steps) doStep(w.s, inv, s);
    say(w.s, { type: 'callers_state' }); // the Board re-reads the pack when opened
    cs = w.s.lastOfType('callers_state');
    const notDone = cs.active.steps.filter((s) => !s.done);
    check(`${c.id}: every step is done by the game's own tools`, notDone.length === 0, notDone);
    check(`${c.id}: readings leave a note of what they said`, cs.active.steps.filter((s) => s.kind !== 'deliver').every((s) => s.note && s.note.length > 8), cs.active.steps);
    check(`${c.id}: the working says it is ready`, cs.active.ready === true);

    const delivers = c.steps.filter((s) => s.kind === 'deliver');
    const before = delivers.map((s) => h.countItemQty(inv, s.item));
    const bal0 = h.ensureBankAccount(w.p.accountKey).balance;
    w.s.sent.length = 0;
    say(w.s, { type: 'caller_finish' });
    const r = w.s.lastOfType('caller_result');
    check(`${c.id}: finishing tells the tale and the lore, with its tier and source`, r && r.resolution === c.resolution && r.lore === c.lore && r.tierLabel && r.source === c.source, r);
    check(`${c.id}: pays ${c.reward.gold}🪙`, h.ensureBankAccount(w.p.accountKey).balance === bal0 + c.reward.gold, { was: bal0, now: h.ensureBankAccount(w.p.accountKey).balance });
    paid += c.reward.gold;
    check(`${c.id}: the hand-over is consumed`, delivers.every((s, i) => h.countItemQty(inv, s.item) === before[i] - s.qty), delivers.map((s) => [s.item, h.countItemQty(inv, s.item)]));
    cs = w.s.lastOfType('callers_state');
    check(`${c.id}: the door shows them served, and nothing in hand`, !cs.active && cs.offered.find((x) => x.id === c.id).served === true);

    // And it cannot be done twice in a day.
    w.s.sent.length = 0;
    say(w.s, { type: 'caller_take', id: c.id });
    check(`${c.id}: cannot be taken again today`, !!w.s.lastOfType('caller_error') && !w.s.lastOfType('callers_state').active);
  }
  // (Readings can pay on their own — the daily tarot draw gives a little gold —
  // so the purse is at least what the callers paid, never less.)
  check('the purse grew by at least what the callers paid', h.ensureBankAccount(w.p.accountKey).balance >= goldBefore + paid);
  check(`the town counts ${st.offered.length} workings`, w.s.lastOfType('callers_state').total === st.offered.length);

  // ── Every caller in the book can be finished, not just today's three ─────
  for (const c of CALLERS) {
    const x = join('Every_' + c.id, 'callers_every_' + c.id);
    const xinv = h.getInventory(x.p);
    h.accounts[x.p.accountKey].callers = { day: Math.floor(Date.now() / 86400000), served: [], active: { id: c.id, done: {} }, total: 0, byId: {} };
    for (const s of c.steps) doStep(x.s, xinv, s);
    x.s.sent.length = 0;
    say(x.s, { type: 'caller_finish' });
    check(`every caller: ${c.id} can be worked to the end`, !!x.s.lastOfType('caller_result'), x.s.lastOfType('caller_error'));
  }

  // ── A reading with no working in hand changes nothing ────────────────────
  w.s.sent.length = 0;
  say(w.s, { type: 'pendulum_ask', question: 'Anything?' });
  check('a reading with no caller waiting credits nothing', !w.s.lastOfType('callers_state'));

  // ── Setting a working aside ───────────────────────────────────────────────
  const b = join('Second', 'callers_b');
  say(b.s, { type: 'callers_state' });
  const first = b.s.lastOfType('callers_state').offered[0];
  say(b.s, { type: 'caller_take', id: first.id });
  say(b.s, { type: 'caller_abandon' });
  check('a working can be set aside', !b.s.lastOfType('callers_state').active);

  // ── An already-laid spread counts (the daily cards cannot be re-drawn) ────
  const tarotCaller = CALLERS.find((c) => c.steps.some((s) => s.kind === 'tarot'));
  const t = join('Reader', 'callers_c');
  const a = h.accounts[t.p.accountKey];
  say(t.s, { type: 'tarot_draw' }); // today's cards laid BEFORE any caller
  // Force the tarot caller onto today's doorstep by taking it as active.
  a.callers = { day: Math.floor(Date.now() / 86400000), served: [], active: { id: tarotCaller.id, done: {} }, total: 0, byId: {} };
  say(t.s, { type: 'tarot_state' }); // opening the cards to show the caller
  const ts = t.s.lastOfType('callers_state');
  const tstep = ts && ts.active.steps.find((s) => s.kind === 'tarot');
  check('opening today\'s already-laid spread credits the tarot step', tstep && tstep.done === true, ts && ts.active);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 700);
