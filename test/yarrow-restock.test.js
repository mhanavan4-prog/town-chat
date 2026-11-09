// Mother Yarrow's restock: the Poison Path chapters came in on 1 November, but
// until 5 November a full pack destroyed earned rewards, so a player could pass
// "The Beautiful Lady" (chapter 7) without the belladonna and henbane, and
// then be unable to sow a nightshade for chapter 8. Once per account, opening
// the garden restocks the seed of every baneful chapter already passed —
// held if the pack is full — and never again; anyone who reaches the Poison
// Path under this code is paid the ordinary way and owed nothing.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-restock-');
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
  const q = (inv, id) => h.countItemQty(inv, id);

  // Passed chapter 7 only (now on chapter 8): belladonna and henbane, once.
  const a = join('Lost7', 'rs_a');
  const ainv = h.getInventory(a.p);
  h.getProgress(a.p).greenPath = { chapter: 7, progress: 0 };
  say(a.s, { type: 'garden_state' });
  check('passed chapter 7: 3 belladonna and 3 henbane', q(ainv, 'belladonna') === 3 && q(ainv, 'henbane') === 3 && q(ainv, 'mandrake') === 0, [q(ainv, 'belladonna'), q(ainv, 'henbane')]);
  check('…with Mother Yarrow\'s word', /black cabinet/.test((a.s.lastOfType('toast') || {}).message || ''));
  say(a.s, { type: 'garden_state' });
  check('…once only', q(ainv, 'belladonna') === 3 && h.accounts.rs_a.baneRestockGiven === true);

  // Finished the whole path: all three baneful chapters' seed.
  const b = join('AllNine', 'rs_b');
  const binv = h.getInventory(b.p);
  h.getProgress(b.p).greenPath = { chapter: 9, progress: 0 };
  say(b.s, { type: 'garden_state' });
  check('the whole path passed: all nine baneful seeds, 3 each', ['belladonna', 'henbane', 'mandrake', 'wolfsbane', 'datura', 'hemlock', 'foxglove', 'black_hellebore'].every((id) => q(binv, id) === 3));

  // Not yet at the Poison Path: nothing now, and nothing later either.
  const c = join('Early', 'rs_c');
  const cinv = h.getInventory(c.p);
  h.getProgress(c.p).greenPath = { chapter: 4, progress: 0 };
  say(c.s, { type: 'garden_state' });
  check('before chapter 7: no restock, and none owed', q(cinv, 'belladonna') === 0 && h.accounts.rs_c.baneRestockGiven === true);

  // A full pack: held, not lost.
  const f = join('Full', 'rs_f');
  const finv = h.getInventory(f.p);
  for (let i = 0; i < finv.slots.length; i++) if (!finv.slots[i]) finv.slots[i] = { itemId: 'glass_vial', qty: 1 };
  h.getProgress(f.p).greenPath = { chapter: 7, progress: 0 };
  say(f.s, { type: 'garden_state' });
  const held = h.getProgress(f.p).heldRewards || [];
  check('a full pack holds the restock for later', held.some((r) => r.itemId === 'belladonna' && r.qty === 3) && held.some((r) => r.itemId === 'henbane'));

  // Someone who reaches the Poison Path under this code is paid normally and
  // owed no restock: greenPathEvent marks them while still short of it.
  const d = join('Live', 'rs_d');
  h.getProgress(d.p).level = 20;
  h.getProgress(d.p).greenPath = { chapter: 6, progress: 6 };
  h.greenPathEvent(d.p, 'garden_harvest', { herb: 'mugwort' });
  const dinv = h.getInventory(d.p);
  check('passing chapter 7 live pays 3 belladonna the ordinary way', h.getProgress(d.p).greenPath.chapter === 7 && q(dinv, 'belladonna') === 3);
  say(d.s, { type: 'garden_state' });
  check('…and opening the garden after adds no second packet', q(dinv, 'belladonna') === 3);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 700);
