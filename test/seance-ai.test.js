// Séance Board — Phase 3 (the AI voice). The spirit's reply passes through the
// same safety gate as everything else: sanitize (charset + blocklist + cap),
// with a fallback to the hand-written bank on null / reject / failure. The LLM
// client is stubbed (hooks.seanceSpirit.generate) — no network in tests.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-seance-ai-');

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag, _ip: '127.0.0.1',
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
  };
}
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

require('../server.js');

setTimeout(async () => {
  try {
    const wss = global.__wssInstances[0];
    const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
    const hooks = global.__testHooks;
    const join = (name, accountKey) => {
      const s = makeMockSocket(name);
      connHandler(s);
      s.emit('message', JSON.stringify({ type: 'join', name, charId: 0 }));
      const p = hooks.players.get(s.lastOfType('init').id);
      p.accountKey = accountKey; s._isGuest = false;
      return { s, p };
    };

    const A = join('Morgana', 'morgana');
    const B = join('Bramble', 'bramble');
    hooks.accounts.morgana = { username: 'Morgana', salt: 's', hash: 'h', color: '#fff', createdAt: 1 };
    hooks.accounts.bramble = { username: 'Bramble', salt: 's', hash: 'h', color: '#fff', createdAt: 1 };
    hooks.covens.cvs = { id: 'cvs', name: 'Night Hags', sigil: '🌙', members: ['morgana', 'bramble'], leaderKey: 'morgana' };
    hooks.covenIndex.set('morgana', 'cvs');
    hooks.covenIndex.set('bramble', 'cvs');
    const cv = hooks.covens.cvs;
    A.p.room = 'manor'; A.p.instance = 'coven_cvs';
    B.p.room = 'manor'; B.p.instance = 'coven_cvs';

    const setGen = (fn) => { hooks.seanceSpirit.generate = fn; };
    // Disable lore hints here so the AI/fallback source assertions are
    // deterministic — hint behaviour is covered by test/seance-lore.test.js.
    // NOTE: Samhain floors the hint chance to 0.20 regardless of CONFIG (and when
    // these tests run on Oct 31 it IS Samhain), so zeroing the config isn't
    // enough — stub shouldHint to false so no hint ever fires here.
    hooks.seance.CONFIG.HINT_CHANCE = 0;
    hooks.seance.CONFIG.HINT_CHANCE_BLOODMOON = 0;
    hooks.seance.shouldHint = () => false;

    // ── AI path: a clean spirit reply is sanitized and used verbatim ─────
    setGen(async () => 'the veil THINS at midnight');
    let r = await hooks.resolveSeanceAnswer(cv, 'morgana', 'who are you');
    check('a clean AI reply is used, uppercased to the board charset', r.source === 'ai' && r.message === 'THE VEIL THINS AT MIDNIGHT', r);

    // ── reject path: garbage that survives nothing → fallback bank ───────
    setGen(async () => '!!!   ');
    r = await hooks.resolveSeanceAnswer(cv, 'morgana', 'x');
    check('an unspellable AI reply falls back to the bank', r.source === 'fallback' && hooks.seance.FALLBACK_LINES.includes(r.message), r);

    // ── null path: no answer → fallback ──────────────────────────────────
    setGen(async () => null);
    r = await hooks.resolveSeanceAnswer(cv, 'morgana', 'x');
    check('a null AI reply falls back', r.source === 'fallback' && hooks.seance.FALLBACK_LINES.includes(r.message), r);

    // ── throw path: generation error → fallback (never throws out) ───────
    setGen(async () => { throw new Error('boom'); });
    r = await hooks.resolveSeanceAnswer(cv, 'morgana', 'x');
    check('a thrown AI error falls back', r.source === 'fallback', r);

    // ── a too-long AI reply is capped by the sanitizer ───────────────────
    setGen(async () => 'word '.repeat(40));
    r = await hooks.resolveSeanceAnswer(cv, 'morgana', 'x');
    check('a runaway AI reply is length-capped', r.message.length <= hooks.seance.CONFIG.MAX_CHARS, r.message.length);

    // ── the spirit is fed live world facts (so it can answer about the moon) ──
    let capturedCtx = null;
    setGen(async (ctx) => { capturedCtx = ctx; return 'soon'; });
    await hooks.resolveSeanceAnswer(cv, 'morgana', 'when is the next full moon');
    check('the prompt carries live world facts', capturedCtx && typeof capturedCtx.facts === 'string' && /moon|night|day/i.test(capturedCtx.facts), capturedCtx && capturedCtx.facts);
    check('the asked question reaches the spirit', capturedCtx && /full moon/i.test(capturedCtx.question || ''), capturedCtx && capturedCtx.question);

    // ── end to end: seance_start → the AI reply is spelled and ends ──────
    // shrink the ritual timings so the full run finishes fast
    Object.assign(hooks.seance.CONFIG, { BUILDUP_MS: 20, TRAVEL_MS: 8, DWELL_MS: 4, SPACE_MS: 6, CLOSE_MS: 20 });
    setGen(async () => 'soon');
    hooks.ensureBankAccount('morgana').balance = 100;
    cv.seanceCdUntil = 0;
    A.s.emit('message', JSON.stringify({ type: 'seance_start', question: 'when' }));
    check('the channel opens at once (begin broadcast)', !!A.s.lastOfType('seance_begin') && !!B.s.lastOfType('seance_begin'));
    await delay(500);
    const end = B.s.lastOfType('seance_end');
    check('the AI answer is spelled through to GOODBYE for everyone present', end && end.message === 'SOON', end);
    check('the session cleared itself when it finished', !hooks.seanceSessions.has('cvs'));

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  } catch (e) {
    console.log('FAIL - unexpected error:', (e && e.stack) || e);
    process.exit(1);
  }
}, 200);
