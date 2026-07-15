// ---------------------------------------------------------------------------
// The Midnight Peddler's legendary shop (Tier 3.4 Phase C). DI factory; open-
// state via the Modals registry. myMoonstones is shared balance (get/set
// injected); refreshMsUI/openMsModal belong to the Moonstones section.
// ---------------------------------------------------------------------------
import { Modals } from './modals.js';

export default function createLegendShop({ getWs, getMyMoonstones, setMyMoonstones, refreshMsUI, openMsModal, ITEM_CATALOG }) {
let legendCountdownTimer = null;
const LEGEND_TIER_NAMES = { 1: 'CURIO', 2: 'RELIC', 3: 'ARCANUM', 4: 'SEVERANCE-CLASS' };
const LEGEND_STAT_LABELS = { power: 'Power', guard: 'Guard', vitality: 'Max HP', haste: 'Haste', swift: 'Speed', leech: 'Lifesteal', xp: 'XP', forage: 'Forage' };
function legendStatLine(stats) {
  return Object.entries(stats).map(([k, val]) =>
    '+' + (k === 'vitality' ? val : Math.round(val * 100) + '%') + ' ' + (LEGEND_STAT_LABELS[k] || k)
  ).join(' · ');
}
function openLegendShop() {
  if (getWs() && getWs().readyState === WebSocket.OPEN) getWs().send(JSON.stringify({ type: 'legend_shop_open' }));
}
function closeLegendShop() {
  const modal = document.getElementById('legendModal');
  if (modal) modal.classList.add('hidden');
  Modals.set('legendModalOpen', false);
  clearInterval(legendCountdownTimer);
}
function renderLegendShop(msg) {
  const modal = document.getElementById('legendModal');
  if (!modal) return;
  setMyMoonstones(msg.balance != null ? msg.balance : getMyMoonstones());
  document.getElementById('legendGreeting').textContent = msg.greeting || '';
  document.getElementById('legendErr').textContent = '';
  refreshMsUI();
  const cd = document.getElementById('legendCountdown');
  const paintCountdown = () => {
    const ms = (msg.nextRotationAt || 0) - Date.now();
    if (ms <= 0) { cd.textContent = '🌒 The stock is turning over — reopen the stall.'; return; }
    const d = Math.floor(ms / 86400000), h = Math.floor(ms / 3600000) % 24, m = Math.floor(ms / 60000) % 60;
    cd.textContent = '🌒 New wonders in ' + (d > 0 ? d + 'd ' + h + 'h' : h + 'h ' + m + 'm') + ' — five of a hundred, never the same five.';
  };
  paintCountdown();
  clearInterval(legendCountdownTimer);
  legendCountdownTimer = setInterval(paintCountdown, 30000);
  const list = document.getElementById('legendItems');
  list.innerHTML = '';
  for (const it of msg.items || []) {
    const row = document.createElement('div');
    row.className = 'legendRow tier' + it.tier;
    const nameLine = document.createElement('div');
    nameLine.className = 'legendName';
    nameLine.textContent = it.icon + ' ' + it.name;
    const tier = document.createElement('span');
    tier.className = 'legendTier';
    tier.textContent = LEGEND_TIER_NAMES[it.tier] || '';
    nameLine.appendChild(tier);
    row.appendChild(nameLine);
    const desc = document.createElement('div');
    desc.className = 'legendDesc';
    desc.textContent = it.desc;
    row.appendChild(desc);
    const fxLine = document.createElement('div');
    fxLine.className = 'legendFxLine';
    fxLine.style.color = it.fx && it.fx.c1 ? it.fx.c1 : '';
    fxLine.textContent = '✦ Everyone sees: ' + (it.fx ? LEGEND_FX.describe(it.fx) : '—');
    row.appendChild(fxLine);
    const stats = document.createElement('div');
    stats.className = 'legendStats';
    stats.textContent = '⚔ ' + legendStatLine(it.stats) + '  (' + (ITEM_CATALOG[it.id] ? (it.slot || 'trinket') : it.slot) + ')';
    row.appendChild(stats);
    const buyRow = document.createElement('div');
    buyRow.className = 'legendBuyRow';
    const price = document.createElement('span');
    price.className = 'legendPrice';
    price.textContent = it.ms + ' 💎';
    buyRow.appendChild(price);
    const buyBtn = document.createElement('button');
    buyBtn.className = 'btn legendBuyBtn';
    const canAfford = getMyMoonstones() >= it.ms;
    buyBtn.textContent = canAfford ? 'Buy' : 'Need ' + (it.ms - getMyMoonstones()) + ' more 💎';
    buyBtn.disabled = !canAfford;
    buyBtn.addEventListener('click', () => {
      document.getElementById('legendErr').textContent = '';
      getWs().send(JSON.stringify({ type: 'legend_shop_buy', itemId: it.id }));
    });
    buyRow.appendChild(buyBtn);
    row.appendChild(buyRow);
    list.appendChild(row);
  }
  modal.classList.remove('hidden');
  Modals.set('legendModalOpen', true);
}
const legendCloseBtn = document.getElementById('legendCloseBtn');
if (legendCloseBtn) legendCloseBtn.addEventListener('click', closeLegendShop);
const legendGetMsBtn = document.getElementById('legendGetMsBtn');
if (legendGetMsBtn) legendGetMsBtn.addEventListener('click', () => { closeLegendShop(); openMsModal(); });

  return { openLegendShop, closeLegendShop, renderLegendShop };
}
