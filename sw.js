const CACHE = 'mt-v2-44';
const PRECACHE = ['/', '/css/styles.css', '/css/report-print.css', '/js/auth.js', '/js/sheets.js', '/js/store.js', '/js/schedule.js', '/js/tracker.js', '/js/editor.js', '/js/labs.js', '/js/charts.js', '/js/reports.js', '/js/i18n.js', '/js/analytics.js', '/js/util.js', '/js/app.js', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // Cache Chart.js CDN on first load, serve from cache thereafter
  if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('chart.js')) {
    e.respondWith(
      caches.match(e.request).then(cached => cached ||
        fetch(e.request).then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        })
      )
    );
    return;
  }

  if (url.hostname !== self.location.hostname) return;

  // Network-first: always try to get the latest, fall back to cache offline
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
