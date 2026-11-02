// The Fool's Journey — The Arcanum collection built on the daily tarot draw.
// Covers the account-wide record (recordArcana), the three-leg milestones with
// their purses, the all-22 finale + Oracle aura, the collection body shape, and
// the draw / peek handlers (a fresh draw records the spread; a peek never does).
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-arcanum-');

const { TAROT_CARDS, ARCANA_LEGS } = require('../data/tarot.js');

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

  // ── recordArcana: records new cards, ignores dups + non-cards ──────────────
  const seer = join('Seer', 'seer');
  const r1 = h.recordArcana(seer.p, ['fool', 'magician', 'fool', 'not_a_card']);
  check('records only the new, real cards', r1.newKeys.length === 2 && r1.newKeys.includes('fool') && r1.newKeys.includes('magician'), r1.newKeys);
  check('a card already held is not re-recorded', h.recordArcana(seer.p, ['fool']).newKeys.length === 0);
  check('The Arcanum holds the two gathered cards', h.tarotArcanaOf(seer.p).drawn.length === 2);

  // ── Collection body: shape + discovered flags + per-leg counts ─────────────
  const body = h.tarotCollectionBody(seer.p);
  check('the body groups into the three legs', body.legs.length === 3 && body.total === 22);
  check('drawn count matches', body.drawn === 2);
  const worldly = body.legs.find((l) => l.id === 'worldly');
  check('a discovered card reveals name + reading, undiscovered hides them', (() => {
    const fool = worldly.cards.find((c) => c.key === 'fool');
    const hidden = worldly.cards.find((c) => !c.discovered);
    return fool.discovered && fool.name && fool.reading && hidden && hidden.name === null && hidden.reading === null;
  })());
  check('the first leg shows 2 of its total discovered', worldly.count === 2 && worldly.total === ARCANA_LEGS[0].keys.length);

  // ── Leg milestone: completing a leg returns it with its purse, once ────────
  const rest = ARCANA_LEGS[0].keys.filter((k) => k !== 'fool' && k !== 'magician');
  const rLeg = h.recordArcana(seer.p, rest);
  check('finishing the first leg reports it complete with its gold', rLeg.legsDone.length === 1 && rLeg.legsDone[0].id === 'worldly' && rLeg.legsDone[0].gold === ARCANA_LEGS[0].gold, rLeg.legsDone);
  check('the completed leg is marked claimed in the body', h.tarotCollectionBody(seer.p).legs.find((l) => l.id === 'worldly').claimed === true);
  check('re-recording a card in a claimed leg does not re-award it', h.recordArcana(seer.p, ['fool']).legsDone.length === 0);

  // ── Finale: gathering all 22 fires once + grants the Oracle aura ───────────
  const oracle = join('Oracle', 'oracle');
  const allKeys = TAROT_CARDS.map((c) => c.key);
  const rAll = h.recordArcana(oracle.p, allKeys);
  check('all three legs complete at once when all 22 land', rAll.legsDone.length === 3);
  check('the finale fires', rAll.finale === true);
  check('the finale grants the Oracle aura', (h.getProgress(oracle.p).auraUnlocks || []).includes('oracle'));
  check('a later draw does not re-fire the finale', h.recordArcana(oracle.p, ['fool']).finale === false);
  check('the body reports the Journey done', h.tarotCollectionBody(oracle.p).done === true);

  // ── Draw handler: a fresh draw records its three cards + ships The Arcanum ──
  const drawer = join('Drawer', 'drawer');
  drawer.s.emit('message', JSON.stringify({ type: 'tarot_draw' }));
  const res = drawer.s.lastOfType('tarot_result');
  check('the draw result carries The Arcanum', res.arcana && res.arcana.total === 22);
  check('a fresh draw records exactly its three cards', res.arcana.drawn === 3 && h.tarotArcanaOf(drawer.p).drawn.length === 3, res.arcana.drawn);
  const firstDrawn = h.tarotArcanaOf(drawer.p).drawn.slice();

  // A second draw the same UTC day re-shows the spread + does not add cards.
  drawer.s.emit('message', JSON.stringify({ type: 'tarot_draw' }));
  const res2 = drawer.s.lastOfType('tarot_result');
  check('the same-day draw is marked alreadyDrawn', res2.alreadyDrawn === true);
  check('the same-day draw records no new cards', h.tarotArcanaOf(drawer.p).drawn.length === 3 && firstDrawn.every((k) => h.tarotArcanaOf(drawer.p).drawn.includes(k)));

  // ── Peek (tarot_state): returns The Arcanum without consuming a draw ───────
  const peeker = join('Peeker', 'peeker');
  peeker.s.emit('message', JSON.stringify({ type: 'tarot_state' }));
  const peek = peeker.s.lastOfType('tarot_result');
  check('a peek returns The Arcanum', peek.arcana && peek.arcana.total === 22 && peek.peek === true);
  check('a peek deals no spread for an un-drawn day', (!peek.spread || peek.spread.length === 0) && peek.alreadyDrawn === false);
  check('a peek records nothing', h.tarotArcanaOf(peeker.p).drawn.length === 0);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
