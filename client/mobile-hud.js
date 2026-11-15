// ---------------------------------------------------------------------------
// Mobile HUD + chat (Tier 3.4 Phase C). The touch build's on-screen controls —
// initMobileHud wires the joystick rest spot, the action wheel, the top bar and
// the menu sheet; refreshMobileHud keeps the top bar current; toggleMobileChat
// opens/closes the phone chat; spawnChatNotif + systemChatNotif banner incoming
// messages (phones have no scrollback). MOBILE_UI/Modals + the wheel/quickslot/
// joystick/lightbox helpers are injected; the live state it reads via getters.
// ---------------------------------------------------------------------------
import { uiIcon } from './ui-icons.js';

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
  // …unless it was left kept open: then it comes back as the small window you can walk about with.
  const on = (id, fn) => { const b = document.getElementById(id); if (b) b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); fn(); }); };
  on('chatPinBtn', () => setChatPinned(true));
  on('chatUnpinBtn', () => setChatPinned(false));
  on('chatWriteBtn', () => toggleMobileChat(true));
  if (chatPinnedPref()) showPinned(true);
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
  setTextIfChanged('mvHeartVal', `${Math.round(getMe().health ?? 100)}`);
  setTextIfChanged('mvLevel', `Lv ${getMe().level || 1}`);
  const night = document.getElementById('dayNightTag');
  const isNight = !!(night && night.classList.contains('nightTag'));
  if (_mv.mvClock !== (isNight ? 'n' : 'd')) {
    _mv.mvClock = isNight ? 'n' : 'd';
    const c = document.getElementById('mvClock');
    if (c) c.innerHTML = uiIcon(isNight ? 'moon' : 'sun') || '';
  }
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
  if (kitRow && getMe()) {
    const mage = getMe().charId === 0;
    kitRow.innerHTML = '<span class="menuGi">' + (uiIcon(mage ? 'kit' : 'attack') || '') + '</span>' + (mage ? 'Spellbook' : 'Attacks');
  }
}

// ── Chat kept open while you move ───────────────────────────────────────────
// The 💬 sheet is for writing: it takes the bottom of the screen and the controls step aside for it. "Keep open"
// leaves a small see-through window of the last few lines up instead, clear of the joystick and the buttons, and
// touches go through it to the game. ✏️ (or 💬) brings the sheet back to write; closing the sheet returns to the
// window; ✕ on the window puts chat away. The choice is remembered.
const PIN_KEY = 'tc_chat_pinned';
function chatPinnedPref() { try { return localStorage.getItem(PIN_KEY) === '1'; } catch (e) { return false; } }
function showPinned(on) {
  const cp = document.getElementById('chatPanel');
  if (!cp) return;
  cp.classList.toggle('pinned', on);
  document.body.classList.toggle('chatPinned', on);
  if (on) {
    cp.classList.remove('mobileClosed');
    // what was said is in the window now: the banners that said it step down
    const stack = document.getElementById('chatNotifStack');
    if (stack) for (const b of [...stack.children]) if (!b.classList.contains('system') && !b.querySelector('img')) b.remove();
  } else if (!Modals.isOpen('mobileChatOpen')) cp.classList.add('mobileClosed');
  watchPinnedBottom(cp, on);
}
// Where the kept-open window ends, for what is docked below it (the finds line: index.html reads --pinnedChatBottom).
let _pinWatch = null;
function watchPinnedBottom(cp, on) {
  const st = document.body && document.body.style;
  if (!st || typeof st.setProperty !== 'function' || typeof cp.getBoundingClientRect !== 'function') return;
  const note = () => { if (!cp.classList.contains('pinned')) return; const b = cp.getBoundingClientRect().bottom; if (b > 0) st.setProperty('--pinnedChatBottom', Math.round(b) + 'px'); };
  if (_pinWatch) { _pinWatch.disconnect(); _pinWatch = null; }
  if (!on) { st.removeProperty('--pinnedChatBottom'); return; }
  note();
  if (typeof ResizeObserver === 'function') { _pinWatch = new ResizeObserver(note); _pinWatch.observe(cp); }
  if (!watchPinnedBottom.bound) { watchPinnedBottom.bound = true; window.addEventListener('resize', note); window.addEventListener('orientationchange', () => setTimeout(note, 250)); }
}
function setChatPinned(on) {
  try { localStorage.setItem(PIN_KEY, on ? '1' : '0'); } catch (e) { /* private window: it lasts the visit */ }
  _pinnedNow = on;
  if (Modals.isOpen('mobileChatOpen')) toggleMobileChat(false);   // the sheet steps down; the window (or nothing) is left
  else showPinned(on);
}
let _pinnedNow = null;   // the choice this visit, where storage will not keep it
const wantsPinned = () => (_pinnedNow === null ? chatPinnedPref() : _pinnedNow);

function toggleMobileChat(open) {
  const cp = document.getElementById('chatPanel');
  if (!cp) return;
  Modals.set('mobileChatOpen', open === undefined ? !Modals.isOpen('mobileChatOpen') : open);
  const writing = Modals.isOpen('mobileChatOpen');
  if (writing) showPinned(false);                       // the sheet is the whole chat while you write
  cp.classList.toggle('mobileClosed', !writing);
  if (!writing && wantsPinned()) showPinned(true);      // and hands back to the window when you are done
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
  // with the chat window kept open the line is already on screen in it: a banner as well would say it twice
  if (document.body.classList.contains('chatPinned') && n.kind !== 'system' && !n.image) return;
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
