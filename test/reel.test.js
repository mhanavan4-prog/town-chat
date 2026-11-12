// The reel at the stones (data/oldWays.js REEL, lib/oldWays.js): three or more
// take hands at the Unbound Circle by night, it goes round, and those who stay
// to the end are the better for it. Driven with a fake clock and fake players.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const D = require('../data/oldWays'), R = D.REEL;

let clock = 70 * 86400000, night = true, full = false;
const accounts = { ann: {}, bet: {}, cat: {}, dot: {} }, xp = {}, sent = [], covens = { ann: 'c1', bet: 'c1', cat: 'c1', dot: 'c2' };
const players = new Map();
const mk = (id, acct) => { const p = { id, name: id, accountKey: acct ? id : null, room: 'wilds', x: R.at.x + 100, y: R.at.y, health: 60, isDead: false, ws: id }; players.set(id, p); xp[id] = 0; return p; };
const ow = require('../lib/oldWays')({
  accounts, players, getInventory: () => ({}), countItemQty: () => 0, removeItemFromAccount: () => false, addItemToAccount: () => true,
  ensureBankAccount: () => ({ balance: 0 }), grantXP: (p, n) => { xp[p.id] += n; }, isNightNow: () => night,
  playerParty: new Map(), parties: new Map(), playerMaxHealth: () => 100, WORLD2: { spawn: { x: 5000, y: 9000 } }, now: () => clock,
  moonPhase: () => ({ key: full ? 'full' : 'waning_gibbous', isFull: full, startsAt: 1 }), send: (ws, m) => sent.push({ to: ws, ...m }),
  covenOf: (p) => (p.accountKey && covens[p.accountKey] ? { id: covens[p.accountKey], name: 'the Thorn' } : null),
});
const ann = mk('ann', true), bet = mk('bet', true), cat = mk('cat', true), dot = mk('dot', true), gus = mk('gus', false);
const card = (p) => ow.body(p).ways.find((w) => w.id === 'reel');
const can = (p, action) => { const a = (card(p).actions || []).find((x) => x.id === action); return !!(a && a.enabled); };
const why = (p, action) => ((card(p).actions || []).find((x) => x.id === action) || {}).why;
const said = (p, re) => sent.some((m) => m.to === p.ws && m.type === 'toast' && re.test(m.message));
const state = (p) => [...sent].reverse().find((m) => m.to === p.ws && m.type === 'reel_state');

const w = D.OLD_WAYS.find((x) => x.id === 'reel');
check('the reel has its tier, its lore from the 1591 pamphlet, its source, and says where the game leaves the record', w && w.tier === 'record' && /Newes from Scotland/.test(w.lore) && /Geillis Duncan/.test(w.lore) && /In the game/.test(w.lore) && /Pitcairn/.test(w.source));

// where and when
night = false;
check('it is danced by night', !can(ann, 'hands') && /by night/.test(why(ann, 'hands')));
night = true; ann.x = R.at.x + R.joinRange + 50;
check('…at the Unbound Circle', !can(ann, 'hands') && /Unbound Circle/.test(why(ann, 'hands')));
ann.x = R.at.x + 100;

// gathering
const j1 = ow.act(ann, 'reel', 'hands');
check('one witch with a hand out is not a reel', /call the others/.test(j1.toast) && ow._reel.hands.size === 1 && !ow._reel.endsAt && /You have hold\. 1 of you/.test(card(ann).status) && can(ann, 'loose'));
check('…and the next to open the panel sees her waiting', /One witch is waiting at the stones/.test(card(bet).status));
ow.act(bet, 'reel', 'hands');
check('two are told so, and it has not begun', said(ann, /bet takes a hand\. 2 of you now/) && !ow._reel.endsAt);
ow.act(bet, 'reel', 'loose');
check('a witch may let go before it begins', ow._reel.hands.size === 1 && can(bet, 'hands'));
ow.act(bet, 'reel', 'hands');
bet.x = R.at.x + R.joinRange + 400; ow.tick();
check('…or simply walk off', ow._reel.hands.size === 1 && !ow._reel.hands.has('bet'));
bet.x = R.at.x - 100; ow.act(bet, 'reel', 'hands');

// it turns
sent.length = 0;
const j3 = ow.act(gus, 'reel', 'hands');
check('the third hand makes the ring, and a guest\'s hand is as good as any', /makes the ring/.test(j3.toast) && ow._reel.endsAt === clock + R.ms && ow._reel.order.length === 3);
check('every dancer is told, in the words of the song, and sent her place in the ring', [ann, bet, gus].every((p) => said(p, /Commer go ye before/) && state(p).turning === true && state(p).of === 3 && state(p).r === R.ringR && state(p).x === R.at.x && state(p).ms === R.ms) && new Set([ann, bet, gus].map((p) => state(p).place)).size === 3);
check('nothing in the Wilds troubles the ring while it turns', ow.isCalmed(ann) && ow.isCalmed(gus) && !ow.isCalmed(cat));
check('once it has begun it cannot be joined, and nobody in it can let go by the panel', !can(cat, 'hands') && /cannot be joined/.test(card(cat).status) && card(ann).actions.length === 0 && /The reel is turning/.test(card(ann).status) && ow.act(cat, 'reel', 'hands').error);
clock += R.ms - 1000;
check('not yet', ow.tick() === false && ow._reel.endsAt > 0 && xp.ann === 0);
clock += 1001; sent.length = 0;
const paid = ow.tick();
const g3 = R.guardPer * 3;
check('danced out: each who stayed has the XP and the boon, by the number who danced', Array.isArray(paid) && paid.length === 3 && [ann, bet, gus].every((p) => xp[p.id] === R.xp && p.reelBoonUntil === clock + R.boonMs && Math.abs(p.reelGuard - g3) < 1e-9 && said(p, /danced out, 3 of you/) && state(p).turning === false));
check('the boon is a guard like any other, and wears off', Math.abs(ow.statContrib(ann, 'guard') - g3) < 1e-9 && ow.statContrib(ann, 'power') === 0 && (clock += R.boonMs + 1, ow.statContrib(ann, 'guard') === 0));
check('the ring is empty again and nobody is still held by it', ow._reel.hands.size === 0 && !ow._reel.endsAt && !ow.isCalmed(ann));
check('her legs want six hours, and it is on her account; the guest\'s rest is kept while she is here', accounts.ann.oldWays.reel.restUntil === clock - R.boonMs - 1 + R.restMs && accounts.ann.oldWays.reel.danced === 1 && !can(ann, 'hands') && /Not yet/.test(why(ann, 'hands')) && !can(gus, 'hands'));

// a ring that breaks
clock += R.restMs;
for (const p of [ann, bet, cat]) { p.x = R.at.x + 100; ow.act(p, 'reel', 'hands'); }
check('a coven\'s three begin another', ow._reel.endsAt > 0 && ow._reel.order.length === 3);
clock += 5000; bet.isDead = true; sent.length = 0; const x0 = xp.ann;
check('if too few are left to hold it, it breaks, and nothing is earned', ow.tick() === false && !ow._reel.endsAt && said(ann, /The ring breaks/) && xp.ann === x0 && state(ann).turning === false && !ow.isCalmed(ann));
bet.isDead = false;
check('…and those who were in it may begin again at once', can(ann, 'hands'));

// more hands, one coven, a full moon
for (const p of [ann, bet, cat]) ow.act(p, 'reel', 'hands');
clock += R.ms; full = true; sent.length = 0; ow.tick();
check('a ring all of one coven has a little more, and is told so; a full moon doubles the XP', Math.abs(ann.reelGuard - (R.guardPer * 3 + R.covenGuard)) < 1e-9 && said(ann, /all of the Thorn/) && said(ann, /under a full moon/) && xp.cat === R.xp * R.fullMoonXp);
full = false; clock += R.restMs;
const more = [ann, bet, cat, dot, gus, mk('h1', true), mk('h2', true)];
accounts.h1 = {}; accounts.h2 = {};
// seven want to dance: the first three make the ring, so the rest take the next one
for (const p of more.slice(0, 3)) { p.x = R.at.x + 100; ow.act(p, 'reel', 'hands'); }
check('the ring is made by the hands that are there when the third is taken', ow._reel.order.length === 3);
clock += R.ms; ow.tick(); clock += R.restMs;
check('with strangers in it the coven\'s extra is not given', (() => { for (const p of [ann, dot, gus]) { p.x = R.at.x + 100; ow.act(p, 'reel', 'hands'); } clock += R.ms; ow.tick(); return Math.abs(ann.reelGuard - R.guardPer * 3) < 1e-9; })());
check('the guard for the number who danced is capped', R.guardPer * 10 > R.guardMax && R.guardMax + R.covenGuard <= 0.2 && R.need === 3);
clock += R.restMs; night = true;
ow.act(ann, 'reel', 'hands'); night = false; sent.length = 0; ow.tick();
check('daylight sends home whoever is still waiting', ow._reel.hands.size === 0 && said(ann, /getting light/));

// wiring
const server = read('server.js'), main = read('client/main.js'), wilds = read('client/wilds-scene.js');
check('the server turns the reel on its clock, saves what was earned, and tells the module who is of which coven', /const danced = oldWays\.tick\(\); if \(danced\) \{ for \(const p of danced\) daybook\.noteWay\(p, 'reel'\); saveAccounts\(\); \}/.test(server) && /send, covenOf: \(p\) => \{ const cv = p && p\.accountKey && covenOf\(p\.accountKey\);/.test(server));
check('each dancer\'s client carries her round against the sun, skipping, and walks her nowhere else meanwhile', /if \(msg\.type === 'reel_state'\) \{ setReelState\(msg\); return; \}/.test(main) && /const a = r\.a0 - Math\.min\(1, u\) \* r\.turns \* Math\.PI \* 2; \/\/ against the sun/.test(main) && /const reeling = !riding && stepReel\(\);/.test(main) && /if \(riding \|\| reeling\)/.test(main));
check('there is a dancing ground by the Circle that opens the panel', /npc: 'oldways', npcName: '💃 the dancing ground'/.test(wilds) && /kiosk\.hint \|\| 'see to the bees/.test(main));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
