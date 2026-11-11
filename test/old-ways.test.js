// The Old Ways (data/oldWays.js, lib/oldWays.js): the besom, the poppet,
// lead-pouring, the bees, the brownie, sin-eating, the toad-bone. Driven with
// a fake clock, bank and packs.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const root = path.join(__dirname, '..');
const D = require('../data/oldWays');

let clock = 50 * 86400000, night = false, roll = 0;
const accounts = { ann: {}, bet: {} }, bank = { ann: { balance: 100 }, bet: { balance: 100 } }, packs = { ann: {}, bet: {} };
const players = new Map(), xp = { ann: 0, bet: 0 };
const mk = (id, room) => { const p = { id, name: id, accountKey: id, room, x: 1600, y: 1100, health: 60, isDead: false }; players.set(id, p); return p; };
const parties = new Map([['p1', { members: ['ann', 'bet'] }]]), playerParty = new Map([['ann', 'p1'], ['bet', 'p1']]);
const ow = require('../lib/oldWays')({
  accounts, players, getInventory: (p) => packs[p.accountKey], countItemQty: (inv, id) => inv[id] || 0,
  removeItemFromAccount: (inv, id, q) => { if ((inv[id] || 0) < q) return false; inv[id] -= q; return true; },
  addItemToAccount: (inv, id, q) => { inv[id] = (inv[id] || 0) + q; return true; },
  ensureBankAccount: (k) => bank[k], grantXP: (p, n) => { xp[p.accountKey] += n; }, isNightNow: () => night,
  playerParty, parties, playerMaxHealth: () => 100, WORLD2: { spawn: { x: 5000, y: 9000 } }, now: () => clock, random: () => roll,
});
const ann = mk('ann', 'outside'), bet = mk('bet', 'outside');
const card = (p, id) => ow.body(p).ways.find((w) => w.id === id);
const can = (p, id, action) => { const a = (card(p, id).actions || []).find((x) => x.id === action); return !!(a && a.enabled); };
const MIN = 60000;

check('seven ways, each with its tier, its lore and its source', D.OLD_WAYS.length === 7 && D.OLD_WAYS.every((w) => ['record', 'folk', 'revival'].includes(w.tier) && w.lore.length > 200 && w.source.length > 30 && w.how.length > 40));
check('a guest is told to log in, and can do nothing', ow.body({ id: 'g', room: 'outside' }).isGuest === true && ow.act({ id: 'g', room: 'outside' }, 'lead', 'pour').error);

// the besom
check('the stave is cut in the Wilds, not the town', !can(ann, 'besom', 'step') && /Wilds/.test(card(ann, 'besom').actions[0].why));
ann.room = 'wilds';
const s1 = ow.act(ann, 'besom', 'step'), s2 = ow.act(ann, 'besom', 'step');
check('…then the birch', /ash pole/.test(s1.toast) && /birch/.test(s2.toast) && accounts.ann.oldWays.besom.steps.length === 2);
ann.room = 'outside';
check('it is bound in the town, and only after dark', !can(ann, 'besom', 'step') && /after dark/.test(card(ann, 'besom').actions[0].why));
night = true; const s3 = ow.act(ann, 'besom', 'step');
check('bound, it is a broom', accounts.ann.oldWays.besom.made === true && /It is a broom/.test(s3.toast) && xp.ann === 60);
night = false;
check('it flies by night', !can(ann, 'besom', 'ride') && ow.act(ann, 'besom', 'ride', 'camp').error === 'It flies by night.');
night = true; ann.room = 'dungeon_t1';
check('…and under the open sky', ow.act(ann, 'besom', 'ride', 'camp').error === 'You need the open sky.');
ann.room = 'outside';
const fl = ow.act(ann, 'besom', 'ride', 'camp');
check('ridden, it sets you down where you asked', fl.flight && fl.flight.room === 'wilds' && fl.flight.x === 7800 && fl.flight.y === 5250 && /come down at the scouts' camp/.test(fl.toast));
check('…and wants a rest before it rises again', ow.act(ann, 'besom', 'ride', 'square').error && /resting/.test(card(ann, 'besom').status));
clock += D.BESOM_REST_MS + 1;
check('the edge of the Wilds is wherever the Wilds\' own gate is', ow.act(ann, 'besom', 'ride', 'gate').flight.x === 5000);
check('nowhere it lands is the name of nowhere', ow.act(ann, 'besom', 'ride', 'the moon').error !== undefined);

// the poppet
check('a poppet wants a scrap of fur', !can(ann, 'poppet', 'guard') && /Fur|fur/.test(card(ann, 'poppet').actions[0].why));
packs.ann.fur_scrap = 2; clock += 10 * MIN;
check('it may be named for yourself or one of your party standing by', card(ann, 'poppet').actions[0].choices.map((c) => c.id).join() === 'ann,bet');
const g = ow.act(ann, 'poppet', 'guard', 'bet');
check('a guarding poppet takes a tenth of the blows meant for whoever it is named for', bet.poppetGuardUntil === clock + D.POPPET.guardMs && ow.statContrib(bet, 'guard') === 0.1 && ow.statContrib(ann, 'guard') === 0 && g.touched === bet && packs.ann.fur_scrap === 1);
check('…and the needle wants a rest', !can(ann, 'poppet', 'mend'));
clock += D.POPPET.restMs + 1; bet.health = 40;
ow.act(ann, 'poppet', 'mend', 'bet');
check('a mending poppet puts three tenths of their health back', bet.health === 70 && packs.ann.fur_scrap === 0);
bet.x = 9000; clock += D.POPPET.restMs + 1; packs.ann.fur_scrap = 1;
check('someone out of sight cannot be named', ow.act(ann, 'poppet', 'guard', 'bet').error && packs.ann.fur_scrap === 1);
clock += D.POPPET.guardMs;
check('the guard wears off', ow.statContrib(bet, 'guard') === 0);

// lead
roll = 0.5; const pour = ow.act(ann, 'lead', 'pour');
check('lead poured through the key sets in a shape with its meaning', /through the ring of the key/.test(pour.toast) && D.LEAD_SHAPES.some((sh) => pour.toast.includes(sh.name)) && xp.ann === 60 + D.LEAD_XP);
check('once a day', ow.act(ann, 'lead', 'pour').error && /Today's pouring/.test(card(ann, 'lead').status));
clock += 86400000;
check('…and again tomorrow', can(ann, 'lead', 'pour'));

// bees
check('bees are bartered for, not bought', !can(ann, 'bees', 'skep') && /not bought for money/.test(card(ann, 'bees').actions[0].why) && D.BEES.barter.itemId === 'bone_shard');
packs.ann.bone_shard = 3; ow.act(ann, 'bees', 'skep');
check('a skep set up', packs.ann.bone_shard === 0 && accounts.ann.oldWays.bees && !can(ann, 'bees', 'take'));
clock += 2 * D.BEES.combMs + 5;
check('they lay up a comb every three hours', /2 of 6 combs/.test(card(ann, 'bees').status));
const b0 = bank.ann.balance; const take = ow.act(ann, 'bees', 'take');
check('the comb taken sells as honey', bank.ann.balance === b0 + 2 * D.BEES.combGold && /2 combs/.test(take.toast));
clock += D.BEES.toldMs + 10 * D.BEES.combMs;
const untold = card(ann, 'bees').status;
check('untold for three days they sulk, and what they made stops there', /sulking/.test(untold) && ow.combsOf(accounts.ann.oldWays.bees, clock) === D.BEES.maxCombs);
ow.act(ann, 'bees', 'tell'); clock += D.BEES.combMs + 1;
check('told, they are content again, and what they had made is kept', /have been told/.test(card(ann, 'bees').status) && /6 of 6/.test(card(ann, 'bees').status));
for (let i = 0; i < 3; i++) { ow.act(ann, 'bees', 'take'); clock += D.BEES.combMs + 1; }
check('every fourth taking there is honey enough for a healing draught', packs.ann.healing_potion === 1);

// brownie
night = false;
check('cream is set out at night', !can(ann, 'brownie', 'cream'));
night = true; const c0 = bank.ann.balance; ow.act(ann, 'brownie', 'cream');
check('…and costs its price', bank.ann.balance === c0 - D.BROWNIE.creamGold && !can(ann, 'brownie', 'look') && /Leave it be/.test(card(ann, 'brownie').status));
clock += D.BROWNIE.workMs + 1; roll = 0; const b1 = bank.ann.balance; const look = ow.act(ann, 'brownie', 'look');
check('in the morning something has been done about the house', accounts.ann.oldWays.brownie.nights === 1 && bank.ann.balance > b1 && /hearth is swept/.test(look.toast));
check('it must have worked three nights before you would think to clothe it', !(card(ann, 'brownie').actions || []).some((a) => a.id === 'clothes'));
ow.act(ann, 'brownie', 'cream'); clock += D.BROWNIE.staleMs + D.BROWNIE.workMs;
check('cream left two days turns, and nothing is done', /turned/.test(ow.act(ann, 'brownie', 'look').toast) && accounts.ann.oldWays.brownie.nights === 1);
for (let i = 0; i < 2; i++) { ow.act(ann, 'brownie', 'cream'); clock += D.BROWNIE.workMs + 1; ow.act(ann, 'brownie', 'look'); }
const cl = card(ann, 'brownie').actions.find((a) => a.id === 'clothes');
check('give it clothes and it goes for good', cl && /leave for good/.test(cl.confirm) && /Cauld Lad|only a house/.test(ow.act(ann, 'brownie', 'clothes').toast) && accounts.ann.oldWays.brownie.gone === true && card(ann, 'brownie').actions.length === 0);

// sin
const sb = bank.ann.balance; ow.act(ann, 'sin', 'eat');
check('the sin-eater is paid, and carries what was taken: blows land a tenth harder', bank.ann.balance === sb + D.SIN.gold && ow.statContrib(ann, 'guard') === -0.1 && /Lay it down at the memorial/.test(card(ann, 'sin').status));
ann.room = 'outside'; ann.x = 1600; ann.y = 1100;
check('it is laid down only at the memorial stone', !can(ann, 'sin', 'shed'));
ann.x = 1760; ann.y = 430; ow.act(ann, 'sin', 'shed');
check('…and then you carry only yourself', ow.statContrib(ann, 'guard') === 0 && !can(ann, 'sin', 'eat'));
clock += D.SIN.restMs + 1;
check('once a day', can(ann, 'sin', 'eat'));

// toad
check('the toad is laid on an ant-hill in the Wilds', !can(ann, 'toad', 'lay'));
ann.room = 'wilds'; ow.act(ann, 'toad', 'lay');
check('the ants want their time', !can(ann, 'toad', 'stream') && /ants are at their work/.test(card(ann, 'toad').status));
clock += D.TOAD.cleanMs + 1; night = false;
check('the bones go on the stream at night', !can(ann, 'toad', 'stream'));
night = true; const bone = ow.act(ann, 'toad', 'stream');
check('one bone goes against the stream, and is kept', accounts.ann.oldWays.toad.bone === true && /against it/.test(bone.toast));
check('held, the night creatures of the Wilds let you pass for five minutes', ow.isCalmed(ann) === false && !!ow.act(ann, 'toad', 'calm').toast && ow.isCalmed(ann) === true && ann.toadCalmUntil === clock + D.TOAD.calmMs);
check('…and then the bone is cold for half an hour', !can(ann, 'toad', 'calm'));
clock += D.TOAD.calmMs + 1;
check('the quiet ends', ow.isCalmed(ann) === false);

// wiring
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8'), main = fs.readFileSync(path.join(root, 'client/main.js'), 'utf8'), html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8'), panel = fs.readFileSync(path.join(root, 'client/oldways.js'), 'utf8'), cat = fs.readFileSync(path.join(root, 'data/itemCatalog.js'), 'utf8');
check('only goods that already exist change hands', ['fur_scrap', 'bone_shard', 'healing_potion', 'leather_hide'].every((id) => new RegExp('^  ' + id + ':', 'm').test(cat)));
check('the server answers the panel, saves what was done, and moves whoever rides', /if \(msg\.type === 'oldways_do'\)/.test(server) && /saveAccounts\(\); saveInventories\(\); saveBankAccounts\(\);/.test(server) && /send\(ws, \{ type: 'broom_flight', \.\.\.out\.flight \}\);/.test(server) && /player\.room = out\.flight\.room;/.test(server));
check('a poppet\'s guard and a sin-eater\'s burden count with every other guard; the bone quiets the Wilds\' night creatures until you strike', /function statContrib\(player, statKey\) \{ return oldWays\.statContrib\(player, statKey\) \+/.test(server) && (server.match(/!oldWays\.isCalmed\(nearestP\)/g) || []).length === 2 && /if \(player && player\.toadCalmUntil\) player\.toadCalmUntil = 0;/.test(server));
check('the panel is in the menu, closes with Escape, and a flight changes the map', /id="menuOldWays"/.test(html) && /id="oldWaysModal" class="floatPanel hidden"/.test(html) && /on\('menuOldWays'/.test(main) && /Modals\.isOpen\('oldWaysOpen'\) && e\.key === 'Escape'/.test(main) && /function broomFlight\(msg\)/.test(main) && /if \(msg\.room === 'wilds'\) \{ swapToWildsMap\(\);/.test(main));
check('the panel shows why a thing waits, asks before the brownie is clothed, and gives every lore its tier and source', /a\.enabled \? '' : \(a\.why \|\| ''\)/.test(panel) && /if \(a\.confirm && !b\.dataset\.sure\)/.test(panel) && /callerTier-' \+ w\.tier/.test(panel) && /`Source: \$\{w\.source\}`/.test(panel));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
