// Covens (Session I) — coven store, membership index, invites, and state/
// broadcast. Extracted to lib/ in Tier 3.4 Phase B. Deps (persistence, accounts,
// findConnectionByAccountKey, send) injected; the invite-expiry watcher and the
// coven message handlers stay in server.js.
const path = require('path');

module.exports = function createCovens({ dataDir, persistLoad, persistSetKey, persistRegister, accounts, findConnectionByAccountKey, send }) {
  const COVENS_FILE = path.join(dataDir, 'covens.json');
  const covens = persistLoad('covens', COVENS_FILE);
  persistRegister('covens', COVENS_FILE, () => covens);
  function saveCoven(covenId) { persistSetKey('covens', COVENS_FILE, covens, covenId); }
  const COVEN_MAX_MEMBERS = 8;
  const COVEN_CREATE_COST = 250;
  const COVEN_BANK_SLOTS = 12;
  const COVEN_SIGILS = ['🕯️', '🌙', '🦇', '🐈‍⬛', '🕸️', '🌿', '⭐', '🔮', '🗝️', '🥀'];
  const COVEN_TABLE_HOLD_MS = 24 * 3600 * 1000;
  const covenIndex = new Map(); // accountKey -> covenId
  for (const [cid, cv] of Object.entries(covens)) {
    for (const key of cv.members) covenIndex.set(key, cid);
  }
  const covenInvites = new Map(); // inviteId -> { covenId, targetKey, expiresAt }

  function covenOf(accountKey) {
    const cid = covenIndex.get(accountKey);
    return cid ? covens[cid] || null : null;
  }
  function covenLog(cv, who, action) {
    cv.log = cv.log || [];
    cv.log.push({ at: Date.now(), who, action });
    if (cv.log.length > 20) cv.log = cv.log.slice(-20);
  }
  function covenDisplayName(key) {
    return accounts[key] ? accounts[key].username : key;
  }
  function covenStatePayload(cv, viewerKey) {
    return {
      coven: {
        id: cv.id, name: cv.name, sigil: cv.sigil, motd: cv.motd || '',
        leaderKey: cv.leaderKey,
        you: viewerKey,
        members: cv.members.map(k => ({
          key: k, name: covenDisplayName(k),
          online: !!findConnectionByAccountKey(k),
          leader: k === cv.leaderKey
        })),
        bank: { gold: cv.bank.gold, slots: cv.bank.slots },
        log: (cv.log || []).slice(-10),
        table: cv.table && cv.table.until > Date.now() ? cv.table : null
      }
    };
  }
  function covenBroadcast(cv) {
    for (const key of cv.members) {
      const p = findConnectionByAccountKey(key);
      if (p) send(p.ws, { type: 'coven_state', ...covenStatePayload(cv, key) });
    }
  }
  // The café table view for everyone standing in the room (not just members):
  // which coven holds the table right now, if any.
  function covenTableFor(room) {
    if (room !== 'cafe') return null;
    const now = Date.now();
    for (const cv of Object.values(covens)) {
      if (cv.table && cv.table.room === 'cafe' && cv.table.until > now) {
        return { name: cv.name, sigil: cv.sigil, until: cv.table.until };
      }
    }
    return null;
  }

  return { covens, COVENS_FILE, saveCoven, covenOf, covenLog, covenDisplayName, covenStatePayload, covenBroadcast, covenTableFor, covenIndex, covenInvites, COVEN_MAX_MEMBERS, COVEN_CREATE_COST, COVEN_BANK_SLOTS, COVEN_SIGILS, COVEN_TABLE_HOLD_MS };
};
