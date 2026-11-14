// Moonstone time-savers (data/msBoons.js, server.js ms_boon): each skips a wait already in the game.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-boons-test-');
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); } }
function makeMockSocket(label) {
  return { label, OPEN: 1, readyState: 1, sent: [], _handlers: {},
    on(event, cb) { this._handlers[event] = cb; }, send(data) { this.sent.push(JSON.parse(data)); },
    emit(event, ...args) { if (this._handlers[event]) this._handlers[event](...args); },
    lastOfType(type) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === type) return this.sent[i]; return null; } };
}
const { MS_BOONS, ROUNDS, TORCH_HOLD_MS } = require('../data/msBoons');
const { BYWAYS } = require('../data/byways');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
check('five time-savers, each priced, each saying what wait it skips', MS_BOONS.length === 5 && MS_BOONS.every((b) => b.cost > 0 && b.cost <= 15 && b.blurb.length > 40 && b.name && b.icon) && MS_BOONS.map((b) => b.id).join() === 'rested,torches,besom,harvest,round');
check('none of them sells experience, gold, levels or gear outright', !/grantXP|balance \+=|addItemToAccount|prog\.level/.test(read('server.js').match(/if \(msg\.type === 'ms_boon'\) \{[\s\S]*?\n    \}\n/)[0]));

require('../server.js');
setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('b'); connHandler(s); s.emit('message', JSON.stringify({ type: 'join', name: 'Spender' }));
  const p = h.players.get(s.lastOfType('init').id);
  const say = (m) => s.emit('message', JSON.stringify(m));
  const errs = () => s.sent.filter((m) => m.type === 'ms_error').map((m) => m.message);
  s.sent.length = 0; say({ type: 'ms_boon', id: 'rested' });
  check('a guest is told to log in, and nothing is spent', errs().some((e) => /Log into an account/.test(e)));
  p.accountKey = 'spender'; s._isGuest = false; h.accounts.spender = h.accounts.spender || {};
  h.msAdjust('spender', 100 - h.msBalance('spender'));
  s.sent.length = 0; say({ type: 'ms_boons' });
  const body = s.lastOfType('ms_boons_state');
  check('the panel is told the five, with the besom\'s landings and the rounds to choose from', body && body.boons.length === 5 && body.boons.find((b) => b.id === 'besom').choices.length > 5 && body.boons.find((b) => b.id === 'round').choices.length === ROUNDS.length && body.balance === 100);

  p.restedUntil = 0; s.sent.length = 0; say({ type: 'ms_boon', id: 'rested' });
  check('rested again: the window starts now, the client is told, and 10 are spent', p.restedUntil > Date.now() + 9 * 60000 && s.lastOfType('rested_state') && h.msBalance('spender') === 90);
  s.sent.length = 0; say({ type: 'ms_boon', id: 'rested' });
  check('while rested it will not sell another', errs().some((e) => /rested already/.test(e)) && h.msBalance('spender') === 90);

  h.setTemplePortal(false); s.sent.length = 0; say({ type: 'ms_boon', id: 'torches' });
  check('the torches: the way is open, though the keepers have not lit them', h.templePortalOpen() === true && h.msBalance('spender') === 75);
  s.sent.length = 0; say({ type: 'ms_boon', id: 'torches' });
  check('and not sold twice while it stands open', errs().some((e) => /burning already/.test(e)) && h.msBalance('spender') === 75 && TORCH_HOLD_MS === 20 * 60 * 1000);

  s.sent.length = 0; say({ type: 'ms_boon', id: 'besom', choice: 'troy' });
  check('no besom made: nothing sold', errs().some((e) => /no besom yet/.test(e)) && h.msBalance('spender') === 75);
  h.accounts.spender.oldWays = { besom: { made: true, restUntil: Date.now() + 1e6 } };
  Object.assign(p, { room: 'outside', x: 1000, y: 1000, isDead: false });
  s.sent.length = 0; say({ type: 'ms_boon', id: 'besom', choice: 'troy' });
  const fl = s.lastOfType('broom_flight');
  check('with one, it flies now though it is resting, and sets her down where she chose', fl && p.room === 'wilds' && fl.name === 'The Shepherd\'s Race' && h.msBalance('spender') === 72);

  s.sent.length = 0; say({ type: 'ms_boon', id: 'round', choice: 'byways' });
  check('a round not walked today is not sold', errs().some((e) => /not walked any of that round/.test(e)) && h.msBalance('spender') === 72);
  const hob = BYWAYS.find((b) => b.id === 'hob');
  Object.assign(p, { room: 'wilds', x: hob.x + 30, y: hob.y }); say({ type: 'byway_use', id: 'hob' });
  check('(Hob\'s hole used today)', h.accounts.spender.byways && h.accounts.spender.byways.done.includes('hob'));
  s.sent.length = 0; say({ type: 'ms_boon', id: 'round', choice: 'byways' });
  check('walked today: it can be walked again, for 12', !h.accounts.spender.byways && h.msBalance('spender') === 60);

  s.sent.length = 0; say({ type: 'ms_boon', id: 'harvest' });
  check('second harvest away from any picked plant: nothing sold', errs().some((e) => /Stand right at a plant/.test(e)) && h.msBalance('spender') === 60);
  h.msAdjust('spender', -58); s.sent.length = 0; say({ type: 'ms_boon', id: 'rested' });
  check('too few Moonstones: told the price and what she carries', errs().some((e) => /is 10 💎 — you carry 2/.test(e)));

  const html = read('public/index.html'), ms = read('client/moonstones.js'), main = read('client/main.js');
  check('the Moonstones panel lists them, and a purchase takes two taps', /id="msBoonList"/.test(html) && /Tap again to spend/.test(ms) && /sendWs\(\{ type: 'ms_boon', id: b\.id/.test(ms) && /msg\.type === 'ms_boons_state'/.test(main) && /msg\.type === 'rested_state'/.test(main));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
