// Two fixes from a phone report:
//  - the touch "Tap to …" prompt sits in the hollow of the action wheel, where
//    it can be read, instead of above the wheel under the top of the fan;
//  - a skeleton never stands in its bind pose (arms out) for want of Idle and
//    Walk: bodies that ship with no clips borrow the Mage's whenever she
//    arrives, even if the extra-motion packs got there first.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const html = read('public/index.html'), main = read('client/main.js');

const px = (re) => { const m = re.exec(html); return m ? +m[1] : NaN; };
const rule = /body\.touchMode #interactHint \{([^}]*)\}/.exec(html)[1];
const right = +/safe-area-inset-right\)\) \+ (\d+)px/.exec(rule)[1], bottom = +/safe-area-inset-bottom\)\) \+ (\d+)px/.exec(rule)[1];
const w = +/width:(\d+)px/.exec(rule)[1], h = +/height:(\d+)px/.exec(rule)[1];
// the wheel's buttons, as offsets from the cluster's bottom-right corner: [right, bottom, size]
const btn = (id, size) => { const r = new RegExp('#' + id + '\\s*\\{[^}]*right:(\\d+)px;\\s*bottom:(\\d+)px').exec(html); const sz = new RegExp('#' + id + '\\s*\\{[^}]*width:(\\d+)px').exec(html); return [+r[1], +r[2], sz ? +sz[1] : size]; };
const acQuick = px(/\.acQuick\s*\{ width:(\d+)px/), acBtn = px(/\.acBtn \{\s*position:absolute; pointer-events:auto;\s*width:(\d+)px/);
const buttons = { btnStrike: btn('btnStrike', acBtn), btnJump: btn('btnJump', acBtn), btnEmote: btn('btnEmote', acBtn), qs1: btn('qs1', acQuick), qs2: btn('qs2', acQuick), qs3: btn('qs3', acQuick), qs4: btn('qs4', acQuick), qs5: btn('qs5', acQuick), btnKit: btn('btnKit', acQuick) };
const hits = Object.entries(buttons).filter(([, [r, b, s]]) => r < right + w && r + s > right && b < bottom + h && b + s > bottom).map(([id]) => id);
check('the prompt is placed from the same corner as the wheel, and big enough to read', w >= 110 && h >= 100 && /font-size:14px/.test(html.slice(html.indexOf('body.touchMode #interactHint span'))));
check('it lies in the hollow: it touches none of the strike, jump, emote, quick-slot or kit buttons', hits.length === 0 && Object.values(buttons).every((b) => b.every((n) => n > 0)), hits);
check('it is drawn over the wheel, not under it', /body\.touchMode #interactHint \{[^}]*z-index:9;/.test(html));
check('longer words are set smaller, so they stay inside it', /#interactHint\.long span \{ font-size:12px; \}/.test(html) && /#interactHint\.longer span/.test(html) && /hintEl\.classList\.toggle\('long', n > 30 && n <= 52\)/.test(main) && /new MutationObserver\(fit\)\.observe\(hintText/.test(main));

check('a body knows whether it shipped with clips of its own', /bare: !\(gltf\.animations && gltf\.animations\.length\)/.test(main));
check('a bare body borrows once, by flag, and not by whether its list happens to be empty', /if \(!m\.bare \|\| m\._borrowed \|\| !m\.animations \|\| !skinned\(m\)\) continue;/.test(main) && /for \(const clip of clipsFor\(m\)\) if \(!have\.has\(clip\.name\)\) m\.animations\.push\(clip\);\s*m\._borrowed = true;/.test(main) && !/animations\.length === 0 && skinned\(models\[k\]\)/.test(main));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
