// The overlooked child: a practical half (NHS on urgent help for babies, on
// teething and on dehydration) and the lore put right (Campbell, 1902;
// Carmina Gadelica, 1900, no. 140; Carmichael's Barra note, which is for a
// cow; the Scottish National Dictionary on "forspeak"): the bowl turned over,
// the water sprinkled on head and backbone, not "three times"; no cold crust;
// and the tinker woman not blamed.
const { CALLERS } = require('../data/callers.js');
const { HOUSEHOLD_RITES: R } = require('../data/household.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'overlooked_child');
check('the silver water on head and back; the tooth; the tinker woman not blamed, for the eye could be "in friend or foe"', c && c.steps[0].rite === 'silver_water' && /sprinkle the baby's head and back/.test(c.resolution) && /a tooth coming through/.test(c.resolution) && /no fault of the tinker woman's/.test(c.resolution) && /friend or foe, even a mother's own/.test(c.resolution) && !/forspoken/.test(c.plea));
check('the caller\'s lore: the bowl turned over, air a chronachadh; Carmichael\'s gold, silver and copper water, drunk and sprinkled (he doesn\'t call it silver water); no "three times" on a child', /turned it over; if the coin stuck, the child was air a chronachadh/.test(c.lore) && /a water with gold, silver and copper in the ladle, 'given as a draught, and sprinkled over the head and backbone'/.test(c.lore) && !/three times/.test(c.lore) && /Carmina Gadelica, vol\. II \(1900\), no\. 140/.test(c.source));
const S = R.silver_water;
check('the rite\'s lore: Campbell\'s eye "in friend or foe", the upturned bowl, the cat\'s-paw water; Carmichael\'s Trinity and draught; Barra\'s cow; Scott\'s forspeaking', /"may exist in man or woman, in friend or foe"/.test(S.lore) && /"A mother can hurt her own child"/.test(S.lore) && /The bowl is then quickly, and dexterously turned upside down\. If the sixpence stick to its bottom, the child is the victim of an evil eye"/.test(S.lore) && /cat's paws/.test(S.lore) && /"in name of the Holy Trinity"/.test(S.lore) && /"given as a draught, and sprinkled over the head and backbone"/.test(S.lore) && /"Place silver in the dish & sprinkle this 3 times on the cow\."/.test(S.lore) && /"any extravagant commendation of a good property in a child or animal"/.test(S.lore) && /Scottish National Dictionary/.test(S.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
