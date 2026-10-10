// Coven standings & the Champions' Table — the weekly inter-coven contest.
// A coven's standing is the sum of its current members' weekly board scores
// (hunt + tourney ×1, boss ×15, delve ×10). The week's leader holds the table.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-covenstand-');

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
  };
}
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

require('../server.js');

setTimeout(() => {
  const hooks = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];

  function join(tag) {
    const s = makeMockSocket(tag);
    connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: 0 }));
    const p = hooks.players.get(s.lastOfType('init').id);
    p.accountKey = tag.toLowerCase(); s._isGuest = false;
    return { s, p };
  }
  const A = join('Ada'), B = join('Bea'), C = join('Cyn');

  // Two covens: Nightshade (Ada + Bea), Moonwell (Cyn).
  hooks.covens['cv_ns'] = { id: 'cv_ns', name: 'Nightshade', sigil: '🌙', members: ['ada', 'bea'], leaderKey: 'ada', bank: { gold: 0, slots: [] }, log: [] };
  hooks.covens['cv_mw'] = { id: 'cv_mw', name: 'Moonwell', sigil: '🔮', members: ['cyn'], leaderKey: 'cyn', bank: { gold: 0, slots: [] }, log: [] };
  hooks.covenIndex.set('ada', 'cv_ns'); hooks.covenIndex.set('bea', 'cv_ns'); hooks.covenIndex.set('cyn', 'cv_mw');

  // Seed the weekly boards. Weights: hunt/tourney 1, boss 15, delve 10.
  //   Nightshade = Ada(10 hunt) + Bea(1 boss=15, 2 delve=20) = 10 + 15 + 20 = 45
  //   Moonwell   = Cyn(30 hunt) = 30
  hooks.lbBump('hunt', A.p, 10);
  hooks.lbBump('boss', B.p, 1);
  hooks.lbSetMax('delve', B.p, 2);
  hooks.lbBump('hunt', C.p, 30);

  const wk = hooks.weekKey(Date.now());
  const rows = hooks.covenStandings(wk);

  check('both covens appear in the standings', rows.length === 2, rows.map(r => r.name));
  check('Nightshade leads on weighted points (45 > 30)', rows[0].name === 'Nightshade' && rows[0].points === 45, rows);
  check('Moonwell is second with 30', rows[1].name === 'Moonwell' && rows[1].points === 30, rows);
  check('the breakdown sums members correctly', rows[0].breakdown.hunt === 10 && rows[0].breakdown.boss === 1 && rows[0].breakdown.delve === 2, rows[0].breakdown);

  // Champions' Table = the current leader.
  const champ = hooks.covenChampionBody();
  check('the Champions’ Table is held by the leader', champ && champ.name === 'Nightshade' && champ.points === 45, champ);

  // End-to-end via the message handler.
  A.s.emit('message', JSON.stringify({ type: 'coven_standings' }));
  const reply = A.s.lastOfType('coven_standings');
  check('coven_standings request returns the ranked board', !!reply && reply.standings[0].name === 'Nightshade', reply && reply.standings);
  check('the requester’s own coven id is flagged', reply && reply.myCovenId === 'cv_ns', reply && reply.myCovenId);
  check('the week has an end timestamp in the future', reply && reply.endsAt > Date.now(), reply && reply.endsAt);

  // A coven with no scoring members earns zero and still lists.
  hooks.covens['cv_empty'] = { id: 'cv_empty', name: 'Hollow', sigil: '🕯️', members: ['nobody'], leaderKey: 'nobody', bank: { gold: 0, slots: [] }, log: [] };
  const rows2 = hooks.covenStandings(wk);
  const hollow = rows2.find(r => r.name === 'Hollow');
  check('an unscored coven lists at zero points', hollow && hollow.points === 0, hollow);
  check('zero-point covens sort below scored ones', rows2[rows2.length - 1].name === 'Hollow', rows2.map(r => r.name));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 200);
