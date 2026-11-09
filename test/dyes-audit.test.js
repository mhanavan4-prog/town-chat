// The hedge dyes, read against named sources instead of "Highland dye
// lists": Dwelly's "dath" list (1911) and Mairet (1916). Alder is not the
// "finest" black (dock root heads the list); no unsourced mourning; bell
// heather's green, common heather's yellow; no unsourced fading for elder;
// the whin eggs from Ulster, not an unsourced Scotland, and alum named as the
// game's choice; crotal's fishermen on the West Coast, their belief in the
// dictionary's words, not an invented saying.
const { PLANT_DYE_LORE: D } = require('../data/wardrobe.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const all = JSON.stringify(D);
check('no vague "Highland dye lists"; Dwelly cited for the Highland dyes', !/Highland dye lists/.test(all) && ['alder_black', 'heather_moss', 'bramble_rust'].every((k) => /Dwelly, Illustrated Gaelic-English Dictionary \(1911\), "dath"/.test(D[k].source)));
check('alder: not the finest; dock root heads the list; no mourning', !/finest black|mourning/.test(D.alder_black.lore) && /"Black \(finest\)", is common dock root/.test(D.alder_black.lore));
check('heather: bell heather\'s green with Dwelly\'s rule; ling\'s yellows', /"The heather must be pulled before flowering and from a dark shady place\."/.test(D.heather_moss.lore) && /common heather, ling, gave yellows/.test(D.heather_moss.lore) && !/young tops alone/.test(D.heather_moss.lore));
check('elder: Grieve\'s words, no unsourced fading', /"dye blue and purple, the Juice yielding with alum, violet; with alum and salt, a lilac colour\."/.test(D.elder_violet.lore) && !/fade/.test(D.elder_violet.lore));
check('whin: Ulster\'s eggs quoted; alum the game\'s choice', /"whin blossoms, tea leaves, or coloured rags"/.test(D.whin_gold.lore) && !/Scotland/.test(D.whin_gold.lore) && /the modern dyer's way, and the game's/.test(D.whin_gold.lore) && D.whin_gold.tier === 'folk');
check('crotal: the West Coast fishermen in the dictionary\'s words; Mairet on mordant and tweed', /"a superstition among fishermen on the West Coast that crottal seeks its native rocks"/.test(D.crotal_brown.lore) && !/seeks the rocks again/.test(D.crotal_brown.lore) && /"No mordant is needed/.test(D.crotal_brown.lore) && /an Angus correspondent on West Coast fishermen/.test(D.crotal_brown.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
