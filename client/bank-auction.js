// ---------------------------------------------------------------------------
// Bank + Send-Money + Auction modals (Tier 3.4 Phase C). The vault-district
// services: the 🏦 Bank (deposit/withdraw gold + item slots), the 💸 Wire Clerk
// (send money to another player), and the 🔨 Auction house (list/browse/bid,
// with the optional selfie photo). The server owns balances/listings; these
// panels render the last pushed state and send actions. The shared last*State
// snapshots + myId/players/ws are injected as getters (main still owns them);
// ITEM_CATALOG, the item/tooltip/selfie helpers, and Modals by reference.
// ---------------------------------------------------------------------------
export default function createBankAuction({ ITEM_CATALOG, Modals, buildItemIconEl, cancelTargeting, captureSelfiePhoto, hideTooltip, openImageLightbox, showItemTooltip, updateGoldReadouts, getLastBankState, getLastInventoryState, getLastAuctionListings, getMyId, getPlayers, getWs }) {
  let selectedBankSlotIdx = null;

function openBankModal() {
  cancelTargeting();
  if (Modals.isOpen('auctionModalOpen')) closeAuctionModal();
  if (Modals.isOpen('sendMoneyModalOpen')) closeSendMoneyModal();
  const modal = document.getElementById('bankModal');
  if (!modal) return;
  document.getElementById('bankModalErr').textContent = '';
  document.getElementById('bankListForm').classList.add('hidden');
  selectedBankSlotIdx = null;
  modal.classList.remove('hidden');
  Modals.set('bankModalOpen', true);
  getWs().send(JSON.stringify({ type: 'bank_open' }));
  getWs().send(JSON.stringify({ type: 'inventory_open' })); // populates the "Deposit from Inventory" dropdown
}

function closeBankModal() {
  const modal = document.getElementById('bankModal');
  if (modal) modal.classList.add('hidden');
  Modals.set('bankModalOpen', false);
}

const bankModalCloseBtn = document.getElementById('bankModalCloseBtn');
if (bankModalCloseBtn) bankModalCloseBtn.addEventListener('click', closeBankModal);

// ---------------------------------------------------------------------------
// Send Money modal — the Wire Clerk NPC's whole job. Recipient must be
// another currently-online player with their own bank account (the server
// enforces this; this just picks from whoever's visible right now). Pure
// request/response like the rest of the bank: getWs().send the request, server
// validates balance/recipient and replies with bank_state or bank_error.
// ---------------------------------------------------------------------------
function openSendMoneyModal() {
  cancelTargeting();
  if (Modals.isOpen('bankModalOpen')) closeBankModal();
  if (Modals.isOpen('auctionModalOpen')) closeAuctionModal();
  const modal = document.getElementById('sendMoneyModal');
  if (!modal) return;
  document.getElementById('sendMoneyErr').textContent = '';
  document.getElementById('sendMoneyAmount').value = '';
  refreshSendMoneyRecipients();
  modal.classList.remove('hidden');
  Modals.set('sendMoneyModalOpen', true);
  getWs().send(JSON.stringify({ type: 'bank_open' })); // populates the balance readout
}

function closeSendMoneyModal() {
  const modal = document.getElementById('sendMoneyModal');
  if (modal) modal.classList.add('hidden');
  Modals.set('sendMoneyModalOpen', false);
}

const sendMoneyModalCloseBtn = document.getElementById('sendMoneyModalCloseBtn');
if (sendMoneyModalCloseBtn) sendMoneyModalCloseBtn.addEventListener('click', closeSendMoneyModal);

function refreshSendMoneyRecipients() {
  const select = document.getElementById('sendMoneyRecipient');
  if (!select) return;
  const prev = select.value;
  select.innerHTML = '';
  const others = Object.values(getPlayers()).filter(p => p.id !== getMyId());
  if (others.length === 0) {
    const opt = document.createElement('option');
    opt.value = ''; opt.textContent = 'No one else is here';
    select.appendChild(opt);
    select.disabled = true;
    return;
  }
  select.disabled = false;
  for (const p of others) {
    const opt = document.createElement('option');
    opt.value = p.id; opt.textContent = p.name;
    select.appendChild(opt);
  }
  if (others.some(p => p.id === prev)) select.value = prev;
}

const sendMoneySubmitBtn = document.getElementById('sendMoneySubmitBtn');
if (sendMoneySubmitBtn) sendMoneySubmitBtn.addEventListener('click', () => {
  const err = document.getElementById('sendMoneyErr');
  const toId = document.getElementById('sendMoneyRecipient').value;
  const amount = parseInt(document.getElementById('sendMoneyAmount').value, 10);
  if (!toId) { err.textContent = 'Pick someone to send money to.'; return; }
  if (!Number.isInteger(amount) || amount < 1) { err.textContent = 'Enter a valid amount.'; return; }
  err.textContent = '';
  getWs().send(JSON.stringify({ type: 'send_money', toId, amount }));
});

function renderBankModal() {
  if (!getLastBankState()) return;
  document.getElementById('bankBalance').textContent = String(getLastBankState().balance);
  const grid = document.getElementById('bankSlotsGrid');
  if (!grid) return;
  grid.innerHTML = '';
  getLastBankState().slots.forEach((slot, idx) => {
    const cell = document.createElement('div');
    cell.className = 'itemSlot' + (slot ? '' : ' empty') + (selectedBankSlotIdx === idx ? ' selected' : '');
    if (slot) {
      const icon = buildItemIconEl(slot.itemId);
      const qty = document.createElement('span');
      qty.className = 'slotQty';
      qty.textContent = String(slot.qty);
      cell.appendChild(icon);
      cell.appendChild(qty);
      cell.title = '';
      cell.addEventListener('mouseenter', (e) => showItemTooltip(e, slot.itemId));
      cell.addEventListener('mouseleave', hideTooltip);
      cell.addEventListener('click', () => selectBankSlot(idx));
    }
    grid.appendChild(cell);
  });
}

function selectBankSlot(idx) {
  selectedBankSlotIdx = idx;
  renderBankModal();
  const slot = getLastBankState().slots[idx];
  const form = document.getElementById('bankListForm');
  if (!slot) { form.classList.add('hidden'); return; }
  const item = ITEM_CATALOG[slot.itemId];
  document.getElementById('bankListItemLabel').textContent =
    (item ? item.icon + ' ' + item.name : slot.itemId) + ' (have ' + slot.qty + ')';
  const qtyInput = document.getElementById('bankListQty');
  qtyInput.max = String(slot.qty);
  qtyInput.value = '1';
  document.getElementById('bankListStartBid').value = '';
  document.getElementById('bankListBuyout').value = '';
  form.classList.remove('hidden');
}

const bankListSubmitBtn = document.getElementById('bankListSubmitBtn');
if (bankListSubmitBtn) bankListSubmitBtn.addEventListener('click', () => {
  if (selectedBankSlotIdx === null || !getLastBankState()) return;
  const slot = getLastBankState().slots[selectedBankSlotIdx];
  const err = document.getElementById('bankModalErr');
  if (!slot) { err.textContent = 'Pick an item first.'; return; }
  const qty = parseInt(document.getElementById('bankListQty').value, 10);
  const startingBid = parseInt(document.getElementById('bankListStartBid').value, 10);
  const buyoutRaw = document.getElementById('bankListBuyout').value;
  const buyoutPrice = buyoutRaw ? parseInt(buyoutRaw, 10) : null;
  const durationHours = parseInt(document.getElementById('bankListDuration').value, 10);
  if (!Number.isInteger(qty) || qty < 1 || qty > slot.qty) { err.textContent = 'Enter a valid quantity.'; return; }
  if (!Number.isInteger(startingBid) || startingBid < 1) { err.textContent = 'Enter a valid starting bid.'; return; }
  if (buyoutPrice !== null && (!Number.isInteger(buyoutPrice) || buyoutPrice <= startingBid)) {
    err.textContent = 'Buyout must be higher than the starting bid.';
    return;
  }
  err.textContent = '';
  getWs().send(JSON.stringify({ type: 'auction_create', itemId: slot.itemId, qty, startingBid, buyoutPrice, durationHours }));
});

const bankWithdrawBtn = document.getElementById('bankWithdrawBtn');
if (bankWithdrawBtn) bankWithdrawBtn.addEventListener('click', () => {
  if (selectedBankSlotIdx === null || !getLastBankState()) return;
  const slot = getLastBankState().slots[selectedBankSlotIdx];
  const err = document.getElementById('bankModalErr');
  if (!slot) { err.textContent = 'Pick an item first.'; return; }
  const qty = parseInt(document.getElementById('bankListQty').value, 10);
  if (!Number.isInteger(qty) || qty < 1 || qty > slot.qty) { err.textContent = 'Enter a valid quantity.'; return; }
  err.textContent = '';
  getWs().send(JSON.stringify({ type: 'bank_withdraw', slotIdx: selectedBankSlotIdx, qty }));
});

function populateBankDepositSelect() {
  const select = document.getElementById('bankDepositItemSelect');
  if (!select || !getLastInventoryState()) return;
  select.innerHTML = '';
  getLastInventoryState().slots.forEach((slot, idx) => {
    if (!slot) return;
    const item = ITEM_CATALOG[slot.itemId];
    const opt = document.createElement('option');
    opt.value = String(idx);
    opt.textContent = (item ? item.icon + ' ' + item.name : slot.itemId) + ' (have ' + slot.qty + ')';
    select.appendChild(opt);
  });
}

const bankDepositSubmitBtn = document.getElementById('bankDepositSubmitBtn');
if (bankDepositSubmitBtn) bankDepositSubmitBtn.addEventListener('click', () => {
  const err = document.getElementById('bankModalErr');
  const idx = parseInt(document.getElementById('bankDepositItemSelect').value, 10);
  if (!getLastInventoryState() || !Number.isInteger(idx) || !getLastInventoryState().slots[idx]) { err.textContent = 'Pick an item first.'; return; }
  const slot = getLastInventoryState().slots[idx];
  const qty = parseInt(document.getElementById('bankDepositQty').value, 10);
  if (!Number.isInteger(qty) || qty < 1 || qty > slot.qty) { err.textContent = 'Enter a valid quantity.'; return; }
  err.textContent = '';
  getWs().send(JSON.stringify({ type: 'bank_deposit', slotIdx: idx, qty }));
});

function openAuctionModal() {
  cancelTargeting();
  if (Modals.isOpen('bankModalOpen')) closeBankModal();
  if (Modals.isOpen('sendMoneyModalOpen')) closeSendMoneyModal();
  const modal = document.getElementById('auctionModal');
  if (!modal) return;
  document.getElementById('auctionModalErr').textContent = '';
  document.getElementById('auctionCreateForm').classList.add('hidden');
  document.getElementById('auctionSelfieForm').classList.add('hidden');
  modal.classList.remove('hidden');
  Modals.set('auctionModalOpen', true);
  updateGoldReadouts();
  getWs().send(JSON.stringify({ type: 'bank_open' }));
  getWs().send(JSON.stringify({ type: 'inventory_open' })); // the sell picker lists pack items too
  getWs().send(JSON.stringify({ type: 'auction_browse' }));
}

function closeAuctionModal() {
  const modal = document.getElementById('auctionModal');
  if (modal) modal.classList.add('hidden');
  Modals.set('auctionModalOpen', false);
}

const auctionModalCloseBtn = document.getElementById('auctionModalCloseBtn');
if (auctionModalCloseBtn) auctionModalCloseBtn.addEventListener('click', closeAuctionModal);

const auctionCreateToggleBtn = document.getElementById('auctionCreateToggleBtn');
if (auctionCreateToggleBtn) auctionCreateToggleBtn.addEventListener('click', () => {
  const form = document.getElementById('auctionCreateForm');
  if (!form) return;
  document.getElementById('auctionSelfieForm').classList.add('hidden');
  if (form.classList.contains('hidden')) populateAuctionItemSelect();
  form.classList.toggle('hidden');
});

let pendingSelfieImage = null;

const auctionSelfieToggleBtn = document.getElementById('auctionSelfieToggleBtn');
if (auctionSelfieToggleBtn) auctionSelfieToggleBtn.addEventListener('click', () => {
  const form = document.getElementById('auctionSelfieForm');
  if (!form) return;
  document.getElementById('auctionCreateForm').classList.add('hidden');
  form.classList.toggle('hidden');
});

const auctionSelfieCaptureBtn = document.getElementById('auctionSelfieCaptureBtn');
if (auctionSelfieCaptureBtn) auctionSelfieCaptureBtn.addEventListener('click', () => {
  const err = document.getElementById('auctionModalErr');
  err.textContent = '';
  auctionSelfieCaptureBtn.disabled = true;
  auctionSelfieCaptureBtn.textContent = 'Opening camera…';
  captureSelfiePhoto()
    .then(image => {
      pendingSelfieImage = image;
      const preview = document.getElementById('auctionSelfiePreview');
      preview.src = image;
      preview.classList.remove('hidden');
      auctionSelfieCaptureBtn.textContent = 'Retake selfie';
      auctionSelfieCaptureBtn.disabled = false;
    })
    .catch(() => {
      err.textContent = 'Could not access the camera.';
      auctionSelfieCaptureBtn.textContent = 'Take selfie';
      auctionSelfieCaptureBtn.disabled = false;
    });
});

const auctionSelfieSubmitBtn = document.getElementById('auctionSelfieSubmitBtn');
if (auctionSelfieSubmitBtn) auctionSelfieSubmitBtn.addEventListener('click', () => {
  const err = document.getElementById('auctionModalErr');
  if (!pendingSelfieImage) { err.textContent = 'Take a selfie first.'; return; }
  const startingBid = parseInt(document.getElementById('auctionSelfieStartBid').value, 10);
  const buyoutRaw = document.getElementById('auctionSelfieBuyout').value;
  const buyoutPrice = buyoutRaw ? parseInt(buyoutRaw, 10) : null;
  const durationMinutes = parseInt(document.getElementById('auctionSelfieDuration').value, 10);
  if (!Number.isInteger(startingBid) || startingBid < 1) { err.textContent = 'Enter a valid starting bid.'; return; }
  if (buyoutPrice !== null && (!Number.isInteger(buyoutPrice) || buyoutPrice <= startingBid)) {
    err.textContent = 'Buyout must be higher than the starting bid.';
    return;
  }
  err.textContent = '';
  getWs().send(JSON.stringify({ type: 'auction_list_selfie', image: pendingSelfieImage, startingBid, buyoutPrice, durationMinutes }));
  pendingSelfieImage = null;
  document.getElementById('auctionSelfiePreview').classList.add('hidden');
  document.getElementById('auctionSelfieCaptureBtn').textContent = 'Take selfie';
  document.getElementById('auctionSelfieForm').classList.add('hidden');
});

// The sell picker offers BOTH pools: what you're carrying and what's in
// your vault (live report: you shouldn't have to deposit an item at the
// bank just to auction it). Option values are "inv:3" / "bank:7" so the
// submit handler knows which slots array — and which server-side source —
// the pick refers to. The pack group comes first: listing carried loot is
// the common case now.
function populateAuctionItemSelect() {
  const select = document.getElementById('auctionItemSelect');
  if (!select) return;
  select.innerHTML = '';
  const addGroup = (label, state, prefix) => {
    if (!state) return 0;
    let added = 0;
    const group = document.createElement('optgroup');
    group.label = label;
    state.slots.forEach((slot, idx) => {
      if (!slot) return;
      const item = ITEM_CATALOG[slot.itemId];
      const opt = document.createElement('option');
      opt.value = prefix + ':' + idx;
      opt.textContent = (item ? item.icon + ' ' + item.name : slot.itemId) + ' (have ' + slot.qty + ')';
      group.appendChild(opt);
      added++;
    });
    if (added) select.appendChild(group);
    return added;
  };
  const n = addGroup('🎒 Your pack', getLastInventoryState(), 'inv')
          + addGroup('🏦 Bank vault', getLastBankState(), 'bank');
  if (!n) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Nothing to list yet — go find some loot!';
    select.appendChild(opt);
  }
}

const auctionCreateSubmitBtn = document.getElementById('auctionCreateSubmitBtn');
if (auctionCreateSubmitBtn) auctionCreateSubmitBtn.addEventListener('click', () => {
  const err = document.getElementById('auctionModalErr');
  const raw = String(document.getElementById('auctionItemSelect').value || '');
  const m = raw.match(/^(inv|bank):(\d+)$/);
  const state = m ? (m[1] === 'inv' ? getLastInventoryState() : getLastBankState()) : null;
  const slot = state ? state.slots[parseInt(m[2], 10)] : null;
  if (!slot) { err.textContent = 'Pick an item first.'; return; }
  const qty = parseInt(document.getElementById('auctionQty').value, 10);
  const startingBid = parseInt(document.getElementById('auctionStartBid').value, 10);
  const buyoutRaw = document.getElementById('auctionBuyout').value;
  const buyoutPrice = buyoutRaw ? parseInt(buyoutRaw, 10) : null;
  const durationHours = parseInt(document.getElementById('auctionDuration').value, 10);
  if (!Number.isInteger(qty) || qty < 1 || qty > slot.qty) { err.textContent = 'Enter a valid quantity.'; return; }
  if (!Number.isInteger(startingBid) || startingBid < 1) { err.textContent = 'Enter a valid starting bid.'; return; }
  if (buyoutPrice !== null && (!Number.isInteger(buyoutPrice) || buyoutPrice <= startingBid)) {
    err.textContent = 'Buyout must be higher than the starting bid.';
    return;
  }
  err.textContent = '';
  const currency = (document.getElementById('auctionCurrency') || {}).value === 'ms' ? 'ms' : 'gold';
  const source = m[1] === 'inv' ? 'inventory' : 'bank';
  getWs().send(JSON.stringify({ type: 'auction_create', itemId: slot.itemId, qty, startingBid, buyoutPrice, durationHours, currency, source }));
  document.getElementById('auctionCreateForm').classList.add('hidden');
});
const auctionCurrencySel = document.getElementById('auctionCurrency');
if (auctionCurrencySel) auctionCurrencySel.addEventListener('change', () => {
  const note = document.getElementById('auctionMsFeeNote');
  if (note) note.classList.toggle('hidden', auctionCurrencySel.value !== 'ms');
});

function formatTimeRemaining(expiresAt) {
  const ms = expiresAt - Date.now();
  if (ms <= 0) return 'ending…';
  const mins = Math.floor(ms / 60000);
  const hrs = Math.floor(mins / 60);
  return hrs >= 1 ? (hrs + 'h ' + (mins % 60) + 'm left') : (mins + 'm left');
}

// Builds each row's text via .textContent (never innerHTML) specifically
// because sellerName/currentBidderName are other getPlayers()' display names —
// arbitrary-ish user input. textContent never parses its string as markup
// no matter what's in it, so this is safe regardless of what characters a
// name contains, consistent with how chat messages render player names
// elsewhere in this file.
function renderAuctionModal() {
  const list = document.getElementById('auctionListings');
  const empty = document.getElementById('auctionEmptyMsg');
  if (!list || !empty) return;
  list.innerHTML = '';
  if (getLastAuctionListings().length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  for (const l of getLastAuctionListings()) {
    const item = ITEM_CATALOG[l.itemId];
    const row = document.createElement('div');
    row.className = 'auctionRow';

    if (l.isSelfie) {
      const thumb = document.createElement('img');
      thumb.className = 'auctionSelfieThumb';
      thumb.src = l.image;
      thumb.title = 'Click to view full size';
      thumb.addEventListener('click', () => openImageLightbox(l.image));
      row.appendChild(thumb);
      const itemLine = document.createElement('div');
      itemLine.className = 'auctionItemLine';
      itemLine.textContent = `📸 ${l.sellerName}'s Selfie`;
      row.appendChild(itemLine);
    } else if (l.isVoice) {
      const itemLine = document.createElement('div');
      itemLine.className = 'auctionItemLine';
      itemLine.textContent = `📜 Blood Oath, witnessed by ${l.sellerName}`;
      row.appendChild(itemLine);
      const oathDesc = document.createElement('div');
      oathDesc.style.cssText = 'color:#c9a878;font-size:11px;font-style:italic;margin-bottom:6px;';
      oathDesc.textContent = 'A howl sworn under the full moon, sealed into this record as binding testimony.';
      row.appendChild(oathDesc);
      const player = document.createElement('audio');
      player.className = 'auctionVoicePlayer';
      player.controls = true;
      player.src = l.audio;
      row.appendChild(player);
    } else {
      const itemLine = document.createElement('div');
      itemLine.className = 'auctionItemLine';
      itemLine.textContent = (item ? item.icon + ' ' + item.name : l.itemId) + ' x' + l.qty;
      row.appendChild(itemLine);
    }

    const sym = (l.currency === 'ms') ? ' 💎' : ' 🪙';
    const bidLine = l.currentBid != null
      ? ('Current bid: ' + l.currentBid + sym + ' by ' + l.currentBidderName)
      : ('Starting bid: ' + l.startingBid + sym);
    const buyoutLine = l.buyoutPrice ? (' · Buyout: ' + l.buyoutPrice + sym) : '';
    const metaLine = document.createElement('div');
    metaLine.className = 'auctionMeta';
    metaLine.textContent = 'Seller: ' + l.sellerName + ' · ' + bidLine + buyoutLine + ' · ' + formatTimeRemaining(l.expiresAt);
    row.appendChild(metaLine);

    const bidRow = document.createElement('div');
    bidRow.className = 'auctionBidRow';
    const minBid = l.currentBid != null ? l.currentBid + 1 : l.startingBid;
    const input = document.createElement('input');
    input.type = 'number';
    input.min = String(minBid);
    input.placeholder = String(minBid);
    const bidBtn = document.createElement('button');
    bidBtn.className = 'btn';
    bidBtn.textContent = 'Bid';
    bidBtn.addEventListener('click', () => {
      const amount = parseInt(input.value, 10);
      const err = document.getElementById('auctionModalErr');
      if (!Number.isInteger(amount)) { err.textContent = 'Enter a bid amount.'; return; }
      err.textContent = '';
      getWs().send(JSON.stringify({ type: 'auction_bid', listingId: l.id, amount }));
    });
    bidRow.appendChild(input);
    bidRow.appendChild(bidBtn);

    if (l.buyoutPrice) {
      const buyoutBtn = document.createElement('button');
      buyoutBtn.className = 'btn';
      buyoutBtn.textContent = 'Buyout';
      buyoutBtn.addEventListener('click', () => {
        document.getElementById('auctionModalErr').textContent = '';
        getWs().send(JSON.stringify({ type: 'auction_bid', listingId: l.id, amount: l.buyoutPrice }));
      });
      bidRow.appendChild(buyoutBtn);
    }

    row.appendChild(bidRow);
    list.appendChild(row);
  }
}

  return { openBankModal, closeBankModal, renderBankModal, openSendMoneyModal, closeSendMoneyModal, openAuctionModal, closeAuctionModal, renderAuctionModal, populateBankDepositSelect, populateAuctionItemSelect };
}
