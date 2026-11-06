// Client-drift guard. The client keeps hand-written copies of several server
// catalogs (for icons, tooltips and previews). One of them — the dye list —
// silently drifted: the Finery line and Ember never reached the client, so
// they were missing from the wardrobe for months. This test reads each client
// copy straight out of the client source and fails the moment any field it
// shares with the server copy disagrees, or an entry exists on only one side.
//
// A client copy may carry FEWER fields than the server (display only); only
// the fields both sides have are compared.
const fs = require('fs');
const path = require('path');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const ROOT = path.join(__dirname, '..');
const SERVER = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const CLIENT_MAIN = fs.readFileSync(path.join(ROOT, 'client/main.js'), 'utf8');
const CLIENT_WARDROBE = fs.readFileSync(path.join(ROOT, 'client/wardrobe.js'), 'utf8');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

// Pull `const NAME = <object or array literal>` out of a source file and
// evaluate just that literal. Skips strings and // comments while matching
// brackets, so an apostrophe or a brace in a description can't confuse it.
function literal(src, name) {
  const m = new RegExp('(?:^|\\n)\\s*(?:export\\s+)?(?:const|let)\\s+' + name + '\\s*=\\s*').exec(src);
  if (!m) return undefined;
  let i = m.index + m[0].length; const start = i; let depth = 0, inStr = null;
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) { if (c === '\\') { i++; continue; } if (c === inStr) inStr = null; continue; }
    if (c === "'" || c === '"' || c === '`') { inStr = c; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') { depth--; if (depth === 0) { i++; break; } }
  }
  return Function('"use strict"; return (' + src.slice(start, i) + ')')();
}

// Compare two id-keyed maps on the fields both sides carry.
function compare(label, server, client) {
  check(`${label}: client copy found`, client && typeof client === 'object', typeof client);
  if (!client || !server) return;
  const sk = Object.keys(server), ck = Object.keys(client);
  const onlyServer = sk.filter((k) => !(k in client)), onlyClient = ck.filter((k) => !(k in server));
  check(`${label}: every server entry is on the client`, onlyServer.length === 0, onlyServer);
  check(`${label}: no client entry the server lacks`, onlyClient.length === 0, onlyClient);
  const diffs = [];
  for (const k of sk) {
    if (!(k in client)) continue;
    const s = server[k], c = client[k];
    if (s && typeof s === 'object' && c && typeof c === 'object' && !Array.isArray(s)) {
      for (const f of Object.keys(c)) if (f in s && JSON.stringify(s[f]) !== JSON.stringify(c[f])) diffs.push(`${k}.${f}: server ${JSON.stringify(s[f])} / client ${JSON.stringify(c[f])}`);
    } else if (JSON.stringify(s) !== JSON.stringify(c)) diffs.push(`${k}: server ${JSON.stringify(s)} / client ${JSON.stringify(c)}`);
  }
  check(`${label}: shared fields agree`, diffs.length === 0, diffs.slice(0, 8));
}
const byId = (arr) => arr.reduce((o, x) => { const { id, ...rest } = x; o[id] = rest; return o; }, {});

// ── Class spell/attack catalogs (server.js ↔ client/main.js) ─────────────────
for (const n of ['SPELL_CATALOG', 'WEREWOLF_ATTACK_CATALOG', 'WANDERER_ATTACK_CATALOG', 'MYSTIC_ATTACK_CATALOG', 'KNIGHT_ATTACK_CATALOG', 'NECROMANCER_ATTACK_CATALOG']) {
  compare(n, literal(SERVER, n), literal(CLIENT_MAIN, n));
}

// ── Altar rituals (server object ↔ client array) ─────────────────────────────
{
  const client = literal(CLIENT_MAIN, 'RITUALS');
  compare('RITUALS', literal(SERVER, 'RITUALS'), Array.isArray(client) ? byId(client) : client);
}

// ── Correspondences (data/correspondences.js ↔ client/main.js) ───────────────
{
  const corr = require('../data/correspondences.js');
  for (const n of ['RITUAL_DECOS', 'DAY_RITUAL', 'MOON_RITUAL']) compare(n, corr[n], literal(CLIENT_MAIN, n));
}

// ── Wardrobe (data/wardrobe.js ↔ client/wardrobe.js) ─────────────────────────
{
  const w = require('../data/wardrobe.js');
  compare('WARDROBE', w.WARDROBE, literal(CLIENT_WARDROBE, 'WARDROBE'));
  compare('weapon UNLOCKS', w.UNLOCKS, literal(CLIENT_WARDROBE, 'UNLOCKS'));
  // The client dye list is now only a fallback until init swaps in the server's
  // catalog (setDyeCatalog), so it may be SHORTER — but anything it does list
  // must match the server exactly, and the server must ship the catalog.
  const cd = byId(literal(CLIENT_WARDROBE, 'DYES')), sd = byId(w.DYES);
  const bad = Object.keys(cd).filter((k) => !sd[k] || JSON.stringify(sd[k]) !== JSON.stringify(cd[k]));
  check('fallback dyes all match the server palette', bad.length === 0, bad);
  check('the server ships the dye catalog in init', /dyes:\s*DYES/.test(SERVER) && /dyeUnlocks:\s*DYE_UNLOCKS/.test(SERVER));
}

// ── Item catalog (data/itemCatalog.js ↔ client/main.js) ──────────────────────
// Entries legitimately differ (init merges missing server items into the
// client, and the client also lists plants/brews from data/world.js), so only
// items present on BOTH sides are compared, field by shared field.
{
  const s = require('../data/itemCatalog.js'), c = literal(CLIENT_MAIN, 'ITEM_CATALOG');
  check('ITEM_CATALOG: client copy found', c && typeof c === 'object');
  const diffs = [];
  for (const k of Object.keys(c || {})) if (s[k]) for (const f of Object.keys(c[k])) if (f in s[k] && JSON.stringify(s[k][f]) !== JSON.stringify(c[k][f])) diffs.push(`${k}.${f}: server ${JSON.stringify(s[k][f])} / client ${JSON.stringify(c[k][f])}`);
  check('ITEM_CATALOG: items on both sides agree on name/icon/slot', diffs.length === 0, diffs.slice(0, 8));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
