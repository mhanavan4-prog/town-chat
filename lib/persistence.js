// Durable storage layer (Session L) — extracted to lib/ in Tier 3.4 Phase B.
// createPersistence({ dataDir }) returns the storage API; dataDir is the only
// injected dependency (the SQLite file path). The backup timer + SIGINT/SIGTERM
// handlers stay in the server entrypoint (server.js).
const path = require('path');
const fs = require('fs');

module.exports = function createPersistence({ dataDir }) {
  // Atomic JSON write: serialize to a temp file, then rename over the target.
  // rename(2) is atomic on POSIX, so a crash mid-write can never leave a
  // half-written (corrupt) store — the file is either the old contents or the
  // new, never a truncated splice. Every save*() below routes through this.
  function atomicWriteJson(file, obj) {
    const tmp = file + '.tmp';
    try {
      fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
      fs.renameSync(tmp, file);
    } catch (e) {
      // Never let a disk hiccup take down the game loop — log and move on; the
      // in-memory state is still authoritative until the next successful save.
      console.error('atomicWriteJson failed for ' + file + ':', e.message);
      try { fs.existsSync(tmp) && fs.unlinkSync(tmp); } catch (_) {}
    }
  }

  // ---------------------------------------------------------------------------
  // Durable storage (Session L) — every game store now lives in ONE embedded
  // SQLite database (DATA_DIR/thornreach.db) via Node's built-in node:sqlite.
  // Writes are transactional (a crash can never half-write a store — the old
  // atomicWriteJson only protected against truncation, not against one of two
  // related stores landing without the other), reads scale past friends-count
  // players, and there's exactly one file to back up.  Zero new npm deps.
  //
  // Compatibility contract:
  //  - First boot with SQLite: any legacy <store>.json files are imported once
  //    (the .json files are left on disk untouched, as a snapshot of that
  //    moment; the DB is authoritative from then on).
  //  - Node without node:sqlite (< 22.5), or PERSIST_FORCE_JSON=1 set in the
  //    environment: everything transparently falls back to the original
  //    atomic-JSON-file behavior. Same API, same files, nothing to migrate.
  //  - While SQLite is active, every store is ALSO exported to <name>.json.bak
  //    every PERSIST_EXPORT_MS (default 15 min) and on clean shutdown — an
  //    always-current plain-text backup you can read or hand-restore from.
  // ---------------------------------------------------------------------------
  let sqliteDb = null;
  if (!process.env.PERSIST_FORCE_JSON) {
    try {
      const { DatabaseSync } = require('node:sqlite');
      sqliteDb = new DatabaseSync(path.join(dataDir, 'thornreach.db'));
      sqliteDb.exec('PRAGMA journal_mode = WAL');
      sqliteDb.exec('PRAGMA synchronous = NORMAL');
      sqliteDb.exec('CREATE TABLE IF NOT EXISTS stores (store TEXT NOT NULL, k TEXT NOT NULL, v TEXT NOT NULL, PRIMARY KEY (store, k))');
    } catch (e) {
      sqliteDb = null; // no node:sqlite on this Node — JSON files keep working as ever
    }
  }
  // Arrays (the auction listings) are stored under this single sentinel row
  // instead of exploding into index-keyed rows that would go stale on splice.
  const PERSIST_ARRAY_KEY = '__array__';
  const PERSIST_REGISTRY = new Map(); // store name -> { file, getLive }

  function persistLoad(store, file) {
    const readJsonFile = () => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; } };
    if (!sqliteDb) return readJsonFile() || {};
    try {
      const rows = sqliteDb.prepare('SELECT k, v FROM stores WHERE store = ?').all(store);
      if (rows.length === 1 && rows[0].k === PERSIST_ARRAY_KEY) return JSON.parse(rows[0].v);
      if (rows.length) {
        const out = {};
        for (const r of rows) out[r.k] = JSON.parse(r.v);
        return out;
      }
      // Nothing in the DB yet — one-time import of the legacy JSON file.
      const legacy = readJsonFile();
      if (legacy && typeof legacy === 'object') {
        persistSave(store, file, legacy);
        const n = Array.isArray(legacy) ? legacy.length : Object.keys(legacy).length;
        console.log(`storage: imported legacy ${path.basename(file)} into thornreach.db (${n} entries)`);
        return legacy;
      }
    } catch (e) {
      console.error('persistLoad failed for ' + store + ':', e.message);
      const fromFile = readJsonFile();
      if (fromFile) return fromFile;
    }
    return {};
  }

  function persistSave(store, file, obj) {
    if (!sqliteDb) { atomicWriteJson(file, obj); return; }
    try {
      sqliteDb.exec('BEGIN');
      try {
        sqliteDb.prepare('DELETE FROM stores WHERE store = ?').run(store);
        const ins = sqliteDb.prepare('INSERT INTO stores (store, k, v) VALUES (?, ?, ?)');
        if (Array.isArray(obj)) {
          ins.run(store, PERSIST_ARRAY_KEY, JSON.stringify(obj));
        } else {
          for (const [k, v] of Object.entries(obj)) {
            if (v !== undefined) ins.run(store, k, JSON.stringify(v));
          }
        }
        sqliteDb.exec('COMMIT');
      } catch (e) { try { sqliteDb.exec('ROLLBACK'); } catch (_) {} throw e; }
    } catch (e) {
      // Belt and braces: never lose state silently — fall back to the JSON file.
      console.error('persistSave failed for ' + store + ':', e.message);
      atomicWriteJson(file, obj);
    }
  }

  // Per-key fast path for chatty stores (harvest ticks, leaderboard bumps):
  // updates one row instead of rewriting the whole store. Without SQLite it
  // falls back to the full atomic JSON write those stores always did.
  function persistSetKey(store, file, obj, key) {
    if (!sqliteDb) { atomicWriteJson(file, obj); return; }
    try {
      const v = obj[key];
      if (v === undefined) sqliteDb.prepare('DELETE FROM stores WHERE store = ? AND k = ?').run(store, key);
      else sqliteDb.prepare('INSERT INTO stores (store, k, v) VALUES (?, ?, ?) ON CONFLICT(store, k) DO UPDATE SET v = excluded.v').run(store, key, JSON.stringify(v));
    } catch (e) {
      console.error('persistSetKey failed for ' + store + ':', e.message);
      atomicWriteJson(file, obj);
    }
  }

  function persistRegister(store, file, getLive) { PERSIST_REGISTRY.set(store, { file, getLive }); }
  function persistExportBackups() {
    if (!sqliteDb) return; // JSON mode: the .json files ARE the store already
    for (const [, { file, getLive }] of PERSIST_REGISTRY) {
      try { atomicWriteJson(file + '.bak', getLive()); } catch (e) {}
    }
  }

  return {
    persistLoad, persistSave, persistSetKey, persistRegister, persistExportBackups,
    getSqliteDb: () => sqliteDb,
    atomicWriteJson,
  };
};
