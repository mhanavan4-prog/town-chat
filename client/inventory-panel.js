// ---------------------------------------------------------------------------
// Inventory panel — stats / equip / items (Tier 3.4 Phase C). The 📊 Stats tab
// (derived stat block), the equip-preview (hover a slot -> see the stat delta),
// the items grid, and slot selection. Reads the last inventory snapshot + the
// derived stat block; the selected-slot index is shared with main (get/set).
// Item catalog / stat-display tables + the item-icon/tooltip helpers + the tab
// switchers are injected; the gold-readout refresh via getter (declared later).
// ---------------------------------------------------------------------------
export default function createInventoryPanel({ ITEM_CATALOG, Modals, PLANT_EFFECTS, STAT_DISPLAY, buildItemIconEl, hideTooltip, showInvTab, showItemTooltip, toggleInventory, getEquipStatsCatalog, getLastInventoryState, getMyStatBlock, getWs, getUpdateGoldReadouts, getSelectedInvSlotIdx, setSelectedInvSlotIdx }) {
function renderStats() {
  const list = document.getElementById('invStatsList');
  if (!list) return;
  const b = getMyStatBlock();
  if (!b) { list.textContent = 'Loading your stats…'; return; }
  list.innerHTML = '';
  for (const d of STAT_DISPLAY) {
    const st = b.stats[d.key] || { skill: 0, gear: 0, total: 0 };
    const row = document.createElement('div');
    row.className = 'statRow';
    const ic = document.createElement('div'); ic.className = 'statRowIcon'; ic.textContent = d.icon;
    const main = document.createElement('div'); main.className = 'statRowMain';
    const nm = document.createElement('div'); nm.className = 'statRowName'; nm.textContent = d.name;
    const sp = document.createElement('div'); sp.className = 'statRowSplit';
    // vitality is flat points; the rest are percentages
    const skillTxt = d.key === 'vitality' ? `+${Math.round(st.skill)}` : `+${Math.round(st.skill * 100)}%`;
    const gearTxt  = d.key === 'vitality' ? `+${Math.round(st.gear)}`  : `+${Math.round(st.gear * 100)}%`;
    sp.textContent = `${d.hint} · skills ${skillTxt} · gear ${gearTxt}`;
    main.appendChild(nm); main.appendChild(sp);
    const val = document.createElement('div');
    val.className = 'statRowVal' + ((st.total > 0 || (d.key === 'vitality' && b.maxHealth > 100)) ? ' buffed' : '');
    val.textContent = d.fmt(b);
    row.appendChild(ic); row.appendChild(main); row.appendChild(val);
    list.appendChild(row);
  }
}

// Which equipped item currently sits in a slot (from the inventory payload).
function equippedItemInSlot(slotKind) {
  const s = getLastInventoryState() || {};
  return ({ weapon: s.equippedWeapon, head: s.equippedHead, chest: s.equippedChest, feet: s.equippedFeet, ring: s.equippedRing })[slotKind] || null;
}
// Show, in the item action panel, how equipping `itemId` into `slotKind` would
// change each stat versus whatever's equipped there now — computed locally from
// the equip-stats catalog, no server round-trip.
const PREVIEW_STAT_META = {
  power:  { icon: '⚔️', name: 'Attack',  pct: true },
  guard:  { icon: '🛡️', name: 'Defense', pct: true },
  vitality:{ icon: '❤️', name: 'Health', pct: false },
  haste:  { icon: '⏱️', name: 'Haste',   pct: true },
  swift:  { icon: '💨', name: 'Speed',   pct: true },
  leech:  { icon: '🩸', name: 'Lifesteal', pct: true },
  xp:     { icon: '✨', name: 'XP',      pct: true },
  forage: { icon: '🌿', name: 'Harvest', pct: true }
};
function renderEquipPreview(itemId, slotKind) {
  const preview = document.getElementById('invEquipPreview');
  if (!preview) return;
  const incoming = getEquipStatsCatalog()[itemId] || {};
  const current = equippedItemInSlot(slotKind);
  const outgoing = (current && getEquipStatsCatalog()[current]) || {};
  const alreadyOn = current === itemId;
  const parts = [];
  for (const key of Object.keys(PREVIEW_STAT_META)) {
    const delta = (incoming[key] || 0) - (outgoing[key] || 0);
    if (Math.abs(delta) < 1e-9) continue;
    const m = PREVIEW_STAT_META[key];
    const val = m.pct ? Math.round(Math.abs(delta) * 100) + '%' : String(Math.round(Math.abs(delta)));
    const cls = delta > 0 ? 'up' : 'down';
    const arrow = delta > 0 ? '▲' : '▼';
    parts.push(`<span class="previewDelta">${m.icon} ${m.name} <span class="${cls}">${arrow}${val}</span></span>`);
  }
  const title = alreadyOn ? '✓ Currently equipped'
    : (current ? `Replaces ${(ITEM_CATALOG[current] || {}).icon || ''} ${(ITEM_CATALOG[current] || {}).name || current}` : 'Equipping this:');
  if (!parts.length) {
    preview.innerHTML = `<div class="previewTitle">${title}</div><span class="previewDelta same">No stat change.</span>`;
  } else {
    preview.innerHTML = `<div class="previewTitle">${title}</div>${parts.join('')}`;
  }
  preview.classList.remove('hidden');
}
// Re-run the preview for whatever slot is currently selected (after stats
// refresh, e.g. right after an equip changes the baseline).
function refreshEquipPreview() {
  if (getSelectedInvSlotIdx() == null || !getLastInventoryState() || !getLastInventoryState().slots) return;
  const slot = getLastInventoryState().slots[getSelectedInvSlotIdx()];
  if (!slot) return;
  const meta = ITEM_CATALOG[slot.itemId];
  if (meta && meta.slot) renderEquipPreview(slot.itemId, meta.slot);
}

// 💾 Drive — a first-class HUD shortcut straight to the Hard Drive tab
// (selfies, voice clips, note vault). Same panel the Inventory button
// reaches; this just opens it on the right tab in one click.
const driveBtn = document.getElementById('driveBtn');
if (driveBtn) driveBtn.addEventListener('click', () => {
  if (!Modals.isOpen('inventoryOpen')) toggleInventory();
  showInvTab('invHardDriveView');
});

const useDungeonTokenBtn = document.getElementById('useDungeonTokenBtn');
if (useDungeonTokenBtn) {
  useDungeonTokenBtn.addEventListener('click', () => {
    if (!getWs() || getWs().readyState !== WebSocket.OPEN) return;
    getWs().send(JSON.stringify({ type: 'use_dungeon_token' }));
    toggleInventory();
  });
}

// ---------------------------------------------------------------------------
// Items tab — equip slots + 24-slot grid. Click a slot to see what can be
// done with it (equip as weapon/armor if eligible); click an equip slot to
// immediately unequip. Deposit/withdraw between this and the bank's own 24
// slots lives in the Bank modal instead (see openBankModal()/bankWithdrawBtn
// above) since that's themed as something you do "at the bank."
// ---------------------------------------------------------------------------
function renderInventoryItemsPanel() {
  if (!getLastInventoryState()) return;
  getUpdateGoldReadouts()(); // pack header purse strip stays current
  renderEquipSlot('equipWeaponSlot', getLastInventoryState().equippedWeapon, 'weapon');
  renderEquipSlot('equipHeadSlot',   getLastInventoryState().equippedHead,   'head');
  renderEquipSlot('equipChestSlot',  getLastInventoryState().equippedChest,  'chest');
  renderEquipSlot('equipFeetSlot',   getLastInventoryState().equippedFeet,   'feet');
  renderEquipSlot('equipRingSlot',   getLastInventoryState().equippedRing,   'ring');

  const grid = document.getElementById('invSlotsGrid');
  if (!grid) return;
  grid.innerHTML = '';
  getLastInventoryState().slots.forEach((slot, idx) => {
    const cell = document.createElement('div');
    cell.className = 'itemSlot' + (slot ? '' : ' empty') + (getSelectedInvSlotIdx() === idx ? ' selected' : '');
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
      cell.addEventListener('click', () => selectInvSlot(idx));
    }
    grid.appendChild(cell);
  });
}

function renderEquipSlot(elId, itemId, equipKind) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = '';
  el.classList.toggle('empty', !itemId);
  if (!itemId) { el.title = ''; el.onclick = null; return; }
  const item = ITEM_CATALOG[itemId];
  el.textContent = item ? item.icon : '❓';
  el.title = '';
  el.onmouseenter = (e) => showItemTooltip(e, itemId);
  el.onmouseleave = hideTooltip;
  el.onclick = () => {
    document.getElementById('invModalErr').textContent = '';
    getWs().send(JSON.stringify({ type: 'inventory_unequip', equipSlot: equipKind }));
  };
}

function selectInvSlot(idx) {
  setSelectedInvSlotIdx(idx);
  renderInventoryItemsPanel();
  const slot = getLastInventoryState().slots[idx];
  const panel = document.getElementById('invActionPanel');
  const preview = document.getElementById('invEquipPreview');
  if (preview) { preview.classList.add('hidden'); preview.innerHTML = ''; }
  if (!slot) { panel.classList.add('hidden'); return; }
  const item = ITEM_CATALOG[slot.itemId];
  document.getElementById('invActionItemLabel').textContent =
    (item ? item.icon + ' ' + item.name : slot.itemId) + ' (have ' + slot.qty + ')';
  const buttons = document.getElementById('invActionButtons');
  buttons.innerHTML = '';
  const meta = item;
  if (meta && meta.slot) {
    // Live stat preview: how does equipping this compare to what's in the slot?
    renderEquipPreview(slot.itemId, meta.slot);
    const SLOT_LABELS = { weapon:'⚔️ Equip Weapon', head:'🎩 Equip Head', chest:'🛡️ Equip Chest', feet:'👢 Equip Feet', ring:'💍 Equip Ring' };
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = SLOT_LABELS[meta.slot] || '⚙️ Equip';
    btn.addEventListener('click', () => {
      document.getElementById('invModalErr').textContent = '';
      getWs().send(JSON.stringify({ type: 'inventory_equip', slotIdx: idx, equipSlot: meta.slot }));
    });
    buttons.appendChild(btn);
  } else if (slot.itemId === 'hard_drive') {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = '💽 Open Hard Drive';
    btn.addEventListener('click', () => {
      panel.classList.add('hidden');
      showInvTab('invHardDriveView');
    });
    buttons.appendChild(btn);
  } else if (slot.itemId === 'bloodmoon_shard') {
    // Bloodmoon Shards → Circlet (5 shards; server re-validates) — Session L
    const total = getLastInventoryState().slots.reduce((n, s) => n + (s && s.itemId === 'bloodmoon_shard' ? s.qty : 0), 0);
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = '🔻 Bind the Bloodmoon Circlet (5 shards)';
    if (total >= 5) {
      btn.addEventListener('click', () => {
        document.getElementById('invModalErr').textContent = '';
        getWs().send(JSON.stringify({ type: 'craft_circlet' }));
      });
    } else {
      btn.disabled = true;
      btn.style.opacity = '0.55';
      const note = document.createElement('div');
      note.id = 'invEquippableNote';
      note.textContent = `${total}/5 shards — they fall from night creatures under a Blood Moon.`;
      buttons.appendChild(note);
    }
    buttons.appendChild(btn);
  } else if (slot.itemId === 'wood') {
    // Holly Wood → Holly Wand crafting (5 pieces; server re-validates)
    const total = getLastInventoryState().slots.reduce((n, s) => n + (s && s.itemId === 'wood' ? s.qty : 0), 0);
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = '🎇 Build Holly Wand (5 Holly Wood)';
    if (total >= 5) {
      btn.addEventListener('click', () => {
        document.getElementById('invModalErr').textContent = '';
        getWs().send(JSON.stringify({ type: 'craft_wand' }));
      });
    } else {
      btn.disabled = true;
      btn.style.opacity = '0.55';
      const note = document.createElement('div');
      note.id = 'invEquippableNote';
      note.textContent = `${total}/5 Holly Wood — harvest the town trees for more.`;
      buttons.appendChild(note);
    }
    buttons.appendChild(btn);
  } else if (PLANT_EFFECTS.has(slot.itemId)) {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = '🌿 Use ' + (item ? item.name : slot.itemId);
    btn.addEventListener('click', () => {
      document.getElementById('invModalErr').textContent = '';
      getWs().send(JSON.stringify({ type: 'use_item', slotIdx: idx }));
    });
    buttons.appendChild(btn);
  } else {
    const note = document.createElement('div');
    note.id = 'invEquippableNote';
    note.textContent = "Can't be equipped — visit the Bank to deposit or auction it.";
    buttons.appendChild(note);
  }
  panel.classList.remove('hidden');
}

  return { renderStats, refreshEquipPreview, renderInventoryItemsPanel, selectInvSlot };
}
