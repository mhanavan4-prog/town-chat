// Wardrobe (Session N, Phase 1 cosmetics): the data/wardrobe.js catalog
// (sanitize + resolveLook) and the server's set_appearance handler — validation,
// persistence onto progress, and the look riding publicPlayer (player.appearance).
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-wardrobe-');

const { sanitizeAppearance, resolveLook, WARDROBE, weaponUnlock, DYES, dyeUnlock, dyeHex } = require('../data/wardrobe.js');

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

// ── Phase 3: dyes (pure catalog) ──────────────────────────────────────────────
check('the dye palette has a free Natural default', (() => { const n = DYES.find((d) => d.id === 'none'); return n && n.hex === null; })());
check('free dyes have no unlock', dyeUnlock('ash') === null && dyeUnlock('sienna') === null);
check('dyeUnlock returns gate configs', (() => { return dyeUnlock('crimson').lvl === 3 && dyeUnlock('royal').chapter === 2 && dyeUnlock('void').ms === 200; })());
check('dyeHex maps an id to its color (and none → null)', dyeHex('crimson') === 0xc83232 && dyeHex('none') === null);
check('sanitize defaults dyes to none', (() => { const a = sanitizeAppearance(0, {}); return a.dyeBody === 'none' && a.dyeAccent === 'none'; })());
check('sanitize keeps valid dyes, drops bogus ones', (() => { const a = sanitizeAppearance(0, { dyeBody: 'crimson', dyeAccent: 'not_a_dye' }); return a.dyeBody === 'crimson' && a.dyeAccent === 'none'; })());
check('resolveLook surfaces the tint hexes', (() => { const r = resolveLook(0, { dyeBody: 'crimson', dyeAccent: 'gold' }); return r.bodyTint === 0xc83232 && r.accentTint === 0xe0b84a; })());
check('resolveLook tints are null with no dye', (() => { const r = resolveLook(0, {}); return r.bodyTint === null && r.accentTint === null; })());

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
  g.s.emit('message', JSON.stringify({ type: 'set_appearance', appearance: { weapon: 'wand', hat: false } }));
  check('set_appearance applies to the live player', g.p.appearance && g.p.appearance.weapon === 'wand' && g.p.appearance.hat === false, g.p.appearance);
  check('the server acks the (sanitized) look', (() => { const a = g.s.lastOfType('appearance_set'); return a && a.appearance.weapon === 'wand'; })());
  check('the look persists onto progress (per class)', (() => { const prog = h.getStoryState ? null : null; return g.p.guestProgress && g.p.guestProgress.appearance && g.p.guestProgress.appearance[0] && g.p.guestProgress.appearance[0].weapon === 'wand'; })(), g.p.guestProgress && g.p.guestProgress.appearance);

  // ── A bogus weapon is clamped, not trusted ────────────────────────────────────
  g.s.emit('message', JSON.stringify({ type: 'set_appearance', appearance: { weapon: 'rocket_launcher' } }));
  check('a bogus weapon is clamped to the class default', g.p.appearance.weapon === 'staff', g.p.appearance);

  // ── A different class gets its own look slot ───────────────────────────────────
  const k = join('SirDress', 3);
  k.s.emit('message', JSON.stringify({ type: 'set_appearance', appearance: { weapon: 'sword_round', helmet: false } }));
  check('a Knight look validates against the Knight catalog', k.p.appearance.weapon === 'sword_round' && k.p.appearance.helmet === false, k.p.appearance);
  check('an invalid toggle key is simply ignored', k.p.appearance.cape === true, k.p.appearance);

  // ── Phase 2: unlocks ──────────────────────────────────────────────────────────
  check('weaponUnlock returns the gate config', (() => { const u = weaponUnlock(1, 'tankard'); return u && u.ms === 300; })());
  check('a free weapon has no unlock', weaponUnlock(0, 'staff') === null);

  // A low-level player can't equip a level-gated look — it clamps to the default.
  const lw = join('CubScout', 1); // Werewolf, level 1
  lw.s.emit('message', JSON.stringify({ type: 'set_appearance', appearance: { weapon: 'axe_shield' } })); // needs Lv 5
  check('a level-locked look clamps to the default', lw.p.appearance.weapon === 'claws', lw.p.appearance);

  // A chapter-gated look clamps when the campaign isn't there yet.
  const cw = join('Apprentice', 0); // Witch, no chapters done
  cw.s.emit('message', JSON.stringify({ type: 'set_appearance', appearance: { weapon: 'tome' } })); // needs Chapter 3
  check('a chapter-locked look clamps to the default', cw.p.appearance.weapon === 'staff', cw.p.appearance);

  // A guest can't buy a Moonstone look.
  lw.s.emit('message', JSON.stringify({ type: 'buy_look', weapon: 'tankard' }));
  check('a guest buying a look gets an account prompt', (() => { const e = lw.s.lastOfType('ms_error'); return e && /account/i.test(e.message); })());

  // ── Phase 2: a real Moonstone purchase ────────────────────────────────────────
  const buyer = join('RichWolf', 1); // Werewolf
  buyer.p.accountKey = 'richwolf';
  h.accounts['richwolf'] = h.accounts['richwolf'] || { username: 'richwolf', miles: {} };
  h.playerProgress['richwolf'] = h.playerProgress['richwolf'] || { level: 1, xp: 0 };
  h.msAdjust('richwolf', 1000);
  buyer.s.emit('message', JSON.stringify({ type: 'buy_look', weapon: 'tankard' })); // 300 💎
  check('buying a look confirms with look_bought', (() => { const b = buyer.s.lastOfType('look_bought'); return b && b.weapon === 'tankard'; })());
  check('the purchase debits Moonstones', h.msBalance('richwolf') === 700, h.msBalance('richwolf'));
  check('the look is recorded on the account', (() => { const pr = h.playerProgress['richwolf']; return pr.wardrobeUnlocks && pr.wardrobeUnlocks[1] && pr.wardrobeUnlocks[1].indexOf('tankard') !== -1; })());
  buyer.s.emit('message', JSON.stringify({ type: 'set_appearance', appearance: { weapon: 'tankard' } }));
  check('a purchased look can now be equipped', buyer.p.appearance.weapon === 'tankard', buyer.p.appearance);
  const balBefore = h.msBalance('richwolf');
  buyer.s.emit('message', JSON.stringify({ type: 'buy_look', weapon: 'tankard' }));
  check('re-buying an owned look does not double-charge', h.msBalance('richwolf') === balBefore, h.msBalance('richwolf'));

  // ── Phase 3: dyes through the server ──────────────────────────────────────────
  // A free dye applies and rides the appearance.
  const d1 = join('Painter', 0);
  d1.s.emit('message', JSON.stringify({ type: 'set_appearance', appearance: { weapon: 'wand', dyeBody: 'ash', dyeAccent: 'sienna' } }));
  check('free dyes apply to the live player', d1.p.appearance.dyeBody === 'ash' && d1.p.appearance.dyeAccent === 'sienna', d1.p.appearance);

  // A level-locked dye clamps to natural (not the class default) for a low level.
  const d2 = join('Novice', 0); // level 1
  d2.s.emit('message', JSON.stringify({ type: 'set_appearance', appearance: { dyeBody: 'cobalt' } })); // needs Lv 9
  check('a level-locked dye clamps to none', d2.p.appearance.dyeBody === 'none', d2.p.appearance);

  // A guest can't buy a Moonstone dye.
  d2.s.emit('message', JSON.stringify({ type: 'buy_dye', dye: 'void' }));
  check('a guest buying a dye gets an account prompt', (() => { const e = d2.s.lastOfType('ms_error'); return e && /account/i.test(e.message); })());

  // A real account buys a Moonstone dye (account-wide) and can then wear it.
  const dbuyer = join('Dyer', 3);
  dbuyer.p.accountKey = 'dyer';
  h.accounts['dyer'] = h.accounts['dyer'] || { username: 'dyer', miles: {} };
  h.playerProgress['dyer'] = h.playerProgress['dyer'] || { level: 1, xp: 0 };
  h.msAdjust('dyer', 1000);
  dbuyer.s.emit('message', JSON.stringify({ type: 'buy_dye', dye: 'void' })); // 200 💎
  check('buying a dye confirms with dye_bought', (() => { const b = dbuyer.s.lastOfType('dye_bought'); return b && b.dye === 'void'; })());
  check('the dye purchase debits Moonstones', h.msBalance('dyer') === 800, h.msBalance('dyer'));
  check('the dye is recorded account-wide', (() => { const pr = h.playerProgress['dyer']; return pr.dyeUnlocks && pr.dyeUnlocks.indexOf('void') !== -1; })());
  dbuyer.s.emit('message', JSON.stringify({ type: 'set_appearance', appearance: { dyeBody: 'void' } }));
  check('a purchased dye can now be worn', dbuyer.p.appearance.dyeBody === 'void', dbuyer.p.appearance);
  const dBal = h.msBalance('dyer');
  dbuyer.s.emit('message', JSON.stringify({ type: 'buy_dye', dye: 'void' }));
  check('re-buying an owned dye does not double-charge', h.msBalance('dyer') === dBal, h.msBalance('dyer'));
  check('an un-owned Moonstone dye still clamps to none when worn', (() => {
    dbuyer.s.emit('message', JSON.stringify({ type: 'set_appearance', appearance: { dyeAccent: 'arcane' } })); // not bought
    return dbuyer.p.appearance.dyeAccent === 'none';
  })(), dbuyer.p.appearance);

  // ── Name color (chat + nameplate flair) ──
  const ncBal = h.msBalance('dyer');
  dbuyer.s.emit('message', JSON.stringify({ type: 'set_name_color', colorId: 'violet' })); // 12 💎
  check('setting a premium name color confirms with name_color_set', (() => { const m = dbuyer.s.lastOfType('name_color_set'); return m && m.colorId === 'violet'; })());
  check('the name color debits its Moonstone price', h.msBalance('dyer') === ncBal - 12, h.msBalance('dyer'));
  check('the name color is owned account-wide', (() => { const pr = h.playerProgress['dyer']; return pr.nameColorUnlocks && pr.nameColorUnlocks.indexOf('violet') !== -1; })());
  check('account + live player color both update to the picked hex', h.accounts['dyer'].color === '#b07cff' && dbuyer.p.color === '#b07cff', { acct: h.accounts['dyer'].color, live: dbuyer.p.color });
  check('the worn name-color id is recorded', h.accounts['dyer'].nameColorId === 'violet');
  const ncBal2 = h.msBalance('dyer');
  dbuyer.s.emit('message', JSON.stringify({ type: 'set_name_color', colorId: 'violet' }));
  check('re-equipping an owned name color does not double-charge', h.msBalance('dyer') === ncBal2, h.msBalance('dyer'));
  dbuyer.s.emit('message', JSON.stringify({ type: 'set_name_color', colorId: 'default' }));
  check('reverting to the default name color is free and un-charged', h.msBalance('dyer') === ncBal2 && h.accounts['dyer'].nameColorId === 'default');

  // ── Familiar coat (cosmetic skin) ──
  const fcBal = h.msBalance('dyer');
  dbuyer.s.emit('message', JSON.stringify({ type: 'set_familiar_skin', skinId: 'ashen' })); // 12 💎
  check('setting a premium familiar coat confirms with familiar_skin_set', (() => { const m = dbuyer.s.lastOfType('familiar_skin_set'); return m && m.skinId === 'ashen'; })());
  check('the familiar coat debits its Moonstone price', h.msBalance('dyer') === fcBal - 12, h.msBalance('dyer'));
  check('the familiar coat is owned account-wide', (() => { const pr = h.playerProgress['dyer']; return pr.familiarSkinUnlocks && pr.familiarSkinUnlocks.indexOf('ashen') !== -1; })());
  check('the worn coat rides the account + live player', h.accounts['dyer'].familiarSkin === 'ashen' && dbuyer.p.familiarSkin === 'ashen');
  const fcBal2 = h.msBalance('dyer');
  dbuyer.s.emit('message', JSON.stringify({ type: 'set_familiar_skin', skinId: 'ashen' }));
  check('re-equipping an owned coat does not double-charge', h.msBalance('dyer') === fcBal2, h.msBalance('dyer'));
  dbuyer.s.emit('message', JSON.stringify({ type: 'set_familiar_skin', skinId: 'default' }));
  check('reverting to the natural coat is free', h.msBalance('dyer') === fcBal2 && h.accounts['dyer'].familiarSkin === 'default');

  // ── Aura (cosmetic foot-glow) ──
  const auBal = h.msBalance('dyer');
  dbuyer.s.emit('message', JSON.stringify({ type: 'set_aura', auraId: 'violet' })); // 15 💎
  check('setting a premium aura confirms with aura_set', (() => { const m = dbuyer.s.lastOfType('aura_set'); return m && m.auraId === 'violet'; })());
  check('the aura debits its Moonstone price', h.msBalance('dyer') === auBal - 15, h.msBalance('dyer'));
  check('the aura is owned account-wide', (() => { const pr = h.playerProgress['dyer']; return pr.auraUnlocks && pr.auraUnlocks.indexOf('violet') !== -1; })());
  check('the worn aura rides the account + live player', h.accounts['dyer'].auraId === 'violet' && dbuyer.p.aura === 'violet');
  const auBal2 = h.msBalance('dyer');
  dbuyer.s.emit('message', JSON.stringify({ type: 'set_aura', auraId: 'violet' }));
  check('re-equipping an owned aura does not double-charge', h.msBalance('dyer') === auBal2, h.msBalance('dyer'));
  dbuyer.s.emit('message', JSON.stringify({ type: 'set_aura', auraId: 'none' }));
  check('clearing the aura (none) is free', h.msBalance('dyer') === auBal2 && h.accounts['dyer'].auraId === 'none');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 250);
