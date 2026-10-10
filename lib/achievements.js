// Achievements / Collection Log (Session N) — a permanent, per-account trophy
// shelf built ENTIRELY on benign in-game tallies (kills, boss fells, Delve
// depth, pickpockets, harvests, photos, falls). It never touches the security
// / audit log or any identifying data — same privacy line the Hunter's Read
// holds. Lifetime counters live beside monstersSlain on the account object;
// unlock state lives in account.achievements = { <id>: unlockedAtMs }.
//
// Pure data + pure functions: no sockets, no persistence, no clock except the
// one the caller passes in, so the whole thing is trivially testable and the
// engine wires it with a couple of one-line bumps at existing event sites.

// Each category is one in-game pursuit with three escalating tiers. `stat` is
// the account counter the tier reads; `need` is the threshold to earn it.
// `kind:'max'` stats (Delve depth) store a high-water mark; everything else is
// a running count. Order here is the order the collection log renders.
const CATEGORIES = [
  { cat: 'Slayer',    stat: 'monstersSlain',       kind: 'count', icon: '⚔️',
    tiers: [
      { id: 'slayer_1', name: 'Blooded',        need: 25,   desc: 'Fell 25 creatures.' },
      { id: 'slayer_2', name: 'Bane of the Wilds', need: 250, desc: 'Fell 250 creatures.' },
      { id: 'slayer_3', name: 'Reaper of Thornreach', need: 1500, desc: 'Fell 1,500 creatures.' },
    ] },
  { cat: 'Boss-Breaker', stat: 'bossKills',        kind: 'count', icon: '👑',
    tiers: [
      { id: 'boss_1', name: 'Giant-Slayer',     need: 1,   desc: 'Bring down your first dungeon boss.' },
      { id: 'boss_2', name: 'Monument-Breaker', need: 25,  desc: 'Bring down 25 dungeon bosses.' },
      { id: 'boss_3', name: 'Throne of Skulls',  need: 100, desc: 'Bring down 100 dungeon bosses.' },
    ] },
  { cat: 'Delver',    stat: 'delveDeepest',        kind: 'max',   icon: '🕳️',
    tiers: [
      { id: 'delve_1', name: 'Threshold',       need: 3,  desc: 'Reach Delve floor 3.' },
      { id: 'delve_2', name: 'Deep Walker',     need: 7,  desc: 'Reach Delve floor 7.' },
      { id: 'delve_3', name: 'Into the Dark',   need: 12, desc: 'Reach Delve floor 12.' },
    ] },
  { cat: 'Cutpurse',  stat: 'pickpocketSuccesses', kind: 'count', icon: '🤌',
    tiers: [
      { id: 'purse_1', name: 'Light Fingers',   need: 5,   desc: 'Pick 5 pockets clean.' },
      { id: 'purse_2', name: 'Cutpurse',        need: 50,  desc: 'Pick 50 pockets clean.' },
      { id: 'purse_3', name: 'Ghost Hand',      need: 200, desc: 'Pick 200 pockets clean.' },
    ] },
  { cat: 'Forager',   stat: 'harvests',            kind: 'count', icon: '🌿',
    tiers: [
      { id: 'forage_1', name: 'Gatherer',       need: 20,  desc: 'Harvest 20 times from the land.' },
      { id: 'forage_2', name: 'Hedgewitch',     need: 150, desc: 'Harvest 150 times from the land.' },
      { id: 'forage_3', name: 'Rootlord',       need: 600, desc: 'Harvest 600 times from the land.' },
    ] },
  { cat: 'Shutterbug', stat: 'photosTaken',        kind: 'count', icon: '📷',
    tiers: [
      { id: 'photo_1', name: 'First Light',     need: 5,   desc: 'Take 5 snapshots of other players.' },
      { id: 'photo_2', name: 'Shutterbug',      need: 30,  desc: 'Take 30 snapshots of other players.' },
      { id: 'photo_3', name: 'Chronicler',      need: 100, desc: 'Take 100 snapshots of other players.' },
    ] },
  { cat: 'Survivor',  stat: 'deaths',              kind: 'count', icon: '💀',
    tiers: [
      { id: 'scars_1', name: 'Battle-Scarred',  need: 10,  desc: 'Fall in battle 10 times — and rise again.' },
      { id: 'scars_2', name: 'Unkillable',      need: 50,  desc: 'Fall 50 times and keep coming back.' },
      { id: 'scars_3', name: 'Deathless',       need: 200, desc: 'Fall 200 times. The dark cannot keep you.' },
    ] },
  { cat: 'Artificer', stat: 'itemsCrafted',        kind: 'count', icon: '🔨',
    tiers: [
      { id: 'craft_1', name: 'Apprentice',      need: 5,   desc: 'Craft 5 items at the Workshop.' },
      { id: 'craft_2', name: 'Artificer',       need: 40,  desc: 'Craft 40 items at the Workshop.' },
      { id: 'craft_3', name: 'Master Smith',    need: 150, desc: 'Craft 150 items at the Workshop.' },
    ] },
];

// Flattened, in render order. Each entry carries its category + icon so the
// log and the unlock toast need nothing else.
const ACHIEVEMENTS = [];
for (const c of CATEGORIES) {
  c.tiers.forEach((t, i) => {
    ACHIEVEMENTS.push({ id: t.id, cat: c.cat, icon: c.icon, name: t.name, desc: t.desc, stat: c.stat, kind: c.kind, need: t.need, tier: i + 1 });
  });
}
const ACH_BY_ID = new Map(ACHIEVEMENTS.map(a => [a.id, a]));
const TOTAL = ACHIEVEMENTS.length;

// Rare achievements earn a town-wide shout when claimed (not just a private
// toast) — the capstone of each ladder.
const BROADCAST_IDS = new Set(ACHIEVEMENTS.filter(a => a.tier === 3).map(a => a.id));

function statValue(account, stat) {
  const v = account && account[stat];
  return typeof v === 'number' && v > 0 ? v : 0;
}

// Record the account's high-water mark for a 'max' stat (Delve depth). Count
// stats are bumped at their event site directly; this is the one helper the
// engine calls for a max-kind stat so the achievement check has fresh data.
function noteMax(account, stat, value) {
  if (!account || !(value > 0)) return;
  if (!(account[stat] >= value)) account[stat] = value;
}

// Scan the catalog against the account's current tallies and claim any newly
// earned trophies. Mutates account.achievements (id -> unlockedAt) but does
// NOT persist — the caller owns the save. Returns the list of freshly unlocked
// achievements (each with a `broadcast` flag) so the engine can celebrate them.
function evaluate(account, now) {
  if (!account) return [];
  if (!account.achievements || typeof account.achievements !== 'object') account.achievements = {};
  const t = typeof now === 'number' ? now : Date.now();
  const earned = [];
  for (const a of ACHIEVEMENTS) {
    if (account.achievements[a.id]) continue;
    if (statValue(account, a.stat) >= a.need) {
      account.achievements[a.id] = t;
      earned.push({ id: a.id, cat: a.cat, icon: a.icon, name: a.name, desc: a.desc, broadcast: BROADCAST_IDS.has(a.id) });
    }
  }
  return earned;
}

// The full collection log for a UI: every achievement, locked or not, with the
// player's current progress toward it. Safe to call on a brand-new account.
function logView(account) {
  const unlocked = (account && account.achievements) || {};
  const out = ACHIEVEMENTS.map(a => {
    const have = statValue(account, a.stat);
    const done = !!unlocked[a.id];
    return {
      id: a.id, cat: a.cat, icon: a.icon, name: a.name, desc: a.desc,
      need: a.need, tier: a.tier,
      have: Math.min(have, a.need),
      pct: Math.max(0, Math.min(1, have / a.need)),
      unlocked: done,
      unlockedAt: done ? unlocked[a.id] : null,
    };
  });
  const count = out.filter(a => a.unlocked).length;
  return { achievements: out, unlocked: count, total: TOTAL };
}

module.exports = { ACHIEVEMENTS, ACH_BY_ID, TOTAL, BROADCAST_IDS, CATEGORIES, statValue, noteMax, evaluate, logView };
