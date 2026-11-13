// Ash storms in the Ember Wastes (lib/emberStorm.js, data/emberStorm.js,
// client/ember-storm.js): calm, the wind getting up, the storm, calm again;
// the Wastes' creatures see half as far in it; weathering one out there is
// in your daybook.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-emberstorm-test-');
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); } }
function makeMockSocket(label) {
  return { label, OPEN: 1, readyState: 1, sent: [], _handlers: {},
    on(event, cb) { this._handlers[event] = cb; }, send(data) { this.sent.push(JSON.parse(data)); },
    emit(event, ...args) { if (this._handlers[event]) this._handlers[event](...args); },
    lastOfType(type) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === type) return this.sent[i]; return null; } };
}
const { STORM, STORM_LORE } = require('../data/emberStorm');
const createEmberStorm = require('../lib/emberStorm');

// the clock on its own
{
  let t = 0; const told = [], weathered = []; const folk = [{ id: 'a' }, { id: 'b' }];
  let here = folk.slice();
  const st = createEmberStorm({ now: () => t, rand: () => 0.5, tellWastes: (m) => told.push(m), inWastes: () => here, onWeathered: (p) => weathered.push(p.id) });
  st.tick();
  check('it starts calm, and the first storm comes a few minutes after a restart', st.state().phase === 'calm' && st.state().until === STORM.firstMs && told.length === 0);
  t = STORM.firstMs; st.tick();
  check('then the wind gets up, with a warning everyone out there hears', st.state().phase === 'gathering' && told.some((m) => m.type === 'ember_storm' && m.phase === 'gathering' && m.sfx === 'ash_storm_rise' && m.turn) && told.some((m) => m.type === 'toast' && /storm is coming/.test(m.message)));
  check('the creatures see as far as ever while it gathers', st.aggroMul() === 1);
  t += STORM.gatherMs; st.tick();
  check('then the storm', st.state().phase === 'storm' && st.state().until === t + STORM.blowMs && st.aggroMul() === STORM.aggroMul && STORM.aggroMul < 1);
  st.leave({ id: 'b' });
  here = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  t += STORM.blowMs; st.tick();
  check('then calm again, with the wind dropping', st.state().phase === 'calm' && told.some((m) => m.type === 'ember_storm' && m.phase === 'calm' && m.sfx === 'ash_storm_end'));
  check('only whoever was out there through all of it has weathered it (not who left, not who came late)', JSON.stringify(weathered) === '["a"]', weathered);
  check('and the next is ten to sixteen minutes off', st.state().until - t >= STORM.calmMinMs && st.state().until - t <= STORM.calmMaxMs);
  check('the lore is in the record and says where the game goes beyond it', STORM_LORE.tier === 'record' && /North Berwick/.test(STORM_LORE.lines.join(' ')) && /Newes from Scotland/.test(STORM_LORE.source) && /Nobody raised it/.test(STORM_LORE.note) && st.loreBoard().lines.length === STORM_LORE.lines.length + 2);
}

require('../server.js');
setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('w'); connHandler(s); s.emit('message', JSON.stringify({ type: 'join', name: 'Wayfarer' }));
  const p = h.players.get(s.lastOfType('init').id);
  Object.assign(p, { room: 'ember_wastes', isDead: false, x: 4000, y: 4000, health: 5000, maxHealth: 5000 });
  s.emit('message', JSON.stringify({ type: 'field_state' }));
  check('arriving, you are told how the weather stands', !!s.lastOfType('ember_storm'));

  // a hostile creature that would see you in clear air does not in the storm
  for (const m of h.emberMobs) if (!m.boss) { m.dead = true; m.respawnAt = Date.now() + 1e9; }
  const m = h.emberMobs.find((x) => !x.boss && !h.EMBER_MOB_TYPES[x.mobType].neutral);
  const T = h.EMBER_MOB_TYPES[m.mobType];
  const put = () => Object.assign(m, { dead: false, health: T.maxHealth, x: p.x + T.aggroRadius * 0.75, y: p.y, spawnX: p.x + T.aggroRadius * 0.75, spawnY: p.y, paused: true, wanderTimer: 99 });
  h.emberStorm.force('storm', 60000);
  put(); const d0 = Math.hypot(m.x - p.x, m.y - p.y);
  for (let i = 0; i < 10; i++) h.tickEmberWastes(0.05);
  check('in the storm, a creature at three-quarters of its sight does not come for you', Math.hypot(m.x - p.x, m.y - p.y) >= d0 - 1, { d0, now: Math.hypot(m.x - p.x, m.y - p.y) });
  h.emberStorm.force('calm', 600000);
  put();
  for (let i = 0; i < 10; i++) h.tickEmberWastes(0.05);
  check('in clear air it does', Math.hypot(m.x - p.x, m.y - p.y) < d0 - 10);
  m.dead = true; m.respawnAt = Date.now() + 1e9;

  // weathered: XP, the daybook, and the lore once
  h.emberStorm.force('storm', 0);
  s.sent.length = 0;
  h.tickEmberWastes(0.05);
  check('weather a whole storm out there and you are paid for it, and shown the lore of it the first time', s.sent.some((x) => x.type === 'toast' && /weathered the storm/.test(x.message)) && s.sent.some((x) => x.type === 'vh_board' && /Storms/.test(x.title)));
  check('and it is a line in the daybook', /entry\('storm', '🌫️', 'An ash storm, weathered'/.test(fs.readFileSync(path.join(__dirname, '..', 'lib/daybook.js'), 'utf8')) && /daybook\.note\(p, 'storm'\)/.test(fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8')));
  h.emberStorm.force('gathering', 0); h.tickEmberWastes(0.05); h.emberStorm.force('storm', 0); s.sent.length = 0; h.tickEmberWastes(0.05);
  check('the second time, no lore again', !s.sent.some((x) => x.type === 'vh_board'));

  const main = fs.readFileSync(path.join(__dirname, '..', 'client/main.js'), 'utf8'), cs = fs.readFileSync(path.join(__dirname, '..', 'client/ember-storm.js'), 'utf8'), audio = fs.readFileSync(path.join(__dirname, '..', 'client/audio.js'), 'utf8');
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tools/audio/sfx.manifest.json'), 'utf8'));
  const by = Object.fromEntries(manifest.sfx.map((e) => [e.id, e]));
  check('the client draws it and hears it: fog, ash, the track lit, the wind looped', /msg\.type === 'ember_storm'\) \{ _emberStorm\.apply\(msg\)/.test(main) && /_emberStorm\.update\(dt\)/.test(main) && /stormLights/.test(cs) && /startSfxLoop\('ash_storm_wind'/.test(cs) && /src\.loop = true/.test(audio));
  check('its three sounds have prompts, the wind as a loop', by.ash_storm_rise && by.ash_storm_end && by.ash_storm_wind && by.ash_storm_wind.loop === true);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
