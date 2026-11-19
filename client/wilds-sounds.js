// ---------------------------------------------------------------------------
// What the Wilds sound like when nothing is happening. Before this the moor
// was silent but for the beck. Two layers:
//
//   - The bed: one loop for the day (a soft moor wind through grass and
//     heather) and one for the night (stiller, colder air), crossfading with
//     the light at dusk and dawn. Low, under everything; it gives way to the
//     high wind as she flies up on the besom.
//   - Calls: every 20 to 60 seconds one creature far off, from somewhere round
//     her (left or right, near or further), never the same one twice running,
//     each a shade different in pitch. Which ones depends on day or night and
//     on the season, as on a real moor. And once a night, at midnight, the
//     village bell.
//
// Record (written from memory; the seasons are approximate): curlews come up
// to the moors to breed in spring and leave by late summer; skylarks sing over
// open ground from late winter into summer; nightjars churr on summer heath
// nights; fieldfares come in flocks for the winter; foxes scream mostly in the
// winter mating; tawny owls, ravens and red grouse are there all year. That
// these are the Wilds' creatures, and the bell at midnight, are the game's.
//
// Until a sound is recorded it is simply not heard (no synth stands in): a
// silent moor is better than a beeping one.
// ---------------------------------------------------------------------------

export const WILDS_BED = { day: 'moor_day', night: 'moor_night', vol: 0.32 };

// when: 'day' | 'night'; seasons: the Wheel's eight (null = all year).
export const WILDS_CALLS = [
  { id: 'curlew_call', when: 'day', seasons: ['ostara', 'beltane', 'litha'] },
  { id: 'skylark_song', when: 'day', seasons: ['imbolc', 'ostara', 'beltane', 'litha'] },
  { id: 'raven_croak', when: 'day', seasons: null },
  { id: 'grouse_call', when: 'day', seasons: null },
  { id: 'sheep_bell', when: 'day', seasons: null },
  { id: 'fieldfare_flock', when: 'day', seasons: ['samhain', 'yule', 'imbolc'] },
  { id: 'tawny_owl', when: 'night', seasons: null },
  { id: 'vixen_scream', when: 'night', seasons: ['samhain', 'yule', 'imbolc'] },
  { id: 'nightjar_churr', when: 'night', seasons: ['beltane', 'litha', 'lughnasadh'] },
];
export const WILDS_MIDNIGHT_BELL = 'midnight_bell';
export const WILDS_CALL_GAP = [20000, 60000];    // ms between calls
const WS_FLY_FADE = 320;                          // height at which the bed has given way to the high wind

// The calls that can be heard now. `have(id)` says whether a sound is recorded.
export function wildsCallsNow(night, season, have) {
  return WILDS_CALLS.filter((c) => (c.when === 'night') === !!night && (!season || !c.seasons || c.seasons.includes(season)) && (!have || have(c.id)));
}

// One call: which, how loud, from which side, at what pitch. `rand` returns 0..1. `last` is the one before.
export function pickWildsCall(list, last, rand) {
  if (!list.length) return null;
  let pool = list.length > 1 ? list.filter((c) => c.id !== last) : list;
  const c = pool[Math.floor(rand() * pool.length) % pool.length];
  return { id: c.id, vol: Math.round((0.22 + rand() * 0.3) * 100) / 100, pan: Math.round((rand() * 1.6 - 0.8) * 100) / 100, rate: Math.round((0.95 + rand() * 0.1) * 1000) / 1000 };
}

// The bed's two volumes for this much daylight (0 night .. 1 day) and this height above the ground.
export function wildsBedVolumes(light, alt) {
  const lift = 1 - Math.max(0, Math.min(1, (alt || 0) / WS_FLY_FADE));
  const L = Math.max(0, Math.min(1, light));
  return { day: Math.round(WILDS_BED.vol * L * lift * 1000) / 1000, night: Math.round(WILDS_BED.vol * (1 - L) * lift * 1000) / 1000 };
}

export default function createWildsSoundscape({ inWilds, getDayNight, getSeason, getAlt, have, playSfx, startSfxLoop, setSfxLoopVol, stopSfxLoop, rand = Math.random }) {
  const on = { day: false, night: false };
  let nextCallAt = 0, last = null, checkAt = 0, lastNightProgress = null;
  function bed(which, vol) {
    const id = WILDS_BED[which];
    if (vol > 0.005) {
      if (!on[which]) { on[which] = true; startSfxLoop(id, vol, 3); } else setSfxLoopVol(id, vol, 1.2);
    } else if (on[which]) { on[which] = false; stopSfxLoop(id, 3); }
  }
  function tick(now) {
    if (now < checkAt) return;
    checkAt = now + 500;
    if (!inWilds()) {
      bed('day', 0); bed('night', 0); nextCallAt = 0; lastNightProgress = null;
      return;
    }
    const dn = getDayNight() || {}, v = wildsBedVolumes(dn.lightAmount == null ? 1 : dn.lightAmount, getAlt ? getAlt() : 0);
    bed('day', v.day); bed('night', v.night);
    // the village bell, once, as the night turns at midnight
    const np = dn.isNight ? dn.nightProgress : null;
    if (np != null && lastNightProgress != null && lastNightProgress < 0.5 && np >= 0.5 && have(WILDS_MIDNIGHT_BELL)) playSfx(WILDS_MIDNIGHT_BELL, 0.45, 1, (rand() - 0.5) * 0.6);
    lastNightProgress = np;
    // a call now and then; the first a little while after she comes out
    if (!nextCallAt) { nextCallAt = now + 8000 + rand() * 12000; return; }
    if (now < nextCallAt) return;
    nextCallAt = now + WILDS_CALL_GAP[0] + rand() * (WILDS_CALL_GAP[1] - WILDS_CALL_GAP[0]);
    if ((getAlt ? getAlt() : 0) > WS_FLY_FADE) return;          // up in the high wind nothing on the ground is heard
    const c = pickWildsCall(wildsCallsNow(dn.isNight, getSeason ? getSeason() : null, have), last, rand);
    if (!c) return;
    last = c.id;
    playSfx(c.id, c.vol, c.rate, c.pan);
  }
  return { tick };
}
