// The ogham grove — the ten trees the Tree Alphabet lacked now grow in the
// Wilds. Holds: each tree stands in the Wilds (ten of each), harvests through
// the REAL harvest handler into the material its letter is carved from, and
// that material carves the letter; and adding the grove moved no existing
// Wilds tree (separate scatter, separate id prefix).
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-grove-');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
  };
}

const { OGHAM, OGHAM_CARVE_QTY } = require('../data/ogham');
const GROVE = { fearn: 'alder', nion: 'ash_tree', huath: 'hawthorn', ceirt: 'wild_apple', gort: 'ivy_bank', ruis: 'elder', onn: 'gorse', ur: 'heather', edad: 'aspen', idad: 'yew' };
// The original eleven Wilds trees and how many of each (unchanged by the grove).
const ORIGINAL = { watchpine: 16, deadwood: 50, mourning_willow: 12, capwood: 12, hexoak: 14, palebirch: 14, bramblebush: 22, nightberry: 18, thornsnarl: 18, fenfern: 22, toadring: 16 };

require('../server.js');
setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const say = (s, m) => s.emit('message', JSON.stringify(m));
  const decor = h.WORLD2.natureDecor;

  const wflora = decor.filter((d) => d.id.startsWith('wflora_'));
  check('the original Wilds trees are all still there, same ids', Object.entries(ORIGINAL).every(([t, n]) => wflora.filter((d) => d.type === t).length === n) && wflora.length === Object.values(ORIGINAL).reduce((a, b) => a + b, 0));

  const s = makeMockSocket('Forester'); connHandler(s);
  say(s, { type: 'join', name: 'Forester', charId: 0 });
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'grove_a'; h.accounts.grove_a = {};
  const inv = h.getInventory(p);
  p.room = 'wilds';

  for (const [key, type] of Object.entries(GROVE)) {
    const letter = OGHAM.find((o) => o.key === key);
    const trees = decor.filter((d) => d.type === type);
    check(`${letter.name} (${letter.tree}): ten ${type} stand in the Wilds`, trees.length === 10 && trees.every((d) => d.id.startsWith('wgrove_')));
    // Harvest two of them through the real handler.
    const before = h.countItemQty(inv, letter.wood);
    for (const t of trees.slice(0, OGHAM_CARVE_QTY)) { p.x = t.x; p.y = t.y; say(s, { type: 'harvest', decorId: t.id }); }
    check(`  …harvesting gives ${letter.wood}, the wood its letter is carved from`, h.countItemQty(inv, letter.wood) === before + OGHAM_CARVE_QTY, { got: h.countItemQty(inv, letter.wood) - before, err: s.lastOfType('harvest_error') });
    say(s, { type: 'ogham_carve', key });
    check(`  …and it carves ${letter.name}`, h.accounts.grove_a.ogham && h.accounts.grove_a.ogham.carved.includes(key), s.lastOfType('ogham_error'));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 700);
