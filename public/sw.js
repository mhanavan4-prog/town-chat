// Thornreach service worker — Web Push only (Session L).
// No caching, no fetch interception: the game client manages itself. This
// worker exists so the browser can wake us for a push and land a click back
// in the town.
self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

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
