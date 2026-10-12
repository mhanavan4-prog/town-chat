// Coven Rites engine (pure logic + client payload) — the seasonal, coven-only
// questline. Content lives in data/rites.js; this module owns the lifecycle:
// rotate at each sabbat boundary, scale targets to coven size, bank cumulative
// contributions with per-member caps + distinct-contributor rules, gate phases
// on a real-time attunement clock, detect completion, carry a coven season
// buff, and expire-with-consolation at the sabbat's end.
//
// No I/O here. The server injects the data tables and a `now`; it persists
// cv.rite itself (saveCoven) and grants the actual XP/gold/buff from the values
// this module returns. That keeps every rule deterministically testable.

module.exports = function createRites(deps) {
  const {
    RITES, RITE_MEMBER_FLOOR = 2, RITE_MEMBER_CAP = 8, RITE_CONSOLATION_FRACTION = 0.25
  } = deps;
  const HOUR_MS = 3600 * 1000;

  function riteDataFor(seasonKey) { return (RITES && RITES[seasonKey]) || null; }
  function clampScale(n) { return Math.max(RITE_MEMBER_FLOOR, Math.min(RITE_MEMBER_CAP, n | 0)); }

  function targetFor(obj, scale) { return Math.max(1, Math.round(obj.base + obj.perMember * scale)); }
  function perMemberCap(obj, scale) {
    const t = targetFor(obj, scale);
    return Math.max(1, Math.ceil(t * (obj.maxShare != null ? obj.maxShare : 1)));
  }
  function candleTarget(phase, scale) {
    const raw = Math.round((phase.candleBase || 2) + (phase.candlePerMember || 0) * scale);
    return Math.max(2, Math.min(scale, raw));
  }

  // ── Build a fresh Rite for a coven at a sabbat start ───────────────────────
  function newRite(data, season, memberCount, now) {
    if (!data) {
      // No Rite authored for this sabbat yet — a dormant marker so we don't keep
      // rebuilding it, and the client can say "no rite this season".
      return { none: true, seasonKey: season.key, startsAt: season.startsAt, endsAt: season.endsAt };
    }
    const scale = clampScale(memberCount);
    return {
      riteId: data.id, seasonKey: data.seasonKey,
      startsAt: season.startsAt, endsAt: season.endsAt,
      startedAt: now, memberScale: scale,
      phases: data.phases.map((ph, i) => ({
        id: ph.id,
        unlockedAt: i === 0 ? now : null,  // first phase opens immediately
        completedAt: null,
        progress: {},                      // objKey -> amount (objective phases)
        contributors: {},                  // accountKey -> { objKey: amount }
        candles: {}                        // accountKey -> ts (candle phase)
      })),
      completedAt: null, expiredAt: null,
      rewardedKeys: [], consolationGiven: false,
      seasonBuff: null
    };
  }

  // Lazily open any gated phase whose attunement time has elapsed. A phase opens
  // `gateHours` after the PREVIOUS phase completed, so the clock only advances as
  // the coven makes progress. Mutates rite.phases[i].unlockedAt. Returns rite.
  function refreshUnlocks(data, rite, now) {
    if (!data || rite.none) return rite;
    for (let i = 1; i < rite.phases.length; i++) {
      const ph = rite.phases[i];
      if (ph.unlockedAt != null) continue;
      const prev = rite.phases[i - 1];
      if (!prev.completedAt) break;              // earlier phase not done -> locked
      const gateMs = (data.phases[i].gateHours || 0) * HOUR_MS;
      if (now >= prev.completedAt + gateMs) ph.unlockedAt = prev.completedAt + gateMs;
      else break;                                 // still attuning; later phases wait too
    }
    return rite;
  }

  function phaseUnlocked(rite, i, now) {
    const ph = rite.phases[i];
    return !!(ph && ph.unlockedAt != null && now >= ph.unlockedAt && !ph.completedAt);
  }
  // The single phase that accepts contributions right now (earliest open, unfinished).
  function activePhaseIndex(data, rite, now) {
    if (!data || rite.none || rite.completedAt || rite.expiredAt) return -1;
    refreshUnlocks(data, rite, now);
    for (let i = 0; i < rite.phases.length; i++) {
      if (!rite.phases[i].completedAt && phaseUnlocked(rite, i, now)) return i;
    }
    return -1;
  }

  function distinctContributors(ph) {
    const keys = new Set(Object.keys(ph.contributors || {}));
    for (const k of Object.keys(ph.candles || {})) keys.add(k);
    return keys.size;
  }

  function objectivesMet(data, rite, i) {
    const def = data.phases[i];
    if (def.candles) {
      return distinctContributors(rite.phases[i]) >= candleTarget(def, rite.memberScale);
    }
    return (def.objectives || []).every(o =>
      (rite.phases[i].progress[o.key] || 0) >= targetFor(o, rite.memberScale));
  }

  function tryCompletePhase(data, rite, i, now) {
    const def = data.phases[i], ph = rite.phases[i];
    if (ph.completedAt) return false;
    if (!objectivesMet(data, rite, i)) return false;
    const minC = def.candles ? candleTarget(def, rite.memberScale) : (def.minContributors || 1);
    if (distinctContributors(ph) < minC) return false;
    ph.completedAt = now;
    // Last phase done -> whole Rite complete; mint the coven season buff.
    if (rite.phases.every(p => p.completedAt)) {
      rite.completedAt = now;
      if (data.seasonBuff) {
        const season = (deps.seasonEffects && deps.seasonEffects(rite.seasonKey)) || {};
        rite.seasonBuff = { seasonKey: rite.seasonKey, endsAt: rite.endsAt, effects: season };
      }
    }
    return true;
  }

  // ── Bank a cumulative contribution (kills/harvests) toward the active phase ─
  // Returns what actually happened so the server can notify + grant on completion.
  function contribute(data, rite, accountKey, kind, match, amount, now) {
    const res = { credited: 0, objKey: null, phaseId: null, phaseCompleted: false, riteCompleted: false };
    if (!data || rite.none || rite.completedAt || rite.expiredAt) return res;
    const i = activePhaseIndex(data, rite, now);
    if (i < 0) return res;
    const def = data.phases[i];
    if (def.candles) return res;                 // candle phase is lit, not farmed
    const obj = (def.objectives || []).find(o => o.kind === kind && o.match === match);
    if (!obj) return res;
    const ph = rite.phases[i];
    const target = targetFor(obj, rite.memberScale);
    const already = ph.progress[obj.key] || 0;
    if (already >= target) return res;
    const cap = perMemberCap(obj, rite.memberScale);
    const mine = (ph.contributors[accountKey] && ph.contributors[accountKey][obj.key]) || 0;
    const room = Math.min(target - already, cap - mine, Math.max(0, amount | 0));
    if (room <= 0) return res;
    ph.progress[obj.key] = already + room;
    ph.contributors[accountKey] = ph.contributors[accountKey] || {};
    ph.contributors[accountKey][obj.key] = mine + room;
    res.credited = room; res.objKey = obj.key; res.phaseId = def.id;
    res.progress = ph.progress[obj.key]; res.target = target;
    if (tryCompletePhase(data, rite, i, now)) {
      res.phaseCompleted = true;
      res.riteCompleted = !!rite.completedAt;
    }
    return res;
  }

  // ── Light a candle (the distinct-contributor "Light the Watch" phase) ──────
  function lightCandle(data, rite, accountKey, now) {
    const res = { lit: false, already: false, phaseCompleted: false, riteCompleted: false, count: 0, target: 0, reason: null };
    if (!data || rite.none || rite.completedAt || rite.expiredAt) { res.reason = 'inactive'; return res; }
    const i = activePhaseIndex(data, rite, now);
    const def = i >= 0 ? data.phases[i] : null;
    if (!def || !def.candles) { res.reason = 'not_now'; return res; }
    const ph = rite.phases[i];
    res.target = candleTarget(def, rite.memberScale);
    if (ph.candles[accountKey]) { res.already = true; res.count = distinctContributors(ph); return res; }
    ph.candles[accountKey] = now;
    res.lit = true; res.count = distinctContributors(ph);
    if (tryCompletePhase(data, rite, i, now)) {
      res.phaseCompleted = true;
      res.riteCompleted = !!rite.completedAt;
    }
    return res;
  }

  // Fraction of the whole Rite actually accomplished (0..1), averaged across
  // phases — a completed phase counts 1, a partial phase counts its objective
  // fill ratio. Used so consolation rewards real effort, not just whole phases.
  function riteProgressFraction(data, rite) {
    if (!data || !rite || !rite.phases || !rite.phases.length) return 0;
    let sum = 0;
    for (let i = 0; i < rite.phases.length; i++) {
      const def = data.phases[i], ph = rite.phases[i];
      if (ph.completedAt) { sum += 1; continue; }
      if (def.candles) {
        sum += Math.min(1, distinctContributors(ph) / Math.max(1, candleTarget(def, rite.memberScale)));
      } else {
        const objs = def.objectives || [];
        let f = 0;
        for (const o of objs) f += Math.min(1, (ph.progress[o.key] || 0) / Math.max(1, targetFor(o, rite.memberScale)));
        sum += objs.length ? f / objs.length : 0;
      }
    }
    return sum / rite.phases.length;
  }

  function contributorKeys(rite) {
    const keys = new Set();
    for (const ph of rite.phases || []) {
      for (const k of Object.keys(ph.contributors || {})) keys.add(k);
      for (const k of Object.keys(ph.candles || {})) keys.add(k);
    }
    return [...keys];
  }
  function phasesCompletedCount(rite) { return (rite.phases || []).filter(p => p.completedAt).length; }

  function individualReward(data, rite) {
    const r = data.reward || {};
    const titleId = r.titleId || null;
    return {
      xp: Math.round((r.xpBase || 0) + (r.xpPerMember || 0) * rite.memberScale),
      gold: Math.round((r.goldBase || 0) + (r.goldPerMember || 0) * rite.memberScale),
      titleId,
      title: titleId && deps.titleName ? deps.titleName(titleId) : titleId
    };
  }

  // Season boundary: if the Rite is unfinished when the sabbat ends, expire it
  // and compute a per-contributor consolation (a fraction, times the share of
  // phases completed). Idempotent via consolationGiven. Returns the grants.
  function expireIfEnded(data, rite, now) {
    const out = { expired: false, consolation: [] };
    if (!data || rite.none || rite.completedAt || rite.expiredAt) return out;
    if (now < rite.endsAt) return out;
    rite.expiredAt = now;
    out.expired = true;
    if (!rite.consolationGiven) {
      const share = riteProgressFraction(data, rite);
      if (share > 0) {
        const full = individualReward(data, rite);
        const xp = Math.round(full.xp * RITE_CONSOLATION_FRACTION * share);
        const gold = Math.round(full.gold * RITE_CONSOLATION_FRACTION * share);
        if (xp > 0 || gold > 0) {
          for (const key of contributorKeys(rite)) out.consolation.push({ key, xp, gold });
        }
      }
      rite.consolationGiven = true;
    }
    return out;
  }

  // Rotate a coven onto the current season's Rite when the sabbat turns over.
  // Returns { rotated, prevRite } so the server can hand the previous (unfinished)
  // Rite to expireIfEnded for consolation before it's replaced.
  function ensureRite(cv, season, memberCount, now) {
    const data = riteDataFor(season.key);
    const existing = cv.rite;
    if (existing && existing.startsAt === season.startsAt) {
      if (!existing.none) refreshUnlocks(data, existing, now);
      return { rotated: false, rite: existing, prevRite: null, data };
    }
    const prevRite = existing && !existing.none ? existing : null;
    cv.rite = newRite(data, season, memberCount, now);
    return { rotated: true, rite: cv.rite, prevRite, data };
  }

  // The coven's currently-active earned season buff (for grantXP etc.), or null.
  function activeSeasonBuff(cv, now) {
    const r = cv && cv.rite;
    if (r && r.seasonBuff && now < r.seasonBuff.endsAt) return r.seasonBuff.effects || null;
    return null;
  }

  // ── Client payload for the coven Rite panel ────────────────────────────────
  function riteStatePayload(cv, now, opts) {
    opts = opts || {};
    const r = cv && cv.rite;
    if (!r) return { rite: null };
    if (r.none) {
      return { rite: { none: true, seasonKey: r.seasonKey } };
    }
    const data = riteDataFor(r.seasonKey);
    if (!data) return { rite: { none: true, seasonKey: r.seasonKey } };
    refreshUnlocks(data, r, now);
    const activeIdx = activePhaseIndex(data, r, now);
    const phases = data.phases.map((def, i) => {
      const ph = r.phases[i];
      const base = {
        id: def.id, title: def.title, glyph: def.glyph, blurb: def.blurb,
        unlocked: ph.unlockedAt != null && now >= ph.unlockedAt,
        unlockAt: ph.unlockedAt,
        completed: !!ph.completedAt,
        active: i === activeIdx,
        distinct: distinctContributors(ph)
      };
      if (def.candles) {
        base.candle = {
          count: distinctContributors(ph),
          target: candleTarget(def, r.memberScale),
          youLit: !!(opts.viewerKey && ph.candles[opts.viewerKey]),
          label: def.label
        };
        base.minContributors = candleTarget(def, r.memberScale);
      } else {
        base.objectives = (def.objectives || []).map(o => ({
          key: o.key, label: o.label,
          progress: ph.progress[o.key] || 0,
          target: targetFor(o, r.memberScale)
        }));
        base.minContributors = def.minContributors || 1;
      }
      return base;
    });
    // Next gate countdown, if the active-but-locked next phase is attuning.
    let nextGateAt = null;
    for (let i = 0; i < r.phases.length; i++) {
      if (!r.phases[i].completedAt && r.phases[i].unlockedAt == null && i > 0 && r.phases[i - 1].completedAt) {
        nextGateAt = r.phases[i - 1].completedAt + (data.phases[i].gateHours || 0) * HOUR_MS;
        break;
      }
    }
    return {
      rite: {
        riteId: r.riteId, seasonKey: r.seasonKey, name: data.name, glyph: data.glyph, blurb: data.blurb,
        memberScale: r.memberScale,
        startsAt: r.startsAt, endsAt: r.endsAt,
        completed: !!r.completedAt, expired: !!r.expiredAt,
        buffActive: !!activeSeasonBuff(cv, now),
        reward: individualReward(data, r),
        locked: !!opts.locked, lockReason: opts.lockReason || null,
        nextGateAt,
        phases
      }
    };
  }

  return {
    riteDataFor, clampScale, targetFor, perMemberCap, candleTarget,
    newRite, ensureRite, refreshUnlocks, activePhaseIndex, phaseUnlocked,
    contribute, lightCandle, expireIfEnded, activeSeasonBuff,
    contributorKeys, phasesCompletedCount, riteProgressFraction, individualReward, distinctContributors,
    riteStatePayload
  };
};
