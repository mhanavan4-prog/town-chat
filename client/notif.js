// ---------------------------------------------------------------------------
// Push-notification settings (Tier 3.4 Phase C) — prefs + subscribe/unsubscribe
// via the Web Push API. DI factory; open-state via the Modals registry.
// pushPublicKey/pushAvailable are shared init state, injected via getters.
// ---------------------------------------------------------------------------
import { Modals } from './modals.js';

export default function createNotif({ getPushPublicKey, getPushAvailable, accountAuth, apiUrlMaybe, setUnlockToast }) {
const NOTIF_PREFS_KEY = 'tc_notif_prefs';
function notifPrefs() {
  try { return JSON.parse(localStorage.getItem(NOTIF_PREFS_KEY)) || { moonrise: false, bloodmoon: true, peddler: true, events: true }; }
  catch (e) { return { moonrise: false, bloodmoon: true, peddler: true, events: true }; }
}
function saveNotifPrefs(p) { try { localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(p)); } catch (e) {} }
function pushSupportedHere() {
  return getPushAvailable() && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}
function openNotifModal() {
  Modals.set('notifModalOpen', true);
  const modal = document.getElementById('notifModal');
  const err = document.getElementById('notifErr');
  err.textContent = '';
  const prefs = notifPrefs();
  document.querySelectorAll('#notifRows .notifToggle').forEach(t => {
    const on = !!prefs[t.dataset.pref];
    t.classList.toggle('on', on);
    t.textContent = on ? 'ON' : 'OFF';
  });
  const sub = document.getElementById('notifSub');
  if (!pushSupportedHere()) {
    sub.textContent = window.TOWNCHAT_PLATFORM
      ? 'The app-store builds will grow native notifications later — for now the ravens fly to browsers.'
      : 'This browser (or this server) can\'t carry ravens. On the web build over HTTPS, they fly.';
  } else if (!(accountAuth() && accountAuth().token)) {
    sub.textContent = 'Ravens follow your ACCOUNT — log in first, then enable them here.';
  } else {
    sub.textContent = 'A raven can find you when something stirs — even with the town closed.';
  }
  navigator.serviceWorker && navigator.serviceWorker.getRegistration && navigator.serviceWorker.getRegistration().then(reg =>
    reg && reg.pushManager ? reg.pushManager.getSubscription() : null
  ).then(s => {
    document.getElementById('notifEnableBtn').classList.toggle('hidden', !!s);
    document.getElementById('notifDisableBtn').classList.toggle('hidden', !s);
  }).catch(() => {});
  modal.classList.remove('hidden');
}
function urlB64ToUint8(base64) {
  const pad = '='.repeat((4 - base64.length % 4) % 4);
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
async function enablePushHere() {
  const err = document.getElementById('notifErr');
  err.textContent = '';
  try {
    if (!pushSupportedHere()) { err.textContent = 'Push isn\'t available in this build — try the web version in a browser.'; return; }
    if (!(accountAuth() && accountAuth().token)) { err.textContent = 'Log into an account first — the raven follows your account.'; return; }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { err.textContent = 'The browser refused notification permission.'; return; }
    const reg = await navigator.serviceWorker.register('sw.js');
    await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(getPushPublicKey()) });
    const res = await fetch(apiUrlMaybe('/api/push/subscribe'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ account_token: accountAuth().token, subscription: sub.toJSON(), prefs: notifPrefs() })
    }).then(r => r.json());
    if (!res.ok) { err.textContent = 'The server declined the subscription (' + (res.error || '?') + ').'; return; }
    setUnlockToast('🔔 The raven knows this device now.');
    openNotifModal();
  } catch (e) {
    err.textContent = 'Could not enable here: ' + (e && e.message ? e.message : 'unknown error');
  }
}
async function disablePushHere() {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && await reg.pushManager.getSubscription();
    if (sub) {
      if (accountAuth() && accountAuth().token) {
        fetch(apiUrlMaybe('/api/push/unsubscribe'), {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ account_token: accountAuth().token, endpoint: sub.endpoint })
        }).catch(() => {});
      }
      await sub.unsubscribe();
    }
    setUnlockToast('🔕 The raven forgets this device.');
    openNotifModal();
  } catch (e) {}
}
(function () {
  const rows = document.getElementById('notifRows');
  if (rows) rows.addEventListener('click', async (e) => {
    const t = e.target.closest('.notifToggle');
    if (!t) return;
    const prefs = notifPrefs();
    prefs[t.dataset.pref] = !prefs[t.dataset.pref];
    saveNotifPrefs(prefs);
    t.classList.toggle('on', prefs[t.dataset.pref]);
    t.textContent = prefs[t.dataset.pref] ? 'ON' : 'OFF';
    // If already subscribed, sync the new prefs to the server.
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg && await reg.pushManager.getSubscription();
      if (sub && accountAuth() && accountAuth().token) {
        fetch(apiUrlMaybe('/api/push/subscribe'), {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ account_token: accountAuth().token, subscription: sub.toJSON(), prefs })
        }).catch(() => {});
      }
    } catch (e2) {}
  });
  const en = document.getElementById('notifEnableBtn');
  if (en) en.addEventListener('click', enablePushHere);
  const dis = document.getElementById('notifDisableBtn');
  if (dis) dis.addEventListener('click', disablePushHere);
  const close = document.getElementById('notifCloseBtn');
  if (close) close.addEventListener('click', () => { Modals.set('notifModalOpen', false); document.getElementById('notifModal').classList.add('hidden'); });
})();

  return { openNotifModal };
}
