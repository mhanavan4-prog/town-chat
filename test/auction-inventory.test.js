// 🔨🎒 Auction-from-inventory (Session M) — server-side checks for the two
// live reports this session covers:
//   1. "the player should be allowed to list an item on the auction house
//      currently in their inventory instead of putting it in their bank
//      account" — auction_create now takes source:'inventory'|'bank',
//      escrows out of the chosen pool, and returns unsold items to that
//      same pool (pack-full falls back to the vault).
//   2. "i am unable to see what amount of gold i have" — every logged-in
//      join now gets bank_state + inventory_state pushed up front so the
//      client's gold readouts (menu badge / pack strip / auction strip)
//      are live from the first frame.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-auctinv-test-');

function makeMockSocket(label) {
  return {
    label,
    OPEN: 1,
    readyState: 1,
    sent: [],
    _handlers: {},
    on(event, cb) { this._handlers[event] = cb; },
    send(data) { this.sent.push(JSON.parse(data)); },
    emit(event, ...args) { if (this._handlers[event]) this._handlers[event](...args); },
    lastOfType(type) {
      for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === type) return this.sent[i];
      return null;
    },
    allOfType(type) { return this.sent.filter(m => m.type === type); }
  };
}

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS -', name); }
  else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); }
}

require('../server.js');

// Wait for the server to finish booting rather than guessing a fixed delay:
// `node --test` runs every test file concurrently, so at startup 11 servers
// bootstrap at once (SQLite init + VAPID keygen + store loads) and a flat
// 200ms timer can fire before this file's hooks are ready — an intermittent
// file-level failure that looks like "pass 10 not 11". Poll instead.
function whenReady(fn, waited = 0) {
  if (global.__testHooks && global.__wssInstances && global.__wssInstances[0]) return fn();
  if (waited >= 5000) throw new Error('server did not become ready within 5s');
  setTimeout(() => whenReady(fn, waited + 25), 25);
}

whenReady(() => {
 try {
  const hooks = global.__testHooks;
  const { ensureBankAccount, addItemToAccount, countItemQty, getInventory,
          resolveListing, ITEM_CATALOG, inventories } = hooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];

  function joinAs(label, accountKey) {
    const sock = makeMockSocket(label);
    connHandler(sock);
    sock.emit('message', JSON.stringify({ type: 'join', name: label }));
    const init = sock.lastOfType('init');
    const player = hooks.players.get(init.id);
    if (accountKey) player.accountKey = accountKey; // tests wire accounts directly
    return { sock, player, init };
  }

  // A few plain (non-legendary) item ids to trade with, plus a big pile of
  // distinct legendary ids for the pack-full test.
  const plainIds = Object.keys(ITEM_CATALOG).filter((id) => !ITEM_CATALOG[id].fx);
  const legendIds = Object.keys(ITEM_CATALOG).filter((id) => ITEM_CATALOG[id].fx);
  const X = plainIds[0], Y = plainIds[1], Z = plainIds[2];

  // ensureBankAccount() seeds a NEW account with random starter items, so a
  // seller's fresh vault can happen to already hold X/Y/Z — which would
  // intermittently break the absolute "=== 0 in the bank" assertions below.
  // A test should own its preconditions, so clear each pool to empty before
  // seeding the known items. (freshBank/freshInv return the emptied pool.)
  const clearSlots = (pool) => { for (let i = 0; i < pool.slots.length; i++) pool.slots[i] = null; return pool; };
  const freshBank = (key) => clearSlots(ensureBankAccount(key));
  const freshInv = (player) => clearSlots(getInventory(player));

  // ── 1. gold visibility: a real account join gets pushed its balances ──
  hooks.sessions.set('tok_gold_1', 'goldseer');
  const seer = makeMockSocket('GoldSeer');
  connHandler(seer);
  seer.emit('message', JSON.stringify({ type: 'join', name: 'GoldSeer', charId: 0, accountToken: 'tok_gold_1' }));
  const joinBank = seer.lastOfType('bank_state');
  const joinInv = seer.lastOfType('inventory_state');
  check('logged-in join pushes bank_state (gold readout is live from frame one)',
    joinBank && typeof joinBank.balance === 'number' && Array.isArray(joinBank.slots), joinBank && Object.keys(joinBank));
  check('logged-in join pushes inventory_state alongside it', joinInv && Array.isArray(joinInv.slots));
  const guestProbe = joinAs('GuestProbe', null);
  check('guest join pushes no bank_state (no vault to report)', !guestProbe.sock.lastOfType('bank_state'));

  // ── 2. listing straight from the pack ─────────────────────────────────
  const seller = joinAs('PackSeller', 'packseller');
  const sBank = freshBank('packseller');
  const sInv = freshInv(seller.player);
  addItemToAccount(sInv, X, 3);

  seller.sock.emit('message', JSON.stringify({
    type: 'auction_create', itemId: X, qty: 2, startingBid: 10, buyoutPrice: 50,
    durationHours: 1, currency: 'gold', source: 'inventory'
  }));
  const listing = hooks.listingsLive.find((l) => l.sellerKey === 'packseller' && l.itemId === X);
  check('inventory-sourced listing created with source stamped', listing && listing.source === 'inventory', listing && listing.source);
  check('listed qty escrowed out of the PACK', countItemQty(sInv, X) === 1, countItemQty(sInv, X));
  check('bank slots untouched by a pack listing', countItemQty(sBank, X) === 0);
  const invPush = seller.sock.lastOfType('inventory_state');
  check('seller pushed a fresh inventory_state after listing', invPush && invPush.slots.reduce((n, s) => n + (s && s.itemId === X ? s.qty : 0), 0) === 1);

  // over-listing what the pack holds is refused without side effects
  seller.sock.emit('message', JSON.stringify({
    type: 'auction_create', itemId: X, qty: 99, startingBid: 5,
    durationHours: 1, source: 'inventory'
  }));
  const overErr = seller.sock.lastOfType('bank_error');
  check('over-listing the pack refused with a carrying message', overErr && /carrying/.test(overErr.message), overErr && overErr.message);
  check('refused listing removes nothing', countItemQty(sInv, X) === 1);

  // guests still can't list items at all
  guestProbe.sock.emit('message', JSON.stringify({
    type: 'auction_create', itemId: X, qty: 1, startingBid: 5, durationHours: 1, source: 'inventory'
  }));
  const gErr = guestProbe.sock.lastOfType('bank_error');
  check('guest item listing still refused with account nudge', gErr && /account/i.test(gErr.message));

  // ── 3. no-bid expiry returns to the pack ──────────────────────────────
  resolveListing(listing);
  check('no-bid expiry returns the item to the PACK', countItemQty(sInv, X) === 3, countItemQty(sInv, X));
  check('…and not to the bank', countItemQty(sBank, X) === 0);
  check('resolved listing is gone', !hooks.listingsLive.some((l) => l.id === listing.id));

  // ── 4. pack-full at return time falls back to the vault ──────────────
  const full = joinAs('FullPack', 'fullpack');
  const fInv = freshInv(full.player);
  const fBank = freshBank('fullpack');
  addItemToAccount(fInv, Y, 1);
  full.sock.emit('message', JSON.stringify({
    type: 'auction_create', itemId: Y, qty: 1, startingBid: 10, durationHours: 1, source: 'inventory'
  }));
  const fListing = hooks.listingsLive.find((l) => l.sellerKey === 'fullpack');
  check('full-pack listing went up', !!fListing && countItemQty(fInv, Y) === 0);
  // stuff every slot with distinct legendaries so nothing can stack or fit
  for (let i = 0; i < fInv.slots.length; i++) fInv.slots[i] = { itemId: legendIds[i % legendIds.length], qty: 1 };
  resolveListing(fListing);
  check('pack-full return falls back to the bank vault', countItemQty(fBank, Y) === 1, countItemQty(fBank, Y));
  check('the stuffed pack was not disturbed', countItemQty(fInv, Y) === 0);

  // ── 5. buyout of a pack-sourced listing pays + delivers normally ─────
  const s3 = joinAs('PackSeller3', 'packseller3');
  const s3Bank = freshBank('packseller3');
  const s3Inv = freshInv(s3.player);
  addItemToAccount(s3Inv, Z, 1);
  const s3GoldBefore = s3Bank.balance;
  s3.sock.emit('message', JSON.stringify({
    type: 'auction_create', itemId: Z, qty: 1, startingBid: 10, buyoutPrice: 50,
    durationHours: 1, currency: 'gold', source: 'inventory'
  }));
  const s3Listing = hooks.listingsLive.find((l) => l.sellerKey === 'packseller3');
  const buyer = joinAs('BuyerB', 'buyerb');
  const buyerBank = freshBank('buyerb');
  buyerBank.balance = 500;
  buyer.sock.emit('message', JSON.stringify({ type: 'auction_bid', listingId: s3Listing.id, amount: 50 }));
  check('buyout resolves the pack-sourced listing', !hooks.listingsLive.some((l) => l.id === s3Listing.id));
  check('winner received the item in their bank', countItemQty(buyerBank, Z) === 1);
  check('seller paid the hammer price into their bank', s3Bank.balance === s3GoldBefore + 50, { got: s3Bank.balance, want: s3GoldBefore + 50 });
  check('sold item did NOT bounce back into the seller pack', countItemQty(s3Inv, Z) === 0);

  // ── 6. the original bank-sourced flow is unchanged (regression) ──────
  const s4 = joinAs('VaultSeller', 'vaultseller');
  const s4Bank = freshBank('vaultseller');
  const s4Inv = freshInv(s4.player);
  addItemToAccount(s4Bank, X, 2);
  s4.sock.emit('message', JSON.stringify({
    type: 'auction_create', itemId: X, qty: 2, startingBid: 10, durationHours: 1
    // no source field — older clients / the bank-modal form
  }));
  const s4Listing = hooks.listingsLive.find((l) => l.sellerKey === 'vaultseller');
  check('sourceless listing defaults to bank', s4Listing && s4Listing.source === 'bank', s4Listing && s4Listing.source);
  check('bank-sourced listing escrows from the vault', countItemQty(s4Bank, X) === 0);
  resolveListing(s4Listing);
  check('bank-sourced no-bid expiry returns to the vault', countItemQty(s4Bank, X) === 2);
  check('…and not to the pack', countItemQty(s4Inv, X) === 0);

  // persisted pack survives a reload of inventories store reference
  check('inventories store holds the persisted pack', inventories['packseller'] && countItemQty(inventories['packseller'], X) === 3);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
 } catch (e) {
  console.log('THREW after', pass, 'passed:', e && e.stack || e);
  process.exit(1);
 }
});
