// ---------------------------------------------------------------------------
// Caerdroia, the Walls of Troy: the classical seven-circuit labyrinth, drawn
// from its seed the way it has been taught and drawn as a puzzle.
//
// The seed, on a unit grid with y up: a cross with arms to (0,±2) and (±2,0);
// four right angles with their corners at (±1,±1) and arms to (±1,±2) and
// (±2,±1); four dots at (±2,±2). That leaves sixteen loose ends, numbered
// clockwise from the foot of the cross (TROY_ENDS).
//
// The walls go on one at a time, each over the top of the last: first the top
// of the cross to the end beside it, then the next two loose ends outside that,
// and so on, eight joins in all, the last one the outer wall. Joined to its
// right neighbour first, the k-th join is ends (8−k, 9+k mod 16) and the way in
// opens just left of the foot of the cross; joined to its left first, it is the
// mirror image, (7−k, 8+k), opening on the right. Either is the true figure.
//
// Checked by flooding a rasterised drawing (both orientations): one unbroken
// path from the way in to the centre, through the circuits in the order
// 3-2-1-4-7-6-5 (1 = outermost) and then the centre. No published source we
// found spells the joining order out in words; the check is the verification.
// ---------------------------------------------------------------------------

const TROY_ENDS = [
  [0, -2], [-1, -2], [-2, -2], [-2, -1], [-2, 0], [-2, 1], [-2, 2], [-1, 2],
  [0, 2], [1, 2], [2, 2], [2, 1], [2, 0], [2, -1], [2, -2], [1, -2],
];
const TROY_END_NAMES = [
  'the foot of the cross',
  'the lower left corner, its downward arm',
  'the lower left dot',
  'the lower left corner, its arm to the left',
  'the left arm of the cross',
  'the upper left corner, its arm to the left',
  'the upper left dot',
  'the upper left corner, its upward arm',
  'the top of the cross',
  'the upper right corner, its upward arm',
  'the upper right dot',
  'the upper right corner, its arm to the right',
  'the right arm of the cross',
  'the lower right corner, its arm to the right',
  'the lower right dot',
  'the lower right corner, its downward arm',
];
// The seed's strokes, as segments, and its dots.
const TROY_SEED = {
  lines: [
    [[0, -2], [0, 2]], [[-2, 0], [2, 0]],
    [[1, 2], [1, 1]], [[1, 1], [2, 1]], [[-1, 2], [-1, 1]], [[-1, 1], [-2, 1]],
    [[1, -2], [1, -1]], [[1, -1], [2, -1]], [[-1, -2], [-1, -1]], [[-1, -1], [-2, -1]],
  ],
  dots: [[2, 2], [-2, 2], [2, -2], [-2, -2]],
};
const TROY_JOINS = 8;
// The circuits the path runs through, outermost = 1 (checked by the flood).
const TROY_PATH = [3, 2, 1, 4, 7, 6, 5];

const same = (p, a, b) => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a);
// Which way the drawing turns, from its first join: 'right', 'left', or null.
function troyHand(joins) {
  if (!joins || !joins.length) return null;
  if (same(joins[0], 8, 9)) return 'right';
  if (same(joins[0], 7, 8)) return 'left';
  return null;
}
// The k-th join, for a drawing turning that way.
function troyExpected(hand, k) {
  return hand === 'left' ? [7 - k, (8 + k) % 16] : [8 - k, (9 + k) % 16];
}

// null if joining ends a and b is the next wall of a true drawing, else why not.
function troyJoinProblem(joins, a, b) {
  joins = Array.isArray(joins) ? joins : [];
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a > 15 || b > 15) return 'Join two of the loose ends.';
  if (a === b) return 'A wall joins two different ends.';
  if (joins.length >= TROY_JOINS) return 'The walls are all drawn.';
  if (joins.some((j) => j[0] === a || j[1] === a || j[0] === b || j[1] === b)) return 'That end is already joined to a wall.';
  if (!joins.length) {
    if (same([a, b], 8, 9) || same([a, b], 7, 8)) return null;
    return 'Begin at the top of the cross: swing a wall over from it to the end beside it, on either side.';
  }
  const want = troyExpected(troyHand(joins), joins.length);
  if (same([a, b], want[0], want[1])) return null;
  return 'Each new wall goes over the top of the last, joining the next loose end on each side of it.';
}

// A whole drawing, checked join by join: null if it is the true figure.
function troyProblem(joins) {
  if (!Array.isArray(joins) || joins.length !== TROY_JOINS) return 'There are eight walls to draw.';
  for (let k = 0; k < joins.length; k++) {
    const j = joins[k];
    if (!Array.isArray(j)) return 'Join two of the loose ends.';
    const why = troyJoinProblem(joins.slice(0, k), j[0], j[1]);
    if (why) return why;
  }
  return null;
}

const TROY_LORE = {
  use: 'The seed first, as the old drawers did: a cross, four corners, four dots. Then swing the first wall from the top of the cross over to the end beside it, left or right, and every wall after over the top of the last, joining the next loose end on each side. Eight walls, and the last is the outer one.',
  doneNote: 'Caerdroia drawn, seven circuits about the centre, the way running 3-2-1-4-7-6-5 and in',
};

module.exports = { TROY_ENDS, TROY_END_NAMES, TROY_SEED, TROY_JOINS, TROY_PATH, troyHand, troyExpected, troyJoinProblem, troyProblem, TROY_LORE };
