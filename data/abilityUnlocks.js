// When each of a class's abilities unlocks.
//
// Every class used to have all of its abilities on the bar from level 1, which
// is a wall of buttons to someone who has just arrived. Now a class starts
// with three (the first three of its default order, which leads with something
// that does damage and keeps the consent abilities for last), and the rest
// come one at a time as you level: the next at level 2, then never more than
// two levels apart, and closer together for a class with many, so that every
// class has its whole kit by level 18 (the Werewolf's sixteen) or sooner (the
// Necromancer's six, by level 6).
//
// An ability can name its own level instead (unlockLevel in its catalog
// entry): Pickpocket, which every class can learn, comes at level 4 whatever
// else the class has. Those do not take a place in the sequence.
//
// Levels and XP are untouched: this only reads the level you already have.
const UNLOCK_START = 3;      // how many you begin with
const UNLOCK_FIRST = 2;      // the level the next one comes at
const UNLOCK_LAST = 18;      // and the level the last one comes at

function abilityUnlockLevels(orderedIds, catalog) {
  const out = {};
  const seq = orderedIds.filter((id) => !(catalog && catalog[id] && catalog[id].unlockLevel));
  const later = seq.length - UNLOCK_START;                       // how many come after the first three
  seq.forEach((id, n) => {
    if (n < UNLOCK_START) { out[id] = 1; return; }
    const k = n - UNLOCK_START;
    // (never more than two levels apart: a small kit is complete early rather than strung out to 18)
    out[id] = Math.round(UNLOCK_FIRST + k * Math.min(2, later <= 1 ? 2 : (UNLOCK_LAST - UNLOCK_FIRST) / (later - 1)));
  });
  for (const id of orderedIds) if (!(id in out)) out[id] = catalog[id].unlockLevel;
  return out;
}
// The abilities that open between two levels (after `from`, up to and including `to`).
function abilitiesOpenedBetween(levels, from, to) {
  return Object.keys(levels).filter((id) => levels[id] > from && levels[id] <= to).sort((a, b) => levels[a] - levels[b]);
}

module.exports = { UNLOCK_START, UNLOCK_FIRST, UNLOCK_LAST, abilityUnlockLevels, abilitiesOpenedBetween };
