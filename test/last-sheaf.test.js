// The last sheaf (data/lastSheaf.js): plaited at harvest from the best ears,
// as one of three forms the collectors wrote down, kept in the house as a ward
// for its year, and given away as the record has it for that form.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-sheaf-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const fs = require('fs');
const path = require('path');
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

const S = require('../data/lastSheaf');
const { WARDS } = require('../data/wards');
const { buildCharmBook } = require('../lib/charmBook');
const DAY = 24 * 3600 * 1000;

// ── The record, kept to what it says ────────────────────────────────────────
check('three forms: the neck, the kern baby and the Maiden', JSON.stringify(Object.keys(S.SHEAF_FORMS)) === '["neck","kern","maiden"]');
check('each with where it was kept, how it was made, its lore, a folk tier and a source', Object.values(S.SHEAF_FORMS).every((f) => f.name && f.short && f.icon && f.country && f.how && f.hangs && f.put && f.lore && f.tier === 'folk' && f.source));
check('the neck: West Cornwall kept it till the next harvest, East Cornwall gave it to the best ox at Christmas (Courtney)', /until the next harvest/.test(S.SHEAF_FORMS.neck.ends.harvest) && /best ox in the stalls/.test(S.SHEAF_FORMS.neck.ends.yule) && !S.SHEAF_FORMS.neck.ends.plough && /Courtney/.test(S.SHEAF_FORMS.neck.source));
check('…and Hunt\'s "three or four years" is told, not hidden', /three or four years/.test(S.SHEAF_FORMS.neck.lore));
check('the kern baby: on the dresser, and the game says Henderson gives no keeping time', /bink or dresser/.test(S.SHEAF_FORMS.kern.lore) && /does not say how long/.test(S.SHEAF_FORMS.kern.ends.harvest) && Object.keys(S.SHEAF_FORMS.kern.ends).length === 1);
check('the Maiden: kept against the fairies till next harvest (Campbell); Christmas and the first ploughing as Frazer gives them', /keeping them out till next harvest/.test(S.SHEAF_FORMS.maiden.ends.harvest) && /Frazer/.test(S.SHEAF_FORMS.maiden.ends.yule) && /first day of ploughing/.test(S.SHEAF_FORMS.maiden.ends.plough) && /Frazer/.test(S.SHEAF_FORMS.maiden.ends.plough));
check('the sheaf is a ward entry, folk tier, that calls the shop corn dolly a revival', WARDS.sheaf && WARDS.sheaf.tier === 'folk' && /revival/.test(WARDS.sheaf.lore) && /Selvedge/.test(WARDS.sheaf.source));
check('nothing burned, no ergot, no recipe: none of it is in the record we read', !/burn|ergot/i.test(JSON.stringify(S.SHEAF_FORMS) + WARDS.sheaf.lore));

// ── The rules ───────────────────────────────────────────────────────────────
const full = S.SHEAF_EARS.map((f, i) => (f ? i : -1)).filter((i) => i >= 0);
const thin = S.SHEAF_EARS.findIndex((f) => !f);
check('some ears are full and some thin', full.length >= 4 && thin >= 0);
check('the best ears, every one, and a form and an ending it had: allowed', S.sheafProblem({ form: 'neck', end: 'yule', ears: full }) === null);
check('a thin ear in the handful is refused', /thin ear/.test(S.sheafProblem({ form: 'neck', end: 'yule', ears: [...full, thin] })));
check('leaving good ears lying is refused', /better ears/.test(S.sheafProblem({ form: 'neck', end: 'yule', ears: full.slice(1) })));
check('an ending that form never had is refused (the kern baby at the plough)', /not how/.test(S.sheafProblem({ form: 'kern', end: 'plough', ears: full })));
check('plaited at harvest only', S.sheafCanPlait('mabon', null, 0) && S.sheafCanPlait('lughnasadh', null, 0) && !S.sheafCanPlait('samhain', null, 0) && !S.sheafCanPlait('yule', null, 0));
check('…and not over one still having its year', !S.sheafCanPlait('mabon', { at: 0 }, 10 * DAY) && S.sheafCanPlait('mabon', { at: 0 }, 330 * DAY));
check('Christmas comes for a Yule sheaf in Yule; the plough in Imbolc or Ostara', S.sheafEndDue('yule', { end: 'yule', at: 0 }, 90 * DAY) && !S.sheafEndDue('imbolc', { end: 'yule', at: 0 }, 90 * DAY) && S.sheafEndDue('ostara', { end: 'plough', at: 0 }, 200 * DAY) && !S.sheafEndDue('yule', { end: 'harvest', at: 0 }, 200 * DAY));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const say = (s, m) => s.emit('message', JSON.stringify(m));
  function join(tag, key) {
    const s = makeMockSocket(tag); connHandler(s);
    say(s, { type: 'join', name: tag, charId: 0 });
    const p = h.players.get(s.lastOfType('init').id);
    p.accountKey = key; if (!h.accounts[key]) h.accounts[key] = {};
    return { s, p };
  }
  const goHome = (p) => { p.room = 'cottage'; p.instance = 'home_' + p.accountKey; };
  const err = (s) => { const e = s.lastOfType('wards_error'); return e ? e.message : ''; };

  const a = join('Reaper', 'sheaf_a');
  goHome(a.p);
  process.env.TC_SEASON = 'samhain';
  say(a.s, { type: 'plait_last_sheaf', form: 'neck', end: 'yule', ears: full });
  check('out of harvest it is refused, and says when', /Lughnasadh or Mabon/.test(err(a.s)) && !(h.accounts.sheaf_a.wards && h.accounts.sheaf_a.wards.sheaf), err(a.s));
  const st0 = h.wardsStateBody(a.p);
  check('the panel knows it can\'t be plaited now, and when it can', st0.lastSheaf && st0.lastSheaf.canPlait === false && st0.lastSheaf.plaitWhen === 'Lughnasadh or Mabon' && st0.lastSheaf.ears.length === S.SHEAF_EARS.length);

  process.env.TC_SEASON = 'mabon';
  a.p.room = 'outside'; a.p.instance = '';
  say(a.s, { type: 'plait_last_sheaf', form: 'neck', end: 'yule', ears: full });
  check('it is kept at home, not out in the street', /home/.test(err(a.s)) && !(h.accounts.sheaf_a.wards && h.accounts.sheaf_a.wards.sheaf));
  goHome(a.p);
  say(a.s, { type: 'plait_last_sheaf', form: 'neck', end: 'yule', ears: [...full, thin] });
  check('a thin ear spoils it, and nothing is kept', /thin ear/.test(err(a.s)) && !h.accounts.sheaf_a.wards.sheaf);
  const guard0 = h.statContrib(a.p, 'guard');
  say(a.s, { type: 'plait_last_sheaf', form: 'neck', end: 'yule', ears: full });
  const w = h.accounts.sheaf_a.wards;
  check('at harvest, the best ears: the neck hangs, to go to the beasts at Christmas', w.sheaf && w.sheaf.form === 'neck' && w.sheaf.end === 'yule');
  check('…the toast says where it hangs and what will become of it', /beam in the kitchen/.test(a.s.lastOfType('toast').message) && /Christmas it goes to the beasts/.test(a.s.lastOfType('toast').message), a.s.lastOfType('toast').message);
  const { WARD_GUARD } = require('../data/wards');
  check('while it hangs it wards the house like the other marks', Math.abs(h.statContrib(a.p, 'guard') - guard0 - WARD_GUARD) < 1e-9, { before: guard0, after: h.statContrib(a.p, 'guard') });
  check('the house shows which sheaf hangs, for visitors to see', h.wardsPublic('sheaf_a').sheaf === 'neck');
  say(a.s, { type: 'plait_last_sheaf', form: 'maiden', end: 'harvest', ears: full });
  check('one at a time: a second is refused while the first has its year', /still having its year/.test(err(a.s)) && w.sheaf.form === 'neck');
  say(a.s, { type: 'end_last_sheaf' });
  check('Christmas has not come: it cannot be given yet', /Yule/.test(err(a.s)) && w.sheaf);

  // Christmas comes.
  process.env.TC_SEASON = 'yule';
  w.sheaf.at = Date.now() - 100 * DAY;
  check('in Yule the panel offers to give it to the beasts', h.wardsStateBody(a.p).lastSheaf.endDue === true);
  say(a.s, { type: 'end_last_sheaf' });
  check('given to the beasts: it is gone from the house, remembered, and the ward with it', !w.sheaf && w.sheafEnded && w.sheafEnded.form === 'neck' && w.sheafEnded.end === 'yule' && h.wardsPublic('sheaf_a').sheaf === null);
  check('…in the words of the record', /beasts have it for their Christmas/.test(a.s.lastOfType('toast').message));
  const book = buildCharmBook({ acct: h.accounts.sheaf_a, prog: {}, seasonKey: null });
  check('the Charm Book marks the last sheaf met', book.chapters.find((c) => c.key === 'wards').entries.find((e) => e.id === 'sheaf').met === true);

  // A kept-till-harvest sheaf is replaced at the next harvest, not given.
  const b = join('Gleaner', 'sheaf_b');
  goHome(b.p);
  process.env.TC_SEASON = 'lughnasadh';
  say(b.s, { type: 'plait_last_sheaf', form: 'kern', end: 'harvest', ears: full });
  const wb = h.accounts.sheaf_b.wards;
  check('the kern baby is set at the top of the dresser, kept till next harvest', wb.sheaf && wb.sheaf.form === 'kern' && /top of the dresser/.test(b.s.lastOfType('toast').message));
  process.env.TC_SEASON = 'yule';
  say(b.s, { type: 'end_last_sheaf' });
  check('it is not given away at Christmas: it waits for the next harvest', /next harvest/.test(err(b.s)) && wb.sheaf);
  process.env.TC_SEASON = 'mabon';
  wb.sheaf.at = Date.now() - 340 * DAY;
  say(b.s, { type: 'plait_last_sheaf', form: 'maiden', end: 'plough', ears: full });
  check('a year on, at harvest, the old one comes down and this year\'s goes up', wb.sheaf.form === 'maiden' && wb.sheaf.end === 'plough' && wb.sheafEnded.form === 'kern' && /take down last year's kern baby/.test(b.s.lastOfType('toast').message), b.s.lastOfType('toast').message);
  delete process.env.TC_SEASON;

  // The client: the panel and the cottage.
  const wardsJs = fs.readFileSync(path.join(__dirname, '../client/wards.js'), 'utf8');
  const cottage = fs.readFileSync(path.join(__dirname, '../client/cottage-scene.js'), 'utf8');
  check('the Wards panel has the sheaf card and the plaiting (form, the best ears, its ending)', /function sheafCard/.test(wardsJs) && /function renderSheaf/.test(wardsJs) && /type: 'plait_last_sheaf'/.test(wardsJs) && /type: 'end_last_sheaf'/.test(wardsJs) && /How its year ends/.test(wardsJs));
  check('the cottage draws whichever hangs: the kern baby on a shelf, the neck and the Maiden hung up', /if \(w\.sheaf\)/.test(cottage) && /function makeLastSheaf/.test(cottage) && /sheafShelf/.test(cottage));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
