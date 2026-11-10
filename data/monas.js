// ---------------------------------------------------------------------------
// Dee's Monad, constructed by straight line and circle (Monas Hieroglyphica,
// Antwerp, 1564). Theorem I: "It is by the straight line and the circle that
// the first and most simple example and representation of all things may be
// demonstrated"; Theorem XXIII gives the proportions, read here clause by
// clause in Hamilton-Jones's translation (1947). Let one part be AB, with A
// where the stem crosses the crossbar:
//   the stem CK: C three parts below A, K six above ("nine parts" in all);
//   the crossbar DE: two parts either side of A;
//   the Sun: a circle about I, three parts above A, through B, one above A,
//     "having a visible center" (Theorem III), so its centre is marked;
//   the Moon: a half-circle about K on the diameter FP, two parts either side,
//     its horns up (Theorem IV, "the figure of the Horns");
//   Aries: half-circles about M and N, one part either side of C, meeting at C
//     (Theorem XI, "two semicircles connected by one common point").
// Coordinates are in parts, x across and y up, with A at (0, 0). The half-
// Moon's half-circle hangs below its diameter, so its horns point up ("the
// figure of the Horns"); the Aries half-circles arch above theirs, as the
// astronomical sign ♈︎ does (Theorem X names that sign). The text doesn't say
// so in words; the sides follow the signs it names.
// ---------------------------------------------------------------------------
const MONAS_LATTICE = { xMin: -3, xMax: 3, yMin: -4, yMax: 7 };
const MONAS_REQUIRED = [
  { tool: 'line', a: [0, -3], b: [0, 6], what: 'the stem, from C three parts below A to K six above: nine parts in all' },
  { tool: 'line', a: [-2, 0], b: [2, 0], what: 'the crossbar, two parts either side of A' },
  { tool: 'circle', c: [0, 3], r: 2, what: 'the Sun, a circle about I (three parts above A) through B' },
  { tool: 'dot', c: [0, 3], what: 'the Sun\'s visible centre, at I' },
  { tool: 'cup', c: [0, 6], r: 2, what: 'the Moon\'s horns, a half-circle about K, two parts either way, hanging below so the horns point up' },
  { tool: 'arch', c: [-1, -3], r: 1, what: 'the left horn of Aries, a half-circle about M, one part left of C, through C, arching up as in ♈︎' },
  { tool: 'arch', c: [1, -3], r: 1, what: 'the right horn of Aries, a half-circle about N, one part right of C, through C, arching up as in ♈︎' },
];
const pt = (p) => Array.isArray(p) && p.length === 2 && p.every((v) => Number.isInteger(Number(v))) ? [Number(p[0]), Number(p[1])] : null;
function canon(e) {
  if (!e || typeof e !== 'object') return null;
  if (e.tool === 'line') {
    const a = pt(e.a), b = pt(e.b);
    if (!a || !b || (a[0] === b[0] && a[1] === b[1])) return null;
    const [p, q] = [a, b].sort((u, v) => u[0] - v[0] || u[1] - v[1]);
    return `line:${p}:${q}`;
  }
  if (e.tool === 'circle' || e.tool === 'cup' || e.tool === 'arch') {
    const c = pt(e.c), t = pt(e.through);
    if (!c || !t) return null;
    const r = Math.hypot(t[0] - c[0], t[1] - c[1]);
    if (!(r > 0) || Math.abs(r - Math.round(r)) > 1e-9) return null;
    return `${e.tool}:${c}:${Math.round(r)}`;
  }
  if (e.tool === 'dot') { const c = pt(e.c); return c ? `dot:${c}` : null; }
  return null;
}
const keyOf = (r) => (r.tool === 'line' ? `line:${[r.a, r.b].sort((u, v) => u[0] - v[0] || u[1] - v[1]).join(':')}` : r.tool === 'dot' ? `dot:${r.c}` : `${r.tool}:${r.c}:${r.r}`);
const REQUIRED_KEYS = MONAS_REQUIRED.map(keyOf);
// Returns null if the elements make the Monad, else what's wrong, in Dee's terms.
function monasProblem(elements) {
  if (!Array.isArray(elements) || !elements.length) return 'Nothing is drawn yet.';
  if (elements.length > 20) return 'Too many marks: rub it out and begin again.';
  const keys = elements.map(canon);
  if (keys.includes(null)) return 'Every mark is a straight line between two points, a circle or half-circle about a centre, or a point.';
  const have = new Set(keys);
  for (const k of keys) if (!REQUIRED_KEYS.includes(k)) return 'One of your marks is not in Dee\'s figure. Undo it.';
  if (have.size !== keys.length) return 'You drew one mark twice.';
  const missing = MONAS_REQUIRED.find((r) => !have.has(keyOf(r)));
  if (missing) return `Still to draw: ${missing.what}.`;
  return null;
}
const MONAS_XP = 40;
const MONAS_LORE = "John Dee printed his Monas Hieroglyphica at Antwerp in 1564, dedicated to \"the famous King Maximilian\", and said he wrote it between 13 and 25 January. One sign joins the Sun, \"a circle having a visible center\", the Moon's horns, a cross of two straight lines, and \"the astronomical sign Aries to signify that in the practice of this Monad the use of fire is required\" (Theorems III, IV, X). \"It is by the straight line and the circle,\" Theorem I begins, that all things may be shown, and Theorem XXIII gives the proportions you draw by. It was a cabalist's and alchemist's hieroglyph for contemplation, not a charm against harm.";
const MONAS_SOURCE = 'J. Dee, Monas Hieroglyphica (Antwerp: W. Silvius, 1564), trans. J. W. Hamilton-Jones (1947), Theorems I–IV, X, XI, XXIII · C. H. Josten, Ambix 12 (1964), 84–221 · S. Clucas, "The Royal Typographer and the Alchemist"';
module.exports = { MONAS_LATTICE, MONAS_REQUIRED, monasProblem, MONAS_XP, MONAS_LORE, MONAS_SOURCE };
