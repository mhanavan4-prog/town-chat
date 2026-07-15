// ---------------------------------------------------------------------------
// Loadout modal (Tier 3.4 Phase C). Assign abilities to the emote-wheel slots and
// the hotbar: open/close the modal, peek an ability's info, place one into the
// selected slot, and render the wheel + hotbar grid. Ability helpers + MOBILE_UI
// are injected; the action catalog and the hotbar key tables (declared later) via
// getters; the selected-slot index is shared with main via get/set.
// ---------------------------------------------------------------------------
export default function createLoadout({ MOBILE_UI, attachAbilityPeek, haptic, orderedAbilityIds, saveLoadout, setUnlockToast, getMyActionCatalog, getHotbarKeys, getHotbarKeyLabels, getLoadoutSelectedSlot, setLoadoutSelectedSlot }) {
function openLoadoutModal() {
  if (!getMyActionCatalog()) { setUnlockToast('Join with a class kit first.'); return; }
  setLoadoutSelectedSlot(null);
  renderLoadoutModal();
  document.getElementById('loadoutModal').classList.remove('hidden');
}
function closeLoadoutModal() {
  document.getElementById('loadoutModal').classList.add('hidden');
}

function loadoutPeekInfo(id) {
  const a = getMyActionCatalog() && getMyActionCatalog()[id];
  return a ? { id, icon: a.icon, name: a.name, kind: a.kind, description: a.description } : null;
}
// Shared place-an-ability step: tap a slot, then tap the ability (they swap).
function loadoutPlaceAbility(id, ids) {
  const ab = getMyActionCatalog()[id];
  if (getLoadoutSelectedSlot() === null) {
    setUnlockToast(MOBILE_UI
      ? `${ab.icon} ${ab.name || id} — first tap the wheel slot you want it in.`
      : `${ab.icon} ${ab.name || id} — pick a slot first, then click this.`);
    return;
  }
  const next = ids.slice();
  const from = next.indexOf(id);
  const to = getLoadoutSelectedSlot();
  if (from === -1 || from === to) { setLoadoutSelectedSlot(null); renderLoadoutModal(); return; }
  [next[to], next[from]] = [next[from], next[to]]; // swap — always a clean permutation
  saveLoadout(next);
  setLoadoutSelectedSlot(null);
  renderLoadoutModal();
  haptic(12);
}
function renderLoadoutModal() {
  const ids = orderedAbilityIds();
  const slotsEl = document.getElementById('loadoutSlots');
  const absEl = document.getElementById('loadoutAbilities');
  const wheelEl = document.getElementById('loadoutWheelRow');
  const restLabel = document.getElementById('loadoutRestLabel');
  if (!slotsEl || !absEl) return;
  slotsEl.innerHTML = '';
  absEl.innerHTML = '';
  if (wheelEl) wheelEl.innerHTML = '';
  const slotCount = Math.min(ids.length, getHotbarKeys().length);

  // ── Phones: the three WHEEL slots are the headline — big, labeled, named.
  if (MOBILE_UI && wheelEl) {
    for (let i = 0; i < Math.min(3, slotCount); i++) {
      const id = ids[i];
      const ab = getMyActionCatalog()[id];
      const cell = document.createElement('div');
      cell.className = 'loBig' + (getLoadoutSelectedSlot() === i ? ' selected' : '');
      const tag = document.createElement('div');
      tag.className = 'loBigTag';
      tag.textContent = `Wheel ${i + 1}`;
      const icon = document.createElement('div');
      icon.className = 'loBigIcon';
      icon.textContent = ab ? ab.icon : '·';
      const nm = document.createElement('div');
      nm.className = 'loBigName';
      nm.textContent = ab ? (ab.name || id) : '—';
      cell.appendChild(tag); cell.appendChild(icon); cell.appendChild(nm);
      cell.addEventListener('click', () => {
        setLoadoutSelectedSlot(getLoadoutSelectedSlot() === i ? null : i);
        renderLoadoutModal();
      });
      attachAbilityPeek(cell, () => loadoutPeekInfo(ids[i]));
      wheelEl.appendChild(cell);
    }
  }

  // Remaining slots: desktop draws all 12 keyed tiles; phones draw 4+ as a
  // small "panel order" row under its own label.
  const firstTile = MOBILE_UI ? 3 : 0;
  if (restLabel) restLabel.classList.toggle('hidden', !MOBILE_UI || slotCount <= 3);
  for (let i = firstTile; i < slotCount; i++) {
    const id = ids[i];
    const ab = getMyActionCatalog()[id];
    const cell = document.createElement('div');
    cell.className = 'loSlot' + (getLoadoutSelectedSlot() === i ? ' selected' : '');
    cell.textContent = ab ? ab.icon : '·';
    const key = document.createElement('span');
    key.className = 'loKey';
    key.textContent = MOBILE_UI ? String(i + 1) : getHotbarKeyLabels()[i];
    cell.appendChild(key);
    cell.title = ab ? (ab.name || id) : '';
    cell.addEventListener('click', () => {
      setLoadoutSelectedSlot(getLoadoutSelectedSlot() === i ? null : i);
      renderLoadoutModal();
    });
    attachAbilityPeek(cell, () => loadoutPeekInfo(ids[i]));
    slotsEl.appendChild(cell);
  }

  const hint = document.getElementById('loadoutHint');
  if (hint) {
    if (getLoadoutSelectedSlot() === null) {
      hint.textContent = MOBILE_UI
        ? 'The wheel slots are your in-game buttons. Tap one, then tap the ability you want on it. Hold anything to read what it does.'
        : 'Click a slot (the key it answers to is in the corner), then click an ability.';
    } else if (MOBILE_UI && getLoadoutSelectedSlot() < 3) {
      hint.textContent = `Wheel slot ${getLoadoutSelectedSlot() + 1} — now tap the ability to put there.`;
    } else {
      hint.textContent = `Slot ${getLoadoutSelectedSlot() + 1} selected — now pick the ability for it.`;
    }
  }

  // ── The kit itself. Phones get rows with names (a grid of bare emoji is
  // a guessing game); desktop keeps its compact icon grid with hover titles.
  for (const id of Object.keys(getMyActionCatalog())) {
    const ab = getMyActionCatalog()[id];
    const idx = ids.indexOf(id);
    const onWheel = idx > -1 && idx < 3;
    let cell;
    if (MOBILE_UI) {
      cell = document.createElement('div');
      cell.className = 'loAbRow' + (onWheel ? ' inSlots' : '');
      const icon = document.createElement('span');
      icon.className = 'loAbIcon';
      icon.textContent = ab.icon;
      const nm = document.createElement('span');
      nm.className = 'loAbName';
      nm.textContent = ab.name || id;
      cell.appendChild(icon); cell.appendChild(nm);
      if (onWheel) {
        const where = document.createElement('span');
        where.className = 'loAbWhere';
        where.textContent = `Wheel ${idx + 1}`;
        cell.appendChild(where);
      }
    } else {
      cell = document.createElement('div');
      cell.className = 'loAb' + (onWheel && MOBILE_UI ? ' inSlots' : '');
      cell.textContent = ab.icon;
      cell.title = ab.name || id;
    }
    cell.addEventListener('click', () => loadoutPlaceAbility(id, ids));
    attachAbilityPeek(cell, () => loadoutPeekInfo(id));
    absEl.appendChild(cell);
  }
}

  return { openLoadoutModal, closeLoadoutModal, renderLoadoutModal };
}
