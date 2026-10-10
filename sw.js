// Service worker: precache the app shell so it works offline.
// Bump VERSION whenever any shell file changes so phones pick up the update.
const VERSION = 'fuel-v1';
const DEXIE_URL = 'https://cdn.jsdelivr.net/npm/dexie@4.0.10/dist/dexie.mjs';

const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'icons/icon.svg',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'js/app.js',
  'js/db.js',
  'js/ui.js',
  'js/units.js',
  'js/plan.js',
  'js/state.js',
  'js/charts.js',
  'js/views/onboarding.js',
  'js/views/plan-card.js',
  'js/views/profile-form.js',
  'js/views/today.js',
  'js/views/progress.js',
  'js/views/settings.js',
  'js/views/placeholder.js',
  DEXIE_URL
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Menu data changes daily: try the network first, fall back to the cached copy.
  if (url.pathname.endsWith('/data/menu.json')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Everything else: cache first, then network. Navigations fall back to the shell.
  event.respondWith(
    caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then((hit) => {
      if (hit) return hit;
      return fetch(req).catch(() => (req.mode === 'navigate' ? caches.match('index.html') : undefined));
    })
  );
});
