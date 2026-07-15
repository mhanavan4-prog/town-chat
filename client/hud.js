// ---------------------------------------------------------------------------
// Player HUD (Tier 3.4 Phase C). The always-on overlays: the health bar, the XP
// bar, the quest tracker (+ its clear), the active story-chapter overlay, and the
// party roster. Pure DOM writes that read a little live state (me, gameStarted,
// restedUntil, myId, myParty, storyState) through injected read-only getters.
// ---------------------------------------------------------------------------
export default function createHud({ getMe, getGameStarted, getRestedUntil, getMyId, getMyParty, getStoryState }) {
function updateHealthHud() {
  const path = document.getElementById('healthHeartPath');
  const text = document.getElementById('healthPercentText');
  if (!path || !text) return;
  const maxHp = getMe() ? (getMe().maxHealth || 100) : 100;
  const hp = getMe() ? Math.max(0, Math.round(getMe().health)) : 100;
  const pct = Math.max(0, Math.min(100, Math.round(100 * hp / maxHp)));
  // Vitality skill raises max HP above 100 — show the actual pool (e.g.
  // "124/136") so the bonus is visible; a base-100 player keeps the tidy "%".
  text.textContent = maxHp > 100 ? `${hp}/${Math.round(maxHp)}` : pct + '%';
  path.style.fill = pct > 60 ? '#e0455a' : pct > 30 ? '#e0a93f' : '#8a2030';
}

// ---------------------------------------------------------------------------
// XP / level strip
// ---------------------------------------------------------------------------
// XP thresholds mirror server's XP_THRESHOLDS for computing the bar fill —
// the server is authoritative; this is purely cosmetic interpolation.
const CLIENT_XP_THRESHOLDS = [0,100,250,500,900,1400,2100,3000,4200,6000,
                               8200,11000,14500,19000,25000,32500,42000,54000,69000,87000];
const CLIENT_MAX_LEVEL = CLIENT_XP_THRESHOLDS.length - 1;

function updateXPDisplay() {
  const strip = document.getElementById('xpStrip');
  if (!strip || !getGameStarted()) return;
  strip.classList.remove('hidden');
  const level = getMe() ? (getMe().level || 1) : 1;
  const xp = getMe() ? (getMe().xp || 0) : 0;
  const sp = getMe() ? (getMe().skillPoints || 0) : 0;
  document.getElementById('xpStripLevel').textContent = `Lv ${level}`;
  document.getElementById('xpStripSP').textContent = `${sp} SP`;
  // 😴 Rested countdown — fades out when the window closes.
  const restedEl = document.getElementById('xpStripRested');
  if (restedEl) {
    const remain = getRestedUntil() - Date.now();
    if (remain > 0) {
      restedEl.classList.remove('hidden');
      document.getElementById('xpStripRestedTime').textContent = Math.ceil(remain / 60000) + 'm';
    } else restedEl.classList.add('hidden');
  }
  let pct = 0;
  if (level < CLIENT_MAX_LEVEL) {
    const lo = CLIENT_XP_THRESHOLDS[level - 1] || 0;
    const hi = CLIENT_XP_THRESHOLDS[level];
    pct = Math.min(100, Math.round(100 * (xp - lo) / Math.max(1, hi - lo)));
  } else {
    pct = 100;
  }
  document.getElementById('xpBarFill').style.width = pct + '%';
}

// ---------------------------------------------------------------------------
// Quest tracker (persistent progress panel)
// ---------------------------------------------------------------------------

function updateQuestTracker(questId, questName, progress, target, where) {
  const el = document.getElementById('questTracker');
  if (!el) return;
  el.classList.remove('hidden');
  document.getElementById('questTrackerName').textContent = questName;
  const pct = Math.min(100, Math.round(100 * progress / Math.max(1, target)));
  const fill = document.getElementById('questTrackerFill');
  fill.style.width = pct + '%';
  fill.classList.toggle('nearlyDone', pct >= 75);
  document.getElementById('questTrackerCount').textContent = `${progress} / ${target}`;
  const whereEl = document.getElementById('questTrackerWhere');
  if (whereEl) {
    whereEl.textContent = where ? `🧭 ${where}` : '';
    whereEl.style.display = where ? 'block' : 'none';
  }
}

function clearQuestTracker() {
  const el = document.getElementById('questTracker');
  if (el) el.classList.add('hidden');
}

// The small always-on overlay for the active chapter (right side, under the
// quest tracker) — same pattern as updateQuestTracker/clearQuestTracker.
function updateStoryTracker() {
  const el = document.getElementById('storyTracker');
  if (!el) return;
  const s = getStoryState();
  if (!s || s.complete || !s.active || !s.chapter) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  document.getElementById('storyTrackerName').textContent = `${s.icon} ${s.chapter.title}`;
  const pct = Math.min(100, Math.round(100 * s.progress / Math.max(1, s.chapter.target)));
  const fill = document.getElementById('storyTrackerFill');
  fill.style.width = pct + '%';
  // Goal-gradient glow: the bar visibly heats up near the finish line.
  fill.classList.toggle('nearlyDone', pct >= 75);
  document.getElementById('storyTrackerCount').textContent = `${s.chapter.objectiveLabel} — ${s.progress} / ${s.chapter.target}`;
  const whereEl = document.getElementById('storyTrackerWhere');
  if (whereEl) {
    whereEl.textContent = s.chapter.where ? `🧭 ${s.chapter.where}` : '';
    whereEl.style.display = s.chapter.where ? 'block' : 'none';
  }
}

function renderPartyHud() {
  const hud = document.getElementById('partyHud');
  const list = document.getElementById('partyMemberList');
  if (!hud || !list) return;
  if (!getMyParty() || getMyParty().members.length === 0) {
    hud.classList.add('hidden'); return;
  }
  hud.classList.remove('hidden');
  list.innerHTML = '';
  for (const m of getMyParty().members) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;';
    const crown = m.id === getMyParty().leaderId ? '👑 ' : '';
    const ghost = m.isDead ? ' 👻' : '';
    row.innerHTML = `<span style="color:${m.isDead ? '#88aacc' : '#aaddff'};">${crown}${m.name}${ghost}</span>`;
    if (m.id !== getMyId() && !m.isDead && getMe() && !getMe().isDead) {
      const invBtn = document.createElement('button');
      invBtn.textContent = '⚔️';
      invBtn.title = `Invite ${m.name}`;
      invBtn.style.cssText = 'padding:2px 6px;background:rgba(100,160,255,0.15);border:1px solid rgba(100,160,255,0.3);color:#aaddff;border-radius:4px;cursor:pointer;font-size:10px;';
      list.appendChild(row);
      continue;
    }
    list.appendChild(row);
  }
}

  return { updateHealthHud, updateXPDisplay, updateQuestTracker, clearQuestTracker, updateStoryTracker, renderPartyHud };
}
