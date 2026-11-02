// Player housing — the furniture catalog + home grid. A player's cottage is a
// grid of cells; each placed piece occupies a footprint of cells at a position
// and rotation. This is pure data (the server owns placement truth). Furniture
// is ALWAYS cosmetic — no stats, ever — and `source` says how a piece is got:
//   'default'  — every account owns it (the free starter set)
//   'premium'  — unlocked with Moonstones (`ms`); expression, never access/stats
// ('craft' / 'earned' sources will join the runway later.)

const HOME_GRID = { w: 8, h: 8 }; // the cottage floor, in cells

// footprint w×h is at rotation 0/2; rotation 1/3 swaps them.
const FURNITURE = [
  // ── The free starter set (owned by everyone) ──
  { id: 'rug',          name: 'Woven Rug',     icon: '🟫', w: 3, h: 2, source: 'default' },
  { id: 'bed',          name: 'Cottage Bed',   icon: '🛏️', w: 2, h: 2, source: 'default' },
  { id: 'table',        name: 'Oak Table',     icon: '🪵', w: 2, h: 1, source: 'default' },
  { id: 'chair',        name: 'Chair',         icon: '🪑', w: 1, h: 1, source: 'default' },
  { id: 'bookshelf',    name: 'Bookshelf',     icon: '📚', w: 2, h: 1, source: 'default' },
  { id: 'hearth',       name: 'Stone Hearth',  icon: '🔥', w: 2, h: 1, source: 'default' },
  { id: 'cauldron',     name: 'Cauldron',      icon: '🫙', w: 1, h: 1, source: 'default' },
  { id: 'candle_stand', name: 'Candle Stand',  icon: '🕯️', w: 1, h: 1, source: 'default' },
  { id: 'potted_herb',  name: 'Potted Herb',   icon: '🪴', w: 1, h: 1, source: 'default' },
  { id: 'wall_charm',   name: 'Wall Charm',    icon: '🧿', w: 1, h: 1, source: 'default' },
  // ── The premium decor runway (Moonstone unlocks — cosmetic only) ──
  { id: 'armchair',     name: 'Fireside Armchair', icon: '🛋️', w: 1, h: 1, source: 'premium', ms: 40 },
  { id: 'settee',       name: 'Velvet Settee',     icon: '🛋️', w: 2, h: 1, source: 'premium', ms: 70 },
  { id: 'apothecary',   name: 'Apothecary Cabinet',icon: '🗄️', w: 2, h: 1, source: 'premium', ms: 90 },
  { id: 'potion_station', name: 'Potion Station',  icon: '⚗️', w: 1, h: 1, source: 'premium', ms: 60 },
  { id: 'scholar_desk', name: 'Scholar’s Desk',    icon: '📜', w: 2, h: 1, source: 'premium', ms: 80 },
  { id: 'brew_table',   name: 'Brewing Table',     icon: '🧪', w: 1, h: 1, source: 'premium', ms: 50 },
];
const FURNITURE_BY_ID = FURNITURE.reduce((o, f) => { o[f.id] = f; return o; }, {});

// The cells a piece covers when anchored (top-left) at (x,y) with rotation rot.
function footprintCells(piece, x, y, rot) {
  const swap = (rot === 1 || rot === 3);
  const fw = swap ? piece.h : piece.w;
  const fh = swap ? piece.w : piece.h;
  const cells = [];
  for (let cy = y; cy < y + fh; cy++) for (let cx = x; cx < x + fw; cx++) cells.push([cx, cy]);
  return cells;
}

module.exports = { HOME_GRID, FURNITURE, FURNITURE_BY_ID, footprintCells };
