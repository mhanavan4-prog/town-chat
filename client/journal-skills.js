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
  const CLASS_TREE_NAME = ['📖 Coven Secrets', '🐺 Feral Instincts', '🕯️ Spirit Communion', '⚔️ Martial Discipline', '🥾 Road Wisdom', '💀 Death Rites'];
  if (titleEl && st) titleEl.textContent = '🌟 ' + (CLASS_TREE_NAME[st.charId] || 'Skills');
  // getMe().skillPoints is the live count (kept fresh by xp_gain/level_up); the
  // skill_state snapshot can lag a level-up that didn't re-send it.
  const sp = getMe() ? (getMe().skillPoints || 0) : (st ? st.skillPoints : 0);
  if (pts) pts.textContent = sp === 1 ? '1 skill point to spend' : `${sp} skill points to spend`;
  list.innerHTML = '';
  if (!st || !st.skills) { list.textContent = 'Loading your skills…'; return; }

  // A skill carrying `mods` (keystone pacts + trade-off skills) shows its real
  // stat swings as chips — green for a gain, red for the price you pay — so the
  // build-defining choices read as choices, not flavor text. Magnitudes are
  // per-rank; vitality is flat HP, everything else a percentage.
  const STAT_LABEL = { power: 'dmg', guard: 'def', vitality: 'HP', haste: 'haste', swift: 'speed', leech: 'leech', xp: 'XP', forage: 'forage' };
  const STAT_ORDER = ['power', 'guard', 'vitality', 'haste', 'swift', 'leech', 'xp', 'forage'];
  function modChips(mods) {
    const wrap = document.createElement('div');
    wrap.className = 'skillMods';
    for (const k of STAT_ORDER) {
      const v = mods[k];
      if (v == null || v === 0) continue;
      const up = v > 0;
      const chip = document.createElement('span');
      chip.className = 'skillMod ' + (up ? 'up' : 'down');
      const mag = k === 'vitality'
        ? `${up ? '+' : '−'}${Math.abs(v)} ${STAT_LABEL[k]}`
        : `${up ? '+' : '−'}${Math.round(Math.abs(v) * 100)}% ${STAT_LABEL[k]}`;
      chip.textContent = mag;
      wrap.appendChild(chip);
    }
    return wrap;
  }
  function sendAllocate(id) {
    if (getWs() && getWs().readyState === 1) getWs().send(JSON.stringify({ type: 'skill_allocate', skillId: id }));
  }

  function skillRow(sk) {
    const chosen = sk.tier === 'keystone' && sk.rank > 0;
    const row = document.createElement('div');
    row.className = 'skillRow'
      + (sk.rank >= sk.maxRank ? ' maxed' : '')
      + (sk.tier === 'keystone' ? ' keystone' : '')
      + (sk.locked ? ' locked' : '')
      + (chosen ? ' chosen' : '');
    const icon = document.createElement('div');
    icon.className = 'skillIcon'; icon.textContent = sk.icon;
    const main = document.createElement('div');
    main.className = 'skillMain';
    const nm = document.createElement('div');
    nm.className = 'skillName';
    // Keystones are a binary pact, so "rank 0/1" reads oddly — show the vow.
    nm.textContent = sk.tier === 'keystone'
      ? (chosen ? `${sk.name} — sworn` : sk.name)
      : `${sk.name} — rank ${sk.rank}/${sk.maxRank}`;
    const ds = document.createElement('div');
    ds.className = 'skillDesc'; ds.textContent = sk.desc;
    main.appendChild(nm); main.appendChild(ds);
    if (sk.mods) main.appendChild(modChips(sk.mods));
    // A pact `behavior` is a real play-changing combat hook, not a stat — call
    // it out with its own marked chip so it reads as something new.
    if (sk.behavior) {
      const bh = document.createElement('div');
      bh.className = 'skillBehavior';
      bh.textContent = '⚡ ' + sk.behavior;
      main.appendChild(bh);
    }
    // Rank pips only for multi-rank (core) skills; a pact is all-or-nothing.
    if (sk.maxRank > 1) {
      const pips = document.createElement('div');
      pips.className = 'skillPips';
      for (let i = 0; i < sk.maxRank; i++) {
        const pip = document.createElement('div');
        pip.className = 'skillPip' + (i < sk.rank ? ' filled' : '');
        pips.appendChild(pip);
      }
      main.appendChild(pips);
    }
    // Scarcity made visible: the price of the next rank, greyed when you can't
    // yet afford it. Maxed/sworn/locked rows say so instead of a price.
    const maxed = sk.rank >= sk.maxRank;
    const nextCost = sk.nextCost;
    const afford = !sk.locked && !maxed && sp >= (nextCost || 0);
    const costEl = document.createElement('div');
    costEl.className = 'skillCost' + (afford ? '' : ' unafford');
    if (sk.locked) costEl.textContent = '🔒 Respec to change your pact';
    else if (maxed) costEl.textContent = sk.tier === 'keystone' ? '✓ Sworn' : '✓ Maxed';
    else costEl.textContent = (sk.tier === 'keystone' ? 'Swear' : `Next rank`) + ` · ${nextCost} pt${nextCost === 1 ? '' : 's'}`;
    main.appendChild(costEl);

    const buy = document.createElement('button');
    buy.className = 'skillBuy' + (sk.tier === 'keystone' ? ' keystoneBuy' : '');
    buy.textContent = chosen ? '✓' : (sk.tier === 'keystone' ? 'Swear' : '+');
    const canBuy = !maxed && afford;
    buy.disabled = !canBuy;
    buy.title = sk.locked ? 'Respec to change your sworn pact'
      : maxed ? (sk.tier === 'keystone' ? 'Sworn' : 'Maxed out')
      : afford ? `Spend ${nextCost} point${nextCost === 1 ? '' : 's'} on ${sk.name}`
      : `Costs ${nextCost} points — you have ${sp}. Level up to earn more.`;
    buy.addEventListener('click', () => sendAllocate(sk.id));
    row.appendChild(icon); row.appendChild(main); row.appendChild(buy);
    return row;
  }

  const core = st.skills.filter(s => (s.tier || 'core') !== 'keystone');
  const keys = st.skills.filter(s => s.tier === 'keystone');
  for (const sk of core) list.appendChild(skillRow(sk));

  if (keys.length) {
    const hdr = document.createElement('div');
    hdr.className = 'skillSectionHdr';
    const sworn = keys.some(k => k.rank > 0);
    hdr.innerHTML = `<span class="skillSectionTitle">⚜️ Sworn Pact</span>`
      + `<span class="skillSectionSub">${sworn ? 'Respec to change your path.' : 'Choose one — it remakes how your Lich plays.'}</span>`;
    list.appendChild(hdr);
    for (const sk of keys) list.appendChild(skillRow(sk));
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
