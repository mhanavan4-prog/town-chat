// Live presence heartbeat — included on every non-game page. Beacons an opaque
// per-tab id to /api/presence so the analytics dashboard can show how many
// people are on the site right now. The game page (index.html) is deliberately
// NOT included: players there are counted from their live game connection.
// Fire-and-forget; never blocks or breaks the page.
(function () {
  try {
    var KEY = 'tr_presence_sid';
    var sid = '';
    try { sid = sessionStorage.getItem(KEY) || ''; } catch (e) {}
    if (!sid) {
      sid = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      try { sessionStorage.setItem(KEY, sid); } catch (e) {}
    }
    function ping() {
      try {
        fetch('/api/presence', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sid: sid }),
          keepalive: true
        }).catch(function () {});
      } catch (e) {}
    }
    ping();
    // Re-beacon inside the server's presence window so an open tab keeps
    // counting; pause while hidden (background tab), resume when shown.
    setInterval(function () { if (!document.hidden) ping(); }, 25000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) ping(); });
  } catch (e) { /* presence must never break the page */ }
})();
