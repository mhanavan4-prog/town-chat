// The default order a class's abilities appear in — the one source of truth for
// "slot 1, slot 2, …" that both the in-game hotbar and the website's class
// pages have to agree on.
//
// Two rules:
//  1. Abilities that ask another player for consent (their camera, their rough
//     location) sit at the END. They are opt-in social tools, not opening
//     moves, and leading a kit with one reads as if the game is about them.
//  2. A class should lead with something that actually does damage, so slot 1
//     is useful the moment you join. If the first non-consent ability isn't a
//     damage/summon, the first damage one is promoted to the front.
//
// Keep CONSENT_EFFECTS in sync with client/main.js (test/class-showcase.test.js
// asserts the two lists match).
const CONSENT_EFFECTS = new Set(['camera', 'howl_location']);

function defaultAbilityOrder(cat) {
  const ids = Object.keys(cat);
  const consent = ids.filter((id) => CONSENT_EFFECTS.has(cat[id] && cat[id].effect));
  const rest = ids.filter((id) => consent.indexOf(id) === -1);
  const lead = cat[rest[0]] && (cat[rest[0]].effect === 'damage' || cat[rest[0]].effect === 'summon');
  if (!lead) {
    const dmg = rest.findIndex((id) => cat[id] && cat[id].effect === 'damage');
    if (dmg > 0) rest.unshift(rest.splice(dmg, 1)[0]);
  }
  return rest.concat(consent);
}

module.exports = { CONSENT_EFFECTS, defaultAbilityOrder };
