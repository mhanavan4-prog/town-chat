// ---------------------------------------------------------------------------
// The Wild Hunt (data/wildHunt.js). One course of horn-rings a night over the
// Wilds, the same for everyone that night; each rider's place in it is her own.
//
//   course(nightId)        -> [{ x, y, alt }, ...]   (the same for a given night)
//   state(player)          -> what the client is told (null if she has no besom)
//   at(player)             -> call when she moves or changes height; true if she passed a ring
//   tick()                 -> call now and then: sounds the horn at nightfall, clears at dawn
// ---------------------------------------------------------------------------
const { HUNT, HUNT_LORE, HUNT_WAKES, COMPANY, COMPANY_LORE } = require('../data/wildHunt');

module.exports = function createWildHunt({ players, send, isNight, nightId, hasBesom, accountOf, grantTitle = () => {}, save = () => {}, width = 10000, height = 10000, now = () => Date.now(),
  covenOf = () => null, saveCoven = () => {}, covenTell = () => {} }) {   // covenOf(player) -> the coven object (id, name, members) or null
  // A small seeded generator, so a night's course is the same on every call and after a restart.
  function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  const courses = new Map();
  function course(id) {
    if (courses.has(id)) return courses.get(id);
    const r = rng((id + 1) * 2654435761);
    const lo = HUNT.margin, hiX = width - HUNT.margin, hiY = height - HUNT.margin;
    const out = [];
    let x = lo + r() * (hiX - lo), y = lo + r() * (hiY - lo), alt = HUNT.minAlt + r() * (HUNT.maxAlt - HUNT.minAlt);
    let heading = r() * Math.PI * 2;
    for (let i = 0; i < HUNT.rings; i++) {
      out.push({ x: Math.round(x), y: Math.round(y), alt: Math.round(alt) });
      // the next: on a little, turning, rising or falling, and turned back in at the edges
      for (let tries = 0; tries < 8; tries++) {
        const h = heading + (r() - 0.5) * 1.6, d = HUNT.stride[0] + r() * (HUNT.stride[1] - HUNT.stride[0]);
        const nx = x + Math.cos(h) * d, ny = y + Math.sin(h) * d;
        if (nx > lo && nx < hiX && ny > lo && ny < hiY) { x = nx; y = ny; heading = h; break; }
        heading += Math.PI / 2;
        if (tries === 7) { x = Math.max(lo, Math.min(hiX, nx)); y = Math.max(lo, Math.min(hiY, ny)); }
      }
      alt = Math.max(HUNT.minAlt, Math.min(HUNT.maxAlt, alt + (r() - 0.5) * 420));
    }
    courses.set(id, out);
    if (courses.size > 4) courses.delete(courses.keys().next().value);
    return out;
  }

  // What is kept on the account: nights ridden, the last night finished, the best time, the wake worn.
  function kept(player) {
    const a = accountOf(player);
    if (!a) return null;
    if (!a.hunt || typeof a.hunt !== 'object') a.hunt = { nights: 0, lastNight: -1, best: null, wake: null };
    return a.hunt;
  }
  const rankFor = (nights) => HUNT.ranks.filter((k) => nights >= k.nights);
  const wakesFor = (nights) => rankFor(nights).map((k) => k.wake);

  // Her run tonight is kept here by who she is, not on her connection, so a dropped connection (or a restart
  // she comes back from) does not cost her the horns she has ridden. It is gone at dawn.
  const runs = new Map();
  const whoIs = (player) => (player.accountKey ? 'a:' + player.accountKey : 'g:' + String(player.name || player.id));
  function run(player) {
    const id = nightId(), who = whoIs(player);
    let r = runs.get(who);
    if (!r || r.night !== id) { r = { night: id, next: 0, startedAt: 0 }; runs.set(who, r); }
    return r;
  }

  function state(player) {
    if (!hasBesom(player)) return null;
    const k = kept(player), night = isNight(), id = nightId();
    const cv = covenOf(player);
    const company = cv ? { coven: cv.name, nights: cv.huntNights || 0, tonight: (finishedBy.get(cv.id) && finishedBy.get(cv.id).night === id) ? finishedBy.get(cv.id).who.size : 0, needs: COMPANY.needs, lore: COMPANY_LORE } : { coven: null, needs: COMPANY.needs, lore: COMPANY_LORE };
    const base = { type: 'hunt_state', company, night, nights: k ? k.nights : 0, best: k ? k.best : null, wake: k ? k.wake : null, wakes: wakesFor(k ? k.nights : 0),
      nextRank: (HUNT.ranks.find((r) => r.nights > (k ? k.nights : 0)) || null), radius: HUNT.radius, reach: HUNT.reach, total: HUNT.rings, lore: HUNT_LORE, account: !!k };
    if (!night) return { ...base, rings: [], next: 0, done: false };
    const r = run(player), done = !!(k && k.lastNight === id) || r.next >= HUNT.rings;
    return { ...base, rings: course(id), next: done ? HUNT.rings : r.next, done };
  }
  const tell = (player, extra) => { const s = state(player); if (s && player.ws) send(player.ws, { ...s, ...(extra || {}) }); };

  // She has moved: is she through the ring that is hers to ride next?
  function at(player) {
    if (!player || !player.mounted || player.room !== 'wilds' || !isNight() || !hasBesom(player)) return false;
    const id = nightId(), k = kept(player);
    if (k && k.lastNight === id) return false;
    const r = run(player);
    if (r.next >= HUNT.rings) return false;
    const ring = course(id)[r.next];
    const alt = Number(player.besomAlt) || 0;
    if (Math.hypot(player.x - ring.x, player.y - ring.y) > HUNT.radius || Math.abs(alt - ring.alt) > HUNT.reach) return false;
    const passedIndex = r.next;
    pass(player, r, k, id, null);
    // The night company: the horn counts for every one of her coven riding close who was after the same horn.
    const cv = covenOf(player);
    if (cv) {
      for (const q of players.values()) {
        if (!q || q === player || !q.mounted || q.room !== 'wilds' || !hasBesom(q)) continue;
        const qc = covenOf(q);
        if (!qc || qc.id !== cv.id || Math.hypot(q.x - player.x, q.y - player.y) > COMPANY.reach) continue;
        const qk = kept(q);
        if (qk && qk.lastNight === id) continue;
        const qr = run(q);
        if (qr.next !== passedIndex) continue;
        pass(q, qr, qk, id, player.name);
      }
    }
    return true;
  }

  // One rider through one horn (her own riding, or her coven's beside her).
  const finishedBy = new Map();   // covenId -> { night, who: Set(accountKey) }
  function pass(player, r, k, id, withName) {
    if (r.next === 0) r.startedAt = now();
    r.next++;
    if (r.next < HUNT.rings) { tell(player, { passed: r.next, sfx: 'hunt_horn', ...(withName ? { message: `📯 ${withName} rode through the horn, and it counts for you beside her.` } : {}) }); return true; }
    // the last horn: she has ridden with the Hunt tonight
    const secs = Math.max(1, Math.round((now() - r.startedAt) / 1000));
    let message = `🐎 You have ridden with the Wild Hunt. ${HUNT.rings} horns in ${Math.floor(secs / 60)}m ${secs % 60}s.`;
    const gained = [];
    if (k) {
      const before = rankFor(k.nights).length;
      k.nights++; k.lastNight = id;
      if (k.best == null || secs < k.best) k.best = secs;
      for (const rank of rankFor(k.nights).slice(before)) { grantTitle(player, rank.title); gained.push(rank); if (!k.wake) k.wake = rank.wake; }
      if (gained.length) message += ` The ${HUNT_WAKES[gained[gained.length - 1].wake].name.toLowerCase()} is yours to trail behind the besom.`;
      else { const nx = HUNT.ranks.find((x) => x.nights > k.nights); if (nx) message += ` ${nx.nights - k.nights} more night${nx.nights - k.nights === 1 ? '' : 's'} to the next honour.`; }
      save();
    } else {
      message += ' A guest\'s ride is not kept: make an account and the nights are counted.';
    }
    tell(player, { passed: HUNT.rings, finished: true, secs, message, sfx: 'hunt_done' });
    // Two or more of a coven finishing the same night: the coven has ridden in company.
    const cv = k ? covenOf(player) : null;
    if (cv) {
      let f = finishedBy.get(cv.id);
      if (!f || f.night !== id) { f = { night: id, who: new Set(), counted: false }; finishedBy.set(cv.id, f); }
      f.who.add(player.accountKey);
      if (f.who.size >= COMPANY.needs) {
        if (!f.counted) {
          f.counted = true;
          cv.huntNights = (cv.huntNights || 0) + 1; saveCoven(cv.id);
          covenTell(cv, `🌙 ${cv.name} rode with the Wild Hunt in company tonight. Nights ridden together: ${cv.huntNights}.`);
          for (const key of f.who) { const q = [...players.values()].find((x) => x.accountKey === key); if (q) grantTitle(q, COMPANY.title); else noteTitle(key, COMPANY.title); }
        } else grantTitle(player, COMPANY.title);
      }
    }
    return true;
  }
  // A title for someone of the company who has gone before the second finished: kept for her.
  function noteTitle(key, title) { try { grantTitle({ accountKey: key, ws: null }, title); } catch (e) { /* she will have it the next night she rides in company */ } }

  // Choose which wake she trails (one she has earned, or none).
  function setWake(player, wake) {
    const k = kept(player);
    if (!k) return { error: 'The wake is kept on an account.' };
    if (wake && !wakesFor(k.nights).includes(wake)) return { error: 'That wake is not yours yet.' };
    k.wake = wake || null; save();
    tell(player);
    return { ok: true };
  }
  const wakeOf = (player) => { const a = accountOf(player); return (a && a.hunt && a.hunt.wake) || null; };

  // Nightfall and dawn: those with the besom are told once at each.
  let wasNight = null;
  function tick() {
    const night = isNight();
    if (wasNight === null) { wasNight = night; return; }
    if (night === wasNight) return;
    wasNight = night;
    if (!night) runs.clear();
    for (const p of players.values()) {
      if (!p || !p.ws || !hasBesom(p)) continue;
      tell(p, night ? { message: '📯 Horns in the sky over the Wilds. The Wild Hunt rides tonight: follow the horns on your besom.', sfx: 'hunt_horn' } : null);
    }
  }

  return { HUNT, course, state, at, tick, setWake, wakeOf, tell };
};
