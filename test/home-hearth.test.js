// The home hearth — brewing in your own cottage steeps longer (the housing ↔
// brewing half of the grow-at-home / brew-at-home loop). Covers the hearth
// duration bonus, that it stacks on the base steep, that it applies only in your
// OWN cottage (not while visiting), and the atHearth flag in tea_state.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-hearth-');

const { TEAS } = require('../data/teas.js');

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

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  function join(tag, key) {
    const s = makeMockSocket(tag); connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: 0 }));
    const p = h.players.get(s.lastOfType('init').id);
    if (key) { p.accountKey = key; if (!h.accounts[key]) h.accounts[key] = {}; }
    return { s, p };
  }
  const BONUS = h.HEARTH_BREW_BONUS;
  // A plain planetary tea (not the capstone, not a sabbat tea), so brewing is free
  // of gates; grant plenty of its herbs.
  const tea = TEAS.find((t) => !t.requires && !t.sabbat && t.herbs && t.herbs.length);
  const g = join('Brewer', 'hearthbrewer');
  const stock = () => { for (const ing of tea.herbs) h.grantLoot([{ kind: 'item', itemId: ing.id, qty: ing.qty * 2 }], g.p); };
  const brewDur = () => {
    const t0 = Date.now();
    g.s.emit('message', JSON.stringify({ type: 'brew_tea', teaId: tea.id }));
    const buff = h.accounts.hearthbrewer.teaBuff;
    return buff.until - t0;
  };

  // ── Away from home: the base steep ──────────────────────────────────────────
  g.p.room = 'outside'; g.p.instance = '';
  check('away from home, tea_state reports atHearth false', h.teaStateBody(g.p).atHearth === false);
  stock();
  const away = brewDur();

  // ── At your own hearth: the longer steep ────────────────────────────────────
  g.p.room = 'cottage'; g.p.instance = 'home_hearthbrewer';
  check('in your own cottage, tea_state reports atHearth true', h.teaStateBody(g.p).atHearth === true);
  check('tea_state ships the hearth bonus', h.teaStateBody(g.p).hearthBonus === BONUS);
  stock();
  const home = brewDur();
  const ratio = home / away;
  check('a hearth steep holds the bonus longer than away (same tea, same day)', Math.abs(ratio - BONUS) < 0.02, { away, home, ratio, BONUS });
  check('the hearth bonus is a real increase', home > away);

  // ── Visiting someone else's cottage gets no hearth bonus ────────────────────
  g.p.room = 'cottage'; g.p.instance = 'home_someone_else';
  check('visiting another cottage reports atHearth false', h.teaStateBody(g.p).atHearth === false);
  stock();
  const visiting = brewDur();
  check('brewing while visiting gets only the base steep', Math.abs(visiting - away) < 50, { visiting, away });

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
