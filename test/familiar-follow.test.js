// Playtest fixes, guarded in the source:
//  - a familiar walks at its owner's side, turned with the owner, so a phone's
//    chase camera sees it (a fixed world offset hid it behind your back), and a
//    touch larger than life;
//  - a town-wide announcement is not also banner-ed a second time on phones.
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });
const fs = require('fs');
const path = require('path');
const FAM = fs.readFileSync(path.join(__dirname, '../client/familiars.js'), 'utf8');
const MAIN = fs.readFileSync(path.join(__dirname, '../client/main.js'), 'utf8');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const num = (re) => { const m = FAM.match(re); return m ? Number(m[1]) : NaN; };
const SIDE = num(/const FAMILIAR_SIDE = (-?\d+(?:\.\d+)?)/), BACK = num(/const FAMILIAR_BACK = (-?\d+(?:\.\d+)?)/), SCALE = num(/const FAMILIAR_SCALE = (-?\d+(?:\.\d+)?)/);
check('the familiar walks well clear of its owner\'s body (side offset of 30+)', SIDE >= 30, SIDE);
check('…level with or a little ahead of them, not behind', BACK <= 0, BACK);
check('…and is drawn a little larger than life', SCALE > 1 && SCALE <= 2, SCALE);
check('the offset turns with the owner\'s facing (no fixed world nudge)', /v\.group\.rotation \? v\.group\.rotation\.y/.test(FAM) && !/gp\.x - 10, tz = gp\.z - 6/.test(FAM));

// The same maths, worked: facing 0 (+z) puts it to +x and ahead; facing π flips both.
const at = (ry) => [Math.cos(ry) * SIDE - Math.sin(ry) * BACK, -Math.sin(ry) * SIDE - Math.cos(ry) * BACK].map((n) => Math.round(n));
const a = at(0), b = at(Math.PI);
check('turning round puts the familiar on the mirrored side', a[0] === -b[0] && a[1] === -b[1], { a, b });

check('a town-wide announcement goes to the log without a second phone banner', /appendSystemChatLine\(msg\.message, \{ noNotif: true \}\)/.test(MAIN) && /if \(!\(opts && opts\.noNotif\)\) systemChatNotif\(text\);/.test(MAIN));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
