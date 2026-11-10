// ---------------------------------------------------------------------------
// Agrippa's tables of the planets, filled in at the Real Shelf.
//
// De occulta philosophia (Cologne, 1533), Book II ch. 22, as Englished by J.F.
// (London, 1651), sets out seven "tables of the planets", number squares from
// Saturn's three-by-three to the Moon's nine-by-nine, every row, column and
// diagonal summing alike. The two smallest are here, as printed in 1651
// (EEBO-TCP A26565, p. 244, "The Table of Saturn in his compass" and "…of
// Jupiter…"). Every row, column and diagonal below has been checked.
//
// Saturn's table starts blank: there is only one three-by-three magic square,
// in eight turns and mirrorings (counted by machine), and any of them is
// taken, with a word on whether it is Agrippa's own way round. Jupiter's
// starts with its four corners and its four middle numbers in place, as
// Agrippa has them; with those, his is the only square that can be finished
// (also counted by machine).
//
// Tracing a name's sigil across a square is not Agrippa's: he says the seals
// are "drawn" from the tables but leaves it to "the wise searcher"; the
// tracing method is a later, Golden Dawn practice (revival), and is not here.
// ---------------------------------------------------------------------------

const KAMEA = {
  saturn: {
    name: 'The Table of Saturn', symbol: '♄', n: 3, sum: 15, total: 45,
    table: [[4, 9, 2], [3, 5, 7], [8, 1, 6]],
    givens: [],
    says: '"a square of three, containing the particular numbers of nine, and in every line three every way, and through each Diameter making fifteen. Now the whole sum of numbers is fourty five."',
    use: 'With a fortunate Saturn, "engraven on a plate of lead", Agrippa says it "doth help to bring forth, or birth, and to make a man safe, and powerfull"; with an unfortunate one, it "hinders buildings, plantings" and "disperses an Army".',
    xp: 25,
  },
  jupiter: {
    name: 'The Table of Jupiter', symbol: '♃', n: 4, sum: 34, total: 136,
    table: [[4, 14, 15, 1], [9, 7, 6, 12], [5, 11, 10, 8], [16, 2, 3, 13]],
    givens: [[0, 0], [0, 3], [3, 0], [3, 3], [1, 1], [1, 2], [2, 1], [2, 2]],
    says: '"a Quaternian drawn into it self, containg sixteen particular numbers", every line "making thirty four. Now the Sum of all is 136."',
    use: '"Impressed upon a Silver plate with Jupiter being powerfull, and ruling, it conduceth to gain, and riches, favor, and love", and engraved on coral it was to dissolve enchantments.',
    xp: 40,
  },
};
// Dürer's square in Melencolia I (1514), as the National Gallery of Art reads
// it: the same sums as Jupiter's, but not the same square, nor a turn or
// mirror of it (checked); 1514 sits in its bottom row.
const DURER = [[16, 3, 2, 13], [5, 10, 11, 8], [9, 6, 7, 12], [4, 15, 14, 1]];

const same = (a, b) => a.length === b.length && a.every((r, i) => r.length === b[i].length && r.every((v, j) => v === b[i][j]));
const turn = (g) => g[0].map((_, j) => g.map((r) => r[j]).reverse());
const flip = (g) => g.map((r) => r.slice().reverse());
function turnsOf(g) {
  const out = []; let t = g;
  for (let k = 0; k < 4; k++) { out.push(t, flip(t)); t = turn(t); }
  return out;
}

// null if the grid is the table filled in right, else a reason.
function kameaProblem(key, grid) {
  const k = KAMEA[key];
  if (!k) return 'No such table.';
  const n = k.n;
  if (!Array.isArray(grid) || grid.length !== n || !grid.every((r) => Array.isArray(r) && r.length === n)) return `Fill in every square of the ${n} by ${n}.`;
  const g = grid.map((r) => r.map((v) => Number(v)));
  if (g.some((r) => r.some((v) => !Number.isInteger(v)))) return `Fill in every square of the ${n} by ${n}.`;
  if (g.some((r) => r.some((v) => v < 1 || v > n * n))) return `Use the numbers 1 to ${n * n}.`;
  const seen = new Set(g.flat());
  if (seen.size !== n * n) {
    const twice = g.flat().find((v, i, a) => a.indexOf(v) !== i);
    return `Each number once: ${twice} is there twice.`;
  }
  for (const [i, j] of k.givens) if (g[i][j] !== k.table[i][j]) return 'Leave the numbers Agrippa gives where he put them.';
  const S = k.sum;
  for (let i = 0; i < n; i++) if (g[i].reduce((a, b) => a + b, 0) !== S) return `Row ${i + 1} makes ${g[i].reduce((a, b) => a + b, 0)}, not ${S}.`;
  for (let j = 0; j < n; j++) { const c = g.reduce((a, r) => a + r[j], 0); if (c !== S) return `Column ${j + 1} makes ${c}, not ${S}.`; }
  const d1 = g.reduce((a, r, i) => a + r[i], 0), d2 = g.reduce((a, r, i) => a + r[n - 1 - i], 0);
  if (d1 !== S) return `The diagonal from the top left makes ${d1}, not ${S}.`;
  if (d2 !== S) return `The diagonal from the top right makes ${d2}, not ${S}.`;
  return null;
}
// How a right answer stands to Agrippa's printed table.
function kameaWhich(key, grid) {
  const k = KAMEA[key];
  const g = grid.map((r) => r.map(Number));
  if (same(g, k.table)) return 'agrippa';
  if (turnsOf(k.table).some((t) => same(t, g))) return 'turned';
  return 'other';
}

const KAMEA_LORE = "Agrippa's book (Cologne, 1533) set out seven \"tables of the planets\", from Saturn's three-by-three to the Moon's nine-by-nine, every row, column and diagonal summing alike, each to be cut on its planet's metal under a strong planet: lead for Saturn, silver for Jupiter, iron for Mars, gold for the Sun. From each he drew the seals of a planet's Intelligence and Spirit, Agiel and Zazel for Saturn, but he never says how: that is left to \"the wise searcher\". Tracing your own name across a square to make a sigil is a later habit; the Museum of Witchcraft and Magic holds Golden Dawn boards of \"Mystical Seals and Names drawn from the Kamea of Moon\", dated 1910. The three-by-three is far older than Agrippa, the Luoshu of China. And a square nineteen years older than his book hangs in Dürer's engraving Melencolia I (1514), summing to thirty-four with the year in its bottom row; it is not Agrippa's Jupiter, nor that turned or mirrored. If you would cut Saturn's in lead, don't: you take lead in if you 'eat, drink, smoke or bite your nails without washing your hands and face' (HSE). Paper does as well.";
const KAMEA_SOURCE = 'H. C. Agrippa, Three Books of Occult Philosophy, trans. J.F. (London, 1651), II.22, pp. 239–252 (EEBO-TCP A26565) · National Gallery of Art, Washington, Albrecht Dürer, Melencolia I (1514) · Museum of Witchcraft and Magic, objects 3898 and 3905 · HSE, "Lead: who is most at risk"';

module.exports = { KAMEA, DURER, kameaProblem, kameaWhich, KAMEA_LORE, KAMEA_SOURCE };
