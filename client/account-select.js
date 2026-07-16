// ---------------------------------------------------------------------------
// Account + character select (Tier 3.4 Phase C). The pre-game front door: the
// account panel (register / log in / log out, remembering a saved account), the
// character roster + create flow, and attemptJoin which fires the join payload
// over the socket. DOM element refs, presets, and the api/status/join helpers are
// injected; ensureAudio via getter (it's built later), joinMode/ws via getters,
// the saved account via get/set, and the last join payload via a setter.
// ---------------------------------------------------------------------------
export default function createAccountSelect({ CHARACTER_PRESETS, KK, accountLoginBtn, accountPassInput, accountRegisterBtn, accountStatusEl, accountUserInput, apiUrl, joinBtn, nameInput, passInput, passSessionReceipt, setAccountStatus, setJoinMode, showJoinError, getEnsureAudio, getJoinMode, getWs, getSavedAccount, setSavedAccount, setLastJoinPayload, getThirdEyeOptIn, setThirdEyeOptInVar }) {
function renderLoggedInStatus() {
  accountStatusEl.innerHTML = '';
  const span = document.createElement('span');
  span.textContent = `Logged in as ${getSavedAccount().username} — `;
  accountStatusEl.style.color = '#9bc49a';
  accountStatusEl.appendChild(span);
  const logout = document.createElement('a');
  logout.href = '#';
  logout.textContent = 'log out';
  logout.addEventListener('click', (e) => { e.preventDefault(); logoutAccount(); });
  accountStatusEl.appendChild(logout);
  updateCharPickerVisibility();
}

function logoutAccount() {
  setSavedAccount(null);
  localStorage.removeItem('tc_account');
  setAccountStatus('');
  rosterData = null;
  newCharMode = false;
  renderCharRoster();
  updateCharPickerVisibility();
}

// ── Character roster — the returning-player select screen ──────────────────
// When a saved login exists (or right after logging in), /api/characters
// returns every class this account has played, newest first. Those become
// "continue as …" cards; "＋ New character" re-opens the classic class
// picker. Guests and never-played accounts just see the picker, unchanged.
const charRosterEl = document.getElementById('charRoster');
const charRosterListEl = document.getElementById('charRosterList');
const newCharBtn = document.getElementById('newCharBtn');
const charSelectLabelEl = document.getElementById('charSelectLabel');
const charSelectRowEl = document.getElementById('charSelectRow');
let rosterData = null;   // last /api/characters payload, or null
let newCharMode = false; // true while picking a class for a new character

function updateCharPickerVisibility() {
  const hasRoster = getJoinMode() === 'account' && !!getSavedAccount() && !!rosterData
    && Array.isArray(rosterData.characters) && rosterData.characters.length > 0;
  const showRoster = hasRoster && !newCharMode;
  // While logged in, the username/password form gives way to the roster —
  // the "log out" link in the status line brings it back.
  const loggedIn = !!getSavedAccount();
  if (accountUserInput) accountUserInput.classList.toggle('hidden', loggedIn);
  if (accountPassInput) accountPassInput.classList.toggle('hidden', loggedIn);
  const accountBtnRowEl = document.getElementById('accountBtnRow');
  if (accountBtnRowEl) accountBtnRowEl.classList.toggle('hidden', loggedIn);
  if (charRosterEl) charRosterEl.classList.toggle('hidden', !hasRoster);
  if (charRosterListEl) charRosterListEl.classList.toggle('hidden', !showRoster);
  if (charSelectRowEl) charSelectRowEl.classList.toggle('hidden', showRoster);
  if (charSelectLabelEl) {
    charSelectLabelEl.classList.toggle('hidden', showRoster);
    charSelectLabelEl.textContent = hasRoster && newCharMode
      ? 'Choose a calling for your new character'
      : 'Choose your calling';
  }
  if (newCharBtn) newCharBtn.textContent = newCharMode ? '← Back to your characters' : '＋ New character';
}

function charCssColor(n) { return '#' + n.toString(16).padStart(6, '0'); }

function renderCharRoster() {
  if (!charRosterListEl) return;
  charRosterListEl.innerHTML = '';
  if (!rosterData || !Array.isArray(rosterData.characters)) return;
  for (const c of rosterData.characters) {
    const preset = CHARACTER_PRESETS[c.charId];
    if (!preset) continue;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'rosterCard' + (c.charId === selectedCharId ? ' selected' : '');
    const av = document.createElement('span');
    av.className = 'rosterAvatar';
    for (const [cls, color] of [['charHair', preset.hair], ['charHead', preset.skin], ['charBody', preset.shirt]]) {
      const s = document.createElement('span');
      s.className = cls;
      s.style.background = charCssColor(color);
      av.appendChild(s);
    }
    const info = document.createElement('span');
    info.className = 'rosterInfo';
    const nm = document.createElement('span');
    nm.className = 'rosterName';
    nm.textContent = rosterData.username + ' the ' + preset.name;
    const sub = document.createElement('span');
    sub.className = 'rosterSub';
    sub.textContent = 'Level ' + (rosterData.level || 1) + (c.chapter > 0 ? ' · Chapter ' + c.chapter : '');
    info.appendChild(nm);
    info.appendChild(sub);
    card.appendChild(av);
    card.appendChild(info);
    if (c.charId === rosterData.lastCharId) {
      const tag = document.createElement('span');
      tag.className = 'rosterTag';
      tag.textContent = 'Last played';
      card.appendChild(tag);
    }
    card.addEventListener('click', () => {
      selectedCharId = c.charId;
      localStorage.setItem('tc_charid', String(selectedCharId));
      renderCharSelect();
      renderCharRoster();
    });
    charRosterListEl.appendChild(card);
  }
}

function fetchCharacterRoster() {
  if (!getSavedAccount() || !getSavedAccount().token) return;
  fetch(apiUrlMaybe('/api/characters'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: getSavedAccount().token })
  })
    .then(r => r.json().then(data => ({ ok: r.ok, status: r.status, data })))
    .then(({ ok, status, data }) => {
      if (!ok) {
        if (status === 401) {
          // Sessions live in server memory and don't survive a restart —
          // ask for a fresh login instead of silently joining as a guest.
          logoutAccount();
          setAccountStatus('Session expired — log in again to see your characters.', true);
        }
        return;
      }
      rosterData = data;
      newCharMode = false;
      if (Number.isInteger(data.lastCharId) && CHARACTER_PRESETS[data.lastCharId]) {
        selectedCharId = data.lastCharId;
        localStorage.setItem('tc_charid', String(selectedCharId));
        renderCharSelect();
      }
      renderCharRoster();
      updateCharPickerVisibility();
    })
    .catch(() => { /* server unreachable — the classic picker still works */ });
}
// The web build serves everything same-origin; the mobile builds override
// fetch targets via apiUrl() in their own copies. Use it when present.
function apiUrlMaybe(p) { return (typeof apiUrl === 'function') ? apiUrl(p) : p; }

if (newCharBtn) {
  newCharBtn.addEventListener('click', () => {
    newCharMode = !newCharMode;
    updateCharPickerVisibility();
  });
}

// NOT run during construction — main.js calls this AFTER destructuring the
// factory's return. Running it here would fire the injected setJoinMode →
// main's `updateCharPickerVisibility` const while that const is still being
// assigned (`const {…} = createAccountSelect(…)`), throwing a TDZ
// ReferenceError that aborts the entire client boot whenever a saved account
// exists. Deferring the call keeps startup crash-free.
function loadSavedAccount() {
  try {
    const raw = localStorage.getItem('tc_account');
    if (raw) setSavedAccount(JSON.parse(raw));
  } catch (e) { setSavedAccount(null); }
  if (getSavedAccount() && getSavedAccount().username && getSavedAccount().token) {
    setJoinMode('account');
    renderLoggedInStatus();
    fetchCharacterRoster();
  }
}

function submitAccount(endpoint) {
  const username = accountUserInput.value.trim();
  const password = accountPassInput.value;
  if (!username || !password) { setAccountStatus('Enter a username and password.', true); return; }
  setAccountStatus(endpoint === 'register' ? 'Creating account…' : 'Logging in…');
  fetch(apiUrl('/api/' + endpoint), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
    .then(r => r.json().then(data => ({ ok: r.ok, data })))
    .then(({ ok, data }) => {
      if (!ok) { setAccountStatus(data.error || 'Something went wrong.', true); return; }
      setSavedAccount({ token: data.token, username: data.username, color: data.color });
      localStorage.setItem('tc_account', JSON.stringify(getSavedAccount()));
      accountPassInput.value = '';
      renderLoggedInStatus();
      fetchCharacterRoster();
    })
    .catch(() => setAccountStatus('Could not reach the server.', true));
}
accountLoginBtn.addEventListener('click', () => submitAccount('login'));
accountRegisterBtn.addEventListener('click', () => submitAccount('register'));
accountPassInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitAccount('login'); });

// Character picker — remembered per-browser like the other join-screen
// preferences, but re-pickable any time before hitting Enter Town.
let selectedCharId = parseInt(localStorage.getItem('tc_charid'), 10);
if (!Number.isInteger(selectedCharId) || selectedCharId < 0 || selectedCharId >= CHARACTER_PRESETS.length) {
  selectedCharId = Math.floor(Math.random() * CHARACTER_PRESETS.length);
}
function renderCharSelect() {
  document.querySelectorAll('.charOption').forEach((btn) => {
    btn.classList.toggle('selected', parseInt(btn.dataset.char, 10) === selectedCharId);
  });
}
document.querySelectorAll('.charOption').forEach((btn) => {
  btn.addEventListener('click', () => {
    selectedCharId = parseInt(btn.dataset.char, 10);
    localStorage.setItem('tc_charid', String(selectedCharId));
    renderCharSelect();
    renderCharRoster(); // keep the roster cards' selected ring in sync
  });
});
renderCharSelect();

// Open 3rd Eye camera opt-in — entirely client-side and off by default.
// Server protocol doesn't change at all: it still always sends
// spell_consent_request and waits. This just controls whether THIS
// client shows the blocking Allow/Deny prompt when one arrives, or skips
// straight to capture because the player themselves pre-authorized it,
// in their own settings, ahead of time. Two checkboxes (join screen +
// in-game Settings tab) both read/write the same flag so it can be
// flipped without needing to rejoin to take effect.
function setThirdEyeOptIn(value) {
  setThirdEyeOptInVar(!!value);
  localStorage.setItem('tc_thirdeye_optin', getThirdEyeOptIn() ? '1' : '0');
  const a = document.getElementById('thirdEyeOptInCheckbox');
  const b = document.getElementById('thirdEyeOptInCheckboxInGame');
  if (a) a.checked = getThirdEyeOptIn();
  if (b) b.checked = getThirdEyeOptIn();
}
setThirdEyeOptIn(getThirdEyeOptIn());
const thirdEyeOptInCheckbox = document.getElementById('thirdEyeOptInCheckbox');
if (thirdEyeOptInCheckbox) thirdEyeOptInCheckbox.addEventListener('change', (e) => setThirdEyeOptIn(e.target.checked));
const thirdEyeOptInCheckboxInGame = document.getElementById('thirdEyeOptInCheckboxInGame');
if (thirdEyeOptInCheckboxInGame) thirdEyeOptInCheckboxInGame.addEventListener('change', (e) => setThirdEyeOptIn(e.target.checked));

function attemptJoin() {
  // Tier-3 assets: hold the join until the preload settles (or 12s cap),
  // so the town builds with KayKit models instead of racing the loader.
  if (!KK.settled && !attemptJoin._waited) {
    attemptJoin._waited = true;
    const oldLabel = joinBtn.textContent;
    joinBtn.textContent = 'Summoning…';
    joinBtn.disabled = true;
    Promise.race([KK.promise, new Promise(r => setTimeout(r, 12000))]).then(() => {
      joinBtn.textContent = oldLabel;
      joinBtn.disabled = false;
      attemptJoin();
    });
    return;
  }
  let name;
  if (getJoinMode() === 'account') {
    if (!getSavedAccount()) { showJoinError('Log in or create an account first.'); return; }
    name = getSavedAccount().username;
  } else {
    name = nameInput.value.trim();
    if (!name) { showJoinError('Enter a name first.'); return; }
  }
  showJoinError('');
  getEnsureAudio()(); // the click is a user gesture — set up Web Audio here so it's unblocked later
  const payload = { type: 'join', name, password: passInput.value, charId: selectedCharId };
  if (getJoinMode() === 'account' && getSavedAccount()) payload.accountToken = getSavedAccount().token;
  // Present the Town Pass receipt (a Stripe Checkout session id) so the
  // server can restore a guest's pass — even across a server restart.
  if (passSessionReceipt()) payload.passSession = passSessionReceipt();
  setLastJoinPayload(payload);
  if (getWs().readyState === WebSocket.OPEN) {
    getWs().send(JSON.stringify(payload));
  } else {
    getWs().addEventListener('open', () => getWs().send(JSON.stringify(payload)), { once: true });
  }
}

  return { updateCharPickerVisibility, apiUrlMaybe, attemptJoin, loadSavedAccount };
}
