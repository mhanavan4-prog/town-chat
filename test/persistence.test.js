// 🗄️ Durable storage (Session L) — the SQLite layer that replaced the flat
// JSON files. Checks: node:sqlite is actually active on this Node, one-time
// legacy-JSON import, object + array round-trips, the per-key fast path,
// crash-durability (a second connection sees committed rows), the .json.bak
// export, and the PERSIST_FORCE_JSON=1 fallback (spawned as a child process,
// where the old atomic-JSON behavior must be byte-for-byte alive and well).
process.env.PORT = '0';
const os = require('os');
const fs = require('fs');
const path = require('path');
const DATA_DIR = path.join(os.tmpdir(), 'tc-persist-test-' + process.pid);
process.env.DATA_DIR = DATA_DIR;
fs.mkdirSync(DATA_DIR, { recursive: true });

// Seed a LEGACY store before the server ever boots — this is the "old save
// on disk from a pre-SQLite deploy" scenario the import path must cover.
const legacyAccounts = {
  mike: { username: 'Mike', salt: 'abc', hash: 'def', color: '#ff6b6b', createdAt: 12345 }
};
fs.writeFileSync(path.join(DATA_DIR, 'accounts.json'), JSON.stringify(legacyAccounts));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS -', name); }
  else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); }
}

require('../server.js');

setTimeout(() => {
  const hooks = global.__testHooks;
  const { getSqliteDb, persistLoad, persistSave, persistSetKey, accounts, saveAccounts } = hooks;
  const db = getSqliteDb();

  // 1. The layer is live on this Node (the Dockerfile pins node:22-slim for
  //    the same guarantee in production).
  check('node:sqlite is active (thornreach.db)', !!db);
  check('thornreach.db exists on disk', fs.existsSync(path.join(DATA_DIR, 'thornreach.db')));

  // 2. Legacy import — the pre-seeded accounts.json was picked up…
  check('legacy accounts.json was imported', accounts.mike && accounts.mike.username === 'Mike');
  // …and now lives in the DB, not just in memory.
  const row = db.prepare("SELECT v FROM stores WHERE store = 'accounts' AND k = 'mike'").get();
  check('imported account is in the DB', row && JSON.parse(row.v).username === 'Mike');
  // …and the legacy file was left in place as a snapshot (never deleted).
  check('legacy .json left untouched on disk', fs.existsSync(path.join(DATA_DIR, 'accounts.json')));

  // 3. Object-store round-trip through the public API.
  accounts.newbie = { username: 'Newbie', salt: 's', hash: 'h', color: '#69db7c', createdAt: Date.now() };
  saveAccounts();
  const back = persistLoad('accounts', path.join(DATA_DIR, 'accounts.json'));
  check('object store round-trips (save → load)', back.newbie && back.newbie.username === 'Newbie' && back.mike);

  // 4. Array-store round-trip (the auction listings shape).
  const fakeListings = [{ id: 'l1', itemId: 'iron_sword', bid: 50 }, { id: 'l2', itemId: 'spell_tome', bid: 75 }];
  persistSave('listings', path.join(DATA_DIR, 'listings.json'), fakeListings);
  const listBack = persistLoad('listings', path.join(DATA_DIR, 'listings.json'));
  check('array store round-trips', Array.isArray(listBack) && listBack.length === 2 && listBack[1].id === 'l2');

  // 5. Per-key fast path — one row updated, the rest untouched.
  const harv = { alice: { wdecor_1_1: 111 }, bob: { wdecor_2_2: 222 } };
  persistSave('harvests_t', path.join(DATA_DIR, 'harvests_t.json'), harv);
  harv.alice.wdecor_9_9 = 999;
  persistSetKey('harvests_t', path.join(DATA_DIR, 'harvests_t.json'), harv, 'alice');
  const harvBack = persistLoad('harvests_t', path.join(DATA_DIR, 'harvests_t.json'));
  check('persistSetKey updates one key', harvBack.alice && harvBack.alice.wdecor_9_9 === 999 && harvBack.bob.wdecor_2_2 === 222);
  // Deleting a key removes its row.
  delete harv.bob;
  persistSetKey('harvests_t', path.join(DATA_DIR, 'harvests_t.json'), harv, 'bob');
  check('persistSetKey deletes removed keys', persistLoad('harvests_t', path.join(DATA_DIR, 'harvests_t.json')).bob === undefined);

  // 6. Durability — a SECOND connection to the same file sees committed data
  //    (i.e. writes are truly in the database, not this process's memory).
  const { DatabaseSync } = require('node:sqlite');
  const db2 = new DatabaseSync(path.join(DATA_DIR, 'thornreach.db'));
  const row2 = db2.prepare("SELECT v FROM stores WHERE store = 'accounts' AND k = 'newbie'").get();
  check('second connection sees committed rows', row2 && JSON.parse(row2.v).username === 'Newbie');
  db2.close();

  // 7. The .json.bak export writes readable plain-text backups.
  hooks.persistExportBackups();
  const bak = path.join(DATA_DIR, 'accounts.json.bak');
  check('.json.bak export exists and parses', fs.existsSync(bak) && JSON.parse(fs.readFileSync(bak, 'utf8')).newbie.username === 'Newbie');

  // 8. PERSIST_FORCE_JSON=1 fallback — a child server must behave exactly like
  //    the pre-SQLite build: no DB file, saves land in the .json files.
  const { execFileSync } = require('child_process');
  const childDir = path.join(os.tmpdir(), 'tc-persist-json-' + process.pid);
  fs.mkdirSync(childDir, { recursive: true });
  const childScript = `
    process.env.PORT = '0';
    process.env.DATA_DIR = ${JSON.stringify(childDir)};
    process.env.PERSIST_FORCE_JSON = '1';
    require(${JSON.stringify(path.join(__dirname, '..', 'server.js'))});
    setTimeout(() => {
      const h = global.__testHooks;
      const ok1 = !h.getSqliteDb();
      h.accounts.jsonuser = { username: 'JsonUser', salt: 's', hash: 'h', color: '#4dabf7', createdAt: 1 };
      h.saveAccounts();
      const fs2 = require('fs');
      const onDisk = JSON.parse(fs2.readFileSync(${JSON.stringify(path.join(childDir, 'accounts.json'))}, 'utf8'));
      const ok2 = onDisk.jsonuser && onDisk.jsonuser.username === 'JsonUser';
      const ok3 = !fs2.existsSync(${JSON.stringify(path.join(childDir, 'thornreach.db'))});
      console.log(ok1 && ok2 && ok3 ? 'CHILD_OK' : 'CHILD_FAIL ' + [ok1, ok2, ok3].join(','));
      process.exit(0);
    }, 300);
  `;
  let childOut = '';
  try {
    childOut = execFileSync(process.execPath, ['-e', childScript], { timeout: 20000 }).toString();
  } catch (e) {
    childOut = String((e.stdout || '') + (e.stderr || '') + e.message);
  }
  check('PERSIST_FORCE_JSON=1 falls back to plain JSON files', childOut.includes('CHILD_OK'), childOut.trim().slice(-200));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 200);
