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
// Account form sub-mode: 'login' shows only username/password; 'register' is
// the separate "create account" view that adds the email + 18+ gate. New
// visitors land on 'login'; the switch link flips between the two.
let acctSubMode = 'login';

// Show only the fields that belong to the current sub-mode (login vs register).
// Called whenever the account form is visible and NOT signed in.
function applyAcctSubMode() {
  const reg = acctSubMode === 'register';
  const emailEl = document.getElementById('accountEmailInput');
  if (emailEl) emailEl.classList.toggle('hidden', !reg);
  const ageGateEl = document.getElementById('accountAgeGate');
  if (ageGateEl) ageGateEl.classList.toggle('hidden', !reg);
  const consentEl = document.getElementById('accountConsent');
  if (consentEl) consentEl.classList.toggle('hidden', !reg);
  if (accountLoginBtn) accountLoginBtn.classList.toggle('hidden', reg);
  if (accountRegisterBtn) accountRegisterBtn.classList.toggle('hidden', !reg);
  const forgotPwRowEl = document.getElementById('forgotPwRow');
  if (forgotPwRowEl) forgotPwRowEl.classList.toggle('hidden', reg); // forgot-pw is a login-only affordance
  const linkEl = document.getElementById('acctSwitchLink');
  if (linkEl) linkEl.textContent = reg ? '← Back to log in' : 'Need an account? Create one →';
}

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
  // Registration-only fields + the login/register split. Once signed in the
  // roster replaces the whole form, so hide email, the 18+ gate, forgot-pw and
  // the switch link. Otherwise defer to the sub-mode: 'login' shows only
  // username/password/Log In; 'register' adds the email box + 18+ confirmation.
  const switchRowEl = document.getElementById('acctSwitchRow');
  if (loggedIn) {
    ['accountEmailInput', 'accountAgeGate', 'accountConsent', 'forgotPwRow'].forEach((id) => {
      const el = document.getElementById(id); if (el) el.classList.add('hidden');
    });
    if (switchRowEl) switchRowEl.classList.add('hidden');
  } else {
    if (switchRowEl) switchRowEl.classList.remove('hidden');
    applyAcctSubMode();
  }
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
    const avImg = document.createElement('img');
    avImg.className = 'rosterImg';
    avImg.src = 'charselect/char' + c.charId + '.png?v=2';
    avImg.alt = preset.name;
    avImg.loading = 'lazy';
    avImg.decoding = 'async';
    av.appendChild(avImg);
    const info = document.createElement('span');
    info.className = 'rosterInfo';
    const nm = document.createElement('span');
    nm.className = 'rosterName';
    nm.textContent = rosterData.username + ' the ' + preset.name;
    const sub = document.createElement('span');
    sub.className = 'rosterSub';
    sub.textContent = 'Level ' + (c.level || 1) + (c.chapter > 0 ? ' · Chapter ' + c.chapter : '');
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
  // Age gate: creating an account requires confirming 18+. Login doesn't
  // re-ask (the attestation is already on file from registration).
  const over18El = document.getElementById('accountOver18');
  const over18 = !!(over18El && over18El.checked);
  if (endpoint === 'register' && !over18) {
    setAccountStatus('You must confirm you are 18 or older to create an account.', true);
    return;
  }
  // Optional email (register only) — used only for password recovery.
  const emailEl = document.getElementById('accountEmailInput');
  const email = emailEl ? emailEl.value.trim() : '';
  setAccountStatus(endpoint === 'register' ? 'Creating account…' : 'Logging in…');
  fetch(apiUrl('/api/' + endpoint), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, over18, email })
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
accountPassInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitAccount(acctSubMode === 'register' ? 'register' : 'login'); });
// Flip between the log-in and create-account views (email + 18+ live only on
// the latter). Clears any stale status and re-shows the right fields.
const acctSwitchLink = document.getElementById('acctSwitchLink');
if (acctSwitchLink) acctSwitchLink.addEventListener('click', (e) => {
  e.preventDefault();
  acctSubMode = acctSubMode === 'register' ? 'login' : 'register';
  setAccountStatus('');
  applyAcctSubMode();
  if (accountUserInput) accountUserInput.focus();
});
const accountEmailEl = document.getElementById('accountEmailInput');
if (accountEmailEl) accountEmailEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitAccount('register'); });

// A guest who tapped "Create a free account" on the in-game nudge gets sent
// here with a flag — open straight into the account/register form so they land
// where they meant to. Best-effort: if anything's off it just shows the normal
// join screen.
try {
  if (localStorage.getItem('tc_goto_register') === '1') {
    localStorage.removeItem('tc_goto_register');
    setJoinMode('account');
    acctSubMode = 'register';
    applyAcctSubMode();
    setAccountStatus('Create a free account to save your progress and earn daily rewards.');
    if (accountUserInput) accountUserInput.focus();
  }
} catch (e) {}

// "Forgot password?" — ask for a username or email and request a reset link.
// The server always answers the same way (no account enumeration), so the
// confirmation we show is deliberately generic.
const forgotPwLink = document.getElementById('forgotPwLink');
if (forgotPwLink) forgotPwLink.addEventListener('click', (e) => {
  e.preventDefault();
  const who = (accountUserInput.value.trim()) ||
    (window.prompt('Enter your username or the email on your account:') || '').trim();
  if (!who) return;
  setAccountStatus('Sending a reset link…');
  fetch(apiUrl('/api/request-reset'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernameOrEmail: who })
  })
    .then(() => setAccountStatus('If an account with an email on file matches that, a reset link is on its way. Check your inbox.'))
    .catch(() => setAccountStatus('Could not reach the server.', true));
});

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

// Themed pre-spawn loading screen — shown while the town + chosen body stream
// in, so a first-time visitor never sees the classic fallback graphics. The
// bar is an indeterminate shimmer (CSS), so it stays honest without a
// misleading percentage.
function showWorldLoading(on) {
  try { const ov = document.getElementById('worldLoading'); if (ov) ov.classList.toggle('show', !!on); } catch (e) {}
}

function attemptJoin() {
  // Arm the asset-load pill: from the first join click onward it rides the
  // cursor until every model has streamed in, then hides itself.
  try { window.__tcLoadArmed = true; } catch (e) {}
  // Tier-3 assets: hold the join until the shared town AND the body you picked
  // are in hand, so you spawn into a real KayKit town — not the classic
  // fallback. Only the chosen class gates spawn (the other four stream in behind
  // you via beginChars), so this waits on ~5MB, not the old ~17MB. A themed
  // loading screen covers the wait instead of dropping you into old graphics.
  const assetsReady = KK.settled && KK.charReady(selectedCharId);
  if (!assetsReady && !attemptJoin._waited) {
    attemptJoin._waited = true;
    const oldLabel = joinBtn.textContent;
    joinBtn.textContent = 'Summoning…';
    joinBtn.disabled = true;
    showWorldLoading(true);
    KK.beginChars(selectedCharId);
    // Wait on what actually matters (town + your body), not a blind time cap.
    // The generous safety cap only releases if something genuinely stalls;
    // asset failures resolve on their own and simply fall back for that piece.
    const ready = Promise.all([KK.promise, KK.whenChar(selectedCharId)]);
    Promise.race([ready, new Promise(r => setTimeout(r, 45000))]).then(() => {
      showWorldLoading(false);
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
