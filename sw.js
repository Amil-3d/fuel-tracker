// Service worker: precache the app shell so it works offline.
// Bump VERSION whenever any shell file changes so phones pick up the update.
const VERSION = 'fuel-v11';
const DEXIE_URL = 'https://cdn.jsdelivr.net/npm/dexie@4.0.10/dist/dexie.mjs';
const ZXING_URL = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';

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
  'js/nutrition.js',
  'js/barcode.js',
  'js/menu.js',
  'js/charts.js',
  'js/icons.js',
  'js/recommend.js',
  'js/views/onboarding.js',
  'js/views/plan-card.js',
  'js/views/profile-form.js',
  'js/views/today.js',
  'js/views/food.js',
  'js/views/food-add.js',
  'js/views/meal-count.js',
  'js/views/progress.js',
  'js/views/settings.js',
  DEXIE_URL,
  ZXING_URL
];

self.addEventListener('install', (event) => {
  // cache: 'reload' skips the browser's HTTP cache, so a new version never precaches stale files.
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' })))));
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
  if (/\/data\/menu[\w-]*\.json$/.test(url.pathname)) {
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
