// ---------------------------------------------------------------------------
// Moonstones UI + gold readouts (Tier 3.4 Phase C). DI factory; open-state via
// the Modals registry. myMoonstones/lastBankState/msPacksCatalog are shared
// state (injected getters). buyMoonstonePack drives Stripe/IAP checkout.
// ---------------------------------------------------------------------------
import { Modals } from './modals.js';

export default function createMoonstones({ getMyMoonstones, getBankState, getMsPacksCatalog, getMe, getSavedAccount, getPaymentsEnabled, requestResumeToken, apiUrlMaybe }) {
function refreshMsUI() {
  const n = getMyMoonstones();
  const menuVal = document.getElementById('menuMsVal');
  if (menuVal) menuVal.textContent = String(n);
  // A prominent, high-contrast balance chip (was tiny low-contrast text). n is a
  // number from the server, so this innerHTML is safe.
  const chip = '<span class="msBalanceChip"><span class="msDia">💎</span>'
    + '<span class="msNum">' + n + '</span><span class="msLbl">Moonstones</span></span>';
  const bal = document.getElementById('msModalBalance');
  if (bal) bal.innerHTML = chip;
  const lbal = document.getElementById('legendBalance');
  if (lbal) lbal.innerHTML = chip;
  // Persistent HUD chip so the balance is always one glance away. Moonstones
  // bind to an account, so it's shown only for logged-in players (guests hide).
  const msTag = document.getElementById('moonstoneTag');
  if (msTag) {
    const acct = getSavedAccount && getSavedAccount();
    msTag.classList.toggle('hidden', !(acct && acct.token));
    const v = document.getElementById('moonstoneTagVal');
    if (v) v.textContent = String(n);
  }
  updateGoldReadouts();
}

// ── Gold readouts (live report: "I can't see how much gold I have") ──────
// Gold lives in the bank vault, but the NUMBER should only ever be one
// glance away: a 🪙 badge on the menu's Inventory row, a purse strip at
// the top of the pack, and a balance line inside the Auction House. All
// three are fed from getBankState() (the server now pushes bank_state at
// every logged-in join, so they're live from the first frame — no more
// "Balance: ?" until you'd visited the teller) and getMyMoonstones() via
// refreshMsUI. Guests have no vault, so their readouts stay hidden and
// the auction strip nudges them toward opening an account instead.
// Numbers only ever come from server payloads, so innerHTML here is safe.
function updateGoldReadouts() {
  const gold = getBankState() ? getBankState().balance : null;
  const menuGold = document.getElementById('menuGoldVal');
  if (menuGold) {
    menuGold.classList.toggle('hidden', gold == null);
    if (gold != null) menuGold.textContent = '🪙 ' + gold;
  }
  const invLine = document.getElementById('invGoldLine');
  if (invLine) {
    invLine.classList.toggle('hidden', gold == null);
    if (gold != null) invLine.innerHTML = '🪙 <b>' + gold + '</b> gold banked · 💎 <b>' + getMyMoonstones() + '</b> carried';
  }
  const aucLine = document.getElementById('auctionBalanceLine');
  if (aucLine) {
    if (gold == null) aucLine.textContent = 'Gold is held at the 🏦 bank — log in to a Town Chat account to earn and spend it.';
    else aucLine.innerHTML = 'You have 🪙 <b>' + gold + '</b> (bank) · 💎 <b>' + getMyMoonstones() + '</b>';
  }
}
function msPriceLabel(cents) { return '$' + (cents / 100).toFixed(2); }
function openMsModal() {
  const modal = document.getElementById('msModal');
  if (!modal) return;
  const err = document.getElementById('msModalErr');
  if (err) err.textContent = '';
  const list = document.getElementById('msPackList');
  if (list) {
    list.innerHTML = '';
    const packs = getMsPacksCatalog() || {};
    for (const packId in packs) {
      const p = packs[packId];
      const btn = document.createElement('button');
      btn.className = 'msPackBtn';
      const label = document.createElement('span');
      label.textContent = '💎 ' + p.ms + ' — ' + p.name;
      const price = document.createElement('span');
      price.className = 'msPackPrice';
      price.textContent = msPriceLabel(p.cents);
      btn.appendChild(label);
      btn.appendChild(price);
      btn.addEventListener('click', () => buyMoonstonePack(packId, btn));
      list.appendChild(btn);
    }
    if (!Object.keys(packs).length) {
      list.textContent = 'The Moonstone ledger hasn\u2019t opened yet — join the town first.';
    }
  }
  refreshMsUI();
  modal.classList.remove('hidden');
  Modals.set('msModalOpen', true);
}
function closeMsModal() {
  const modal = document.getElementById('msModal');
  if (modal) modal.classList.add('hidden');
  Modals.set('msModalOpen', false);
}
const msModalCloseBtn = document.getElementById('msModalCloseBtn');
if (msModalCloseBtn) msModalCloseBtn.addEventListener('click', closeMsModal);
const msHudTag = document.getElementById('moonstoneTag');
if (msHudTag) msHudTag.addEventListener('click', openMsModal);

async function buyMoonstonePack(packId, btn) {
  const err = document.getElementById('msModalErr');
  if (!getSavedAccount() || !getSavedAccount().token) {
    if (err) err.textContent = '⚠️ Moonstones bind to an account — log in (or register) first, then come back.';
    return;
  }
  // Packaged mobile apps buy through the store (StoreKit / Play Billing) —
  // mobile-payments.js installs TOWNCHAT_IAP with a generic buyProduct.
  if (window.TOWNCHAT_IAP && typeof window.TOWNCHAT_IAP.buyProduct === 'function') {
    window.TOWNCHAT_IAP.buyProduct(packId, btn);
    return;
  }
  if (!getPaymentsEnabled()) {
    if (err) err.textContent = '⚠️ Purchases aren\u2019t set up on this server yet.';
    return;
  }
  const restore = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Opening checkout…'; }
  try {
    const token = await requestResumeToken();
    if (token) sessionStorage.setItem('tc_resume', JSON.stringify({ token, name: getMe() ? getMe().name : '', at: Date.now() }));
  } catch (e) {}
  fetch(apiUrlMaybe('/api/checkout'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product: packId, account_token: getSavedAccount().token })
  })
    .then(r => r.json())
    .then(data => {
      if (data.url) { window.location.href = data.url; }
      else {
        if (err) err.textContent = '⚠️ ' + (data.error || 'Could not start checkout.');
        if (btn) { btn.disabled = false; btn.textContent = restore; }
      }
    })
    .catch(() => {
      if (err) err.textContent = '⚠️ Could not reach the server.';
      if (btn) { btn.disabled = false; btn.textContent = restore; }
    });
}

  return { refreshMsUI, updateGoldReadouts, openMsModal, closeMsModal };
}
