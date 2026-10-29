// Event calendar (Session L) — tournament / festival / blood-moon time windows,
// all pure UTC math over `now`. Extracted to lib/ in Tier 3.4 Phase B. Cycle +
// legendary-week constants and legendaryWeekIndex are injected; the FESTIVAL_*/
// BLOOD_MOON_* effect multipliers stay in server.js (applied by gameplay).
module.exports = function createCalendar({ CYCLE_MS, DAY_MS, LEGENDARY_EPOCH, LEGENDARY_WEEK_MS, legendaryWeekIndex, SABBATS, MOON_PHASES, FULL_MOON_INDEX, LUNAR_MONTH_MS }) {
  // ── The event calendar ───────────────────────────────────────────────────────
  // "Three beats is a rhythm": Peddler Monday (existing) + the Weekend Hunt
  // Tournament + the monthly Hearthmoon Festival — plus the Blood Moon, a
  // recurring twisted-rules night. All pure UTC math over Date.now(): no cron,
  // no stored schedule, every restart and every client agrees.
  //
  //  - Tournament: Friday 18:00 UTC → Sunday 24:00 UTC, every week. Hunt kills
  //    made inside the window score the 'tourney' board; top three take gold
  //    and an honors entry when the week settles.
  //  - Hearthmoon Festival: the first Saturday of each month, 00:00–24:00 UTC.
  //    +25% XP and +15% bonus-forage chance for everyone, all day.
  //  - Blood Moon: every 13th night of the 40-minute day/night cycle. The moon
  //    rises red, night creatures hit ~25% harder and give +50% XP, and any
  //    night kill can shake loose a 🩸 Bloodmoon Shard — five craft a circlet.
  function tourneyWindow(now) {
    const DAY = 24 * 3600 * 1000;
    const weekStart = LEGENDARY_EPOCH + legendaryWeekIndex(now) * LEGENDARY_WEEK_MS; // Monday 00:00 UTC
    const startsAt = weekStart + 4 * DAY + 18 * 3600 * 1000; // Friday 18:00 UTC
    const endsAt = weekStart + 7 * DAY;                      // Sunday 24:00 UTC
    return { active: now >= startsAt && now < endsAt, startsAt, endsAt };
  }
  function festivalWindow(now) {
    const d = new Date(now);
    const firstSaturday = (y, mo) => {
      const first = Date.UTC(y, mo, 1);
      const dow = new Date(first).getUTCDay(); // 0 Sun … 6 Sat
      return first + ((6 - dow + 7) % 7) * 24 * 3600 * 1000;
    };
    let start = firstSaturday(d.getUTCFullYear(), d.getUTCMonth());
    let end = start + 24 * 3600 * 1000;
    if (now >= end) { // this month's already passed — report next month's
      const nextMo = d.getUTCMonth() + 1;
      start = firstSaturday(d.getUTCFullYear() + (nextMo > 11 ? 1 : 0), nextMo % 12);
      end = start + 24 * 3600 * 1000;
    }
    return { active: now >= start && now < end, startsAt: start, endsAt: end, name: 'The Hearthmoon Festival' };
  }

  const BLOOD_MOON_EVERY_NIGHTS = 13;
  function nightIndex(now) { return Math.floor(now / CYCLE_MS); }
  function bloodMoonWindow(now) {
    const idx = nightIndex(now);
    const isBloodNight = (idx % BLOOD_MOON_EVERY_NIGHTS) === 0;
    const nightStartsAt = idx * CYCLE_MS + DAY_MS;
    const nightEndsAt = (idx + 1) * CYCLE_MS;
    const active = isBloodNight && now >= nightStartsAt && now < nightEndsAt;
    // Next blood-moon night rise, for countdowns.
    let nextIdx = idx + ((idx % BLOOD_MOON_EVERY_NIGHTS) === 0 && now < nightEndsAt ? 0 : BLOOD_MOON_EVERY_NIGHTS - (idx % BLOOD_MOON_EVERY_NIGHTS || BLOOD_MOON_EVERY_NIGHTS));
    if ((idx % BLOOD_MOON_EVERY_NIGHTS) === 0 && now >= nightEndsAt) nextIdx = idx + BLOOD_MOON_EVERY_NIGHTS;
    return { active, nextRiseAt: nextIdx * CYCLE_MS + DAY_MS, endsAt: nightEndsAt };
  }
  function bloodMoonActive() { return bloodMoonWindow(Date.now()).active; }

  // ── The Moon ────────────────────────────────────────────────────────────────
  // Eight phases (data/moon.js) on a compressed lunar month. The live phase is
  // derived purely from the wall clock: slice the month into one window per
  // phase and read which window `now` falls in. Pure UTC math anchored at the
  // Unix epoch — no stored schedule, same spirit as the other windows.
  //
  // LUNAR_MONTH_MS is the full-cycle length (injected, tunable). It is
  // deliberately NOT a divisor of 24h, so the full moon drifts across the time
  // of day instead of always landing at the same wall-clock hour — a player who
  // only logs in at one time of day still sweeps every phase over a few days.
  //
  // Reconcile with the blood moon: the town already treats the blood moon as
  // "the full moon" in fiction. A blood-moon night therefore OVERRIDES the live
  // phase to a Blood (full) Moon — the rare, dangerous full moon — while the
  // ordinary full moon (phase index === FULL_MOON_INDEX) stays the common one.
  // One moon, two tiers.
  const _MOON = (MOON_PHASES && MOON_PHASES.length) ? MOON_PHASES : [{ key: 'full', name: 'Full Moon', glyph: '🌕', intention: '', blurb: '', effects: {} }];
  const _FULL_IDX = (FULL_MOON_INDEX != null) ? FULL_MOON_INDEX : 0;
  const _LUNAR_MS = LUNAR_MONTH_MS || (20 * 3600 * 1000);
  function moonPhaseWindow(now) {
    now = now != null ? now : Date.now();
    const n = _MOON.length;
    const phaseMs = _LUNAR_MS / n;
    const win = Math.floor(now / phaseMs);          // absolute phase-window index
    const clockIdx = ((win % n) + n) % n;           // which of the n phases, from the clock
    const blood = bloodMoonWindow(now).active;
    let idx = clockIdx, p = _MOON[clockIdx];
    if (blood) { idx = _FULL_IDX; p = _MOON[_FULL_IDX]; }
    else if (process.env.TC_MOON) {                 // QA/dev override, like TC_SEASON
      const f = _MOON.find((x) => x.key === process.env.TC_MOON);
      if (f) { p = f; idx = _MOON.indexOf(f); }
    }
    const isFull = idx === _FULL_IDX;
    // Next ordinary full-moon rise, for countdowns (blood moons have their own).
    const ahead = (_FULL_IDX - clockIdx + n) % n;
    return {
      key: p.key, name: p.name, glyph: blood ? '🔴' : p.glyph,
      intention: p.intention, blurb: p.blurb, effects: p.effects || {},
      index: idx, isFull, isBlood: blood, chargesMoonWater: isFull,
      startsAt: win * phaseMs, endsAt: (win + 1) * phaseMs,
      nextFullAt: (win + ahead) * phaseMs
    };
  }
  function moonPhaseActive() { return moonPhaseWindow(Date.now()); }

  // ── The Wheel of the Year ──────────────────────────────────────────────────
  // Eight sabbats (data/seasons.js), each opening a season that runs until the
  // next sabbat begins. Pure date math: build every sabbat's start for the
  // previous / current / next year, sort them, and the live season is the latest
  // start that isn't in the future (endsAt = the following start). This makes the
  // wheel wrap cleanly across the New Year (Yule → Imbolc) and repeat every year
  // with no stored schedule — same spirit as the festival + blood-moon windows.
  function seasonStarts(now) {
    const y = new Date(now).getUTCFullYear();
    const out = [];
    for (const yy of [y - 1, y, y + 1]) {
      for (const s of (SABBATS || [])) out.push({ s, t: Date.UTC(yy, s.month - 1, s.day) });
    }
    out.sort((a, b) => a.t - b.t);
    return out;
  }
  function seasonWindow(now) {
    now = now != null ? now : Date.now();
    const starts = seasonStarts(now);
    if (!starts.length) return null;
    let i = 0;
    for (let k = 0; k < starts.length; k++) { if (starts[k].t <= now) i = k; }
    const cur = starts[i];
    const next = starts[Math.min(i + 1, starts.length - 1)];
    let s = cur.s;
    // QA / dev override: TC_SEASON=<key> forces a sabbat so its effects can be
    // playtested out of season (the seasonal analogue of ?gfx= for graphics).
    // Only swaps the sabbat identity + effects; the real window timestamps are
    // kept. Unset in production, and unset during tests, so nothing is affected.
    // Gameplay effects fire ONLY on the sabbat's actual date (cur.t is that
    // day's 00:00 UTC) — a full UTC calendar day — not across the whole season
    // window. The name/epithet/blurb/blessing still show all season for flavor.
    let onDay = now >= cur.t && now < cur.t + 24 * 3600 * 1000;
    if (process.env.TC_SEASON) {
      const forced = (SABBATS || []).find((x) => x.key === process.env.TC_SEASON);
      if (forced) { s = forced; onDay = true; } // forced season = effects on, for playtest
    }
    return {
      key: s.key, name: s.name, epithet: s.epithet, glyph: s.glyph,
      blurb: s.blurb, blessing: s.blessing,
      effects: onDay ? s.effects : {}, // only the sabbat day carries the blessing
      isSabbatDay: onDay,
      startsAt: cur.t, endsAt: next.t
    };
  }

  function calendarPublicState(now) {
    now = now != null ? now : Date.now();
    const t = tourneyWindow(now), f = festivalWindow(now), bm = bloodMoonWindow(now);
    return {
      now,
      tourney: t,
      festival: f,
      bloodMoon: bm,
      season: seasonWindow(now),
      moon: moonPhaseWindow(now),
      peddlerNextRotationAt: LEGENDARY_EPOCH + (legendaryWeekIndex(now) + 1) * LEGENDARY_WEEK_MS
    };
  }

  return { tourneyWindow, festivalWindow, bloodMoonWindow, bloodMoonActive, seasonWindow, moonPhaseWindow, moonPhaseActive, calendarPublicState, BLOOD_MOON_EVERY_NIGHTS };
};
