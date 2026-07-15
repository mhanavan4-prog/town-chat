// ---------------------------------------------------------------------------
// Day/night cycle (Tier 3.4 Phase C). 20 real minutes of day, 20 of night,
// derived purely from the wall clock (so every client agrees without server
// state). getDayNightState turns the clock into phase/light-amount/is-night/
// blood-moon; updateDayNightCycle recolors the sky + ambient, arcs the sun and
// moon across dayNightWorldRadius, and ramps the moonlight + lamp glows each
// frame. Timing/color consts + GFX/lamp glows injected; the scene-lighting
// objects via getters (they're built in initScene).
// ---------------------------------------------------------------------------
export default function createDayNight({ DAY_MS, NIGHT_MS, CYCLE_MS, DAY_NIGHT_TRANSITION_MS, SKY_DAY, SKY_NIGHT, AMBIENT_DAY, AMBIENT_NIGHT, _skyColor, _ambientColor, GFX, getLampGlows, bloodMoonActiveClient, getOutdoorScene, getOutdoorSun, getMoonMesh, getOutdoorAmbient, getOutdoorMoonLight, getDayNightWorldRadius, getWildsScene }) {
function getDayNightState() {
  const cyclePos = Date.now() % CYCLE_MS;
  let lightAmount;
  if (cyclePos < DAY_MS - DAY_NIGHT_TRANSITION_MS) {
    lightAmount = 1;
  } else if (cyclePos < DAY_MS) {
    lightAmount = 1 - (cyclePos - (DAY_MS - DAY_NIGHT_TRANSITION_MS)) / DAY_NIGHT_TRANSITION_MS;
  } else if (cyclePos < CYCLE_MS - DAY_NIGHT_TRANSITION_MS) {
    lightAmount = 0;
  } else {
    lightAmount = (cyclePos - (CYCLE_MS - DAY_NIGHT_TRANSITION_MS)) / DAY_NIGHT_TRANSITION_MS;
  }
  const dayProgress = Math.min(1, cyclePos / DAY_MS);
  const nightProgress = cyclePos > DAY_MS ? (cyclePos - DAY_MS) / NIGHT_MS : 0;
  return { cyclePos, lightAmount, isNight: cyclePos >= DAY_MS, dayProgress, nightProgress };
}

const SKY_BLOOD = new THREE.Color(0x2a0812);
const AMBIENT_BLOOD = new THREE.Color(0xc06a6a);
const MOON_BLOOD_COLOR = new THREE.Color(0xff5a4a);
const MOON_PALE_COLOR = new THREE.Color(0xeaf2ff); // the moon's authored face
function updateDayNightCycle() {
  if (!getOutdoorScene() || !getOutdoorAmbient() || !getOutdoorSun()) return;
  const { lightAmount, isNight, dayProgress, nightProgress } = getDayNightState();
  // 🔴 Blood Moon nights (Session L): every 13th night the sky goes red —
  // pure client-side clock math, the same cycle arithmetic the server uses.
  const bloodMoon = isNight && bloodMoonActiveClient();

  _skyColor.copy(bloodMoon ? SKY_BLOOD : SKY_NIGHT).lerp(SKY_DAY, lightAmount);
  getOutdoorScene().background.copy(_skyColor);
  if (getOutdoorScene().fog) getOutdoorScene().fog.color.copy(_skyColor);
  // Kept in sync even while inactive — the Wilds shares the same day/night
  // clock, so its sky shouldn't be stuck wherever it was at startup the
  // first time a player actually steps through the portal.
  if (getWildsScene()) {
    getWildsScene().background.copy(_skyColor);
    if (getWildsScene().fog) getWildsScene().fog.color.copy(_skyColor);
  }

  _ambientColor.copy(bloodMoon ? AMBIENT_BLOOD : AMBIENT_NIGHT).lerp(AMBIENT_DAY, lightAmount);
  getOutdoorAmbient().color.copy(_ambientColor);
  getOutdoorAmbient().intensity = 0.38 + lightAmount * 0.27;

  // Sun arcs from one horizon to the other across the day; moon mirrors it
  // across the night. Using sin() for height means both rise and set
  // smoothly rather than popping in at a fixed height.
  const r = getDayNightWorldRadius();
  const sunAngle = Math.PI * dayProgress;
  // Direction rides the same arc as before; position anchors near the player
  // (see GFX.beforeRender) so the shadow frustum stays tight. Pre-join, the
  // old absolute arc position still applies.
  const sunDir = { x: Math.cos(sunAngle), y: Math.max(0.1, Math.sin(sunAngle) * 0.6), z: 0.4 };
  getOutdoorSun().position.set(sunDir.x * 1150, sunDir.y * 1150, sunDir.z * 1150);
  if (getOutdoorSun().target) getOutdoorSun().target.position.set(0, 0, 0);
  getOutdoorSun().intensity = lightAmount * 0.9;

  const moonAngle = Math.PI * nightProgress;
  const moonY = Math.sin(moonAngle) * r * 0.6; // nightProgress in [0,1] -> angle in [0,π] -> always >= 0, horizon to horizon
  getMoonMesh().position.set(Math.cos(moonAngle) * -r, Math.max(-80, moonY), -r * 0.4);
  getOutdoorMoonLight().position.set(Math.cos(moonAngle) * -1150, Math.max(60, moonY / Math.max(1, r) * 1150), -460);
  const moonStrength = 1 - lightAmount;
  getOutdoorMoonLight().intensity = moonStrength * 0.55;
  // The moon itself blushes on blood nights, and its light follows.
  getMoonMesh().material.color.copy(bloodMoon ? MOON_BLOOD_COLOR : MOON_PALE_COLOR);
  getOutdoorMoonLight().color.copy(bloodMoon ? MOON_BLOOD_COLOR : MOON_PALE_COLOR);
  getMoonMesh().material.opacity = moonStrength;
  getMoonMesh().visible = moonStrength > 0.02;

  // Lane lampposts come on with the dark — a warm counterpoint to the cool
  // moonlight, riding the same lightAmount curve so they fade in through
  // dusk instead of snapping. (Cheap: material opacity only, no lights.)
  if (getLampGlows().length) {
    const glow = 1 - lightAmount;
    for (const l of getLampGlows()) {
      l.glassMat.opacity = 0.22 + glow * 0.72;
      l.glowMat.opacity = glow * 0.55;
    }
  }

  GFX.cycleTick(lightAmount, isNight);
  updateDayNightHud(isNight);
}

// Whether mobs should currently be visible — set from the server's
// authoritative 'wildlife_state' broadcast (see ws message handler near
// the top of this file), not derived locally, so mob visibility agrees
// with the server's simulation even if a client's clock drifts slightly
// from the lighting-only getDayNightState() above.

let lastDayNightHudState = null;
function updateDayNightHud(isNight) {
  if (isNight === lastDayNightHudState) return;
  lastDayNightHudState = isNight;
  const tag = document.getElementById('dayNightTag');
  if (!tag) return;
  tag.textContent = isNight ? '🌕 Night' : '☀️ Day';
  tag.classList.toggle('nightTag', isNight);
}

  return { getDayNightState, updateDayNightCycle };
}
