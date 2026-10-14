/* EXIF Inspector service worker — scope /exif/ only (never the game).
   Caches the app shell so it opens instantly and works fully offline. */
const CACHE = 'exif-v1';
const ASSETS = ['./', './index.html', './icon-192.png', './icon-512.png', './icon-180.png', './manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((resp) => {
      try { const cp = resp.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); } catch (_) {}
      return resp;
    }).catch(() => caches.match('./index.html')))
  );
});
