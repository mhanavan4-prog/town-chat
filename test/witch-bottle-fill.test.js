// Filling and setting a witch bottle by hand, as the record has it: urine
// first (Blagrave 1671, Glanvill 1681), then something sharp; pins bent or not
// ("sometimes bent", MOLA); corked fast (in Glanvill's tale the cork flew
// out); buried under the hearth, beneath the threshold or under a floor; neck
// down (Greenwich) or upright (Dukes Place). The server checks it, and keeps
// what went in.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-bfill-');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });
function makeMockSocket(tag) {
  return { OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag, on(e, cb) { this._handlers[e] = cb; }, send(d) { this.sent.push(JSON.parse(d)); }, emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); }, lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; } };
}
const fs = require('fs');
const { WARDS, BOTTLE_FILLINGS, BOTTLE_PLACES, bottleProblem } = require('../data/wards');
const ok = { contents: ['urine', 'nails'], corked: true, place: 'hearth', inverted: true, bent: 0 };
check('urine and nails, corked, under the hearth, neck down: right', bottleProblem(ok) === null);
check('no urine: refused in Blagrave\'s words', /"stop the urine of the Patient"/.test(bottleProblem({ ...ok, contents: ['nails'] }) || ''));
check('nothing sharp: refused, "three nails, pins, or needles"', /three nails, pins, or needles/.test(bottleProblem({ ...ok, contents: ['urine', 'salt'] }) || ''));
check('not corked: refused, the cork flew out in Glanvill', /cork flew out/.test(bottleProblem({ ...ok, corked: false }) || ''));
check('no place, or no way up: refused', bottleProblem({ ...ok, place: 'garden' }) !== null && bottleProblem({ ...ok, inverted: undefined }) !== null);
check('upright under the threshold, pins bent, salt and a heart: right too', bottleProblem({ contents: ['urine', 'pins', 'salt', 'heart'], bent: 3, corked: true, place: 'threshold', inverted: false }) === null);
check('only what the record finds goes in', bottleProblem({ ...ok, contents: ['urine', 'nails', 'toad'] }) !== null);
check('every filling says where it comes from; three places, each with its share of finds', BOTTLE_FILLINGS.every((f) => f.src && f.label) && Object.keys(BOTTLE_PLACES).join() === 'hearth,threshold,floor' && /half/.test(BOTTLE_PLACES.hearth.note) && /quarter/.test(BOTTLE_PLACES.threshold.note));
const L = WARDS.bottle.lore;
check('lore: Blagrave 1671, Glanvill\'s Suffolk tale with the cork that flew out, two to two and a half hundred recorded', /Blagrave advised: "stop the urine of the Patient, close up in a bottle, and put into it three nails, pins, or needles, with a little white salt/.test(L) && /Glanvill's Suffolk tale \(1681\)/.test(L) && /"bury it in the Earth"/.test(L) && /two to two and a half hundred/.test(L));
check('lore: the Greenwich bottle buried upside down, still corked, mid-2000s, with brimstone; and others upright', /found by builders in the mid-2000s, had been buried upside down and was still corked/.test(L) && /brimstone/.test(L) && /Others stood upright/.test(L));
check('nobody knows why the pins were bent, and the lore says so', /"sometimes bent" \(MOLA\), and nobody wrote down why/.test(L) && !/meant to snare/.test(L));
check('if you find one: MOLA on finds, the cork left in, Historic England\'s exploding bottles; and no leaflet tacked on', /"Treat it as an archaeological find/.test(L) && /please don't remove this/.test(L) && /sometimes exploded/.test(L) && !/NHS|tetanus/.test(L));
const wards = fs.readFileSync(__dirname + '/../client/wards.js', 'utf8');
check('the panel fills it by hand: what goes in, the pins to bend, the cork, where, which way up', /function renderBottle/.test(wards) && /Bend pin/.test(wards) && /Cork it fast/.test(wards) && /Neck down \(as at Greenwich\)/.test(wards) && /Upright \(as at Dukes Place, Aldgate\)/.test(wards));

require('../server.js');
setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const say = (s, m) => s.emit('message', JSON.stringify(m));
  const s = makeMockSocket('Filler'); connHandler(s);
  say(s, { type: 'join', name: 'Filler', charId: 0 });
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'bfill_a'; h.accounts.bfill_a = {};
  p.room = 'cottage'; p.instance = 'home_bfill_a';
  const inv = h.getInventory(p);
  h.addItemToAccount(inv, 'witch_bottle', 1);
  say(s, { type: 'wards_state' });
  const st = s.lastOfType('wards_state');
  check('the panel is sent the fillings and the places', st.bottleFill && st.bottleFill.fillings.length === BOTTLE_FILLINGS.length && st.bottleFill.places.hearth && st.bottleFill.set === null);
  say(s, { type: 'bury_witch_bottle' });
  check('burying it unfilled is refused, and the bottle kept', /urine/.test((s.lastOfType('wards_error') || {}).message || '') && h.countItemQty(inv, 'witch_bottle') === 1);
  say(s, { type: 'bury_witch_bottle', contents: ['urine', 'pins', 'hair'], bent: 2, corked: true, place: 'threshold', inverted: false });
  const w = h.accounts.bfill_a.wards.bottle;
  check('filled and set: buried, and what went in kept', w && w.place === 'threshold' && w.inverted === false && w.bent === 2 && JSON.stringify(w.contents) === '["urine","pins","hair"]' && h.countItemQty(inv, 'witch_bottle') === 0, w);
  check('the toast says where and which way up', /beneath the threshold, upright, its pins bent/.test(s.sent.filter((m) => m.type === 'toast').map((m) => m.message).join(' ')));
  say(s, { type: 'wards_state' });
  check('…and the panel can show it', s.lastOfType('wards_state').bottleFill.set.place === 'threshold');
  // Marked in the cottage where it was set, for you and for visitors.
  check('the house marks it where it went: beneath the threshold', s.lastOfType('wards_state').bottlePlace === 'threshold' && h.homeLayoutForKey('bfill_a').wards.bottlePlace === 'threshold');
  for (let i = 0; i < 9 && h.accounts.bfill_a.wards.bottle; i++) { p.bottleTurnUntil = 0; h.bottleTurnsCurse(p, 'wither'); }
  check('spent, it cracks where it lay, and the stone stays there', h.accounts.bfill_a.wards.bottle === null && h.homeLayoutForKey('bfill_a').wards.bottle === 'spent' && h.homeLayoutForKey('bfill_a').wards.bottlePlace === 'threshold');
  check('…and the toast says where it cracked', /cracks beneath the threshold/.test(s.sent.filter((m) => m.type === 'toast' || m.type === 'wards_toast' || m.message).map((m) => m.message || '').join(' ')));
  const cs = require('fs').readFileSync(require('path').join(__dirname, '..', 'client', 'cottage-scene.js'), 'utf8');
  check('the cottage draws a hearthstone, a threshold slab or re-laid boards by place, cracked or split once spent', /place === 'threshold'/.test(cs) && /place === 'floor'/.test(cs) && /makeRelaidBoardsTexture\(spent\)/.test(cs) && /makeHearthstoneTexture\(spent\)/.test(cs));
  check('the concealed shoe shows only as newer plaster by the chimney, never the shoe', /makePlasterPatchTexture\(\)/.test(cs) && /if \(w\.shoe\)/.test(cs) && !/w\.shoeItem|itemId/.test(cs));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
