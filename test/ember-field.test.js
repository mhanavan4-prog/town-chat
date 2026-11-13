// The field in the Ember Wastes (data/emberField.js, lib/emberField.js): the
// track, its fingerposts, and twelve things the war left by it.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const root = path.join(__dirname, '..');
const { TRACK, POSTS, FIELD, FINDS } = require('../data/emberField');
const { EMBER_TOWN: T } = require('../data/emberTown');
const scene = fs.readFileSync(path.join(root, 'client/ember-scene.js'), 'utf8'), main = fs.readFileSync(path.join(root, 'client/main.js'), 'utf8');

const ev = (name, re) => new Function('return ' + re.exec(scene)[1])();
const cTrack = ev('FIELD_TRACK', /const FIELD_TRACK = (\[[^\n]*\]);/), cPosts = ev('FIELD_POSTS', /const FIELD_POSTS = (\[[^\n]*\]);/), cFinds = ev('FIELD_FINDS', /const FIELD_FINDS = (\[[\s\S]*?\n\]);/);
check('the client draws the same track, posts and finds the server knows', JSON.stringify(cTrack) === JSON.stringify(TRACK.map((t) => t.pts)) && JSON.stringify(cPosts) === JSON.stringify(POSTS) && JSON.stringify(cFinds) === JSON.stringify(FINDS.map(({ id, name, icon, model, x, y, size, turn, hint }) => ({ id, name, icon, model, x, y, size, turn, hint }))));
check('the track leaves from the portal and from each side of Ashminster, and reaches every landmark and the west', TRACK.length === 7 && Math.hypot(TRACK[0].pts[0][0] - 10000, TRACK[0].pts[0][1] - 18600) < 400 && TRACK[0].pts.at(-1)[1] > T.y && TRACK.every((t) => t.pts.every(([x, y]) => x > 600 && x < 19400 && y > 600 && y < 19400)) && Math.min(...TRACK.flatMap((t) => t.pts.map((p) => p[0]))) < 4500);
const nearTrack = (x, y) => Math.min(...TRACK.flatMap((t) => t.pts.slice(1).map((b, i) => { const a = t.pts[i], L2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2, u = Math.max(0, Math.min(1, ((x - a[0]) * (b[0] - a[0]) + (y - a[1]) * (b[1] - a[1])) / L2)); return Math.hypot(x - a[0] - (b[0] - a[0]) * u, y - a[1] - (b[1] - a[1]) * u); })));
check('twelve things, each by the track and none inside the town', FINDS.length === 12 && new Set(FINDS.map((f) => f.id)).size === 12 && FINDS.every((f) => nearTrack(f.x, f.y) < 500 && T.ground.every((g) => Math.hypot(f.x - g.x, f.y - g.y) > g.r)), FINDS.map((f) => [f.id, Math.round(nearTrack(f.x, f.y))]));
check('every find tells something; the two from the record and the folk name their tier and sources and where the game goes beyond them', FINDS.every((f) => f.says.length > 120 && f.hint) && FINDS.filter((f) => f.tier).length === 2 && FINDS.filter((f) => f.tier).every((f) => f.lore.join(' ').length > 300 && f.source.length > 60 && /(is|are) the game's\.$/.test(f.note)));
check('the witch-bottle board says they were made against witches', /made against witches/.test(FINDS.find((f) => f.id === 'bottle').note));
check('every model the field uses is in the manifest and on disk', [...new Set(FINDS.map((f) => f.model)), 'em_fingerpost'].every((k) => { const m = new RegExp(k + ": 'kk/home/([a-z_]+\\.glb)'").exec(main); return m && fs.existsSync(path.join(root, 'public/kk/home', m[1])); }));

let clock = 50 * 86400000, xp = 0, titles = [], walked = [];
const sent = [], acct = {}, bank = { balance: 0 };
const fld = require('../lib/emberField')({ send: (to, m) => sent.push(m), grantXP: (_p, n) => { xp += n; }, acctOf: (p) => (p.guest ? null : acct), bankOf: (p) => (p.guest ? null : bank), grantTitle: (_p, id) => titles.push(id), noteWalked: (p) => walked.push(p.id), now: () => clock });
const p = { id: 'p', ws: 'p', room: 'ember_wastes', isDead: false, x: 0, y: 0 };
const at = (f) => { p.x = f.x + 30; p.y = f.y + 50; };
const F = FINDS[0];
check('it must be gone up to, in the Wastes', (p.x = F.x + 900, fld.use(p, F.id)) === false && (at(F), p.room = 'wilds', fld.use(p, F.id)) === false);
p.room = 'ember_wastes'; sent.length = 0;
check('searching one tells its piece and pays, more the first time', fld.use(p, F.id) === true && sent.some((m) => m.type === 'toast' && m.message.includes(F.says)) && bank.balance === FIELD.gold && xp === FIELD.xp + FIELD.firstXp && sent.some((m) => m.type === 'field_state' && m.done.join() === F.id));
sent.length = 0;
check('again the same day it is read back, for nothing', fld.use(p, F.id) === false && bank.balance === FIELD.gold && sent.some((m) => m.type === 'vh_board' && m.epithet === 'The field' && m.lines.some((l) => /game's own story/.test(l))));
const B = FINDS.find((f) => f.id === 'bottle'); at(B); fld.use(p, B.id); sent.length = 0; fld.use(p, B.id);
check('one from the record reads back what the record says', sent.some((m) => m.type === 'vh_board' && m.epithet === 'In the record' && m.lines.some((l) => /^Source: /.test(l)) && m.lines.some((l) => /Greenwich/.test(l))));
clock += 86400000; at(F); const x0 = xp;
check('next day it can be searched again, without the first-time XP', fld.use(p, F.id) === true && xp === x0 + FIELD.xp);
for (const f of FINDS) { at(f); fld.use(p, f.id); }
check('all twelve, ever, is walking the field: a purse, a title, a daybook line, once', titles.join() === FIELD.allTitle && walked.join() === 'p' && bank.balance > FIELD.allGold);
clock += 86400000; for (const f of FINDS) { at(f); fld.use(p, f.id); }
check('and it is not given twice', titles.length === 1 && walked.length === 1);
const g = { id: 'g', guest: true, ws: 'g', room: 'ember_wastes', isDead: false };
g.x = F.x; g.y = F.y; sent.length = 0;
check('a guest can search, and is paid in XP only', fld.use(g, F.id) === true && !sent.some((m) => /gold/.test(m.message || '')));

const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
check('the server answers a search and saves what it paid', /if \(msg\.type === 'field_use'\) \{ if \(emberField\.use\(player, String\(msg\.id \|\| ''\)\)\) \{ saveAccounts\(\); saveBankAccounts\(\); \} return; \}/.test(server));
check('the client lets each be searched, and the prompt changes once it has been', /type: 'field_use', id: kiosk\.fieldId/.test(main) && /fieldDone\.has\(kiosk\.fieldId\) \? 'read it again' : kiosk\.hint/.test(main));
check('the scatter keeps off the track and what lies by it', /\|\| nearTrack\(x, z, 240\)/.test(scene));
check('walking the field has a title', require('../data/titles').TITLES.field_walker && /Ember Wastes/.test(require('../data/titles').TITLES.field_walker.from));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
