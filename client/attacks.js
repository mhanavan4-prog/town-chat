// ---------------------------------------------------------------------------
// Attacks UI (Tier 3.4 Phase C) — the Werewolf/Wanderer/Knight analog of the
// Spellbook, generic across any charId with an ATTACK_CATALOGS entry. DI
// factory; owns open-state via the Modals registry (no guard rewiring).
// myAttackCatalog stays in main (shared) and is injected via getAttackCatalog.
// ---------------------------------------------------------------------------
import { Modals } from './modals.js';

export default function createAttacks({ send, getMe, getWorld, getAttackCatalog, MOBILE_UI, setDefaultFloatPos, cancelTargeting, armTargeting, buildEmojiCursor, SWORD_CURSOR, actionOnCooldown, startActionCooldown }) {
let selectedAttackId = null;

const ATTACK_PANEL_TITLES = { 1: '🐺 Wolf Attacks', 2: '🕯️ Mystic Rites', 3: '⚔️ Knightly Arts', 4: '🥾 Wanderer Skills' };

function openAttackPanel() {
  cancelTargeting();
  const modal = document.getElementById('attackModal');
  if (!modal || !getAttackCatalog()) return;
  document.getElementById('attackErr').textContent = '';
  selectedAttackId = null;
  document.getElementById('attackTargetPanel').classList.add('hidden');
  const title = document.getElementById('attackModalTitle');
  if (title) title.textContent = (getMe() && ATTACK_PANEL_TITLES[getMe().charId]) || '⚔️ Attacks';
  const howTo = document.getElementById('attackHowTo');
  if (howTo) {
    howTo.textContent = MOBILE_UI
      ? 'Targeted ones close this — then tap who to hit. AoE hits everyone nearby.'
      : 'Targeted ones close this — then click who to hit. AoE hits everyone nearby.';
  }
  renderAttackList();
  modal.classList.remove('hidden');
  setDefaultFloatPos(modal, 370, 112);
  Modals.set('attackPanelOpen', true);
}

function closeAttackPanel() {
  const modal = document.getElementById('attackModal');
  if (modal) modal.classList.add('hidden');
  Modals.set('attackPanelOpen', false);
}

const attackBtn = document.getElementById('attackBtn');
if (attackBtn) attackBtn.addEventListener('click', () => { if (Modals.isOpen('attackPanelOpen')) closeAttackPanel(); else openAttackPanel(); });
const attackCloseBtn = document.getElementById('attackCloseBtn');
if (attackCloseBtn) attackCloseBtn.addEventListener('click', closeAttackPanel);

function renderAttackList() {
  const list = document.getElementById('attackList');
  if (!list || !getAttackCatalog()) return;
  list.innerHTML = '';
  for (const id in getAttackCatalog()) {
    const atk = getAttackCatalog()[id];
    const row = document.createElement('div');
    row.className = 'attackRow' + (selectedAttackId === id ? ' selected' : '');
    const name = document.createElement('div');
    name.className = 'attackName';
    name.textContent = atk.icon + ' ' + atk.name + (atk.kind === 'aoe' ? ' (AoE)' : atk.kind === 'self' ? ' (self)' : atk.kind === 'building' ? ' (pick building)' : '');
    const desc = document.createElement('div');
    desc.className = 'attackDesc';
    desc.textContent = atk.description;
    row.appendChild(name);
    row.appendChild(desc);
    row.addEventListener('click', () => selectAttack(id));
    list.appendChild(row);
  }
}

// Targeted/reveal attacks skip the panel entirely now — picking one closes
// the Attacks panel and arms targeting (see armTargeting() above) so the
// next click in the world picks the target, instead of the old dropdown.
// 'building' still uses the dropdown (Spy Glass targets a building, not an
// entity you can click on); 'self'/'aoe' just need the bare Cast button.
function selectAttack(id) {
  selectedAttackId = id;
  renderAttackList();
  const atk = getAttackCatalog()[id];
  document.getElementById('attackErr').textContent = '';
  if (atk.kind === 'targeted' || atk.kind === 'reveal') {
    closeAttackPanel();
    // Damage/leech attacks reach animals and mobs too, exactly like the
    // Witch's Fireball/Leech Hex (see selectSpell above).
    const isDamage = atk.effect === 'damage' || atk.effect === 'leech';
    armTargeting('cast_attack', 'attackId', id, atk.name, isDamage, isDamage ? buildEmojiCursor(atk.icon) : SWORD_CURSOR);
    return;
  }
  const select = document.getElementById('attackTargetSelect');
  const label = document.getElementById('attackTargetLabel');
  if (atk.kind === 'building') {
    label.textContent = 'Building';
    select.classList.remove('hidden');
    label.classList.remove('hidden');
    refreshAttackBuildings();
  } else {
    select.classList.add('hidden');
    label.classList.add('hidden');
  }
  document.getElementById('attackTargetPanel').classList.remove('hidden');
}

function refreshAttackBuildings() {
  const select = document.getElementById('attackTargetSelect');
  if (!select || !getWorld()) return;
  select.disabled = false;
  select.innerHTML = '';
  for (const b of getWorld().buildings) {
    const opt = document.createElement('option');
    opt.value = b.id; opt.textContent = b.name;
    select.appendChild(opt);
  }
}

const attackCastBtn = document.getElementById('attackCastBtn');
if (attackCastBtn) attackCastBtn.addEventListener('click', () => {
  if (!selectedAttackId || !getAttackCatalog()) return;
  const atk = getAttackCatalog()[selectedAttackId];
  const err = document.getElementById('attackErr');
  if (actionOnCooldown(selectedAttackId)) { err.textContent = 'Still recovering — wait a moment.'; return; }
  const payload = { type: 'cast_attack', attackId: selectedAttackId };
  if (atk.kind === 'building') {
    const buildingId = document.getElementById('attackTargetSelect').value;
    if (!buildingId) { err.textContent = 'Pick a building first.'; return; }
    payload.buildingId = buildingId;
  }
  err.textContent = '';
  send(JSON.stringify(payload));
  startActionCooldown(selectedAttackId);
  closeAttackPanel();
});

  return { openAttackPanel, closeAttackPanel };
}
