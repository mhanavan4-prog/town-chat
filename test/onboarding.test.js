// Onboarding pass — First Steps now has four goals (talk, ability, kill,
// harvest), pays a 50g first-win purse on completion, and a brand-new arrival
// gets a one-time welcome card.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-onboard-');

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
    allOfType(t) { return this.sent.filter(m => m.type === t); },
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

  // ── Step set ──
  const ids = hooks.FIRST_STEPS.map(s => s.id);
  check('First Steps has four goals', hooks.FIRST_STEPS.length === 4, ids);
  check('the new "ability" step is present', ids.includes('ability'), ids);
  check('the four pillars are covered', ['talked', 'ability', 'killed', 'harvested'].every(x => ids.includes(x)), ids);

  const A = join('Novice');
  const payload = hooks.firstStepsPayload(A.p, null);
  check('the payload lists all four, none done', payload.steps.length === 4 && payload.steps.every(s => !s.done), payload.steps);
  check('the first-win purse is 50 gold', payload.rewardGold === 50, payload.rewardGold);

  // ── Completion needs all four ──
  hooks.noteFirstStep(A.p, 'talked');
  hooks.noteFirstStep(A.p, 'ability');
  hooks.noteFirstStep(A.p, 'killed');
  check('three of four is not yet complete', !hooks.firstStepsPayload(A.p).done, hooks.firstStepsPayload(A.p));
  hooks.noteFirstStep(A.p, 'harvested');
  check('all four completes First Steps', hooks.firstStepsPayload(A.p).done === true);
  check('completion announces the first win', A.s.allOfType('announce_soft').some(m => /First Steps complete/.test(m.message)), A.s.allOfType('announce_soft'));

  // ── Idempotence / no double counting ──
  const before = A.s.allOfType('announce_soft').length;
  hooks.noteFirstStep(A.p, 'talked'); // already done → no-op
  check('re-noting a done tracker does nothing', A.s.allOfType('announce_soft').length === before);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 200);
