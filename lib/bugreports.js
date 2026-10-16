'use strict';
// In-game bug reports (Session N). A player hits "Report a Bug" and writes what
// happened; the server attaches their identity + context (room, class, level,
// build, IP, recent client errors) and stores it here. Persisted to disk so a
// report survives the frequent redeploys, and bounded so the file can't grow
// without limit. Admin-only to read. This is NOT the security audit log and NOT
// the player-moderation reports queue — it's a dev feedback channel.
const path = require('path');

module.exports = function createBugReports({ dataDir, persistLoad, persistSave, persistRegister, max = 500 }) {
  const FILE = path.join(dataDir, 'bugreports.json');
  const data = persistLoad('bugreports', FILE) || { reports: [], seq: 0 };
  if (!Array.isArray(data.reports)) data.reports = [];
  if (typeof data.seq !== 'number') data.seq = 0;
  persistRegister('bugreports', FILE, () => data);

  let dirty = false, timer = null;
  function save() {
    if (timer) return;
    timer = setTimeout(() => { timer = null; if (dirty) { dirty = false; try { persistSave('bugreports', FILE, data); } catch (e) {} } }, 3000);
  }

  // Store a report. All fields are clamped — the free text and the client-supplied
  // build / errors are untrusted; identity fields are passed by the server from
  // the live player, so they're authoritative.
  function add(r) {
    r = r || {};
    const rep = {
      id: 'bug_' + (++data.seq),
      ts: Date.now(),
      text: String(r.text || '').slice(0, 1000),
      name: String(r.name || '').slice(0, 40),
      account: r.account ? String(r.account).slice(0, 40) : null,
      room: String(r.room || '').slice(0, 40),
      charId: Number.isFinite(r.charId) ? r.charId : null,
      level: Number.isFinite(r.level) ? r.level : null,
      device: r.device === 'mobile' ? 'mobile' : 'desktop',
      build: String(r.build || '').slice(0, 40),
      ip: r.ip ? String(r.ip).slice(0, 64) : null,
      errors: Array.isArray(r.errors) ? r.errors.slice(0, 5).map((e) => String(e).slice(0, 300)) : [],
      status: 'open'
    };
    data.reports.push(rep);
    if (data.reports.length > max) data.reports.splice(0, data.reports.length - max);
    dirty = true; save();
    return rep;
  }

  // Most-recent `n`, newest first. `status` filters ('open' | 'resolved' | 'all').
  function recent(n, status) {
    const k = Math.max(1, Math.min(max, parseInt(n, 10) || 100));
    let list = data.reports;
    if (status === 'open' || status === 'resolved') list = list.filter((r) => (r.status || 'open') === status);
    return list.slice(-k).reverse();
  }

  function resolve(id, status) {
    const r = data.reports.find((x) => x.id === id);
    if (!r) return false;
    r.status = status === 'open' ? 'open' : 'resolved';
    dirty = true; save();
    return true;
  }

  function counts() {
    let open = 0; for (const r of data.reports) if ((r.status || 'open') === 'open') open++;
    return { total: data.reports.length, open };
  }

  return { add, recent, resolve, counts };
};
