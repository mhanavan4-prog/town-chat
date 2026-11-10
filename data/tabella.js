// ---------------------------------------------------------------------------
// A Bath curse tablet (tabella defixionis), put together clause by clause.
//
// About 130 small sheets of lead and pewter came out of the sacred spring at
// Bath in 1979–80, written between the 2nd and 4th centuries. R. S. O. Tomlin
// edited them as Tabellae Sulis (1988); the texts and translations below are
// his, as abridged on RIB Online (romaninscriptionsofbritain.org/tabsulis).
//
// Every tile is the tablets' own wording, and says which tablet it is from.
// Two are adapted, and say so: the petitioner's name is the caller's, and the
// gift clause puts his hooded cloak where Solinus put "my bathing tunic and
// cloak" (Tab. Sulis 32).
//
// The order is the order the tablets keep. Tab. Sulis 10 begins with the
// petitioner's name and 32 with the goddess, so either may come first; 10 puts
// the unknown thief ("whether man or woman…") before what is to be denied him
// and 32 after, so those two may come in either order; the stolen thing is
// cursed or given in the third place; and the way out, "until he has brought
// … to the temple", always comes last.
// ---------------------------------------------------------------------------

const TABELLA_PARTS = {
  address: 'the goddess',
  name: 'the name of the one who lost it',
  plea: 'the curse or the gift',
  thief: 'the thief nobody knows',
  condition: 'what she is to deny him',
  return: 'the way out',
};

// One petition's tiles: the cloak stolen at the bath-house (Tab. Sulis 10's
// "caracallam meam", a hooded cloak).
const TABELLA_TILES = [
  { key: 'suli_minervae', part: 'address', latin: 'deae Suli Minervae', en: 'To the goddess Sulis Minerva', src: 'Tab. Sulis 32' },
  { key: 'sanctissimae', part: 'address', latin: 'deae sanctissimae Suli', en: 'To the most holy goddess Sulis', src: 'Tab. Sulis 10' },
  { key: 'name', part: 'name', latin: 'Jonah Wellow', en: 'His own name, as Docilianus son of Brucerus wrote his', src: 'the caller\'s, after Tab. Sulis 10' },
  { key: 'devoveo', part: 'plea', latin: 'devoveo eum qui caracallam meam involaverit', en: 'I curse him who has stolen my hooded cloak', src: 'Tab. Sulis 10' },
  { key: 'dono', part: 'plea', latin: 'dono numini tuo maiestati caracallam meam', en: 'I give to your divinity and majesty my hooded cloak', src: 'after Tab. Sulis 32, which gives "my bathing tunic and cloak"' },
  { key: 'si_vir', part: 'thief', latin: 'si vir si femina si servus si liber', en: 'whether man or woman, whether slave or free', src: 'Tab. Sulis 10 and 32' },
  { key: 'sanitatem', part: 'condition', latin: 'nec permittas somnum nec sanitatem ei qui mihi fraudem fecit', en: 'Do not allow sleep or health to him who has done me wrong', src: 'Tab. Sulis 32' },
  { key: 'nascentes', part: 'condition', latin: 'nec ei somnum permittat nec natos nec nascentes', en: 'and not allow him sleep or children, now or in the future', src: 'Tab. Sulis 10' },
  { key: 'donec', part: 'return', latin: 'donec caracallam meam ad templum sui numinis pertulerit', en: 'until he has brought my hooded cloak to the temple of her divinity', src: 'Tab. Sulis 10' },
  { key: 'nissi', part: 'return', latin: 'nissi se retegens istas species ad templum tuum detulerit', en: 'unless he reveals himself and brings those goods to your temple', src: 'Tab. Sulis 32' },
];

// Written backwards, the ways the Bath tablets were (RIB, "Handwriting"):
// the whole text from its end (Tab. Sulis 98), the letters of each line
// (44, 62), or the letters within each word (4).
const TABELLA_BACKWARDS = {
  none: { label: 'Write it the right way round', src: '' },
  whole: { label: 'The whole text backwards, from its end', src: 'Tab. Sulis 98' },
  lines: { label: 'Each line backwards', src: 'Tab. Sulis 44 and 62' },
  words: { label: 'Each word backwards, in their right order', src: 'Tab. Sulis 4' },
};

const TILE_BY_KEY = Object.fromEntries(TABELLA_TILES.map((t) => [t.key, t]));
const PART_ORDER = Object.keys(TABELLA_PARTS);

// null when the petition is in the tablets' order, otherwise the reason.
function tabellaProblem(keys) {
  if (!Array.isArray(keys) || keys.length === 0) return 'Put the clauses on the tablet first.';
  if (keys.length > PART_ORDER.length) return 'There are six clauses to a tablet, one of each.';
  const tiles = [];
  for (const k of keys) {
    const t = TILE_BY_KEY[String(k)];
    if (!t) return 'That is not one of the clauses.';
    tiles.push(t);
  }
  const seen = {};
  for (const t of tiles) {
    if (seen[t.part]) return `Each clause goes on once: you have ${TABELLA_PARTS[t.part]} twice.`;
    seen[t.part] = true;
  }
  const missing = PART_ORDER.filter((p) => !seen[p]);
  if (missing.length) return `The tablet still wants ${missing.map((p) => TABELLA_PARTS[p]).join(', ')}.`;
  const at = tiles.map((t) => t.part);
  const pair = (i, a, b) => (at[i] === a && at[i + 1] === b) || (at[i] === b && at[i + 1] === a);
  if (at[5] !== 'return') return 'The way out comes last: it holds only until the goods are brought to the temple.';
  if (!pair(0, 'address', 'name')) return 'Begin with the goddess and the name. Tab. Sulis 32 puts the goddess first, 10 puts the name first; either will do.';
  if (at[2] !== 'plea') return 'Then the stolen thing: curse the thief for it, or give it to the goddess.';
  if (!pair(3, 'thief', 'condition')) return 'Then the thief nobody knows, and what she is to deny him, in either order.';
  return null;
}

const rev = (s) => [...s].reverse().join('');
// The petition as it would be written on the metal, one clause to a line.
function tabellaText(keys, backwards) {
  const lines = (keys || []).map((k) => (TILE_BY_KEY[k] || {}).latin).filter(Boolean);
  if (backwards === 'whole') return lines.map(rev).reverse();
  if (backwards === 'lines') return lines.map(rev);
  if (backwards === 'words') return lines.map((l) => l.split(' ').map(rev).join(' '));
  return lines;
}

const TABELLA_LORE = {
  title: 'A curse tablet, after Bath',
  use: 'Put the six clauses in the order the Bath tablets keep: the goddess and the name (either first), what is done with the stolen thing, then the unknown thief and what she is to deny him (in either order), and the way out last. Every tile is the tablets\' own words and names its tablet.',
  doneNote: 'A tablet written to Sulis for the hooded cloak',
};

module.exports = { TABELLA_PARTS, TABELLA_TILES, TABELLA_BACKWARDS, tabellaProblem, tabellaText, TABELLA_LORE };
