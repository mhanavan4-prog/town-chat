// Wardrobe (Session N, Phase 1 cosmetics): the data/wardrobe.js catalog
// (sanitize + resolveLook) and the server's set_appearance handler — validation,
// persistence onto progress, and the look riding publicPlayer (player.appearance).
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-wardrobe-');

const { sanitizeAppearance, resolveLook, WARDROBE } = require('../data/wardrobe.js');

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
  };
}
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

// ── Pure catalog logic ────────────────────────────────────────────────────────
check('all six classes have a wardrobe', [0,1,2,3,4,5].every((c) => WARDROBE[c] && WARDROBE[c].weapons.length));
check('sanitize keeps a valid look', (() => { const a = sanitizeAppearance(0, { weapon: 'wand', hat: false, cape: true }); return a.weapon === 'wand' && a.hat === false && a.cape === true; })());
check('sanitize clamps an unknown weapon to the default', (() => { const a = sanitizeAppearance(0, { weapon: 'bogus' }); return a.weapon === 'staff'; })());
check('sanitize defaults toggles to on', (() => { const a = sanitizeAppearance(0, {}); return a.hat === true && a.cape === true; })());
check('sanitize rejects an unknown class', sanitizeAppearance(9, {}) === null);
check('resolveLook maps a weapon to its prop meshes', (() => { const r = resolveLook(0, { weapon: 'wand' }); return r.showProps.length === 1 && r.showProps[0] === '1H_Wand'; })());
check('resolveLook hides a toggled-off cosmetic', (() => { const r = resolveLook(0, { weapon: 'staff', hat: false }); return r.hideCosmetic.indexOf('Mage_Hat') !== -1; })());
check('resolveLook flags the Lich staff on, off', (() => { return resolveLook(5, { weapon: 'staff' }).staff === true && resolveLook(5, { weapon: 'none' }).staff === false; })());
check('resolveLook(null) gives the default look', (() => { const r = resolveLook(0, null); return r.showProps[0] === '2H_Staff' && r.hideCosmetic.length === 0; })());

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];

  function join(tag, charId) {
    const s = makeMockSocket(tag); connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: charId || 0 }));
    return { s, p: h.players.get(s.lastOfType('init').id) };
  }

  // ── A guest sets a look ───────────────────────────────────────────────────────
  const g = join('Dresser', 0);
  check('a fresh player has no appearance yet', !g.p.appearance, g.p.appearance);
  g.s.emit('message', JSON.stringify({ type: 'set_appearance', appearance: { weapon: 'tome', hat: false } }));
  check('set_appearance applies to the live player', g.p.appearance && g.p.appearance.weapon === 'tome' && g.p.appearance.hat === false, g.p.appearance);
  check('the server acks the (sanitized) look', (() => { const a = g.s.lastOfType('appearance_set'); return a && a.appearance.weapon === 'tome'; })());
  check('the look persists onto progress (per class)', (() => { const prog = h.getStoryState ? null : null; return g.p.guestProgress && g.p.guestProgress.appearance && g.p.guestProgress.appearance[0] && g.p.guestProgress.appearance[0].weapon === 'tome'; })(), g.p.guestProgress && g.p.guestProgress.appearance);

  // ── A bogus weapon is clamped, not trusted ────────────────────────────────────
  g.s.emit('message', JSON.stringify({ type: 'set_appearance', appearance: { weapon: 'rocket_launcher' } }));
  check('a bogus weapon is clamped to the class default', g.p.appearance.weapon === 'staff', g.p.appearance);

  // ── A different class gets its own look slot ───────────────────────────────────
  const k = join('SirDress', 3);
  k.s.emit('message', JSON.stringify({ type: 'set_appearance', appearance: { weapon: 'greatsword', helmet: false } }));
  check('a Knight look validates against the Knight catalog', k.p.appearance.weapon === 'greatsword' && k.p.appearance.helmet === false, k.p.appearance);
  check('an invalid toggle key is simply ignored', k.p.appearance.cape === true, k.p.appearance);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 250);
