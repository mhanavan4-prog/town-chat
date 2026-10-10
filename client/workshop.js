// ---------------------------------------------------------------------------
// The Artificer's Workshop (Session N) — the client face of the crafting TREE.
// DI factory, same shape as the Collection Log / Town Board: open-state via the
// Modals registry, recipe list pushed in `init` (getCraftRecipes), live item
// counts read from the inventory state. Rows show every ingredient with a
// have/need tally and only light the Craft button when the whole recipe is
// satisfied — so the tree reads as a tree (Tier 1 feeds Tier 2 feeds Tier 3).
// ---------------------------------------------------------------------------
import { Modals } from './modals.js';

const STAT_LABEL = { power: 'Power', guard: 'Guard', vitality: 'Vitality', haste: 'Haste', swift: 'Swift', leech: 'Leech', xp: 'XP', forage: 'Forage' };

export default function createWorkshop({ send, getCraftRecipes, getInventoryState, getItemCatalog, getEquipStats }) {
function countItem(id) {
  const st = getInventoryState();
  const slots = (st && st.slots) || [];
  let n = 0;
  for (const s of slots) if (s && s.itemId === id) n += (s.qty || 1);
  return n;
}
function statLine(itemId) {
  const stats = (getEquipStats() || {})[itemId];
  if (!stats) return '';
  return Object.entries(stats).map(([k, v]) => {
    const label = STAT_LABEL[k] || k;
    return k === 'vitality' ? `+${v} ${label}` : `+${Math.round(v * 100)}% ${label}`;
  }).join(' · ');
}
function openWorkshopModal() {
  Modals.set('workshopModalOpen', true);
  document.getElementById('workshopModal').classList.remove('hidden');
  document.getElementById('workshopErr').textContent = '';
  renderWorkshopModal();
}
function closeWorkshopModal() {
  Modals.set('workshopModalOpen', false);
  document.getElementById('workshopModal').classList.add('hidden');
}
function renderWorkshopModal() {
  if (!Modals.isOpen('workshopModalOpen')) return;
  const list = document.getElementById('workshopList');
  if (!list) return;
  const recipes = getCraftRecipes() || [];
  const CAT = getItemCatalog() || {};
  list.innerHTML = '';
  if (!recipes.length) { list.innerHTML = '<div class="slNote">The workbench is bare — try again in a moment.</div>'; return; }
  let lastCat = null;
  for (const r of recipes) {
    if (r.category !== lastCat) {
      lastCat = r.category;
      const head = document.createElement('div');
      head.className = 'achCat';
      head.textContent = r.category;
      list.appendChild(head);
    }
    const out = CAT[r.result] || {};
    let canCraft = true;
    const chips = r.ingredients.map(ing => {
      const have = countItem(ing.id);
      const ok = have >= ing.qty;
      if (!ok) canCraft = false;
      const meta = CAT[ing.id] || {};
      return `<span class="craftChip ${ok ? 'ok' : 'short'}">${meta.icon || '?'} ${meta.name || ing.id} ${have}/${ing.qty}</span>`;
    }).join('');
    const stats = statLine(r.result);

    const row = document.createElement('div');
    row.className = 'craftRow' + (canCraft ? ' ready' : '');
    row.innerHTML =
      `<div class="craftHead">
         <span class="craftIcon">${out.icon || '🔨'}</span>
         <span class="craftName">${out.name || r.result}</span>
         <button class="craftBtn" ${canCraft ? '' : 'disabled'}>Craft</button>
       </div>
       ${stats ? `<div class="craftStats">${stats}</div>` : ''}
       <div class="craftChips">${chips}</div>`;
    row.querySelector('.craftBtn').addEventListener('click', () => {
      if (!canCraft) return;
      document.getElementById('workshopErr').textContent = '';
      send({ type: 'workshop_craft', recipeId: r.id });
    });
    list.appendChild(row);
  }
}
(function () {
  const close = document.getElementById('workshopCloseBtn');
  if (close) close.addEventListener('click', closeWorkshopModal);
})();

  return { openWorkshopModal, closeWorkshopModal, renderWorkshopModal };
}
