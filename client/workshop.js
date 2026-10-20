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

export default function createWorkshop({ send, getCraftRecipes, getInventoryState, getItemCatalog, getEquipStats, getRecipesUnlocked, getGold, showItemTooltip, hideTooltip }) {
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
// The Artificer's patter — a random line each time you open the forge.
const GREETINGS = [
  "Mind the sparks. Hand me what you've gathered and we'll see what it wants to become.",
  "Everything's got a truer shape inside it — the forge just… encourages it.",
  "Bones, bark, bloodmoon glass — bring it all. Nothing's wasted at my anvil.",
  "You bring the makings, I bring the fire. Fair trade.",
  "Steel remembers how it was made. Let's give this one a story worth telling.",
  "Back again? Good — the coals are hot, and idle hands make dull blades."
];
let activeTab = 'forge';
function setWorkshopTab(tab) {
  activeTab = tab;
  const forge = document.getElementById('wsTabForge');
  const rec = document.getElementById('wsTabRecipes');
  if (forge) forge.style.background = tab === 'forge' ? '#8a4a1e' : 'transparent';
  if (rec) rec.style.background = tab === 'recipes' ? '#8a4a1e' : 'transparent';
  renderWorkshopModal();
}
function openWorkshopModal() {
  Modals.set('workshopModalOpen', true);
  document.getElementById('workshopModal').classList.remove('hidden');
  document.getElementById('workshopErr').textContent = '';
  const greet = document.getElementById('artificerGreet');
  if (greet) greet.textContent = '⚒️ ' + GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
  setWorkshopTab('forge');
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
  const unlocked = (getRecipesUnlocked && getRecipesUnlocked()) || [];
  const isOwned = (r) => !r.gold || unlocked.indexOf(r.id) !== -1;
  // Forge tab = recipes you can make (free + learned); Recipes tab = the shop,
  // gold-priced recipes you haven't learned yet.
  const shown = recipes.filter(r => activeTab === 'forge' ? isOwned(r) : (r.gold && !isOwned(r)));
  if (!shown.length) {
    list.innerHTML = activeTab === 'forge'
      ? '<div class="slNote">Nothing you can forge yet — learn a recipe on the 📜 Recipes tab.</div>'
      : '<div class="slNote">You\'ve learned every recipe the Artificer has to teach.</div>';
    return;
  }
  let lastCat = null;
  for (const r of shown) {
    if (r.category !== lastCat) {
      lastCat = r.category;
      const head = document.createElement('div');
      head.className = 'achCat';
      head.textContent = r.category;
      list.appendChild(head);
    }
    const out = CAT[r.result] || {};
    const stats = statLine(r.result);
    const row = document.createElement('div');

    if (activeTab === 'recipes') {
      // Shop row — learn the recipe for gold.
      const gold = (getGold && getGold()) || 0;
      const afford = gold >= r.gold;
      row.className = 'craftRow locked';
      row.innerHTML =
        `<div class="craftHead">
           <span class="craftIcon">${out.icon || '🔨'}</span>
           <span class="craftName">${out.name || r.result} <span class="craftLock">🔒 recipe</span></span>
           <button class="craftBtn learn" ${afford ? '' : 'disabled'}>Learn · ${r.gold}<span class="coin"></span></button>
         </div>
         ${stats ? `<div class="craftStats">${stats}</div>` : ''}
         <div class="craftChips">${r.ingredients.map(ing => { const m = CAT[ing.id] || {}; return `<span class="craftChip" data-item="${ing.id}">${m.icon || '?'} ${m.name || ing.id} ×${ing.qty}</span>`; }).join('')}</div>`;
      row.querySelector('.craftBtn').addEventListener('click', () => {
        if (!afford) return;
        document.getElementById('workshopErr').textContent = '';
        send({ type: 'buy_recipe', recipeId: r.id });
      });
      list.appendChild(row);
      continue;
    }

    // Forge row — craft it if you have the ingredients.
    let canCraft = true;
    const chips = r.ingredients.map(ing => {
      const have = countItem(ing.id);
      const ok = have >= ing.qty;
      if (!ok) canCraft = false;
      const meta = CAT[ing.id] || {};
      return `<span class="craftChip ${ok ? 'ok' : 'short'}" data-item="${ing.id}">${meta.icon || '?'} ${meta.name || ing.id} ${have}/${ing.qty}</span>`;
    }).join('');

    row.className = 'craftRow' + (canCraft ? ' ready' : '');
    row.innerHTML =
      `<div class="craftHead">
         <span class="craftIcon">${out.icon || '🔨'}</span>
         <span class="craftName">${out.name || r.result}${r.gold ? ' <span class="craftLock owned">✓ learned</span>' : ''}</span>
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
  wireChipTooltips(list);
}
// Hover (desktop) or tap (touch) an ingredient chip to see what it is and
// where to find it. Delegated per render; tap toggles so it works without a
// cursor. No-op if the tooltip helpers weren't injected.
function wireChipTooltips(list) {
  if (!showItemTooltip || !hideTooltip) return;
  let tapped = null;
  list.querySelectorAll('.craftChip[data-item]').forEach((chip) => {
    const id = chip.dataset.item;
    chip.addEventListener('mouseenter', (e) => showItemTooltip(e, id));
    chip.addEventListener('mouseleave', () => { if (tapped !== chip) hideTooltip(); });
    chip.addEventListener('click', (e) => {
      if (tapped === chip) { hideTooltip(); tapped = null; }
      else { showItemTooltip(e, id); tapped = chip; }
    });
  });
}
(function () {
  const close = document.getElementById('workshopCloseBtn');
  if (close) close.addEventListener('click', closeWorkshopModal);
  const tf = document.getElementById('wsTabForge');
  const tr = document.getElementById('wsTabRecipes');
  if (tf) tf.addEventListener('click', () => setWorkshopTab('forge'));
  if (tr) tr.addEventListener('click', () => setWorkshopTab('recipes'));
})();

  return { openWorkshopModal, closeWorkshopModal, renderWorkshopModal };
}
