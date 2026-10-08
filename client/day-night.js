// ---------------------------------------------------------------------------
// Day/night cycle (Tier 3.4 Phase C). 20 real minutes of day, 20 of night,
// derived purely from the wall clock (so every client agrees without server
// state). getDayNightState turns the clock into phase/light-amount/is-night/
// blood-moon; updateDayNightCycle recolors the sky + ambient, arcs the sun and
// moon across dayNightWorldRadius, and ramps the moonlight + lamp glows each
// frame. Timing/color consts + GFX/lamp glows injected; the scene-lighting
// objects via getters (they're built in initScene).
// ---------------------------------------------------------------------------
export default function createDayNight({ DAY_MS, NIGHT_MS, CYCLE_MS, DAY_NIGHT_TRANSITION_MS, SKY_DAY, SKY_NIGHT, AMBIENT_DAY, AMBIENT_NIGHT, _skyColor, _ambientColor, GFX, getLampGlows, bloodMoonActiveClient, hagstoneActiveClient, getOutdoorScene, getOutdoorSun, getMoonMesh, getOutdoorAmbient, getOutdoorMoonLight, getWildsScene, getSunMesh, getSkyAnchor }) {
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
// 🌑 Hagstone world (the coven's private instance): a perpetual violet night,
// held apart from the public world's clock so stepping through the Hagstone
// unmistakably reads as "somewhere else". Overrides sky/ambient/moon below.
const SKY_HAG = new THREE.Color(0x160f33);
const AMBIENT_HAG = new THREE.Color(0x5a49a0);
const MOON_HAG_COLOR = new THREE.Color(0xc9bcff);
function updateDayNightCycle() {
  if (!getOutdoorScene() || !getOutdoorAmbient() || !getOutdoorSun()) return;
  const { lightAmount, isNight, dayProgress, nightProgress } = getDayNightState();
  // 🔴 Blood Moon nights (Session L): every 13th night the sky goes red —
  // pure client-side clock math, the same cycle arithmetic the server uses.
  const bloodMoon = isNight && bloodMoonActiveClient();
  const hagstone = !!(hagstoneActiveClient && hagstoneActiveClient());
  // In the Hagstone world the lamps are lit and the sky reads as night no
  // matter the public clock, so the night-driven visuals ride these instead.
  const effLight = hagstone ? 0 : lightAmount;
  const effNight = hagstone || isNight;

  if (hagstone) _skyColor.copy(SKY_HAG);
  else _skyColor.copy(bloodMoon ? SKY_BLOOD : SKY_NIGHT).lerp(SKY_DAY, lightAmount);
  getOutdoorScene().background.copy(_skyColor);
  if (getOutdoorScene().fog) {
    getOutdoorScene().fog.color.copy(_skyColor);
    // Pull the fog in close in the Hagstone world for a hushed, enclosed feel.
    getOutdoorScene().fog.near = hagstone ? 350 : 700;
    getOutdoorScene().fog.far  = hagstone ? 1700 : 2200;
  }
  // Kept in sync even while inactive — the Wilds shares the same day/night
  // clock, so its sky shouldn't be stuck wherever it was at startup the
  // first time a player actually steps through the portal.
  if (getWildsScene()) {
    getWildsScene().background.copy(_skyColor);
    if (getWildsScene().fog) {
      getWildsScene().fog.color.copy(_skyColor);
      getWildsScene().fog.near = hagstone ? 350 : 700;
      getWildsScene().fog.far  = hagstone ? 1700 : 2200;
    }
  }

  if (hagstone) _ambientColor.copy(AMBIENT_HAG);
  else _ambientColor.copy(bloodMoon ? AMBIENT_BLOOD : AMBIENT_NIGHT).lerp(AMBIENT_DAY, lightAmount);
  getOutdoorAmbient().color.copy(_ambientColor);
  getOutdoorAmbient().intensity = hagstone ? 0.52 : (0.38 + lightAmount * 0.27);

  // Sun arcs from one horizon to the other across the day; moon mirrors it
  // across the night. Using sin() for height means both rise and set
  // smoothly rather than popping in at a fixed height.
  const sunAngle = Math.PI * dayProgress;
  // The directional light's arc; its position anchors near the player each
  // frame (see GFX.beforeRender) so the shadow frustum stays tight.
  const sunDir = { x: Math.cos(sunAngle), y: Math.max(0.1, Math.sin(sunAngle) * 0.6), z: 0.4 };
  getOutdoorSun().position.set(sunDir.x * 1150, sunDir.y * 1150, sunDir.z * 1150);
  if (getOutdoorSun().target) getOutdoorSun().target.position.set(0, 0, 0);
  getOutdoorSun().intensity = effLight * 0.9; // sun goes dark in the Hagstone world

  const moonAngle = Math.PI * nightProgress;
  const moonStrength = 1 - effLight;          // full moon in the Hagstone world

  // Visible sun & moon DISCS. Anchored to the camera's sky-dome (like the
  // stars) so they always ride overhead wherever the player walks, at a fixed
  // fog-safe distance — the discs use fog:false, but keeping them well inside
  // the far plane also stops them clipping. skyAlt() lifts them from the
  // horizon at rise/set up to high in the sky at their peak.
  const anchor = getSkyAnchor && getSkyAnchor();
  const ax = anchor ? anchor.x : 0, az = anchor ? anchor.z : 0;
  const SKY_DIST = 1500;
  const skyAlt = (a) => (0.24 + Math.max(0, Math.sin(a)) * 0.92) * SKY_DIST;

  const sunMesh = getSunMesh && getSunMesh();
  if (sunMesh) {
    sunMesh.position.set(ax + Math.cos(sunAngle) * SKY_DIST, skyAlt(sunAngle), az - 0.34 * SKY_DIST);
    sunMesh.material.opacity = effLight;
    sunMesh.visible = effLight > 0.02;
    if (sunMesh.userData.glow) sunMesh.userData.glow.material.opacity = effLight * 0.7;
  }

  getMoonMesh().position.set(ax + Math.cos(moonAngle) * -SKY_DIST, skyAlt(moonAngle), az - 0.34 * SKY_DIST);
  getOutdoorMoonLight().position.set(Math.cos(moonAngle) * -1150, Math.max(60, Math.sin(moonAngle) * 900), -460);
  getOutdoorMoonLight().intensity = moonStrength * 0.55;
  // The moon blushes red on blood nights, glows violet in the Hagstone world.
  const moonColor = bloodMoon ? MOON_BLOOD_COLOR : hagstone ? MOON_HAG_COLOR : MOON_PALE_COLOR;
  getMoonMesh().material.color.copy(moonColor);
  getMoonMesh().scale.setScalar(bloodMoon ? 1.9 : hagstone ? 1.4 : 1); // bigger, closer moon in the Hagstone world
  getOutdoorMoonLight().color.copy(moonColor);
  getMoonMesh().material.opacity = moonStrength;
  getMoonMesh().visible = moonStrength > 0.02;

  // Lane lampposts come on with the dark — a warm counterpoint to the cool
  // moonlight, riding the same lightAmount curve so they fade in through
  // dusk instead of snapping. (Cheap: material opacity only, no lights.)
  if (getLampGlows().length) {
    const glow = 1 - effLight;
    for (const l of getLampGlows()) {
      l.glassMat.opacity = 0.22 + glow * 0.72;
      l.glowMat.opacity = glow * 0.55;
    }
  }

  GFX.cycleTick(effLight, effNight); // stars + night visuals show in the Hagstone world too
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
