// Three more marks you draw yourself, after the daisy wheel: the Marian VV cut
// on the hearth beam, the SATOR square written on a plate by the hearth, and
// Gawain's pentangle painted on shield and coat in one unbroken stroke. The
// server holds the boards and checks every drawing against the record's rules;
// the house marks are worked only at home and guard; the pentangle goes with
// you and adds health; and the lore carries its sources and the honest half.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-marks-');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
  };
}

const { WARDS, MARIAN_TOPS, MARIAN_BOTTOMS, marianProblem, PENTANGLE_POINTS, pentangleProblem, PENTANGLE_VITALITY, satorProblem, WARD_GUARD } = require('../data/wards');

// ── The rules of each drawing, as the record gives them ────────────────────
check('a VV: two Vs, the second\'s first arm crossing the first\'s second', marianProblem([[0, 0], [2, 0], [1, 1], [3, 1]]) === null);
check('…a wider VV is a VV too', marianProblem([[1, 1], [3, 1], [2, 2], [4, 2]]) === null);
check('two Vs standing apart are not the mark', /stand apart/.test(marianProblem([[0, 0], [1, 0], [3, 3], [4, 3]]) || ''));
check('a V must open upward round its point', /opens upward/.test(marianProblem([[0, 0], [1, 0], [2, 1], [3, 1]]) || ''));
check('four cuts, no more, no fewer', !!marianProblem([[0, 0], [2, 0], [1, 1]]) && !!marianProblem([[0, 0], [2, 0], [1, 1], [3, 1], [4, 2]]));
check('the same cut twice is not two cuts', /twice/.test(marianProblem([[0, 0], [0, 0], [1, 1], [3, 1]]) || ''));
check('nonsense is refused, not thrown', !!marianProblem('VV') && !!marianProblem([[9, 9], [0, 0], [1, 1], [3, 1]]));
check('the beam has nicks top and bottom', MARIAN_TOPS.length === 5 && MARIAN_BOTTOMS.length === 4 && MARIAN_TOPS.every((p) => p[1] < MARIAN_BOTTOMS[0][1]));

check('five points on the circle, the first at the top', PENTANGLE_POINTS.length === 5 && PENTANGLE_POINTS[0][0] === 130 && PENTANGLE_POINTS.every((p) => p[1] >= PENTANGLE_POINTS[0][1]));
check('the endless knot: skip a point each step, close where you began', pentangleProblem([0, 2, 4, 1, 3, 0]) === null && pentangleProblem([3, 0, 2, 4, 1, 3]) === null && pentangleProblem([0, 3, 1, 4, 2, 0]) === null);
check('a pentagon is not a pentangle', /pentagon/.test(pentangleProblem([0, 1, 2, 3, 4, 0]) || ''));
check('lifted before it closes, the knot is open', /isn't closed/.test(pentangleProblem([0, 2, 4, 1, 3]) || ''));
check('going back over a line breaks it', /went back over/.test(pentangleProblem([0, 2, 0]) || ''));
check('a dot is not a stroke', !!pentangleProblem([0]) && !!pentangleProblem(null));

check('SATOR first reads true', satorProblem(['SATOR', 'AREPO', 'TENET', 'OPERA', 'ROTAS']) === null);
check('…and ROTAS first, as at Pompeii', satorProblem(['rotas', 'opera', 'tenet', 'arepo', 'sator']) === null);
check('rows out of order break the square', /column/.test(satorProblem(['SATOR', 'OPERA', 'TENET', 'AREPO', 'ROTAS']) || ''));
check('five rows of five', !!satorProblem(['SATOR', 'AREPO', 'TENET', 'OPERA']) && !!satorProblem(['SATO', 'AREPO', 'TENET', 'OPERA', 'ROTAS']));
check('another symmetric square is not the old one', /old five words/.test(satorProblem(['AAAAA', 'AAAAA', 'AAAAA', 'AAAAA', 'AAAAA']) || ''));

// ── The lore: sourced, tiered, honest ───────────────────────────────────────
const M = WARDS.marian, S = WARDS.sator, P = WARDS.pentangle;
check('Marian: Historic England\'s reading and its own doubt', /"VV for Virgin of Virgins"/.test(M.lore) && /"are however difficult to interpret and there is some academic dispute as to their meaning"/.test(M.lore));
check('…Easton\'s hearth beams, Knole\'s 1605–06 timber, Creswell\'s double VV', /"on hearth beams, doors, and around windows" \(Easton\)/.test(M.lore) && /1605–06/.test(M.lore) && /Creswell Crags/.test(M.lore));
check('…cut it in new wood, never old fabric; report a find', /never in old fabric/.test(M.lore) && /Historic Environment Record/.test(M.lore) && /HEAG288/.test(M.source));
check('SATOR: Pompeii before 79, Dura, Cirencester (no disputed date)', /Pompeii before AD 79/.test(S.lore) && /Dura-Europos/.test(S.lore) && /Cirencester, found in 1868/.test(S.lore) && !/2nd century|third or fourth/.test(S.lore));
check('…the English childbirth charm and Hohman\'s plate thrown into the fire', /"most commonly found in medical collections as a charm for childbirth"/.test(S.lore) && /"on each side of a plate, and throw it into the fire"/.test(S.lore));
check('…and a plate puts out no fire: get out, stay out, 999', /get out, stay out, and call 999/.test(S.lore) && /Fire Kills/.test(S.source));
check('Pentangle: Morris\'s Middle English, the endless knot, trawþe', /"a syngne þat Salamon set sum-quyle, \/ In bytoknyng of trawþe"/.test(P.lore) && /þe endeles knot/.test(P.lore) && /ll\. 619–65/.test(P.source));
check('…a poet\'s emblem, not a recorded charm; the Wiccan pentacle a revival', /not a charm/.test(P.lore) && /modern revival/.test(P.lore));
check('all three are on the record tier', [M, S, P].every((w) => w.tier === 'record'));

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
  const goOut = (p) => { p.room = 'outside'; p.instance = ''; };

  const a = join('Scribe', 'marks_a');
  say(a.s, { type: 'wards_state' });
  const st = a.s.lastOfType('wards_state');
  check('the panel is sent the boards to draw on', st && st.boards && st.boards.marian.tops.length === 5 && st.boards.pentangle.points.length === 5);
  check('…and the three new marks, undrawn', st && st.marian === false && st.sator === false && st.pentangle === false && st.lore.marian && st.lore.sator && st.lore.pentangle);

  // The Marian mark: at home, checked, guards.
  const guard0 = h.statContrib(a.p, 'guard');
  goOut(a.p);
  say(a.s, { type: 'cut_marian', cuts: [[0, 0], [2, 0], [1, 1], [3, 1]] });
  check('the Marian mark is cut at home, not in the square', !(h.accounts.marks_a.wards && h.accounts.marks_a.wards.marian));
  goHome(a.p);
  a.s.sent.length = 0;
  say(a.s, { type: 'cut_marian', cuts: [[0, 0], [1, 0], [3, 3], [4, 3]] });
  check('two Vs standing apart are turned down, with the reason', !h.accounts.marks_a.wards.marian && /stand apart/.test((a.s.lastOfType('wards_error') || {}).message || ''));
  say(a.s, { type: 'cut_marian', cuts: [[0, 0], [2, 0], [1, 1], [3, 1]] });
  check('a true VV is cut on the hearth beam', !!h.accounts.marks_a.wards.marian);
  check(`…and it guards: +${WARD_GUARD * 100}%`, Math.abs(h.statContrib(a.p, 'guard') - guard0 - WARD_GUARD) < 1e-9);
  a.s.sent.length = 0;
  say(a.s, { type: 'cut_marian', cuts: [[0, 0], [2, 0], [1, 1], [3, 1]] });
  check('one is enough', !!a.s.lastOfType('wards_error'));

  // The SATOR plate.
  const guard1 = h.statContrib(a.p, 'guard');
  say(a.s, { type: 'write_sator', rows: ['SATOR', 'OPERA', 'TENET', 'AREPO', 'ROTAS'] });
  check('a muddled square is turned down', !h.accounts.marks_a.wards.sator);
  say(a.s, { type: 'write_sator', rows: ['ROTAS', 'OPERA', 'TENET', 'AREPO', 'SATOR'] });
  check('the square, ROTAS first, is written on the plate', !!h.accounts.marks_a.wards.sator);
  check('…and it guards too', Math.abs(h.statContrib(a.p, 'guard') - guard1 - WARD_GUARD) < 1e-9);

  // The pentangle: anywhere, once, health.
  goOut(a.p);
  const hp0 = h.playerMaxHealth(a.p);
  say(a.s, { type: 'paint_pentangle', seq: [0, 1, 2, 3, 4, 0] });
  check('a pentagon is not painted', !h.accounts.marks_a.wards.pentangle);
  say(a.s, { type: 'paint_pentangle', seq: [0, 2, 4, 1, 3] });
  check('an unclosed knot is not painted', !h.accounts.marks_a.wards.pentangle);
  say(a.s, { type: 'paint_pentangle', seq: [0, 2, 4, 1, 3, 0] });
  check('the endless knot is painted, away from home', !!h.accounts.marks_a.wards.pentangle);
  check(`…and is borne: +${PENTANGLE_VITALITY} max health`, h.playerMaxHealth(a.p) === hp0 + PENTANGLE_VITALITY, { before: hp0, after: h.playerMaxHealth(a.p) });
  check('…which guards nothing (it is not a house ward)', Math.abs(h.statContrib(a.p, 'guard') - guard1 - WARD_GUARD) < 1e-9);

  // The house shows its marks; the Charm Book has them.
  const pub = h.wardsPublic('marks_a');
  check('a visitor sees the VV and the plate', pub.marian === true && pub.sator === true && pub.pentangle === true);
  const { buildCharmBook } = require('../lib/charmBook');
  const book = buildCharmBook({ acct: h.accounts.marks_a, prog: {}, seasonKey: null });
  const wardsCh = book.chapters.find((c) => c.key === 'wards' || c.id === 'wards');
  const ids = wardsCh ? wardsCh.entries.map((e) => e.id) : [];
  check('the Charm Book lists the three marks under Threshold & Hearth, met', ['marian', 'sator', 'pentangle'].every((k) => ids.includes(k)) && wardsCh.entries.filter((e) => ['marian', 'sator', 'pentangle'].includes(e.id)).every((e) => e.met));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
