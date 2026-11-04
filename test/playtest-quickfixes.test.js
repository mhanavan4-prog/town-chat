// Playtest quick-fixes (Nov 4 review): a harvest in TOWN now ticks the First
// Steps "harvested" goal (it used to count only Wilds plants, which read as a
// bug), and the Witch's default hotbar never leads with a consent-based spell
// (Open 3rd Eye asked a stranger for camera access on a new player's first key).
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-pqf-');
const fs = require('fs');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {},
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

  // ── A town harvest ticks First Steps ───────────────────────────────────────
  const s = makeMockSocket('Harvester'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Harvester', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  const tree = h.WORLD.natureDecor.find((d) => h.HARVEST_TYPES.has(d.type));
  check('town has a harvestable decor node', !!tree);
  p.room = 'outside'; p.x = tree.x; p.y = tree.y;
  check('harvested starts unticked', !h.firstStepsPayload(p).steps.find((x) => x.id === 'harvested').done);
  s.emit('message', JSON.stringify({ type: 'harvest', decorId: tree.id }));
  check('the town harvest succeeded', !!s.lastOfType('harvest_result'), s.lastOfType('harvest_error'));
  check('a town harvest ticks the First Steps goal', h.firstStepsPayload(p).steps.find((x) => x.id === 'harvested').done === true);
  const label = h.FIRST_STEPS.find((x) => x.id === 'harvested').label;
  check('the goal label no longer says Wilds-only', !/in the Wilds$/.test(label), label);

  // ── Default hotbar order: consent abilities last, damage leads ─────────────
  // The client helper is pure; evaluate it from main.js source.
  const src = fs.readFileSync(require('path').join(__dirname, '../client/main.js'), 'utf8');
  const start = src.indexOf('const CONSENT_EFFECTS');
  const end = src.indexOf('function orderedAbilityIds');
  const defaultAbilityOrder = new Function(src.slice(start, end) + '\nreturn defaultAbilityOrder;')();
  const witch = {
    open_third_eye: { effect: 'camera' }, toads_tongue: { effect: 'status' },
    stumble_hex: { effect: 'trap' }, fireball: { effect: 'damage' }, withering_hex: { effect: 'status' },
  };
  const order = defaultAbilityOrder(witch);
  check('slot 1 is a damage spell, not the camera ask', order[0] === 'fireball', order);
  check('the camera ask moves to the end', order[order.length - 1] === 'open_third_eye', order);
  check('nothing is lost from the bar', order.length === 5 && new Set(order).size === 5);
  const wolf = { savage_bite: { effect: 'damage' }, scent_trail: { effect: 'howl_location' }, iron_pelt: { effect: 'status' } };
  const wo = defaultAbilityOrder(wolf);
  check('a kit that already leads with damage keeps its lead', wo[0] === 'savage_bite', wo);
  check('the howl location ask moves to the end', wo[wo.length - 1] === 'scent_trail', wo);
  const necro = { raise_skeleton: { effect: 'summon' }, bone_spear: { effect: 'damage' } };
  check('a summon lead is left alone', defaultAbilityOrder(necro)[0] === 'raise_skeleton');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
