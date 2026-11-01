// Player housing (slice 1) — the home layout persistence + placement rules.
// This is the one genuinely-new save shape, so it's tested before any rendering
// (per the blueprint): placement validation (bounds, overlap, ownership, grid),
// move, remove, and that the layout persists on the account. Mirrors the
// mock-socket harness.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-housing-');

const { HOME_GRID, FURNITURE, footprintCells } = require('../data/furniture.js');

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

// ── Pure data: the catalog + footprint geometry ─────────────────────────────
check('the grid is a sane size', HOME_GRID.w >= 4 && HOME_GRID.h >= 4);
check('catalog has the starter pieces, all cosmetic (no stats)', FURNITURE.length >= 8 && FURNITURE.every((f) => !('atk' in f) && !('def' in f) && f.source));
check('footprint covers w×h cells at rotation 0', footprintCells({ w: 3, h: 2 }, 0, 0, 0).length === 6);
check('rotation 1 swaps the footprint (3×2 → 2×3 cells, same count, different extent)', (() => {
  const c = footprintCells({ w: 3, h: 2 }, 0, 0, 1);
  const maxX = Math.max(...c.map((p) => p[0])), maxY = Math.max(...c.map((p) => p[1]));
  return c.length === 6 && maxX === 1 && maxY === 2; // 2 wide, 3 tall
})());

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];

  function join(tag) {
    const s = makeMockSocket(tag); connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: 0 }));
    return { s, p: h.players.get(s.lastOfType('init').id) };
  }

  const g = join('Homeowner');
  g.p.accountKey = 'homeowner';

  // A fresh home is empty and ships the catalog with ownership flags.
  const st0 = h.homeStateBody(g.p);
  check('a fresh cottage is empty', st0 && st0.pieces.length === 0);
  check('the state ships the grid + the owned catalog', st0.grid.w === HOME_GRID.w && st0.catalog.length === FURNITURE.length && st0.catalog.every((c) => c.owned === true));

  // Place a bed (2×2) at (0,0).
  check('placing a valid piece succeeds', h.homePlace(g.p, 'bed', 0, 0, 0).ok === true);
  check('the placed piece is stored', h.homeStateBody(g.p).pieces.length === 1 && h.homeStateBody(g.p).pieces[0].id === 'bed');

  // Overlap is rejected — a table at (1,1) would sit inside the bed's footprint.
  check('an overlapping placement is rejected', h.homePlace(g.p, 'table', 1, 1, 0).ok === false);
  check('a non-overlapping placement succeeds', h.homePlace(g.p, 'table', 0, 2, 0).ok === true);

  // Out of bounds is rejected (rug is 3×2; at x=6 it runs off the 8-wide grid).
  check('an out-of-bounds placement is rejected', h.homePlace(g.p, 'rug', 6, 0, 0).ok === false);
  check('that same rug fits when it is in bounds', h.homePlace(g.p, 'rug', 4, 0, 0).ok === true);

  // Unknown / unowned pieces are rejected.
  check('an unknown piece id is rejected', h.homePlace(g.p, 'throne_of_skulls', 0, 6, 0).ok === false);

  // Moving a piece: the bed (index 0) to a clear spot, then an overlap check.
  const beforeMove = JSON.stringify(h.homeStateBody(g.p).pieces[0]);
  check('moving a piece to a clear spot succeeds', h.homeMove(g.p, 0, 6, 6, 0).ok === true);
  check('the move took effect', h.homeStateBody(g.p).pieces[0].x === 6 && h.homeStateBody(g.p).pieces[0].y === 6, { was: beforeMove });
  check('a move onto another piece is rejected', h.homeMove(g.p, 0, 0, 2, 0).ok === false); // onto the table at (0,2)

  // Remove.
  const nBefore = h.homeStateBody(g.p).pieces.length;
  check('removing a piece works', h.homeRemove(g.p, 0).ok === true && h.homeStateBody(g.p).pieces.length === nBefore - 1);

  // Persistence: the layout lives on the account, so a re-read sees it.
  check('the layout persists on the account', h.homeOf(g.p).pieces.length === nBefore - 1 && h.homeOf(g.p).pieces.some((p) => p.id === 'table'));

  // A guest (no account) gets a null home, never a crash.
  const guest = join('Drifter');
  check('homeStateBody is null without an account', h.homeStateBody(guest.p) === null);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
