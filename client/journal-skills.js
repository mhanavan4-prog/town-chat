// ---------------------------------------------------------------------------
// Journal + Skills panels (Tier 3.4 Phase C). The 📖 Journal (J) — story chapter
// objectives + the last chapter's outro — and the 🌟 Skills tree (K) — spend
// skill points on class bonuses, render skill_state, send allocate/respec. The
// server owns the truth; these just render and message. Modals + the float-pos
// helper are injected; me/ws/mySkillState/storyState via getters, storyLastOutro
// get/set (the journal clears the outro once the next chapter begins).
// ---------------------------------------------------------------------------
export default function createJournalSkills({ Modals, setDefaultFloatPos, getMe, getWs, getMySkillState, getStoryState, getStoryLastOutro, setStoryLastOutro }) {
function openJournal() {
  const modal = document.getElementById('journalModal');
  if (!modal) return;
  renderJournal();
  modal.classList.remove('hidden');
  setDefaultFloatPos(modal, 370, 112);
  Modals.set('journalOpen', true);
  // Ask for a fresh snapshot too, in case this client missed one.
  if (getWs() && getWs().readyState === 1) getWs().send(JSON.stringify({ type: 'story_state' }));
}

function closeJournal() {
  const modal = document.getElementById('journalModal');
  if (modal) modal.classList.add('hidden');
  Modals.set('journalOpen', false);
}

function updateSkillsBadge() {
  const sp = getMe() ? (getMe().skillPoints || 0) : 0;
  const badge = document.getElementById('skillsBadge');
  if (badge) badge.textContent = sp > 0 ? String(sp) : '';
  // Mirror the unspent-point count onto the ☰ chip (desktop) and the
  // menu sheet's Skills row (both platforms) so it's visible from anywhere.
  for (const id of ['pcMenuBadge', 'menuSkillsBadge']) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.textContent = sp > 0 ? String(sp) : '';
    el.classList.toggle('show', sp > 0);
  }
}

function openSkills() {
  const modal = document.getElementById('skillsModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  setDefaultFloatPos(modal, 370, 150);
  Modals.set('skillsOpen', true);
  renderSkills();
  if (getWs() && getWs().readyState === 1) getWs().send(JSON.stringify({ type: 'skill_state' }));
}
function closeSkills() {
  const modal = document.getElementById('skillsModal');
  if (modal) modal.classList.add('hidden');
  Modals.set('skillsOpen', false);
}

function renderSkills() {
  const list = document.getElementById('skillsList');
  const pts = document.getElementById('skillsPointsLabel');
  const titleEl = document.getElementById('skillsTitle');
  if (!list) return;
  const st = getMySkillState();
  const CLASS_TREE_NAME = ['📖 Coven Secrets', '🐺 Feral Instincts', '🕯️ Spirit Communion', '⚔️ Martial Discipline', '🥾 Road Wisdom'];
  if (titleEl && st) titleEl.textContent = '🌟 ' + (CLASS_TREE_NAME[st.charId] || 'Skills');
  // getMe().skillPoints is the live count (kept fresh by xp_gain/level_up); the
  // skill_state snapshot can lag a level-up that didn't re-send it.
  const sp = getMe() ? (getMe().skillPoints || 0) : (st ? st.skillPoints : 0);
  if (pts) pts.textContent = sp === 1 ? '1 skill point to spend' : `${sp} skill points to spend`;
  list.innerHTML = '';
  if (!st || !st.skills) { list.textContent = 'Loading your skills…'; return; }
  for (const sk of st.skills) {
    const row = document.createElement('div');
    row.className = 'skillRow' + (sk.rank >= sk.maxRank ? ' maxed' : '');
    const icon = document.createElement('div');
    icon.className = 'skillIcon'; icon.textContent = sk.icon;
    const main = document.createElement('div');
    main.className = 'skillMain';
    const nm = document.createElement('div');
    nm.className = 'skillName'; nm.textContent = `${sk.name} — rank ${sk.rank}/${sk.maxRank}`;
    const ds = document.createElement('div');
    ds.className = 'skillDesc'; ds.textContent = sk.desc;
    const pips = document.createElement('div');
    pips.className = 'skillPips';
    for (let i = 0; i < sk.maxRank; i++) {
      const pip = document.createElement('div');
      pip.className = 'skillPip' + (i < sk.rank ? ' filled' : '');
      pips.appendChild(pip);
    }
    main.appendChild(nm); main.appendChild(ds); main.appendChild(pips);
    const buy = document.createElement('button');
    buy.className = 'skillBuy';
    buy.textContent = '+';
    const canBuy = sk.rank < sk.maxRank && sp > 0;
    buy.disabled = !canBuy;
    buy.title = sk.rank >= sk.maxRank ? 'Maxed out' : (sp > 0 ? `Spend 1 point on ${sk.name}` : 'No skill points — level up to earn more');
    buy.addEventListener('click', () => {
      if (getWs() && getWs().readyState === 1) getWs().send(JSON.stringify({ type: 'skill_allocate', skillId: sk.id }));
    });
    row.appendChild(icon); row.appendChild(main); row.appendChild(buy);
    list.appendChild(row);
  }
}

const skillsBtn = document.getElementById('skillsBtn');
if (skillsBtn) skillsBtn.addEventListener('click', () => { if (Modals.isOpen('skillsOpen')) closeSkills(); else openSkills(); });
const skillsCloseBtn = document.getElementById('skillsCloseBtn');
if (skillsCloseBtn) skillsCloseBtn.addEventListener('click', closeSkills);
const skillsRespecBtn = document.getElementById('skillsRespecBtn');
if (skillsRespecBtn) skillsRespecBtn.addEventListener('click', () => {
  if (getWs() && getWs().readyState === 1) getWs().send(JSON.stringify({ type: 'skill_respec' }));
});

function journalDiv(className, text) {
  const el = document.createElement('div');
  el.className = className;
  if (text != null) el.textContent = text;
  return el;
}

function renderJournal() {
  const c = document.getElementById('journalContent');
  if (!c) return;
  c.innerHTML = '';
  const s = getStoryState();
  if (!s) {
    c.appendChild(journalDiv('journalDone', 'The pages are blank… no story has found you yet.'));
    return;
  }

  const titleEl = document.getElementById('journalTitle');
  if (titleEl) titleEl.textContent = `${s.icon} ${s.title}`;

  const header = journalDiv('journalHeader');
  header.appendChild(journalDiv('journalStoryTitle', `${s.icon} ${s.title}`));
  header.appendChild(journalDiv('journalTagline', s.tagline));
  header.appendChild(journalDiv('journalChapterNo',
    s.complete ? `All ${s.totalChapters} chapters complete` : `Chapter ${s.chapterIndex + 1} of ${s.totalChapters}`));
  c.appendChild(header);

  // The whole road, drawn: every chapter as a milestone — done ✓, current
  // ➤, or ahead (with its level gate). Seeing the full arc with your pin
  // on it is what makes the remaining distance feel walkable.
  if (Array.isArray(s.arc) && s.arc.length) {
    const arcBox = journalDiv('journalArc');
    s.arc.forEach((a, i) => {
      const row = journalDiv('journalArcRow ' + a.state);
      const mark = a.state === 'done' ? '✓' : (a.state === 'current' ? '➤' : '·');
      const gate = a.state === 'ahead' && a.requiresLevel > 1 ? `  (Lv ${a.requiresLevel})` : '';
      row.textContent = `${mark} ${i + 1}. ${a.title}${gate}`;
      arcBox.appendChild(row);
    });
    c.appendChild(arcBox);
  }

  // The just-finished chapter's ending, kept on the desk until the next
  // chapter is begun.
  if (getStoryLastOutro()) {
    const outroBox = journalDiv('journalLetter');
    outroBox.appendChild(journalDiv('journalObjLabel', `✅ ${getStoryLastOutro().title}`));
    outroBox.appendChild(journalDiv('', getStoryLastOutro().outro));
    if (getStoryLastOutro().rewards) outroBox.appendChild(journalDiv('journalRewards', getStoryLastOutro().rewards));
    c.appendChild(outroBox);
  }

  if (s.complete) {
    c.appendChild(journalDiv('journalDone',
      `${s.icon} Your story is written, and Thornreach will tell it for a long time. (Side quests and the rest of the town are still out there.)`));
  } else if (s.chapter) {
    const ch = s.chapter;
    c.appendChild(journalDiv('journalStoryTitle', `${ch.title}`));
    c.appendChild(journalDiv('journalLetter', ch.intro));

    const obj = journalDiv('journalObjective');
    obj.appendChild(journalDiv('journalObjLabel', `🎯 ${ch.objectiveLabel}`));
    if (ch.where) obj.appendChild(journalDiv('journalWhere', `🧭 ${ch.where}`));
    if (s.active) {
      const barWrap = journalDiv('journalBarWrap');
      const fill = journalDiv('journalBarFill');
      fill.style.width = Math.min(100, Math.round(100 * s.progress / Math.max(1, ch.target))) + '%';
      barWrap.appendChild(fill);
      obj.appendChild(barWrap);
      obj.appendChild(journalDiv('', `${s.progress} / ${ch.target}`));
    }
    c.appendChild(obj);

    const rewardBits = [`+${ch.xpReward} XP`];
    if (ch.goldReward) rewardBits.push(`+${ch.goldReward}🪙`);
    for (const r of ch.itemRewards || []) rewardBits.push(`${r.icon} ${r.name}${r.qty > 1 ? ' ×' + r.qty : ''}`);
    c.appendChild(journalDiv('journalRewards', `Reward: ${rewardBits.join(' · ')}`));

    if (!s.active) {
      const begin = document.createElement('button');
      begin.className = 'btn';
      begin.id = 'journalBeginBtn';
      if (ch.levelOk === false) {
        // Gated — say exactly what opens it and where you stand, so the
        // locked button reads as a goal, not a wall.
        begin.disabled = true;
        begin.textContent = `🔒 Opens at Level ${ch.requiresLevel} — you're Level ${ch.playerLevel}`;
        begin.title = 'Side quests, night hunts, harvests and dungeons all pay XP.';
      } else {
        begin.textContent = `📖 Begin Chapter ${s.chapterIndex + 1}`;
        begin.addEventListener('click', () => {
          setStoryLastOutro(null);
          getWs().send(JSON.stringify({ type: 'story_begin' }));
        });
      }
      c.appendChild(begin);
      if (ch.levelOk === false) {
        c.appendChild(journalDiv('journalGateHint',
          '💡 Fastest XP: side quests from any shopkeeper, night hunts outside, and the dungeons below the temple.'));
      }
    }
  }

  // Active side quest, mirrored from the quest tracker so the Journal is
  // the one place to check everything you're on.
  const sq = journalDiv('journalSideQuest');
  sq.appendChild(journalDiv('jsqTitle', 'Side quest'));
  const qt = document.getElementById('questTracker');
  if (qt && !qt.classList.contains('hidden')) {
    sq.appendChild(journalDiv('', `${document.getElementById('questTrackerName').textContent} — ${document.getElementById('questTrackerCount').textContent}`));
  } else {
    sq.appendChild(journalDiv('', 'None — the town\'s NPCs always have work for you.'));
  }
  c.appendChild(sq);
}

  return { openJournal, closeJournal, updateSkillsBadge, openSkills, closeSkills, renderSkills, renderJournal };
}
