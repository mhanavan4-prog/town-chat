// The need-fire (tein-éigin): a caller rite against the murrain — every hearth
// put out, new fire made by friction, the cattle driven through the smoke — and
// your own hearth lit again from it.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-needfire-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { HOUSEHOLD_RITES } = require('../data/household.js');
const { CALLERS } = require('../data/callers.js');
const { HEARTH_BUFFS } = require('../data/hearth.js');
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

const R = HOUSEHOLD_RITES.need_fire;
check('the need-fire is a household rite, badged record', R && R.tier === 'record' && R.icon && R.outcomes.length === 3);
check('Martin\'s words: "a forced fire, or fire of necessity", eighty-one married men, two planks', /"a forced fire, or fire of necessity"/.test(R.lore) && /eighty-one married men/.test(R.lore) && /two planks/.test(R.lore) && /Martin, A Description of the Western Islands of Scotland \(1703\)/.test(R.source));
check('Frazer\'s survey and the 8th-century "nodfyr"', /Frazer, Balder the Beautiful \(1913\)/.test(R.source) && /"nodfyr"/.test(R.lore) && /Indiculus superstitionum, no\. 15/.test(R.source));
check('how: every fire out, friction, the cattle through the smoke, the new fire carried home', /every fire/.test(R.how) && /Rub two planks/.test(R.how) && /through the smoke/.test(R.how) && /carry the new fire home/.test(R.how));
check('every sign fits whole on the Board', R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
const c = CALLERS.find((x) => x.id === 'need_fire_murrain');
check('a caller with the murrain, any time of year: wood, then the rite', c && !c.season && c.steps[0].kind === 'deliver' && c.steps[0].item === 'wood' && c.steps[1].kind === 'rite' && c.steps[1].rite === 'need_fire');

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Crofter'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Crofter', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'crofter'; h.accounts.crofter = {}; h.playerProgress.crofter = { level: 1, xp: 0 };
  const CYCLE = 40 * 60000, DAYMS = 20 * 60000, n = 1000000;
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };

  // Through the real rite handler, by day.
  const day = n * CYCLE + 5 * 60000;
  at(day, () => {
    h.callers.stateOf(p);
    h.accounts.crofter.callers.active = { id: c.id, done: { 0: 'delivered' } };
    s.sent.length = 0;
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[1];
  check('working the rite gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  check('…and writes it into the account\'s rites', (h.accounts.crofter.ritesDone || []).includes('need_fire'));
  const toasts = s.sent.filter((m) => m.type === 'toast').map((m) => m.message);
  check('your own hearth is lit again from the need-fire', toasts.some((t) => /lit again from the need-fire/.test(t) && /till dusk/.test(t)), toasts);
  const hb = h.accounts.crofter.hearthBuff;
  check('…a day\'s kindling: +vitality till dusk', hb && hb.stat === 'vitality' && hb.amount === HEARTH_BUFFS.kindle.amount && hb.until === n * CYCLE + DAYMS, hb);
  check('…and counted as today\'s kindling', h.accounts.crofter.hearth.kindledDay === n && h.accounts.crofter.hearth.needFireCount === 1);
  p.room = 'cottage'; p.instance = 'home_crofter';
  const body = at(day + 60000, () => h.hearthFireBody(p));
  check('the cottage panel says the fire was lit from the need-fire', body && /lit today from the need-fire/.test(body.note) && !body.canKindle, body && body.note);
  check('…so no second kindling today', /lit today from the need-fire/.test(at(day + 60000, () => h.tendHearth(p, 'kindle')).error || ''));

  // At night the new fire is in the grate, ready to smoor.
  const night = n * CYCLE + DAYMS + 5 * 60000;
  const t2 = h.lightFromNeedFire(p, night);
  check('at night: lit till dawn', /till dawn/.test(t2) && h.accounts.crofter.hearthBuff.until === (n + 1) * CYCLE);
  const sm = at(night + 60000, () => h.tendHearth(p, 'smoor'));
  check('…and the new fire can be smoored for the night', sm.toast && /The sacred Three/.test(sm.toast), sm);
  check('a guest has no hearth to light', h.lightFromNeedFire({ room: 'town' }) === null);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
