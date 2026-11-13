// Fixes from a play-through: the Wastes' shadow box, a shorter chat, quiet signs instead of banners,
// the Moot Hall's door and table, and Players online framed like every other menu.
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name); } }
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const ember = read('client/ember-scene.js'), html = read('public/index.html'), sprites = read('client/sprites.js'), main = read('client/main.js'), wilds = read('client/wilds-scene.js'), vh = read('client/village-house.js');
check('the Wastes\' shadow box is twice the town\'s, so its edge stays off the near ground', /emberSun\.userData\.shadowSpan = 1440;/.test(ember));
check('the chat log stands lower', /max-height:min\(172px, 20vh\); min-height:72px;/.test(html));
check('every world sign is quiet: it shows as you come up to its place, only the nearest, a size smaller', /QUIET_SIGNS\.add\(sprite\);/.test(sprites) && /const scale = 110 \/ 256 \* 0\.62;/.test(sprites) && /const QUIET_NEAR = 430, QUIET_FADE = 140;/.test(main) && /updateQuietSigns\(\);/.test(main) && !/sp\.visible = /.test(main.slice(main.indexOf('function updateQuietSigns'), main.indexOf('function stepDroveHerd'))));
check('the Moot Hall faces its door spot (south)', /placeSolid\('vil_hall', VX, VZ, 440, 0, 'fit'\);/.test(wilds));
check('its long table is three trestle tables at sitting height, with benches', /kkPlace\(scene, 'furn_htable', W \/ 2, D \/ 2 \+ 20 \+ dz, 92, Math\.PI \/ 2, 'fit'\);/.test(vh) && /kkPlace\(scene, 'furn_hbench', W \/ 2 \+ sx, D \/ 2 \+ 20 \+ dz, 90, Math\.PI \/ 2, 'fit'\)/.test(vh) && !/'furn_htable', W \/ 2, D \/ 2 \+ 20, 330/.test(vh));
check('Players online is framed like the other menus (size, pinned Close, scrolling body)', /body:not\(\.touchMode\) #shelfModal, body:not\(\.touchMode\) #onlineModal,\n {2}body:not\(\.touchMode\) #inventoryPanel \{/.test(html) && /#shelfCloseBtn, body:not\(\.touchMode\) #onlineCloseBtn,/.test(html) && /#onlineModal > #onlineContent \{ flex:1 1 auto;/.test(html));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
