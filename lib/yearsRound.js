// ---------------------------------------------------------------------------
// The Year's Round: the callers who come only on their own day of the year
// (data/callers.js, those with `when`), and which of them an account has
// worked (accounts[k].callers.byId). Working them all earns the title Keeper
// of the Year's Round. Pure: no state.
// ---------------------------------------------------------------------------
const { CALLERS } = require('../data/callers');

const DATED = CALLERS.filter((c) => c.when).map((c) => c.id);

function yearsRound(byId) {
  const b = byId || {};
  const kept = DATED.filter((id) => (b[id] || 0) > 0);
  return { kept, total: DATED.length, done: kept.length === DATED.length };
}

module.exports = { yearsRound, DATED };
