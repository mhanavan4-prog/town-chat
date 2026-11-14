// The Wastes' two reading places (data/emberLore.js, lib/emberLore.js): the sin-eater's stone and the watching place.
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); } }
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const { EMBER_LORE, LORE } = require('../data/emberLore');
const { FINDS } = require('../data/emberField');
const createEmberLore = require('../lib/emberLore');
const by = Object.fromEntries(EMBER_LORE.map((e) => [e.id, e]));
check('two places, each out of the record, with its source and a note of where the game goes past it', EMBER_LORE.length === 2 && EMBER_LORE.every((e) => e.tier === 'record' && e.lore.length >= 2 && e.source && /game/.test(e.note) && e.says && e.hint));
check('the sin-eater is Aubrey\'s report, and says that it is argued over', /Aubrey/.test(by.sin.lore[0]) && /Herefordshire/.test(by.sin.lore[0]) && /not printed until 1881/.test(by.sin.lore[1]) && /argued over/.test(by.sin.note));
check('the watching place is Edgehill as it was printed, and does not say what anybody saw', /23 October 1642/.test(by.watch.lore[0]) && /January 1643/.test(by.watch.lore[1]) && /not for the game to say/.test(by.watch.note));
check('they stand clear of the things on the field', EMBER_LORE.every((e) => FINDS.every((f) => Math.hypot(e.x - f.x, e.y - f.y) > 500)));
let t = 86400000 * 300; const sent = []; let xp = 0;
const el = createEmberLore({ send: (ws, m) => sent.push(m), grantXP: (p, n) => { xp += n; }, now: () => t });
const p = { ws: {}, room: 'ember_wastes', x: by.sin.x + 40, y: by.sin.y, isDead: false };
check('come to once in a day: what is there heads its history, and it pays', el.use(p, 'sin') === true && sent[0].type === 'vh_board' && sent[0].lines[0] === by.sin.says && sent[0].epithet === 'In the record' && xp === LORE.xp);
sent.length = 0;
check('again that day: its history only, and nothing more paid', el.use(p, 'sin') === false && sent[0].type === 'vh_board' && sent[0].lines[0] === by.sin.lore[0] && xp === LORE.xp);
check('from too far off, or outside the Wastes, nothing', el.use({ ...p, x: 0, y: 0 }, 'watch') === false && el.use({ ...p, room: 'wilds' }, 'sin') === false);
t += 86400000; check('and again tomorrow', el.stateOf(p).done.length === 0);
const ember = read('client/ember-scene.js'), main = read('client/main.js'), server = read('server.js');
const m = ember.match(/const EMBER_LORE = \[([\s\S]*?)\n\];/);
check('the client stands them where the server has them', m && EMBER_LORE.every((e) => new RegExp(`id: '${e.id}'[^\\n]*x: ${e.x}, y: ${e.y}, model: '${e.model}'`).test(m[1])));
check('each can be used, has its model in the kit, and is on the Wastes map', /npc: 'emlore', loreId: f\.id/.test(ember) && /type: 'ember_lore_use', id: kiosk\.loreId/.test(main) && /if \(msg\.type === 'ember_lore_use'\)/.test(server) && ['sin_stone', 'watch_stone'].every((k) => fs.existsSync(path.join(__dirname, '..', 'public/kk/home', k + '.glb')) && new RegExp(`em_${k}: 'kk/home/${k}\\.glb'`).test(main)) && /require\('\.\/data\/emberLore'\)\.EMBER_LORE\.map/.test(server));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
