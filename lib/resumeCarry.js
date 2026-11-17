// Carries players across a server restart.
//
// A dropped connection has always been able to pick up where it left off: the
// server stashes the player under a resume token and the client's auto-reconnect
// presents it. That stash lived only in memory, so a restart threw it away and
// everyone came back at the town gate, and a guest lost their whole character.
// This writes the stashes to disk on the way down and reads them on the way up,
// so a restart looks to a player like a few seconds of dropped connection.
'use strict';

module.exports = function createResumeCarry({ fs, file }) {
  // Stash everyone connected under their live token, then write every stash.
  function save(resumeStashes, players, buildStash, ttlMs) {
    const now = Date.now();
    const out = [];
    const held = new Set();
    for (const p of players.values()) {
      if (!p || !p.liveResumeToken || p._synthetic) continue;
      held.add(p.liveResumeToken);
      try { out.push([p.liveResumeToken, { expiresAt: now + ttlMs, stash: buildStash(p) }]); } catch (e) { /* one bad player must not lose the rest */ }
    }
    for (const [token, entry] of resumeStashes) {
      if (!entry || entry.expiresAt < now || held.has(token)) continue;
      out.push([token, entry]);
    }
    if (!out.length) { clear(); return 0; }
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ savedAt: now, entries: out }), { mode: 0o600 });
    fs.renameSync(tmp, file);
    return out.length;
  }

  // Read the stashes back into the live map. The file is removed once read: a
  // token is single-use, so it must not come back on the restart after this.
  function load(resumeStashes) {
    let raw;
    try { raw = fs.readFileSync(file, 'utf8'); } catch (e) { return 0; }
    clear();
    let n = 0;
    try {
      const data = JSON.parse(raw);
      const now = Date.now();
      for (const pair of (data && data.entries) || []) {
        const token = pair && pair[0], entry = pair && pair[1];
        if (typeof token !== 'string' || !entry || !entry.stash || !(entry.expiresAt > now)) continue;
        if (resumeStashes.has(token)) continue;
        resumeStashes.set(token, entry);
        n++;
      }
    } catch (e) { return 0; }
    return n;
  }

  function clear() { try { fs.unlinkSync(file); } catch (e) { /* nothing to clear */ } }

  return { save, load, clear };
};
