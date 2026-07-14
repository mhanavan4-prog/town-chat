// ---------------------------------------------------------------------------
// Spellbook UI — Witch-only (Tier 3.4 Phase C). Extracted as a DI factory.
// Owns open-state via the Modals registry; input guards already read
// Modals.isOpen('spellbookOpen'), so nothing outside needed rewiring.
// ---------------------------------------------------------------------------
import { Modals } from './modals.js';

export default function createSpellbook({ send, cancelTargeting, setDefaultFloatPos, SPELL_CATALOG, armTargeting, buildEmojiCursor, SWORD_CURSOR, actionOnCooldown, startActionCooldown, visuals }) {
let selectedSpellId = null;

function openSpellbook() {
  cancelTargeting();
  const modal = document.getElementById('spellbookModal');
  if (!modal) return;
  document.getElementById('spellbookErr').textContent = '';
  selectedSpellId = null;
  document.getElementById('spellTargetPanel').classList.add('hidden');
  renderSpellList();
  modal.classList.remove('hidden');
  setDefaultFloatPos(modal, 370, 112);
  Modals.set('spellbookOpen', true);
}

function closeSpellbook() {
  const modal = document.getElementById('spellbookModal');
  if (modal) modal.classList.add('hidden');
  Modals.set('spellbookOpen', false);
}

const spellbookBtn = document.getElementById('spellbookBtn');
if (spellbookBtn) spellbookBtn.addEventListener('click', () => { if (Modals.isOpen('spellbookOpen')) closeSpellbook(); else openSpellbook(); });
const spellbookCloseBtn = document.getElementById('spellbookCloseBtn');
if (spellbookCloseBtn) spellbookCloseBtn.addEventListener('click', closeSpellbook);

function renderSpellList() {
  const list = document.getElementById('spellList');
  if (!list) return;
  list.innerHTML = '';
  for (const id in SPELL_CATALOG) {
    const spell = SPELL_CATALOG[id];
    const row = document.createElement('div');
    row.className = 'spellRow' + (selectedSpellId === id ? ' selected' : '');
    const name = document.createElement('div');
    name.className = 'spellName';
    name.textContent = spell.icon + ' ' + spell.name;
    const desc = document.createElement('div');
    desc.className = 'spellDesc';
    desc.textContent = spell.description;
    row.appendChild(name);
    row.appendChild(desc);
    row.addEventListener('click', () => selectSpell(id));
    list.appendChild(row);
  }
}

// Targeted spells skip the panel entirely now — picking one closes the
// Spellbook and arms targeting (see armTargeting() above), so the only
// kind that still shows this panel is 'self', which just needs the Cast
// button with no target picker at all.
function selectSpell(id) {
  selectedSpellId = id;
  renderSpellList();
  const spell = SPELL_CATALOG[id];
  document.getElementById('spellbookErr').textContent = '';
  if (spell.kind === 'targeted') {
    closeSpellbook();
    const isDamage = spell.effect === 'damage' || spell.effect === 'leech';
    armTargeting('cast_spell', 'spellId', id, spell.name, isDamage, isDamage ? buildEmojiCursor(spell.icon) : SWORD_CURSOR);
    return;
  }
  if (spell.kind === 'ground') {
    closeSpellbook();
    armTargeting('cast_spell', 'spellId', id, spell.name, false, buildEmojiCursor(spell.icon), true);
    return;
  }
  document.getElementById('spellTargetPanel').classList.remove('hidden');
}

const spellCastBtn = document.getElementById('spellCastBtn');
if (spellCastBtn) spellCastBtn.addEventListener('click', () => {
  if (!selectedSpellId) return;
  if (actionOnCooldown(selectedSpellId)) { document.getElementById('spellbookErr').textContent = 'Your magic needs to recharge a moment.'; return; }
  document.getElementById('spellbookErr').textContent = '';
  send(JSON.stringify({ type: 'cast_spell', spellId: selectedSpellId }));
  startActionCooldown(selectedSpellId);
});

// A brief highlight on the target's existing name tag — Glimpse the
// Future's whole effect, since every player's position is already shared
// with everyone continuously (see the periodic 'state' broadcast); there's
// no new data to reveal, just a moment of "look, there" for the caster.
function showGlimpseBeacon(targetId) {
  const v = visuals[targetId];
  if (!v || !v.nameEl) return;
  v.nameEl.classList.add('glimpseHighlight');
  setTimeout(() => { if (v.nameEl) v.nameEl.classList.remove('glimpseHighlight'); }, 10000);
}

  return { openSpellbook, closeSpellbook, showGlimpseBeacon };
}
