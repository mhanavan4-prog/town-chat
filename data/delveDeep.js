// The Deep: what lies under the tenth floor of the Delve.
//
// Down to the tenth floor each floor is a fixed step harder than the last. Below
// it the steps themselves grow, so there is always a floor that will end a run;
// how far down that is, is the measure. The deepest a witch has ever been is
// kept for good (the weekly board still starts fresh each week), and three
// depths give a title. Nothing here gives power.
//
// No lore is claimed for this: the Delve and the Deep are the game's own.
const DEEP = {
  from: 10,          // the last floor before the Deep
  step: 0.12,        // each floor's added hardness down to there (as it has always been)
  steepen: 1.06,     // and from there each floor is this much harder again, compounding
  honours: [
    { depth: 10, title: 'deep_ten' },
    { depth: 20, title: 'deep_twenty' },
    { depth: 30, title: 'deep_thirty' },
  ],
  top: 10,           // how many names the all-time board shows
};

// How much harder than the first floor a floor's creatures are.
function deepMult(floor) {
  const f = Math.max(1, Math.floor(floor) || 1);
  const base = 1 + DEEP.step * (Math.min(f, DEEP.from) - 1);
  return f <= DEEP.from ? base : base * Math.pow(DEEP.steepen, f - DEEP.from) + DEEP.step * (f - DEEP.from);
}

module.exports = { DEEP, deepMult };
