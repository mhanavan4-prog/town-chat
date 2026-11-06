// Loot review.
//
// Playtest report: "Looted: [object Object] [object Object]" in the log.
//
// `loot_drop` carries DISPLAY LABELS — the client joins them straight into
// "Looted: …". The main pipeline (rollPendingLoot -> grantLoot) builds those
// correctly, but the world boss paid out with a second, independent emitter
// that pushed item RECORDS ({itemId, qty}) into the same message. join() turns
// each of those into the literal text "[object Object]".
//
// So this covers both halves: every loot TABLE names an item the merged
// catalog actually knows, and every loot_drop PAYLOAD is a renderable string.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-loot-');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
  };
}

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const C = h.ITEM_CATALOG;

  function join(tag, key) {
    const s = makeMockSocket(tag); connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: 0 }));
    const p = h.players.get(s.lastOfType('init').id);
    p.accountKey = key; if (!h.accounts[key]) h.accounts[key] = {};
    return { s, p };
  }

  // ── Every catalog entry can be rendered ───────────────────────────────────
  // grantLoot formats `${meta.icon} ${meta.name}`, so a non-string in either
  // field reaches the player as "[object Object]".
  const malformed = Object.entries(C).filter(([, it]) => !it || typeof it.name !== 'string' || typeof it.icon !== 'string');
  check(`all ${Object.keys(C).length} catalog entries have a string name and icon`, malformed.length === 0, malformed.slice(0, 5).map(([id]) => id));

  // ── Every loot table names something real ─────────────────────────────────
  const problems = [];
  const auditTable = (label, table) => {
    if (!Array.isArray(table)) return 0;
    table.forEach((d, i) => {
      const where = `${label}[${i}]`;
      if (typeof d.chance !== 'number') problems.push(`${where}: chance is ${typeof d.chance}`);
      if (d.gold) {
        if (typeof d.min !== 'number' || typeof d.max !== 'number') problems.push(`${where}: gold bounds are not numbers`);
        return;
      }
      if (typeof d.itemId !== 'string') { problems.push(`${where}: itemId is ${typeof d.itemId}`); return; }
      if (!C[d.itemId]) problems.push(`${where}: "${d.itemId}" is not in the catalog`);
    });
    return table.length;
  };
  let entries = 0;
  for (const [k, t] of Object.entries(h.LOOT_TABLES || {})) entries += auditTable('LOOT_TABLES.' + k, t);
  for (const [k, p] of Object.entries(h.EMBER_MOB_TYPES || {})) entries += auditTable('EMBER.' + k, p.lootTable);
  for (const [k, p] of Object.entries(h.MOB2_TYPES || {})) entries += auditTable('MOB2.' + k, h.LOOT_TABLES[p.loot]);
  for (const [k, p] of Object.entries(h.MOB3_TYPES || {})) entries += auditTable('MOB3.' + k, h.LOOT_TABLES[p.loot]);
  check(`all ${entries} loot-table entries name an item the catalog knows`, problems.length === 0, problems.slice(0, 6));

  // ── Rolling a table and granting it yields renderable labels ──────────────
  // This is the shape check that would have caught the report: whatever comes
  // back from a grant has to survive being joined into a sentence.
  const a = join('Looter', 'loot_a');
  const renderable = (v) => typeof v === 'string' && v.length > 0 && v.indexOf('[object') === -1;

  let grants = 0, badGrants = [];
  for (const [name, table] of Object.entries(h.LOOT_TABLES || {})) {
    // Force every drop in the table so nothing is left to chance.
    const certain = table.map((d) => ({ ...d, chance: 1 }));
    const pending = h.rollPendingLoot(certain);
    const earned = h.grantLoot(pending, a.p);
    grants++;
    for (const line of earned) if (!renderable(line)) badGrants.push(`${name}: ${JSON.stringify(line)}`);
  }
  check(`granting all ${grants} loot tables produces only renderable labels`, badGrants.length === 0, badGrants.slice(0, 5));

  // ── The world boss pays out through its own emitter ───────────────────────
  // It built `{itemId, qty}` records, which is the reported bug. Anything it
  // sends has to be joinable text like every other loot_drop.
  const b = join('BossSlayer', 'loot_b');
  b.s.sent.length = 0;
  let wbChecked = false;
  if (h.worldBoss && typeof h.worldBoss.forceSpawn === 'function') {
    try {
      h.worldBoss.forceSpawn();
      h.worldBoss.registerDamage && h.worldBoss.registerDamage(b.p, 99999);
      h.worldBoss.forceDefeat && h.worldBoss.forceDefeat();
      wbChecked = true;
    } catch (e) { wbChecked = false; }
  }
  const drops = b.s.sent.filter((m) => m.type === 'loot_drop');
  if (wbChecked && drops.length) {
    const bad = drops.flatMap((m) => m.items).filter((v) => !renderable(v));
    check('world boss loot_drop carries renderable labels', bad.length === 0, bad.slice(0, 4));
  } else {
    // No test seam onto the boss fight — assert on the source instead, which
    // still fails loudly if anyone pushes a record back into that array.
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'lib', 'worldboss.js'), 'utf8');
    const emitter = src.slice(src.indexOf('const earned = []'), src.indexOf("type: 'loot_drop'"));
    check('world boss pushes labels, not item records, into loot_drop',
      emitter.indexOf('earned.push({') === -1 && emitter.indexOf('earned.push(`') !== -1,
      emitter.split('\n').filter((l) => l.includes('earned.push')).map((l) => l.trim()));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 700);
