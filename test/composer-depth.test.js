// The post-processing target must carry 24-bit depth. three (r128) gives an
// offscreen target with depth and no stencil only DEPTH_COMPONENT16, and at
// sixteen bits a rug and the floor under it flicker through each other in
// stripes (seen on a phone in the Coven Court). Asking for a stencil packs it
// as DEPTH24_STENCIL8.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name); } }
const main = fs.readFileSync(path.join(__dirname, '..', 'client/main.js'), 'utf8');
check('the multisampled target asks for a stencil, and so gets 24-bit depth', /new THREE\.WebGLMultisampleRenderTarget\([^;]*\{ format: THREE\.RGBAFormat, stencilBuffer: true \}\)/.test(main));
check('where there is no multisampling the composer is still handed a target with one', /const plainTarget = msaaTarget \? null : new THREE\.WebGLRenderTarget\([^;]*stencilBuffer: true \}\)/.test(main) && /new THREE\.EffectComposer\(renderer, msaaTarget \|\| plainTarget\)/.test(main));
check('the composer is never left to make its own (16-bit) target', !/new THREE\.EffectComposer\(renderer, msaaTarget \|\| undefined\)/.test(main) && !/new THREE\.EffectComposer\(renderer\)/.test(main));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
