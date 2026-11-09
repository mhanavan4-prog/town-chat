// A Sack of Cheese and Herrings: the practical half for a theft (Police
// Scotland's 101 and 999; Crimestoppers, anonymous; Police Scotland's rural
// security advice) and for an accusation made on a charm's word (Defamation
// and Malicious Publication (Scotland) Act 2021); and the 1697 Caerlaverock
// record as Wood transcribes it: the sack from a horse's saddle at the
// Bankend tavern, the key and Bible falling at M'Kinnell's name, and
// Fergusson, the charmer, put on the pillar; with Napier's method and
// Brewer's different psalm.
const { CALLERS } = require('../data/callers.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'cheese_and_herrings');
check('the old scene kept: the key\'s word not taken to the session; the word at the market; the cheeses back, the herrings not', c && /You don't take the key's word to the kirk session/.test(c.resolution) && /say at the market that the Bible's been read over it/.test(c.resolution) && /The herrings are not/.test(c.resolution));
check('the practical half: the police on 101, or 999 if happening or the thief still about; Crimestoppers 0800 555 111, never asked who', /Then the practical half\. A theft goes to the police: ring 101, or 999 if it's happening now or the thief is still about/.test(c.resolution) && /Crimestoppers takes it on 0800 555 111, and they are never asked who they are/.test(c.resolution));
check('…a hasp and padlock, a light on a timer, photographs and a note; no naming a thief on a charm\'s word: defamation, and no evidence', /a proper hasp and padlock on the byre door, a light on a timer outside, and photographs and a note/.test(c.resolution) && /never name a man as the thief on the strength of a key or a card: in Scots law, a statement to others that seriously harms someone's good name can be defamation, and a charm is no evidence at all/.test(c.resolution));
check('…cited: Police Scotland, Crimestoppers, the 2021 Act', /Police Scotland, "Rural & Agricultural Security Advice"/.test(c.source) && /Crimestoppers/.test(c.source) && /Defamation and Malicious Publication \(Scotland\) Act 2021/.test(c.source));
check('the lore: Napier\'s two persons and the fiftieth Psalm; Brewer\'s Ruth i or 51st; the 1697 record: the saddle at Bankend, the bowl of the key, the fall, Fergusson on the pillar', /"Two neutral persons, sitting opposite each other, held out the forefingers of their right hands"/.test(c.lore) && /"put into the Bible at the fiftieth Psalm"/.test(c.lore) && /Brewer gives Ruth i or the 51st Psalm instead/.test(c.lore) && /taken from a horse's saddle at the tavern at Bankend of Caerlaverock/.test(c.lore) && /"two holding the bowl of the key upon their fingers"/.test(c.lore) && /"the key and the Bible turned about and fell on the table"/.test(c.lore) && /"to stand on the pillar in the church of Caerlaverock"/.test(c.lore) && /it was the charmer the kirk punished/.test(c.lore) && /Napier/.test(c.source) && /Wood/.test(c.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
