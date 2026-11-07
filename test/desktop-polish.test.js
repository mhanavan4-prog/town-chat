// Desktop polish: the wide menu frame's long lists fill it down to Close, the
// Real Shelf sits in two columns, and long stone lore (the memorial) is
// left-aligned rather than centred.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
const MAIN = fs.readFileSync(path.join(__dirname, '../client/main.js'), 'utf8');
let pass = 0, fail = 0;
function check(name, cond) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name); } }

const fill = HTML.match(/body:not\(\.touchMode\) #boardList, body:not\(\.touchMode\) #achList,\s*body:not\(\.touchMode\) #wardrobeList \{([^}]*)\}/);
check('the Board, Collection Log and Wardrobe lists fill the desktop frame', fill && /flex:1 1 auto/.test(fill[1]) && /max-height:none !important/.test(fill[1]));
check('…and those panels are in the uniform flex frame', /body:not\(\.touchMode\) #boardModal > \.card, body:not\(\.touchMode\) #covenModal > \.card, body:not\(\.touchMode\) #delveModal > \.card,[\s\S]{0,400}display:flex; flex-direction:column;/.test(HTML));
check('the Real Shelf is two columns on desktop', /body:not\(\.touchMode\) #shelfModal \.shelfGrid \{ display:grid; grid-template-columns:1fr 1fr;/.test(HTML) && /<div class="shelfGrid">/.test(MAIN));
check('long stone lore is left-aligned', /#npcHintText\.longText \{ text-align:left; \}/.test(HTML) && /hintText\.classList\.toggle\('longText'/.test(MAIN));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
