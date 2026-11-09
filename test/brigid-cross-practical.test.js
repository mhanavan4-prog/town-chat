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
check('the practical half: swept at least yearly, coal twice and wood four times; dry seasoned wood, no rubbish', /Then the practical half, because a chimney that has caught twice is telling you something/.test(c.resolution) && /swept at least once a year, and more by the fuel: the government's guide says coal twice a year and wood four times/.test(c.resolution) && /Burn dry, seasoned wood, and never rubbish/.test(c.resolution));
check('…the signs; everyone out, 112 or 999; a spark guard, only if safe, never water; alarms tested weekly; carbon monoxide', /a roar like a jet engine, sparks or flames out of the top, embers falling down/.test(c.resolution) && /Get everyone out, stay out, and ring 112 or 999/.test(c.resolution) && /never throw water on it, which turns to scalding steam/.test(c.resolution) && /A smoke alarm on every floor, tested every week, and a carbon monoxide alarm in any room with a fire/.test(c.resolution) && /get outside into the air/.test(c.resolution));
check('…cited: gov.ie, Dublin Fire Brigade, the HSE', /gov\.ie, "Fire safety in the living room"/.test(c.source) && /Dublin Fire Brigade/.test(c.source) && /HSE, "Carbon monoxide poisoning"/.test(c.source));
check('the caller\'s lore: the fire belief quoted, the old cross buried for the harvest, 1937–39; no Danaher, no 1937–38', /"the most commonly mentioned belief is that these crosses offered protection from fires"/.test(c.lore) && /buried in the fields to bless the harvest/.test(c.lore) && /1937–39/.test(c.lore + c.source) && !/1937–38/.test(c.lore + c.source) && !/Danaher/.test(c.source));
const R = WHEEL_RITES.brigidcross;
check('the rite: Ó Longáin and the Kilcullen child quoted; burned, left or buried; 1937–39; the Museum cited', /"The most commonly mentioned belief is that these crosses offered protection from fires"/.test(R.lore) && /"nobody in that house can die of poisoning or fire"/.test(R.lore) && /burned, left in the rafters, or buried in the fields/.test(R.lore) && /1937–39/.test(R.lore) && !/1937–38/.test(R.lore + R.source) && /National Museum of Ireland/.test(R.source) && R.tier === 'folk');
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
