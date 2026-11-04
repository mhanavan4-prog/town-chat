// The Futhark — the rune codex built on the daily rune cast. Covers the account-
// wide record (recordRunes), the three-aett milestones with their purses, the
// all-24 finale + Runecaster aura, the collection body shape, and the cast / peek
// handlers (a fresh cast carves the staves; a peek never does). Mirrors the
// Arcanum test.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-futhark-');

const { RUNES, RUNE_AETTIR, aettKeys } = require('../data/runes.js');

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
    if (key) { p.accountKey = key; if (!h.accounts[key]) h.accounts[key] = {}; } // mimic a logged-in account record
    return { s, p };
  }

  const freyrKeys = aettKeys('freyr');

  // ── recordRunes: records new runes, ignores dups + non-runes ───────────────
  const seer = join('Seer', 'rune_seer');
  const r1 = h.recordRunes(seer.p, ['fehu', 'uruz', 'fehu', 'not_a_rune']);
  check('records only the new, real runes', r1.newKeys.length === 2 && r1.newKeys.includes('fehu') && r1.newKeys.includes('uruz'), r1.newKeys);
  check('a rune already carved is not re-recorded', h.recordRunes(seer.p, ['fehu']).newKeys.length === 0);
  check('The Futhark holds the two carved runes', h.runeFutharkOf(seer.p).carved.length === 2);

  // ── Collection body: shape + discovered flags + per-aett counts ────────────
  const body = h.runeFutharkBody(seer.p);
  check('the body groups into the three aettir', body.aetts.length === 3 && body.total === 24);
  check('carved count matches', body.carved === 2);
  const freyr = body.aetts.find((a) => a.id === 'freyr');
  check('a carved rune reveals sym + name + reading, uncarved hides them', (() => {
    const fehu = freyr.runes.find((r) => r.key === 'fehu');
    const hidden = freyr.runes.find((r) => !r.discovered);
    return fehu.discovered && fehu.sym && fehu.name && fehu.reading && hidden && hidden.name === null && hidden.reading === null && hidden.sym === null;
  })());
  check('the first aett shows 2 of its eight carved', freyr.count === 2 && freyr.total === 8);

  // ── Aett milestone: completing an aett returns it with its purse, once ─────
  const rest = freyrKeys.filter((k) => k !== 'fehu' && k !== 'uruz');
  const rAett = h.recordRunes(seer.p, rest);
  check('finishing the first aett reports it complete with its gold', rAett.aettsDone.length === 1 && rAett.aettsDone[0].id === 'freyr' && rAett.aettsDone[0].gold === RUNE_AETTIR[0].gold, rAett.aettsDone);
  check('the completed aett is marked claimed in the body', h.runeFutharkBody(seer.p).aetts.find((a) => a.id === 'freyr').claimed === true);
  check('re-recording a rune in a claimed aett does not re-award it', h.recordRunes(seer.p, ['fehu']).aettsDone.length === 0);

  // ── Finale: carving all 24 fires once + grants the Runecaster aura ─────────
  const caster = join('Caster', 'rune_caster');
  const allKeys = RUNES.map((r) => r.key);
  const rAll = h.recordRunes(caster.p, allKeys);
  check('all three aettir complete at once when all 24 land', rAll.aettsDone.length === 3);
  check('the finale fires', rAll.finale === true);
  check('the finale grants the Runecaster aura', (h.getProgress(caster.p).auraUnlocks || []).includes('runecaster'));
  check('a later cast does not re-fire the finale', h.recordRunes(caster.p, ['fehu']).finale === false);
  check('the body reports the Futhark done', h.runeFutharkBody(caster.p).done === true);

  // ── Cast handler: a fresh cast carves its three runes + ships The Futhark ──
  const roller = join('Roller', 'rune_roller');
  roller.s.emit('message', JSON.stringify({ type: 'rune_cast' }));
  const res = roller.s.lastOfType('rune_result');
  check('the cast result carries The Futhark', res.futhark && res.futhark.total === 24);
  check('a fresh cast carves exactly its three runes', res.futhark.carved === 3 && h.runeFutharkOf(roller.p).carved.length === 3, res.futhark.carved);
  const firstCarved = h.runeFutharkOf(roller.p).carved.slice();

  // A second cast the same UTC day re-shows the staves + carves nothing new.
  roller.s.emit('message', JSON.stringify({ type: 'rune_cast' }));
  const res2 = roller.s.lastOfType('rune_result');
  check('the same-day cast is marked alreadyCast', res2.alreadyCast === true);
  check('the same-day cast carves no new runes', h.runeFutharkOf(roller.p).carved.length === 3 && firstCarved.every((k) => h.runeFutharkOf(roller.p).carved.includes(k)));

  // ── Peek (rune_state): returns The Futhark without consuming a cast ────────
  const peeker = join('Peeker', 'rune_peeker');
  peeker.s.emit('message', JSON.stringify({ type: 'rune_state' }));
  const peek = peeker.s.lastOfType('rune_result');
  check('a peek returns The Futhark', peek.futhark && peek.futhark.total === 24 && peek.peek === true);
  check('a peek deals no staves for an un-cast day', (!peek.cast || peek.cast.length === 0) && peek.alreadyCast === false);
  check('a peek carves nothing', h.runeFutharkOf(peeker.p).carved.length === 0);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
