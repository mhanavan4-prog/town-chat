// Leaderboards (Session L) — weekly boards + honors/prize settlement. Extracted
// to lib/ in Tier 3.4 Phase B. legendaryWeekIndex + the bank/account/networking
// deps used by the weekly prize payout are injected; the legendary-week machinery
// and gameplay score hooks (noteBossKill etc.) stay in server.js.
const path = require('path');

module.exports = function createLeaderboards({ dataDir, persistLoad, persistSave, persistSetKey, persistRegister, legendaryWeekIndex, accounts, ensureBankAccount, saveBankAccounts, findConnectionByAccountKey, send }) {
  const LEADERBOARDS_FILE = path.join(dataDir, 'leaderboards.json');
  const leaderboards = persistLoad('leaderboards', LEADERBOARDS_FILE);
  persistRegister('leaderboards', LEADERBOARDS_FILE, () => leaderboards);
  const LB_BOARDS = ['hunt', 'boss', 'delve', 'tourney'];
  const LB_TOP_N = 20;
  const LB_KEEP_WEEKS = 9;

  function weekKey(now) { return 'w' + legendaryWeekIndex(now); }
  // Prune ancient periods (keep a couple months of history + the honors log).
  (() => {
    const cutoff = legendaryWeekIndex(Date.now()) - LB_KEEP_WEEKS;
    let pruned = false;
    for (const k of Object.keys(leaderboards)) {
      const m = /^w(-?\d+)$/.exec(k);
      if (m && Number(m[1]) < cutoff) { delete leaderboards[k]; pruned = true; }
    }
    if (pruned) persistSave('leaderboards', LEADERBOARDS_FILE, leaderboards);
  })();

  function lbPeriod(wk) {
    if (!leaderboards[wk]) leaderboards[wk] = {};
    return leaderboards[wk];
  }
  function lbBump(board, player, delta) {
    if (!player || !player.accountKey || !delta) return;
    const wk = weekKey(Date.now());
    const period = lbPeriod(wk);
    if (!period[board]) period[board] = {};
    const e = period[board][player.accountKey] || (period[board][player.accountKey] = { name: player.name, value: 0 });
    e.name = player.name; // keep the display name fresh
    e.value += delta;
    persistSetKey('leaderboards', LEADERBOARDS_FILE, leaderboards, wk);
  }
  function lbSetMax(board, player, value) {
    if (!player || !player.accountKey || !(value > 0)) return;
    const wk = weekKey(Date.now());
    const period = lbPeriod(wk);
    if (!period[board]) period[board] = {};
    const e = period[board][player.accountKey] || (period[board][player.accountKey] = { name: player.name, value: 0 });
    e.name = player.name;
    if (value > e.value) e.value = value;
    persistSetKey('leaderboards', LEADERBOARDS_FILE, leaderboards, wk);
  }
  function lbTop(board, wk, topN) {
    const period = leaderboards[wk] || {};
    const b = period[board] || {};
    return Object.entries(b)
      .map(([key, e]) => ({ key, name: e.name, value: e.value }))
      .sort((a, b2) => b2.value - a.value)
      .slice(0, topN || LB_TOP_N);
  }
  function lbRankOf(board, wk, accountKey) {
    if (!accountKey) return null;
    const period = leaderboards[wk] || {};
    const b = period[board] || {};
    if (!b[accountKey]) return null;
    const better = Object.values(b).filter(e => e.value > b[accountKey].value).length;
    return { rank: better + 1, value: b[accountKey].value };
  }

  // Honors — the permanent trophy shelf. When a week closes, its top three in
  // each board get an entry here (and a gold purse). Settled lazily: the first
  // board interaction after rollover pays out, so no cron is needed and a
  // sleepy Monday-morning server can't miss it.
  const LB_WEEK_PRIZES = [250, 125, 60]; // gold, 1st/2nd/3rd
  function lbSettleClosedWeeks() {
    const currentIdx = legendaryWeekIndex(Date.now());
    for (const wk of Object.keys(leaderboards)) {
      const m = /^w(-?\d+)$/.exec(wk);
      if (!m || Number(m[1]) >= currentIdx) continue;
      const period = leaderboards[wk];
      if (!period || period.settled) continue;
      period.settled = true;
      if (!leaderboards.honors) leaderboards.honors = {};
      for (const board of LB_BOARDS) {
        lbTop(board, wk, 3).forEach((e, i) => {
          if (!leaderboards.honors[e.key]) leaderboards.honors[e.key] = [];
          leaderboards.honors[e.key].push({ week: wk, board, place: i + 1, value: e.value });
          const purse = LB_WEEK_PRIZES[i] || 0;
          if (purse && accounts[e.key]) {
            ensureBankAccount(e.key).balance += purse;
            const online = findConnectionByAccountKey(e.key);
            if (online) send(online.ws, { type: 'announce', message: `🏅 Last week's ${boardLabel(board)} board: you placed #${i + 1}! ${purse} gold has been paid to your bank.` });
          }
        });
      }
      saveBankAccounts();
      persistSetKey('leaderboards', LEADERBOARDS_FILE, leaderboards, wk);
      persistSetKey('leaderboards', LEADERBOARDS_FILE, leaderboards, 'honors');
    }
  }
  function boardLabel(board) {
    return { hunt: 'Hunts', boss: 'Bosses', delve: 'Delve', tourney: 'Tournament' }[board] || board;
  }

  return { leaderboards, lbBump, lbSetMax, lbTop, lbRankOf, lbSettleClosedWeeks, weekKey, LB_BOARDS };
};
