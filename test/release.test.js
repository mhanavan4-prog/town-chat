// The Release Fire (data/release.js) — the letting-go rite. Instant payoff
// (cleanse + small growth), gated to the Samhain season and to once a day.
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const { RELEASE_XP, RELEASE_PROMPTS } = require('../data/release.js');

check('the growth is a modest positive XP', typeof RELEASE_XP === 'number' && RELEASE_XP > 0 && RELEASE_XP <= 100, RELEASE_XP);
check('some example burdens are offered', Array.isArray(RELEASE_PROMPTS) && RELEASE_PROMPTS.length >= 1, RELEASE_PROMPTS);
for (const p of RELEASE_PROMPTS) check(`prompt is a non-empty string`, typeof p === 'string' && p.trim().length > 0, p);

// The daily gate (mirror of server): one letting-go per UTC day.
const dayIndex = (ms) => Math.floor(ms / 86400000);
check('same UTC day is gated', dayIndex(1000) === dayIndex(3600000));
check('next UTC day reopens', dayIndex(0) !== dayIndex(90000000));

// The self-cleanse predicate (mirror of server): the fire burns away a curse
// that clings, and does nothing when none does.
const VULNERABLE = new Set(['wither', 'stumble', 'shrink', 'toad', 'gibberish', 'wolfmark']);
function burns(activeStatus) {
  return !!(activeStatus && activeStatus.type && VULNERABLE.has(activeStatus.type));
}
check('a clinging curse burns away', burns({ type: 'wither', expiresAt: 1 }) === true);
check('a non-curse status is left be', burns({ type: 'regen', expiresAt: 1 }) === false);
check('no status = nothing to burn', burns(null) === false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
