// Live auction activity feed (admin monitor): the server-side ring that records
// listings, bids, sales and expiries, surfaced read-only on the analytics page
// the same way world chat is. Drives the real WS handlers + resolveListing and
// reads the feed back through the test hook.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-auctfeed-');

function makeMockSocket(label) {
  return {
    label, OPEN: 1, readyState: 1, sent: [], _handlers: {},
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; }
  };
}
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

require('../server.js');

function whenReady(fn, waited = 0) {
  if (global.__testHooks && global.__wssInstances && global.__wssInstances[0]) return fn();
  if (waited >= 5000) throw new Error('server did not become ready within 5s');
  setTimeout(() => whenReady(fn, waited + 25), 25);
}

whenReady(() => {
 try {
  const h = global.__testHooks;
  const { ensureBankAccount, addItemToAccount, getInventory, resolveListing, ITEM_CATALOG, auctionFeedRecent } = h;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];

  function joinAs(label, accountKey) {
    const sock = makeMockSocket(label);
    connHandler(sock);
    sock.emit('message', JSON.stringify({ type: 'join', name: label }));
    const player = h.players.get(sock.lastOfType('init').id);
    if (accountKey) player.accountKey = accountKey;
    return { sock, player };
  }
  const clearSlots = (pool) => { for (let i = 0; i < pool.slots.length; i++) pool.slots[i] = null; return pool; };
  const ITEM = Object.keys(ITEM_CATALOG).filter((id) => !ITEM_CATALOG[id].fx)[0];
  const itemName = ITEM_CATALOG[ITEM].name;

  check('the feed starts empty', auctionFeedRecent(50).length === 0, auctionFeedRecent(50).length);

  // Seller lists an item from their pack.
  const seller = joinAs('Hawker', 'hawker');
  clearSlots(ensureBankAccount('hawker'));
  const sInv = clearSlots(getInventory(seller.player));
  addItemToAccount(sInv, ITEM, 1);
  seller.sock.emit('message', JSON.stringify({ type: 'auction_create', itemId: ITEM, qty: 1, startingBid: 10, buyoutPrice: 50, durationHours: 1, currency: 'gold', source: 'inventory' }));

  let feed = auctionFeedRecent(50);
  check('listing records a "list" event', feed.length === 1 && feed[0].kind === 'list', feed);
  check('the list line names the seller + item', feed[0].name === 'Hawker' && feed[0].text.indexOf(itemName) !== -1, feed[0]);
  check('the list event carries the item card (icon + name + id)', (() => { const it = feed[0].item; return it && it.itemId === ITEM && it.name === itemName && !!it.icon && Array.isArray(it.stats); })(), feed[0].item);

  // Bidder places a bid below buyout.
  const bidder = joinAs('Bidder', 'bidderkey');
  const bAcct = clearSlots(ensureBankAccount('bidderkey')); bAcct.balance = 1000;
  const listing = h.listingsLive.find((l) => l.sellerKey === 'hawker' && l.itemId === ITEM);
  bidder.sock.emit('message', JSON.stringify({ type: 'auction_bid', listingId: listing.id, amount: 20 }));

  feed = auctionFeedRecent(50);
  check('a bid records a "bid" event (newest last, like world chat)', feed[feed.length - 1].kind === 'bid', feed[feed.length - 1]);
  check('the bid line names the bidder + amount', feed[feed.length - 1].name === 'Bidder' && /20/.test(feed[feed.length - 1].text), feed[feed.length - 1]);

  // A buyout-sized bid resolves the listing → a "sold" event.
  bidder.sock.emit('message', JSON.stringify({ type: 'auction_bid', listingId: listing.id, amount: 50 }));
  feed = auctionFeedRecent(50);
  const sold = feed[feed.length - 1];
  check('a buyout bid resolves into a "sold" event', sold.kind === 'sold', sold);
  check('the sold line names winner, price and seller', sold.name === 'Bidder' && /50/.test(sold.text) && /Hawker/.test(sold.text), sold);

  // A fresh unsold listing that expires records an "expired" event.
  addItemToAccount(sInv, ITEM, 1);
  seller.sock.emit('message', JSON.stringify({ type: 'auction_create', itemId: ITEM, qty: 1, startingBid: 5, durationHours: 1, currency: 'gold', source: 'inventory' }));
  const l2 = h.listingsLive.find((l) => l.sellerKey === 'hawker' && l.itemId === ITEM);
  resolveListing(l2); // no bids → expiry
  feed = auctionFeedRecent(50);
  const exp = feed[feed.length - 1];
  check('a no-bid resolve records an "expired" event', exp.kind === 'expired' && exp.name === 'Hawker', exp);

  // Every event carries a timestamp and a currency tag.
  check('every feed row has ts + currency', auctionFeedRecent(50).every((e) => typeof e.ts === 'number' && (e.currency === 'gold' || e.currency === 'ms')));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
 } catch (e) { console.error(e); process.exit(1); }
});
