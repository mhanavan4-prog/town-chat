// Auction house (Sessions I/M) — listings store + resolution (item/selfie/voice/
// moonstone paths) + broadcast. Extracted to lib/ in Tier 3.4 Phase B. Heavily
// wired (~20 injected deps). The shared networking helpers, the expiry watcher,
// and the auction message handlers stay in server.js. resolveListing removes a
// listing in-place (splice) so the array reference stays stable across the boundary.
const path = require('path');

module.exports = function createAuctions({ dataDir, persistLoad, persistSave, persistRegister, broadcastAll, players, send, ensureBankAccount, saveBankAccounts, pushBankStateIfOnline, inventories, addItemToAccount, saveInventories, pushInventoryStateIfOnline, findConnectionByAccountKey, makeId, saveInboxes, msAdjust, pushMsStateIfOnline, ITEM_CATALOG }) {
  const LISTINGS_FILE = path.join(dataDir, 'listings.json');
  function loadListings() {
    const d = persistLoad('listings', LISTINGS_FILE);
    return Array.isArray(d) ? d : [];
  }
  function saveListings() { persistSave('listings', LISTINGS_FILE, listings); }
  const listings = loadListings();
  persistRegister('listings', LISTINGS_FILE, () => listings);

  const AUCTION_DURATIONS_MS = { 1: 3600000, 12: 12 * 3600000, 24: 24 * 3600000 };
  // Moonstone-lane house cut, taken from the seller's proceeds at resolution.
  const AUCTION_MS_FEE = 0.10;
  // Selfie listings run much shorter than item listings — minutes, not hours
  // — since guests (who can list selfies but have no bank account to escrow
  // gold for a long-running auction) are expected to be the main sellers.
  const SELFIE_AUCTION_DURATIONS_MS = { 5: 5 * 60000, 10: 10 * 60000, 20: 20 * 60000 };

  function publicListing(l) {
    return {
      id: l.id, sellerName: l.sellerName, itemId: l.itemId || null, qty: l.qty || null,
      currency: l.currency || 'gold',
      isSelfie: !!l.isSelfie, image: l.isSelfie ? l.image : null,
      isVoice: !!l.isVoice, audio: l.isVoice ? l.audio : null,
      startingBid: l.startingBid, buyoutPrice: l.buyoutPrice || null,
      currentBid: l.currentBid, currentBidderName: l.currentBidderName || null,
      expiresAt: l.expiresAt
    };
  }

  function broadcastAuctionState() {
    broadcastAll({ type: 'auction_state', listings: listings.map(publicListing) });
  }

  // Hands an unsold (or undeliverable) item listing back to its seller.
  // Inventory-sourced listings (players can now list straight from their
  // pack, no bank deposit round-trip) go back into the pack they came from,
  // falling back to the bank vault if the pack is full in the meantime.
  // Bank-sourced listings return to the vault as they always have. Works
  // for offline sellers too: a logged-in seller's pack lives in
  // inventories.json keyed by the same account key as their vault, so both
  // destinations are reachable whether or not they're connected. (Item
  // listings always have a sellerKey — guests can't create them.)
  function returnListingItemToSeller(listing) {
    if (listing.source === 'inventory' && inventories[listing.sellerKey] &&
        addItemToAccount(inventories[listing.sellerKey], listing.itemId, listing.qty)) {
      saveInventories();
      pushInventoryStateIfOnline(listing.sellerKey);
      return;
    }
    const sellerAccount = ensureBankAccount(listing.sellerKey);
    addItemToAccount(sellerAccount, listing.itemId, listing.qty);
    saveBankAccounts();
    pushBankStateIfOnline(listing.sellerKey);
  }

  function resolveListing(listing) {
    const _rmIdx = listings.findIndex(l => l.id === listing.id);
    if (_rmIdx !== -1) listings.splice(_rmIdx, 1);

    if (listing.isSelfie) {
      // The selfie itself isn't a bank-held item — it only ever exists as the
      // listing's image, so there's nothing to physically return on a no-bid
      // expiry. A winning bid just pays the seller and delivers the photo to
      // the winner as a note (not silently — the winner sees exactly where it
      // came from).
      if (listing.currentBidderKey) {
        if (listing.sellerKey) {
          const sellerAccount = ensureBankAccount(listing.sellerKey);
          sellerAccount.balance += listing.currentBid;
          saveBankAccounts();
          pushBankStateIfOnline(listing.sellerKey);
        } else {
          // A guest seller has no bank account to pay into — gold only
          // reaches them if they're still connected, as a one-time payout
          // notice. If they've disconnected by the time the auction closes,
          // there's nowhere for it to go, the same way a guest's inventory
          // or notes don't survive a disconnect either.
          const seller = players.get(listing.sellerId);
          if (seller) {
            send(seller.ws, {
              type: 'auction_payout',
              message: `📸 Your selfie sold to ${listing.currentBidderName} for ${listing.currentBid} gold! (Guest sales aren't banked — log in to an account to keep earnings.)`
            });
          }
        }
        pushBankStateIfOnline(listing.currentBidderKey);
        const winner = findConnectionByAccountKey(listing.currentBidderKey);
        const note = {
          id: makeId(), fromId: listing.sellerId || '', fromName: `📸 ${listing.sellerName}'s Auction Selfie`,
          text: `You won ${listing.sellerName}'s auctioned selfie for ${listing.currentBid} gold!`, image: listing.image
        };
        if (winner) {
          winner.inbox.push(note);
          if (winner.accountKey) saveInboxes();
          send(winner.ws, { type: 'note_received', note });
        }
      }
      saveListings();
      return;
    }

    if (listing.isVoice) {
      // Same shape as the isSelfie branch above — the recording isn't a
      // bank-held item, it only exists as the listing's audio, so there's
      // nothing to return on a no-bid expiry. This branch was missing
      // entirely until now: without it, a resolved voice listing fell
      // through to the generic item logic below, which calls
      // addItemToAccount(winnerAccount, listing.itemId, listing.qty) — both
      // undefined for a voice listing, so nothing was ever delivered.
      if (listing.currentBidderKey) {
        if (listing.sellerKey) {
          const sellerAccount = ensureBankAccount(listing.sellerKey);
          sellerAccount.balance += listing.currentBid;
          saveBankAccounts();
          pushBankStateIfOnline(listing.sellerKey);
        } else {
          const seller = players.get(listing.sellerId);
          if (seller) {
            send(seller.ws, {
              type: 'auction_payout',
              message: `🎤 Your howl recording sold to ${listing.currentBidderName} for ${listing.currentBid} gold! (Guest sales aren't banked — log in to an account to keep earnings.)`
            });
          }
        }
        pushBankStateIfOnline(listing.currentBidderKey);
        const winner = findConnectionByAccountKey(listing.currentBidderKey);
        const note = {
          id: makeId(), fromId: listing.sellerId || '', fromName: `📜 Blood Oath, witnessed by ${listing.sellerName}`,
          text: `You won this howl recording for ${listing.currentBid} gold!`, audio: listing.audio
        };
        if (winner) {
          winner.inbox.push(note);
          if (winner.accountKey) saveInboxes();
          send(winner.ws, { type: 'note_received', note });
        }
      }
      saveListings();
      return;
    }

    if (listing.currentBidderKey) {
      const isMs = (listing.currency || 'gold') === 'ms';
      const winnerAccount = ensureBankAccount(listing.currentBidderKey);
      const added = addItemToAccount(winnerAccount, listing.itemId, listing.qty);
      if (added) {
        if (isMs) {
          // Moonstone lane: the house keeps AUCTION_MS_FEE of the hammer
          // price (a deliberate sink — Moonstones must leave circulation
          // somewhere, or nobody ever needs to buy a fresh pack). The seller
          // sees the fee up front when listing.
          const net = Math.floor(listing.currentBid * (1 - AUCTION_MS_FEE));
          msAdjust(listing.sellerKey, net);
          const seller = findConnectionByAccountKey(listing.sellerKey);
          if (seller) send(seller.ws, { type: 'auction_payout', message: `💎 Your ${ITEM_CATALOG[listing.itemId] ? ITEM_CATALOG[listing.itemId].name : 'item'} sold for ${listing.currentBid} Moonstones — ${net} after the house's cut.` });
          pushMsStateIfOnline(listing.sellerKey);
          saveBankAccounts();
        } else {
          const sellerAccount = ensureBankAccount(listing.sellerKey);
          sellerAccount.balance += listing.currentBid;
          saveBankAccounts();
        }
        pushBankStateIfOnline(listing.sellerKey);
        pushBankStateIfOnline(listing.currentBidderKey);
      } else {
        // Winner's bank is full — refund their escrowed bid and hand the
        // item back to the seller instead of losing it. (If the seller's
        // destination is also full it falls back vault-ward inside the
        // helper; a double-full loss remains the rare acceptable edge.)
        if (isMs) { msAdjust(listing.currentBidderKey, listing.currentBid); pushMsStateIfOnline(listing.currentBidderKey); }
        else winnerAccount.balance += listing.currentBid;
        saveBankAccounts();
        returnListingItemToSeller(listing);
        pushBankStateIfOnline(listing.currentBidderKey);
      }
    } else {
      // No bids — the item goes back to wherever the seller listed it from
      // (their pack for an inventory-sourced listing, their bank vault
      // otherwise).
      returnListingItemToSeller(listing);
    }
    saveListings();
  }

  return { listings, publicListing, broadcastAuctionState, returnListingItemToSeller, resolveListing, saveListings, AUCTION_DURATIONS_MS, AUCTION_MS_FEE, SELFIE_AUCTION_DURATIONS_MS };
};
