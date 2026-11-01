// Player housing (slice 1) — the furniture catalog + home grid. A player's
// cottage is a grid of cells; each placed piece occupies a footprint of cells at
// a position and rotation. This is pure data (the server owns placement truth);
// rendering comes in a later slice. Furniture is ALWAYS cosmetic — no stats,
// ever — and `source` says how a piece is obtained (MVP ships only 'default',
// which every account owns; 'craft' / 'premium' / 'earned' arrive with the runway).

const HOME_GRID = { w: 8, h: 8 }; // the cottage floor, in cells

// footprint w×h is at rotation 0/2; rotation 1/3 swaps them. All MVP pieces are
// 'default' (owned by everyone) so the loop is playable before the runway lands.
const FURNITURE = [
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
