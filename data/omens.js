// The Scrying Bowl's omen (Tier 3.5) — the divination counterpart to the daily
// tarot. Where tarot turns a card for the inner life, the bowl reads the OUTER
// world: the turning of the wheel (moon, blood moon, the next sabbat), drawn
// live from the calendar, plus one authored portent for the day.
//
// The omen is flavor only — a short, evocative line, never a concrete promise.
// It is seeded by the gazer and the day so it holds steady from dawn to dusk
// and differs from witch to witch. The wheel-reading beside it is the useful
// part, and that is all live calendar math, not stored here.

const OMENS = [
  'Still water, still mind. What you seek is closer than it looks.',
  'A door you thought shut is only latched. Try it again.',
  'Something you lost will circle back on the wind. Be ready to catch it.',
  'The crowd will pull one way; your luck lies the other.',
  'A debt is coming due — in your favor, for once.',
  'Do not trust the first face the water shows you. Wait for the second.',
  'The long road is the safe one today. The shortcut bites.',
  'An old friend thinks of you tonight. The water does not say kindly or not.',
  'What you build now will outlast you. Build it square.',
  'Rest is not idleness. The bowl says: stop, and let the silt settle.',
  'A small kindness returns tenfold before the moon turns.',
  'The thing you fear has less teeth than its shadow. Walk up to it.',
  'Keep your lantern low tonight. Not everything that follows means well.',
  'Fortune favors the one who asks twice. Do not take the first no.',
  'The ripple you make today reaches a far shore. Make it a good one.',
  'Something hidden wants to be found. Look where you have already looked.',
];

// Deterministic pick — pure, so the server and the tests agree. A tiny string
// hash over the gazer's seed folded with the UTC day index; stable all day,
// varied between players and across days.
function omenFor(seedStr, dayIndex, count) {
  const n = (count && count > 0) ? count : OMENS.length;
  let h = 2166136261 >>> 0; // FNV-1a basis
  const s = String(seedStr == null ? '' : seedStr) + '|' + String(dayIndex | 0);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h % n;
}

// The DEEP reading — drawn only when a gazer pours a vial of moon water into the
// bowl. Where the daily omen is one day-stable line, this is a three-fold scry
// (the tide behind you, the water now, the shore ahead) drawn FRESH each time,
// from a richer, more specific pool. Still flavor, never a concrete promise.
const DEEP_OMENS = [
  'A name you have not spoken in years is about to be spoken back to you.',
  'Three roads open this season; the muddiest of them carries the gold.',
  'Someone counts you an enemy who ought to be a friend. Speak first.',
  'What you buried did not stay buried. Better to meet it in daylight.',
  'A door closes behind you — do not waste your strength prying it open again.',
  'The coin you lend now returns as something you cannot yet name.',
  'You have been reading the room wrong. The quiet one is the one to watch.',
  'A journey you keep putting off is the very thing you have been waiting for.',
  'The wound you hide is plain to the one who loves you. Let them see it.',
  'Luck is pooling under your feet like groundwater. Dig where you already stand.',
  'An old promise comes due. Keeping it will cost far less than you fear.',
  'What you call a failure, the water calls a turning. Walk through it.',
  'You will be asked to choose between being right and being kind. Choose well.',
  'What ends this season was always meant to end. Thank it, and let the water take it.',
];

// Three distinct deep omens, seeded by the gazer + a salt (the moment of
// gazing), so each pour of moon water draws a fresh reading. Pure + deterministic
// for a given (seed, salt) so the server and tests agree.
function deepReading(seedStr, salt) {
  const n = DEEP_OMENS.length;
  let h = 2166136261 >>> 0;
  const s = String(seedStr == null ? '' : seedStr) + '|' + String(salt == null ? 0 : salt);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  const picks = [];
  while (picks.length < 3 && picks.length < n) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; // xorshift-ish advance
    const idx = h % n;
    if (picks.indexOf(idx) === -1) picks.push(idx);
  }
  return picks.map((i) => DEEP_OMENS[i]);
}

module.exports = { OMENS, omenFor, DEEP_OMENS, deepReading };
