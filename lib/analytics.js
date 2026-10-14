'use strict';
// Privacy-respecting, self-hosted product analytics.
//
// AGGREGATE ONLY: daily counters per metric (e.g. 2026-10-31 → { join: 42,
// 'class.witch': 9, register: 15 }). There is NO per-user event stream, no
// names, no IPs, no PII — just tallies. DAU and "returning" uniqueness is done
// with a single per-account date marker (acc.lastActiveDay), not an event log.
// Nothing here is a third-party tracker and nothing is ever sold.
const path = require('path');

module.exports = function createAnalytics({ dataDir, persistLoad, persistSave, persistRegister, retainDays = 180 }) {
  const FILE = path.join(dataDir, 'analytics.json');
  const data = persistLoad('analytics', FILE) || {}; // { 'YYYY-MM-DD': { metric: count } }
  persistRegister('analytics', FILE, () => data);

  let dirty = false, saveTimer = null;
  const day = (t) => new Date(t || Date.now()).toISOString().slice(0, 10);

  function scheduleSave() {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      if (dirty) { dirty = false; try { persistSave('analytics', FILE, data); } catch (e) {} }
    }, 5000);
  }

  function prune() {
    const keys = Object.keys(data).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
    if (keys.length <= retainDays) return;
    for (const k of keys.slice(0, keys.length - retainDays)) delete data[k];
  }

  // Increment a metric for today. Metric names are short dotted slugs.
  function bump(metric, n = 1) {
    if (!metric || !Number.isFinite(n)) return;
    const d = day();
    if (!data[d]) { data[d] = {}; prune(); }
    data[d][metric] = (data[d][metric] || 0) + n;
    dirty = true; scheduleSave();
  }

  // Record the day's HIGH-WATER MARK for a metric (e.g. peak concurrent
  // players). Unlike bump (a running total), this only ever raises the value,
  // so reading it back gives the day's maximum, not a sum.
  function peak(metric, value) {
    if (!metric || !Number.isFinite(value)) return;
    const d = day();
    if (!data[d]) { data[d] = {}; prune(); }
    if (value > (data[d][metric] || 0)) { data[d][metric] = value; dirty = true; scheduleSave(); }
  }

  // The last `days` days of counters, oldest first, plus the union of metric
  // names seen in that window (so the dashboard can lay out columns).
  function snapshot(days = 30) {
    const all = Object.keys(data).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
    const window = all.slice(-days);
    const metrics = new Set();
    for (const d of window) for (const m of Object.keys(data[d])) metrics.add(m);
    return { days: window, data: window.reduce((o, d) => { o[d] = data[d]; return o; }, {}), metrics: Array.from(metrics).sort() };
  }

  // Sum a metric across the whole retained window (all-time within retention).
  function total(metric) {
    let s = 0;
    for (const d of Object.keys(data)) if (data[d] && data[d][metric]) s += data[d][metric];
    return s;
  }

  return { bump, peak, snapshot, total, day, data };
};
