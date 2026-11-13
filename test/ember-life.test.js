// The Ember Wastes' own life (server.js EMBER_MOB_TYPES carrion_crow, ash_hound):
// neutral, like the Wilds' beasts — they keep to their own ground, fight only
// whoever strikes them, and a pack answers for its own.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-emberlife-test-');
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); } }
function makeMockSocket(label) {
  return { label, OPEN: 1, readyState: 1, sent: [], _handlers: {},
    on(event, cb) { this._handlers[event] = cb; }, send(data) { this.sent.push(JSON.parse(data)); },
    emit(event, ...args) { if (this._handlers[event]) this._handlers[event](...args); },
    lastOfType(type) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === type) return this.sent[i]; return null; } };
}
require('../server.js');
const { FINDS } = require('../data/emberField');
const { EMBER_TOWN } = require('../data/emberTown');

setTimeout(() => {
  const h = global.__testHooks;
  const T = h.EMBER_MOB_TYPES, M = h.emberMobs;
  check('two kinds, both neutral, each with a leash and a temper that cools', ['carrion_crow', 'ash_hound'].every((k) => T[k] && T[k].neutral && T[k].aggroRadius === 0 && T[k].leash > 0 && T[k].provokeMs > 0) && T.ash_hound.pack === true);
  const crows = M.filter((m) => m.mobType === 'carrion_crow'), hounds = M.filter((m) => m.mobType === 'ash_hound');
  const graves = FINDS.filter((f) => /barrow|chapel/.test(f.model));
  check('crows keep over the field\'s graves and its chapel, three to each', crows.length === graves.length * 3 && crows.every((c) => graves.some((g) => Math.hypot(c.spawnX - g.x, c.spawnY - g.y) < 400)));
  check('three packs of four hounds, each in the empty country, each with its own home', hounds.length === 12 && new Set(hounds.map((m) => m.homeX + ',' + m.homeY)).size === 3 && hounds.every((m) => Math.hypot(m.homeX - EMBER_TOWN.x, m.homeY - EMBER_TOWN.y) > 3000));
  check('none of them rises in the town', [...crows, ...hounds].every((m) => EMBER_TOWN.ground.every((g) => Math.hypot(m.spawnX - g.x, m.spawnY - g.y) >= g.r)));

  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('w'); connHandler(s); s.emit('message', JSON.stringify({ type: 'join', name: 'Wayfarer' }));
  const p = h.players.get(s.lastOfType('init').id);
  for (const m of M) if (!m.boss) { m.dead = true; m.respawnAt = Date.now() + 1e9; }   // only the pack under test
  const pack = hounds.filter((m) => m.homeX === hounds[0].homeX);
  for (const m of pack) { m.dead = false; m.health = T.ash_hound.maxHealth; m.x = m.homeX + 40; m.y = m.homeY; m.provokedUntil = 0; }
  Object.assign(p, { room: 'ember_wastes', isDead: false, x: pack[0].x + 30, y: pack[0].y, health: 5000, maxHealth: 5000 });
  const hp0 = p.health;
  for (let i = 0; i < 60; i++) h.tickEmberWastes(0.05);
  check('stood right by them, nobody is bitten: they do not start it', p.health === hp0);
  h.applyDamage(p, 'ember_mob', pack[0].id, 5, 99999);
  check('strike one and it turns on you, and the whole pack with it', pack.every((m) => m.provokedUntil > Date.now() && m.provokerId === p.id));
  for (let i = 0; i < 80; i++) h.tickEmberWastes(0.05);
  check('and they bite', p.health < hp0, { hp0, now: p.health });
  for (const m of pack) m.provokedUntil = Date.now() - 1;
  const far = 5000; for (const m of pack) { m.x = m.homeX + far; m.y = m.homeY; }
  p.x = 100; p.y = 100;
  const d0 = Math.hypot(pack[0].x - pack[0].homeX, pack[0].y - pack[0].homeY);
  for (let i = 0; i < 200; i++) h.tickEmberWastes(0.05);
  check('when their temper has cooled they make their way home', Math.hypot(pack[0].x - pack[0].homeX, pack[0].y - pack[0].homeY) < d0 - 400, { d0, now: Math.hypot(pack[0].x - pack[0].homeX, pack[0].y - pack[0].homeY) });

  const main = fs.readFileSync(path.join(__dirname, '..', 'client/main.js'), 'utf8'), mobs = fs.readFileSync(path.join(__dirname, '..', 'client/ember-mobs.js'), 'utf8');
  check('the client draws them from the critter models: a crow that flies, a hound', /carrion_crow: +\{ name: 'Carrion Crow', staticKey: 'cr_gravewing_crow'[^\n]*fly: true/.test(main) && /ash_hound: +\{ name: 'Ash-Hound', staticKey: 'cr_hound'/.test(main) && /if \(v\.isStatic\) \{/.test(mobs) && /staticModel: \(key, size, mode\)/.test(main));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
