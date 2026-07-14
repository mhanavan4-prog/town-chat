// Moonstone currency layer (Session I). Extracted to lib/ in Tier 3.4 Phase B.
// createMoonstones({ dataDir, persistLoad, persistSave, persistRegister }) -> API.
// MS_PACKS comes from data/; the ms_state push bridge stays in server.js.
const path = require('path');
const { MS_PACKS } = require('../data/gameConstants');

module.exports = function createMoonstones({ dataDir, persistLoad, persistSave, persistRegister }) {
  const MS_FILE = path.join(dataDir, 'moonstones.json');
  function loadMoonstones() {
    const d = persistLoad('moonstones', MS_FILE);
    return { balances: d.balances || {}, grants: d.grants || {} };
  }
  const msData = loadMoonstones();
  function saveMoonstones() { persistSave('moonstones', MS_FILE, msData); }
  persistRegister('moonstones', MS_FILE, () => msData);
  function msBalance(key) { return msData.balances[key] || 0; }
  function msAdjust(key, delta) {
    msData.balances[key] = Math.max(0, Math.round((msData.balances[key] || 0) + delta));
    saveMoonstones();
    return msData.balances[key];
  }

  // One grant id credits exactly once, ever — retries and replays are no-ops
  // that still report the current balance (so a flaky return page is safe).
  function grantMoonstones(grantId, accountKey, packId) {
    const pack = MS_PACKS[packId];
    if (!pack || !accountKey) return { granted: 0, balance: msBalance(accountKey) };
    if (msData.grants[grantId]) return { granted: 0, balance: msBalance(accountKey) };
    msData.grants[grantId] = { key: accountKey, packId, at: Date.now() };
    const balance = msAdjust(accountKey, pack.ms);
    console.log(`💎 ${accountKey} +${pack.ms} moonstones (${packId} via ${grantId.slice(0, 24)}…) → ${balance}`);
    return { granted: pack.ms, balance };
  }

  return { msData, msBalance, msAdjust, grantMoonstones, saveMoonstones };
};
