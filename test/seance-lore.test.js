// Séance Board — Phase 4 (lore hints). A fraction of séances carry a real story
// hint: the seed is slipped into the spirit prompt (source 'ai_hint'), or the
// curated line is spelled directly when the AI is off/declines (source 'lore').
// Every route still passes the sanitizer. Spirit is stubbed — no network.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-seance-lore-');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

require('../server.js');

setTimeout(async () => {
  try {
    const hooks = global.__testHooks;
    const cv = { id: 'cvL', name: 'The Test Coven' };
    const CFG = hooks.seance.CONFIG;
    const loreLines = hooks.seance.LORE_HINTS.map((h) => hooks.seance.sanitize(h.line));
    const setGen = (fn) => { hooks.seanceSpirit.generate = fn; };
    const orig = { h: CFG.HINT_CHANCE, b: CFG.HINT_CHANCE_BLOODMOON };

    // ── force a hint, AI OFF → the curated lore line is spelled directly ──
    CFG.HINT_CHANCE = 1; CFG.HINT_CHANCE_BLOODMOON = 1;
    let captured = null;
    setGen(async (ctx) => { captured = ctx; return null; }); // AI declines
    let r = await hooks.resolveSeanceAnswer(cv, 'k', 'who holds the door');
    check('a hint with no AI yields a lore line', r.source === 'lore' && loreLines.includes(r.message), r);
    check('the hint seed was slipped into the prompt context', captured && typeof captured.secret === 'string' && captured.secret.length > 0, captured && captured.secret);

    // ── force a hint, AI ON → the spirit speaks it (sanitized), source ai_hint ──
    setGen(async () => 'the fifth HAND still stirs');
    r = await hooks.resolveSeanceAnswer(cv, 'k', 'x');
    check('a hint with AI on is an ai_hint, sanitized', r.source === 'ai_hint' && r.message === 'THE FIFTH HAND STILL STIRS', r);

    // ── no hint → ordinary AI / fallback behaviour is unchanged ──
    CFG.HINT_CHANCE = 0; CFG.HINT_CHANCE_BLOODMOON = 0;
    setGen(async () => 'soon');
    r = await hooks.resolveSeanceAnswer(cv, 'k', 'x');
    check('no hint + AI on → plain ai', r.source === 'ai' && r.message === 'SOON', r);
    setGen(async () => null);
    r = await hooks.resolveSeanceAnswer(cv, 'k', 'x');
    check('no hint + AI declines → fallback bank', r.source === 'fallback' && hooks.seance.FALLBACK_LINES.includes(r.message), r);

    CFG.HINT_CHANCE = orig.h; CFG.HINT_CHANCE_BLOODMOON = orig.b;
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  } catch (e) {
    console.log('FAIL - unexpected error:', (e && e.stack) || e);
    process.exit(1);
  }
}, 200);
