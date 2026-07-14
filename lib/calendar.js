// Event calendar (Session L) — tournament / festival / blood-moon time windows,
// all pure UTC math over `now`. Extracted to lib/ in Tier 3.4 Phase B. Cycle +
// legendary-week constants and legendaryWeekIndex are injected; the FESTIVAL_*/
// BLOOD_MOON_* effect multipliers stay in server.js (applied by gameplay).
module.exports = function createCalendar({ CYCLE_MS, DAY_MS, LEGENDARY_EPOCH, LEGENDARY_WEEK_MS, legendaryWeekIndex }) {
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

  function calendarPublicState(now) {
    now = now != null ? now : Date.now();
    const t = tourneyWindow(now), f = festivalWindow(now), bm = bloodMoonWindow(now);
    return {
      now,
      tourney: t,
      festival: f,
      bloodMoon: bm,
      peddlerNextRotationAt: LEGENDARY_EPOCH + (legendaryWeekIndex(now) + 1) * LEGENDARY_WEEK_MS
    };
  }

  return { tourneyWindow, festivalWindow, bloodMoonWindow, bloodMoonActive, calendarPublicState, BLOOD_MOON_EVERY_NIGHTS };
};
