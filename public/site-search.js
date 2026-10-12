/* Thornreach site search — a reusable "find a player or coven" box.
   Drop <div id="siteSearch"></div> on a page and include this script. It
   injects its own styles and queries /api/search. Standalone, no deps. */
(function () {
  "use strict";
  var host = document.getElementById('siteSearch');
  if (!host) return;

  var CLASS_HINT = ['Witch', 'Werewolf', 'Mystic', 'Knight', 'Wanderer', 'Lich'];
  function esc(s) { return String(s == null ? '' : s).replace(/[<>&"]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]; }); }

  var css = ''
    + '.ssWrap{position:relative}'
    + '.ssInput{width:200px;max-width:46vw;padding:8px 13px;border-radius:9px;border:1px solid rgba(185,138,255,0.22);'
    + 'background:rgba(6,3,14,0.6);color:#e9ddff;font-size:13.5px;font-family:inherit;outline:none;transition:border-color .14s ease,width .18s ease}'
    + '.ssInput:focus{border-color:rgba(185,138,255,0.55);width:250px}'
    + '.ssInput::placeholder{color:#8d80a8}'
    + '.ssResults{position:absolute;top:calc(100% + 8px);right:0;width:300px;max-width:88vw;max-height:60vh;overflow-y:auto;'
    + 'background:rgba(16,10,26,0.98);border:1px solid rgba(185,138,255,0.28);border-radius:12px;box-shadow:0 14px 44px rgba(0,0,0,0.55);'
    + 'padding:6px;z-index:120}'
    + '.ssResults.hidden{display:none}'
    + '.ssHead{font-size:9.5px;letter-spacing:1.5px;text-transform:uppercase;color:#8d80a8;padding:8px 10px 4px}'
    + '.ssItem{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:9px;color:#e9ddff;text-decoration:none;font-size:14px}'
    + '.ssItem:hover,.ssItem.sel{background:rgba(140,90,255,0.16)}'
    + '.ssItem .ic{width:30px;height:30px;flex:0 0 auto;border-radius:8px;display:flex;align-items:center;justify-content:center;'
    + 'background:rgba(140,90,255,0.14);font-size:16px;overflow:hidden}'
    + '.ssItem .ic img{width:100%;height:30px;object-fit:contain;object-position:center bottom}'
    + '.ssItem .nm{font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.ssItem .sub{color:#8d80a8;font-size:11.5px;margin-left:auto;flex:0 0 auto}'
    + '.ssEmpty{color:#8d80a8;font-size:13px;font-style:italic;padding:12px 10px}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  host.className = 'ssWrap';
  host.innerHTML = '<input class="ssInput" type="text" placeholder="Find a player or coven…" autocomplete="off" spellcheck="false">'
    + '<div class="ssResults hidden"></div>';
  var input = host.querySelector('.ssInput');
  var panel = host.querySelector('.ssResults');
  var items = [], sel = -1, timer = null, lastQ = '';

  function hide() { panel.classList.add('hidden'); sel = -1; }
  function render(d) {
    items = [];
    var html = '';
    if (d.players && d.players.length) {
      html += '<div class="ssHead">Players</div>';
      d.players.forEach(function (p) { items.push('/u/' + encodeURIComponent(p.name));
        html += '<a class="ssItem" href="/u/' + encodeURIComponent(p.name) + '"><span class="ic">🧙</span><span class="nm">' + esc(p.name) + '</span></a>'; });
    }
    if (d.covens && d.covens.length) {
      html += '<div class="ssHead">Covens</div>';
      d.covens.forEach(function (c) { items.push('/c/' + encodeURIComponent(c.id));
        html += '<a class="ssItem" href="/c/' + encodeURIComponent(c.id) + '"><span class="ic">' + (c.sigil || '🌑') + '</span><span class="nm">' + esc(c.name) + '</span><span class="sub">' + c.members + '</span></a>'; });
    }
    if (!html) html = '<div class="ssEmpty">No players or covens found.</div>';
    panel.innerHTML = html; panel.classList.remove('hidden'); sel = -1;
  }
  function doSearch(q) {
    fetch('/api/search?q=' + encodeURIComponent(q)).then(function (r) { return r.json(); })
      .then(function (d) { if (input.value.trim().toLowerCase() === q) render(d); }).catch(function () {});
  }
  input.addEventListener('input', function () {
    var q = input.value.trim().toLowerCase();
    if (q === lastQ) return; lastQ = q;
    clearTimeout(timer);
    if (q.length < 1) { hide(); return; }
    timer = setTimeout(function () { doSearch(q); }, 170);
  });
  input.addEventListener('keydown', function (e) {
    var links = panel.querySelectorAll('.ssItem');
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, links.length - 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); }
    else if (e.key === 'Enter') { if (links[sel]) { location.href = links[sel].getAttribute('href'); } else if (items[0]) { location.href = items[0]; } return; }
    else if (e.key === 'Escape') { hide(); input.blur(); return; }
    else return;
    links.forEach(function (l, i) { l.classList.toggle('sel', i === sel); });
    if (links[sel]) links[sel].scrollIntoView({ block: 'nearest' });
  });
  input.addEventListener('focus', function () { if (items.length && input.value.trim()) panel.classList.remove('hidden'); });
  document.addEventListener('click', function (e) { if (!host.contains(e.target)) hide(); });
})();
