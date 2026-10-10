import { getProfile, getSetting, requestPersistence } from './db.js';
import { renderOnboarding } from './views/onboarding.js';
import { renderToday } from './views/today.js';
import { renderProgress } from './views/progress.js';
import { renderSettings } from './views/settings.js';
import { placeholder } from './views/placeholder.js';
import { applyTheme } from './ui.js';

const routes = {
  today: renderToday,
  food: placeholder('Food', 2, 'Log meals from Purdue dining menus, your own saved foods, or quick-add calories.'),
  exercise: placeholder('Exercise', 3, 'Log workouts and strength sets, with calories burned estimated from MET values.'),
  progress: renderProgress,
  settings: renderSettings
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

  const [name, sub] = (location.hash.replace(/^#\/?/, '') || 'today').split(/[/?]/);
  const render = routes[name] || routes.today;
  tabbar.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.dataset.tab === (routes[name] ? name : 'today')));
  await render(view, sub);
  if (sub !== 'plan') window.scrollTo(0, 0);
}

async function boot() {
  applyTheme((await getSetting('theme')) || 'system');
  window.addEventListener('hashchange', route);
  await route();
  requestPersistence();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
    // When a new version takes over, reload once so the new files are used.
    let reloaded = false;
    const hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !reloaded) { reloaded = true; location.reload(); }
    });
  }
}

boot();
