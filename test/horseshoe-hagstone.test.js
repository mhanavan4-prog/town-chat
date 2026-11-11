// The found horseshoe and the hag stone (data/wards.js): both must be found,
// not bought or made: "It should be a horse-shoe that one finds" (Aubrey), and
// a stone holed "naturally" (Aubrey), "self-bored" (Henderson). Found while
// gathering; set where the writers set them; each wards the house.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-hh-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
  };
}

const { WARDS, WARD_GUARD, HORSESHOE_PLACES, horseshoeProblem, HAGSTONE_PLACES, hagstoneProblem } = require('../data/wards');
const { buildCharmBook } = require('../lib/charmBook');

// ── The record ──────────────────────────────────────────────────────────────
const H = WARDS.horseshoe, S = WARDS.hagstone;
check('Aubrey on the horseshoe, word for word: thresholds, the West end of London, one that one finds', /"It is a thing very common to nail horse-shoes on the thresholds of doors: which is to hinder the power of witches that enter into the house\. Most houses of the West end of London, have the horse-shoe on the threshold\. It should be a horse-shoe that one finds"/.test(H.lore) && /Aubrey, Miscellanies \(1696\)/.test(H.source));
check('Gay\'s line as the first edition prints it ("each threshold\'s guard")', /"The horse-shoe's nail'd \(each threshold's guard\)"/.test(H.lore) && /Gay, Fables \(1727\)/.test(H.source));
check('Moore on Man: iron the one metal, and the shoe over the house, stable or cow-house door (pp. 152–3)', /"was the only one invested with magical power"/.test(H.lore) && /"a horse-shoe is hung up over the entrance door of a house, a stable, or a cow-house"/.test(H.lore) && /Moore.*pp\. 152–3/.test(H.source));
check('which way up: the game says the writers don\'t say, and lets you choose either', /Which way up, these writers do not say/.test(H.lore) && horseshoeProblem({ place: 'over', up: 'points_up' }) === null && horseshoeProblem({ place: 'over', up: 'points_down' }) === null);
check('no "luck runs out" rule, no seven nails, no Nelson\'s Victory: none of it in the old record', !/luck (runs|will run|spill)|seven nails|Nelson|Victory/i.test(H.lore + H.blurb));
check('three places, each where a writer put one', JSON.stringify(Object.keys(HORSESHOE_PLACES)) === '["threshold","over","behind"]' && /Aubrey/.test(HORSESHOE_PLACES.threshold.note) && /Moore/.test(HORSESHOE_PLACES.over.note) && /Napier/.test(HORSESHOE_PLACES.behind.note));
check('Aubrey\'s flint by the manger, holed "naturally", against the hag who rides the horses', /"To hinder the night mare, they hang in a string, a flint with a hole in it \(naturally\) by the manger"/.test(S.lore) && /"to prevent the nightmare, viz\. the hag, from riding their horses, who will sometimes sweat all night"/.test(S.lore));
check('Henderson: self-bored stones, at the head of the bed and in stables (p. 166 n.)', /"Self-bored stones are considered charms against witchcraft, and they keep away nightmare both from man and beast\. They are therefore suspended at the head of the bed as well as in stables"/.test(S.lore) && /Henderson.*p\. 166 n\./.test(S.source));
check('the Rushmore stone was on a cottage door, as the museum card says, and is not given a number we could not settle', /"found fixed on a nail to the cottage-door"/.test(S.lore) && /"to keep away witches"/.test(S.lore) && !/1884\.56/.test(S.source));
check('no fairies through the hole, no adder stones, no Odin: none of it here', !/fair(y|ies)|adder|odin/i.test(S.lore + S.blurb));
check('a stone you bore yourself is refused in the writers\' own words', /"naturally"/.test(hagstoneProblem({ stone: 'bored', place: 'bed' })) && /"self-bored"/.test(hagstoneProblem({ stone: 'bored', place: 'bed' })) && hagstoneProblem({ stone: 'natural', place: 'bed' }) === null && JSON.stringify(Object.keys(HAGSTONE_PLACES)) === '["bed","door"]');

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const say = (s, m) => s.emit('message', JSON.stringify(m));
  function join(tag, key) {
    const s = makeMockSocket(tag); connHandler(s);
    say(s, { type: 'join', name: tag, charId: 0 });
    const p = h.players.get(s.lastOfType('init').id);
    p.accountKey = key; if (!h.accounts[key]) h.accounts[key] = {};
    return { s, p };
  }
  const goHome = (p) => { p.room = 'cottage'; p.instance = 'home_' + p.accountKey; };
  const err = (s) => { const e = s.lastOfType('wards_error'); return e ? e.message : ''; };

  const shopItems = new Set();
  for (const shop of Object.values(h.NPC_SHOPS || {})) for (const it of shop.items) shopItems.add(it.id);
  check('neither is sold in any shop: both must be found', !!h.ITEM_CATALOG.found_horseshoe && !!h.ITEM_CATALOG.hag_stone && !shopItems.has('found_horseshoe') && !shopItems.has('hag_stone'));

  const a = join('Smith', 'hh_a');
  const inv = h.getInventory(a.p);
  goHome(a.p);
  say(a.s, { type: 'nail_horseshoe', place: 'threshold', up: 'points_up' });
  check('with no found horseshoe it is refused in Aubrey\'s words', /It should be a horse-shoe that one finds/.test(err(a.s)) && !(h.accounts.hh_a.wards && h.accounts.hh_a.wards.horseshoe), err(a.s));
  h.addItemToAccount(inv, 'found_horseshoe', 1);
  const guard0 = h.statContrib(a.p, 'guard');
  say(a.s, { type: 'nail_horseshoe', place: 'threshold', up: 'points_down' });
  const w = h.accounts.hh_a.wards;
  check('found, it is nailed on the threshold, points down, and used up', w.horseshoe && w.horseshoe.place === 'threshold' && w.horseshoe.up === 'points_down' && h.countItemQty(inv, 'found_horseshoe') === 0);
  check('…it wards the house like the other marks', Math.abs(h.statContrib(a.p, 'guard') - guard0 - WARD_GUARD) < 1e-9);
  check('…and the house shows it, and which way up', h.wardsPublic('hh_a').horseshoe === 'threshold' && h.wardsPublic('hh_a').horseshoeUp === 'points_down');

  say(a.s, { type: 'hang_hagstone', stone: 'bored', place: 'bed' });
  check('a stone you bored yourself is refused', /naturally/.test(err(a.s)) && !w.hagstone);
  say(a.s, { type: 'hang_hagstone', stone: 'natural', place: 'bed' });
  check('with no holed stone found, it says where to look', /crotal stones/.test(err(a.s)) && !w.hagstone);
  h.addItemToAccount(inv, 'hag_stone', 1);
  const guard1 = h.statContrib(a.p, 'guard');
  say(a.s, { type: 'hang_hagstone', stone: 'natural', place: 'bed' });
  check('found, it hangs at the head of the bed, and wards the house too', w.hagstone && w.hagstone.place === 'bed' && h.countItemQty(inv, 'hag_stone') === 0 && Math.abs(h.statContrib(a.p, 'guard') - guard1 - WARD_GUARD) < 1e-9 && h.wardsPublic('hh_a').hagstone === 'bed');
  const book = buildCharmBook({ acct: h.accounts.hh_a, prog: {}, seasonKey: null });
  const ch = book.chapters.find((c) => c.key === 'wards');
  check('the Charm Book marks both met', ch.entries.find((e) => e.id === 'horseshoe').met && ch.entries.find((e) => e.id === 'hagstone').met);

  // Finding them while gathering.
  const b = join('Gatherer', 'hh_b');
  const invb = h.getInventory(b.p);
  const W2 = h.world2 || h.WORLD2;
  const crotal = (W2 && W2.natureDecor || []).find((d) => d.type === 'crotal_stone');
  check('there are crotal stones in the Wilds to scrape', !!crotal);
  if (crotal) {
    b.p.room = 'wilds'; b.p.instance = ''; b.p.x = crotal.x; b.p.y = crotal.y;
    const rnd = Math.random; Math.random = () => 0.01; // the find comes up
    say(b.s, { type: 'harvest', decorId: crotal.id });
    Math.random = rnd;
    check('scraping a crotal stone can turn up a holed stone at its foot', h.countItemQty(invb, 'hag_stone') === 1 && /holed|hole worn right through/.test((b.s.lastOfType('toast') || {}).message || ''), (b.s.lastOfType('toast') || {}).message);
  }
  const tree = (W2 && W2.natureDecor || []).find((d) => d.type !== 'crotal_stone' && h.HARVEST_TYPES && h.HARVEST_TYPES.has(d.type));
  if (tree) {
    b.p.x = tree.x; b.p.y = tree.y;
    const rnd = Math.random; Math.random = () => 0.01;
    say(b.s, { type: 'harvest', decorId: tree.id });
    Math.random = rnd;
    check('gathering anything can turn up a cast horseshoe in the grass', h.countItemQty(invb, 'found_horseshoe') === 1);
  }
  const wardsJs = fs.readFileSync(path.join(__dirname, '../client/wards.js'), 'utf8');
  const cottage = fs.readFileSync(path.join(__dirname, '../client/cottage-scene.js'), 'utf8');
  const main = fs.readFileSync(path.join(__dirname, '../client/main.js'), 'utf8');
  check('the Wards panel has both, with the bored stone there to be refused', /function horseshoeCard/.test(wardsJs) && /function renderHagstone/.test(wardsJs) && /A pebble you bore through yourself/.test(wardsJs) && /type: 'nail_horseshoe'/.test(wardsJs) && /type: 'hang_hagstone'/.test(wardsJs));
  check('the cottage draws the shoe where it was nailed, and the stone at the head of your own bed', /if \(w\.horseshoe\)/.test(cottage) && /if \(w\.hagstone\)/.test(cottage) && /w\.bedAt/.test(cottage) && /bedAt: lastCottageBedAt/.test(main));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
