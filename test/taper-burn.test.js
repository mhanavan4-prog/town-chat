// The taper burn mark, scorched on the door frame: the flame held at a slant,
// as Dean & Hill found the marks were made, for long enough to char the tear-
// shape and no longer. The server checks the angle and the time; the lore is
// record-tier and its practical half is candle safety and leaving real marks be.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-burn-');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });
function makeMockSocket(tag) {
  return { OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag, on(e, cb) { this._handlers[e] = cb; }, send(d) { this.sent.push(JSON.parse(d)); }, emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); }, lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; } };
}
const { WARDS, burnProblem, WARD_GUARD } = require('../data/wards');
const B = WARDS.burn;
check('45° held five seconds makes the tear-shape', burnProblem(45, 5) === null);
check('straight up, it only smokes the wood', /only smokes/.test(burnProblem(10, 5) || ''));
check('nearly flat, an amorphous scorch (Dean & Hill\'s unattended light)', /amorphous scorch/.test(burnProblem(80, 5) || ''));
check('too short, a smudge; too long, it catches: "that is how houses burn"', /longer/.test(burnProblem(45, 1) || '') && /how houses burn/.test(burnProblem(45, 20) || ''));
check('nonsense is refused, not thrown', !!burnProblem('x', null));
check('lore: Historic England\'s "even hidden beneath floors"; Dean & Hill\'s 45° and "linear burns or amorphous scorches"', /"even hidden beneath floors"/.test(B.lore) && /"at a 45° angle"/.test(B.lore) && /"linear burns or amorphous scorches"/.test(B.lore) && /J\. Dean & N\. Hill/.test(B.source));
check('…the dates, Knole, and why "is not known"', /later thirteenth century to the mid-nineteenth/.test(B.lore) && /Knole/.test(B.lore) && /Why is not known/.test(B.lore));
check('…and the honest half: candle safety, and leave real marks be', /heat-resistant holder/.test(B.lore) && /never left burning unattended/.test(B.lore) && /leave it and record it/.test(B.lore) && /London Fire Brigade/.test(B.source) && B.tier === 'record');
check('the daisy wheel\'s HEAG288 date is the current edition\'s', /HEAG288 \(2021\)/.test(WARDS.hexafoil.source) && !/\(2018\)/.test(WARDS.hexafoil.source));

require('../server.js');
setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const say = (s, m) => s.emit('message', JSON.stringify(m));
  const s = makeMockSocket('Burner'); connHandler(s);
  say(s, { type: 'join', name: 'Burner', charId: 0 });
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'burn_a'; h.accounts.burn_a = {};
  p.room = 'outside'; p.instance = '';
  say(s, { type: 'burn_mark', angle: 45, seconds: 5 });
  check('burned at home, not in the square', !(h.accounts.burn_a.wards && h.accounts.burn_a.wards.burn));
  p.room = 'cottage'; p.instance = 'home_burn_a';
  const g0 = h.statContrib(p, 'guard');
  say(s, { type: 'burn_mark', angle: 80, seconds: 5 });
  check('a flat flame is refused with the reason', !h.accounts.burn_a.wards.burn && /amorphous/.test((s.lastOfType('wards_error') || {}).message || ''));
  say(s, { type: 'burn_mark', angle: 44, seconds: 4.7 });
  check('the true mark is burned and guards', !!h.accounts.burn_a.wards.burn && Math.abs(h.statContrib(p, 'guard') - g0 - WARD_GUARD) < 1e-9);
  check('…and a visitor sees it', h.wardsPublic('burn_a').burn === true);
  say(s, { type: 'wards_state' });
  const st = s.lastOfType('wards_state');
  check('the panel is told the window to aim for', st && Array.isArray(st.burnAngle) && Array.isArray(st.burnHold) && st.burn === true);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
