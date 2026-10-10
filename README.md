# Fuel

A personal nutrition and fitness tracker. It's a Progressive Web App built with plain HTML, CSS and JavaScript (no build step), stores everything on the phone in IndexedDB via Dexie.js, and is hosted on GitHub Pages.

- `index.html`, `manifest.webmanifest` and `sw.js` make up the app shell and offline support.
- `js/plan.js` holds the BMR, TDEE, calorie, macro and safety-limit math.
- `js/views/` contains one module per screen.

When you change any shell file, bump `VERSION` in `sw.js` so installed copies update.
