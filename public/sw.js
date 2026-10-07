// Thornreach service worker.
//  - Web Push (Session L): wake for a push and land the click back in the town.
//  - Offline shell: cache a friendly offline page + the app icon, so launching
//    the installed app with no connection shows "Reconnect" instead of a raw
//    browser error. We deliberately do NOT cache the game itself — it's a live
//    multiplayer world and needs the server; the CDN serves static files online.
const CACHE = 'thornreach-shell-v1';
const SHELL = ['/offline.html', '/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k === CACHE ? null : caches.delete(k))));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Page loads: try the network; if we're offline, show the cached offline page.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/offline.html')));
    return;
  }
  // The offline page's own assets (icon): serve from cache when present.
  const path = new URL(req.url).pathname;
  if (SHELL.includes(path)) {
    event.respondWith(caches.match(req).then((r) => r || fetch(req)));
  }
  // Everything else falls through to the normal network.
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}
  const title = data.title || '🌒 Thornreach';
  const body = data.body || 'Something stirs in the town.';
  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag: 'thornreach-' + (data.kind || 'news'), // one bubble per kind, newest wins
    data: { kind: data.kind || 'news', at: data.at || Date.now() }
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((tabs) => {
    for (const tab of tabs) {
      if ('focus' in tab) return tab.focus();
    }
    return self.clients.openWindow('/');
  }));
});
