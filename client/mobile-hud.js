// ---------------------------------------------------------------------------
// Mobile HUD + chat (Tier 3.4 Phase C). The touch build's on-screen controls —
// initMobileHud wires the joystick rest spot, the action wheel, the top bar and
// the menu sheet; refreshMobileHud keeps the top bar current; toggleMobileChat
// opens/closes the phone chat; spawnChatNotif + systemChatNotif banner incoming
// messages (phones have no scrollback). MOBILE_UI/Modals + the wheel/quickslot/
// joystick/lightbox helpers are injected; the live state it reads via getters.
// ---------------------------------------------------------------------------
export default function createMobileHud({ MOBILE_UI, Modals, buildEmoteWheel, buildMobileQuickSlots, hasTownPass, openImageLightbox, restJoystick, getCmClips, getCmHasDrive, getLastAttackedClientAt, getLastToastText, getMe, getMode, getPaymentsEnabled, passTimeLeftLabel, passPriceLabel, getPlayers, getLastToastAt }) {
  let mobileHudInited = false;

function initMobileHud() {
  if (mobileHudInited || !MOBILE_UI) return;
  mobileHudInited = true;
  restJoystick();
  document.getElementById('actionCluster').classList.remove('hidden');
  document.getElementById('mobileTopBar').classList.remove('hidden');
  const cp = document.getElementById('chatPanel');
  if (cp) cp.classList.add('mobileClosed'); // chat starts as a 💬 toggle
  buildEmoteWheel();
  buildMobileQuickSlots();
  refreshMobileHud();
  setInterval(refreshMobileHud, 700);
}

// Everything periodic and cheap in one place: vitals text, contextual
// buttons, menu-sheet metadata. Values are only written when they change,
// so this never causes layout churn.
const _mv = {}; // last-written values
function setTextIfChanged(id, text) {
  if (_mv[id] === text) return;
  _mv[id] = text;
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
function refreshMobileHud() {
  if (!MOBILE_UI || !getMe()) return;
  setTextIfChanged('mvHeart', `❤️${Math.round(getMe().health ?? 100)}`);
  setTextIfChanged('mvLevel', `Lv ${getMe().level || 1}`);
  const night = document.getElementById('dayNightTag');
  setTextIfChanged('mvClock', night && night.classList.contains('nightTag') ? '🌕' : '☀️');
  // 📢 shows only once there's actually a clip to fire; pulses while the
  // countermeasure window is open.
  const cmBtn = document.getElementById('btnCm');
  if (cmBtn) {
    cmBtn.classList.toggle('hidden', !(getCmHasDrive() && getCmClips().length));
    cmBtn.classList.toggle('armed', Date.now() - getLastAttackedClientAt() < 6000);
  }
  // 💬 exists only where chat exists (indoors). No unread badge anymore —
  // messages present themselves as banners, so there's nothing to "catch
  // up on"; the button is purely "compose".
  const chatBtn = document.getElementById('chatToggleBtn');
  const cp = document.getElementById('chatPanel');
  if (chatBtn && cp) {
    chatBtn.classList.toggle('hidden', cp.classList.contains('hidden'));
    const badge = document.getElementById('chatUnread');
    if (badge) badge.classList.add('hidden');
  }
  // Menu-sheet metadata + contextual rows
  setTextIfChanged('menuPeople', `${Object.keys(getPlayers()).length} in town`);
  const dn = document.getElementById('dayNightTag');
  setTextIfChanged('menuDayNight', dn ? dn.textContent : '☀️ Day');
  setTextIfChanged('menuPassState', hasTownPass() ? `🎟️ Pass: ${passTimeLeftLabel()} left` : (getPaymentsEnabled() ? `🎟️ Pass: ${passPriceLabel()}/day` : ''));
  const leaveRow = document.getElementById('menuLeave');
  if (leaveRow) leaveRow.classList.toggle('hidden', getMode() !== 'indoor');
  const kitRow = document.getElementById('menuKit');
  if (kitRow && getMe()) kitRow.textContent = getMe().charId === 0 ? '📖 Spellbook' : '⚔️ Attacks';
}

function toggleMobileChat(open) {
  const cp = document.getElementById('chatPanel');
  if (!cp) return;
  Modals.set('mobileChatOpen', open === undefined ? !Modals.isOpen('mobileChatOpen') : open);
  cp.classList.toggle('mobileClosed', !Modals.isOpen('mobileChatOpen'));
  if (Modals.isOpen('mobileChatOpen')) {
    refreshMobileHud();
    // The 💬 button means "I want to say something" now — the panel is
    // just a compose bar (messages arrive as banners), so go straight to
    // the keyboard.
    const inp = document.getElementById('chatInput');
    if (inp) setTimeout(() => inp.focus(), 60);
  }
}

// ── Incoming-message banners (the mobile chat display) ─────────────────────
// Phones have no chat log: each message in your room pops in under the top
// bar like a text-message notification, lives ~9 s, then fades out on its
// own so the screen stays tidy. At most 4 ride the stack; older ones are
// pushed out early. Tapping a picture banner opens the full image.
const CHAT_NOTIF_LIFE_MS = 9000;
const CHAT_NOTIF_MAX = 4;
function spawnChatNotif(n) {
  const stack = document.getElementById('chatNotifStack');
  if (!stack) return;
  const el = document.createElement('div');
  el.className = 'chatNotif' + (n.kind ? ' ' + n.kind : '');
  const body = document.createElement('div');
  body.className = 'cnBody';
  const nameEl = document.createElement('div');
  nameEl.className = 'cnName';
  nameEl.style.color = n.color || '#ffe9c2';
  nameEl.textContent = n.self ? 'You' : (n.name || '');
  const textEl = document.createElement('div');
  textEl.className = 'cnText';
  textEl.textContent = n.text || (n.image ? '📷 sent a picture' : '');
  if (nameEl.textContent) body.appendChild(nameEl);
  body.appendChild(textEl);
  el.appendChild(body);
  if (n.image) {
    const img = document.createElement('img');
    img.src = n.image;
    img.alt = 'shared picture';
    el.addEventListener('click', () => openImageLightbox(n.image));
    el.appendChild(img);
  }
  stack.appendChild(el);
  while (stack.children.length > CHAT_NOTIF_MAX) stack.firstChild.remove();
  const fade = () => { el.classList.add('fading'); setTimeout(() => el.remove(), 750); };
  setTimeout(fade, CHAT_NOTIF_LIFE_MS);
}

// System/story beats used to rely on the chat log as their paper trail —
// with no log on phones, any line that didn't already just toast the same
// words gets a banner instead, so a missed toast still isn't lost info.
function systemChatNotif(text) {
  if (!MOBILE_UI) return;
  if (text === getLastToastText() && Date.now() - getLastToastAt() < 3000) return; // the toast already said it
  spawnChatNotif({ name: '', text, kind: 'system' });
}

  return { initMobileHud, refreshMobileHud, toggleMobileChat, spawnChatNotif, systemChatNotif };
}
