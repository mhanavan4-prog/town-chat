// The Necromancer's ritual questline (PR 2) — his own 9-chapter campaign, like
// every class, that doubles as his power spine: each rite completed raises his
// NECRO RANK, which strengthens the undead he raises and widens the summon cap.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-necroq-');

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
  const h = global.__testHooks;
  const line = h.STORYLINES[5];

  // ── The questline exists, like every other class, and is ritual-themed ──
  check('the Necromancer has his own 9-chapter storyline', line && line.chapters.length === 9, line && line.chapters.length);
  check('it is The Sixth Rite', line && line.title === 'The Sixth Rite');
  check('the base campaign capstone grants a relic staff', line.chapters[5].itemRewards.some(r => r.itemId === 'void_staff'));
  const ep2 = line.chapters.slice(6).map(c => c.objective.type);
  check('Episode II threads the Delve, Workshop and World Boss', ep2.join() === ['delve_depth', 'craft_item', 'defeat_world_boss'].join(), ep2);

  // ── Live: each rite completed deepens necro rank ──
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  function join(tag, charId) {
    const s = makeMockSocket(tag); connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId }));
    const p = h.players.get(s.lastOfType('init').id);
    p.accountKey = tag.toLowerCase(); s._isGuest = false;
    const prog = h.getProgress(p); prog.level = 18; if (!prog.story) prog.story = {};
    return { s, p };
  }
  const N = join('Mortis', 5);
  check('a fresh Necromancer starts at rank 0', h.necroRank(N.p) === 0, h.necroRank(N.p));

  // Baseline summon strength at rank 0.
  const base = h.summonStats('skeleton', 10, 0);

  // Complete chapter 1 (talk to Elior) through the real story path.
  N.p.room = 'library';
  h.getProgress(N.p).story[5] = { chapter: 0, progress: 0, active: true };
  N.s.emit('message', JSON.stringify({ type: 'quest_talk', npcId: 'npc_scholar', npcName: 'Scholar Elior' }));
  check('completing the first rite raises rank to 1', h.necroRank(N.p) === 1, h.necroRank(N.p));

  // Complete chapter 2 (6 offerings) → rank 2.
  h.getProgress(N.p).story[5].active = true;
  for (let i = 0; i < 6; i++) h.storyEvent(N.p, 'harvest_plant', {});
  check('a second rite raises rank to 2', h.necroRank(N.p) === 2, h.necroRank(N.p));

  // Rank now empowers the undead and widens the cap.
  const ranked = h.summonStats('skeleton', 10, h.necroRank(N.p));
  check('ritual rank strengthens raised undead', ranked.maxHealth > base.maxHealth && ranked.dmgMax > base.dmgMax, { base, ranked });
  check('rank 2 widens the active summon cap to 3', h.minionCap(N.p) === 3, h.minionCap(N.p));

  // A minion raised now is tougher than one a rank-0 necromancer raises.
  const R0 = join('Novice', 5); R0.p.room = 'wilds'; R0.p.x = 500; R0.p.y = 500;
  const weak = h.raiseUndead(R0.p, 'skeleton');
  N.p.room = 'wilds'; N.p.x = 600; N.p.y = 600;
  const strong = h.raiseUndead(N.p, 'skeleton');
  check('a ranked Necromancer raises a sturdier skeleton', strong.minion.maxHealth > weak.minion.maxHealth, { weak: weak.minion.maxHealth, strong: strong.minion.maxHealth });

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 250);
