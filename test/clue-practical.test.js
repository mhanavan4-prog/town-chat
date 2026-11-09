// The Blue Clue: the practical half for a lass alone in a farm building at
// night (HSE on falls and on pits, silos and slurry stores; the Farm Advisory
// Service on letting someone know; the Suzy Lamplugh Trust on walking home;
// Police Scotland's 999 and 101); and the lore: Burns's note quoted, Merran's
// stanza, and the kiln-pot explained (Dictionary of the Scots Language).
const { CALLERS } = require('../data/callers.js');
const { HALLOWEEN_RITES } = require('../data/halloween.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'hallowe_en_clue');
check('the old scene kept: outside in the frost, glad she went, home past the kirkyard', c && /You stand outside in the frost while she winds/.test(c.resolution) && /only that she's glad she went/.test(c.resolution) && /past the kirkyard the long way/.test(c.resolution));
check('the practical half: the pit under the kiln; falls on farms; a torch; nowhere you can\'t see the floor', /Then the practical half, for a lass alone in a farm building in the dark/.test(c.resolution) && /falls are still among the commonest ways people die on farms/.test(c.resolution) && /take a torch, light the place/.test(c.resolution) && /where you can't see the floor/.test(c.resolution));
check('…never into a pit, silo or slurry store; the air can kill, and the second rescuer; someone told; a charged phone with signal', /Never go down into a pit, silo or slurry store: the air in them can kill in moments/.test(c.resolution) && /a second person going in after the first is how two die/.test(c.resolution) && /Tell someone where you're going and when you'll be back/.test(c.resolution) && /a phone that's charged and has a signal/.test(c.resolution));
check('…walking home: the way planned, no quiet badly lit lanes, trust the feeling; 999 and 101; cited', /keep off quiet, badly lit lanes, and trust it if something feels wrong/.test(c.resolution) && /Ring 999 if anyone's in danger, and 101/.test(c.resolution) && /HSE/.test(c.source) && /Farm Advisory Service/.test(c.source) && /Suzy Lamplugh Trust/.test(c.source) && /Police Scotland/.test(c.source));
check('the lore: Burns\'s note quoted; Merran\'s "something held within the pat"; the kiln-pot explained', /"Steal out, all alone, to the kiln, and, darkling, throw into the pot, a clew of blue yarn"/.test(c.lore) && /"Till something held within the pat, \/ Guid Lord! but she was quaukin!"/.test(c.lore) && /the heating chamber under a corn-kiln/.test(c.lore) && /Dictionary of the Scots Language/.test(c.source));
check('the rite: Burns\'s note, "Wha hauds?", and the kiln-pot from the Dictionary', /"Steal out, all alone, to the kiln, and, darkling, throw into the pot, a clew of blue yarn"/.test(HALLOWEEN_RITES.clue.lore) && /"wha hauds\?" \("i\.e\. who holds\?"\)/.test(HALLOWEEN_RITES.clue.lore) && /"the heating chamber under a corn-kiln"/.test(HALLOWEEN_RITES.clue.lore));
const { nameKey } = require('../lib/sources.js');
check('the Sources page keeps a body or helpline whole, not as a surname: three Scotlands stay three, and the Brigade isn\'t filed under B', nameKey('Cruse Scotland') !== nameKey('Age Scotland') && nameKey('Police Scotland, "Contact us"') !== nameKey('Age Scotland') && nameKey('London Fire Brigade, "Candles"') === 'london fire brigade, "candles"' && nameKey('Breathing Space') === 'breathing space' && nameKey('M. MacNeill, The Festival of Lughnasa (1962)') === 'macneill');
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
