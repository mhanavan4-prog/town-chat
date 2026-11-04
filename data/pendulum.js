// The Pendulum (Tier 3.5 → divination) — the lightest reading in the craft. Ask
// a yes/no question, let the thread swing, and read its answer. Unlike the
// day-stable tarot and omen, the pendulum answers the QUESTION: the same question
// asked twice in a day gets the same answer (no re-rolling until you like it),
// seeded by the gazer + the question + the UTC day. Pure flavor, never a promise.

const PENDULUM = {
  yes: [
    'It swings toward you, a slow steady circle. Yes.',
    'Clockwise, sure and unhurried. The thread says yes.',
    'It leans in and will not be still. Yes — and soon.',
    'A clean, wide circle. Yes, without hedging.',
    'It pulls forward like it already knows the way. Yes.',
  ],
  no: [
    'It pulls away and flattens to a line. No.',
    'Side to side, like a head slowly shaking. No.',
    'The thread goes taut and still. The answer is no.',
    'Counter-clockwise, winding in on itself. No.',
    'It swings once, then stops dead. No — leave it be.',
  ],
  unclear: [
    'It wobbles, then stills. Not yet — ask again when the moon turns.',
    'A lazy drift, no circle at all. The thread does not know.',
    'It circles one way, then the other. The matter is not settled.',
    'The point hangs trembling, undecided. Even the water is unsure.',
  ],
};

// The verdict + its line, deterministic for a given (seed, question, day). About
// 40% yes / 40% no / 20% unclear — but the thin veil of Samhain resolves the
// unclear ones (the pendulum is surer when the veil is thin).
function pendulumAnswer(seed, question, dayIndex, veilThin) {
  const q = String(question == null ? '' : question).trim().toLowerCase();
  let h = 2166136261 >>> 0; // FNV-1a
  const s = String(seed == null ? '' : seed) + '|' + q + '|' + String(dayIndex | 0);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  const roll = h % 100;
  let verdict;
  if (roll < 40) verdict = 'yes';
  else if (roll < 80) verdict = 'no';
  else verdict = veilThin ? (((h >>> 7) & 1) ? 'yes' : 'no') : 'unclear';
  const pool = PENDULUM[verdict];
  const h2 = Math.imul(h ^ (h >>> 13), 2246822507) >>> 0; // decorrelate line pick from verdict
  return { verdict, line: pool[h2 % pool.length] };
}

module.exports = { PENDULUM, pendulumAnswer };
