const CACHE = 'mt-v2-23';
const PRECACHE = ['/', '/css/styles.css', '/js/auth.js', '/js/sheets.js', '/js/store.js', '/js/schedule.js', '/js/tracker.js', '/js/editor.js', '/js/labs.js', '/js/i18n.js', '/js/app.js', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  // Only cache GET requests to our own origin; never intercept Google API calls
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.hostname !== self.location.hostname) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
