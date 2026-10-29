// Daily Tarot (data/tarot.js) — the deck's integrity and the once-per-UTC-day
// gate the server enforces (same day → the same card, no new reward; new day →
// a fresh draw).
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const { TAROT_CARDS } = require('../data/tarot.js');

// ── Deck integrity ────────────────────────────────────────────────────────────
check('the deck has the 22 Major Arcana', TAROT_CARDS.length === 22, TAROT_CARDS.length);
const keys = TAROT_CARDS.map((c) => c.key);
check('every card key is unique', new Set(keys).size === keys.length, keys.length);
check('every card has key/name/emoji/reading', TAROT_CARDS.every((c) => c.key && c.name && c.emoji && c.reading));
check('readings are real sentences', TAROT_CARDS.every((c) => c.reading.length > 20));

// ── The daily gate (mirror of the server handler's day logic) ────────────────
// A fake account + clock; the handler stores lastTarotDay/lastTarotCard and
// only rewards on a new UTC day.
function draw(acc, nowMs, pickIndex) {
  const today = Math.floor(nowMs / 86400000);
  if (acc.lastTarotDay === today && acc.lastTarotCard) {
    return { card: acc.lastTarotCard, gold: 0, alreadyDrawn: true };
  }
  const card = TAROT_CARDS[pickIndex % TAROT_CARDS.length];
  acc.lastTarotDay = today; acc.lastTarotCard = card.key;
  return { card: card.key, gold: 20, alreadyDrawn: false };
}

const DAY = 86400000;
const acc = {};
const d1 = draw(acc, 100 * DAY + 1000, 3);
check('first draw of the day rewards gold', d1.gold === 20 && d1.alreadyDrawn === false, d1);
const d1b = draw(acc, 100 * DAY + 5 * 3600000, 7); // same UTC day, later
check('a second draw the same day gives no new reward', d1b.gold === 0 && d1b.alreadyDrawn === true, d1b);
check('the same day returns the same card', d1b.card === d1.card, { first: d1.card, again: d1b.card });
const d2 = draw(acc, 101 * DAY + 1000, 9); // next UTC day
check('a new day allows a fresh rewarded draw', d2.gold === 20 && d2.alreadyDrawn === false, d2);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
