// The dried cat: cats found sealed in old buildings, the three reasons Howard
// weighed (1951), honest that nobody wrote down why, and the practical half:
// don't burn it or clean it, record it, tell the museum.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-driedcat-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { HOUSEHOLD_RITES } = require('../data/household.js');
const { CALLERS } = require('../data/callers.js');
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

const R = HOUSEHOLD_RITES.dried_cat;
check('the dried cat is a household rite, badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Howard\'s two explanations (1951): sacrifice, or a scarecrow for the vermin; some crept in', /Margaret Howard\'s of 1951, offered two explanations/.test(R.lore) && !/three reasons/.test(R.lore) && /sacrifice/.test(R.lore) && /scarecrow for the rats/.test(R.lore) && /crawled into a cavity/.test(R.lore) && /Howard, "Dried Cats", Man 51 \(1951\)/.test(R.source));
check('some crept in (Worcester); Soane\'s Lothbury cat found with the rat in its mouth, not "posed"', /Worcester/.test(R.lore) && !/posed/.test(R.lore) && /"between the wall and the wainscoting of a Room with the Rat in its mouth"/.test(R.lore) && /Soane's Museum, BL1/.test(R.source));
check('the Sudbury cat put back "after four years eventful absence", as the plaque has it', /"after four years eventful absence"/.test(R.lore) && /Mill Hotel, Sudbury/.test(R.source));
check('honest about the gap: nobody wrote down why', /Nobody wrote down why a cat was put in a wall/.test(R.lore));
check('the rite does not clean it and puts it back as found', /Do not clean it/.test(R.how) && /as it was found/.test(R.how));
const c = CALLERS.find((x) => x.id === 'dried_cat_hearth');
check('a caller any time of year, working the rite', c && !c.season && !c.when && c.steps.some((s) => s.kind === 'rite' && s.rite === 'dried_cat'));
check('the practical half: don\'t burn or clean it, mark where it lay, tell the museum', /don't burn it and don't clean it/.test(c.resolution) && /mark exactly where it was and how it lay/.test(c.resolution) && /museum/.test(c.resolution) && /Guidance for Finders/.test(c.source));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Hearth'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Hearth', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'hearth'; h.accounts.hearth = {}; h.playerProgress.hearth = { level: 1, xp: 0 };
  h.callers.stateOf(p);
  h.accounts.hearth.callers.active = { id: c.id, done: {} };
  s.emit('message', JSON.stringify({ type: 'rite_do' }));
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.hearth, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'household');
  check('…and writes the Dried Cat into The House and the Hive', ch.entries.find((e) => e.id === 'dried_cat').met);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
