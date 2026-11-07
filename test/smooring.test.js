// Smooring and kindling the fire (Carmina Gadelica, 1900): smoor at night at
// your own hearth, kindle next morning from the kept embers.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-smoor-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { SMOORING, KINDLING, HEARTH_BUFFS } = require('../data/hearth.js');
const { buildCharmBook } = require('../lib/charmBook.js');
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

check('the smooring blessing as Carmichael printed it', SMOORING.verse.join(' ') === 'The sacred Three To save, To shield, To surround The hearth, The house, The household, This eve, This night, Oh! this eve, This night, And every night, Each single night.');
check('three peats for Life, Peace and Grace; ashes to subdue, not extinguish', /God of Life/.test(SMOORING.lore) && /God of Peace/.test(SMOORING.lore) && /God of Grace/.test(SMOORING.lore) && /subdue but not to extinguish/.test(SMOORING.lore) && /Tula nan Tri/.test(SMOORING.lore));
check('the kindling blessing\'s first lines', KINDLING.verse[0] === 'I will kindle my fire this morning' && /holy angels of heaven/.test(KINDLING.verse[1]));
check('both from Carmina Gadelica (1900), badged record', /Carmina Gadelica, vol\. 1 \(1900\)/.test(SMOORING.source) && SMOORING.tier === 'record' && KINDLING.tier === 'record');
check('small buffs: a guard at night, vitality by day', HEARTH_BUFFS.smoor.stat === 'guard' && HEARTH_BUFFS.smoor.amount <= 0.1 && HEARTH_BUFFS.kindle.stat === 'vitality');

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const s = makeMockSocket('Crofter'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Crofter', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'crofter'; h.accounts.crofter = {}; h.playerProgress.crofter = { level: 1, xp: 0 };
  const CYCLE = 40 * 60000, DAYMS = 20 * 60000;
  const n = 1000000;
  const night = n * CYCLE + DAYMS + 5 * 60000, morning = (n + 1) * CYCLE + 5 * 60000, nextNight = (n + 1) * CYCLE + DAYMS + 60000;

  p.room = 'outside';
  check('not at your hearth: no smooring', /own hearth/.test(at(night, () => h.tendHearth(p, 'smoor')).error || ''));
  p.room = 'cottage'; p.instance = 'home_crofter';
  check('in the morning with no embers kept, nothing to kindle', /No embers were kept/.test(at(morning - CYCLE, () => h.tendHearth(p, 'kindle')).error || ''));
  const sm = at(night, () => h.tendHearth(p, 'smoor'));
  check('at night at your own hearth, the fire is smoored with the blessing', sm.toast && /The sacred Three/.test(sm.toast) && h.accounts.crofter.hearth.smooredNight === n, sm);
  const gNight = at(night, () => h.statContrib(p, 'guard')), gDawn = at(morning, () => h.statContrib(p, 'guard'));
  check('…and the house is guarded till dawn', Math.abs(gNight - gDawn - HEARTH_BUFFS.smoor.amount) < 1e-9 && h.accounts.crofter.hearthBuff.until === (n + 1) * CYCLE, [gNight, gDawn]);
  check('once a night', /smoored for the night/.test(at(night + 60000, () => h.tendHearth(p, 'smoor')).error || ''));
  check('you cannot kindle in the dark', /smoored for the night/.test(at(night + 60000, () => h.tendHearth(p, 'kindle')).error || ''));
  const kd = at(morning, () => h.tendHearth(p, 'kindle'));
  check('next morning the kept embers kindle, with the morning blessing', kd.toast && /I will kindle my fire this morning/.test(kd.toast));
  const vDay = at(morning, () => h.statContrib(p, 'vitality')), vDusk = at(nextNight, () => h.statContrib(p, 'vitality'));
  check('…a little warmth till dusk', Math.abs(vDay - vDusk - HEARTH_BUFFS.kindle.amount) < 1e-9 && h.accounts.crofter.hearthBuff.until === (n + 1) * CYCLE + DAYMS, [vDay, vDusk]);
  check('once a day', /kindled for the day/.test(at(morning + 60000, () => h.tendHearth(p, 'kindle')).error || ''));
  check('the next morning, unsmoored, there is nothing to kindle', /No embers were kept/.test(at(morning + CYCLE, () => h.tendHearth(p, 'kindle')).error || ''));

  const home = at(nextNight, () => { s.sent.length = 0; s.emit('message', JSON.stringify({ type: 'home_state' })); return s.lastOfType('home_state'); });
  check('the cottage panel carries the hearth: smoor tonight, with the verse', home && home.hearthFire && home.hearthFire.night && home.hearthFire.canSmoor && home.hearthFire.smooring.verse.length === 13);
  const ch = buildCharmBook({ acct: h.accounts.crofter, prog: {}, seasonKey: null }).chapters.find((c) => c.key === 'household');
  check('the Charm Book writes in the smooring and the kindling', ch && ch.entries.find((e) => e.id === 'smooring').met && ch.entries.find((e) => e.id === 'kindling').met);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
