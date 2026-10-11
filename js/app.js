import { getProfile, getSetting, requestPersistence } from './db.js';
import { renderOnboarding } from './views/onboarding.js';
import { renderToday } from './views/today.js';
import { renderProgress } from './views/progress.js';
import { renderSettings } from './views/settings.js';
import { renderFood } from './views/food.js';
import { renderFoodAdd } from './views/food-add.js';
import { renderImport } from './views/import.js';
import { applyTheme } from './ui.js';

const routes = {
  today: renderToday,
  food: (root, sub, params) => (sub === 'add' ? renderFoodAdd(root, params) : renderFood(root, params)),
  progress: renderProgress,
  settings: renderSettings,
  import: renderImport
};

const view = document.getElementById('view');
const tabbar = document.getElementById('tabbar');

async function route() {
  const profile = await getProfile();
  if (!profile) {
    tabbar.hidden = true;
    document.body.classList.add('no-tabs');
    renderOnboarding(view, () => { if (location.hash === '#/today') route(); else location.hash = '#/today'; });
    return;
  }
  tabbar.hidden = false;
  document.body.classList.remove('no-tabs');

  const raw = location.hash.replace(/^#\/?/, '') || 'today';
  const [path, query = ''] = raw.split('?');
  const [name, sub] = path.split('/');
  const params = new URLSearchParams(query);
  const render = routes[name] || routes.today;
  tabbar.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.dataset.tab === (routes[name] && name !== 'import' ? name : 'today')));
  await render(view, sub, params);
  if (sub !== 'plan') window.scrollTo(0, 0);
}

async function boot() {
  applyTheme((await getSetting('theme')) || 'system');
  window.addEventListener('hashchange', route);
  await route();
  requestPersistence();

  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
    // Home-screen apps on iOS often resume instead of reloading, so check for updates when reopened.
    reg?.update?.().catch(() => {});
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg?.update?.().catch(() => {});
    });
    // When a new version takes over, reload once so the new files are used.
    let reloaded = false;
    const hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !reloaded) { reloaded = true; location.reload(); }
    });
  }
}

boot();
