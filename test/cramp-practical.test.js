// The cramp charm's practical half (NHS, "Leg cramps" and "Deep vein
// thrombosis (DVT)"), with the old schoolboys' standing on the leg as the part
// that worked, and a swollen calf that doesn't go off told apart from cramp;
// and its lore put right from Henderson (1879) and Farquhar (1916): the eel's
// skin, the Durham garter, the mutton cramp-bone, no pocket; Edward II's
// Good Friday rings; and Borde's 1542 words as he wrote them.
const { CALLERS } = require('../data/callers.js');
const { CHARMS } = require('../data/charms.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'the_cramp');
check('the old scene kept: the three crosses, the smelly eel-skin, kept anyway; no "rub it warm"', c && /make the three crosses over his leg/.test(c.resolution) && /the eel-skin round his leg too, which smells/.test(c.resolution) && /He keeps the eel-skin anyway/.test(c.resolution) && !/rub it warm/.test(c.resolution) && !/garter/.test(c.resolution));
check('the practical half: the boys stood on the leg; weight on it, stretching and rubbing; toes to the shin; painkillers only after', /Then the practical half, and the Christ's Hospital boys had part of it: they got out of bed and stood firm on the leg/.test(c.resolution) && /Standing and putting his weight on it helps; so does stretching and rubbing the muscle/.test(c.resolution) && /pull the foot up at the ankle so the toes point at the shin, and stretch the calf/.test(c.resolution) && /too slow to help while it's on/.test(c.resolution));
check('…calf stretches against a wall, the last before bed; a doctor for lost sleep, over ten minutes, numbness or swelling; the medicines asked about', /stretch the calves against a wall a few times a day, the last just before bed/.test(c.resolution) && /spoiling his sleep, last longer than ten minutes, or come with numbness or swelling/.test(c.resolution) && /statins or water tablets/.test(c.resolution));
check('…a swollen painful calf in one leg that doesn\'t go off may be a clot: urgent doctor or 111, 999 with breathlessness or chest pain', /pain and swelling in one calf, with red or darkened skin, that doesn't go off isn't cramp: it may be a clot/.test(c.resolution) && /an urgent doctor or 111 the same day, and 999 if he's short of breath or has chest pain/.test(c.resolution) && /NHS, "Leg cramps" and "Deep vein thrombosis \(DVT\)"/.test(c.source) && (c.source.match(/NHS,/g) || []).length === 1);
check('the caller\'s lore: Coleridge\'s boy standing firm; the garter, the eel\'s skin, the mutton cramp-bone; Borde\'s book named', /"stand firmly on the leg affected"/.test(c.lore) && /garter below the knee/.test(c.lore) && /mutton "cramp-bone"/.test(c.lore) && !/sheep's/.test(c.lore) && /Introduction of Knowledge \(1542\)/.test(c.source));
const K = CHARMS.cramp;
check('the charm\'s lore: Coleridge via Henderson, the Durham garter, the eel\'s skin, the patella with no pocket; Edward II\'s Good Friday offering; Borde in his own words', /"the approved mode of procedure in Christ's Hospital"/.test(K.lore) && /"For cramp our Durham remedy is to garter the left leg below the knee"/.test(K.lore) && /"An eel's skin worn about the naked leg is deemed a preventive too, especially by schoolboys"/.test(K.lore) && /"the patella or knee-cap"/.test(K.lore) && !/pocket/.test(K.lore) && /"to make rings to give for medicine to divers folk"/.test(K.lore) && /"The Kinges of Englande doth halowe euery yere Crampe rynges"/.test(K.lore) && !/doth helpe them whyche hath the Crampe/.test(K.lore) && /Farquhar/.test(K.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
