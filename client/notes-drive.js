// ---------------------------------------------------------------------------
// Notes + Hard-Drive inventory tab (Tier 3.4 Phase C). The 📝 self-destructing
// notes (send to a recipient, open, destroy) and the 💾 hard-drive tab: stash a
// note for safekeeping, and browse the cursed media stash (howl clips / selfies),
// arming one for the V hotkey. inbox + the capture/request/toast helpers are
// injected; renderInventory is injected (the tab refreshes it, and it calls back
// into these); lastInventoryState/myId/players/ws via getters; the armed-clip id
// (shared with the cursed-media feature) via get/set.
// ---------------------------------------------------------------------------
export default function createNotesDrive({ captureHowlClip, captureSelfiePhoto, inbox, renderInventory, requestCmState, setUnlockToast, getLastInventoryState, getMyId, getPlayers, getWs, getCmSelectedClipId, setCmSelectedClipId, getPendingHdPassword, setPendingHdPassword, getLastHardDriveState }) {
function refreshNoteRecipients() {
  const select = document.getElementById('noteRecipient');
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

const noteSendBtn = document.getElementById('noteSendBtn');
if (noteSendBtn) {
  noteSendBtn.addEventListener('click', () => {
    const select = document.getElementById('noteRecipient');
    const textEl = document.getElementById('noteText');
    const to = select.value;
    const text = textEl.value.trim();
    if (!to || !text) return;
    getWs().send(JSON.stringify({ type: 'send_note', to, text }));
    textEl.value = '';
  });
}

// Opening a note just reveals its contents — it no longer starts a
// destruct timer on its own. The note sticks around (and the sender isn't
// told anything yet) until the recipient explicitly clicks the burn icon
// rendered below, which is destroyNote()'s job.
function openNote(noteId) {
  const note = inbox.find(n => n.id === noteId);
  if (!note || note.read) return;
  note.read = true;
  renderInventory();
}

function destroyNote(noteId) {
  const note = inbox.find(n => n.id === noteId);
  if (!note) return;
  getWs().send(JSON.stringify({ type: 'destroy_note', id: note.id, fromId: note.fromId }));
  const idx = inbox.findIndex(n => n.id === noteId);
  if (idx !== -1) inbox.splice(idx, 1);
  renderInventory();
}

// ---------------------------------------------------------------------------
// Hard Drive — a separate, capped (24-note) vault layered on top of the
// regular inbox. Filing a note here pulls it out of the inbox entirely
// (server splices it from player.inbox), which is what makes it safe from
// Rapid Swipe — that attack only ever reads player.inbox. A password, if
// set, is required by the server for every operation including by the
// owner, and the locked Hard Drive item is hidden from Sleight of Hand's
// peek/steal entirely (see server.js cast_attack pickpocket branch).
// ---------------------------------------------------------------------------

function ownsHardDrive() {
  return !!(getLastInventoryState() && getLastInventoryState().slots.some(s => s && s.itemId === 'hard_drive'));
}

function storeNoteOnHardDrive(noteId) {
  getWs().send(JSON.stringify({ type: 'harddrive_store', noteId, password: getPendingHdPassword() }));
}


function refreshHardDriveTab() {
  document.getElementById('hdErr').textContent = '';
  if (!ownsHardDrive()) {
    document.getElementById('hdNoItem').classList.remove('hidden');
    document.getElementById('hdLocked').classList.add('hidden');
    document.getElementById('hdUnlocked').classList.add('hidden');
    return;
  }
  document.getElementById('hdNoItem').classList.add('hidden');
  getWs().send(JSON.stringify({ type: 'harddrive_open', password: getPendingHdPassword() }));
}

const hdUnlockBtn = document.getElementById('hdUnlockBtn');
if (hdUnlockBtn) hdUnlockBtn.addEventListener('click', () => {
  setPendingHdPassword(document.getElementById('hdPasswordInput').value);
  getWs().send(JSON.stringify({ type: 'harddrive_open', password: getPendingHdPassword() }));
});

const hdSetPasswordBtn = document.getElementById('hdSetPasswordBtn');
if (hdSetPasswordBtn) hdSetPasswordBtn.addEventListener('click', () => {
  const currentPassword = document.getElementById('hdCurrentPasswordInput').value;
  const newPassword = document.getElementById('hdNewPasswordInput').value;
  getWs().send(JSON.stringify({ type: 'harddrive_set_password', currentPassword, newPassword }));
});

function renderHardDriveUnlocked() {
  const cap = document.getElementById('hdCapacityRow');
  cap.textContent = `${getLastHardDriveState().notes.length} / ${getLastHardDriveState().capacity} notes stored` +
    (getLastHardDriveState().hasPassword ? ' — 🔒 password-protected' : ' — no password set');
  renderHardDriveMedia();
  const list = document.getElementById('hdNotesList');
  const empty = document.getElementById('hdEmpty');
  list.innerHTML = '';
  empty.classList.toggle('hidden', getLastHardDriveState().notes.length > 0);
  for (const note of getLastHardDriveState().notes) {
    const div = document.createElement('div');
    div.className = 'noteItem';
    const from = document.createElement('span');
    from.className = 'noteFrom';
    from.textContent = 'From ' + note.fromName;
    div.appendChild(from);
    if (note.text) {
      const body = document.createElement('div');
      body.textContent = note.text;
      div.appendChild(body);
    }
    if (note.image) {
      const img = document.createElement('img');
      img.className = 'noteImage';
      img.src = note.image;
      div.appendChild(img);
    }
    if (note.audio) {
      const player = document.createElement('audio');
      player.controls = true;
      player.src = note.audio;
      player.style.cssText = 'width:100%; height:32px; margin-top:6px;';
      div.appendChild(player);
    }
    const retrieveBtn = document.createElement('button');
    retrieveBtn.className = 'noteReadBtn';
    retrieveBtn.textContent = '📤 Move back to Inbox';
    retrieveBtn.addEventListener('click', () => {
      getWs().send(JSON.stringify({ type: 'harddrive_retrieve', noteId: note.id, password: getPendingHdPassword() }));
    });
    div.appendChild(retrieveBtn);
    const destroyBtn = document.createElement('button');
    destroyBtn.className = 'noteDestroyBtn';
    destroyBtn.textContent = '🔥 Destroy this note';
    destroyBtn.addEventListener('click', () => {
      getWs().send(JSON.stringify({ type: 'harddrive_destroy', noteId: note.id, password: getPendingHdPassword() }));
    });
    div.appendChild(destroyBtn);
    list.appendChild(div);
  }
}

// ── Hard Drive media: 📸 selfies & 🎙️ voice clips ──────────────────────────
// The drive's newest shelves. Selfies come from your own camera (you click,
// your browser asks, one frame is taken — the same consent-first pattern
// as Hazel's shop and the 3rd Eye) or copied off a picture someone sent
// you. Clips are 3-second mic recordings. Both are the ammunition for the
// countermeasure mechanics: V plays a clip to slip an attack (everyone
// nearby HEARS it), and wearing a selfie makes the town see that face.
let myWornDisguise = null; // { name } while the server says we're masked

function renderDriveMediaQuickState(disguise) {
  myWornDisguise = disguise || null;
  // If the drive panel is open, re-render so Wear/Mask-off buttons match.
  if (getLastHardDriveState()) renderHardDriveMedia();
}

function renderHardDriveMedia() {
  const wrap = document.getElementById('hdMediaWrap');
  if (!wrap || !getLastHardDriveState()) return;
  const st = getLastHardDriveState();
  wrap.innerHTML = '';

  // ── Selfies ──
  const selfieHead = document.createElement('div');
  selfieHead.className = 'hdMediaHead';
  selfieHead.textContent = `📸 Selfies — ${ (st.selfies || []).length } / ${st.selfieCapacity}`;
  wrap.appendChild(selfieHead);

  const selfieRow = document.createElement('div');
  selfieRow.className = 'hdMediaRow';
  for (const s of st.selfies || []) {
    const cell = document.createElement('div');
    cell.className = 'hdSelfieCell';
    const img = document.createElement('img');
    img.src = s.image;
    img.title = `A picture of ${s.of}`;
    cell.appendChild(img);
    const label = document.createElement('div');
    label.className = 'hdMediaLabel';
    label.textContent = s.of;
    cell.appendChild(label);
    const wearing = myWornDisguise && myWornDisguise.name === s.of;
    const wearBtn = document.createElement('button');
    wearBtn.className = 'noteReadBtn';
    wearBtn.textContent = wearing ? '🎭 Mask off' : '🎭 Wear as disguise';
    wearBtn.addEventListener('click', () => {
      getWs().send(JSON.stringify({ type: 'cm_disguise', selfieId: wearing ? null : s.id }));
      setTimeout(requestCmState, 300);
    });
    cell.appendChild(wearBtn);
    const delBtn = document.createElement('button');
    delBtn.className = 'noteDestroyBtn';
    delBtn.textContent = '🗑️';
    delBtn.title = 'Delete this selfie';
    delBtn.addEventListener('click', () => {
      getWs().send(JSON.stringify({ type: 'harddrive_delete_media', kind: 'selfie', mediaId: s.id, password: getPendingHdPassword() }));
    });
    cell.appendChild(delBtn);
    selfieRow.appendChild(cell);
  }
  if (!(st.selfies || []).length) {
    const none = document.createElement('div');
    none.className = 'hdMediaEmpty';
    none.textContent = 'No selfies yet — take one, or save a face off a picture someone sends you.';
    selfieRow.appendChild(none);
  }
  wrap.appendChild(selfieRow);

  const takeBtn = document.createElement('button');
  takeBtn.className = 'btn';
  takeBtn.textContent = '📸 Take a selfie (your camera, one frame)';
  takeBtn.addEventListener('click', async () => {
    takeBtn.disabled = true;
    takeBtn.textContent = '📸 Say cheese…';
    try {
      const image = await captureSelfiePhoto();
      if (image) getWs().send(JSON.stringify({ type: 'harddrive_save_selfie', image, password: getPendingHdPassword() }));
      else setUnlockToast('📸 No camera available (or permission denied).');
    } catch (e) {
      setUnlockToast('📸 No camera available (or permission denied).');
    }
    takeBtn.disabled = false;
    takeBtn.textContent = '📸 Take a selfie (your camera, one frame)';
  });
  wrap.appendChild(takeBtn);

  // ── Voice clips ──
  const clipHead = document.createElement('div');
  clipHead.className = 'hdMediaHead';
  clipHead.textContent = `🎙️ Voice clips — ${ (st.clips || []).length } / ${st.clipCapacity}`;
  wrap.appendChild(clipHead);

  for (const c of st.clips || []) {
    const row = document.createElement('div');
    row.className = 'hdClipRow';
    const name = document.createElement('span');
    name.className = 'hdMediaLabel';
    name.textContent = (getCmSelectedClipId() === c.id ? '✔ ' : '') + c.label;
    row.appendChild(name);
    const useBtn = document.createElement('button');
    useBtn.className = 'noteReadBtn';
    useBtn.textContent = getCmSelectedClipId() === c.id ? '✔ Armed for V' : 'Arm for V';
    useBtn.title = 'This is the clip the V key plays when you get attacked';
    useBtn.addEventListener('click', () => { setCmSelectedClipId(c.id); renderHardDriveMedia(); });
    row.appendChild(useBtn);
    const delBtn = document.createElement('button');
    delBtn.className = 'noteDestroyBtn';
    delBtn.textContent = '🗑️';
    delBtn.addEventListener('click', () => {
      getWs().send(JSON.stringify({ type: 'harddrive_delete_media', kind: 'clip', mediaId: c.id, password: getPendingHdPassword() }));
    });
    row.appendChild(delBtn);
    wrap.appendChild(row);
  }
  if (!(st.clips || []).length) {
    const none = document.createElement('div');
    none.className = 'hdMediaEmpty';
    none.textContent = 'No clips yet — record one. Played mid-fight (V), it startles everything in earshot.';
    wrap.appendChild(none);
  }

  const recBtn = document.createElement('button');
  recBtn.className = 'btn';
  recBtn.textContent = '🎙️ Record a 3s voice clip';
  recBtn.addEventListener('click', async () => {
    const label = (document.getElementById('hdClipLabelInput') || { value: '' }).value.trim() || 'Voice clip';
    recBtn.disabled = true;
    recBtn.textContent = '🎙️ Recording… (3s)';
    try {
      const audio = await captureHowlClip(3000);
      if (audio) getWs().send(JSON.stringify({ type: 'harddrive_save_clip', audio, label, password: getPendingHdPassword() }));
    } catch (e) {
      setUnlockToast('🎙️ No microphone available (or permission denied).');
    }
    recBtn.disabled = false;
    recBtn.textContent = '🎙️ Record a 3s voice clip';
  });
  const labelInput = document.createElement('input');
  labelInput.id = 'hdClipLabelInput';
  labelInput.placeholder = 'Clip name (e.g. "BOO!", "my evil laugh")';
  labelInput.maxLength = 40;
  labelInput.className = 'hdClipLabelInput';
  wrap.appendChild(labelInput);
  wrap.appendChild(recBtn);
}

  return { refreshNoteRecipients, openNote, destroyNote, storeNoteOnHardDrive, refreshHardDriveTab, renderHardDriveUnlocked, renderDriveMediaQuickState };
}
