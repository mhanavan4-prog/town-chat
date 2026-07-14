// ---------------------------------------------------------------------------
// NPC Shop UI (Tier 3.4 Phase C). Extracted from the monolith as a DI factory.
// Owns its open-state via the Modals registry; the shared input guards already
// read Modals.isOpen('npcShopOpen'), so nothing outside needed rewiring.
// ---------------------------------------------------------------------------
import { Modals } from './modals.js';

export default function createShop({ send, getBankState, getInventoryState, ITEM_CATALOG, showItemTooltip, hideTooltip, openQuestDialogue }) {
let currentShopNpcId = null;
let currentShopNpcName = null;

function openNpcShopModal(npcId) {
  currentShopNpcId = npcId;
  send(JSON.stringify({ type: 'npc_shop_open', npcId }));
}

function closeNpcShopModal() {
  Modals.set('npcShopOpen', false);
  currentShopNpcId = null;
  currentShopNpcName = null;
  const el = document.getElementById('npcShopModal');
  if (el) el.classList.add('hidden');
}

let shopBuyItems = [];
let shopSellValues = {};
let shopTab = 'buy';

function renderNpcShop(msg) {
  Modals.set('npcShopOpen', true);
  currentShopNpcId = msg.npcId;
  currentShopNpcName = msg.npcName;
  shopBuyItems = msg.items || [];
  if (msg.sellValues) shopSellValues = msg.sellValues;
  document.getElementById('npcShopTitle').textContent = `🛒 ${msg.npcName}`;
  const bal = getBankState() ? getBankState().balance : '?';
  const balEl = document.getElementById('npcShopBalance');
  balEl.textContent = (msg.greeting ? `“${msg.greeting}”  ·  ` : '') + `Balance: ${bal} 🪙`;
  ensureShopTabs();
  renderShopTab();
  document.getElementById('npcShopErr').textContent = '';
  document.getElementById('npcShopModal').classList.remove('hidden');
}

// Buy/Sell tab bar — built once and inserted above the item list, so no
// index.html change is needed. Buy shows the keeper's wares; Sell shows the
// player's own sellable stacks (from getInventoryState()) priced by
// shopSellValues, which the server ships in npc_shop_state.
function ensureShopTabs() {
  if (document.getElementById('npcShopTabs')) return;
  const items = document.getElementById('npcShopItems');
  if (!items || !items.parentNode) return;
  const bar = document.createElement('div');
  bar.id = 'npcShopTabs';
  bar.style.cssText = 'display:flex;gap:8px;margin:4px 0 2px;';
  for (const t of [['buy', '🛒 Buy'], ['sell', '💰 Sell']]) {
    const b = document.createElement('button');
    b.dataset.tab = t[0];
    b.textContent = t[1];
    b.style.cssText = 'flex:1;padding:7px 0;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;';
    b.addEventListener('click', () => { shopTab = t[0]; renderShopTab(); });
    bar.appendChild(b);
  }
  items.parentNode.insertBefore(bar, items);
}

function renderShopTab() {
  const bar = document.getElementById('npcShopTabs');
  if (bar) for (const b of bar.children) {
    const active = b.dataset.tab === shopTab;
    b.style.background = active ? '#3366aa' : 'rgba(255,255,255,0.08)';
    b.style.color = active ? '#fff' : '#9fb0c0';
  }
  const container = document.getElementById('npcShopItems');
  if (!container) return;
  container.innerHTML = '';
  if (shopTab === 'sell') renderShopSellList(container);
  else renderShopBuyList(container);
}

function renderShopBuyList(container) {
  for (const item of shopBuyItems) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 10px;background:rgba(255,255,255,0.06);border-radius:8px;';
    const priceHtml = item.basePrice && item.basePrice !== item.price
      ? `<span style="color:#8a9a8a;text-decoration:line-through;font-size:11px;">${item.basePrice}</span> <span style="color:#7ddc8f;font-weight:700;">${item.price} 🪙</span>`
      : `<span style="color:#ffd700;font-weight:700;">${item.price} 🪙</span>`;
    row.innerHTML = `<span style="font-size:20px;">${item.icon}</span>
      <span style="flex:1;color:#eafff0;">${item.name}</span>
      ${priceHtml}
      <button data-item="${item.id}" style="padding:5px 14px;background:#3366aa;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;">Buy</button>`;
    row.querySelector('button').addEventListener('click', () => {
      send(JSON.stringify({ type: 'npc_buy_item', npcId: currentShopNpcId, itemId: item.id }));
    });
    row.addEventListener('mouseenter', (e) => showItemTooltip(e, item.id));
    row.addEventListener('mouseleave', hideTooltip);
    container.appendChild(row);
  }
}

function renderShopSellList(container) {
  const slots = (getInventoryState() && getInventoryState().slots) || [];
  const totals = {};
  for (const sl of slots) {
    if (!sl || !sl.itemId) continue;
    if (!(shopSellValues[sl.itemId] > 0)) continue; // only what the shop will buy
    totals[sl.itemId] = (totals[sl.itemId] || 0) + sl.qty;
  }
  const ids = Object.keys(totals);
  if (!ids.length) {
    const empty = document.createElement('div');
    empty.style.cssText = 'padding:18px 10px;color:#9fb0c0;text-align:center;font-size:13px;';
    empty.textContent = 'Nothing here they’ll buy — sellable materials and gear show up as you gather them.';
    container.appendChild(empty);
    return;
  }
  for (const itemId of ids) {
    const meta = ITEM_CATALOG[itemId] || { name: itemId, icon: '❔' };
    const unit = shopSellValues[itemId];
    const qty = totals[itemId];
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(255,255,255,0.06);border-radius:8px;';
    row.innerHTML = `<span style="font-size:20px;">${meta.icon}</span>
      <span style="flex:1;color:#eafff0;">${meta.name} <span style="color:#9fb0c0;font-size:11px;">×${qty}</span></span>
      <span style="color:#ffd700;font-weight:700;">${unit} 🪙<span style="color:#9fb0c0;font-weight:400;font-size:11px;"> ea</span></span>
      <button data-q="1" style="padding:5px 10px;background:#2f7a4f;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;">Sell 1</button>
      <button data-q="all" style="padding:5px 10px;background:rgba(47,122,79,0.55);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;">All (${qty})</button>`;
    row.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      const sellQty = b.dataset.q === 'all' ? qty : 1;
      send(JSON.stringify({ type: 'npc_sell_item', npcId: currentShopNpcId, itemId, qty: sellQty }));
    }));
    row.addEventListener('mouseenter', (e) => showItemTooltip(e, itemId));
    row.addEventListener('mouseleave', hideTooltip);
    container.appendChild(row);
  }
}

const npcShopCloseBtn = document.getElementById('npcShopCloseBtn');
if (npcShopCloseBtn) npcShopCloseBtn.addEventListener('click', closeNpcShopModal);

const npcShopQuestBtn = document.getElementById('npcShopQuestBtn');
if (npcShopQuestBtn) npcShopQuestBtn.addEventListener('click', () => {
  if (currentShopNpcId) {
    const npcId = currentShopNpcId, npcName = currentShopNpcName || currentShopNpcId;
    closeNpcShopModal();
    openQuestDialogue(npcId, npcName);
  }
});

  // Called from the sell-result handler in main when inventory shrinks.
  function refreshShopSellTab() { if (shopTab === 'sell') renderShopTab(); }

  return { openNpcShopModal, closeNpcShopModal, renderNpcShop, refreshShopSellTab };
}
