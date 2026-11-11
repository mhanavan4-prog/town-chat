// The Wards panel, sorted (client/wards.js): every ward the game has sits in a
// group by where it goes in the house, so a new one can't fall to the bottom
// unplaced; a strip at the top shows which are made.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'client/wards.js'), 'utf8');
const { WARDS } = require('../data/wards');
const block = (src.match(/const WARD_GROUPS = \[([\s\S]*?)\n  \];/) || [])[1] || '';
const grouped = [...block.matchAll(/wards: \[([^\]]*)\]/g)].flatMap((m) => [...m[1].matchAll(/'([a-z]+)'/g)].map((x) => x[1]));
check('every ward the game has is in a group', Object.keys(WARDS).every((k) => grouped.includes(k)), Object.keys(WARDS).filter((k) => !grouped.includes(k)));
check('…once only, and none that doesn\'t exist', new Set(grouped).size === grouped.length && grouped.every((k) => WARDS[k]));
check('the groups go by where in the house: the door, the hearth and chimney, about the house, worn on you', /At the door/.test(block) && /At the hearth and chimney/.test(block) && /About the house/.test(block) && /Worn on you/.test(block));
check('the door group holds the door marks, the hearth group the hearth ones', /key: 'door'[^}]*'hexafoil'[^}]*'horseshoe'[^}]*'rowan'/.test(block) && /key: 'hearth'[^}]*'bottle'[^}]*'marian'[^}]*'shoe'/.test(block));
check('a strip of every ward at the top, lit when made, each a button to its card', /class.*wardSumIcon/.test(src) || /'wardSumIcon' \+ \(done \? ' made' : ''\)/.test(src));
check('a made ward\'s lore folds shut; on a phone all start folded', /fold\.open = !c\.classList\.contains\('done'\) && !\(window\.matchMedia && window\.matchMedia\('\(pointer:coarse\)'\)\.matches\)/.test(src));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
