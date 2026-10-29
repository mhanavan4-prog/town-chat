// Daily Tarot (data/tarot.js) — a three-card spread: deck integrity, the
// upright/reversed meanings, the positions, the synthesis, and the once-per-UTC
// day gate the server enforces (same day → the same spread, no new reward).
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const { TAROT_CARDS, TAROT_POSITIONS, tarotSynthesis } = require('../data/tarot.js');

// ── Deck integrity ────────────────────────────────────────────────────────────
check('the deck has the 22 Major Arcana', TAROT_CARDS.length === 22, TAROT_CARDS.length);
const keys = TAROT_CARDS.map((c) => c.key);
check('every card key is unique', new Set(keys).size === keys.length, keys.length);
check('every card has key/name/emoji/num', TAROT_CARDS.every((c) => c.key && c.name && c.emoji && c.num));
check('every card has an upright and a reversed meaning', TAROT_CARDS.every((c) => c.reading && c.reversed));
check('both meanings are real sentences', TAROT_CARDS.every((c) => c.reading.length > 20 && c.reversed.length > 20));
check('numbers are unique (0..XXI)', new Set(TAROT_CARDS.map((c) => c.num)).size === 22);

// ── The spread's three seats ─────────────────────────────────────────────────
check('the spread has three positions', Array.isArray(TAROT_POSITIONS) && TAROT_POSITIONS.length === 3, TAROT_POSITIONS);
check('each position has a label + hint', TAROT_POSITIONS.every((p) => p.label && p.hint));

// ── The synthesis reads the three together ───────────────────────────────────
const spread = [
  { card: TAROT_CARDS[4], reversed: false }, // The Emperor
  { card: TAROT_CARDS[13], reversed: true },  // Death, reversed
  { card: TAROT_CARDS[19], reversed: false }, // The Sun
];
const synth = tarotSynthesis(spread);
check('synthesis is a non-empty string', typeof synth === 'string' && synth.length > 20, synth);
check('synthesis names all three cards', ['The Emperor', 'Death', 'The Sun'].every((n) => synth.includes(n)), synth);
check('synthesis marks the reversed card', synth.includes('reversed'), synth);
check('synthesis of a short spread is empty', tarotSynthesis([{ card: TAROT_CARDS[0], reversed: false }]) === '');

// ── The daily gate (mirror of the server handler) — a new UTC day re-deals ────
function dealsToday(acc, nowMs) {
  const today = Math.floor(nowMs / 86400000);
  if (acc.lastTarotDay === today && acc.lastTarotSpread) return { spread: acc.lastTarotSpread, gold: 0, alreadyDrawn: true };
  const s = [{ key: 'emperor', rev: false }, { key: 'death', rev: true }, { key: 'sun', rev: false }];
  acc.lastTarotDay = today; acc.lastTarotSpread = s;
  return { spread: s, gold: 20, alreadyDrawn: false };
}
const DAY = 86400000;
const acc = {};
const d1 = dealsToday(acc, 100 * DAY + 1000);
check('first spread of the day rewards gold', d1.gold === 20 && d1.alreadyDrawn === false, d1);
const d1b = dealsToday(acc, 100 * DAY + 5 * 3600000);
check('a second look the same day gives no new reward', d1b.gold === 0 && d1b.alreadyDrawn === true, d1b);
check('the same day returns the same spread', d1b.spread === d1.spread);
const d2 = dealsToday(acc, 101 * DAY + 1000);
check('a new day allows a fresh rewarded spread', d2.gold === 20 && d2.alreadyDrawn === false, d2);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
