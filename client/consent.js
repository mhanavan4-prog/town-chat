// ---------------------------------------------------------------------------
// Camera / location consent prompts (Tier 3.4 Phase C) — the privacy-first
// allow/deny modals for Open 3rd Eye (one photo) and the Werewolf howl
// (coarse location). DI factory; open-state via the Modals registry.
// ---------------------------------------------------------------------------
import { Modals } from './modals.js';

export default function createConsent({ getWs, captureSelfiePhoto }) {
let activeSpellConsent = null; // { requestId }

function openSpellConsentPrompt(requestId, casterName, spellName) {
  activeSpellConsent = { requestId };
  Modals.set('spellConsentOpen', true);
  // Themed framing, but the mechanical disclosure stays explicit and
  // unambiguous on purpose — camera, one photo, sent to a named person —
  // since that clarity is the entire reason this prompt exists.
  document.getElementById('spellConsentText').textContent =
    `${casterName} has turned the Witch's eye toward you, casting ${spellName}. Let it open, and your camera will capture one photo of you right now and send it to ${casterName} as a vision. The choice is yours.`;
  document.getElementById('spellConsentStatus').textContent = '';
  document.getElementById('spellConsentAllowBtn').disabled = false;
  document.getElementById('spellConsentDenyBtn').disabled = false;
  document.getElementById('spellConsentModal').classList.remove('hidden');
}

function closeSpellConsentPrompt() {
  document.getElementById('spellConsentModal').classList.add('hidden');
  Modals.set('spellConsentOpen', false);
  activeSpellConsent = null;
}

function denySpellConsent() {
  if (!activeSpellConsent) return;
  getWs().send(JSON.stringify({ type: 'spell_consent_response', requestId: activeSpellConsent.requestId, allow: false }));
  closeSpellConsentPrompt();
}

const spellConsentDenyBtn = document.getElementById('spellConsentDenyBtn');
if (spellConsentDenyBtn) spellConsentDenyBtn.addEventListener('click', denySpellConsent);

const spellConsentAllowBtn = document.getElementById('spellConsentAllowBtn');
if (spellConsentAllowBtn) spellConsentAllowBtn.addEventListener('click', async () => {
  if (!activeSpellConsent) return;
  const requestId = activeSpellConsent.requestId;
  const statusEl = document.getElementById('spellConsentStatus');
  spellConsentAllowBtn.disabled = true;
  spellConsentDenyBtn.disabled = true;
  statusEl.textContent = 'The eye opens…';
  let image = null;
  try {
    image = await captureSelfiePhoto();
    statusEl.textContent = 'The vision is sent.';
  } catch (e) {
    statusEl.textContent = "The eye couldn't open (no camera access) — letting them know it fizzled.";
  }
  getWs().send(JSON.stringify({ type: 'spell_photo', requestId, image }));
  setTimeout(closeSpellConsentPrompt, image ? 700 : 1600);
});

// Werewolf's Scent Trail — same consent-first shape as Open 3rd Eye above,
// but for location instead of the camera. Rounds to ~1km precision before
// this ever leaves the device (the server independently re-rounds too, and
// only ever sends a coarse city-level label back to the caster — never raw
// coordinates, never posted anywhere public).
function getRoughLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Geolocation not available')); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: Math.round(pos.coords.latitude * 100) / 100,
        lon: Math.round(pos.coords.longitude * 100) / 100
      }),
      (err) => reject(err),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  });
}

let activeHowlConsent = null; // { consentId }

function openHowlConsentPrompt(consentId, casterName) {
  activeHowlConsent = { consentId };
  Modals.set('howlConsentOpen', true);
  document.getElementById('howlConsentText').textContent =
    `${casterName} throws back their head and howls at the moon, inviting you to answer the call. Join the howl, and your device's approximate location (nearest city only, never an exact address) is sent privately to ${casterName} — never posted anywhere. The choice is yours.`;
  document.getElementById('howlConsentStatus').textContent = '';
  document.getElementById('howlConsentAllowBtn').disabled = false;
  document.getElementById('howlConsentDenyBtn').disabled = false;
  document.getElementById('howlConsentModal').classList.remove('hidden');
}

function closeHowlConsentPrompt() {
  document.getElementById('howlConsentModal').classList.add('hidden');
  Modals.set('howlConsentOpen', false);
  activeHowlConsent = null;
}

function denyHowlConsent() {
  if (!activeHowlConsent) return;
  getWs().send(JSON.stringify({ type: 'howl_consent_response', consentId: activeHowlConsent.consentId, allow: false }));
  closeHowlConsentPrompt();
}

const howlConsentDenyBtn = document.getElementById('howlConsentDenyBtn');
if (howlConsentDenyBtn) howlConsentDenyBtn.addEventListener('click', denyHowlConsent);

const howlConsentAllowBtn = document.getElementById('howlConsentAllowBtn');
if (howlConsentAllowBtn) howlConsentAllowBtn.addEventListener('click', async () => {
  if (!activeHowlConsent) return;
  const consentId = activeHowlConsent.consentId;
  const statusEl = document.getElementById('howlConsentStatus');
  howlConsentAllowBtn.disabled = true;
  howlConsentDenyBtn.disabled = true;
  statusEl.textContent = 'Joining the howl…';
  let loc = null;
  try {
    loc = await getRoughLocation();
    statusEl.textContent = 'Your scent carries on the wind.';
  } catch (e) {
    statusEl.textContent = "Couldn't get your location — letting them know it fizzled.";
  }
  getWs().send(JSON.stringify({
    type: 'howl_location_result', consentId,
    lat: loc ? loc.lat : null, lon: loc ? loc.lon : null
  }));
  setTimeout(closeHowlConsentPrompt, loc ? 700 : 1600);
});

  return { openSpellConsentPrompt, openHowlConsentPrompt, denySpellConsent, denyHowlConsent };
}
