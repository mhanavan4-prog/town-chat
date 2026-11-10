// A Cross for the Rafters: the practical half for a chimney that has caught
// twice (gov.ie's cleaning guide by fuel; Dublin Fire Brigade and Roscommon
// fire service on chimney fires; smoke alarms tested weekly; HSE on carbon
// monoxide); and the lore put right: the fire belief quoted (Ó Longáin, RTÉ,
// 2024; the Kilcullen school account), the old cross burned, left or buried
// to bless the harvest, the Schools' Collection dated 1937–39, and Danaher
// dropped since his text couldn't be read.
const { CALLERS } = require('../data/callers.js');
const { WHEEL_RITES } = require('../data/wheelRites.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'imbolc_brigid_cross');
check('the old scene kept: the cross woven and hung, the old one buried, the sweep sent for', c && /You weave it together at her table and hang it over the door/.test(c.resolution) && /the old black one goes out to be buried at the top of the field/.test(c.resolution) && /you send for the sweep/.test(c.resolution));
check('the caller\'s lore: the fire belief quoted, the old cross buried for the harvest, 1937–39; no Danaher, no 1937–38', /"the most commonly mentioned belief is that these crosses offered protection from fires"/.test(c.lore) && /buried in the fields to bless the harvest/.test(c.lore) && /1937–39/.test(c.lore + c.source) && !/1937–38/.test(c.lore + c.source) && !/Danaher/.test(c.source));
const R = WHEEL_RITES.brigidcross;
check('the rite: Ó Longáin and the Kilcullen child quoted; burned, left or buried; 1937–39; the Museum cited', /"The most commonly mentioned belief is that these crosses offered protection from fires"/.test(R.lore) && /"nobody in that house can die of poisoning or fire"/.test(R.lore) && /burned, left in the rafters, or buried in the fields/.test(R.lore) && /1937–39/.test(R.lore) && !/1937–38/.test(R.lore + R.source) && /National Museum of Ireland/.test(R.source) && R.tier === 'folk');
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
