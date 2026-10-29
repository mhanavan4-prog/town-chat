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

module.exports = { OMENS, omenFor };
