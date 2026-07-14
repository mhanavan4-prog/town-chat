// @ts-check
// Verifies the three client.js copies are byte-identical. The two MOBILE copies
// (town-chat-android/www, town-chat-ios/www) are GENERATED from public/client.js
// by `npm run sync:mobile` — never hand-edit them. Skips gracefully when the
// sibling mobile repos aren't present (e.g. CI checks out only this repo).
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const web = path.join(root, 'public', 'client.js');
const copies = [
  path.resolve(root, '..', 'town-chat-android', 'www', 'client.js'),
  path.resolve(root, '..', 'town-chat-ios', 'www', 'client.js'),
];
const present = copies.filter((p) => fs.existsSync(p));
if (!present.length) {
  console.log('client parity: mobile repos not present — skipping (run locally before a mobile build).');
  process.exit(0);
}
const webBuf = fs.readFileSync(web);
let ok = true;
for (const p of present) {
  const same = fs.readFileSync(p).equals(webBuf);
  console.log((same ? 'OK    ' : 'DRIFT ') + path.relative(path.resolve(root, '..'), p));
  if (!same) ok = false;
}
if (!ok) {
  console.error('\\nclient.js copies have drifted from public/client.js.\\nRun `npm run sync:mobile`, then rebuild the apps. Never hand-edit the www/ copies.');
  process.exit(1);
}
console.log('client parity: all copies identical to public/client.js OK');
