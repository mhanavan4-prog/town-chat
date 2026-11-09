// The witch post: the carved oak heck posts of the North York Moors, badged
// folk, honest that nobody knows what they were for, with the practical half:
// the post carries the smoke hood.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-witchpost-');
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

const R = HOUSEHOLD_RITES.witch_post;
check('the witch post is a household rite, badged folk, three signs that fit the Board', R && R.tier === 'folk' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('what it is: the heck post by the hearth, carrying the smoke hood, a St Andrew\'s cross', /heck post/.test(R.lore) && /smoke hood/.test(R.lore) && /St Andrew's cross/.test(R.lore));
check('about twenty to twenty-five known, three at Ryedale, one dated 1664 at Glaisdale', /about twenty to twenty-five are known/.test(R.lore) && /Ryedale Folk Museum has three/.test(R.lore) && /Glaisdale, was dated 1664/.test(R.lore) && /Ryedale Folk Museum, "Witch Posts" \(2020\)/.test(R.source) && /list entry 1148581/.test(R.source));
check('the Pitt Rivers post of 1884, "for the purpose of keeping off fairies"', /"for the purpose of keeping off fairies"/.test(R.lore) && /Pitt Rivers Museum 1884\.56\.1/.test(R.source));
check('the crooked sixpence and the churn are told as later tellers\' stories', /Later tellers said/.test(R.lore) && /crooked sixpence/.test(R.lore) && /churn/.test(R.lore));
check('honest that the purpose is not known (one idea: a house where mass was safe; no unsourced "decoration")', /What they were really for is not known/.test(R.lore) && /"in which it was safe to celebrate mass"/.test(R.lore) && !/decoration/.test(R.lore) && /Whitby Museum, "Do you know about witch posts\?"/.test(R.source));
const c = CALLERS.find((x) => x.id === 'witch_post_longhouse');
check('a caller any time of year, working the rite', c && !c.season && !c.when && c.steps.some((s) => s.kind === 'rite' && s.rite === 'witch_post'));
check('the practical half: it carries the smoke hood, so leave it in, and let the museum draw it', /heck post, and it carries the smoke hood/.test(c.resolution) && /hood comes down/.test(c.resolution) && /folk museum/.test(c.resolution));
check('…and the stories called late', /written down long after/.test(c.resolution) && c.tier === 'folk');

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Moors'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Moors', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'moors'; h.accounts.moors = {}; h.playerProgress.moors = { level: 1, xp: 0 };
  h.callers.stateOf(p);
  h.accounts.moors.callers.active = { id: c.id, done: {} };
  s.emit('message', JSON.stringify({ type: 'rite_do' }));
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.moors, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'against');
  const e = ch.entries.find((x) => x.id === 'witch_post');
  check('…and writes the Witch Post into Against the Witch, badged folk', e && e.met && e.tier === 'folk');
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
